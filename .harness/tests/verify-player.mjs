/** verify-player.mjs — tight crops of the PLAYER across view states. */
import fs from 'node:fs';
import { createServer } from '../server.mjs';
import { launchBrowser, openGame, waitFor } from '../browser.mjs';

const out = '/home/user/shots';
const srv = await createServer('/home/user/jyoti-run');
const browser = await launchBrowser();
const g = await openGame(browser, srv.base);
fs.mkdirSync(out, { recursive: true });

const cropPlayer = async (name) => {
  const clip = await g.page.evaluate(() => {
    const G = window.__game;
    const v = G.player.sprite.position.clone();
    v.y += G.player.spriteH * 0.55;
    v.project(G.camera);
    const cx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const cy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    return { x: Math.max(0, cx - 90), y: Math.max(0, cy - 130), width: 180, height: 240 };
  });
  await g.page.screenshot({ path: `${out}/${name}.png`, clip });
};

try {
  await g.page.evaluate(() => window.__game.startGame());
  await waitFor(g.page, () => window.__game.gameState.distance > 70, { timeout: 120000 });
  await cropPlayer('p1-centre-back');

  // lane change left: catch it at the steepest foreshortening
  await g.page.evaluate(() => window.__game.player.switchLane(-1));
  await waitFor(g.page, () => Math.abs(window.__game.player.viewYaw) > 0.35, { timeout: 60000, polling: 16 });
  await cropPlayer('p2-mid-turn-left');
  await waitFor(g.page, () => Math.abs(window.__game.player.viewYaw) > 0.39, { timeout: 60000, polling: 16 });

  // stumble: front render takes over
  await g.page.evaluate(() => window.__game.player.stumble());
  await waitFor(g.page, () => window.__game.player.material.map === window.__game.player.frontTexture, { timeout: 30000, polling: 16 });
  await cropPlayer('p3-stumble-front');

  console.log('crops ->', out);
} finally { await browser.close(); await srv.close(); }
