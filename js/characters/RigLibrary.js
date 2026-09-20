/**
 * RigLibrary — loads the CC0 KayKit "Universal Rig" animation packs once and
 * hands out (a) fresh clones of the bone armature and (b) the animation clips.
 *
 * Assets: assets/models/rig/*.glb (animation-only GLBs, 23-bone Rig_Medium
 * skeleton). Provenance + license: assets/models/rig/SOURCES.md, CC0-1.0.
 *
 * Everything here is defensive: if the GLBs are missing or GLTFLoader is
 * unavailable, init() resolves to null and the game falls back to sprites.
 */
import * as THREE from 'three';
import { CHARACTER } from '../config.js';

let GLTFLoader = null;
try {
    // Optional at module scope so a missing addon never breaks the sprite path.
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
} catch (e) {
    console.warn('[RigLibrary] GLTFLoader unavailable — sprite fallback.', e?.message || e);
}

let _lib = null;          // { template, clips:Map<name,AnimationClip>, boneNames }
let _promise = null;

/** Strip the armature-wrapper tracks (Rig_Medium.*) that have no target bone. */
function stripArmatureTracks(clip) {
    const tracks = clip.tracks.filter((t) => !/^Rig_Medium[.|]/.test(t.name));
    const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
    return out;
}

async function load() {
    if (!GLTFLoader) return null;
    const loader = new GLTFLoader();
    const clips = new Map();
    let template = null;

    for (const url of CHARACTER.RIG_PACKS) {
        let gltf = null;
        try {
            gltf = await loader.loadAsync(url);
        } catch (e) {
            console.warn(`[RigLibrary] could not load ${url}:`, e?.message || e);
            continue;
        }
        if (!gltf) continue;
        if (!template && gltf.scene) template = gltf.scene;
        for (const c of gltf.animations || []) {
            const name = c.name.replace(/^Rig_Medium\|/, '');
            clips.set(name, stripArmatureTracks(c));
        }
    }

    if (!template) return null;

    // Confirm the armature really carries bones before we commit to 3D mode.
    const boneNames = [];
    template.traverse((o) => { if (o.isBone) boneNames.push(o.name); });
    if (boneNames.length < 15) {
        console.warn('[RigLibrary] armature has too few bones:', boneNames.length);
        return null;
    }

    _lib = { template, clips, boneNames };
    return _lib;
}

/**
 * Load (once) and resolve to the library, or null if unavailable.
 * @returns {Promise<{template:THREE.Object3D, clips:Map<string,THREE.AnimationClip>, boneNames:string[]}|null>}
 */
export function initRigLibrary() {
    if (_lib) return Promise.resolve(_lib);
    if (!_promise) _promise = load().catch((e) => {
        console.warn('[RigLibrary] init failed:', e?.message || e);
        return null;
    });
    return _promise;
}

/** True once a usable rig is loaded. */
export function rigAvailable() {
    return !!(_lib && _lib.template);
}

/**
 * A deep clone of the bone armature (each character needs its own bones).
 * @returns {THREE.Object3D|null}
 */
export function createArmature() {
    if (!_lib) return null;
    const arm = _lib.template.clone(true);
    // bones must keep auto-update so the mixer can drive them
    arm.traverse((o) => { if (o.isBone) o.matrixAutoUpdate = true; });
    return arm;
}

/** @param {string} name @returns {THREE.AnimationClip|undefined} */
export function getClip(name) {
    return _lib?.clips.get(name);
}

/** All loaded clip names (debug/tests). */
export function clipNames() {
    return _lib ? [..._lib.clips.keys()] : [];
}
