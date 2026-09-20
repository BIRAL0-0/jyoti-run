/**
 * soak.mjs — live-play soak (draw calls, heap, geometry drift, errors).
 *
 *   node soak.mjs [minutes] [--mobile]
 *
 * Budgets come from research/RESEARCH_REPORT.md: < 100 draw calls desktop,
 * < 50 with the mobile overrides active.
 */
import { createServer } from '../server.mjs';
import { launchBrowser, openGame } from '../browser.mjs';
import { section } from './lib.mjs';

const MINUTES = Number(process.argv[2] || 5);
const MOBILE = process.argv.includes('--mobile');
const DRAWCALL_BUDGET = MOBILE ? 50 : 100;
const ROOT = '/home/user/jyoti-run';

section(`Soak — ${MINUTES} min of live play (${MOBILE ? 'mobile tuning' : 'desktop'})`);
const srv = await createServer(ROOT);
const browser = await launchBrowser();
let g;
const samples = [];
try {
  g = await openGame(browser, srv.base, { query: MOBILE ? '?mobile=1' : '?desktop=1' });
  await g.page.evaluate(() => window.__game.startGame());

  const t0 = Date.now();
  let deaths = 0;
  while ((Date.now() - t0) < MINUTES * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 10000));
    const s = await g.page.evaluate(() => {
      const G = window.__game;
      return {
        state: G.gameState.state, distance: G.gameState.distance, speed: G.gameState.currentSpeed,
        calls: G.renderer.info.render.calls, triangles: G.renderer.info.render.triangles,
        geometries: G.renderer.info.memory.geometries, textures: G.renderer.info.memory.textures,
        heap: performance.memory ? performance.memory.usedJSHeapSize : null,
        teacher: G.teacher.state, obstacles: G.obstacles.count,
      };
    });
    samples.push(s);
    const heapMb = s.heap ? (s.heap / 1048576).toFixed(1) : 'n/a';
    console.log(`  t+${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s  `
      + `${s.state.padEnd(9)} dist=${s.distance.toFixed(0).padStart(5)}m speed=${s.speed.toFixed(1)} `
      + `calls=${String(s.calls).padStart(2)} tris=${String(s.triangles).padStart(5)} `
      + `geo=${s.geometries} tex=${s.textures} heap=${heapMb}MB teacher=${s.teacher}`);

    if (s.state === 'GAME_OVER') {
      deaths++;
      if (deaths > 40) throw new Error('too many game overs — something is wrong');
      await new Promise((r) => setTimeout(r, 1200));   // let the panel slide in
      await g.page.evaluate(() => window.__game.startGame());
    }
  }

  const played = samples.filter((s) => s.state === 'PLAYING');
  const maxCalls = Math.max(...samples.map((s) => s.calls));
  const heaps = samples.map((s) => s.heap).filter(Boolean);
  const heapGrowth = heaps.length > 1 ? (heaps[heaps.length - 1] - heaps[0]) / 1048576 : 0;
  const maxTriangles = Math.max(...samples.map((s) => s.triangles));
  // geometry pools warm up lazily as each obstacle variant first renders; a leak
  // would keep growing through the tail instead
  const tailStart = Math.max(0, Math.floor(samples.length * 0.66) - 1);
  const tail = samples.slice(tailStart).map((s) => s.geometries);
  const geometryGrowth = tail.length ? Math.max(...tail) - Math.min(...tail) : 0;
  const geometrySeries = samples.map((s) => s.geometries);

  console.log('\n--- soak summary ---');
  console.log(`  samples: ${samples.length} (playing ${played.length}), game overs ${deaths}`);
  console.log(`  max draw calls: ${maxCalls} (budget ${DRAWCALL_BUDGET})`);
  console.log(`  max triangles: ${maxTriangles}`);
  console.log(`  geometry drift (tail window): ${geometryGrowth}  [${geometrySeries[0]} → ${geometrySeries[geometrySeries.length - 1]}]`
    + (MINUTES >= 3 ? '' : ' — informational (short run: warm-up)'));
  console.log(`  heap growth: ${heapGrowth.toFixed(1)} MB`);
  console.log(`  JS errors: ${g.pageErrors.length}, console errors: ${g.consoleErrors.length}`);

  const geometryOk = MINUTES >= 3 ? geometryGrowth <= 2 : true;
  const ok = maxCalls <= DRAWCALL_BUDGET && g.pageErrors.length === 0 && heapGrowth < 8 && geometryOk;
  console.log(`\n${ok ? '✅ soak PASS' : '❌ soak FAIL'}`);
  process.exitCode = ok ? 0 : 1;
} finally {
  if (g) await g.close();
  await srv.close();
  await browser.close();
}
