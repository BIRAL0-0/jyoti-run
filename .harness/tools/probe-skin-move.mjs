/**
 * probe-skin-move.mjs — does moving/scaling the character group AFTER binding
 * double-apply the transform? One vertex authored at the hips bind position,
 * 100% skinned to hips; hips nudged +0.1 to fake an animation frame. The group
 * is then scaled S and moved T. Expected world = T + S·(rigPos + delta).
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const RIG_DIR = path.resolve(import.meta.dirname, '../../assets/models/rig');
const raw = fs.readFileSync(path.join(RIG_DIR, 'Med_MovementBasic.glb'));
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const HIPS = 0.406, S = 2.5, T = new THREE.Vector3(3, 1, 0);
const bonesOf = (r) => { const b = []; r.traverse((o) => { if (o.isBone) b.push(o); }); return b; };

function skinWorld(mesh, vLocal) {
    const skel = mesh.skeleton;
    const i = skel.bones.findIndex((b) => b.name === 'hips');
    const boneMat = new THREE.Matrix4().multiplyMatrices(skel.bones[i].matrixWorld, skel.boneInverses[i]);
    return vLocal.clone().applyMatrix4(mesh.bindMatrix).applyMatrix4(boneMat)
        .applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
}

async function run(mode) {
    const g = await new Promise((r, j) => new GLTFLoader().parse(buf.slice(0), '', r, j));
    const arm = g.scene;
    const bones = bonesOf(arm);
    const hips = bones.find((b) => b.name === 'hips');

    const group = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, HIPS, 0], 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([bones.indexOf(hips), 0, 0, 0], 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());

    if (mode === 'mesh-outside') {
        group.add(arm);                          // only bones under the moving group
        group.updateMatrixWorld(true);           // bind at identity
        const skel = new THREE.Skeleton(bones);
        mesh.bind(skel, new THREE.Matrix4());    // identity bindMatrix
        hips.position.y += 0.1;                  // nudge AFTER bind = animation
        group.scale.setScalar(S); group.position.copy(T);
        const worldRoot = new THREE.Group();
        worldRoot.add(group); worldRoot.add(mesh);   // mesh stays at world identity
        worldRoot.updateMatrixWorld(true);
    } else {
        group.add(arm); group.add(mesh);
        group.updateMatrixWorld(true);           // bind at identity
        const skel = new THREE.Skeleton(bones);
        if (mode === 'identity-bind') mesh.bind(skel, new THREE.Matrix4());
        else mesh.bind(skel);
        hips.position.y += 0.1;                  // nudge AFTER bind = animation
        group.scale.setScalar(S); group.position.copy(T);
        const worldRoot = new THREE.Group(); worldRoot.add(group);
        worldRoot.updateMatrixWorld(true);
    }
    const wp = skinWorld(mesh, new THREE.Vector3(0, HIPS, 0));
    const expect = new THREE.Vector3(T.x, T.y + (HIPS + 0.1) * S, T.z);
    const ok = wp.distanceTo(expect) < 0.03;
    console.log(`${mode.padEnd(14)} vertex=(${wp.x.toFixed(2)},${wp.y.toFixed(2)},${wp.z.toFixed(2)}) ` +
        `expect=(${expect.x.toFixed(2)},${expect.y.toFixed(2)},${expect.z.toFixed(2)}) ${ok ? '✓' : '✗'}`);
    return ok;
}

for (const m of ['default-bind', 'identity-bind', 'mesh-outside']) await run(m);
