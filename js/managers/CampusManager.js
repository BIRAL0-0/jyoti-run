/**
 * CampusManager — the school around the track.
 *
 * Cross-section, from the centre of the road outwards (school-campus pass):
 *
 *   ROAD | BORDER(+RAILING) | HEDGE | planters/trees | VERANDA | BUILDINGS
 *
 * Long continuous 2-3 storey yellow school blocks with maroon trim, open
 * ground-floor verandas (3D colonnade) and dark metal railings; a raised
 * concrete border + railing hugs the path and a trimmed hedge runs behind
 * it. Everything is periodic and recycled with the same group-shift trick as
 * the ground tiles, and every band is one or two InstancedMeshes, so the
 * whole campus is a handful of draw calls however far it runs.
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
 * would occlude any fog-exempt backdrop with an invisible sky-coloured wall.
 * Stopping the lattice a little beyond the fog keeps the horizon seamless.
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
        /** mobile tuning: drop the extra variants (1 draw call each) */
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
        if (CAMPUS.BORDER.ENABLED) this._buildBorder();
        if (CAMPUS.RAILING.ENABLED) this._buildRailing();
        if (CAMPUS.HEDGE.ENABLED) this._buildHedge();
        if (CAMPUS.VERANDA.ENABLED) this._buildVeranda();
        if (CAMPUS.BUILDINGS.ENABLED) {
            this._buildColonnade();
            this._buildBuildings();
        }
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

    /** Raised concrete border hugging the path edge (body + darker lip). */
    _buildBorder() {
        const B = CAMPUS.BORDER;
        const span = campusSpan();

        const body = CampusManager._tinted(
            new THREE.BoxGeometry(B.WIDTH, B.HEIGHT, span), B.COLOR);
        body.translate(0, B.HEIGHT / 2, 0);
        const lip = CampusManager._tinted(
            new THREE.BoxGeometry(B.WIDTH + 0.12, 0.09, span), B.LIP_COLOR);
        lip.translate(0, B.HEIGHT + 0.045, 0);

        const mesh = new THREE.InstancedMesh(
            mergeGeometries([body, lip], false),
            new THREE.MeshLambertMaterial({ vertexColors: true }),
            2,
        );
        mesh.frustumCulled = false;
        const m = new THREE.Matrix4();
        [-1, 1].forEach((side, i) => {
            m.makeTranslation(side * (B.INNER_X + B.WIDTH / 2), 0, -span / 2 + 80);
            mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;

        const group = new THREE.Group();
        group.add(mesh);
        this.scene.add(group);
        this.bands.push({ group, period: Infinity, id: 'border' });   // static
    }

    /** Dark metal railing standing on the border: post + two rails. */
    _buildRailing() {
        const R = CAMPUS.RAILING;
        const span = campusSpan();
        const panels = Math.floor(span / R.PANEL_SPACING);

        const parts = [
            CampusManager._tinted(
                new THREE.BoxGeometry(R.POST_WIDTH, R.POST_HEIGHT, R.POST_WIDTH),
                R.POST_COLOR),
        ];
        parts[0].translate(0, R.POST_HEIGHT / 2, 0);
        for (const y of R.RAIL_Y) {
            const rail = CampusManager._tinted(
                new THREE.BoxGeometry(R.POST_WIDTH * 0.7, R.RAIL_HEIGHT, R.PANEL_SPACING),
                R.COLOR);
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
                m.makeTranslation(side * R.X, CAMPUS.BORDER.HEIGHT, 8 - p * R.PANEL_SPACING);
                mesh.setMatrixAt(i++, m);
            }
        }
        mesh.instanceMatrix.needsUpdate = true;

        const group = new THREE.Group();
        group.add(mesh);
        this.scene.add(group);
        this.bands.push({ group, period: R.PANEL_SPACING, id: 'railing' });
    }

    /** Continuous neatly-trimmed hedge behind the railing. */
    _buildHedge() {
        const H = CAMPUS.HEDGE;
        const span = campusSpan();
        const mesh = new THREE.InstancedMesh(
            CampusManager._tinted(new THREE.BoxGeometry(H.WIDTH, H.HEIGHT, span), H.COLOR),
            new THREE.MeshLambertMaterial({ vertexColors: true }),
            2,
        );
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        const m = new THREE.Matrix4();
        [-1, 1].forEach((side, i) => {
            m.makeTranslation(side * H.X, H.HEIGHT / 2, -span / 2 + 80);
            mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;

        const group = new THREE.Group();
        group.add(mesh);
        this.scene.add(group);
        this.bands.push({ group, period: Infinity, id: 'hedge' });    // static
    }

    /**
     * Raised veranda walkway in front of the classrooms: paved slab + kerb
     * lip on the planted side. Static (a uniform strip shows no motion cue).
     */
    _buildVeranda() {
        const S = CAMPUS.VERANDA;
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
                side * (S.INNER_X + S.WIDTH + 0.17),
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
        this.bands.push({ group, period: Infinity, id: 'veranda' });  // static
    }

    /**
     * Ground-floor colonnade: a cream column + maroon edge beam every 4 m,
     * standing on the veranda just in front of the building face — the open
     * corridor of the reference, in real 3D.
     */
    _buildColonnade() {
        const B = CAMPUS.BUILDINGS;
        const S = CAMPUS.VERANDA;
        const span = campusSpan();
        const panel = 4;
        const panels = Math.floor(span / panel);
        const colH = B.FLOOR_HEIGHT - S.HEIGHT - 0.3;

        const parts = [
            CampusManager._tinted(new THREE.BoxGeometry(0.4, colH, 0.4), 0xf4f1e8),
        ];
        parts[0].translate(0, S.HEIGHT + colH / 2, 0);
        const beam = CampusManager._tinted(new THREE.BoxGeometry(0.45, 0.3, panel), B.TRIM_COLOR);
        beam.translate(0, S.HEIGHT + colH + 0.15, 0);
        parts.push(beam);

        const mesh = new THREE.InstancedMesh(
            mergeGeometries(parts, false),
            new THREE.MeshLambertMaterial({ vertexColors: true }),
            panels * 2,
        );
        mesh.frustumCulled = false;
        const m = new THREE.Matrix4();
        let i = 0;
        for (const side of [-1, 1]) {
            for (let p = 0; p < panels; p++) {
                m.makeTranslation(side * (B.INNER_X - 0.2), 0, 8 - p * panel);
                mesh.setMatrixAt(i++, m);
            }
        }
        mesh.instanceMatrix.needsUpdate = true;

        const group = new THREE.Group();
        group.add(mesh);
        this.scene.add(group);
        this.bands.push({ group, period: panel, id: 'colonnade' });
    }

    /**
     * Long continuous school blocks. Modules butt together with no gap and
     * no jitter (slot k at -(k·LENGTH)), so each side reads as one building
     * running to the horizon; two floor-count variants alternate for rhythm,
     * each variant's lattice repeating every V·LENGTH.
     */
    _buildBuildings() {
        const B = CAMPUS.BUILDINGS;
        const variants = B.VARIANTS.slice(0, this.maxBuildingVariants);
        const V = variants.length;
        if (!V) return;

        const span = campusSpan();
        const slots = Math.ceil((span + B.LENGTH) / B.LENGTH);

        variants.forEach((variant, v) => {
            const h = variant.floors * B.FLOOR_HEIGHT + 0.6 + 0.55;  // + plinth + cornice
            const tex = canvasTexture(drawBuildingFacade(variant, B), {
                anisotropy: this.anisotropy,
            });
            const mat = new THREE.MeshLambertMaterial({ map: tex });
            const geo = new THREE.BoxGeometry(B.DEPTH, h, B.LENGTH);

            const slotsForVariant = [];
            for (let k = v; k < slots; k += V) slotsForVariant.push(k);

            const mesh = new THREE.InstancedMesh(geo, mat, slotsForVariant.length * 2);
            mesh.frustumCulled = false;

            const m = new THREE.Matrix4();
            let i = 0;
            for (const k of slotsForVariant) {
                const z = 12 - k * B.LENGTH;
                for (const side of [-1, 1]) {
                    m.makeTranslation(side * (B.INNER_X + B.DEPTH / 2), h / 2, z);
                    mesh.setMatrixAt(i++, m);
                }
            }
            mesh.instanceMatrix.needsUpdate = true;

            const group = new THREE.Group();
            group.add(mesh);
            this.scene.add(group);
            this.bands.push({ group, period: V * B.LENGTH, id: `building:${v}` });
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
