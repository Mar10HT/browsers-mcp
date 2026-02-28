import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { jsonResult, textResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';

export function registerStorageTools(server: McpServer): void {
  server.tool(
    'browser_get_cookies',
    'Get cookies for the active page',
    {
      urls: z.array(z.string()).optional().describe('URLs to get cookies for (defaults to current page URL)'),
    },
    async ({ urls }) => {
      try {
        const pageId = browserManager.getActivePageId();
        const context = browserManager.getPageContext(pageId);
        if (!context) throw new Error('No browser context found');

        const cookies = await context.cookies(urls);
        return jsonResult(cookies);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_set_cookie',
    'Set a cookie in the active page context',
    {
      name: z.string().describe('Cookie name'),
      value: z.string().describe('Cookie value'),
      url: z.string().optional().describe('Cookie URL'),
      domain: z.string().optional().describe('Cookie domain'),
      path: z.string().optional().describe('Cookie path'),
      secure: z.boolean().optional().describe('Secure flag'),
      httpOnly: z.boolean().optional().describe('HttpOnly flag'),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional().describe('SameSite attribute'),
      expires: z.number().optional().describe('Expiry as Unix timestamp'),
    },
    async ({ name, value, url, domain, path, secure, httpOnly, sameSite, expires }) => {
      try {
        const pageId = browserManager.getActivePageId();
        const context = browserManager.getPageContext(pageId);
        if (!context) throw new Error('No browser context found');

        const cookie: any = { name, value };
        if (url) cookie.url = url;
        if (domain) cookie.domain = domain;
        if (path) cookie.path = path;
        if (secure !== undefined) cookie.secure = secure;
        if (httpOnly !== undefined) cookie.httpOnly = httpOnly;
        if (sameSite) cookie.sameSite = sameSite;
        if (expires !== undefined) cookie.expires = expires;

        await context.addCookies([cookie]);
        return textResult(`Cookie "${name}" set`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_get_local_storage',
    'Get localStorage data from the active page',
    {
      key: z.string().optional().describe('Specific key to retrieve (returns all if omitted)'),
    },
    async ({ key }) => {
      try {
        const page = browserManager.getActivePage();
        const result = await page.evaluate((k) => {
          if (k) {
            return { [k]: localStorage.getItem(k) };
          }
          const data: Record<string, string | null> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const storedKey = localStorage.key(i);
            if (storedKey) {
              data[storedKey] = localStorage.getItem(storedKey);
            }
          }
          return data;
        }, key);

        return jsonResult(result);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_get_session_storage',
    'Get sessionStorage data from the active page',
    {
      key: z.string().optional().describe('Specific key to retrieve (returns all if omitted)'),
    },
    async ({ key }) => {
      try {
        const page = browserManager.getActivePage();
        const result = await page.evaluate((k) => {
          if (k) {
            return { [k]: sessionStorage.getItem(k) };
          }
          const data: Record<string, string | null> = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const storedKey = sessionStorage.key(i);
            if (storedKey) {
              data[storedKey] = sessionStorage.getItem(storedKey);
            }
          }
          return data;
        }, key);

        return jsonResult(result);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
