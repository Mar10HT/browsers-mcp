import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { textResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';
import { DEFAULT_TIMEOUT } from '../constants.js';

export function registerNavigationTools(server: McpServer): void {
  server.tool(
    'browser_navigate',
    'Navigate the active page to a URL',
    {
      url: z.string().describe('URL to navigate to'),
      wait_until: z
        .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
        .default('load')
        .describe('When to consider navigation complete'),
      timeout: z.number().default(DEFAULT_TIMEOUT).describe('Timeout in milliseconds'),
    },
    async ({ url, wait_until, timeout }) => {
      try {
        const page = browserManager.getActivePage();
        await page.goto(url, { waitUntil: wait_until, timeout });
        const title = await page.title();
        return textResult(`Navigated to: ${page.url()}\nTitle: ${title}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_reload',
    'Reload the active page',
    {
      wait_until: z
        .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
        .default('load')
        .describe('When to consider reload complete'),
    },
    async ({ wait_until }) => {
      try {
        const page = browserManager.getActivePage();
        await page.reload({ waitUntil: wait_until });
        return textResult(`Reloaded: ${page.url()}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_go_back',
    'Go back in browser history',
    {},
    async () => {
      try {
        const page = browserManager.getActivePage();
        await page.goBack();
        return textResult(`Navigated back to: ${page.url()}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_go_forward',
    'Go forward in browser history',
    {},
    async () => {
      try {
        const page = browserManager.getActivePage();
        await page.goForward();
        return textResult(`Navigated forward to: ${page.url()}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
