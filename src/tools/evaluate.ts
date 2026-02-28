import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { textResult, jsonResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';

export function registerEvaluateTools(server: McpServer): void {
  server.tool(
    'browser_evaluate',
    'Execute JavaScript in the active page context and return the result',
    {
      expression: z.string().describe('JavaScript expression or function to evaluate'),
    },
    async ({ expression }) => {
      try {
        const page = browserManager.getActivePage();
        const result = await page.evaluate(expression);

        if (result === undefined) {
          return textResult('undefined');
        }
        if (result === null) {
          return textResult('null');
        }
        if (typeof result === 'string') {
          return textResult(result);
        }
        return jsonResult(result);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
