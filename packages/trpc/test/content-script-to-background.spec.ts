import { test as base, expect } from '@playwright/test';
import path from 'path';
import { chromium, type BrowserContext } from 'playwright';
import http from 'http';

const EXTENSION_PATH = path.resolve(
  import.meta.dirname,
  '../test-dist/content-script-to-background',
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

test.describe('content-script-to-background', () => {
  let server: http.Server;
  let serverPort: number;

  test.beforeAll(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>123</body></html>');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test.afterEach(({ page }) => page.close());

  test('content', async ({ page, extensionId, context }) => {
    const logs: string[] = [];
    context.on('console', (msg) => logs.push(msg.text()));

    await page.goto(`http://127.0.0.1:${serverPort}`);
    // await page.waitForTimeout(10_000);
    const locator = page.locator('#result');
    // console.log('Console logs:', logs);
    await locator.waitFor({ state: 'visible' });
    const resultText = await locator.textContent();
    const list = JSON.parse(resultText!) as any[];

    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(item.success, JSON.stringify(item)).toEqual(true);
    }
  });
});
