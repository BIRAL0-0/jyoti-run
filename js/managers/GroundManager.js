/**
 * GroundManager — infinite scrolling ground + roadside dressing
 * (spec §1 + pooling per research report §4.2).
 *
 * Structure:
 *  - Ground tiles: PlaneGeometry strips (12 wide × 20 long) in a recycling
 *    ring of VISIBLE_TILES instances, rendered as a single InstancedMesh
 *    (1 draw call). The ring lives in a Group whose z position advances with
 *    the world; whenever it reaches one tile length it snaps back by exactly
 *    one period — the uniform lattice maps onto itself, so the scroll is
 *    perfectly seamless with ZERO per-frame matrix updates.
 *  - Grass apron + curb strips (static, frame the track).
 *  - Roadside decor: trees/bushes/rocks/cones on a periodic lattice per side,
 *    same group-shift trick (2 draw calls per type, static matrices).
 *  - Clouds: a handful of soft sprites drifting in the sky.
 *
 * The ground texture is the user's assets/textures/ground-gravel.png when
 * present, otherwise a procedural canvas texture (placeholderArt.js).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, GROUND, DECOR, SKY, CAMPUS } from '../config.js';
import { canvasTexture } from '../utils/AssetLoader.js';
import { drawGroundTexture, drawCloud } from '../utils/placeholderArt.js';

export class GroundManager {
    /** @param {THREE.Scene} scene @param {{anisotropy:number}} opts */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.anisotropy = opts.anisotropy ?? 4;

        this.tileGroup = null;        // moving ring of ground tiles
        this.tileMesh = null;         // InstancedMesh
        this.lawnMesh = null;         // the two grass strips either side
        this.decorGroup = null;       // moving decor lattice
        this.clouds = [];
        this.usesPlaceholderArt = true;
        this._cloudTex = null;
        this._cloudDrift = 0;
    }

    /**
     * Build everything. `userTexture` overrides the procedural gravel.
     * @param {THREE.Texture|null} userTexture
     */
    load(userTexture, decorDensity = 1) {
        let texture = userTexture;
        this.usesPlaceholderArt = !userTexture;
        if (!texture) {
            texture = canvasTexture(drawGroundTexture(), {
                repeat: [1, GROUND.TEXTURE_REPEAT_Y],
                anisotropy: this.anisotropy,
            });
        }

        this._buildTiles(texture);
        this._buildApron();
        this._buildDecor(decorDensity);
        this._buildClouds();
    }

    // ------------------------------------------------------------------
    // Ground tiles (instanced recycling ring)
    // ------------------------------------------------------------------
    _buildTiles(texture) {
        const geo = new THREE.PlaneGeometry(GROUND.TILE_WIDTH, GROUND.TILE_LENGTH);
        geo.rotateX(-Math.PI / 2);                       // lie flat, +z forward
        const mat = new THREE.MeshLambertMaterial({ map: texture });
        const count = GROUND.VISIBLE_TILES;

        this.tileMesh = new THREE.InstancedMesh(geo, mat, count);
        this.tileMesh.receiveShadow = true;
        this.tileMesh.frustumCulled = false;             // spans the whole track

        const m = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            m.makeTranslation(0, 0, 10 - i * GROUND.TILE_LENGTH);
            this.tileMesh.setMatrixAt(i, m);
        }
        this.tileMesh.instanceMatrix.needsUpdate = true;

        this.tileGroup = new THREE.Group();
        this.tileGroup.add(this.tileMesh);
        this.scene.add(this.tileGroup);
    }

    // ------------------------------------------------------------------
    // Grass apron + curbs (static framing)
    // ------------------------------------------------------------------
    /**
     * Lawn either side of the track, plus the legacy kerb strips.
     *
     * The lawn used to be ONE full-width plane sitting 0.05 below the road
     * tiles. Overlapping two near-coplanar planes z-fought at grazing angles
     * (it read as "grass glitching under the road"), and the 0.05 drop meant
     * nothing else could sit flush on it.
     *
     * It is now two strips that start *under the pavement* and never pass
     * beneath the road, so they can sit at exactly y = 0 — the same level as
     * the road tiles. Fence, plants and buildings all snap to that one plane.
     */
    _buildApron() {
        const span = GROUND.VISIBLE_TILES * GROUND.TILE_LENGTH + 80;
        const zCentre = -span / 2 + 60;

        // tuck the inner edge under the pavement so no seam can show through
        const inner = CAMPUS.ENABLED && CAMPUS.SIDEWALK.ENABLED
            ? CAMPUS.SIDEWALK.INNER_X + CAMPUS.SIDEWALK.WIDTH - 0.2
            : GROUND.TILE_WIDTH / 2;
        const width = GROUND.APRON_WIDTH / 2 - inner;

        if (width > 0) {
            const geo = new THREE.PlaneGeometry(width, span);
            geo.rotateX(-Math.PI / 2);                 // lie flat at y = 0
            const lawn = new THREE.InstancedMesh(
                geo,
                new THREE.MeshLambertMaterial({ color: GROUND.GRASS_COLOR }),
                2,
            );
            lawn.receiveShadow = true;
            const m = new THREE.Matrix4();
            [-1, 1].forEach((side, i) => {
                m.makeTranslation(side * (inner + width / 2), 0, zCentre);
                lawn.setMatrixAt(i, m);
            });
            lawn.instanceMatrix.needsUpdate = true;
            this.scene.add(lawn);
            this.lawnMesh = lawn;
        }

        // Legacy blue kerb strips. The campus pavement has its own kerb lip,
        // so these are only built when the sidewalk is switched off — leaving
        // both on put two solids in the same place (the "glitched" barrier).
        if (!(CAMPUS.ENABLED && CAMPUS.SIDEWALK.ENABLED)) {
            const curbGeo = new THREE.BoxGeometry(GROUND.CURB_WIDTH, GROUND.CURB_HEIGHT, span);
            const curbMat = new THREE.MeshLambertMaterial({ color: CONFIG.OBSTACLES.COLORS.blue });
            for (const side of [-1, 1]) {
                const curb = new THREE.Mesh(curbGeo, curbMat);
                curb.position.set(
                    side * (GROUND.TILE_WIDTH / 2 + GROUND.CURB_WIDTH / 2),
                    GROUND.CURB_HEIGHT / 2,
                    zCentre,
                );
                this.scene.add(curb);
            }
        }
    }

    // ------------------------------------------------------------------
    // Roadside decor lattice (instanced, periodic)
    // ------------------------------------------------------------------
    _buildDecor(density) {
        this.decorGroup = new THREE.Group();
        const span = GROUND.VISIBLE_TILES * GROUND.TILE_LENGTH;
        const slotsPerSide = Math.max(6, Math.floor(span / DECOR.SPACING));
        const slots = [];

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < slotsPerSide; i++) {
                if (Math.random() > density) continue;   // sparse on mobile
                const z = 8 - i * DECOR.SPACING;
                const x = side * (DECOR.LANE_OFFSET_MIN + Math.random() * DECOR.LANE_OFFSET_VAR);
                slots.push(this._makeDecorSlot(x, z));
            }
        }

        // one InstancedMesh per decor type
        const byType = new Map();
        for (const slot of slots) {
            if (!byType.has(slot.type)) byType.set(slot.type, []);
            byType.get(slot.type).push(slot);
        }
        for (const [type, list] of byType) {
            const { geometry, material } = buildDecorMesh(type);
            const mesh = new THREE.InstancedMesh(geometry, material, list.length);
            mesh.frustumCulled = false;
            const m = new THREE.Matrix4();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            const pos = new THREE.Vector3();
            list.forEach((slot, i) => {
                q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotY);
                s.setScalar(slot.scale);
                pos.set(slot.x, 0, slot.z);
                m.compose(pos, q, s);
                mesh.setMatrixAt(i, m);
            });
            mesh.instanceMatrix.needsUpdate = true;
            this.decorGroup.add(mesh);
        }
        this.scene.add(this.decorGroup);
    }

    _makeDecorSlot(x, z) {
        // weighted type pick
        let roll = Math.random(), type = DECOR.TYPES[DECOR.TYPES.length - 1].id;
        for (const t of DECOR.TYPES) {
            if (roll < t.weight) { type = t.id; break; }
            roll -= t.weight;
        }
        return {
            type,
            x,
            z,
            rotY: Math.random() * Math.PI * 2,
            scale: DECOR.SCALE_MIN + Math.random() * DECOR.SCALE_VAR,
        };
    }

    // ------------------------------------------------------------------
    // Clouds
    // ------------------------------------------------------------------
    _buildClouds() {
        this._cloudTex = canvasTexture(drawCloud(), { mipmaps: false });
        for (let i = 0; i < SKY.CLOUD_COUNT; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: this._cloudTex,
                transparent: true,
                depthWrite: false,
                fog: false,
                opacity: 0.9,
            }));
            const w = 10 + Math.random() * 14;
            sprite.scale.set(w, w * 0.6, 1);
            sprite.position.set(
                (Math.random() - 0.5) * SKY.CLOUD_SPREAD_X * 2,
                SKY.CLOUD_MIN_Y + Math.random() * (SKY.CLOUD_MAX_Y - SKY.CLOUD_MIN_Y),
                SKY.CLOUD_Z - Math.random() * 20
            );
            this.scene.add(sprite);
            this.clouds.push(sprite);
        }
    }

    // ------------------------------------------------------------------
    // Update / reset
    // ------------------------------------------------------------------

    /**
     * Scroll the world forward by `distance` units (positive z toward camera).
     * @param {number} distance
     * @param {number} deltaTime for cloud drift
     */
    update(distance, deltaTime = 0) {
        // ground ring: advance, snap back one full period when possible
        this.tileGroup.position.z += distance;
        if (this.tileGroup.position.z >= GROUND.TILE_LENGTH) {
            this.tileGroup.position.z -= GROUND.TILE_LENGTH;
        }

        // decor lattice: same trick with its own period
        this.decorGroup.position.z += distance;
        if (this.decorGroup.position.z >= DECOR.SPACING) {
            this.decorGroup.position.z -= DECOR.SPACING;
        }

        // lazy cloud drift
        this._cloudDrift = deltaTime * SKY.CLOUD_DRIFT;
        for (const cloud of this.clouds) {
            cloud.position.x += this._cloudDrift;
            if (cloud.position.x > SKY.CLOUD_SPREAD_X) cloud.position.x = -SKY.CLOUD_SPREAD_X;
        }
    }

    reset() {
        if (this.tileGroup) this.tileGroup.position.z = 0;
        if (this.decorGroup) this.decorGroup.position.z = 0;
    }
}

// ---------------------------------------------------------------------------
// Decor geometry builders (vertex-coloured merged primitives — 1 draw call
// per type). Shared module-level caches so geometries/materials are reused.
// ---------------------------------------------------------------------------
const decorCache = new Map();

function coloredGeometry(geo, hex) {
    const color = new THREE.Color(hex);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
}

function cBox(w, h, d, x, y, z, hex) {
    const g = coloredGeometry(new THREE.BoxGeometry(w, h, d), hex);
    g.translate(x, y, z);
    return g;
}

function cCone(r, h, seg, x, y, z, hex) {
    const g = coloredGeometry(new THREE.ConeGeometry(r, h, seg), hex);
    g.translate(x, y, z);
    return g;
}

function cCyl(rt, rb, h, seg, x, y, z, hex) {
    const g = coloredGeometry(new THREE.CylinderGeometry(rt, rb, h, seg), hex);
    g.translate(x, y, z);
    return g;
}

function mergedDecor(id, parts) {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const geometry = mergeGeometries(parts, false);
    return { geometry, material };
}

function buildDecorMesh(type) {
    if (decorCache.has(type)) return decorCache.get(type);
    const C = DECOR.COLORS;
    let built;
    if (type === 'tree') {
        built = mergedDecor(type, [
            cCyl(0.16, 0.22, 1.6, 5, 0, 0.8, 0, C.trunk),
            cCone(1.15, 1.7, 7, 0, 2.3, 0, C.leaf1),
            cCone(0.85, 1.4, 7, 0, 3.2, 0, C.leaf2),
        ]);
    } else if (type === 'bush') {
        built = mergedDecor(type, [
            cBox(0.9, 0.65, 0.9, 0, 0.33, 0, C.bush),
            cBox(0.55, 0.45, 0.55, 0.3, 0.75, 0.15, C.leaf2),
        ]);
    } else if (type === 'rock') {
        built = mergedDecor(type, [
            cBox(0.85, 0.55, 0.7, 0, 0.28, 0, C.rock),
            cBox(0.45, 0.35, 0.45, 0.25, 0.65, -0.1, C.rockD),
        ]);
    } else { // cone
        built = mergedDecor(type, [
            cBox(0.72, 0.08, 0.72, 0, 0.04, 0, C.coneW),
            cCone(0.3, 0.85, 8, 0, 0.5, 0, C.cone),
            cBox(0.46, 0.1, 0.46, 0, 0.5, 0, C.coneW),
        ]);
    }
    decorCache.set(type, built);
    return built;
}
