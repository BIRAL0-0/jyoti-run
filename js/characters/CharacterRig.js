/**
 * CharacterRig — assembles a playable 3D character:
 *   CC0 bone armature  +  authored skinned body  +  AnimController.
 *
 * `createCharacter(spec)` returns a rig (or null if the CC0 library failed to
 * load, so callers can fall back to sprites). The rig's `.group` is the object
 * the game adds to the scene and positions each frame; `.scale` is set once so
 * the standing crown equals `spec.targetHeight` world units (feet at y=0).
 *
 * Bind order matters (verified in .harness/tools/probe-skin-move.mjs): assemble
 * at identity, bind, THEN apply the constant group scale — a SkinnedMesh under a
 * uniformly scaled + freely moved parent transforms exactly once.
 */
import * as THREE from 'three';
import { createArmature } from './RigLibrary.js';
import { buildCharacterParts } from './CharacterBody.js';
import { mergeByMaterial } from './skinning.js';
import { AnimController } from './AnimController.js';

const _wp = new THREE.Vector3();

export class CharacterRig {
    constructor({ group, armature, meshes, skeleton, byName, bones, anim, scale, targetHeight }) {
        this.group = group;
        this.armature = armature;
        this.meshes = meshes;
        this.skeleton = skeleton;
        this.byName = byName;
        this.bones = bones;
        this.anim = anim;
        this.scale = scale;
        this.targetHeight = targetHeight;
        this.visible = true;
    }

    // --- animation intent (delegated) ---
    setMode(mode) { this.anim.setMode(mode); }
    setSpeed(speed01) { this.anim.setSpeed(speed01); }
    setBank(v) { this.anim.setBank(v); }
    setSlideWeight(w) { this.anim.setSlideWeight(w); }
    setWobble(w) { this.anim.setWobble(w); }
    setBaseYaw(yaw) { this.anim._baseYaw = yaw; }

    /** @param {number} dt @param {number} time accumulated seconds */
    update(dt, time) { this.anim.update(dt, time); }

    setVisible(v) { this.visible = v; this.group.visible = v; }

    /** Opacity fade (teacher): walks every material. */
    setOpacity(o) {
        for (const m of this.meshes) {
            m.material.transparent = o < 1;
            m.material.opacity = o;
            m.material.depthWrite = o >= 1;
        }
    }

    /** World Y of the head bone (post-update). Used by the slide-bend test. */
    getHeadWorldY() {
        const h = this.byName.head;
        if (!h) return 0;
        h.getWorldPosition(_wp);
        return _wp.y;
    }

    /** Approximate standing/sitting crown height in world units right now. */
    getCrownWorldY() {
        // head bone + ~0.29 rig units of skull/hair, scaled
        return this.getHeadWorldY() + 0.29 * this.scale;
    }

    /** Local knee flexion (radians) — the slide must bend, not flatten. */
    getKneeFlexion(side = 'l') {
        const thigh = this.byName['upperleg' + side];
        const shin = this.byName['lowerleg' + side];
        if (!thigh || !shin) return 0;
        // angle between thigh and shin bone directions
        const a = new THREE.Vector3(), b = new THREE.Vector3();
        thigh.getWorldPosition(a); shin.getWorldPosition(b);
        const kneeDir = b.clone().sub(a).normalize();
        const foot = this.byName['foot' + side];
        const c = new THREE.Vector3(); foot.getWorldPosition(c);
        const shinDir = c.clone().sub(b).normalize();
        return Math.PI - kneeDir.angleTo(shinDir);
    }

    dispose() {
        for (const m of this.meshes) {
            m.geometry.dispose();
        }
        this.anim?.mixer?.stopAllAction();
        this.group.removeFromParent();
    }
}

/**
 * Build a character from a wardrobe/proportion spec.
 * @param {object} spec (see CharacterFactory.studentSpec/teacherSpec)
 * @returns {CharacterRig|null}
 */
export function createCharacter(spec) {
    const armature = createArmature();
    if (!armature) return null;

    const group = new THREE.Group();
    group.add(armature);
    group.updateMatrixWorld(true);       // bind pose, identity transform

    // collect bones (skeleton order == skinIndex space)
    const bones = [];
    armature.traverse((o) => { if (o.isBone) bones.push(o); });
    const byName = {};
    const nameToIndex = new Map();
    bones.forEach((b, i) => { byName[b.name] = b; nameToIndex.set(b.name, i); });

    // bind-space positions (group is identity + scale 1 right now)
    const bindPos = {};
    for (const b of bones) { bindPos[b.name] = b.getWorldPosition(new THREE.Vector3()); }

    const rig = {
        byName,
        bones,
        index: (name) => (nameToIndex.has(name) ? nameToIndex.get(name) : 0),
        pos: (name) => (bindPos[name] ? bindPos[name].clone() : new THREE.Vector3()),
    };

    // author + merge the body
    const parts = buildCharacterParts(rig, spec);
    const merged = mergeByMaterial(parts);
    if (!merged.length) return null;

    // crown measured from the raw bind-space geometry (the SkinnedMesh can't be
    // box-tested until it is bound, so read the source positions directly)
    const box = new THREE.Box3();
    for (const { geometry } of merged) {
        geometry.computeBoundingBox();
        box.union(geometry.boundingBox);
    }

    const skeleton = new THREE.Skeleton(bones);
    const meshes = [];
    for (const { geometry, material } of merged) {
        material.side = THREE.FrontSide;
        const mesh = new THREE.SkinnedMesh(geometry, material);
        mesh.castShadow = spec.castShadow !== false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;      // skinning moves verts outside the static bounds
        group.add(mesh);
        meshes.push(mesh);
    }
    group.updateMatrixWorld(true);
    for (const mesh of meshes) mesh.bind(skeleton);   // bindMatrix = identity (group at identity)

    // scale so the crown (bind-space maxY) reaches the target world height.
    // box was measured at scale 1, so maxY is in rig units.
    const crown = Math.max(0.1, box.max.y);
    const scale = spec.targetHeight / crown;
    group.scale.setScalar(scale);
    group.updateMatrixWorld(true);

    const anim = new AnimController({ armature, byName, bones, group });
    anim.setMode('idle');

    return new CharacterRig({
        group, armature, meshes, skeleton, byName, bones, anim, scale,
        targetHeight: spec.targetHeight,
    });
}
