/** shot.mjs — capture in-game screenshots with the integrated art. */
import fs from 'node:fs';
import { createServer } from '../server.mjs';
import { launchBrowser, openGame, waitFor } from '../browser.mjs';

const out = process.argv[2] || '/home/user/shots';
const srv = await createServer('/home/user/jyoti-run');
const browser = await launchBrowser();
const g = await openGame(browser, srv.base);
fs.mkdirSync(out, { recursive: true });
try {
  await g.page.screenshot({ path: `${out}/1-menu.png` });
  await g.page.evaluate(() => window.__game.startGame());
  await waitFor(g.page, () => window.__game.gameState.distance > 90, { timeout: 120000 });
  await g.page.screenshot({ path: `${out}/2-running.png` });

  // teacher chase
  await g.page.evaluate(() => window.__game.onPlayerHit());
  await waitFor(g.page, () => window.__game.teacher.opacity > 0.6, { timeout: 60000 });
  await g.page.screenshot({ path: `${out}/3-chase.png` });

  // mid-turn: shoot while the foreshortening is at its peak
  await g.page.evaluate(() => window.__game.player.switchLane(-1));
  await waitFor(g.page, () => Math.abs(window.__game.player.viewYaw) > 0.3, { timeout: 30000, polling: 16 });
  await g.page.screenshot({ path: `${out}/4-turning.png` });

  // stumble (front render takes over)
  await g.page.evaluate(() => window.__game.player.stumble());
  await waitFor(g.page, () => window.__game.player.material.map === window.__game.player.frontTexture, { timeout: 30000, polling: 16 });
  await g.page.screenshot({ path: `${out}/5-stumble-front.png` });

  console.log('shots ->', out);
  console.log('errors:', g.pageErrors.length, 'console:', g.consoleErrors.length);
} finally { await browser.close(); await srv.close(); }
