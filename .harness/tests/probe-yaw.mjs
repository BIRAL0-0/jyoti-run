import { createServer } from '../server.mjs';
import { launchBrowser, openGame, waitFor } from '../browser.mjs';
const srv = await createServer('/home/user/jyoti-run');
const browser = await launchBrowser();
const g = await openGame(browser, srv.base);
try {
  await g.page.evaluate(() => window.__game.startGame());
  await waitFor(g.page, () => window.__game.gameState.distance > 60, { timeout: 120000 });
  await g.page.evaluate(() => window.__game.player.switchLane(-1));
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 300));
    const s = await g.page.evaluate(() => {
      const P = window.__game.player;
      return { laneX: +P.laneX.toFixed(2), target: P.targetLane, yaw: +P.viewYaw.toFixed(3),
        scaleX: +(P.sprite.scale.x / P.spriteW).toFixed(3), roll: +P.material.rotation.toFixed(3),
        front: P.material.map === P.frontTexture, paused: window.__game.gameState.state };
    });
    console.log(JSON.stringify(s));
  }
} finally { await browser.close(); await srv.close(); }
