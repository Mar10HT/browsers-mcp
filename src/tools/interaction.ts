import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { textResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';

export function registerInteractionTools(server: McpServer): void {
  server.tool(
    'browser_click',
    'Click an element by CSS selector',
    {
      selector: z.string().describe('CSS selector of the element to click'),
      button: z.enum(['left', 'right', 'middle']).default('left').describe('Mouse button'),
      click_count: z.number().default(1).describe('Number of clicks'),
      position_x: z.number().optional().describe('X offset within element'),
      position_y: z.number().optional().describe('Y offset within element'),
    },
    async ({ selector, button, click_count, position_x, position_y }) => {
      try {
        const page = browserManager.getActivePage();
        const position =
          position_x !== undefined && position_y !== undefined
            ? { x: position_x, y: position_y }
            : undefined;
        await page.click(selector, { button, clickCount: click_count, position });
        return textResult(`Clicked: ${selector}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_type',
    'Type text into an element or the currently focused element',
    {
      text: z.string().describe('Text to type'),
      selector: z.string().optional().describe('CSS selector (types into focused element if omitted)'),
      delay: z.number().default(0).describe('Delay between keystrokes in ms'),
    },
    async ({ text, selector, delay }) => {
      try {
        const page = browserManager.getActivePage();
        if (selector) {
          await page.type(selector, text, { delay });
        } else {
          await page.keyboard.type(text, { delay });
        }
        return textResult(`Typed text${selector ? ` into ${selector}` : ''}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_fill',
    'Fill an input or textarea (clears existing value first)',
    {
      selector: z.string().describe('CSS selector of the input'),
      value: z.string().describe('Value to fill'),
    },
    async ({ selector, value }) => {
      try {
        const page = browserManager.getActivePage();
        await page.fill(selector, value);
        return textResult(`Filled ${selector} with value`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_press_key',
    'Press a key or key combination (e.g. "Enter", "Control+A")',
    {
      key: z.string().describe('Key or key combo to press'),
    },
    async ({ key }) => {
      try {
        const page = browserManager.getActivePage();
        await page.keyboard.press(key);
        return textResult(`Pressed: ${key}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_hover',
    'Hover over an element by CSS selector',
    {
      selector: z.string().describe('CSS selector of the element to hover'),
    },
    async ({ selector }) => {
      try {
        const page = browserManager.getActivePage();
        await page.hover(selector);
        return textResult(`Hovering over: ${selector}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_select_option',
    'Select option(s) from a <select> element',
    {
      selector: z.string().describe('CSS selector of the <select> element'),
      value: z.string().optional().describe('Option value to select'),
      label: z.string().optional().describe('Option label to select'),
      index: z.number().optional().describe('Option index to select'),
    },
    async ({ selector, value, label, index }) => {
      try {
        const page = browserManager.getActivePage();
        let selected: string[];
        if (value !== undefined) {
          selected = await page.selectOption(selector, { value });
        } else if (label !== undefined) {
          selected = await page.selectOption(selector, { label });
        } else if (index !== undefined) {
          selected = await page.selectOption(selector, { index });
        } else {
          throw new Error('Provide one of: value, label, or index');
        }
        return textResult(`Selected: ${selected.join(', ')} in ${selector}`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
