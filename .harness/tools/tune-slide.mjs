/**
 * tune-slide.mjs — sweep the procedural slide pose and report where the crown
 * lands, so CHARACTER.SLIDE can be dialled to fold the body under the HIGH
 * obstacle's 2.0 clearance while keeping the hips off the ground.
 *
 *   node --import ./tools/node-loader.mjs tools/tune-slide.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildCharacterParts } from '../../js/characters/CharacterBody.js';
import { mergeByMaterial } from '../../js/characters/skinning.js';
import { plainMaterial } from '../../js/characters/CharacterTextures.js';
import { CHARACTER } from '../../js/config.js';

const RIG = path.resolve(import.meta.dirname, '../../assets/models/rig');
const raw = fs.readFileSync(path.join(RIG, 'Med_MovementBasic.glb'));
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const gltf = await new Promise((r, j) => new GLTFLoader().parse(buf, '', r, j));

const armature = gltf.scene.clone(true);
const group = new THREE.Group(); group.add(armature); group.updateMatrixWorld(true);
const bones = []; armature.traverse((o) => { if (o.isBone) bones.push(o); });
const byName = {}; bones.forEach((b) => { byName[b.name] = b; });
const bindPos = {}; for (const b of bones) bindPos[b.name] = b.getWorldPosition(new THREE.Vector3());
const idx = new Map(); bones.forEach((b, i) => idx.set(b.name, i));
const rig = { byName, bones, index: (n) => idx.get(n) ?? 0, pos: (n) => (bindPos[n] ? bindPos[n].clone() : new THREE.Vector3()) };
const mats = Object.fromEntries(['skin', 'hair', 'shirt', 'trouser', 'sock', 'shoe', 'accent', 'backpack', 'eyeWhite', 'eyeDark', 'mouth', 'metal', 'book'].map((k) => [k, plainMaterial(0x888888)]));
const spec = { targetHeight: CHARACTER.STUDENT_HEIGHT, radial: 8, bulk: 0.9, hairStyle: 'short', sleeveLong: false, bottom: 'shorts', hasTie: false, hasBackpack: false, hasGlasses: false, hasPallu: false, teacherBook: false, materials: mats };
const merged = mergeByMaterial(buildCharacterParts(rig, spec));
const box = new THREE.Box3(); for (const { geometry } of merged) { geometry.computeBoundingBox(); box.union(geometry.boundingBox); }
const skeleton = new THREE.Skeleton(bones);
const meshes = merged.map(({ geometry, material }) => { const m = new THREE.SkinnedMesh(geometry, material); m.frustumCulled = false; group.add(m); return m; });
group.updateMatrixWorld(true); meshes.forEach((m) => m.bind(skeleton));
const scale = spec.targetHeight / box.max.y; group.scale.setScalar(scale); group.updateMatrixWorld(true);
const skullTop = (box.max.y - bindPos.head.y) * scale;   // head bone → crown, world

// stash bind quaternions to reset between poses
const bindQ = {}; for (const b of bones) bindQ[b.name] = b.quaternion.clone();
const bindHipY = byName.hips.position.y;

function evalPose(pose, rootDrop) {
    for (const b of bones) b.quaternion.copy(bindQ[b.name]);
    byName.hips.position.y = bindHipY;
    for (const [bone, xyz] of Object.entries(pose)) {
        const b = byName[bone]; if (!b) continue;
        b.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(xyz[0], xyz[1], xyz[2])));
    }
    byName.hips.position.y -= rootDrop;
    group.updateMatrixWorld(true);
    const crown = byName.head.getWorldPosition(new THREE.Vector3()).y + skullTop;
    const hips = byName.hips.getWorldPosition(new THREE.Vector3()).y;
    const knee = (s) => {
        const a = byName['upperleg' + s].getWorldPosition(new THREE.Vector3());
        const b = byName['lowerleg' + s].getWorldPosition(new THREE.Vector3());
        const c = byName['foot' + s].getWorldPosition(new THREE.Vector3());
        return (Math.PI - b.clone().sub(a).normalize().angleTo(c.clone().sub(b).normalize())) * 57.3;
    };
    return { crown, hips, kneeL: knee('l'), kneeR: knee('r') };
}

const base = CHARACTER.SLIDE.POSE;
const standing = evalPose({}, 0);
console.log(`standing crown=${standing.crown.toFixed(2)} hips=${standing.hips.toFixed(2)} (clearance 2.0)\n`);

const torso = { spine: [0.86, 0, 0], chest: [0.62, 0, 0], head: [-0.32, 0, 0], hips: [0.22, 0, 0.05] };
const legs = { upperlegl: [0.90, 0, 0.05], lowerlegl: [-0.36, 0, 0], footl: [0.10, 0, 0], upperlegr: [-1.16, 0, -0.05], lowerlegr: [1.46, 0, 0], footr: [0.30, 0, 0] };
const arms = { upperarml: [-0.70, 0, 0.55], lowerarml: [0, 0, 0.62], upperarmr: [-0.70, 0, -0.55], lowerarmr: [0, 0, -0.62] };
const full = { ...torso, ...legs, ...arms };
const candidates = {};
for (const drop of [0.20, 0.24, 0.28]) candidates[`refined drop=${drop}`] = [full, drop];
for (const [name, [pose, drop]] of Object.entries(candidates)) {
    const r = evalPose(pose, drop);
    const okc = r.crown < 2.0 ? '✓' : '✗';
    console.log(`${name.padEnd(20)} crown=${r.crown.toFixed(2)}${okc}  hips=${r.hips.toFixed(2)}  kneeL=${r.kneeL.toFixed(0)}° kneeR=${r.kneeR.toFixed(0)}°`);
}
