/**
 * Player — the runner. Two visual back-ends behind one gameplay contract:
 *
 *   MODE '3d'     — a real skinned character (js/characters/) on the CC0 rig:
 *                   running from Running_A, and a *bending* slide (the body
 *                   folds at hips/knees/spine; never squashed flat).
 *   MODE 'sprite' — the original billboard sprite (fallback + aspect tests).
 *
 * Gameplay state (lanes, jump parabola, slide/stumble timers, hitboxes, dust)
 * is identical in both modes; only presentation differs. `getBounds()` is
 * unchanged so obstacle/collectible collisions behave exactly as before.
 */
import * as THREE from 'three';
import { CONFIG, PLAYER, LANES, GROUND, CHARACTER } from '../config.js';
import { canvasTexture } from '../utils/AssetLoader.js';
import { generateStudentFrames, drawShadowBlob, drawDust } from '../utils/placeholderArt.js';
import { createCharacter } from '../characters/CharacterRig.js';
import { studentSpec } from '../characters/CharacterFactory.js';

export class Player {
    /** @param {THREE.Scene} scene */
    constructor(scene) {
        this.scene = scene;

        // lane state
        this.currentLane = 1;          // 0=left, 1=center, 2=right
        this.targetLane = 1;
        this.laneX = LANES.POSITIONS[1];

        // movement state
        this.isJumping = false;
        this.isSliding = false;
        this.isStumbling = false;

        // animation timers
        this.jumpTimer = 0;
        this.slideTimer = 0;
        this.stumbleTimer = 0;
        this.runBobTimer = 0;
        this.frameTimer = 0;
        this.frameIndex = 0;
        this._time = 0;                // wall clock for procedural oscillators
        this.slideWeight = 0;          // 0..1 fold amount for the 3D slide
        this._landTimer = 0;

        // vertical position (feet)
        this.baseY = 0;
        this.currentY = 0;
        this._wasAirborne = false;

        // visuals (built in load())
        this.charRig = null;           // 3D character (MODE '3d')
        this.charMode = 'sprite';
        this.sprite = null;
        this.material = null;
        this.frames = null;
        this.multiFrame = false;
        this.usesUserArt = false;
        this.frontTexture = null;
        this.viewYaw = 0;
        this.spriteAspect = PLAYER.SPRITE_WIDTH / PLAYER.SPRITE_HEIGHT;
        this.spriteW = PLAYER.SPRITE_WIDTH;
        this.spriteH = PLAYER.SPRITE_HEIGHT;
        this.shadow = null;

        // dust particle pool (pooled sprites, reused forever)
        this.dust = [];
        this._dustTex = null;

        // reused collision bounds (no per-frame allocation)
        this._bounds = { x: 0, z: 0, halfW: 0, halfD: 0, yMin: 0, yMax: 0 };

        /** Optional event sink: (type) => void */
        this.onEvent = null;
    }

    /**
     * Build the visual. `charMode` picks the back-end.
     * @param {THREE.Texture|null} userTexture
     * @param {THREE.Texture|null} frontTexture
     * @param {{charMode?:'3d'|'sprite'}} [opts]
     */
    load(userTexture, frontTexture = null, opts = {}) {
        this.charMode = opts.charMode === '3d' ? '3d' : 'sprite';

        if (this.charMode === '3d') {
            this.charRig = createCharacter(studentSpec());
            if (this.charRig) {
                this.scene.add(this.charRig.group);
                this.charRig.group.position.set(this.laneX, 0, 0);
                this.charRig.setMode('run');
            } else {
                this.charMode = 'sprite';      // rig unavailable -> fall back
            }
        }

        if (this.charMode === 'sprite') {
            this._loadSprite(userTexture, frontTexture);
        }

        // dust pool (shared by both modes)
        this._dustTex = canvasTexture(drawDust(), { mipmaps: false });
        for (let i = 0; i < PLAYER.DUST_POOL_SIZE; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: this._dustTex, transparent: true, depthWrite: false, opacity: 0,
            }));
            sprite.visible = false;
            sprite.scale.set(0.6, 0.6, 1);
            this.scene.add(sprite);
            this.dust.push({ sprite, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, growth: 1 });
        }
    }

    _loadSprite(userTexture, frontTexture) {
        if (userTexture) {
            this.frames = { runA: userTexture, runB: userTexture, jump: userTexture, slide: userTexture };
            this.multiFrame = false;
            this.usesUserArt = true;
            this.frontTexture = frontTexture || null;
        } else {
            const art = generateStudentFrames();
            this.frames = {
                runA: canvasTexture(art.runA, { mipmaps: false }),
                runB: canvasTexture(art.runB, { mipmaps: false }),
                jump: canvasTexture(art.jump, { mipmaps: false }),
                slide: canvasTexture(art.slide, { mipmaps: false }),
            };
            this.multiFrame = true;
            this.usesUserArt = false;
            this.frontTexture = null;
        }

        this.spriteH = PLAYER.SPRITE_HEIGHT;
        this.spriteW = PLAYER.SPRITE_WIDTH;
        if (PLAYER.FIT_ASPECT && this.usesUserArt) {
            const img = this.frames.runA?.image;
            const iw = img?.width || 0, ih = img?.height || 0;
            if (iw > 0 && ih > 0) {
                this.spriteAspect = iw / ih;
                this.spriteW = Math.min(this.spriteH * this.spriteAspect, PLAYER.MAX_SPRITE_WIDTH);
            }
        } else {
            this.spriteAspect = PLAYER.SPRITE_WIDTH / PLAYER.SPRITE_HEIGHT;
        }

        this.material = new THREE.SpriteMaterial({
            map: this.frames.runA, transparent: true, depthWrite: false,
        });
        this.sprite = new THREE.Sprite(this.material);
        this.sprite.center.set(0.5, 0);
        this.sprite.scale.set(this.spriteW, this.spriteH, 1);
        this.sprite.position.set(this.laneX, 0, 0);
        this.scene.add(this.sprite);

        const shadowTex = canvasTexture(drawShadowBlob(), { mipmaps: false });
        this.shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(this.spriteW * 1.05, this.spriteW * 1.05),
            new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
        );
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.position.set(this.laneX, 0.02, 0);
        this.scene.add(this.shadow);
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------
    switchLane(direction) {
        const next = Math.max(0, Math.min(LANES.COUNT - 1, this.targetLane + direction));
        if (next !== this.targetLane) { this.targetLane = next; this._emit('lane'); }
    }

    jump() {
        if (this.isJumping || this.isSliding || this.isStumbling) return;
        this.isJumping = true;
        this.jumpTimer = 0;
        this._wasAirborne = true;
        this._spawnDust(3, 0.5);
        this._emit('jump');
    }

    slide() {
        if (this.isJumping || this.isSliding || this.isStumbling) return;
        this.isSliding = true;
        this.slideTimer = 0;
        this._spawnDust(4, 0.7);
        this._emit('slide');
    }

    stumble() {
        if (this.isStumbling) return;
        this.isJumping = false;
        this.isSliding = false;
        this.slideWeight = 0;
        this.isStumbling = true;
        this.stumbleTimer = 0;
        this.currentY = this.baseY;
        this._spawnDust(PLAYER.DUST_HIT_COUNT, 1, 0x8a8a8a);
        this._emit('hit');
    }

    // ------------------------------------------------------------------
    // Per-frame update
    // ------------------------------------------------------------------
    update(deltaTime, gameSpeed) {
        this._time += deltaTime;

        // --- smooth lane switching ---
        const targetX = LANES.POSITIONS[this.targetLane];
        const t = Math.min(1, LANES.SWITCH_SPEED * deltaTime);
        const prevLaneX = this.laneX;
        this.laneX += (targetX - this.laneX) * t;
        if (Math.abs(this.laneX - targetX) < 0.01) { this.laneX = targetX; this.currentLane = this.targetLane; }
        const laneVel = (this.laneX - prevLaneX) / Math.max(1e-4, deltaTime);

        // --- vertical state machine ---
        if (this.isJumping) {
            this.jumpTimer += deltaTime;
            const progress = this.jumpTimer / PLAYER.JUMP_DURATION;
            if (progress >= 1) {
                this.isJumping = false;
                this.currentY = this.baseY;
                this._landTimer = 0.18;
                this._spawnDust(PLAYER.DUST_LAND_COUNT, 0.9);
                this._emit('land');
            } else {
                this.currentY = this.baseY + PLAYER.JUMP_HEIGHT * Math.sin(progress * Math.PI);
            }
        } else if (this.isSliding) {
            this.slideTimer += deltaTime;
            if (this.slideTimer >= PLAYER.SLIDE_DURATION) this.isSliding = false;
        } else if (this.isStumbling) {
            this.stumbleTimer += deltaTime;
            if (this.stumbleTimer >= PLAYER.STUMBLE_DURATION) {
                this.isStumbling = false;
                if (this.material) this.material.rotation = 0;
            }
        }
        if (this._landTimer > 0) this._landTimer -= deltaTime;

        // --- run bob (sprite mode only; the 3D clip carries its own bob) ---
        if (!this.charRig && !this.isJumping && !this.isStumbling) {
            this.runBobTimer += deltaTime * PLAYER.RUN_BOB_SPEED;
            this.currentY = this.baseY + Math.sin(this.runBobTimer) * PLAYER.RUN_BOB_AMOUNT;
        }

        // --- slide fold envelope (drives the 3D bend; sprite uses squash) ---
        this._updateSlideWeight(deltaTime);

        if (this.charRig) this._updateRig(deltaTime, gameSpeed, laneVel);
        else this._updateSprite(deltaTime, gameSpeed);

        this._updateDust(deltaTime);
    }

    /** Ease slideWeight 0→1 on entry, hold, 1→0 on exit (config blend times). */
    _updateSlideWeight(dt) {
        const { BLEND_IN, BLEND_OUT } = CHARACTER.SLIDE;
        if (this.isSliding) {
            const rampIn = this.slideTimer / BLEND_IN;
            this.slideWeight = Math.min(1, this.slideWeight + dt / BLEND_IN);
            void rampIn;
        } else if (this.slideWeight > 0) {
            this.slideWeight = Math.max(0, this.slideWeight - dt / BLEND_OUT);
        }
    }

    /** 3D back-end: pose + place the skinned character. */
    _updateRig(dt, gameSpeed, laneVel) {
        const rig = this.charRig;
        // state → animation mode
        let mode = 'run';
        if (this.isStumbling) mode = 'stumble';
        else if (this.isSliding) mode = 'slide';
        else if (this.isJumping) mode = (this.jumpTimer < PLAYER.JUMP_DURATION * 0.45) ? 'jump' : 'fall';
        else if (this._landTimer > 0) mode = 'land';
        rig.setMode(mode);

        const speed01 = THREE.MathUtils.clamp(
            (gameSpeed - GROUND.INITIAL_SPEED) / (GROUND.MAX_SPEED - GROUND.INITIAL_SPEED), 0, 1);
        rig.setSpeed(speed01);
        rig.setSlideWeight(CHARACTER.SLIDE.ENABLED ? this.slideWeight : 0);
        rig.setBank(THREE.MathUtils.clamp(laneVel * 0.09, -1, 1));
        rig.setWobble(this.isStumbling
            ? Math.max(0, 1 - this.stumbleTimer / PLAYER.STUMBLE_DURATION) : 0);
        rig.update(dt, this._time);

        rig.group.position.set(this.laneX, this.currentY, 0);
    }

    /** Sprite back-end (unchanged behaviour from the pre-3D build). */
    _updateSprite(deltaTime, gameSpeed) {
        // stumble wobble + red tint
        if (this.isStumbling) {
            const p = this.stumbleTimer / PLAYER.STUMBLE_DURATION;
            const tint = Math.max(0, 1 - p * 1.6);
            this.material.color.setRGB(1, 1 - 0.55 * tint, 1 - 0.55 * tint);
        } else if (this.material.color.r !== 1) {
            this.material.color.setRGB(1, 1, 1);
        }

        if (this.multiFrame) {
            let tex = this.frames.runA;
            if (this.isJumping) tex = this.frames.jump;
            else if (this.isSliding) tex = this.frames.slide;
            else {
                const frameTime = THREE.MathUtils.clamp(0.30 - gameSpeed * 0.0045, 0.085, 0.30);
                this.frameTimer += deltaTime;
                if (this.frameTimer >= frameTime) { this.frameTimer = 0; this.frameIndex = 1 - this.frameIndex; }
                tex = this.frameIndex ? this.frames.runB : this.frames.runA;
            }
            if (this.material.map !== tex) { this.material.map = tex; this.material.needsUpdate = true; }
            this.sprite.scale.set(this.spriteW, this.spriteH, 1);
        } else if (this.isSliding) {
            const p = Math.min(1, this.slideTimer / PLAYER.SLIDE_DURATION);
            this.sprite.scale.y = THREE.MathUtils.lerp(this.spriteH, PLAYER.SLIDE_HEIGHT, Math.sin(p * Math.PI));
        } else {
            this.sprite.scale.y = this.spriteH;
        }

        this._updateView(deltaTime);
        this.sprite.position.set(this.laneX, this.currentY, 0);

        const heightRatio = THREE.MathUtils.clamp(this.currentY / PLAYER.JUMP_HEIGHT, 0, 1);
        const shadowScale = 1 - 0.45 * heightRatio;
        this.shadow.position.x = this.laneX;
        this.shadow.scale.set(shadowScale, shadowScale, 1);
        this.shadow.material.opacity = 0.85 * shadowScale;
    }

    _updateView(deltaTime) {
        const laneOffset = this.laneX - LANES.POSITIONS[1];
        const target = PLAYER.VIEW_TURN * laneOffset;
        const rate = PLAYER.VIEW_SWAY > 0 ? PLAYER.VIEW_SWAY : 1e6;
        this.viewYaw += (target - this.viewYaw) * Math.min(1, deltaTime * rate * 6);
        const wobble = this.isStumbling
            ? Math.sin(this.stumbleTimer * 15) * 0.14 * (1 - this.stumbleTimer / PLAYER.STUMBLE_DURATION)
            : 0;
        this.material.rotation = -this.viewYaw * PLAYER.VIEW_LEAN + wobble;
        if (!this.frontTexture) return;
        const shrink = Math.max(PLAYER.VIEW_MIN_SCALE, Math.cos(this.viewYaw));
        this.sprite.scale.x = this.spriteW * shrink;
        const faceCamera = PLAYER.VIEW_STUMBLE_FRONT && this.isStumbling;
        const tex = faceCamera ? this.frontTexture : this.frames.runA;
        if (this.material.map !== tex) { this.material.map = tex; this.material.needsUpdate = true; }
    }

    // ------------------------------------------------------------------
    // Collision & state
    // ------------------------------------------------------------------
    getBounds() {
        const b = this._bounds;
        const height = this.isSliding ? PLAYER.SLIDE_HEIGHT : PLAYER.SPRITE_HEIGHT;
        b.x = this.laneX; b.z = 0;
        b.halfW = PLAYER.COLLISION_RADIUS / 2;
        b.halfD = PLAYER.COLLISION_RADIUS / 2;
        b.yMin = this.currentY;
        b.yMax = this.currentY + height;
        return b;
    }

    getSpeedMultiplier() { return this.isStumbling ? PLAYER.STUMBLE_SPEED_MULT : 1.0; }

    reset() {
        this.currentLane = 1; this.targetLane = 1; this.laneX = LANES.POSITIONS[1];
        this.isJumping = false; this.isSliding = false; this.isStumbling = false;
        this.jumpTimer = 0; this.slideTimer = 0; this.stumbleTimer = 0;
        this.runBobTimer = 0; this.frameTimer = 0; this.frameIndex = 0;
        this.currentY = this.baseY; this._wasAirborne = false;
        this.viewYaw = 0; this.slideWeight = 0; this._landTimer = 0;
        if (this.charRig) {
            this.charRig.setMode('run');
            this.charRig.setSlideWeight(0);
            this.charRig.setWobble(0);
            this.charRig.setBank(0);
            this.charRig.group.position.set(this.laneX, 0, 0);
        }
        if (this.material) this.material.rotation = 0;
        if (this.sprite) {
            this.sprite.rotation.z = 0; this.sprite.rotation.y = 0;
            this.sprite.position.set(this.laneX, 0, 0);
            this.sprite.scale.set(this.spriteW, this.spriteH, 1);
        }
        if (this.material) {
            this.material.color.setRGB(1, 1, 1);
            if (this.frontTexture && this.material.map !== this.frames.runA) {
                this.material.map = this.frames.runA; this.material.needsUpdate = true;
            }
        }
        for (const d of this.dust) { d.life = 0; d.sprite.visible = false; }
    }

    // ------------------------------------------------------------------
    // Dust puffs
    // ------------------------------------------------------------------
    _spawnDust(count, power, tint = 0xffffff) {
        let spawned = 0;
        for (const d of this.dust) {
            if (d.life > 0) continue;
            d.life = d.maxLife = PLAYER.DUST_LIFETIME * (0.7 + Math.random() * 0.5);
            d.vx = (Math.random() - 0.5) * 3 * power;
            d.vy = (0.8 + Math.random() * 1.6) * power;
            d.vz = (Math.random() * 2.2 + 0.6) * power;
            d.growth = 1.6 + Math.random() * 1.4;
            d.sprite.position.set(
                this.laneX + (Math.random() - 0.5) * 0.8,
                0.15 + Math.random() * 0.2,
                (Math.random() - 0.5) * 0.6,
            );
            d.sprite.material.opacity = 0.75;
            d.sprite.material.color.setHex(tint);
            d.sprite.scale.setScalar(0.5 + Math.random() * 0.4);
            d.sprite.visible = true;
            if (++spawned >= count) break;
        }
    }

    _updateDust(deltaTime) {
        for (const d of this.dust) {
            if (d.life <= 0) continue;
            d.life -= deltaTime;
            if (d.life <= 0) { d.sprite.visible = false; continue; }
            const p = d.life / d.maxLife;
            d.sprite.position.x += d.vx * deltaTime;
            d.sprite.position.y += d.vy * deltaTime;
            d.sprite.position.z += d.vz * deltaTime;
            d.vy -= 2.2 * deltaTime;
            d.sprite.material.opacity = 0.7 * p;
            const s = d.sprite.scale.x + d.growth * deltaTime;
            d.sprite.scale.setScalar(s);
        }
    }

    _emit(type) { if (this.onEvent) this.onEvent(type); }
}
