/**
 * test-character.mjs — headless validation of the character system, no browser:
 *   1. load the CC0 armature from the GLB,
 *   2. author + skin the body (plain materials — no canvas needed),
 *   3. bind a Skeleton, scale to target world height,
 *   4. play Running_A on the mixer and confirm the bones actually move,
 *   5. apply the procedural SLIDE pose and assert the body BENDS (head drops
 *      under the 2.0 clearance, knees flex, group scale stays uniform — i.e.
 *      it is never flattened).
 *
 *   node --import ./tools/node-loader.mjs tools/test-character.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTER } from '../../js/config.js';
import { buildCharacterParts } from '../../js/characters/CharacterBody.js';
import { mergeByMaterial } from '../../js/characters/skinning.js';
import { plainMaterial } from '../../js/characters/CharacterTextures.js';

const RIG = path.resolve(import.meta.dirname, '../../assets/models/rig');
const raw = fs.readFileSync(path.join(RIG, 'Med_MovementBasic.glb'));
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const gltf = await new Promise((r, j) => new GLTFLoader().parse(buf, '', r, j));

let pass = 0, fail = 0;
const ok = (cond, msg, extra = '') => {
    if (cond) { pass++; console.log(`  ✓ ${msg} ${extra}`); }
    else { fail++; console.log(`  ✗ ${msg} ${extra}`); }
};

// --- 1. armature + bones ---------------------------------------------------
const armature = gltf.scene.clone(true);
const group = new THREE.Group();
group.add(armature);
group.updateMatrixWorld(true);
const bones = []; armature.traverse((o) => { if (o.isBone) bones.push(o); });
const byName = {}; const idx = new Map();
bones.forEach((b, i) => { byName[b.name] = b; idx.set(b.name, i); });
const bindPos = {}; for (const b of bones) bindPos[b.name] = b.getWorldPosition(new THREE.Vector3());
console.log(`\n[1] armature: ${bones.length} bones`);
ok(bones.length >= 21, 'bone count', `(${bones.length})`);
ok(Math.abs(bindPos.hips.y - 0.406) < 0.02, 'hips bind y ≈ 0.406', `(${bindPos.hips.y.toFixed(3)})`);

// --- 2/3. body + skinning + scale -----------------------------------------
const rig = {
    byName, bones,
    index: (n) => (idx.has(n) ? idx.get(n) : 0),
    pos: (n) => (bindPos[n] ? bindPos[n].clone() : new THREE.Vector3()),
};
function plainMats() {
    const p = (c, r = 0.6, m = 0) => plainMaterial(c, { roughness: r, metalness: m });
    return {
        skin: p(0xd9a06f), hair: p(0x14100d), top: p(0x1b1b1f), collar: p(0xf2f2f5),
        shirt: p(0xd9cfe9), tie: p(0x2a2a2e), lanyard: p(0x2f6fd0), badge: p(0xeef2f7),
        trouser: p(0x1e1e22), stitch: p(0x4f76a3), shoe: p(0x141416), sole: p(0xe8e8ea),
        accent: p(0x2f6fd0), metal: p(0xb8bcc2, 0.3, 0.8), eyeWhite: p(0xf6f6f6),
        eyeDark: p(0x1c1410), mouth: p(0x9c5250), cap: p(0x8a8f96), capDark: p(0x6e737a),
    };
}
function makeSpec(kind) {
    const base = {
        targetHeight: CHARACTER.STUDENT_HEIGHT, radial: CHARACTER.BUILD.RADIAL_SEGMENTS,
        castShadow: false, materials: plainMats(),
    };
    if (kind === 'student') {
        return { ...base, bulk: 0.94, outfit: 'suit', hairStyle: 'curly', headwear: null, bottomDetail: 'suit', shoeStyle: 'dress', accessory: null };
    }
    return { ...base, bulk: 1.04, outfit: 'polo', hairStyle: 'short', headwear: 'cap', bottomDetail: 'jeans', shoeStyle: 'sneaker', accessory: 'whistle' };
}

// ---- both male outfits must build (PNG-matched wardrobes) ----
for (const kind of ['student', 'teacher']) {
    const s2 = makeSpec(kind);
    const pp = mergeByMaterial(buildCharacterParts(rig, s2));
    let v = 0, nn = false;
    for (const g of pp) { v += g.geometry.attributes.position.count; const a = g.geometry.attributes.position.array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) nn = true; }
    ok(pp.length >= 6 && v > 6000 && !nn, `${kind} (${s2.outfit}) outfit builds cleanly`, `(${pp.length} mats, ${v} verts)`);
}

const spec = makeSpec('student');
const parts = buildCharacterParts(rig, spec);
const merged = mergeByMaterial(parts);
const skeleton = new THREE.Skeleton(bones);
const meshes = [];
const box = new THREE.Box3();
for (const { geometry } of merged) { geometry.computeBoundingBox(); box.union(geometry.boundingBox); }
for (const { geometry, material } of merged) {
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.frustumCulled = false;
    group.add(mesh); meshes.push(mesh);
}
group.updateMatrixWorld(true);
for (const m of meshes) m.bind(skeleton);
const crown = box.max.y;
const scale = spec.targetHeight / crown;
group.scale.setScalar(scale);
group.updateMatrixWorld(true);

let verts = 0, nan = false;
for (const m of meshes) {
    verts += m.geometry.attributes.position.count;
    const p = m.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) nan = true;
}
console.log(`\n[2] body: ${parts.length} parts → ${merged.length} skinned meshes`);
ok(merged.length >= 5, 'multiple materials merged', `(${merged.length})`);
ok(verts > 1500 && verts < 40000, 'vertex budget', `(${verts} verts)`);
ok(!nan, 'no NaN in geometry');
ok(crown > 1.3 && crown < 1.8, 'bind crown ≈ 1.4–1.6 rig units', `(${crown.toFixed(3)})`);
ok(Math.abs(scale - spec.targetHeight / crown) < 1e-6, 'group scaled to target height',
    `(×${scale.toFixed(3)} → ${(crown * scale).toFixed(2)}u)`);

// --- 4. mixer drives the bones --------------------------------------------
const clip = gltf.animations.find((a) => a.name.endsWith('Running_A'));
clip.name = 'Running_A';
clip.tracks = clip.tracks.filter((t) => !/^Rig_Medium[.|]/.test(t.name));
const mixer = new THREE.AnimationMixer(armature);
mixer.clipAction(clip).play();
const headBefore = byName.head.getWorldPosition(new THREE.Vector3()).y;
mixer.setTime(0.28);
group.updateMatrixWorld(true);
const headRun = byName.head.getWorldPosition(new THREE.Vector3()).y;
const hipsRun = byName.hips.getWorldPosition(new THREE.Vector3()).y;
console.log(`\n[3] Running_A: head ${headBefore.toFixed(3)}→${headRun.toFixed(3)}, hips y=${hipsRun.toFixed(3)}`);
ok(Math.abs(headRun - headBefore) > 1e-4 || Math.abs(hipsRun - 0.406 * scale) > 1e-3,
    'clip animates the skeleton');
mixer.setTime(0); group.updateMatrixWorld(true);

// --- 5. the procedural SLIDE pose (bend, not flatten) ---------------------
const bindQ = {}; for (const b of bones) bindQ[b.name] = b.quaternion.clone();
const bindHipY = byName.hips.position.y;
function applySlide(weight) {
    // mirror AnimController: mixer frame underneath, then slerp to bind*delta
    mixer.setTime(0.1);
    for (const [bone, xyz] of Object.entries(CHARACTER.SLIDE.POSE)) {
        const b = byName[bone]; if (!b) continue;
        const target = bindQ[bone].clone().multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(xyz[0], xyz[1], xyz[2])));
        if (weight > 0) b.quaternion.slerp(target, weight);
    }
    if (weight > 0) byName.hips.position.y = bindHipY - CHARACTER.SLIDE.ROOT_DROP * weight;
    group.updateMatrixWorld(true);
}
const clearance = 2.0;            // OBSTACLES.TYPES.HIGH.clearance
applySlide(0);
const standHead = byName.head.getWorldPosition(new THREE.Vector3()).y + 0.29 * scale;
applySlide(1);
const slideHead = byName.head.getWorldPosition(new THREE.Vector3()).y + 0.29 * scale;
const slideHips = byName.hips.getWorldPosition(new THREE.Vector3()).y;
const kneeL = (() => {
    const a = byName.upperlegl.getWorldPosition(new THREE.Vector3());
    const b = byName.lowerlegl.getWorldPosition(new THREE.Vector3());
    const c = byName.footl.getWorldPosition(new THREE.Vector3());
    return Math.PI - b.clone().sub(a).normalize().angleTo(c.clone().sub(b).normalize());
})();
const kneeR = (() => {
    const a = byName.upperlegr.getWorldPosition(new THREE.Vector3());
    const b = byName.lowerlegr.getWorldPosition(new THREE.Vector3());
    const c = byName.footr.getWorldPosition(new THREE.Vector3());
    return Math.PI - b.clone().sub(a).normalize().angleTo(c.clone().sub(b).normalize());
})();
console.log(`\n[4] SLIDE: crown ${standHead.toFixed(2)}u → ${slideHead.toFixed(2)}u ` +
    `(clearance ${clearance}), hips ${slideHips.toFixed(2)}u, knees L${(kneeL * 57.3).toFixed(0)}° R${(kneeR * 57.3).toFixed(0)}°`);
ok(slideHead < standHead - 0.5, 'slide lowers the crown well below standing',
    `(${standHead.toFixed(2)}→${slideHead.toFixed(2)})`);
ok(slideHead < clearance, 'crown clears the HIGH obstacle bar while sliding',
    `(${slideHead.toFixed(2)} < ${clearance})`);
ok(slideHips > 0.15 * scale, 'hips stay off the ground (sits into the slide, not flat)');
ok(kneeL > 0.4 || kneeR > 0.4, 'at least one knee visibly flexed (a bend, not a squash)',
    `(L${(kneeL * 57.3).toFixed(0)}° R${(kneeR * 57.3).toFixed(0)}°)`);
ok(group.scale.x === group.scale.y && group.scale.y === group.scale.z,
    'group scale stays UNIFORM — the body is never flattened',
    `(${group.scale.x.toFixed(3)},${group.scale.y.toFixed(3)},${group.scale.z.toFixed(3)})`);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
