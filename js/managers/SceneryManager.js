/**
 * SceneryManager — optional billboard scenery (spec §1 "roadside decor").
 *
 * Everything here is a drop-in override of the procedural world: the game
 * boots, runs and plays identically with an empty assets/scenery/. When
 * nothing loads, `usesPlaceholderArt` stays true and no objects are added to
 * the scene at all — zero draw calls, no fallback geometry.
 *
 * Three kinds of billboard, all driven from CONFIG.SCENERY:
 *
 *  HORIZON   one camera-locked backdrop. Re-anchored every frame to
 *            camera.z - DISTANCE, so it behaves like a skybox at infinity.
 *            `fog: false` is mandatory: the scene fog (FOG.far = 100) would
 *            otherwise flatten it to the sky colour completely.
 *
 *  LANDMARKS recycling rings of billboards the runner passes through. Same
 *            trick as the ground tiles in GroundManager: the group advances
 *            with the world and snaps back by exactly one period, so the
 *            lattice maps onto itself and the loop is invisible.
 *
 * Widths are derived from each image's own aspect ratio (HEIGHT is
 * authoritative, MAX_WIDTH clamps), so no scenery art is ever stretched.
 */
import * as THREE from 'three';
import { SCENERY } from '../config.js';
import { probeExisting, loadImageTexture } from '../utils/AssetLoader.js';

export class SceneryManager {
    /**
     * @param {THREE.Scene} scene
     * @param {{anisotropy?:number}} [opts]
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.anisotropy = opts.anisotropy ?? 4;
        /** mobile tuning: cap how many billboards make up one landmark */
        this.maxSegments = opts.maxSegments ?? Infinity;

        /** true until at least one scenery texture actually loads */
        this.usesPlaceholderArt = true;
        this.horizon = null;
        /** @type {{group:THREE.Group, spacing:number, sprites:THREE.Sprite[]}[]} */
        this.rings = [];
        this.loadedIds = [];
    }

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    /** Probe + load every configured scenery slot. Never throws. */
    async load() {
        if (!SCENERY.ENABLED) return;

        const slots = [
            ...(SCENERY.HORIZON.ENABLED ? [{ key: 'horizon', url: SCENERY.HORIZON.URL }] : []),
            ...SCENERY.LANDMARKS
                .filter((l) => l.ENABLED)
                .map((l) => ({ key: l.ID, url: l.URL })),
        ];
        if (!slots.length) return;

        const existing = await probeExisting(slots.map((s) => s.url));
        const textures = new Map();
        await Promise.all(slots.map(async ({ key, url }) => {
            if (!existing.has(url)) return;
            const tex = await loadImageTexture(url, { anisotropy: this.anisotropy });
            if (tex) textures.set(key, tex);
        }));
        if (!textures.size) return;                 // nothing there: stay procedural

        this.usesPlaceholderArt = false;

        const horizonTex = textures.get('horizon');
        if (horizonTex) this.horizon = this._buildHorizon(horizonTex);

        for (const cfg of SCENERY.LANDMARKS) {
            const tex = textures.get(cfg.ID);
            if (tex) this.rings.push(this._buildRing(cfg, tex));
        }

        this.loadedIds = [...textures.keys()];
    }

    /** Billboard material shared by every scenery slot. */
    _material(texture, opacity) {
        return new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity,
            depthWrite: false,     // never punch holes in the ground/obstacles
            fog: false,            // fog would erase a 200 m backdrop
        });
    }

    /** width from the image's own aspect so the art is never stretched */
    _size(texture, height, maxWidth) {
        const img = texture.image;
        const aspect = img?.width && img?.height ? img.width / img.height : 1;
        let width = height * aspect;
        let h = height;
        if (maxWidth && width > maxWidth) {     // clamp: shrink height to match
            width = maxWidth;
            h = maxWidth / aspect;
        }
        return { width, height: h };
    }

    /**
     * The horizon render has its own sky + clouds baked in; left opaque, the
     * sprite reads as a pasted card with hard rectangle edges. Key the sky-ish
     * pixels (cool blues, cool whites) transparent above the skyline so the
     * scene's real gradient sky and drifting clouds continue behind the gate.
     * Warm whites (sunlit marble) and yellows (buildings) fail both tests and
     * are kept. Returns a new CanvasTexture and disposes the input.
     * @param {THREE.Texture} texture
     * @returns {THREE.Texture}
     */
    _keyOutSky(texture) {
        const K = SCENERY.HORIZON.SKY_KEY;
        const img = texture.image;
        if (!K || !K.ENABLED || !img || !img.width || !img.height) return texture;
        const w = img.width, h = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const frame = ctx.getImageData(0, 0, w, h);
        const px = frame.data;
        const skyline = h * K.SKYLINE;
        const feather = h * (K.FEATHER ?? 0.12);
        for (let y = 0; y < skyline; y++) {
            // full strength above the feather band, easing to 0 at SKYLINE so
            // the keying lands softly instead of ending in a hard row
            const strength = y < skyline - feather ? 1 : (skyline - y) / feather;
            if (strength <= 0) continue;
            const cut = 255 * (1 - strength);
            let i = y * w * 4;
            for (let x = 0; x < w; x++, i += 4) {
                const r = px[i], g = px[i + 1], b = px[i + 2];
                const blueSky = b > 120 && b >= r + 40;          // saturated sky blue
                const coolWhite = r > 185 && g > 185 && b > 190 && b >= r; // cloud/haze
                if (blueSky || coolWhite) px[i + 3] = Math.min(px[i + 3], cut);
            }
        }
        ctx.putImageData(frame, 0, 0);
        const keyed = new THREE.CanvasTexture(canvas);
        keyed.colorSpace = THREE.SRGBColorSpace;
        keyed.anisotropy = texture.anisotropy || this.anisotropy;
        keyed.needsUpdate = true;
        texture.dispose();
        return keyed;
    }

    _buildHorizon(texture) {
        const H = SCENERY.HORIZON;
        texture = this._keyOutSky(texture);
        const { width, height } = this._size(texture, H.HEIGHT, H.MAX_WIDTH);
        const sprite = new THREE.Sprite(this._material(texture, H.OPACITY));
        sprite.scale.set(width, height, 1);
        sprite.position.set(0, H.Y, -H.DISTANCE);
        sprite.renderOrder = -1;                    // draw behind the world
        sprite.frustumCulled = false;
        this.scene.add(sprite);
        return sprite;
    }

    _buildRing(cfg, texture) {
        const group = new THREE.Group();
        const { width, height } = this._size(texture, cfg.HEIGHT, cfg.MAX_WIDTH);
        // REPEAT: false → one-shot landmark: force a single billboard, ignore COUNT.
        const repeat = cfg.REPEAT !== false;
        const count = repeat ? cfg.COUNT : 1;
        const segments = Math.max(1, Math.min(cfg.SEGMENTS ?? 1, this.maxSegments));
        const step = cfg.SEGMENT_STEP ?? 0;
        const sprites = [];
        for (let i = 0; i < count; i++) {
            for (let s = 0; s < segments; s++) {
                const sprite = new THREE.Sprite(this._material(texture, cfg.OPACITY));
                sprite.scale.set(width, height, 1);
                sprite.position.set(0, cfg.Y, -(cfg.PHASE + i * cfg.SPACING + s * step));
                // depth-sort the arches of a corridor so they stack correctly
                sprite.renderOrder = segments - s;
                sprite.frustumCulled = false;
                group.add(sprite);
                sprites.push(sprite);
            }
        }
        this.scene.add(group);
        return { group, spacing: cfg.SPACING, phase: cfg.PHASE ?? 0, sprites, repeat, done: false };
    }

    // ------------------------------------------------------------------
    // Update / reset
    // ------------------------------------------------------------------

    /**
     * @param {number} distance  world scroll this frame (positive = toward camera)
     * @param {THREE.Camera} camera
     */
    update(distance, camera) {
        if (this.usesPlaceholderArt) return;

        // horizon: re-anchor to the camera so it never gets closer
        if (this.horizon && camera) {
            const H = SCENERY.HORIZON;
            this.horizon.position.z = camera.position.z - H.DISTANCE;
            this.horizon.position.x = camera.position.x * H.PARALLAX;
        }

        // landmark rings: advance with the world, snap back one period.
        // One-shot landmarks (REPEAT: false) never snap back — they scroll
        // past the camera once and are hidden so they can't return.
        for (const ring of this.rings) {
            if (ring.done) continue;
            ring.group.position.z += distance;
            if (ring.repeat) {
                if (ring.group.position.z >= ring.spacing) {
                    ring.group.position.z -= ring.spacing;
                }
            } else if (ring.group.position.z - ring.phase >= camera.position.z) {
                ring.done = true;
                for (const s of ring.sprites) s.visible = false;
            }
        }
    }

    /** Put every ring back to its start offset (new run). */
    reset() {
        for (const ring of this.rings) {
            ring.group.position.z = 0;
            ring.done = false;
            for (const s of ring.sprites) s.visible = true;
        }
    }

    /** Test/debug surface: what actually got built. */
    describe() {
        return {
            usesPlaceholderArt: this.usesPlaceholderArt,
            loaded: this.loadedIds,
            horizon: this.horizon
                ? { w: +this.horizon.scale.x.toFixed(3), h: +this.horizon.scale.y.toFixed(3), y: this.horizon.position.y }
                : null,
            rings: this.rings.map((r) => ({
                count: r.sprites.length,
                w: +r.sprites[0].scale.x.toFixed(3),
                h: +r.sprites[0].scale.y.toFixed(3),
                y: r.sprites[0].position.y,
                spacing: r.spacing,
                repeat: r.repeat,
                done: r.done,
            })),
        };
    }
}
