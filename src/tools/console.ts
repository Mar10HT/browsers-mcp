import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { jsonResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';
import { DEFAULT_PAGE_SIZE } from '../constants.js';

export function registerConsoleTools(server: McpServer): void {
  server.tool(
    'browser_console_get_messages',
    'Get captured console messages for the active page',
    {
      level: z
        .enum(['log', 'warn', 'error', 'info', 'debug'])
        .optional()
        .describe('Filter by message level'),
      page: z.number().default(1).describe('Page number (1-based)'),
      page_size: z.number().default(DEFAULT_PAGE_SIZE).describe('Results per page'),
    },
    async ({ level, page, page_size }) => {
      try {
        let messages = browserManager.getConsoleMessages();

        if (level) {
          messages = messages.filter((m) => m.level === level);
        }

        const total = messages.length;
        const start = (page - 1) * page_size;
        const paged = messages.slice(start, start + page_size);

        return jsonResult({
          total,
          page,
          page_size,
          pages: Math.ceil(total / page_size),
          messages: paged,
        });
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
