<!-- Generated: 2026-10-05 | Files scanned: 1 (package.json) | Token estimate: ~120 -->

# Dependencies

## Runtime

- **playwright** (^1.52.0, installed 1.58.2) — browser automation backend for
  every tool module. Launches chromium under the hood for `chrome`/`edge`
  (via `channel`) and `brave` (via `executablePath`); `firefox` launches
  Firefox directly. No webkit support in `browser-manager.ts`.
- **@modelcontextprotocol/sdk** (^1.12.1) — `McpServer` + `StdioServerTransport`.
  `server.tool(...)` is the registration API used by all 10 modules; it is
  marked `@deprecated` in favor of `registerTool` in current SDK typings, but
  kept for consistency across the whole repo (migrating is a separate task,
  not scoped to any single tool module).
- **zod** (^3.24.0) — parameter schemas for every tool.
- **@axe-core/playwright** (^4.13.0) — used only by `tools/accessibility.ts`
  (`browser_audit_a11y`). Import as a named import (`{ AxeBuilder }`), not the
  default export — the package's single unconditional `types` export-map entry
  makes TS under `moduleResolution: Node16` type the default import as the
  whole module namespace instead of the class, so `new AxeBuilder(...)` fails
  to type-check with a default import.

## Dev-only

- **typescript** (^5.7.0), **@types/node** (^22.0.0).

## Testing

No test framework dependency. Uses Node's built-in `node:test` +
`node:assert/strict` (stable since Node 18, repo runs on Node 24).
