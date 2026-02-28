import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { jsonResult, textResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';

export function registerSessionTools(server: McpServer): void {
  server.tool(
    'browser_launch',
    'Launch a browser instance (Chrome, Edge, or Firefox)',
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
          `Launched ${browser} browser (ID: ${result.browserId}) with page (ID: ${result.pageId})`
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
    'browser_list_pages',
    'List all open pages across all browsers',
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
