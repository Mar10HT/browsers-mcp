import { chromium, firefox, devices, type Browser, type BrowserContext, type Page } from 'playwright';
import type { BrowserInstance, PageInfo, CapturedRequest, CapturedConsoleMessage } from '../types.js';
import { DEFAULT_VIEWPORT, MAX_CONSOLE_MESSAGES, MAX_NETWORK_REQUESTS } from '../constants.js';

class BrowserManager {
  private static instance: BrowserManager;

  private browsers = new Map<number, BrowserInstance>();
  private pages = new Map<number, PageInfo>();
  private networkRequests = new Map<number, CapturedRequest[]>();
  private consoleMessages = new Map<number, CapturedConsoleMessage[]>();

  private nextBrowserId = 1;
  private nextPageId = 1;
  private nextRequestId = 1;
  private nextMessageId = 1;
  private activePageId: number | null = null;

  private constructor() {}

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  async launchBrowser(
    type: 'chrome' | 'edge' | 'firefox' = 'chrome',
    headless = false,
    viewport?: { width: number; height: number }
  ): Promise<{ browserId: number; pageId: number }> {
    let browser: Browser;

    if (type === 'firefox') {
      browser = await firefox.launch({ headless });
    } else {
      const channel = type === 'edge' ? 'msedge' : 'chrome';
      browser = await chromium.launch({ headless, channel });
    }

    const context = await browser.newContext({
      viewport: viewport ?? DEFAULT_VIEWPORT,
    });

    const browserId = this.nextBrowserId++;
    this.browsers.set(browserId, { id: browserId, browser, context, type });

    const page = await context.newPage();
    const pageId = this.registerPage(browserId, page);
    this.activePageId = pageId;

    return { browserId, pageId };
  }

  async closeBrowser(browserId: number): Promise<void> {
    const instance = this.browsers.get(browserId);
    if (!instance) throw new Error(`Browser ${browserId} not found`);

    // Clean up pages belonging to this browser
    for (const [pageId, info] of this.pages) {
      if (info.browserId === browserId) {
        this.networkRequests.delete(pageId);
        this.consoleMessages.delete(pageId);
        this.pages.delete(pageId);
        if (this.activePageId === pageId) {
          this.activePageId = null;
        }
      }
    }

    await instance.browser.close();
    this.browsers.delete(browserId);

    // Set active page to first remaining page if any
    if (this.activePageId === null && this.pages.size > 0) {
      this.activePageId = this.pages.keys().next().value!;
    }
  }

  private registerPage(browserId: number, page: Page): number {
    const pageId = this.nextPageId++;
    this.pages.set(pageId, { id: pageId, browserId, page });
    this.networkRequests.set(pageId, []);
    this.consoleMessages.set(pageId, []);

    this.setupPageCapture(pageId, page);
    return pageId;
  }

  private setupPageCapture(pageId: number, page: Page): void {
    page.on('request', (request) => {
      const requests = this.networkRequests.get(pageId);
      if (!requests) return;

      if (requests.length >= MAX_NETWORK_REQUESTS) {
        requests.shift();
      }

      const captured: CapturedRequest = {
        id: this.nextRequestId++,
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        resourceType: request.resourceType(),
        timestamp: Date.now(),
      };
      requests.push(captured);
    });

    page.on('response', (response) => {
      const requests = this.networkRequests.get(pageId);
      if (!requests) return;

      const url = response.url();
      const captured = [...requests].reverse().find((r) => r.url === url && !r.response);
      if (captured) {
        captured.response = {
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          timing: Date.now() - captured.timestamp,
        };
      }
    });

    page.on('console', (msg) => {
      const messages = this.consoleMessages.get(pageId);
      if (!messages) return;

      if (messages.length >= MAX_CONSOLE_MESSAGES) {
        messages.shift();
      }

      const location = msg.location();
      messages.push({
        id: this.nextMessageId++,
        level: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
        location: location.url
          ? {
              url: location.url,
              lineNumber: location.lineNumber,
              columnNumber: location.columnNumber,
            }
          : undefined,
      });
    });

    // Track page close
    page.on('close', () => {
      this.pages.delete(pageId);
      this.networkRequests.delete(pageId);
      this.consoleMessages.delete(pageId);
      if (this.activePageId === pageId) {
        this.activePageId = this.pages.size > 0 ? this.pages.keys().next().value! : null;
      }
    });
  }

  getActivePage(): Page {
    if (this.activePageId === null) throw new Error('No active page. Launch a browser first.');
    const info = this.pages.get(this.activePageId);
    if (!info) throw new Error('Active page no longer exists.');
    return info.page;
  }

  getActivePageId(): number {
    if (this.activePageId === null) throw new Error('No active page.');
    return this.activePageId;
  }

  selectPage(pageId: number): void {
    if (!this.pages.has(pageId)) throw new Error(`Page ${pageId} not found`);
    this.activePageId = pageId;
  }

  listPages(): Array<{ id: number; browserId: number; url: string; title: string }> {
    const result: Array<{ id: number; browserId: number; url: string; title: string }> = [];
    for (const [id, info] of this.pages) {
      result.push({
        id,
        browserId: info.browserId,
        url: info.page.url(),
        title: '',
      });
    }
    return result;
  }

  async listPagesWithTitles(): Promise<
    Array<{ id: number; browserId: number; url: string; title: string; isActive: boolean }>
  > {
    const result = [];
    for (const [id, info] of this.pages) {
      result.push({
        id,
        browserId: info.browserId,
        url: info.page.url(),
        title: await info.page.title(),
        isActive: id === this.activePageId,
      });
    }
    return result;
  }

  getNetworkRequests(pageId?: number): CapturedRequest[] {
    const pid = pageId ?? this.activePageId;
    if (pid === null) throw new Error('No active page.');
    return this.networkRequests.get(pid) ?? [];
  }

  getConsoleMessages(pageId?: number): CapturedConsoleMessage[] {
    const pid = pageId ?? this.activePageId;
    if (pid === null) throw new Error('No active page.');
    return this.consoleMessages.get(pid) ?? [];
  }

  getPageContext(pageId: number): BrowserContext | undefined {
    const info = this.pages.get(pageId);
    if (!info) return undefined;
    const browser = this.browsers.get(info.browserId);
    return browser?.context;
  }

  async closeAll(): Promise<void> {
    for (const [, instance] of this.browsers) {
      await instance.browser.close().catch(() => {});
    }
    this.browsers.clear();
    this.pages.clear();
    this.networkRequests.clear();
    this.consoleMessages.clear();
    this.activePageId = null;
  }
}

export const browserManager = BrowserManager.getInstance();
