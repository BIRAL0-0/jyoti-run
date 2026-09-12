/**
 * Teacher — the signature chase mechanic
 * (spec §3 + research report §4.4 state machine & fairness guards).
 *
 * States: HIDDEN -> CHASING -> FADING_OUT -> HIDDEN
 *                      \------> CAUGHT (3rd mistake or sustained contact)
 *
 * Fairness guards (report §4.4):
 *  - No catch checks during the fade-in grace window.
 *  - Catch requires <= CATCH_DISTANCE sustained for CATCH_SUSTAIN seconds.
 *  - Lunge grace: contact while the player is mid-jump/slide holds the
 *    teacher at LUNGE_GRACE_DISTANCE for at most LUNGE_GRACE_TIME.
 *  - Mistake decay: -1 mistake per MISTAKE_DECAY_METERS of clean running.
 *  - Recovery: RECOVERY_DISTANCE clean metres fades her out completely.
 *
 * Positioning note: the world scrolls toward the camera while the player
 * stays at z = 0, so "behind the player" is POSITIVE z (between the player
 * and the camera). She spawns just in front of the camera and closes in.
 */
import * as THREE from 'three';
import { CONFIG, TEACHER, PLAYER, CAMERA } from '../config.js';
import { canvasTexture } from '../utils/AssetLoader.js';
import { generateTeacherFrames, drawShadowBlob } from '../utils/placeholderArt.js';

export const TeacherState = Object.freeze({
    HIDDEN: 'HIDDEN',
    CHASING: 'CHASING',
    FADING_OUT: 'FADING_OUT',
    CAUGHT: 'CAUGHT',
});

export class Teacher {
    /** @param {THREE.Scene} scene */
    constructor(scene) {
        this.scene = scene;
        this.state = TeacherState.HIDDEN;

        // visibility
        this.isVisible = false;
        this.opacity = 0;
        this.fadeTimer = 0;
        this.fadeDirection = 1;        // 1 = in, -1 = out

        // distance behind the player (positive z toward the camera)
        this.distanceFromPlayer = TEACHER.APPEAR_DISTANCE;
        this.targetDistance = TEACHER.MENACE_DISTANCE;
        // spawn far enough in front of the camera to be visible immediately
        this.spawnDistance = Math.min(
            TEACHER.APPEAR_DISTANCE,
            Math.max(4, CAMERA.POSITION_OFFSET.z - TEACHER.SPAWN_MARGIN)
        );

        // mistake tracking
        this.mistakeCount = 0;
        this.cleanMeters = 0;          // since last mistake (drives aggro decay)
        this.decayMeters = 0;          // since last mistake decay
        this.surgeTimer = 0;           // extra closing speed right after a surge

        // catch helpers
        this.closeTimer = 0;           // sustained proximity timer
        this.graceTimer = 0;           // lunge-grace budget
        this.catchDone = false;        // 'CAUGHT' emitted exactly once
        this.fadeInDone = false;

        // animation
        this.runBobTimer = 0;
        this.frameTimer = 0;
        this.frameIndex = 0;
        this.multiFrame = false;

        // visuals
        this.sprite = null;
        this.material = null;
        this.frames = null;
        this.usesUserArt = false;      // true when teacher-character.png loaded
        this.spriteAspect = TEACHER.SPRITE_WIDTH / TEACHER.SPRITE_HEIGHT;
        this.spriteW = TEACHER.SPRITE_WIDTH;   // effective (aspect-fitted) width
        this.spriteH = TEACHER.SPRITE_HEIGHT;  // effective height
        this.shadow = null;

        /** Optional event sink: (type: 'appear'|'surge'|'caught') => void */
        this.onEvent = null;
    }

    /**
     * Build the sprite. `userTexture` (assets/textures/teacher-character.png)
     * overrides the placeholder art.
     */
    load(userTexture) {
        if (userTexture) {
            this.frames = { runA: userTexture, runB: userTexture, grab: userTexture };
            this.multiFrame = false;
            this.usesUserArt = true;
        } else {
            const art = generateTeacherFrames();
            this.frames = {
                runA: canvasTexture(art.runA, { mipmaps: false }),
                runB: canvasTexture(art.runB, { mipmaps: false }),
                grab: canvasTexture(art.grab, { mipmaps: false }),
            };
            this.multiFrame = true;
            this.usesUserArt = false;
        }

        // --- aspect handling (CONFIG.TEACHER.FIT_ASPECT) ---
        this.spriteH = TEACHER.SPRITE_HEIGHT;
        this.spriteW = TEACHER.SPRITE_WIDTH;
        if (TEACHER.FIT_ASPECT && this.usesUserArt) {
            const img = this.frames.runA?.image;
            const iw = img?.width || 0;
            const ih = img?.height || 0;
            if (iw > 0 && ih > 0) {
                this.spriteAspect = iw / ih;
                this.spriteW = Math.min(
                    this.spriteH * this.spriteAspect, TEACHER.MAX_SPRITE_WIDTH);
            }
        } else {
            this.spriteAspect = TEACHER.SPRITE_WIDTH / TEACHER.SPRITE_HEIGHT;
        }

        this.material = new THREE.SpriteMaterial({
            map: this.frames.runA,
            transparent: true,
            opacity: 0,                // starts invisible
            depthWrite: false,
        });
        this.sprite = new THREE.Sprite(this.material);
        this.sprite.center.set(0.5, 0);
        this.sprite.scale.set(this.spriteW, this.spriteH, 1);
        this.sprite.position.set(0, 0, this.distanceFromPlayer);
        this.sprite.visible = false;
        this.scene.add(this.sprite);

        const shadowTex = canvasTexture(drawShadowBlob(), { mipmaps: false });
        this.shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(this.spriteW * 1.1, this.spriteW * 1.1),
            new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 })
        );
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.position.set(0, 0.015, this.distanceFromPlayer);
        this.shadow.visible = false;
        this.scene.add(this.shadow);
    }

    // ------------------------------------------------------------------
    // Mistakes
    // ------------------------------------------------------------------

    /**
     * Called when the player hits an obstacle.
     * @returns {'GAME_OVER'|'ALERT'|null} 'GAME_OVER' when the mistake
     *   threshold is reached (the catch animation then plays out in update()).
     */
    onPlayerMistake() {
        if (this.state === TeacherState.CAUGHT) return null;
        this.mistakeCount++;

        if (this.mistakeCount >= TEACHER.MAJOR_BLUNDER_THRESHOLD) {
            this.forceCatch();
            return 'GAME_OVER';
        }
        if (this.state === TeacherState.HIDDEN || this.state === TeacherState.FADING_OUT) {
            // first mistake (or a fresh one as she was leaving): appear
            this._appear();
        } else {
            // already chasing: surge closer
            this._surge();
        }
        return 'ALERT';
    }

    _appear() {
        this.state = TeacherState.CHASING;
        this.isVisible = true;
        this.sprite.visible = true;
        this.shadow.visible = true;
        this.fadeDirection = 1;
        this.fadeTimer = 0;
        this.fadeInDone = false;
        this.opacity = 0;
        this.distanceFromPlayer = this.spawnDistance;
        this.targetDistance = TEACHER.MENACE_DISTANCE;
        this.cleanMeters = 0;
        this.decayMeters = 0;
        this.closeTimer = 0;
        this.graceTimer = 0;
        this.surgeTimer = 0;
        this._emit('appear');
    }

    _surge() {
        this.targetDistance = TEACHER.SURGE_DISTANCE;
        this.surgeTimer = TEACHER.SURGE_DURATION;
        this.cleanMeters = 0;
        this.decayMeters = 0;
        this._emit('surge');
    }

    /** Skip straight to the catch (3rd mistake). */
    forceCatch() {
        if (this.state === TeacherState.CAUGHT) return;
        this.state = TeacherState.CAUGHT;
        this.isVisible = true;
        this.sprite.visible = true;
        this.shadow.visible = true;
        this.fadeDirection = 1;
        this.fadeTimer = TEACHER.FADE_DURATION;   // fully opaque
        this.fadeInDone = true;
        this.opacity = 1;
        this.material.opacity = 1;
        this._emit('caught');
    }

    _fadeOut() {
        this.state = TeacherState.FADING_OUT;
        this.fadeDirection = -1;
        this.fadeTimer = 0;
        this.mistakeCount = 0;
        this.cleanMeters = 0;
        this.decayMeters = 0;
    }

    // ------------------------------------------------------------------
    // Recovery (call every frame with the distance run)
    // ------------------------------------------------------------------

    /**
     * @param {number} distanceTraveled metres moved this frame
     * @param {boolean} isClean true while the player is not stumbling
     */
    updateRecovery(distanceTraveled, isClean) {
        if (this.state !== TeacherState.CHASING || !isClean) return;

        this.cleanMeters += distanceTraveled;
        this.decayMeters += distanceTraveled;

        // forgiveness: -1 mistake per 50 m clean (report §4.4)
        if (this.decayMeters >= TEACHER.MISTAKE_DECAY_METERS && this.mistakeCount > 0) {
            this.decayMeters -= TEACHER.MISTAKE_DECAY_METERS;
            this.mistakeCount--;
            if (this.mistakeCount <= 1) this.targetDistance = TEACHER.MENACE_DISTANCE;
        }

        if (this.cleanMeters >= TEACHER.RECOVERY_DISTANCE) {
            this._fadeOut();
        }
    }

    // ------------------------------------------------------------------
    // Per-frame update
    // ------------------------------------------------------------------

    /**
     * @param {number} deltaTime
     * @param {number} playerSpeed   effective player speed (u/s)
     * @param {number} playerLaneX   player x for the lane weave
     * @param {boolean} playerDodging true while the player is mid-jump/slide
     * @returns {'CAUGHT'|null}
     */
    update(deltaTime, playerSpeed, playerLaneX, playerDodging) {
        // fade in/out animation
        if (this.state === TeacherState.CHASING || this.state === TeacherState.FADING_OUT) {
            this.fadeTimer += deltaTime;
            const fadeProgress = Math.min(this.fadeTimer / TEACHER.FADE_DURATION, 1);
            this.opacity = this.fadeDirection === 1 ? fadeProgress : 1 - fadeProgress;
            this.material.opacity = this.opacity;
            if (fadeProgress >= 1) {
                if (this.fadeDirection === 1) {
                    this.fadeInDone = true;
                } else {
                    this._hide();
                }
            }
        }

        if (this.state === TeacherState.HIDDEN) return null;

        // ---- distance dynamics ----
        if (this.state === TeacherState.CHASING) {
            // chase multiplier eases 1.3 -> 1.0 with clean metres since the
            // last mistake, so a clean runner stops losing ground.
            const aggro = 1 - Math.min(1, this.cleanMeters / TEACHER.AGGRO_CLEAN_METERS);
            const mult = 1 + (TEACHER.CHASE_SPEED_MULTIPLIER - 1) * aggro;
            const boost = this.surgeTimer > 0 ? 1 + TEACHER.SURGE_BOOST : 1;
            if (this.surgeTimer > 0) this.surgeTimer -= deltaTime;
            const closing = playerSpeed * (mult - 1) * boost;

            if (this.distanceFromPlayer > this.targetDistance) {
                this.distanceFromPlayer = Math.max(
                    this.targetDistance, this.distanceFromPlayer - closing * deltaTime);
            } else if (this.distanceFromPlayer < this.targetDistance) {
                // relaxed back out after mistake decay
                this.distanceFromPlayer = Math.min(
                    this.targetDistance,
                    this.distanceFromPlayer + TEACHER.RELAX_RATE * deltaTime);
            }
        } else if (this.state === TeacherState.CAUGHT) {
            this.distanceFromPlayer = Math.max(
                TEACHER.CATCH_ANIM_DISTANCE,
                this.distanceFromPlayer - TEACHER.CATCH_ANIM_SPEED * deltaTime);
        }

        // ---- catch checks (fairness guards) ----
        if (this.state === TeacherState.CHASING && this.fadeInDone) {
            if (this.distanceFromPlayer <= TEACHER.CATCH_DISTANCE) {
                if (playerDodging && this.graceTimer < TEACHER.LUNGE_GRACE_TIME) {
                    // lunge grace: hold just short of the grab (report §4.4)
                    this.graceTimer += deltaTime;
                    this.distanceFromPlayer = Math.max(
                        this.distanceFromPlayer, TEACHER.LUNGE_GRACE_DISTANCE);
                } else {
                    this.closeTimer += deltaTime;
                    if (this.closeTimer >= TEACHER.CATCH_SUSTAIN) this.forceCatch();
                }
            } else {
                this.closeTimer = 0;
                this.graceTimer = 0;
            }
        }

        // ---- presentation ----
        const z = this.distanceFromPlayer;          // player is at z = 0
        this.sprite.position.z = z;

        // lazy weave toward the player's lane (report §4.4)
        const weave = Math.min(1, TEACHER.WEAVE_LERP * deltaTime);
        this.sprite.position.x += (playerLaneX - this.sprite.position.x) * weave;

        // run bob + frame cycle
        if (this.state !== TeacherState.CAUGHT) {
            this.runBobTimer += deltaTime * PLAYER_RUN_BOB();
            const bob = Math.sin(this.runBobTimer) * 0.12;
            this.sprite.position.y = bob;
            this.shadow.position.y = 0.015 + bob * 0.05;
            if (this.multiFrame) {
                this.frameTimer += deltaTime;
                const frameTime = 1 / TEACHER.RUN_FRAME_RATE;
                if (this.frameTimer >= frameTime) {
                    this.frameTimer = 0;
                    this.frameIndex = 1 - this.frameIndex;
                }
                const tex = this.frameIndex ? this.frames.runB : this.frames.runA;
                if (this.material.map !== tex) {
                    this.material.map = tex;
                    this.material.needsUpdate = true;
                }
            }
        } else {
            // grab pose looming over the player
            if (this.multiFrame && this.material.map !== this.frames.grab) {
                this.material.map = this.frames.grab;
                this.material.needsUpdate = true;
            }
            this.sprite.position.y = 0;
            this.sprite.scale.set(this.spriteW * 1.08, this.spriteH * 1.08, 1);
        }

        this.shadow.position.x = this.sprite.position.x;
        this.shadow.position.z = z;
        this.shadow.material.opacity = 0.8 * this.opacity;
        this.shadow.scale.setScalar(1 - 0.3 * Math.min(1, this.distanceFromPlayer / 10));

        // ---- emit the game-over event once the grab lands ----
        if (this.state === TeacherState.CAUGHT
            && !this.catchDone
            && this.distanceFromPlayer <= TEACHER.CATCH_ANIM_DISTANCE + 0.05) {
            this.catchDone = true;
            return 'CAUGHT';
        }
        return null;
    }

    /** Red-vignette intensity 0..1 for the UI. */
    getWarningIntensity() {
        if (this.state === TeacherState.CAUGHT) {
            return Math.min(1, 0.7 + (TEACHER.APPEAR_DISTANCE - this.distanceFromPlayer) / 12);
        }
        if (!this.isVisible || this.state === TeacherState.HIDDEN) return 0;
        const span = TEACHER.APPEAR_DISTANCE - TEACHER.CATCH_DISTANCE;
        let intensity = 1 - (this.distanceFromPlayer - TEACHER.CATCH_DISTANCE) / span;
        intensity = THREE.MathUtils.clamp(intensity, 0, 1) * TEACHER.WARNING_MAX;
        if (this.surgeTimer > 0) intensity = Math.min(1, intensity + TEACHER.SURGE_WARNING_BONUS);
        return intensity * this.opacity;            // fade with her opacity
    }

    /** Mistake pips for HUD feedback (0..2 before the third = game over). */
    get mistakes() { return this.mistakeCount; }

    get isChasing() {
        return this.state === TeacherState.CHASING || this.state === TeacherState.CAUGHT;
    }

    reset() {
        this.state = TeacherState.HIDDEN;
        this.isVisible = false;
        this.opacity = 0;
        this.fadeTimer = 0;
        this.fadeInDone = false;
        this.mistakeCount = 0;
        this.cleanMeters = 0;
        this.decayMeters = 0;
        this.closeTimer = 0;
        this.graceTimer = 0;
        this.surgeTimer = 0;
        this.catchDone = false;
        this.distanceFromPlayer = this.spawnDistance;
        this.targetDistance = TEACHER.MENACE_DISTANCE;
        if (this.sprite) {
            this.sprite.visible = false;
            this.sprite.position.set(0, 0, this.spawnDistance);
            this.sprite.scale.set(this.spriteW, this.spriteH, 1);
        }
        if (this.material) this.material.opacity = 0;
        if (this.shadow) {
            this.shadow.visible = false;
            this.shadow.material.opacity = 0;
        }
    }

    _hide() {
        this.state = TeacherState.HIDDEN;
        this.isVisible = false;
        this.opacity = 0;
        this.sprite.visible = false;
        this.shadow.visible = false;
    }

    _emit(type) {
        if (this.onEvent) this.onEvent(type);
    }
}

// tiny indirection so the module has no Player import
function PLAYER_RUN_BOB() { return 9; }
