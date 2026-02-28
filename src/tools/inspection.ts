import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { textResult, imageResult, jsonResult, truncateHtml, truncateText } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';

export function registerInspectionTools(server: McpServer): void {
  server.tool(
    'browser_screenshot',
    'Take a screenshot of the active page or a specific element',
    {
      full_page: z.boolean().default(false).describe('Capture the full scrollable page'),
      selector: z.string().optional().describe('CSS selector to screenshot a specific element'),
      path: z.string().optional().describe('File path to save the screenshot'),
    },
    async ({ full_page, selector, path }) => {
      try {
        const page = browserManager.getActivePage();
        let buffer: Buffer;

        if (selector) {
          const element = await page.$(selector);
          if (!element) throw new Error(`Element not found: ${selector}`);
          buffer = await element.screenshot({ path });
        } else {
          buffer = await page.screenshot({ fullPage: full_page, path });
        }

        const base64 = buffer.toString('base64');
        if (path) {
          return textResult(`Screenshot saved to: ${path}`);
        }
        return imageResult(base64);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_get_html',
    'Get the HTML of an element or the full page',
    {
      selector: z.string().optional().describe('CSS selector (returns full page HTML if omitted)'),
    },
    async ({ selector }) => {
      try {
        const page = browserManager.getActivePage();
        let html: string;

        if (selector) {
          const element = await page.$(selector);
          if (!element) throw new Error(`Element not found: ${selector}`);
          html = await element.evaluate((el) => el.outerHTML);
        } else {
          html = await page.content();
        }

        return textResult(truncateHtml(html));
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_get_text',
    'Get the text content of an element or the full page',
    {
      selector: z.string().optional().describe('CSS selector (returns full page text if omitted)'),
    },
    async ({ selector }) => {
      try {
        const page = browserManager.getActivePage();
        let text: string;

        if (selector) {
          const element = await page.$(selector);
          if (!element) throw new Error(`Element not found: ${selector}`);
          text = await element.evaluate((el) => (el as HTMLElement).innerText);
        } else {
          text = await page.evaluate(() => document.body.innerText);
        }

        return textResult(truncateText(text));
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_query_selector',
    'Find elements matching a CSS selector and return info about them',
    {
      selector: z.string().describe('CSS selector to query'),
      limit: z.number().default(10).describe('Max number of elements to return'),
    },
    async ({ selector, limit }) => {
      try {
        const page = browserManager.getActivePage();
        const elements = await page.$$(selector);
        const results = [];

        for (let i = 0; i < Math.min(elements.length, limit); i++) {
          const el = elements[i];
          const info = await el.evaluate((node) => {
            const element = node as HTMLElement;
            const rect = element.getBoundingClientRect();
            const attributes: Record<string, string> = {};
            for (const attr of element.attributes) {
              attributes[attr.name] = attr.value;
            }
            return {
              tag: element.tagName.toLowerCase(),
              text: element.innerText?.slice(0, 200) ?? '',
              attributes,
              boundingBox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              visible: rect.width > 0 && rect.height > 0,
            };
          });
          results.push(info);
        }

        return jsonResult({
          total: elements.length,
          returned: results.length,
          elements: results,
        });
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_get_styles',
    'Get computed styles for an element',
    {
      selector: z.string().describe('CSS selector of the element'),
      properties: z
        .array(z.string())
        .optional()
        .describe('Specific CSS properties to retrieve (returns all if omitted)'),
    },
    async ({ selector, properties }) => {
      try {
        const page = browserManager.getActivePage();
        const element = await page.$(selector);
        if (!element) throw new Error(`Element not found: ${selector}`);

        const styles = await element.evaluate(
          (el, props) => {
            const computed = window.getComputedStyle(el);
            const result: Record<string, string> = {};

            if (props && props.length > 0) {
              for (const prop of props) {
                result[prop] = computed.getPropertyValue(prop);
              }
            } else {
              // Return commonly useful properties
              const common = [
                'display', 'position', 'width', 'height', 'margin', 'padding',
                'color', 'background-color', 'font-size', 'font-family', 'font-weight',
                'border', 'opacity', 'visibility', 'z-index', 'overflow',
                'flex-direction', 'justify-content', 'align-items',
              ];
              for (const prop of common) {
                result[prop] = computed.getPropertyValue(prop);
              }
            }
            return result;
          },
          properties
        );

        return jsonResult(styles);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
