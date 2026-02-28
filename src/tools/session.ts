import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { jsonResult, textResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';

export function registerSessionTools(server: McpServer): void {
  server.tool(
    'browser_launch',
    'Launch a browser instance (Chrome, Edge, or Firefox). Creates a default context and page.',
    {
      browser: z.enum(['chrome', 'edge', 'firefox']).default('chrome').describe('Browser to launch'),
      headless: z.boolean().default(false).describe('Run in headless mode'),
      viewport_width: z.number().optional().describe('Viewport width in pixels'),
      viewport_height: z.number().optional().describe('Viewport height in pixels'),
    },
    async ({ browser, headless, viewport_width, viewport_height }) => {
      try {
        const viewport =
          viewport_width && viewport_height ? { width: viewport_width, height: viewport_height } : undefined;
        const result = await browserManager.launchBrowser(browser, headless, viewport);
        return textResult(
          `Launched ${browser} browser (ID: ${result.browserId}) with context (ID: ${result.contextId}) and page (ID: ${result.pageId})`
        );
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_close',
    'Close a browser instance by ID',
    {
      browser_id: z.number().describe('Browser instance ID to close'),
    },
    async ({ browser_id }) => {
      try {
        await browserManager.closeBrowser(browser_id);
        return textResult(`Browser ${browser_id} closed`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_new_context',
    'Create a new isolated context (like incognito) in a browser. Each context has its own cookies, storage, and sessions — useful for simulating multiple users.',
    {
      browser_id: z.number().describe('Browser instance ID'),
      label: z.string().default('default').describe('Label for this context (e.g. "user-1", "admin", "incognito")'),
      viewport_width: z.number().optional().describe('Viewport width in pixels'),
      viewport_height: z.number().optional().describe('Viewport height in pixels'),
    },
    async ({ browser_id, label, viewport_width, viewport_height }) => {
      try {
        const viewport =
          viewport_width && viewport_height ? { width: viewport_width, height: viewport_height } : undefined;
        const result = await browserManager.createContext(browser_id, label, viewport);
        return textResult(
          `Created context "${label}" (ID: ${result.contextId}) with page (ID: ${result.pageId}) in browser ${browser_id}`
        );
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_close_context',
    'Close a context and all its pages',
    {
      context_id: z.number().describe('Context ID to close'),
    },
    async ({ context_id }) => {
      try {
        await browserManager.closeContext(context_id);
        return textResult(`Context ${context_id} closed`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_list_contexts',
    'List all contexts across browsers (or for a specific browser)',
    {
      browser_id: z.number().optional().describe('Filter by browser ID'),
    },
    async ({ browser_id }) => {
      try {
        const contexts = browserManager.listContexts(browser_id);
        if (contexts.length === 0) {
          return textResult('No contexts. Launch a browser first.');
        }
        return jsonResult(contexts);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_new_page',
    'Open a new page in a context. Defaults to the active page\'s context if not specified.',
    {
      context_id: z.number().optional().describe('Context ID to create the page in (defaults to active context)'),
      url: z.string().optional().describe('URL to navigate to immediately'),
    },
    async ({ context_id, url }) => {
      try {
        const result = await browserManager.createPage(context_id);
        let msg = `Created page (ID: ${result.pageId})`;
        if (url) {
          const page = browserManager.getActivePage();
          await page.goto(url);
          msg += ` and navigated to ${url}`;
        }
        return textResult(msg);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_list_pages',
    'List all open pages across all browsers and contexts',
    {},
    async () => {
      try {
        const pages = await browserManager.listPagesWithTitles();
        if (pages.length === 0) {
          return textResult('No pages open. Launch a browser first.');
        }
        return jsonResult(pages);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_select_page',
    'Set the active page by ID for subsequent tool calls',
    {
      page_id: z.number().describe('Page ID to select as active'),
    },
    async ({ page_id }) => {
      try {
        browserManager.selectPage(page_id);
        return textResult(`Page ${page_id} is now the active page`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
