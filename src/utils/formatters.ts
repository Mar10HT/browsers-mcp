import { MAX_HTML_LENGTH, MAX_TEXT_LENGTH } from '../constants.js';

export function textResult(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
  };
}

export function imageResult(base64: string, mimeType = 'image/png') {
  return {
    content: [{ type: 'image' as const, data: base64, mimeType }],
  };
}

export function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2));
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + `\n... (truncated, ${text.length - maxLength} chars omitted)`;
}

export function truncateHtml(html: string): string {
  return truncate(html, MAX_HTML_LENGTH);
}

export function truncateText(text: string): string {
  return truncate(text, MAX_TEXT_LENGTH);
}
