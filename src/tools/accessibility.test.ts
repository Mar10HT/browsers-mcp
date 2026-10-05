import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { browserManager } from '../services/browser-manager.js';
import {
  listInteractiveElements,
  resolveRole,
  type InteractiveElementsResult,
} from './accessibility.js';

let page: Page;

before(async () => {
  await browserManager.launchBrowser('chrome', true);
  page = browserManager.getActivePage();
});

after(async () => {
  await browserManager.closeAll();
});

describe('resolveRole', () => {
  it('maps implicit roles for the tags we enumerate', () => {
    assert.equal(resolveRole('button', null, null), 'button');
    assert.equal(resolveRole('a', null, null), 'link');
    assert.equal(resolveRole('select', null, null), 'combobox');
    assert.equal(resolveRole('textarea', null, null), 'textbox');
  });

  it('maps input types, defaulting to textbox', () => {
    assert.equal(resolveRole('input', null, null), 'textbox');
    assert.equal(resolveRole('input', null, 'email'), 'textbox');
    assert.equal(resolveRole('input', null, 'checkbox'), 'checkbox');
    assert.equal(resolveRole('input', null, 'submit'), 'button');
    assert.equal(resolveRole('input', null, 'range'), 'slider');
    assert.equal(resolveRole('input', null, 'hidden'), null);
  });

  it('prefers an explicit role attribute and takes its first token', () => {
    assert.equal(resolveRole('div', 'button', null), 'button');
    assert.equal(resolveRole('div', 'BUTTON menuitem', null), 'button');
    assert.equal(resolveRole('input', 'switch', 'checkbox'), 'switch');
  });

  it('returns null for everything else', () => {
    assert.equal(resolveRole('div', null, null), null);
    assert.equal(resolveRole('div', '  ', null), null);
  });
});

const FIXTURE = `<html lang="en"><head><title>fixture</title></head><body><main>
  <button id="save" onclick="document.title='clicked'">Save</button>
  <button aria-label="Close dialog">X</button>
  <span id="lbl">Labelled by span</span>
  <button aria-labelledby="lbl">ignored text</button>
  <a href="/home">Home</a>
  <a id="no-href">Not a link</a>
  <label for="email">Email address</label><input id="email" type="email">
  <input id="q" type="text" placeholder="Search term">
  <label><input id="tos" type="checkbox"> Accept terms</label>
  <input id="csrf" type="hidden" value="x">
  <label for="country">Country</label><select id="country"><option>AR</option></select>
  <textarea id="bio"></textarea>
  <div id="custom" role="button" tabindex="0">Custom action</div>
  <div id="focusable" tabindex="0">Focusable div</div>
  <div id="skipped" tabindex="-1">Not in tab order</div>
  <button id="hidden-btn" style="display:none">Hidden</button>
  <p>Not interactive</p>
</main></body></html>`;

describe('listInteractiveElements', () => {
  let result: InteractiveElementsResult;
  const byName = (name: string) => result.elements.find((e) => e.name === name);

  before(async () => {
    await page.setContent(FIXTURE);
    result = await listInteractiveElements(page, 100);
  });

  it('enumerates interactive elements and skips the rest', () => {
    assert.equal(result.total, 13);
    assert.equal(result.returned, 13);
    assert.equal(result.elements[0].name, 'Save');
    assert.equal(byName('Not a link'), undefined);
    assert.equal(byName('Not in tab order'), undefined);
    assert.equal(byName('Not interactive'), undefined);
  });

  it('resolves accessible names by priority', () => {
    assert.ok(byName('Close dialog'));
    assert.ok(byName('Labelled by span'));
    assert.ok(byName('Email address'));
    assert.ok(byName('Accept terms'));
    assert.ok(byName('Search term'));
    assert.ok(byName('Country'));
  });

  it('reports roles', () => {
    assert.equal(byName('Custom action')?.role, 'button');
    assert.equal(byName('Home')?.role, 'link');
    assert.equal(byName('Country')?.role, 'combobox');
    assert.equal(byName('Email address')?.role, 'textbox');
    assert.equal(result.elements[7].role, null);
  });

  it('flags hidden elements as not visible', () => {
    assert.equal(byName('Hidden')?.visible, false);
    assert.equal(byName('Save')?.visible, true);
    assert.ok((byName('Save')?.boundingBox.width ?? 0) > 0);
  });

  it('honours the limit', async () => {
    const limited = await listInteractiveElements(page, 3);
    assert.equal(limited.returned, 3);
    assert.equal(limited.elements.length, 3);
    assert.equal(limited.total, 13);
  });

  it('returns selectors that resolve back to exactly one element', async () => {
    for (const el of result.elements) {
      assert.equal(await page.locator(el.selector).count(), 1, el.selector);
    }
    assert.equal(await page.locator(result.elements[0].selector).getAttribute('id'), 'save');
    assert.equal(await page.locator(result.elements[12].selector).getAttribute('id'), 'hidden-btn');
  });

  it('selector works through the path browser_click takes', async () => {
    await page.click(byName('Save')!.selector);
    assert.equal(await page.title(), 'clicked');
  });
});
