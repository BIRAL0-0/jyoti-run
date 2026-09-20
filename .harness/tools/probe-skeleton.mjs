/**
 * probe-skeleton.mjs — how does GLTFLoader hand us the CC0 rig?
 * Bone types, hierarchy, root orientation, and whether a SkinnedMesh can be
 * bound to the imported bones. One-off; kept for re-verification.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const RIG_DIR = path.resolve(import.meta.dirname, '../../assets/models/rig');
const data = fs.readFileSync(path.join(RIG_DIR, 'Med_MovementBasic.glb'));
const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));

const scene = gltf.scene;
scene.updateMatrixWorld(true);

console.log('--- object tree ---');
scene.traverse((o) => {
    const kind = o.isBone ? 'Bone' : o.isSkinnedMesh ? 'SkinnedMesh' : o.type;
    const wp = new THREE.Vector3(); o.getWorldPosition(wp);
    console.log(`${'  '.repeat(depthOf(o))}${o.name || '(anon)'} [${kind}] worldY=${wp.y.toFixed(3)}`);
});
function depthOf(o) { let d = 0, p = o.parent; while (p) { d++; p = p.parent; } return d; }

const bones = [];
scene.traverse((o) => { if (o.isBone) bones.push(o); });
console.log(`\n--- ${bones.length} bones ---`);
console.log('names:', bones.map((b) => b.name).join(', '));
const root = bones.find((b) => b.name === 'root');
console.log('root.parent:', root.parent?.name, '| root quat:',
    root.quaternion.toArray().map((n) => n.toFixed(3)).join(','));

// track names in a clip
const clip = gltf.animations.find((a) => a.name.endsWith('Running_A'));
const names = new Set(clip.tracks.map((t) => t.name));
console.log('\nRunning_A track targets:', [...names].join(' | '));
console.log('sample track names:', clip.tracks.slice(0, 6).map((t) => t.name).join(', '));

// can we build a Skeleton and bind a trivial SkinnedMesh?
const skel = new THREE.Skeleton(bones);
const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6);
const posCount = geo.attributes.position.count;
const si = new Uint16Array(posCount * 4);
const sw = new Float32Array(posCount * 4);
const hipsIdx = bones.indexOf(bones.find((b) => b.name === 'hips'));
for (let i = 0; i < posCount; i++) { si[i * 4] = hipsIdx; sw[i * 4] = 1; }
geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
mesh.add(root);
mesh.bind(skel);
console.log('\nbind OK — skeleton bones:', mesh.skeleton.bones.length,
    '| boneInverses:', mesh.skeleton.boneInverses.length);

// play one frame and confirm the hips move the mesh
const mixer = new THREE.AnimationMixer(mesh);
mixer.clipAction(clip).play();
mixer.setTime(0.28);
mesh.updateMatrixWorld(true);
const hipWP = new THREE.Vector3(); bones.find((b) => b.name === 'hips').getWorldPosition(hipWP);
console.log('hips worldY after setTime(0.28):', hipWP.y.toFixed(3), '(expect ~0.35, bobbing)');
