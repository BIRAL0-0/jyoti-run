/**
 * run.mjs — School Runner contract suites (offline harness).
 *
 *   node run.mjs [suite ...]   suites: boot empty views aspect gameplay walkway
 *
 * Drives the real game in a real browser (SwiftShader WebGL) and checks the
 * non-negotiable contract: assets, fallbacks, aspect handling, pseudo-3D views,
 * hitboxes, difficulty bands, teacher FSM, pause/input/storage, debug surface.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
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
        groundTex: (() => {
          const t = G.ground.tileMesh?.material?.map;
          if (!t) return null;
          return {
            img: [t.image.width, t.image.height],
            repeat: [t.repeat.x, t.repeat.y],
            wrapping: t.wrapS === 1000 && t.wrapT === 1000,   // THREE.RepeatWrapping
          };
        })(),
        groundRepeatY: G.config.GROUND.TEXTURE_REPEAT_Y,
        scenery: G.scenery.describe(),
        campus: G.campus.describe(),
        crossSection: {
          roadEdge: G.config.GROUND.TILE_WIDTH / 2,
          borderInner: G.config.CAMPUS.BORDER.INNER_X,
          borderOuter: G.config.CAMPUS.BORDER.INNER_X + G.config.CAMPUS.BORDER.WIDTH,
          hedge: G.config.CAMPUS.HEDGE.X,
          verandaInner: G.config.CAMPUS.VERANDA.INNER_X,
          verandaOuter: G.config.CAMPUS.VERANDA.INNER_X + G.config.CAMPUS.VERANDA.WIDTH,
          buildingInner: G.config.CAMPUS.BUILDINGS.INNER_X,
        },
        // fraction of screen height the character occupies (owner review #7)
        playerScreenHeight: (() => {
          const s = G.player.sprite;
          const cy = s.center ? s.center.y : 0.5;
          const cam = G.camera;
          const top = s.position.clone()
            .set(s.position.x, s.position.y + s.scale.y * (1 - cy), s.position.z).project(cam);
          const bot = s.position.clone()
            .set(s.position.x, s.position.y - s.scale.y * cy, s.position.z).project(cam);
          return Math.abs(top.y - bot.y) / 2;    // NDC spans -1..1
        })(),
        // Owner review: fence/grass/structures must sit ON the ground plane,
        // not beneath it, and must not overlap the road.
        groundAlignment: (() => {
          const probe = G.ground.tileMesh.geometry;
          probe.computeBoundingBox();
          const Box3 = probe.boundingBox.constructor;
          const Matrix4 = G.ground.tileMesh.matrixWorld.constructor;
          // Per-INSTANCE boxes: two strips either side of the road union into
          // one box that appears to cross the centre, so a union is useless
          // for the "does it overlap the road?" question.
          const measure = (mesh) => {
            if (!mesh) return null;
            mesh.geometry.computeBoundingBox();
            mesh.updateWorldMatrix(true, false);
            const bb = mesh.geometry.boundingBox;
            const m = new Matrix4();
            const tmp = new Box3();
            const n = mesh.count ?? 1;
            const boxes = [];
            for (let i = 0; i < n; i++) {
              if (mesh.count) mesh.getMatrixAt(i, m); else m.identity();
              tmp.copy(bb).applyMatrix4(m).applyMatrix4(mesh.matrixWorld);
              boxes.push({
                minX: +tmp.min.x.toFixed(3), maxX: +tmp.max.x.toFixed(3),
                minY: +tmp.min.y.toFixed(3), maxY: +tmp.max.y.toFixed(3),
              });
            }
            return {
              count: n,
              minY: +Math.min(...boxes.map((b) => b.minY)).toFixed(3),
              maxY: +Math.max(...boxes.map((b) => b.maxY)).toFixed(3),
              // instances whose x-range intrudes on the road corridor
              overlapRoad: boxes.filter((b) => !(b.minX >= 5.9 || b.maxX <= -5.9)).length,
              // nearest / farthest x any instance reaches, from track centre
              clearGap: +Math.min(...boxes.map((b) => Math.min(Math.abs(b.minX), Math.abs(b.maxX)))).toFixed(3),
              outerX: +Math.max(...boxes.map((b) => Math.max(Math.abs(b.minX), Math.abs(b.maxX)))).toFixed(3),
            };
          };
          const band = (id) => {
            const b = G.campus.bands.find((x) => x.id === id);
            return b ? measure(b.group.children[0]) : null;
          };
          return {
            road: measure(G.ground.tileMesh),
            lawn: measure(G.ground.lawnMesh),
            border: band('border'),
            railing: band('railing'),
            hedge: band('hedge'),
            veranda: band('veranda'),
            buildings: G.campus.bands
              .filter((b) => b.id.startsWith('building:'))
              .map((b) => measure(b.group.children[0])),
            decor: (G.ground.decorGroup?.children ?? []).map(measure),
          };
        })(),
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
    // The ground texture is now a committed tile, so there is no optional
    // probe left: every asset request must resolve and the console is silent.
    const asset404 = g.requests.filter((r) => /assets\//.test(r));
    const consoleNoise = g.consoleErrors.filter((e) => !/404/.test(e));
    rep.check('console completely clean (no asset 404s left to document)',
      consoleNoise.length === 0 && g.consoleErrors.length === 0,
      g.consoleErrors.length ? `${g.consoleErrors.length} error line(s)` : 'zero errors');
    rep.check('every asset request resolves',
      asset404.length === 0, asset404.join(' | ') || 'none');
    rep.check('Howler active with all 6 mp3s', info.howler && info.howls === 6, info.howlKeys.join(','));
    rep.check('student art is the supplied render, 3:5',
      info.student.userArt && info.student.front
      && Math.abs(info.student.scale[0] - 1.8) < 0.01 && Math.abs(info.student.scale[1] - 3.0) < 0.01,
      `plane ${info.student.scale.join('×')}, image ${info.student.img.join('×')}, aspect ${info.student.aspect.toFixed(3)}`);
    rep.check('teacher art is the supplied render, 2:3',
      info.teacher.userArt && info.teacher.front
      && Math.abs(info.teacher.scale[0] - 2) < 0.01 && Math.abs(info.teacher.scale[1] - 3) < 0.01,
      `plane ${info.teacher.scale.join('×')}, image ${info.teacher.img.join('×')}, aspect ${info.teacher.aspect.toFixed(3)}`);
    rep.check('ground uses the committed 1536×1280 paver tile, not the placeholder',
      info.ground === false && !!info.groundTex
      && info.groundTex.img[0] === 1536 && info.groundTex.img[1] === 1280,
      info.groundTex ? `${info.groundTex.img.join('×')}` : 'no texture');
    rep.check('paver tile wraps + repeats through GROUND.TEXTURE_REPEAT_Y',
      !!info.groundTex && info.groundTex.wrapping
      && info.groundTex.repeat[0] === 1
      && info.groundTex.repeat[1] === info.groundRepeatY,
      info.groundTex ? `repeat ${info.groundTex.repeat.join('×')}, wrapping ${info.groundTex.wrapping}` : 'no texture');
    // Owner review: the photo billboards at the far end read as a pasted,
    // duplicated scene (miniature gate + baked sky). They are opt-in now, so
    // the shipped default must keep the horizon fully procedural.
    rep.check('far end stays procedural (photo scenery off by default)',
      info.scenery.usesPlaceholderArt === true
      && info.scenery.loaded.length === 0
      && info.scenery.horizon === null
      && info.scenery.rings.length === 0,
      JSON.stringify(info.scenery));
    rep.check('campus bands built: border + railing + hedge + veranda + colonnade + 2 school blocks',
      info.campus.enabled
      && ['border', 'railing', 'hedge', 'veranda', 'colonnade']
        .every((id) => info.campus.bands.some((b) => b.id === id))
      && info.campus.bands.filter((b) => b.id.startsWith('building:')).length === 2,
      info.campus.bands.map((b) => b.id).join(' '));
    rep.check('cross-section order ROAD|Border|Hedge|Veranda|Building holds',
      info.crossSection.roadEdge <= info.crossSection.borderInner
      && info.crossSection.borderOuter <= info.crossSection.hedge
      && info.crossSection.hedge < info.crossSection.verandaInner
      && info.crossSection.verandaOuter <= info.crossSection.buildingInner,
      `road ${info.crossSection.roadEdge} | border ${info.crossSection.borderInner}-${info.crossSection.borderOuter} | hedge ${info.crossSection.hedge} | veranda ${info.crossSection.verandaInner}-${info.crossSection.verandaOuter} | building ${info.crossSection.buildingInner}`);
    // Owner review: "fences/grass/structures spawn below the ground level".
    // Every scenery band must have its LOWEST point at (or just fractionally
    // under) y = 0, i.e. flush with the road surface.
    const ga = info.groundAlignment;
    const bands = [ga.lawn, ga.border, ga.hedge, ga.veranda, ...ga.buildings, ...ga.decor]
      .filter(Boolean);
    rep.check('every scenery instance sits on the ground plane (nothing buried)',
      bands.length >= 6 && bands.every((b) => b.minY >= -0.05 && b.minY <= 0.05),
      `${bands.length} bands, lowest minY ${Math.min(...bands.map((b) => b.minY))}`);
    rep.check('railing stands on the raised border (stacked, not buried)',
      !!ga.railing && ga.railing.minY >= 0.45 && ga.railing.minY <= 0.55,
      ga.railing ? `railing minY ${ga.railing.minY} on border` : 'no railing');
    rep.check('no scenery instance overlaps the road surface',
      [...bands, ga.railing].filter(Boolean).every((b) => b.overlapRoad === 0),
      `${[...bands, ga.railing].filter(Boolean).reduce((a, b) => a + b.overlapRoad, 0)} intruding instances across ${bands.length + 1} bands`);
    rep.check('road and lawn are flush at y = 0 (no coplanar z-fighting)',
      Math.abs(ga.road.minY) < 0.001 && Math.abs(ga.lawn.minY) < 0.001
      && ga.lawn.clearGap >= ga.road.outerX - 0.001,
      `road y${ga.road.minY} out to |x|${ga.road.outerX}; lawn y${ga.lawn.minY}, nearest edge |x|${ga.lawn.clearGap}`);
    rep.check('player fills 18-24% of screen height (camera lowered)',
      info.playerScreenHeight >= 0.18 && info.playerScreenHeight <= 0.24,
      `${(info.playerScreenHeight * 100).toFixed(1)}% of screen height`);
    rep.check('draw calls within budget (<=51 at start)', info.drawCalls <= 51, `${info.drawCalls}`);
    rep.check('debug surface complete',
      Object.values(info.debugSurface).every((v) => v === true || v === 'function'));
    rep.check('CONFIG.DEBUG flags intact',
      ['SHOW_FPS', 'GOD_MODE', 'SKIP_START_SCREEN'].every((k) => info.debugFlags.includes(k)));
    rep.check('STORAGE keys via constants',
      info.storage.PREFIX === 'schoolrunner' && info.storage.BEST_SCORE_KEY === 'best.score');
    rep.check('tuning contract values unchanged',
      info.configKeys.speed.join() === '15,45,0.5' && info.configKeys.spawn.join() === '0.25,0.65');

    const decor = await g.page.evaluate(() =>
      window.__game.ground.decorGroup.children.map((c) => c.userData.decorType));
    rep.check('landscaping is rounded trees + bush planters only',
      decor.length === 2 && decor.includes('tree') && decor.includes('bush'),
      decor.join(','));

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
        scenery: G.scenery.describe(),
        playerScale: [G.player.sprite.scale.x, G.player.sprite.scale.y],
        teacherScale: [G.teacher.sprite.scale.x, G.teacher.sprite.scale.y],
      };
    });
    rep.check('no JS errors', g.pageErrors.length === 0, g.pageErrors.join(' | '));
    rep.check('Howler stays dormant', info.howls === 0 && !info.howlerRequested);
    rep.check('placeholder art for player/teacher/ground',
      !info.studentUserArt && !info.teacherUserArt && info.groundPlaceholder);
    rep.check('scenery adds nothing with an empty assets/ (zero objects)',
      info.scenery.usesPlaceholderArt === true && info.scenery.loaded.length === 0
      && info.scenery.horizon === null && info.scenery.rings.length === 0,
      JSON.stringify(info.scenery));
    rep.check('placeholder planes keep 3:5 / 2:3',
      Math.abs(info.playerScale[0] - 1.8) < 1e-6 && Math.abs(info.playerScale[1] - 3.0) < 1e-6
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
    rep.check('exact-contract art keeps 1.8×3.0 / 2×3',
      Math.abs(info.student.scale[0] - 1.8) < 0.01 && Math.abs(info.student.scale[1] - 3.0) < 0.01
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
    { name: 'student 1:1 (600×600)', file: 'assets/textures/student-character.png', bytes: characterPng(600, 600, [0, 128, 255], [255, 255, 0]), expect: [3.0, 3.0], target: 'player' },
    { name: 'student 3:4 (600×800)', file: 'assets/textures/student-character.png', bytes: characterPng(600, 800, [0, 128, 255], [255, 255, 0]), expect: [2.25, 3.0], target: 'player' },
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

    // far-end invariants sampled twice: the horizon must stay fully
    // procedural during play — no photo billboards, ever.
    const readScenery = () => page.evaluate(() => {
      const G = window.__game;
      return {
        horizonNull: G.scenery.horizon === null,
        rings: G.scenery.rings.length,
        loaded: G.scenery.loadedIds.length,
      };
    });
    await waitFor(page, (d0) => window.__game.gameState.distance - d0 > 40,
      { timeout: 180000, label: 'distance 40' }, [before]);
    const scn1 = await readScenery();

    await waitFor(page, (d0) => window.__game.gameState.distance - d0 > 120,
      { timeout: 180000, label: 'distance' }, [before]);
    const scn2 = await readScenery();
    rep.check('no photo billboards at the far end during play',
      scn1.horizonNull && scn1.rings === 0 && scn1.loaded === 0
      && scn2.horizonNull && scn2.rings === 0 && scn2.loaded === 0,
      `@40m ${JSON.stringify(scn1)} @120m ${JSON.stringify(scn2)}`);
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
    // Research-report budget is < 100 draw calls on desktop, < 50 on mobile.
    // The campus (sidewalk + kerb + railings + 3 building variants) and the
    // corridor archway added ~10 to the old ~31 baseline, so the guard sits
    // at 70: still well inside the spec ceiling, tight enough to catch a
    // regression that starts drawing the world one mesh at a time.
    rep.check('draw calls within budget during play (<=70, spec ceiling 100)',
      run.drawCalls <= 70, `${run.drawCalls}`);

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
      out.mistakesAfterFirst = T.mistakeCount;
      out.second = T.onPlayerMistake(); out.afterSecond = T.state;
      T.reset(); T.onPlayerMistake();
      T.updateRecovery(G.config.TEACHER.RECOVERY_DISTANCE + 1, true);
      out.fading = T.state;
      out.third = T.onPlayerMistake(); out.reappear = T.state;
      return out;
    });
    rep.check('teacher appears on the 1st mistake',
      fsm.initial === 'HIDDEN' && fsm.first === 'ALERT' && fsm.afterFirst === 'CHASING'
      && fsm.mistakesAfterFirst === 1,
      `${fsm.initial} → ${fsm.afterFirst}`);
    rep.check('2nd mistake = caught (game over)',
      fsm.second === 'GAME_OVER' && fsm.afterSecond === 'CAUGHT',
      `2nd mistake → ${fsm.second}/${fsm.afterSecond}`);
    rep.check('re-appears when hit mid-fade-out',
      fsm.fading === 'FADING_OUT' && fsm.third === 'ALERT' && fsm.reappear === 'CHASING');

    const clean = await page.evaluate(() => {
      const G = window.__game, T = G.teacher;
      G.startGame(); T.reset(); T.onPlayerMistake();
      T.update(0.05, 20, G.player.laneX, false);
      const seen = [];
      for (let i = 0; i < 80; i++) { T.updateRecovery(2, true); T.update(0.05, 20, G.player.laneX, false); seen.push(T.state); }
      return {
        states: [...new Set(seen)],
        faded: T.state === 'FADING_OUT' || T.state === 'HIDDEN',
        recovery: G.config.TEACHER.RECOVERY_DISTANCE,
        decay: G.config.TEACHER.MISTAKE_DECAY_METERS,
      };
    });
    rep.check('150 m clean → teacher fades out',
      clean.faded && clean.recovery === 150, clean.states.join('→'));
    rep.check('mistake decay >= recovery distance (game stays losable)',
      clean.decay >= clean.recovery, `decay ${clean.decay} >= recovery ${clean.recovery}`);

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
// 6. one continuous tiled walkway (research/WALKWAY_PLAN.md §5.2, W1–W7)
// ---------------------------------------------------------------------------
/** Pixel classifiers shared by the walkway render checks. */
const fogRGB = [207, 230, 245];                    // LIGHTING.FOG.color == SKY.GRADIENT.HORIZON
const nearFog = (r, g, b) => Math.abs(r - fogRGB[0]) <= 30 && Math.abs(g - fogRGB[1]) <= 30 && Math.abs(b - fogRGB[2]) <= 30;
const isGrass = (r, g, b) => g > r + 12 && g > b + 12;
const isSky = (r, g, b) => b > r + 30 && !nearFog(r, g, b);
const isBlack = (r, g, b) => r + g + b < 60;
const isBlue = (r, g, b) => b > r + 15 && b > g + 5;
const isVividYellow = (r, g, b) => r > 200 && g > 180 && b < 120;

/** Decode a screenshot and pull one scan row / rect of RGB triplets. */
function shotPixels(buf) {
  const png = PNG.sync.read(Buffer.from(buf));
  return {
    w: png.width, h: png.height, d: png.data,
    at: (x, y) => {
      const i = (y * png.width + x) * 4;
      return [png.data[i], png.data[i + 1], png.data[i + 2]];
    },
  };
}

async function suiteWalkway(browser) {
  section('Suite 6 — one continuous tiled walkway (WALKWAY_PLAN §5.2)');
  const rep = new Report('walkway');
  const srv = await createServer(ROOT);
  let g;
  try {
    g = await openGame(browser, srv.base);
    const page = g.page;

    // ---- W1/W2/W4-aspect/W6/W7: scene-graph facts -------------------------
    const t = await page.evaluate(() => {
      const G = window.__game;
      const mesh = G.ground.tileMesh;
      const tex = mesh.material.map;
      const cfg = G.config.GROUND;
      const footX = cfg.TILE_WIDTH / tex.repeat.x;     // texture footprint across
      const footZ = cfg.TILE_LENGTH / tex.repeat.y;    // texture footprint along z
      return {
        placeholder: G.ground.usesPlaceholderArt,
        img: [tex.image.width, tex.image.height],
        repeat: [tex.repeat.x, tex.repeat.y],
        wrap: tex.wrapS === 1000 && tex.wrapT === 1000,
        instanced: mesh.isInstancedMesh === true,
        instances: mesh.count,
        texelsX: tex.image.width / footX,
        texelsZ: tex.image.height / footZ,
        lattice: cfg.TILE_LENGTH / footZ,
        scenery: G.scenery.describe(),
        campusBands: G.campus.describe().bands.map((b) => b.id),
        calls: G.renderer.info.render.calls,
      };
    });
    rep.check('W1 surface = committed 1536×1280 paver tile, RepeatWrapping, repeat [1,2]',
      t.placeholder === false && t.img[0] === 1536 && t.img[1] === 1280
      && t.wrap && t.repeat[0] === 1 && t.repeat[1] === 2,
      `${t.img.join('×')} repeat ${t.repeat.join('×')} wrap ${t.wrap}`);
    rep.check('W2 lattice proof: ring period = exactly 2 pattern periods (seam impossible)',
      Math.abs(t.lattice - 2) < 1e-9, `TILE_LENGTH ÷ (footprint/repeat.y) = ${t.lattice}`);
    rep.check('W4a square texels 128 px/m on both axes (block scale identical, no stretch)',
      Math.abs(t.texelsX - 128) < 1e-6 && Math.abs(t.texelsZ - 128) < 1e-6,
      `${t.texelsX} / ${t.texelsZ} px per m`);
    rep.check('W7 one instanced mesh, one material, one texture; draw calls in budget',
      t.instanced && t.instances === 20 && t.calls <= 51,
      `InstancedMesh ×${t.instances}, ${t.calls} calls at start`);
    rep.check('W6 gate/scenery layer absent by default, campus bands unchanged',
      t.scenery.usesPlaceholderArt === true && t.scenery.loaded.length === 0
      && t.scenery.horizon === null && t.scenery.rings.length === 0
      && ['border', 'railing', 'hedge', 'veranda', 'colonnade'].every((id) => t.campusBands.includes(id))
      && t.campusBands.filter((id) => id.startsWith('building:')).length === 2,
      `bands: ${t.campusBands.join(' ')}`);

    // ---- freeze the world at the start line (paused still renders) --------
    const frame0 = await page.evaluate(() => {
      const G = window.__game;
      G.startGame();                       // resets obstacles + collectibles
      G.pauseGame();                       // freeze; render loop continues
      document.getElementById('pause-screen').style.display = 'none';
      return G.renderer.info.render.frame;
    });
    await waitFor(page, (f0) => window.__game.renderer.info.render.frame > f0 + 1,
      { timeout: 60000, label: 'paused frame render' }, [frame0]);

    const marks = await page.evaluate(() => {
      const G = window.__game;
      const cam = G.camera;
      const V = cam.position.constructor;
      const proj = (x, y, z) => {
        const v = new V(x, y, z); v.project(cam);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
      };
      const s = G.player.sprite;
      const cy = s.center ? s.center.y : 0.5;
      // side columns must stop where the projected corridor (|x| ≤ 6 m)
      // narrows past the column offset, else they leave the pavement
      const sideCol = (frac, label) => {
        const x = Math.round(innerWidth * frac);
        const off = Math.abs(x - innerWidth / 2);
        let yTop = Math.round(proj(0, 0, -240).y);
        for (let z = 0; z >= -240; z -= 2) {
          const hw = (proj(6, 0, z).x - proj(-6, 0, z).x) / 2;
          if (hw <= off + 8) { yTop = Math.round(proj(0, 0, z).y); break; }
        }
        return { x, y0: Math.round(proj(0, 0, 0).y) - 2, yTop, label };
      };
      return {
        feet: proj(0, 0, 0),
        head: proj(s.position.x, s.position.y + s.scale.y * (1 - cy), s.position.z),
        w: innerWidth, h: innerHeight,
        cols: [
          { x: Math.round(innerWidth / 2), y0: Math.round(proj(s.position.x, s.position.y + s.scale.y * (1 - cy), s.position.z).y) - 6, yTop: Math.round(proj(0, 0, -240).y), label: 'centre' },
          sideCol(0.44, 'mid-left'),
          sideCol(0.56, 'mid-right'),
          sideCol(0.37, 'left'),
          sideCol(0.63, 'right'),
        ],
      };
    });

    const shot = shotPixels(await page.screenshot());

    // ---- W3 continuity: scanlines feet→horizon contain only pavement ------
    const violations = [];
    let scanned = 0;
    for (const c of marks.cols) {
      for (let y = Math.max(0, c.yTop); y <= Math.min(marks.h - 1, c.y0); y++) {
        scanned++;
        const [r, gg, b] = shot.at(c.x, y);
        const cls = isGrass(r, gg, b) ? 'grass' : isSky(r, gg, b) ? 'sky' : isBlack(r, gg, b) ? 'black' : null;
        if (cls) { violations.push(`${c.label}@(${c.x},${y})=${cls}`); if (violations.length > 6) break; }
      }
    }
    rep.check('W3 one continuous surface: scanlines feet→vanishing point are pure pavement',
      violations.length === 0 && scanned > 300,
      violations.join(' ') || `3 columns, ${scanned} rows clean`);

    // ---- W4b rendered block scale follows perspective ---------------------
    // Course (horizontal joint) lines are the strongest rendered feature:
    // their screen rows must land where the camera projects z = −0.5·k m.
    // At 20 m a 0.25 m module is ~4 px at 720p — below resolvable detail —
    // so the horizon scale is pinned by the exact mapping math (W2/W4a) and
    // the rendered check runs over the resolvable near/mid field.
    const courseYs = await page.evaluate(() => {
      const G = window.__game;
      const cam = G.camera;
      const V = cam.position.constructor;
      // the resolvable near field is camera-side of the player (z > 0):
      // the ring's first plane spans z ∈ [0, 20]
      const ys = [];
      for (let k = 0; k <= 44; k++) {
        const v = new V(0, 0, 0.5 * k).project(cam);
        ys.push((-v.y * 0.5 + 0.5) * innerHeight);
      }
      return ys;
    });
    const y0b = Math.round(marks.feet.y) - 4;
    const y1b = Math.min(marks.h - 1, Math.round(marks.feet.y) + 150);
    const nRows = y1b - y0b;
    // two side bands: the centre carries the player's contact shadow, which
    // would fake a course line
    const rowL = new Float64Array(nRows);
    for (let j = 0; j < nRows; j++) {
      let s = 0, c = 0;
      for (const rx of [[0.375, 0.47], [0.53, 0.625]]) {
        for (let x = Math.round(marks.w * rx[0]); x < Math.round(marks.w * rx[1]); x++) {
          const [r, gg, b] = shot.at(x, y0b + j);
          s += 0.2126 * r + 0.7152 * gg + 0.0722 * b; c++;
        }
      }
      rowL[j] = s / c;
    }
    {
      let m = 0; for (let i = 0; i < nRows; i++) m += rowL[i]; m /= nRows;
      for (let i = 0; i < nRows; i++) rowL[i] -= m;
      const HW = 6, win = new Float64Array(nRows);
      let acc = 0;
      for (let i = 0; i < nRows; i++) { acc += rowL[i]; if (i >= 2 * HW + 1) acc -= rowL[i - 2 * HW - 1]; win[i] = acc; }
      for (let i = 0; i < nRows; i++) {
        const a = Math.max(0, i - HW), b = Math.min(nRows - 1, i + HW);
        rowL[i] -= (win[b] - (a > 0 ? win[a - 1] : 0)) / (b - a + 1);
      }
      let sd = 0; for (let i = 0; i < nRows; i++) sd += rowL[i] * rowL[i]; sd = Math.sqrt(sd / nRows);
      const dipRows = [];
      for (let i = 1; i < nRows - 1; i++) {
        if (rowL[i] < -sd && rowL[i] <= rowL[i - 1] && rowL[i] <= rowL[i + 1]) dipRows.push(y0b + i);
      }
      const merged = [];
      for (const y of dipRows) {
        if (merged.length && y - merged[merged.length - 1] <= 2) merged[merged.length - 1] = (merged[merged.length - 1] + y) / 2;
        else merged.push(y);
      }
      // match predicted course lines to rendered dips; the texture's phase
      // along z is arbitrary, so align the predicted fan to the first dip
      const pred = courseYs.filter((y) => y >= y0b - 10 && y <= y1b + 10);
      let matched = 0, ratioOk = false;
      if (merged.length >= 4 && pred.length >= 4) {
        let bj = 0, bd = Infinity;
        pred.forEach((p, i) => { const d = Math.abs(p - merged[0]); if (d < bd) { bd = d; bj = i; } });
        const shift = merged[0] - pred[bj];
        for (let i = bj; i < pred.length; i++) {
          const ey = pred[i] + shift;
          if (ey > y1b) break;
          if (merged.some((y) => Math.abs(y - ey) <= 3)) matched++;
        }
        const mSp = [], eSp = [];
        for (let i = 1; i < merged.length; i++) mSp.push(merged[i] - merged[i - 1]);
        for (let i = bj + 1; i < Math.min(pred.length, bj + merged.length); i++) eSp.push(pred[i] - pred[i - 1]);
        ratioOk = mSp.length >= 3 && eSp.length >= 3
          && mSp.slice(0, eSp.length).every((v, i) => Math.abs(v - eSp[i]) / eSp[i] < 0.2);
      }
      // projected 0.5 m course spacing at 20 m ahead (informational: the
      // horizon scale itself is pinned by the exact module math, W2/W4a)
      const far20 = await page.evaluate(() => {
        const G = window.__game;
        const cam = G.camera;
        const V = cam.position.constructor;
        const y1 = new V(0, 0, -20).project(cam), y2 = new V(0, 0, -20.5).project(cam);
        return Math.abs((-y1.y * 0.5 + 0.5) - (-y2.y * 0.5 + 0.5)) * innerHeight;
      });
      rep.check('W4b rendered course lines follow the perspective ratio (scale consistent to the resolvable horizon)',
        matched >= 6 && ratioOk,
        `${matched} course lines matched ±3px; spacing ratio ok ${ratioOk}; projected 0.5 m @20 m = ${far20.toFixed(1)} px (pinned by W2/W4a)`);
    }

    // ---- W5 near-field pavement carries no road markings ------------------
    let bad5 = 0, seen5 = 0;
    for (const rx of [[0.32, 0.44], [0.56, 0.68]]) {
      for (let y = Math.round(marks.feet.y) + 6; y < Math.min(marks.h, Math.round(marks.feet.y) + 86); y++) {
        for (let x = Math.round(marks.w * rx[0]); x < Math.round(marks.w * rx[1]); x++) {
          const [r, gg, b] = shot.at(x, y);
          seen5++;
          if (isBlue(r, gg, b) || isVividYellow(r, gg, b)) bad5++;
        }
      }
    }
    rep.check('W5 near-field pavement: zero blue-dominant / vivid-yellow pixels',
      bad5 === 0, `${bad5} marked pixels in ${seen5}`);

    // ---- §3.3 the fallback is the same walkway surface --------------------
    const srv2 = await createServer(ROOT, { hideAssets: true });
    let g2;
    try {
      g2 = await openGame(browser, srv2.base);
      const frameF = await g2.page.evaluate(() => {
        const G = window.__game;
        G.startGame(); G.pauseGame();
        document.getElementById('pause-screen').style.display = 'none';
        return G.renderer.info.render.frame;
      });
      await waitFor(g2.page, (f0) => window.__game.renderer.info.render.frame > f0 + 1,
        { timeout: 60000, label: 'fallback paused frame' }, [frameF]);
      const fb = await g2.page.evaluate(() => {
        const G = window.__game;
        const tex = G.ground.tileMesh.material.map;
        return {
          ph: G.ground.usesPlaceholderArt,
          img: [tex.image.width, tex.image.height],
          repeat: [tex.repeat.x, tex.repeat.y],
          wrap: tex.wrapS === 1000 && tex.wrapT === 1000,
        };
      });
      const fbRaw = await g2.page.screenshot();
      const fbShot = shotPixels(fbRaw);
      let badF = 0, seenF = 0;
      // rects kept clear of the (wider) placeholder sprite
      for (let y = Math.round(marks.feet.y) + 6; y < Math.min(marks.h, Math.round(marks.feet.y) + 86); y++) {
        for (const rx of [[0.28, 0.40], [0.60, 0.72]]) for (let x = Math.round(marks.w * rx[0]); x < Math.round(marks.w * rx[1]); x++) {
          const [r, gg, b] = fbShot.at(x, y);
          seenF++;
          if (isBlue(r, gg, b) || isVividYellow(r, gg, b)) badF++;
        }
      }
      if (badF) fs.writeFileSync('/tmp/fb-suite.png', Buffer.from(fbRaw));
      rep.check('§3.3 fallback = same walkway module grid, no lane dashes / curb strips',
        fb.ph && fb.img[0] === 1536 && fb.img[1] === 1280 && fb.repeat[1] === 2 && fb.wrap && badF === 0,
        `${fb.img.join('×')} repeat ${fb.repeat.join('×')}, markings ${badF}/${seenF}`);
    } finally {
      if (g2) await g2.close();
      await srv2.close();
    }

    rep.check('no JS errors in walkway suite', g.pageErrors.length === 0, g.pageErrors.join(' | '));
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
  if (wants('walkway')) reports.push(await suiteWalkway(browser));
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
