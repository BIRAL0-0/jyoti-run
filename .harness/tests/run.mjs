/**
 * run.mjs — School Runner contract suites (offline harness).
 *
 *   node run.mjs [suite ...]   suites: boot empty views aspect gameplay
 *
 * Drives the real game in a real browser (SwiftShader WebGL) and checks the
 * non-negotiable contract: assets, fallbacks, aspect handling, pseudo-3D views,
 * hitboxes, difficulty bands, teacher FSM, pause/input/storage, debug surface.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from '../server.mjs';
import { launchBrowser, openGame, waitFor } from '../browser.mjs';
import { Report, section, pixelStats, jaccard } from './lib.mjs';
import { characterPng, gravelPng } from './fixtures.mjs';

const ROOT = '/home/user/jyoti-run';
const want = process.argv.slice(2);
const wants = (n) => want.length === 0 || want.includes(n);

const circleRegion = async (page) => {
  const pt = await page.evaluate(() => {
    const G = window.__game;
    const v = G.player.sprite.position.clone();
    v.y += G.player.spriteH * 0.5;
    v.project(G.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  });
  return {
    x: Math.max(0, Math.round(pt.x - 60)), y: Math.max(0, Math.round(pt.y - 90)),
    width: 120, height: 190,
  };
};

/** Screenshot the player region *during play* (the menu covers it otherwise). */
async function playerShot(page) {
  await page.evaluate(() => window.__game.startGame());
  await waitFor(page, () => window.__game.gameState.distance > 6, { timeout: 60000, label: 'menu→play' });
  const region = await circleRegion(page);
  const buf = await page.screenshot({ clip: region });
  return pixelStats(buf, { x: 0, y: 0, w: region.width, h: region.height });
}

// ---------------------------------------------------------------------------
// 1. boot with the committed art + audio
// ---------------------------------------------------------------------------
async function suiteBoot(browser) {
  section('Suite 1 — boot with committed art + audio');
  const rep = new Report('boot');
  const srv = await createServer(ROOT);
  let g;
  try {
    g = await openGame(browser, srv.base);
    const info = await g.page.evaluate(() => {
      const G = window.__game;
      return {
        howls: G.audio.howls.size,
        howlKeys: [...G.audio.howls.keys()].sort(),
        howler: !!window.Howl,
        student: {
          userArt: G.player.usesUserArt, front: !!G.player.frontTexture,
          scale: [G.player.sprite.scale.x, G.player.sprite.scale.y],
          aspect: G.player.spriteAspect,
          img: [G.player.frames.runA.image.width, G.player.frames.runA.image.height],
        },
        teacher: {
          userArt: G.teacher.usesUserArt, front: !!G.teacher.frontTexture,
          scale: [G.teacher.sprite.scale.x, G.teacher.sprite.scale.y],
          aspect: G.teacher.spriteAspect,
          img: [G.teacher.frames.runA.image.width, G.teacher.frames.runA.image.height],
        },
        ground: G.ground.usesPlaceholderArt,
        drawCalls: G.renderer.info.render.calls,
        triangles: G.renderer.info.render.triangles,
        state: G.gameState.state,
        debugSurface: {
          config: !!G.config, gameState: !!G.gameState, player: !!G.player, teacher: !!G.teacher,
          obstacles: !!G.obstacles, collectibles: !!G.collectibles, rendererInfo: !!G.renderer.info,
          onPlayerHit: typeof G.onPlayerHit, pauseGame: typeof G.pauseGame, resumeGame: typeof G.resumeGame,
        },
        debugFlags: Object.keys(G.config.DEBUG).sort(),
        storage: G.config.STORAGE,
        configKeys: {
          fitAspect: G.config.PLAYER.FIT_ASPECT && G.config.TEACHER.FIT_ASPECT,
          frontUrls: [G.config.PLAYER.FRONT_URL, G.config.TEACHER.FRONT_URL],
          speed: [G.config.GROUND.INITIAL_SPEED, G.config.GROUND.MAX_SPEED, G.config.GROUND.SPEED_INCREMENT],
          spawn: [G.config.OBSTACLES.INITIAL_SPAWN_CHANCE, G.config.OBSTACLES.MAX_SPAWN_CHANCE],
        },
      };
    });

    rep.check('boots to START with zero JS errors', g.pageErrors.length === 0, g.pageErrors.join(' | '));
    // ground-gravel.png is an optional drop-in with no committed file, so its
    // probe 404s by design (README documents this). Everything else must be clean.
    const asset404 = g.requests.filter((r) => /assets\//.test(r));
    const onlyGroundProbe = asset404.length === 0
      || (asset404.length === 1 && /ground-gravel\.png$/.test(asset404[0]));
    const consoleNoise = g.consoleErrors.filter((e) => !/404/.test(e));
    rep.check('console clean apart from the documented ground probe',
      consoleNoise.length === 0 && g.consoleErrors.length - consoleNoise.length <= 1,
      g.consoleErrors.length ? `${g.consoleErrors.length} expected 404 line(s), 0 others` : 'zero errors');
    rep.check('every asset request resolves except the optional ground probe',
      onlyGroundProbe, asset404.join(' | ') || 'none');
    rep.check('Howler active with all 6 mp3s', info.howler && info.howls === 6, info.howlKeys.join(','));
    rep.check('student art is the supplied render, 3:5',
      info.student.userArt && info.student.front
      && Math.abs(info.student.scale[0] - 1.5) < 0.01 && Math.abs(info.student.scale[1] - 2.5) < 0.01,
      `plane ${info.student.scale.join('×')}, image ${info.student.img.join('×')}, aspect ${info.student.aspect.toFixed(3)}`);
    rep.check('teacher art is the supplied render, 2:3',
      info.teacher.userArt && info.teacher.front
      && Math.abs(info.teacher.scale[0] - 2) < 0.01 && Math.abs(info.teacher.scale[1] - 3) < 0.01,
      `plane ${info.teacher.scale.join('×')}, image ${info.teacher.img.join('×')}, aspect ${info.teacher.aspect.toFixed(3)}`);
    rep.check('ground-gravel.png still on the procedural fallback (no file yet)', info.ground === true);
    rep.check('draw calls within budget (<=51 at start)', info.drawCalls <= 51, `${info.drawCalls}`);
    rep.check('debug surface complete',
      Object.values(info.debugSurface).every((v) => v === true || v === 'function'));
    rep.check('CONFIG.DEBUG flags intact',
      ['SHOW_FPS', 'GOD_MODE', 'SKIP_START_SCREEN'].every((k) => info.debugFlags.includes(k)));
    rep.check('STORAGE keys via constants',
      info.storage.PREFIX === 'schoolrunner' && info.storage.BEST_SCORE_KEY === 'best.score');
    rep.check('tuning contract values unchanged',
      info.configKeys.speed.join() === '15,45,0.5' && info.configKeys.spawn.join() === '0.25,0.65');

    const repoHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    rep.check('shipped import map still points at jsDelivr (three 0.160.0)',
      repoHtml.includes('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js')
      && repoHtml.includes('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/'));
    const confSrc = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8');
    rep.check('Howler CDN URL still pinned in config',
      confSrc.includes("'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js'"));

    const audio = await g.page.evaluate(async () => {
      const G = window.__game;
      const synthNames = [];
      const orig = G.audio._synth.bind(G.audio);
      G.audio._synth = (name, ...rest) => { synthNames.push(name); return orig(name, ...rest); };
      G.startGame();
      await new Promise((r) => setTimeout(r, 150));
      synthNames.length = 0;
      G.audio.play('jump'); G.audio.play('hit'); G.audio.play('collect');
      G.audio.play('teacherAlert'); G.audio.play('gameOver');
      await new Promise((r) => setTimeout(r, 250));
      return {
        synthForRealFiles: synthNames.filter((n) => G.audio.howls.has(n)).length,
        musicHowl: G.audio.howls.get('bgMusic') ? G.audio.howls.get('bgMusic').playing() : null,
        synthSchedulerOff: G.audio._musicTimer === null,
        states: Object.fromEntries([...G.audio.howls].map(([k, h]) => [k, h.state()])),
        durations: Object.fromEntries([...G.audio.howls].map(([k, h]) => [k, +h.duration().toFixed(2)])),
      };
    });
    rep.check('no synth double-play for any sound with an mp3',
      audio.synthForRealFiles === 0, `synth voices: ${audio.synthForRealFiles}`);
    rep.check('music runs through Howler, synth scheduler off',
      audio.musicHowl === true && audio.synthSchedulerOff);
    rep.check('all 6 mp3s decode (state=loaded, duration>0)',
      Object.values(audio.states).every((s) => s === 'loaded')
      && Object.values(audio.durations).every((d) => d > 0),
      JSON.stringify(audio.durations));
  } finally {
    await g?.close();
    await srv.close();
  }
  return rep;
}

// ---------------------------------------------------------------------------
// 2. fresh-clone boot: empty assets/
// ---------------------------------------------------------------------------
async function suiteEmpty(browser) {
  section('Suite 2 — empty assets/ (silent fallback contract)');
  const rep = new Report('empty');
  const srv = await createServer(ROOT, { hideAssets: true });
  let g;
  try {
    g = await openGame(browser, srv.base);
    const info = await g.page.evaluate(() => {
      const G = window.__game;
      return {
        howls: G.audio.howls.size,
        howlerRequested: performance.getEntriesByType('resource').some((r) => /howler/i.test(r.name)),
        studentUserArt: G.player.usesUserArt, teacherUserArt: G.teacher.usesUserArt,
        groundPlaceholder: G.ground.usesPlaceholderArt,
        playerScale: [G.player.sprite.scale.x, G.player.sprite.scale.y],
        teacherScale: [G.teacher.sprite.scale.x, G.teacher.sprite.scale.y],
      };
    });
    rep.check('no JS errors', g.pageErrors.length === 0, g.pageErrors.join(' | '));
    rep.check('Howler stays dormant', info.howls === 0 && !info.howlerRequested);
    rep.check('placeholder art for player/teacher/ground',
      !info.studentUserArt && !info.teacherUserArt && info.groundPlaceholder);
    rep.check('placeholder planes keep 3:5 / 2:3',
      Math.abs(info.playerScale[0] - 1.5) < 1e-6 && Math.abs(info.playerScale[1] - 2.5) < 1e-6
      && Math.abs(info.teacherScale[0] - 2) < 1e-6 && Math.abs(info.teacherScale[1] - 3) < 1e-6,
      `player ${info.playerScale.join('×')}, teacher ${info.teacherScale.join('×')}`);

    const play = await g.page.evaluate(() => {
      const G = window.__game;
      G.startGame();
      G.player.jump();
      const jumped = G.player.isJumping;
      G.player.update(0.3, 15);
      const midAir = G.player.currentY > 0;
      G.player.update(G.config.PLAYER.JUMP_DURATION, 15);
      G.player.slide();
      return { state: G.gameState.state, jumped, midAir, sliding: G.player.isSliding };
    });
    rep.check('playable without any assets', play.state === 'PLAYING' && play.jumped && play.midAir && play.sliding,
      JSON.stringify(play));
  } finally {
    await g?.close();
    await srv.close();
  }
  return rep;
}

// ---------------------------------------------------------------------------
// 3. billboard "3D" view: foreshortening, screen-space lean, front-render swap
// ---------------------------------------------------------------------------
async function suiteViews(browser) {
  section('Suite 3 — billboard 3D view (foreshorten + lean + swap)');
  const rep = new Report('views');
  const srv = await createServer(ROOT);
  let g;
  try {
    g = await openGame(browser, srv.base);
    const v = await g.page.evaluate(() => {
      const G = window.__game;
      G.startGame();
      const P = G.player;
      const step = (n) => { for (let i = 0; i < n; i++) P.update(0.05, 20); };
      const sample = () => ({
        yaw: +P.viewYaw.toFixed(3),
        scaleX: +(P.sprite.scale.x / P.spriteW).toFixed(3),
        roll: +P.material.rotation.toFixed(3),
        front: P.material.map === P.frontTexture,
        back: P.material.map === P.frames.runA,
      });

      P.reset(); P.targetLane = 1; P.laneX = 0; step(60);
      const centre = sample();

      P.targetLane = 0; step(80);
      const left = sample();

      P.targetLane = 1; step(160);
      const back = sample();

      P.stumble();
      step(2);
      const stumble = sample();

      return {
        hasFront: !!P.frontTexture,
        cfg: {
          turn: G.config.PLAYER.VIEW_TURN,
          lean: G.config.PLAYER.VIEW_LEAN,
          min: G.config.PLAYER.VIEW_MIN_SCALE,
        },
        centre, left, back, stumble,
      };
    });

    const cfg = v.cfg;
    rep.check('front renders loaded for both characters', v.hasFront);
    rep.check('centre lane: full width, upright, back render',
      v.centre.back && !v.centre.front
      && v.centre.scaleX > 0.99 && Math.abs(v.centre.yaw) < 1e-6 && Math.abs(v.centre.roll) < 1e-6,
      `scaleX ${v.centre.scaleX}, yaw ${v.centre.yaw}, roll ${v.centre.roll}`);
    rep.check('lane change foreshortens the billboard (scale.x = W·cos(turn))',
      Math.abs(v.left.scaleX - Math.max(cfg.min, Math.cos(v.left.yaw))) < 0.01 && v.left.scaleX < 0.95,
      `scaleX ${v.left.scaleX} at yaw ${v.left.yaw} rad`);
    rep.check('lane change leans the sprite in screen space (material.rotation)',
      Math.abs(v.left.roll + v.left.yaw * cfg.lean) < 0.01 && Math.abs(v.left.roll) > 0.05,
      `roll ${v.left.roll} rad for yaw ${v.left.yaw}`);
    rep.check('returning to centre restores width and upright stance',
      v.back.scaleX > 0.99 && Math.abs(v.back.roll) < 0.01 && v.back.back,
      `scaleX ${v.back.scaleX}, roll ${v.back.roll}`);
    rep.check('stumbling shows the front render (body faces the camera)',
      v.stumble.front, `map is front render: ${v.stumble.front}`);

    const tv = await g.page.evaluate(() => {
      const G = window.__game;
      const T = G.teacher;
      T.reset(); T.onPlayerMistake();
      const out = {};
      for (let i = 0; i < 80; i++) { T.sprite.position.x = -4; T.update(0.05, 20, -4, false); }
      out.left = {
        yaw: +T.viewYaw.toFixed(3), roll: +T.material.rotation.toFixed(3),
        scaleX: +(T.sprite.scale.x / T.spriteW).toFixed(3),
        front: T.material.map === T.frontTexture,
      };
      T.forceCatch();
      for (let i = 0; i < 10; i++) T.update(0.05, 20, -4, false);
      out.catch = {
        front: T.material.map === T.frontTexture,
        scaleX: +(T.sprite.scale.x / T.spriteW).toFixed(3),
      };
      return out;
    });
    rep.check('teacher foreshortens + leans as she weaves',
      tv.left.scaleX < 0.95 && Math.abs(tv.left.roll) > 0.05,
      `scaleX ${tv.left.scaleX}, roll ${tv.left.roll}`);
    rep.check('teacher faces the camera for the catch pose (front render)',
      tv.catch.front, `catch front: ${tv.catch.front}, scaleX ${tv.catch.scaleX}`);
    rep.check('no JS errors during view tests', g.pageErrors.length === 0, g.pageErrors.join(' | '));
  } finally {
    if (g) await g.close();
    await srv.close();
  }

  // placeholders (no front render) must still lean but never reshuffle textures
  const srv2 = await createServer(ROOT, { hideAssets: true });
  let g2;
  try {
    g2 = await openGame(browser, srv2.base);
    const flat = await g2.page.evaluate(() => {
      const G = window.__game;
      G.startGame();
      const P = G.player;
      P.targetLane = 0;
      let maxRoll = 0;
      for (let i = 0; i < 60; i++) { P.update(0.05, 20); maxRoll = Math.max(maxRoll, Math.abs(P.material.rotation)); }
      return {
        maxRoll: +maxRoll.toFixed(3), hasFront: !!P.frontTexture,
        mapIsRunA: P.material.map === P.frames.runA,
      };
    });
    rep.check('placeholder art (no front render) leans but keeps its own frames',
      !flat.hasFront && flat.maxRoll > 0.02 && flat.mapIsRunA,
      `max roll ${flat.maxRoll} rad, frames intact ${flat.mapIsRunA}`);
  } finally {
    if (g2) await g2.close();
    await srv2.close();
  }
  return rep;
}

// ---------------------------------------------------------------------------
// 4. aspect fitting + palette signature (synthetic stand-ins)
// ---------------------------------------------------------------------------
async function suiteAspect(browser) {
  section('Suite 4 — user-art override, aspect fitting, palette signature');
  const rep = new Report('aspect');
  const overlay = {
    'assets/textures/student-character.png': characterPng(600, 1000, [30, 60, 200], [255, 0, 255]),
    'assets/textures/teacher-character.png': characterPng(800, 1200, [200, 40, 40], [0, 255, 0]),
    'assets/textures/ground-gravel.png': gravelPng(1024),
  };

  // placeholder baseline (empty assets)
  const srvA = await createServer(ROOT, { hideAssets: true });
  let baseline;
  try {
    const g = await openGame(browser, srvA.base);
    baseline = await playerShot(g.page);
    await g.close();
  } finally { await srvA.close(); }

  const srvB = await createServer(ROOT, { hideAssets: true, overlay });
  let g;
  try {
    g = await openGame(browser, srvB.base);
    const info = await g.page.evaluate(() => {
      const G = window.__game;
      return {
        student: { user: G.player.usesUserArt, scale: [G.player.sprite.scale.x, G.player.sprite.scale.y] },
        teacher: { user: G.teacher.usesUserArt, scale: [G.teacher.sprite.scale.x, G.teacher.sprite.scale.y] },
        ground: (() => {
          // the ground is an InstancedMesh ring sharing one material
          const G2 = G.ground;
          const mesh = G2.tileMesh || (G2.tiles && G2.tiles[0]) || null;
          const map = mesh?.material?.map || null;
          return {
            placeholder: G2.usesPlaceholderArt,
            repeat: map ? [+map.repeat.x.toFixed(2), +map.repeat.y.toFixed(2)] : null,
            wrap: map ? (map.wrapS === 1000 && map.wrapT === 1000) : null,
            instanced: !!G2.tileMesh,
          };
        })(),
      };
    });
    const shot = await playerShot(g.page);

    rep.check('synthetic PNGs override all three slots',
      info.student.user && info.teacher.user && !info.ground.placeholder);
    rep.check('exact-contract art keeps 1.5×2.5 / 2×3',
      Math.abs(info.student.scale[0] - 1.5) < 0.01 && Math.abs(info.student.scale[1] - 2.5) < 0.01
      && Math.abs(info.teacher.scale[0] - 2) < 0.01 && Math.abs(info.teacher.scale[1] - 3) < 0.01);
    rep.check('ground texture applied with repeat + wrapping (tiles seamlessly)',
      Array.isArray(info.ground.repeat) && info.ground.repeat[0] > 0 && info.ground.repeat[1] > 1
      && info.ground.wrap === true,
      info.ground.repeat ? `repeat ${info.ground.repeat.join('×')}, RepeatWrapping ${info.ground.wrap}`
        : 'no map');
    rep.check('placeholder vs user-art pixel signature differs (marker visible)',
      shot.has('255,0,255') && !baseline.has('255,0,255'),
      `jaccard ${jaccard(baseline.keys, shot.keys).toFixed(3)}, marker px ${shot.countOf('255,0,255')}`);
    rep.check('rail shows canvas texture, not a stretched smear',
      shot.unique > 3, `unique colours ${shot.unique} (placeholder ${baseline.unique})`);
  } finally {
    if (g) await g.close();
    await srvB.close();
  }

  // off-aspect art must be letterboxed, never stretched
  const cases = [
    { name: 'student 1:1 (600×600)', file: 'assets/textures/student-character.png', bytes: characterPng(600, 600, [0, 128, 255], [255, 255, 0]), expect: [2.5, 2.5], target: 'player' },
    { name: 'student 3:4 (600×800)', file: 'assets/textures/student-character.png', bytes: characterPng(600, 800, [0, 128, 255], [255, 255, 0]), expect: [1.875, 2.5], target: 'player' },
    { name: 'teacher 1:1 (900×900)', file: 'assets/textures/teacher-character.png', bytes: characterPng(900, 900, [10, 10, 10], [255, 255, 0]), expect: [3, 3], target: 'teacher' },
    { name: 'teacher 1:2 (600×1200)', file: 'assets/textures/teacher-character.png', bytes: characterPng(600, 1200, [10, 10, 10], [255, 255, 0]), expect: [1.5, 3], target: 'teacher' },
  ];
  for (const c of cases) {
    const srv = await createServer(ROOT, { hideAssets: true, overlay: { [c.file]: c.bytes } });
    let pg;
    try {
      pg = await openGame(browser, srv.base);
      const got = await pg.page.evaluate((target) => {
        const e = target === 'player' ? window.__game.player : window.__game.teacher;
        return [e.sprite.scale.x, e.sprite.scale.y];
      }, c.target);
      rep.check(`${c.name} → ${c.expect.join('×')} letterboxed`,
        Math.abs(got[0] - c.expect[0]) < 0.01 && Math.abs(got[1] - c.expect[1]) < 0.01,
        `got ${got.map((v) => v.toFixed(3)).join('×')}`);
    } finally {
      if (pg) await pg.close();
      await srv.close();
    }
  }
  return rep;
}

// ---------------------------------------------------------------------------
// 5. gameplay contract
// ---------------------------------------------------------------------------
async function suiteGameplay(browser) {
  section('Suite 5 — gameplay contract');
  const rep = new Report('gameplay');
  const srv = await createServer(ROOT);
  let g;
  try {
    g = await openGame(browser, srv.base);
    const page = g.page;

    // --- live smoke first (later probes deliberately break game state) -----
    await page.evaluate(() => window.__game.startGame());
    const before = await page.evaluate(() => window.__game.gameState.distance);
    await waitFor(page, (d0) => window.__game.gameState.distance - d0 > 120,
      { timeout: 180000, label: 'distance' }, [before]);
    const run = await page.evaluate(() => {
      const G = window.__game;
      return {
        distance: G.gameState.distance, score: G.gameState.score, speed: G.gameState.currentSpeed,
        drawCalls: G.renderer.info.render.calls, obstacles: G.obstacles.count, state: G.gameState.state,
      };
    });
    rep.check('runs 120 m in the live loop without errors',
      g.pageErrors.length === 0 && run.distance > 120 && run.speed > 15,
      `dist ${run.distance.toFixed(1)} m, score ${run.score}, speed ${run.speed.toFixed(1)}, obstacles ${run.obstacles}`);
    rep.check('draw calls within budget during play (<=51)', run.drawCalls <= 51, `${run.drawCalls}`);

    // --- hitbox semantics ---------------------------------------------------
    const boxes = await page.evaluate(() => {
      const G = window.__game;
      const TYPES = G.config.OBSTACLES.TYPES;
      const states = {
        running: () => { G.player.isJumping = false; G.player.isSliding = false; G.player.currentY = 0; },
        jumping: () => { G.player.isJumping = true; G.player.isSliding = false; G.player.currentY = G.config.PLAYER.JUMP_HEIGHT; },
        sliding: () => { G.player.isSliding = true; G.player.isJumping = false; G.player.currentY = 0; },
      };
      const out = {};
      for (const type of ['LOW', 'HIGH', 'BLOCKER']) {
        out[type] = {};
        for (const [name, set] of Object.entries(states)) {
          G.obstacles.reset();
          G.player.laneX = G.config.LANES.POSITIONS[1];
          G.obstacles._spawnOne(type, TYPES[type].variants[0], 1, 0);
          set();
          out[type][name] = !!G.obstacles.checkCollision(G.player.getBounds());
        }
      }
      G.obstacles.reset();
      return out;
    });
    rep.check('LOW = jump-only', boxes.LOW.running && !boxes.LOW.jumping && boxes.LOW.sliding, JSON.stringify(boxes.LOW));
    rep.check('HIGH = slide-only', boxes.HIGH.running && boxes.HIGH.jumping && !boxes.HIGH.sliding, JSON.stringify(boxes.HIGH));
    rep.check('BLOCKER = lane-change-only',
      boxes.BLOCKER.running && boxes.BLOCKER.jumping && boxes.BLOCKER.sliding, JSON.stringify(boxes.BLOCKER));

    // --- difficulty bands / curves -----------------------------------------
    const grades = await page.evaluate(async () => {
      const D = await import('/js/utils/Difficulty.js');
      const sample = (dist, n = 600) => {
        const seen = new Set();
        for (let i = 0; i < n; i++) seen.add(D.pickSpawnTier(dist, i / n).grade);
        return [...seen].sort();
      };
      return {
        at0: sample(0), at499: sample(499), at500: sample(500), at1499: sample(1499), at1500: sample(1500),
        chance: [0, 750, 1500, 5000].map((d) => D.calculateDifficulty(d, d / 25).spawnChance),
      };
    });
    rep.check('grade bands strict (D/C@0 m, B@500 m, A+@1500 m)',
      grades.at0.every((x) => ['D', 'C'].includes(x)) && grades.at499.every((x) => ['D', 'C'].includes(x))
      && grades.at500.includes('B') && grades.at500.every((x) => ['C', 'B'].includes(x))
      && grades.at1499.every((x) => ['C', 'B'].includes(x))
      && grades.at1500.includes('A+') && grades.at1500.every((x) => ['B', 'A+'].includes(x)),
      `0=${grades.at0} 500=${grades.at500} 1500=${grades.at1500}`);
    rep.check('spawn chance ramps 0.25 → 0.65 (smoothstep 500–1500 m)',
      Math.abs(grades.chance[0] - 0.25) < 0.005 && grades.chance[1] > 0.25 && grades.chance[1] < 0.65
      && grades.chance[2] === 0.65 && grades.chance[3] === 0.65,
      grades.chance.map((v) => v.toFixed(3)).join(' → '));

    const speed = await page.evaluate(() => {
      const G = window.__game, cfg = G.config.GROUND, gs = G.gameState;
      gs.currentSpeed = cfg.INITIAL_SPEED; gs.updateSpeed(10); const after10 = gs.currentSpeed;
      gs.currentSpeed = cfg.MAX_SPEED - 0.1; gs.updateSpeed(10); const capped = gs.currentSpeed;
      return { after10, capped, init: cfg.INITIAL_SPEED, max: cfg.MAX_SPEED, inc: cfg.SPEED_INCREMENT };
    });
    rep.check('speed 15 → 45 at +0.5/s with a hard cap',
      speed.init === 15 && speed.max === 45 && speed.inc === 0.5
      && Math.abs(speed.after10 - 20) < 1e-6 && speed.capped === 45,
      `15 + 0.5×10 = ${speed.after10}, cap ${speed.capped}`);

    // --- teacher FSM --------------------------------------------------------
    await page.evaluate(() => { window.__game.pauseGame(); window.__game.startGame(); });
    const fsm = await page.evaluate(() => {
      const G = window.__game, T = G.teacher, out = {};
      G.startGame(); T.reset();
      out.initial = T.state;
      out.first = T.onPlayerMistake(); out.afterFirst = T.state;
      out.second = T.onPlayerMistake();
      out.surgeTarget = T.targetDistance;
      out.surge = G.config.TEACHER.SURGE_DISTANCE; out.menace = G.config.TEACHER.MENACE_DISTANCE;
      out.mistakes = T.mistakeCount;
      T.reset(); T.onPlayerMistake();
      T.updateRecovery(G.config.TEACHER.RECOVERY_DISTANCE + 1, true);
      out.fading = T.state;
      out.third = T.onPlayerMistake(); out.reappear = T.state;
      T.mistakeCount = G.config.TEACHER.MAJOR_BLUNDER_THRESHOLD - 1;
      out.catchResult = T.onPlayerMistake(); out.caught = T.state;
      return out;
    });
    rep.check('teacher appears on the 1st mistake',
      fsm.initial === 'HIDDEN' && fsm.first === 'ALERT' && fsm.afterFirst === 'CHASING',
      `${fsm.initial} → ${fsm.afterFirst}`);
    rep.check('2nd mistake surges closer',
      fsm.surgeTarget === fsm.surge && fsm.surge < fsm.menace && fsm.mistakes === 2,
      `target ${fsm.surgeTarget} < menace ${fsm.menace}`);
    rep.check('re-appears when hit mid-fade-out',
      fsm.fading === 'FADING_OUT' && fsm.third === 'ALERT' && fsm.reappear === 'CHASING');
    rep.check('3rd mistake = caught', fsm.catchResult === 'GAME_OVER' && fsm.caught === 'CAUGHT');

    const clean = await page.evaluate(() => {
      const G = window.__game, T = G.teacher;
      G.startGame(); T.reset(); T.onPlayerMistake();
      T.update(0.05, 20, G.player.laneX, false);
      const seen = [];
      for (let i = 0; i < 60; i++) { T.updateRecovery(2, true); T.update(0.05, 20, G.player.laneX, false); seen.push(T.state); }
      return {
        states: [...new Set(seen)],
        faded: T.state === 'FADING_OUT' || T.state === 'HIDDEN',
        recovery: G.config.TEACHER.RECOVERY_DISTANCE,
      };
    });
    rep.check('100 m clean → teacher fades out',
      clean.faded && clean.recovery === 100, clean.states.join('→'));

    // --- pause / input / storage -------------------------------------------
    const pause = await page.evaluate(() => {
      const G = window.__game, out = {};
      G.startGame(); out.playing = G.gameState.state;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true }));
      out.afterP = G.gameState.state;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
      out.afterEsc = G.gameState.state;
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      out.afterHide = G.gameState.state;
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      return out;
    });
    rep.check('pause P / resume Esc / auto-pause on tab hide',
      pause.playing === 'PLAYING' && pause.afterP === 'PAUSED' && pause.afterEsc === 'PLAYING'
      && pause.afterHide === 'PAUSED', JSON.stringify(pause));

    const input = await page.evaluate(() => {
      const G = window.__game, out = {};
      G.startGame(); G.player.reset();
      const swipe = (dx) => {
        const mk = (type, x) => {
          const t = new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 360 });
          return new TouchEvent(type, {
            touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true,
          });
        };
        document.dispatchEvent(mk('touchstart', 400));
        document.dispatchEvent(mk('touchmove', 400 + dx));
        document.dispatchEvent(mk('touchend', 400 + dx));
      };
      swipe(10); out.after10 = G.player.targetLane;
      swipe(40); out.after40 = G.player.targetLane;
      const t = new Touch({ identifier: 2, target: document.body, clientX: 400, clientY: 360 });
      const ev = new TouchEvent('touchmove', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true });
      document.dispatchEvent(ev);
      out.prevented = ev.defaultPrevented;
      out.scrollTop = document.scrollingElement.scrollTop;
      out.touchAction = getComputedStyle(document.documentElement).touchAction || getComputedStyle(document.body).touchAction;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
      out.afterLeft = G.player.targetLane;
      return out;
    });
    rep.check('swipe threshold 24 px (10 px ignored, +40 px right)',
      input.after10 === 1 && input.after40 === 2, JSON.stringify(input));
    rep.check('scroll locked (touchmove prevented, touch-action none)',
      input.prevented && input.scrollTop === 0, `touch-action ${input.touchAction}`);
    rep.check('keyboard lane switch works (ArrowLeft 2 → 1)', input.afterLeft === 1);

    const storage = await page.evaluate(() => ({
      keys: Object.keys(localStorage), prefix: window.__game.config.STORAGE.PREFIX,
    }));
    rep.check('localStorage keys use the STORAGE prefix',
      storage.keys.every((k) => k.startsWith(storage.prefix)), storage.keys.join(',') || '(none yet)');
    rep.check('no JS errors across the whole suite', g.pageErrors.length === 0, g.pageErrors.join(' | '));
  } finally {
    if (g) await g.close();
    await srv.close();
  }
  return rep;
}

// ---------------------------------------------------------------------------
const browser = await launchBrowser();
const reports = [];
try {
  if (wants('boot')) reports.push(await suiteBoot(browser));
  if (wants('empty')) reports.push(await suiteEmpty(browser));
  if (wants('views')) reports.push(await suiteViews(browser));
  if (wants('aspect')) reports.push(await suiteAspect(browser));
  if (wants('gameplay')) reports.push(await suiteGameplay(browser));
} finally {
  await browser.close();
}

section('Summary');
let failed = 0;
for (const r of reports) {
  const f = r.failed.length;
  failed += f;
  console.log(`${f === 0 ? '✅' : '❌'} ${r.name}: ${r.results.length - f}/${r.results.length} checks passed`);
  for (const x of r.failed) console.log(`     - ${x.label} ${x.detail}`);
}
process.exit(failed === 0 ? 0 : 1);
