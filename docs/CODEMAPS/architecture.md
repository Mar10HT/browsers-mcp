<!-- Generated: 2026-10-05 | Files scanned: 20 | Token estimate: ~550 -->

# browsers-mcp Architecture

Single-process MCP server (stdio transport). One Playwright browser-automation
backend (`browser-manager.ts`) shared by 10 tool modules, each registering a
set of `server.tool(...)` calls on startup.

## Entry point

```
src/index.ts
  -> StdioServerTransport + McpServer
  -> registerXTools(server) for each module below
  -> process.on('SIGINT'|'SIGTERM') -> browserManager.closeAll()
```

## Dependency graph

```
                         +-------------------+
                         |     index.ts      |
                         +-------------------+
                                   |
        registers all 10 modules (no module imports another)
                                   |
   session  navigation  interaction  inspection  network
   console  evaluate    storage      performance accessibility
                                   |
                   every module's handlers call:
                                   v
                    +--------------------------+
                    |  browser-manager.ts       |  <- singleton
                    |  (browsers/contexts/pages,|
                    |   activePageId)           |
                    +--------------------------+
                                   |
                                   v
                         Playwright (chromium/firefox,
                         channel: chrome/edge, or brave
                         via executablePath)

   every module's handlers also call:
     utils/formatters.ts (textResult/imageResult/jsonResult/truncate*)
     utils/errors.ts     (handleToolError -> errorResult)

   accessibility.ts additionally calls:
     @axe-core/playwright (AxeBuilder.analyze())
```

Tool modules never import each other or `index.ts`. The only shared
state lives in the `browserManager` singleton (one active page at a time,
selected via `activePageId`).

## Tool modules (10)

| Module | Tools | Lines |
|---|---|---|
| `tools/session.ts` | browser_launch, browser_new_context, browser_new_page, browser_close_context, browser_close, browser_select_page, browser_list_contexts, browser_list_pages | 160 |
| `tools/navigation.ts` | browser_navigate, browser_go_back, browser_go_forward, browser_reload | 81 |
| `tools/interaction.ts` | browser_click, browser_type, browser_fill, browser_press_key, browser_hover, browser_select_option | 136 |
| `tools/inspection.ts` | browser_screenshot, browser_get_html, browser_get_text, browser_query_selector, browser_get_styles | 189 |
| `tools/accessibility.ts` | browser_list_interactive, browser_audit_a11y | 215 |
| `tools/network.ts` | browser_network_get_requests, browser_network_get_request_detail | 100 |
| `tools/console.ts` | browser_console_get_messages | 44 |
| `tools/evaluate.ts` | browser_evaluate | 34 |
| `tools/storage.ts` | browser_get_cookies, browser_set_cookie, browser_get_local_storage, browser_get_session_storage | 124 |
| `tools/performance.ts` | browser_get_performance_metrics, browser_generate_pdf, browser_emulate_device | 123 |

## Core services

- `services/browser-manager.ts` (singleton `browserManager`) — owns all
  `Browser`/`BrowserContext`/`Page` instances, indexed by incrementing numeric
  ids; `activePageId` is the single global focus every tool reads via
  `getActivePage()`. Reassigns `activePageId` on context/browser close or
  manual page close if other pages remain.
- `utils/formatters.ts` — `textResult`, `imageResult`, `jsonResult` (MCP
  content wrappers), `truncateHtml`/`truncateText` (capped by `constants.ts`).
- `utils/errors.ts` — `handleToolError(error: unknown)`, the single error-to-
  MCP-result translation point; every tool's catch block routes through it.
- `constants.ts` — all tunable caps (`MAX_HTML_LENGTH`, `MAX_NETWORK_REQUESTS`,
  `MAX_AXE_NODES_PER_VIOLATION`, `DEFAULT_VIEWPORT`, etc).

## Testing

`src/tools/accessibility.test.ts` — the only test file in the repo (`node:test`,
stdlib, no mocking framework). Launches a real headless Chrome via
`browserManager` and exercises `listInteractiveElements`/`auditAccessibility`
directly (bypassing the MCP protocol layer). Run via `npm test`
(`tsc && node --test dist/tools/accessibility.test.js` — scoped to this one
file; pointing `node --test` at a bare directory containing `index.js` makes
it resolve and execute the MCP server entry point instead of discovering
tests, so the script targets the file explicitly).
