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

    _buildHorizon(texture) {
        const H = SCENERY.HORIZON;
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
        const sprites = [];
        for (let i = 0; i < cfg.COUNT; i++) {
            const sprite = new THREE.Sprite(this._material(texture, cfg.OPACITY));
            sprite.scale.set(width, height, 1);
            sprite.position.set(0, cfg.Y, -(cfg.PHASE + i * cfg.SPACING));
            sprite.frustumCulled = false;
            group.add(sprite);
            sprites.push(sprite);
        }
        this.scene.add(group);
        return { group, spacing: cfg.SPACING, sprites };
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

        // landmark rings: advance with the world, snap back one period
        for (const ring of this.rings) {
            ring.group.position.z += distance;
            if (ring.group.position.z >= ring.spacing) {
                ring.group.position.z -= ring.spacing;
            }
        }
    }

    /** Put every ring back to its start offset (new run). */
    reset() {
        for (const ring of this.rings) ring.group.position.z = 0;
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
            })),
        };
    }
}
