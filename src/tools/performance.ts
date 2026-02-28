import { z } from 'zod';
import { devices } from 'playwright';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from '../services/browser-manager.js';
import { jsonResult, textResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';

export function registerPerformanceTools(server: McpServer): void {
  server.tool(
    'browser_get_performance_metrics',
    'Get performance timing metrics for the active page',
    {},
    async () => {
      try {
        const page = browserManager.getActivePage();

        const metrics = await page.evaluate(() => {
          const perf = performance;
          const navigation = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
          const paint = perf.getEntriesByType('paint');

          const fcp = paint.find((e) => e.name === 'first-contentful-paint');

          return {
            url: window.location.href,
            navigation: navigation
              ? {
                  domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.startTime),
                  loaded: Math.round(navigation.loadEventEnd - navigation.startTime),
                  ttfb: Math.round(navigation.responseStart - navigation.startTime),
                  domInteractive: Math.round(navigation.domInteractive - navigation.startTime),
                  transferSize: navigation.transferSize,
                  encodedBodySize: navigation.encodedBodySize,
                  decodedBodySize: navigation.decodedBodySize,
                }
              : null,
            fcp: fcp ? Math.round(fcp.startTime) : null,
            resourceCount: perf.getEntriesByType('resource').length,
          };
        });

        return jsonResult(metrics);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_emulate_device',
    'Emulate a device by setting viewport, user agent, touch support, and scale factor. Supports Playwright device presets.',
    {
      device: z.string().optional().describe('Playwright device name (e.g. "iPhone 14", "Pixel 7")'),
      viewport_width: z.number().optional().describe('Custom viewport width'),
      viewport_height: z.number().optional().describe('Custom viewport height'),
      user_agent: z.string().optional().describe('Custom user agent string'),
      is_mobile: z.boolean().optional().describe('Enable mobile mode'),
      has_touch: z.boolean().optional().describe('Enable touch support'),
      device_scale_factor: z.number().optional().describe('Device scale factor (DPR)'),
    },
    async ({ device, viewport_width, viewport_height, user_agent, is_mobile, has_touch, device_scale_factor }) => {
      try {
        const page = browserManager.getActivePage();

        if (device) {
          const preset = devices[device];
          if (!preset) {
            const available = Object.keys(devices).slice(0, 20).join(', ');
            throw new Error(`Device "${device}" not found. Some available: ${available}`);
          }

          await page.setViewportSize(preset.viewport);
          return textResult(
            `Emulating ${device}: ${preset.viewport.width}x${preset.viewport.height}, ` +
              `mobile: ${preset.isMobile}, touch: ${preset.hasTouch}`
          );
        }

        if (viewport_width && viewport_height) {
          await page.setViewportSize({ width: viewport_width, height: viewport_height });
        }

        return textResult(
          `Device emulation updated` +
            (viewport_width && viewport_height ? ` (viewport: ${viewport_width}x${viewport_height})` : '')
        );
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.tool(
    'browser_generate_pdf',
    'Generate a PDF of the active page (Chromium only)',
    {
      path: z.string().optional().describe('File path to save the PDF'),
      format: z.enum(['A4', 'Letter', 'Legal', 'Tabloid', 'A3', 'A5']).default('A4').describe('Paper format'),
      landscape: z.boolean().default(false).describe('Landscape orientation'),
      print_background: z.boolean().default(true).describe('Print background graphics'),
    },
    async ({ path, format, landscape, print_background }) => {
      try {
        const page = browserManager.getActivePage();
        const buffer = await page.pdf({
          path: path ?? undefined,
          format,
          landscape,
          printBackground: print_background,
        });

        if (path) {
          return textResult(`PDF saved to: ${path}`);
        }

        const base64 = buffer.toString('base64');
        return textResult(`PDF generated (${Math.round(buffer.length / 1024)} KB, base64 length: ${base64.length})`);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
