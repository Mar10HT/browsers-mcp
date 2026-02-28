import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { jsonResult, textResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';
import { DEFAULT_PAGE_SIZE, MAX_RESPONSE_BODY_LENGTH } from '../constants.js';

export function registerNetworkTools(server: McpServer): void {
  server.tool(
    'browser_network_get_requests',
    'Get captured network requests for the active page',
    {
      url_pattern: z.string().optional().describe('Filter by URL substring'),
      method: z.string().optional().describe('Filter by HTTP method'),
      resource_type: z.string().optional().describe('Filter by resource type (document, xhr, fetch, etc.)'),
      status_min: z.number().optional().describe('Minimum status code'),
      status_max: z.number().optional().describe('Maximum status code'),
      page: z.number().default(1).describe('Page number (1-based)'),
      page_size: z.number().default(DEFAULT_PAGE_SIZE).describe('Results per page'),
    },
    async ({ url_pattern, method, resource_type, status_min, status_max, page, page_size }) => {
      try {
        let requests = browserManager.getNetworkRequests();

        if (url_pattern) {
          requests = requests.filter((r) => r.url.includes(url_pattern));
        }
        if (method) {
          requests = requests.filter((r) => r.method.toUpperCase() === method.toUpperCase());
        }
        if (resource_type) {
          requests = requests.filter((r) => r.resourceType === resource_type);
        }
        if (status_min !== undefined) {
          requests = requests.filter((r) => r.response && r.response.status >= status_min);
        }
        if (status_max !== undefined) {
          requests = requests.filter((r) => r.response && r.response.status <= status_max);
        }

        const total = requests.length;
        const start = (page - 1) * page_size;
        const paged = requests.slice(start, start + page_size);

        const summary = paged.map((r) => ({
          id: r.id,
          method: r.method,
          url: r.url,
          resourceType: r.resourceType,
          status: r.response?.status ?? null,
          timing: r.response?.timing ?? null,
        }));

        return jsonResult({
          total,
          page,
          page_size,
          pages: Math.ceil(total / page_size),
          requests: summary,
        });
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_network_get_request_detail',
    'Get full details of a specific network request by ID',
    {
      request_id: z.number().describe('Request ID from browser_network_get_requests'),
    },
    async ({ request_id }) => {
      try {
        const requests = browserManager.getNetworkRequests();
        const request = requests.find((r) => r.id === request_id);
        if (!request) throw new Error(`Request ${request_id} not found`);

        return jsonResult({
          id: request.id,
          url: request.url,
          method: request.method,
          resourceType: request.resourceType,
          requestHeaders: request.headers,
          postData: request.postData,
          response: request.response
            ? {
                status: request.response.status,
                statusText: request.response.statusText,
                headers: request.response.headers,
                timing: request.response.timing,
              }
            : null,
        });
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
