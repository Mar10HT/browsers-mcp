import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Page } from 'playwright';
import { browserManager } from '../services/browser-manager.js';
import { jsonResult } from '../utils/formatters.js';
import { handleToolError } from '../utils/errors.js';

// The returned selector is `${INTERACTIVE_SELECTOR} >> nth=<i>`, where <i> is the
// element's index in this very query, so it re-resolves to the same element.
// ponytail: index-based selector, valid for this snapshot of the DOM. Re-list
// after mutating the page. Upgrade path: role= selectors, once accessible names
// are computed by Playwright's own AccName instead of our heuristic.
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [role], [tabindex]:not([tabindex^="-"])';

// ponytail: tiny implicit-role table, not the HTML-AOM algorithm. Covers the tags
// we enumerate; anything else reports role null.
const TAG_ROLES: Record<string, string> = {
  button: 'button',
  a: 'link',
  select: 'combobox', // ponytail: <select multiple> is really a listbox
  textarea: 'textbox',
};

const INPUT_TYPE_ROLES: Record<string, string> = {
  button: 'button',
  submit: 'button',
  reset: 'button',
  image: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  number: 'spinbutton',
  search: 'searchbox',
};

export interface InteractiveElement {
  tag: string;
  role: string | null;
  name: string;
  selector: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  visible: boolean;
}

export interface InteractiveElementsResult {
  total: number;
  returned: number;
  elements: InteractiveElement[];
}

interface ElementFacts {
  tag: string;
  roleAttr: string | null;
  inputType: string | null;
  name: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  visible: boolean;
}

export function resolveRole(
  tag: string,
  roleAttr: string | null,
  inputType: string | null
): string | null {
  if (roleAttr?.trim()) return roleAttr.trim().split(/\s+/)[0].toLowerCase();
  if (tag === 'input') {
    if (inputType === 'hidden') return null;
    return INPUT_TYPE_ROLES[inputType ?? 'text'] ?? 'textbox';
  }
  return TAG_ROLES[tag] ?? null;
}

// Runs inside the browser via elementHandle.evaluate — only references its own
// argument and DOM globals, nothing from the module scope survives serialization.
function collectFacts(node: Element): ElementFacts {
  const el = node as HTMLElement;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  // ponytail: best-effort accessible name, not the W3C AccName algorithm.
  // Priority: aria-label > aria-labelledby > <label> > text > placeholder > alt > title.
  const labelledBy = (el.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

  const name =
    [
      el.getAttribute('aria-label') ?? '',
      labelledBy,
      (el as HTMLInputElement).labels?.[0]?.textContent ?? '',
      el.innerText || el.textContent || '',
      el.getAttribute('placeholder') ?? '',
      el.getAttribute('alt') ?? '',
      el.getAttribute('title') ?? '',
    ]
      .map((candidate) => candidate.replace(/\s+/g, ' ').trim())
      .find((candidate) => candidate.length > 0) ?? '';

  return {
    tag: el.tagName.toLowerCase(),
    roleAttr: el.getAttribute('role'),
    inputType: el.getAttribute('type'),
    name: name.slice(0, 200),
    boundingBox: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden',
  };
}

export async function listInteractiveElements(
  page: Page,
  limit: number
): Promise<InteractiveElementsResult> {
  const handles = await page.$$(INTERACTIVE_SELECTOR);
  const elements: InteractiveElement[] = [];

  for (let i = 0; i < Math.min(handles.length, limit); i++) {
    const facts = await handles[i].evaluate(collectFacts);
    elements.push({
      tag: facts.tag,
      role: resolveRole(facts.tag, facts.roleAttr, facts.inputType),
      name: facts.name,
      selector: `${INTERACTIVE_SELECTOR} >> nth=${i}`,
      boundingBox: facts.boundingBox,
      visible: facts.visible,
    });
  }

  return { total: handles.length, returned: elements.length, elements };
}

export function registerAccessibilityTools(server: McpServer): void {
  server.tool(
    'browser_list_interactive',
    'List interactive elements (buttons, links, inputs, ARIA roles, focusable elements) with role, accessible name, bounding box and a selector reusable by the other browser tools',
    {
      limit: z.number().default(50).describe('Max number of elements to return'),
    },
    async ({ limit }) => {
      try {
        const page = browserManager.getActivePage();
        return jsonResult(await listInteractiveElements(page, limit));
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
