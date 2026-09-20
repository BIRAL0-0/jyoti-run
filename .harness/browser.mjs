/**
 * browser.mjs — puppeteer-core helpers for the School Runner harness.
 *
 * Sandbox notes:
 *  - /tmp/chromium comes from @sparticuz/chromium (extracted on demand):
 *      node -e "import('@sparticuz/chromium').then(m=>m.default.executablePath())"
 *  - it needs the libnspr4/libnss3/libnssutil3 stubs in .harness/chromedeps
 *    (regenerate with .harness/build-deps.sh).
 *  - WebGL comes from SwiftShader via ANGLE, so game-time runs slow: never use
 *    fixed sleeps, always poll with waitForFunction.
 */
import puppeteer from 'puppeteer-core';
import path from 'node:path';

export const CHROME = process.env.CHROME_PATH || '/tmp/chromium';
export const CHROME_DEPS = path.join(import.meta.dirname, 'chromedeps');

export async function launchBrowser(extraArgs = []) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: CHROME_DEPS },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--window-size=1280,720',
      ...extraArgs,
    ],
  });
}

/** Open the game and collect every diagnostic channel. */
export async function openGame(browser, base, opts = {}) {
  const { query = '?desktop=1&char=sprite', readyTimeout = 120000, viewport = { width: 1280, height: 720 } } = opts;
  const page = await browser.newPage();
  await page.setViewport(viewport);

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const requests = [];

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(String(err?.stack || err)));
  page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) requests.push(`HTTP ${res.status()} ${res.url()}`); });

  await page.goto(base + '/' + query, { waitUntil: 'domcontentloaded', timeout: readyTimeout });
  await page.waitForFunction('window.__game && window.__game.ready === true', { timeout: readyTimeout });

  return { page, consoleErrors, pageErrors, failedRequests, requests, close: () => page.close() };
}

/** Poll a predicate inside the page until it returns truthy. */
export async function waitFor(page, fn, { timeout = 30000, polling = 60, label = '' } = {}, ...callArgs) {
  try {
    return await page.waitForFunction(fn, { timeout, polling }, ...callArgs);
  } catch (e) {
    throw new Error(`waitFor timeout${label ? ` (${label})` : ''}: ${e.message}`);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
