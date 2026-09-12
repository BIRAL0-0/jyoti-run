/** shot.mjs — capture in-game screenshots (menu / play / teacher chase / turn). */
import { createServer } from '../server.mjs';
import { launchBrowser, openGame, waitFor } from '../browser.mjs';

const srv = await createServer('/home/user/jyoti-run');
const browser = await launchBrowser();
const g = await openGame(browser, srv.base);
const out = '/home/user/.tools/shots';
const fs = await import('node:fs');
fs.mkdirSync(out, { recursive: true });
try {
  await g.page.screenshot({ path: `${out}/1-menu.png` });
  await g.page.evaluate(() => window.__game.startGame());
  await waitFor(g.page, () => window.__game.gameState.distance > 90, { timeout: 120000 });
  await g.page.screenshot({ path: `${out}/2-running.png` });

  // teacher chase (first mistake → she appears behind the runner)
  await g.page.evaluate(() => window.__game.onPlayerHit());
  await waitFor(g.page, () => window.__game.teacher.opacity > 0.5, { timeout: 60000 });
  await g.page.screenshot({ path: `${out}/3-teacher-chase.png` });

  // mid-turn: force a lane change and shoot while the yaw is at its peak
  await g.page.evaluate(() => { window.__game.player.switchLane(-1); });
  await waitFor(g.page, () => Math.abs(window.__game.player.viewYaw) > 0.25, { timeout: 30000, polling: 16 });
  await g.page.screenshot({ path: `${out}/4-turning.png` });
  console.log('shots written'); console.log('errors:', g.pageErrors, g.consoleErrors.slice(0, 2));
} finally { await browser.close(); await srv.close(); }
