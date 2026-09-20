/**
 * AnimController — drives a CharacterRig.
 *
 * Two layers, in this order every frame:
 *   1. the CC0 clip mixer (Running_A/B, Jump_*, Crouching, Hit_A, Idle_A …),
 *      crossfaded between states and re-timed by run speed;
 *   2. PROCEDURAL overrides blended on top — the bending slide (the whole
 *      point of Phase 3), the lane-change bank/yaw, and the stumble wobble.
 *
 * Because layer 2 runs *after* mixer.update(), it slerps each bone from the
 * clip pose toward an authored target by a 0..1 weight. At weight 1 the body is
 * fully folded into the slide; at 0 it is pure run. Nothing is ever scaled flat.
 */
import * as THREE from 'three';
import { CHARACTER } from '../config.js';
import { getClip } from './RigLibrary.js';

const MODES = ['idle', 'run', 'jump', 'fall', 'land', 'slide', 'stumble', 'grab'];

// clip that backs each mode (loop vs one-shot)
const MODE_CLIP = {
    idle: { clip: 'Idle_A', loop: true },
    run: { clip: 'Running_A', loop: true },
    jump: { clip: 'Jump_Start', loop: false, then: 'fall' },
    fall: { clip: 'Jump_Full_Short', loop: true },
    land: { clip: 'Jump_Land', loop: false, then: 'run' },
    slide: { clip: 'Crouching', loop: true },
    stumble: { clip: 'Hit_A', loop: false, then: 'run' },
    grab: { clip: 'Interact', loop: true },
};

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export class AnimController {
    /**
     * @param {object} rig {armature, byName, bones}
     */
    constructor(rig) {
        this.rig = rig;
        this.mixer = new THREE.AnimationMixer(rig.armature);
        this.actions = new Map();     // mode -> AnimationAction
        this.mode = 'idle';
        this.speed01 = 0;
        this.slideWeight = 0;
        this.bank = 0;                // lane offset for lean/yaw
        this.wobble = 0;              // 0..1 stumble
        this._crossfade = 0.18;

        // pre-build actions for every clip we can find
        for (const mode of MODES) {
            const def = MODE_CLIP[mode];
            const clip = getClip(def.clip);
            if (!clip) continue;
            const action = this.mixer.clipAction(clip);
            action.setLoop(def.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
            action.clampWhenFinished = !def.loop;
            this.actions.set(mode, action);
        }

        // one-shots auto-return to their `then` mode
        this.mixer.addEventListener('finished', (e) => {
            const mode = this._modeOfAction(e.action);
            const def = mode ? MODE_CLIP[mode] : null;
            if (def && def.then && this.mode === mode) this.setMode(def.then);
        });

        // Bake the slide targets as ABSOLUTE local quaternions = bindPose × foldDelta.
        // (The pose in CHARACTER.SLIDE.POSE was tuned as a delta on the bind pose
        //  — see .harness/tools/tune-slide.mjs — so at slideWeight 1 the body lands
        //  exactly on the tuned, clearance-clearing fold.) Bones are still at bind
        //  pose when the controller is constructed, so we can capture them here.
        this._slideTargets = {};
        for (const [bone, xyz] of Object.entries(CHARACTER.SLIDE.POSE)) {
            const b = rig.byName[bone];
            if (!b) continue;
            const delta = new THREE.Quaternion().setFromEuler(_e.set(xyz[0], xyz[1], xyz[2]));
            this._slideTargets[bone] = b.quaternion.clone().multiply(delta);
        }
        this._slideTmp = new THREE.Quaternion();
        // hips local Y at bind pose; the slide drives hips to an ABSOLUTE target
        // (bind − ROOT_DROP) so the fold height never depends on the base clip
        this._bindHipY = rig.byName.hips ? rig.byName.hips.position.y : 0.406;
        this._baseYaw = Math.PI;      // character faces −Z (away from camera)
    }

    _modeOfAction(action) {
        for (const [m, a] of this.actions) if (a === action) return m;
        return null;
    }

    /** Crossfade to a mode (no-op if already there). */
    setMode(mode) {
        if (!MODES.includes(mode)) mode = 'run';
        if (mode === this.mode) return;
        const next = this.actions.get(mode);
        if (!next) { this.mode = mode; return; }
        const prev = this.actions.get(this.mode);
        this.mode = mode;

        next.reset();
        next.setEffectiveWeight(1);
        next.play();
        if (prev && prev !== next) {
            next.crossFadeFrom(prev, this._fadeFor(mode), false);
        }
        // run gets a speed-based timeScale; keep it fresh on re-entry
        if (mode === 'run' || mode === 'slide') this._applySpeed();
    }

    _fadeFor(mode) {
        // snappier into slide/land/stumble, gentler back to run
        if (mode === 'slide' || mode === 'stumble' || mode === 'land') return 0.09;
        return this._crossfade;
    }

    setSpeed(speed01) {
        this.speed01 = THREE.MathUtils.clamp(speed01, 0, 1);
        this._applySpeed();
    }
    _applySpeed() {
        const { SPEED_SCALE_MIN, SPEED_SCALE_MAX } = CHARACTER.RUN;
        const run = this.actions.get('run');
        const slide = this.actions.get('slide');
        const ts = THREE.MathUtils.lerp(SPEED_SCALE_MIN, SPEED_SCALE_MAX, this.speed01);
        if (run) run.timeScale = ts;
        if (slide) slide.timeScale = 1.0;      // slide cadence is procedural
    }

    /** 0..1 — how folded into the slide the body is. */
    setSlideWeight(w) { this.slideWeight = THREE.MathUtils.clamp(w, 0, 1); }
    /** normalized −1..1 lean target (from lane-switch velocity). */
    setBank(v) { this.bank = THREE.MathUtils.clamp(v, -1, 1); }
    /** 0..1 stumble wobble. */
    setWobble(w) { this.wobble = THREE.MathUtils.clamp(w, 0, 1); }

    /**
     * @param {number} dt
     * @param {number} [time] accumulated time for procedural oscillators
     */
    update(dt, time = 0) {
        this.mixer.update(dt);
        this._applySlide();
        this._applyRunExtras(time);
        this._applyBankAndWobble(dt, time);
    }

    _applySlide() {
        const w = this.slideWeight;
        if (!CHARACTER.SLIDE.ENABLED) return;
        // Always slerp toward the target by w (w=0 restores the clip pose the
        // mixer just wrote, so leaving the slide is automatic).
        for (const [bone, target] of Object.entries(this._slideTargets)) {
            const b = this.rig.byName[bone];
            if (!b) continue;
            if (w <= 0.0001) continue;                 // nothing to blend
            b.quaternion.slerp(target, w);
        }
        const hips = this.rig.byName.hips;
        if (hips && w > 0) {
            // absolute target => predictable clearance regardless of base clip
            const target = this._bindHipY - CHARACTER.SLIDE.ROOT_DROP;
            hips.position.y = THREE.MathUtils.lerp(hips.position.y, target, w);
        }
    }

    _applyRunExtras(time) {
        // subtle lateral spine sway while running (adds life over the clip)
        if (this.mode !== 'run' || CHARACTER.RUN.SWAY <= 0) return;
        const spine = this.rig.byName.spine;
        if (!spine) return;
        const sway = Math.sin(time * 9) * CHARACTER.RUN.SWAY * (1 - this.slideWeight);
        _q.setFromEuler(_e.set(0, sway, sway * 0.4));
        spine.quaternion.multiply(_q);
    }

    _applyBankAndWobble(dt, time) {
        const g = this.rig.group;
        const { YAW, ROLL, RATE } = CHARACTER.BANK;
        // smooth the normalized bank toward its target
        if (this._bankSmoothed === undefined) this._bankSmoothed = 0;
        this._bankSmoothed = THREE.MathUtils.damp(this._bankSmoothed, this.bank, RATE, dt);
        const b = this._bankSmoothed;
        let yaw = this._baseYaw + b * YAW;
        let roll = -b * ROLL;
        if (this.wobble > 0) {
            const s = Math.sin(time * CHARACTER.STUMBLE.WOBBLE_SPEED);
            roll += s * CHARACTER.STUMBLE.WOBBLE * this.wobble;
            yaw += Math.cos(time * 11) * 0.08 * this.wobble;
        }
        g.rotation.set(0, yaw, roll);
    }
}
