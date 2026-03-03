import type { Browser, BrowserContext, Page } from 'playwright';

export interface BrowserInstance {
  id: number;
  browser: Browser;
  contexts: Map<number, ContextInfo>;
  type: 'chrome' | 'edge' | 'firefox' | 'brave';
}

export interface ContextInfo {
  id: number;
  browserId: number;
  context: BrowserContext;
  label: string;
}

export interface PageInfo {
  id: number;
  browserId: number;
  contextId: number;
  page: Page;
}

export interface CapturedRequest {
  id: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData: string | null;
  resourceType: string;
  timestamp: number;
  response?: CapturedResponse;
}

export interface CapturedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timing: number;
}

export interface CapturedConsoleMessage {
  id: number;
  level: string;
  text: string;
  timestamp: number;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
}

export type TextContent = { type: 'text'; text: string };
export type ImageContent = { type: 'image'; data: string; mimeType: string };
export type ToolContent = TextContent | ImageContent;

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}
