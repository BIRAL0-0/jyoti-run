/**
 * CampusManager — the school around the track.
 *
 * Cross-section, from the centre of the road outwards (owner review item 2):
 *
 *   Building | Plants | Fence | Sidewalk | ROAD | Sidewalk | Fence | Plants | Building
 *
 * Uses the same recycling trick as GroundManager: each band lives in a Group
 * whose z advances with the world and snaps back by exactly one period, so a
 * short lattice covers an infinite run with zero per-frame matrix updates.
 *
 * Everything is procedural (canvas facades + merged primitives) and every
 * number comes from CONFIG.CAMPUS. Buildings are one InstancedMesh per
 * variant, so the whole campus is a handful of draw calls however far it runs.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAMPUS, GROUND, LIGHTING } from '../config.js';
import { canvasTexture } from '../utils/AssetLoader.js';
import { drawPavingTexture, drawBuildingFacade } from '../utils/placeholderArt.js';

/**
 * How far ahead of the camera the campus has to reach.
 *
 * Capped just past the fog wall on purpose: a building further away than
 * FOG.far is drawn as flat fog colour, and because it still writes depth it
 * would occlude the horizon backdrop (which is exempt from fog) with an
 * invisible sky-coloured wall. Stopping the lattice a little beyond the fog
 * keeps the backdrop visible without any visible end to the street.
 */
function campusSpan() {
    const track = GROUND.VISIBLE_TILES * GROUND.TILE_LENGTH;
    const fogReach = LIGHTING.FOG.enabled ? LIGHTING.FOG.far + 70 : track;
    return Math.min(track + 160, fogReach);
}

export class CampusManager {
    /**
     * @param {THREE.Scene} scene
     * @param {{anisotropy?:number, maxBuildingVariants?:number}} [opts]
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.anisotropy = opts.anisotropy ?? 4;
        /** mobile tuning: drop the tallest variants (1 draw call each) */
        this.maxBuildingVariants = opts.maxBuildingVariants ?? Infinity;

        /** @type {{group:THREE.Group, period:number, id:string}[]} */
        this.bands = [];
        this.enabled = false;
    }

    // ------------------------------------------------------------------
    // Build
    // ------------------------------------------------------------------

    load() {
        if (!CAMPUS.ENABLED) return;
        if (CAMPUS.SIDEWALK.ENABLED) this._buildSidewalk();
        if (CAMPUS.FENCE.ENABLED) this._buildFence();
        if (CAMPUS.BUILDINGS.ENABLED) this._buildBuildings();
        this.enabled = this.bands.length > 0;
    }

    /** vertex-colour helper (matches GroundManager's decor builders) */
    static _tinted(geo, hex) {
        const c = new THREE.Color(hex);
        const n = geo.attributes.position.count;
        const colors = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return geo;
    }

    /**
     * Paved strip + kerb lip on both sides. Static (a uniform strip shows no
     * motion cue), but the tiled paving texture carries the sense of speed.
     */
    _buildSidewalk() {
        const S = CAMPUS.SIDEWALK;
        const span = campusSpan();
        const tex = canvasTexture(drawPavingTexture(), {
            repeat: [1, Math.round(span / 6)],
            anisotropy: this.anisotropy,
        });
        const mat = new THREE.MeshLambertMaterial({ map: tex });

        const slab = new THREE.BoxGeometry(S.WIDTH, S.HEIGHT, span);
        const kerb = new THREE.BoxGeometry(0.35, S.HEIGHT * 1.35, span);
        const group = new THREE.Group();

        const slabMesh = new THREE.InstancedMesh(slab, mat, 2);
        slabMesh.receiveShadow = true;
        slabMesh.castShadow = false;

        const kerbMat = new THREE.MeshLambertMaterial({ color: S.KERB_COLOR });
        const kerbMesh = new THREE.InstancedMesh(kerb, kerbMat, 2);

        const m = new THREE.Matrix4();
        let i = 0;
        for (const side of [-1, 1]) {
            m.makeTranslation(side * (S.INNER_X + S.WIDTH / 2), S.HEIGHT / 2, -span / 2 + 80);
            slabMesh.setMatrixAt(i, m);
            m.makeTranslation(
                side * (S.INNER_X - 0.17),
                (S.HEIGHT * 1.35) / 2,
                -span / 2 + 80,
            );
            kerbMesh.setMatrixAt(i, m);
            i++;
        }
        slabMesh.instanceMatrix.needsUpdate = true;
        kerbMesh.instanceMatrix.needsUpdate = true;
        group.add(slabMesh, kerbMesh);
        this.scene.add(group);
        this.bands.push({ group, period: Infinity, id: 'sidewalk' });   // static
    }

    /** Green school railings: post + two rails, merged into one geometry. */
    _buildFence() {
        const F = CAMPUS.FENCE;
        const span = campusSpan();
        const panels = Math.floor(span / F.PANEL_SPACING);

        const parts = [
            CampusManager._tinted(
                new THREE.BoxGeometry(F.POST_WIDTH, F.POST_HEIGHT, F.POST_WIDTH),
                F.POST_COLOR),
        ];
        parts[0].translate(0, F.POST_HEIGHT / 2, 0);
        for (const y of F.RAIL_Y) {
            const rail = CampusManager._tinted(
                new THREE.BoxGeometry(F.POST_WIDTH * 0.7, F.RAIL_HEIGHT, F.PANEL_SPACING),
                F.COLOR);
            rail.translate(0, y, 0);
            parts.push(rail);
        }

        const geo = mergeGeometries(parts, false);
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = new THREE.InstancedMesh(geo, mat, panels * 2);
        mesh.frustumCulled = false;

        const m = new THREE.Matrix4();
        let i = 0;
        for (const side of [-1, 1]) {
            for (let p = 0; p < panels; p++) {
                m.makeTranslation(side * F.X, 0, 8 - p * F.PANEL_SPACING);
                mesh.setMatrixAt(i++, m);
            }
        }
        mesh.instanceMatrix.needsUpdate = true;

        const group = new THREE.Group();
        group.add(mesh);
        this.scene.add(group);
        this.bands.push({ group, period: F.PANEL_SPACING, id: 'fence' });
    }

    /**
     * Tall yellow school buildings. One InstancedMesh per variant so the
     * window grid is baked at the right scale (a shared box + per-instance
     * height would stretch the windows).
     *
     * Lattice: slot k sits at -(k·SPACING + jitter) and belongs to variant
     * k % V, so each variant's own lattice repeats every V·SPACING — that is
     * the period the group snaps back by.
     */
    _buildBuildings() {
        const B = CAMPUS.BUILDINGS;
        const variants = B.VARIANTS.slice(0, this.maxBuildingVariants);
        const V = variants.length;
        if (!V) return;

        const span = campusSpan();
        const slots = Math.ceil(span / B.SPACING);

        variants.forEach((variant, v) => {
            const tex = canvasTexture(drawBuildingFacade(variant), {
                anisotropy: this.anisotropy,
            });
            const mat = new THREE.MeshLambertMaterial({ map: tex });
            const geo = new THREE.BoxGeometry(variant.w, variant.h, B.DEPTH);

            const slotsForVariant = [];
            for (let k = v; k < slots; k += V) slotsForVariant.push(k);

            const mesh = new THREE.InstancedMesh(geo, mat, slotsForVariant.length * 2);
            mesh.frustumCulled = false;

            const m = new THREE.Matrix4();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            const pos = new THREE.Vector3();
            let i = 0;
            for (const k of slotsForVariant) {
                const z = -(k * B.SPACING + Math.random() * B.GAP_VAR);
                for (const side of [-1, 1]) {
                    // uniform jitter only — never distorts the window grid
                    const jitter = 1 + (Math.random() * 2 - 1) * B.HEIGHT_VAR;
                    s.setScalar(jitter);
                    pos.set(
                        side * (B.INNER_X + (variant.w * jitter) / 2),
                        (variant.h * jitter) / 2,
                        z,
                    );
                    m.compose(pos, q, s);
                    mesh.setMatrixAt(i++, m);
                }
            }
            mesh.instanceMatrix.needsUpdate = true;

            const group = new THREE.Group();
            group.add(mesh);
            this.scene.add(group);
            this.bands.push({ group, period: V * B.SPACING, id: `building:${v}` });
        });
    }

    // ------------------------------------------------------------------
    // Update / reset / introspect
    // ------------------------------------------------------------------

    /** @param {number} distance world scroll this frame (positive = toward camera) */
    update(distance) {
        if (!this.enabled) return;
        for (const band of this.bands) {
            if (!Number.isFinite(band.period)) continue;   // static bands
            band.group.position.z += distance;
            if (band.group.position.z >= band.period) {
                band.group.position.z -= band.period;
            }
        }
    }

    reset() {
        for (const band of this.bands) band.group.position.z = 0;
    }

    describe() {
        return {
            enabled: this.enabled,
            bands: this.bands.map((b) => ({
                id: b.id,
                period: Number.isFinite(b.period) ? b.period : 'static',
                z: +b.group.position.z.toFixed(3),
                meshes: b.group.children.length,
                instances: b.group.children.map((c) => c.count ?? 1),
            })),
        };
    }
}
