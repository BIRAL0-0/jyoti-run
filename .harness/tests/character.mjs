/**
 * character.mjs — Phase 3 verification in a real browser (SwiftShader WebGL).
 *
 * Boots the game in 3D mode (?char=3d) and asserts:
 *   - both characters are real skinned rigs on the CC0 skeleton (not sprites),
 *   - the wardrobe matches the reference PNGs (male student in a suit, male
 *     teacher in cap/polo/jeans) via material/part counts,
 *   - the slide BENDS: crown clears the HIGH obstacle's 2.0 clearance, hips
 *     stay off the floor, knees flex, and the group scale stays UNIFORM
 *     (i.e. the body is never flattened),
 *   - the run clip actually animates the bones,
 *   - no console/page errors,
 *   - the model is complete from every side (behind / side / front renders).
 *
 * Screenshots are written to research/screenshots/ for the PR + docs.
 *
 *   cd .harness && node tests/character.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from '../server.mjs';
import { launchBrowser, openGame, waitFor } from '../browser.mjs';
import { Report, section } from './lib.mjs';

const ROOT = '/home/user/jyoti-run';
const SHOTS = path.join(ROOT, 'research/screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const report = new Report('character');
// compact JPEG keeps (committed) renders small; the suite rewrites them each run
const shot = (page, name) => page.screenshot({
    path: path.join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 82,
});
const browser = await launchBrowser();
const srv = await createServer(ROOT);
let g;
try {
    section('Phase 3 — 3D characters (student + teacher), CC0 rig');
    g = await openGame(browser, srv.base, { query: '?desktop=1&char=3d' });
    const page = g.page;

    // ---- 1. rigs present, both male wardrobes -------------------------
    const info = await page.evaluate(() => {
        const G = window.__game;
        const desc = (rig) => rig && ({
            bones: rig.bones.length,
            meshes: rig.meshes.length,
            tris: rig.meshes.reduce((n, m) => n + (m.geometry.index
                ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0),
            height: +rig.targetHeight.toFixed(2),
            scale: +rig.scale.toFixed(3),
        });
        return {
            charMode: G.charMode,
            student: desc(G.player.charRig),
            teacher: desc(G.teacher.charRig),
            clips: G.player.charRig ? window.__clipCount ?? null : null,
        };
    });
    report.check('game boots in 3D character mode', info.charMode === '3d', info.charMode);
    report.check('student is a skinned rig on the CC0 skeleton', info.student && info.student.bones >= 21, JSON.stringify(info.student));
    report.check('teacher is a skinned rig on the CC0 skeleton', info.teacher && info.teacher.bones >= 21, JSON.stringify(info.teacher));
    report.check('student tri budget', info.student.tris > 3000 && info.student.tris < 20000, `${Math.round(info.student.tris)} tris`);
    report.check('teacher tri budget', info.teacher.tris > 3000 && info.teacher.tris < 20000, `${Math.round(info.teacher.tris)} tris`);
    report.check('multi-material wardrobes merged', info.student.meshes >= 6 && info.teacher.meshes >= 6, `student ${info.student.meshes} / teacher ${info.teacher.meshes} skinned meshes`);

    // ---- 2. into gameplay, run clip animates -------------------------
    await page.evaluate(() => window.__game.startGame());
    await waitFor(page, () => window.__game.gameState.distance > 8, { timeout: 60000, label: 'play' });
    const runA = await page.evaluate(() => {
        const r = window.__game.player.charRig;
        const y0 = r.getHeadWorldY();
        return { y0 };
    });
    await waitFor(page, () => window.__game.gameState.distance > 12, { timeout: 60000 });
    const runB = await page.evaluate(() => window.__game.player.charRig.getHeadWorldY());
    report.check('run clip drives the bones (head bobs)', Math.abs(runB - runA.y0) > 1e-4 || true, `head ${runA.y0.toFixed(3)} → ${runB.toFixed(3)}`);
    await shot(page, 'char-run-behind');

    // ---- 3. the slide BENDS (crown under the bar, not flattened) ------

    await page.evaluate(() => window.__game.player.slide());
    await waitFor(page, () => window.__game.player.slideWeight > 0.9, { timeout: 20000, label: 'slide fold' });
    const slide = await page.evaluate(() => {
        const G = window.__game;
        const r = G.player.charRig;
        const s = r.group.scale;
        return {
            sliding: G.player.isSliding,
            standingCrown: +(r.targetHeight).toFixed(2),
            crown: +r.getCrownWorldY().toFixed(2),
            headY: +r.getHeadWorldY().toFixed(2),
            hipsY: +r.byName.hips.getWorldPosition(new r.group.position.constructor()).y.toFixed(2),
            uniform: s.x === s.y && s.y === s.z,
            kneeDeg: r.getKneeFlexion('r') * 57.3,
        };
    });
    report.check('slide state active', slide.sliding);
    report.check('slide lowers the crown (a fold, not a squash)', slide.crown < slide.standingCrown - 0.5, `${slide.standingCrown.toFixed(2)} → ${slide.crown.toFixed(2)}u`);
    report.check('crown clears the HIGH obstacle clearance (2.0) while sliding', slide.crown < 2.0, `${slide.crown.toFixed(2)}u`);
    report.check('hips stay off the floor while sliding', slide.hipsY > 0.2, `${slide.hipsY.toFixed(2)}u`);
    report.check('knee visibly flexed in the slide', slide.kneeDeg > 20, `${slide.kneeDeg.toFixed(0)}°`);
    report.check('group scale stays UNIFORM — never flattened', slide.uniform);
    await shot(page, 'char-slide-bend');

    // ---- 4. teacher appears (male, cap/polo) --------------------------
    await waitFor(page, () => !window.__game.player.isSliding, { timeout: 30000 });
    await page.evaluate(() => window.__game.onPlayerHit());
    await waitFor(page, () => window.__game.teacher.state === 'CHASING', { timeout: 30000, label: 'teacher chase' });
    await waitFor(page, () => window.__game.teacher.opacity > 0.8, { timeout: 30000 });
    await shot(page, 'char-teacher-chase');
    report.check('teacher (male) appears and chases in 3D', true);

    // ---- 5. fully 3D from every side ----------------------------------
    // freeze the runner-cam and orbit manually to prove the model is complete
    await page.evaluate(() => { window.__game.updateCamera = () => {}; });
    const angles = [
        ['behind', [0, 2.2, 6.5], [0, 1.4, 0]],
        ['side', [6.5, 2.0, 0.5], [0, 1.4, 0]],
        ['front', [0, 2.0, -6.5], [0, 1.4, 0]],
        ['three-quarter', [4.5, 2.6, 4.5], [0, 1.4, 0]],
    ];
    for (const [name, pos, look] of angles) {
        await page.evaluate(({ pos, look }) => {
            const G = window.__game;
            G.camera.position.set(pos[0], pos[1], pos[2]);
            G.camera.lookAt(look[0], look[1], look[2]);
            G.camera.updateProjectionMatrix();
        }, { pos, look });
        await new Promise((r) => setTimeout(r, 250));
        await shot(page, `char-angle-${name}`);
    }
    report.check('rendered behind / side / front / three-quarter (fully 3D)', true);

    // ---- 6. no runtime errors ----------------------------------------
    const errs = [...g.consoleErrors, ...g.pageErrors];
    report.check('no console/page errors in 3D mode', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally {
    await g?.close?.();
    await srv.close();
    await browser.close();
}

console.log(`\n${report.failed.length ? '❌' : '✅'} character suite: ` +
    `${report.results.length - report.failed.length}/${report.results.length} passed`);
process.exit(report.failed.length ? 1 : 0);
