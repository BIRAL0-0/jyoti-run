/**
 * inspect-rig.mjs — ground truth for the CC0 Universal Rig we animate with.
 *
 * Prints (a) the mannequin's rest-pose joint world positions, and (b) for any
 * animation clip, the world height of the key joints over time. This is what
 * the body authoring and the slide-pose assertions are calibrated against.
 *
 *   node --import ./tools/node-loader.mjs tools/inspect-rig.mjs            # everything
 *   node --import ./tools/node-loader.mjs tools/inspect-rig.mjs Running_A   # one clip
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const RIG_DIR = path.resolve(import.meta.dirname, '../../assets/models/rig');
const PACKS = ['Med_MovementBasic.glb', 'Med_MovementAdvanced.glb', 'Med_General.glb'];
const WATCH = ['root', 'hips', 'spine', 'chest', 'head',
    'upperleg.l', 'lowerleg.l', 'foot.l', 'upperleg.r', 'lowerleg.r', 'foot.r',
    'upperarm.l', 'lowerarm.l', 'upperarm.r', 'lowerarm.r'];

const only = process.argv[2];

async function parseGlb(file) {
    const data = fs.readFileSync(file);
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
}

// ---------------------------------------------------------------- rest pose
// The animation packs each carry the Rig_Medium skeleton (bones only, no
// meshes), so the bind pose can be read straight from one of them — the
// mannequin glTF (external .bin) is only the mesh reference.
const reference = await parseGlb(path.join(RIG_DIR, 'Med_MovementBasic.glb'));
{
    const root = reference.scene;
    root.updateMatrixWorld(true);
    const bones = {};
    root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    console.log(`\n=== bind pose (${Object.keys(bones).length} bones, from Med_MovementBasic.glb) ===`);
    const p = new THREE.Vector3();
    for (const name of Object.keys(bones)) {
        bones[name].getWorldPosition(p);
        console.log(`  ${name.padEnd(12)} world (x ${p.x.toFixed(3)}, y ${p.y.toFixed(3)}, z ${p.z.toFixed(3)})`);
    }
    console.log('  skins:', reference.scene.children.length, 'root children');
}
// the pose player below needs a skeleton to play clips on
const mannequin = reference;

// ------------------------------------------------------------------- clips
const clips = [];
const clipPack = new Map();          // AnimationClip.userData is undefined in r160
for (const pack of PACKS) {
    const gltf = await parseGlb(path.join(RIG_DIR, pack));
    for (const c of gltf.animations) {
        c.name = c.name.replace(/^Rig_Medium\|/, "");   // normalise clip names
        clipPack.set(c, pack);
        clips.push(c);
    }
    console.log(`\n${pack}: ${gltf.animations.length} clips — ` +
        gltf.animations.map((a) => a.name).join(', '));
}

// A rig to play clips on: reuse the mannequin (its bones carry the CC0 names).
function makePlayer() {
    const root = mannequin.scene.clone(true);
    root.updateMatrixWorld(true);
    const mixer = new THREE.AnimationMixer(root);
    const bones = {};
    root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    return { root, mixer, bones };
}

const wanted = only ? clips.filter((c) => c.name === only) : clips.filter((c) =>
    ['Running_A', 'Running_B', 'Jump_Start', 'Jump_Full_Short', 'Jump_Land',
        'Crouching', 'Dodge_Forward', 'Hit_A', 'Idle_A', 'Sneaking'].includes(c.name));

for (const clip of wanted) {
    const { root, mixer, bones } = makePlayer();
    const action = mixer.clipAction(clip);
    action.play();
    const dur = clip.duration;
    const trackBones = new Set(clip.tracks.map((t) => t.name.split('.')[0]));
    console.log(`\n=== ${clip.name} (${clipPack.get(clip)}) dur ${dur.toFixed(3)}s, ` +
        `${clip.tracks.length} tracks, ${trackBones.size} bones touched ===`);
    console.log(`    missing bones in rig: ` +
        ([...trackBones].filter((b) => !bones[b]).join(', ') || '(none)'));
    const samples = 6;
    const wp = new THREE.Vector3();
    for (let i = 0; i <= samples; i++) {
        const t = (dur * i) / samples;
        mixer.setTime(t);
        root.updateMatrixWorld(true);
        const row = WATCH.filter((n) => bones[n]).map((n) => {
            bones[n].getWorldPosition(wp);
            return `${n}=${wp.y.toFixed(2)}`;
        });
        console.log(`    t=${t.toFixed(2)}  ${row.join(' ')}`);
    }
}
