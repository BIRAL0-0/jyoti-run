/**
 * Player — billboard-sprite student controller
 * (spec §2 + research report §3 sprite approach).
 *
 * - THREE.Sprite with `center.set(0.5, 0)` (pivot at the feet) so ground
 *   math is trivial.
 * - Animations: run-bob + frame cycling, parabola jump, crouch-pose slide
 *   (hitbox shrinks to SLIDE_HEIGHT), damped-wobble stumble with red tint.
 * - Owns a pooled dust-puff particle system (landing / hit feedback).
 */
import * as THREE from 'three';
import { CONFIG, PLAYER, LANES } from '../config.js';
import { canvasTexture } from '../utils/AssetLoader.js';
import { generateStudentFrames, drawShadowBlob, drawDust } from '../utils/placeholderArt.js';

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

        // vertical position (feet)
        this.baseY = 0;
        this.currentY = 0;
        this._wasAirborne = false;

        // visuals (built in load())
        this.sprite = null;
        this.material = null;
        this.frames = null;            // {runA, runB, jump, slide} textures
        this.multiFrame = false;       // false when a single user PNG is used
        this.usesUserArt = false;      // true when student-character.png loaded
        this.frontTexture = null;      // optional *-front.png (view swap on turns)
        this.viewYaw = 0;              // current pseudo-3D yaw (radians)
        this.spriteAspect = PLAYER.SPRITE_WIDTH / PLAYER.SPRITE_HEIGHT;
        this.spriteW = PLAYER.SPRITE_WIDTH;   // effective (aspect-fitted) width
        this.spriteH = PLAYER.SPRITE_HEIGHT;  // effective height
        this.shadow = null;

        // dust particle pool (pre-allocated, reused forever)
        this.dust = [];
        this._dustTex = null;

        // reused collision bounds (no per-frame allocation)
        this._bounds = { x: 0, z: 0, halfW: 0, halfD: 0, yMin: 0, yMax: 0 };

        /** Optional event sink: (type: 'jump'|'land'|'slide'|'hit') => void */
        this.onEvent = null;
    }

    /**
     * Build the player sprite. `userTexture` (loaded from
     * assets/textures/student-character.png) overrides the placeholder art.
     * @param {THREE.Texture|null} userTexture
     */
    load(userTexture, frontTexture = null) {
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

        // --- aspect handling (CONFIG.PLAYER.FIT_ASPECT) ---
        // Height stays authoritative; width is derived from the source image so
        // art with an aspect other than the 3:5 plane is letterboxed instead of
        // stretched.
        this.spriteH = PLAYER.SPRITE_HEIGHT;
        this.spriteW = PLAYER.SPRITE_WIDTH;
        if (PLAYER.FIT_ASPECT && this.usesUserArt) {
            const img = this.frames.runA?.image;
            const iw = img?.width || 0;
            const ih = img?.height || 0;
            if (iw > 0 && ih > 0) {
                this.spriteAspect = iw / ih;
                this.spriteW = Math.min(
                    this.spriteH * this.spriteAspect, PLAYER.MAX_SPRITE_WIDTH);
            }
        } else {
            this.spriteAspect = PLAYER.SPRITE_WIDTH / PLAYER.SPRITE_HEIGHT;
        }

        this.material = new THREE.SpriteMaterial({
            map: this.frames.runA,
            transparent: true,
            depthWrite: false,         // avoids z-fighting halos (report §3)
        });
        this.sprite = new THREE.Sprite(this.material);
        this.sprite.center.set(0.5, 0); // pivot at the feet
        this.sprite.scale.set(this.spriteW, this.spriteH, 1);
        this.sprite.position.set(this.laneX, 0, 0);
        this.scene.add(this.sprite);

        // blob shadow (report §3: fake shadow for sprites)
        const shadowTex = canvasTexture(drawShadowBlob(), { mipmaps: false });
        this.shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(this.spriteW * 1.05, this.spriteW * 1.05),
            new THREE.MeshBasicMaterial({
                map: shadowTex, transparent: true, depthWrite: false,
            })
        );
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.position.set(this.laneX, 0.02, 0);
        this.scene.add(this.shadow);

        // dust pool
        this._dustTex = canvasTexture(drawDust(), { mipmaps: false });
        for (let i = 0; i < PLAYER.DUST_POOL_SIZE; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: this._dustTex,
                transparent: true,
                depthWrite: false,
                opacity: 0,
            }));
            sprite.visible = false;
            sprite.scale.set(0.6, 0.6, 1);
            this.scene.add(sprite);
            this.dust.push({ sprite, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, growth: 1 });
        }
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    /**
     * Switch to an adjacent lane.
     * @param {number} direction - -1 left, +1 right
     */
    switchLane(direction) {
        const next = Math.max(0, Math.min(LANES.COUNT - 1, this.targetLane + direction));
        if (next !== this.targetLane) {
            this.targetLane = next;
            this._emit('lane');
        }
    }

    /** Initiate jump (parabolic arc). */
    jump() {
        if (this.isJumping || this.isSliding || this.isStumbling) return;
        this.isJumping = true;
        this.jumpTimer = 0;
        this._wasAirborne = true;
        this._spawnDust(3, 0.5);
        this._emit('jump');
    }

    /** Initiate slide (crouch pose, low hitbox). */
    slide() {
        if (this.isJumping || this.isSliding || this.isStumbling) return;
        this.isSliding = true;
        this.slideTimer = 0;
        this._spawnDust(4, 0.7);
        this._emit('slide');
    }

    /** Trigger the stumble animation after hitting an obstacle. */
    stumble() {
        if (this.isStumbling) return;
        // cancel pending actions (a mid-air hit knocks the player down)
        this.isJumping = false;
        this.isSliding = false;
        this.isStumbling = true;
        this.stumbleTimer = 0;
        this.currentY = this.baseY;
        this._spawnDust(PLAYER.DUST_HIT_COUNT, 1, 0x8a8a8a);
        this._emit('hit');
    }

    // ------------------------------------------------------------------
    // Per-frame update
    // ------------------------------------------------------------------

    /**
     * @param {number} deltaTime
     * @param {number} gameSpeed current world speed (for anim cadence)
     */
    update(deltaTime, gameSpeed) {
        // --- smooth lane switching ---
        const targetX = LANES.POSITIONS[this.targetLane];
        const t = Math.min(1, LANES.SWITCH_SPEED * deltaTime);
        this.laneX += (targetX - this.laneX) * t;
        if (Math.abs(this.laneX - targetX) < 0.01) {
            this.laneX = targetX;
            this.currentLane = this.targetLane;
        }

        // --- vertical state machine ---
        if (this.isJumping) {
            this.jumpTimer += deltaTime;
            const progress = this.jumpTimer / PLAYER.JUMP_DURATION;
            if (progress >= 1) {
                this.isJumping = false;
                this.currentY = this.baseY;
                this._spawnDust(PLAYER.DUST_LAND_COUNT, 0.9);
                this._emit('land');
            } else {
                // parabolic trajectory (spec formula)
                this.currentY = this.baseY + PLAYER.JUMP_HEIGHT * Math.sin(progress * Math.PI);
            }
        } else if (this.isSliding) {
            this.slideTimer += deltaTime;
            if (this.slideTimer >= PLAYER.SLIDE_DURATION) {
                this.isSliding = false;
            }
        } else if (this.isStumbling) {
            this.stumbleTimer += deltaTime;
            if (this.stumbleTimer >= PLAYER.STUMBLE_DURATION) {
                this.isStumbling = false;
                this.sprite.rotation.z = 0;
            }
        }

        // --- run cycle (bob + frame swap) when free ---
        if (!this.isJumping && !this.isStumbling) {
            this.runBobTimer += deltaTime * PLAYER.RUN_BOB_SPEED;
            this.currentY = this.baseY + Math.sin(this.runBobTimer) * PLAYER.RUN_BOB_AMOUNT;
        }

        // --- stumble wobble + red tint ---
        if (this.isStumbling) {
            const p = this.stumbleTimer / PLAYER.STUMBLE_DURATION;
            // the wobble itself is applied by _updateView() through
            // material.rotation (object rotation is a no-op for THREE.Sprite)
            const tint = Math.max(0, 1 - p * 1.6);
            this.material.color.setRGB(1, 1 - 0.55 * tint, 1 - 0.55 * tint);
        } else if (this.material.color.r !== 1) {
            this.material.color.setRGB(1, 1, 1);
        }

        // --- frame selection (placeholder multi-frame art) ---
        if (this.multiFrame) {
            let tex = this.frames.runA;
            if (this.isJumping) {
                tex = this.frames.jump;
            } else if (this.isSliding) {
                tex = this.frames.slide;
            } else {
                // leg cadence scales with run speed
                const frameTime = THREE.MathUtils.clamp(0.30 - gameSpeed * 0.0045, 0.085, 0.30);
                this.frameTimer += deltaTime;
                if (this.frameTimer >= frameTime) {
                    this.frameTimer = 0;
                    this.frameIndex = 1 - this.frameIndex;
                }
                tex = this.frameIndex ? this.frames.runB : this.frames.runA;
            }
            if (this.material.map !== tex) {
                this.material.map = tex;
                this.material.needsUpdate = true;
            }
            this.sprite.scale.set(this.spriteW, this.spriteH, 1);
        } else {
            // single user PNG: spec's squash slide for visual differentiation
            if (this.isSliding) {
                const p = Math.min(1, this.slideTimer / PLAYER.SLIDE_DURATION);
                const squash = THREE.MathUtils.lerp(
                    this.spriteH, PLAYER.SLIDE_HEIGHT, Math.sin(p * Math.PI));
                this.sprite.scale.y = squash;
            } else {
                this.sprite.scale.y = this.spriteH;
            }
        }

        // --- pseudo-3D view sway (needs the optional front render) ---
        this._updateView(deltaTime);

        // --- apply transforms ---
        this.sprite.position.set(this.laneX, this.currentY, 0);

        // --- blob shadow tracks height ---
        const heightRatio = THREE.MathUtils.clamp(this.currentY / PLAYER.JUMP_HEIGHT, 0, 1);
        const shadowScale = 1 - 0.45 * heightRatio;
        this.shadow.position.x = this.laneX;
        this.shadow.scale.set(shadowScale, shadowScale, 1);
        this.shadow.material.opacity = 0.85 * shadowScale;

        this._updateDust(deltaTime);
    }

    // ------------------------------------------------------------------
    // Collision & state
    // ------------------------------------------------------------------

    /** AABB-style bounds (reused object — do not hold a reference). */
    getBounds() {
        const b = this._bounds;
        const height = this.isSliding ? PLAYER.SLIDE_HEIGHT : PLAYER.SPRITE_HEIGHT;
        b.x = this.laneX;
        b.z = 0;
        b.halfW = PLAYER.COLLISION_RADIUS / 2;
        b.halfD = PLAYER.COLLISION_RADIUS / 2;
        b.yMin = this.currentY;
        b.yMax = this.currentY + height;
        return b;
    }

    /** Current speed multiplier (reduced while stumbling). */
    getSpeedMultiplier() {
        return this.isStumbling ? PLAYER.STUMBLE_SPEED_MULT : 1.0;
    }

    /** Reset for a new game. */
    reset() {
        this.currentLane = 1;
        this.targetLane = 1;
        this.laneX = LANES.POSITIONS[1];
        this.isJumping = false;
        this.isSliding = false;
        this.isStumbling = false;
        this.jumpTimer = 0;
        this.slideTimer = 0;
        this.stumbleTimer = 0;
        this.runBobTimer = 0;
        this.frameTimer = 0;
        this.frameIndex = 0;
        this.currentY = this.baseY;
        this._wasAirborne = false;
        this.viewYaw = 0;
        if (this.material) this.material.rotation = 0;
        if (this.sprite) {
            this.sprite.rotation.z = 0;
            this.sprite.rotation.y = 0;
            this.sprite.position.set(this.laneX, 0, 0);
            this.sprite.scale.set(this.spriteW, this.spriteH, 1);
        }
        if (this.material) {
            this.material.color.setRGB(1, 1, 1);
            if (this.frontTexture && this.material.map !== this.frames.runA) {
                this.material.map = this.frames.runA;
                this.material.needsUpdate = true;
            }
        }
        for (const d of this.dust) {
            d.life = 0;
            d.sprite.visible = false;
        }
    }

    // ------------------------------------------------------------------
    // Pseudo-3D view (lane yaw + front/back render swap)
    // ------------------------------------------------------------------

    /**
     * Billboard "3D" treatment (see CONFIG.PLAYER.VIEW_*).
     *
     * THREE.Sprite quads are rebuilt in view space every frame, so:
     *   - object rotation is ignored entirely (rotation.z included),
     *   - object *scale* is honoured (non-uniform OK),
     *   - screen-space roll comes from SpriteMaterial.rotation.
     * So the turn is faked with foreshortening + roll, and the optional front
     * render takes over when the body really faces the camera (a stumble).
     */
    _updateView(deltaTime) {
        // implied turn angle from the lane offset (0 = centre lane)
        const laneOffset = this.laneX - LANES.POSITIONS[1];
        const target = PLAYER.VIEW_TURN * laneOffset;
        const rate = PLAYER.VIEW_SWAY > 0 ? PLAYER.VIEW_SWAY : 1e6;
        this.viewYaw += (target - this.viewYaw) * Math.min(1, deltaTime * rate * 6);

        // screen-space roll: lean into the turn + the stumble wobble
        const wobble = this.isStumbling
            ? Math.sin(this.stumbleTimer * 15) * 0.14
                * (1 - this.stumbleTimer / PLAYER.STUMBLE_DURATION)
            : 0;
        this.material.rotation = -this.viewYaw * PLAYER.VIEW_LEAN + wobble;

        if (!this.frontTexture) return;   // no front render -> flat card, still rolls

        // foreshorten on X so the body reads as pivoting, not sliding sideways
        const shrink = Math.max(PLAYER.VIEW_MIN_SCALE, Math.cos(this.viewYaw));
        this.sprite.scale.x = this.spriteW * shrink;

        const faceCamera = PLAYER.VIEW_STUMBLE_FRONT && this.isStumbling;
        const tex = faceCamera ? this.frontTexture : this.frames.runA;
        if (this.material.map !== tex) {
            this.material.map = tex;
            this.material.needsUpdate = true;
        }
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
            d.vz = (Math.random() * 2.2 + 0.6) * power;   // kicked backward (toward camera)
            d.growth = 1.6 + Math.random() * 1.4;
            d.sprite.position.set(
                this.laneX + (Math.random() - 0.5) * 0.8,
                0.15 + Math.random() * 0.2,
                (Math.random() - 0.5) * 0.6
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
            if (d.life <= 0) {
                d.sprite.visible = false;
                continue;
            }
            const p = d.life / d.maxLife;
            d.sprite.position.x += d.vx * deltaTime;
            d.sprite.position.y += d.vy * deltaTime;
            d.sprite.position.z += d.vz * deltaTime;
            d.vy -= 2.2 * deltaTime;                      // settle
            d.sprite.material.opacity = 0.7 * p;
            const s = d.sprite.scale.x + d.growth * deltaTime;
            d.sprite.scale.setScalar(s);
        }
    }

    _emit(type) {
        if (this.onEvent) this.onEvent(type);
    }
}
