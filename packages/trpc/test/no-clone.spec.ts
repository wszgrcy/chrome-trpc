import { test as base, expect } from '@playwright/test';
import path from 'path';
import { chromium, type BrowserContext } from 'playwright';

const EXTENSION_PATH = path.resolve(
  import.meta.dirname,
  '../test-dist/no-clone',
);
const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--auto-open-devtools-for-tabs',
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId!);
  },
});

test.describe('default', () => {
  test('test-all', async ({ page, extensionId, context }) => {
    const logs: string[] = [];
    context.on('console', (msg) => logs.push(msg.text()));

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('networkidle');
    await page.click('#start');
    // await page.waitForTimeout(999999);
    const locator = page.locator('#result');
    await locator.waitFor({ state: 'visible' });
    console.log('Console logs:', logs);
    const resultText = await locator.textContent();
    const list = JSON.parse(resultText!) as any[];
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(item.success, JSON.stringify(item)).toEqual(true);
    }
  });
});
