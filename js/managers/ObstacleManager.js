/**
 * ObstacleManager — spawning, pooling & collision
 * (spec §4 + pooling per research report §4.2).
 *
 * Obstacle types (config-driven):
 *  - LOW     (desk / crate / bench)  -> jump over   (solid 0 -> ~1.15)
 *  - HIGH    (barrier / gate)        -> slide under (solid 2.0 -> 3.8)
 *  - BLOCKER (locker / roadblock)    -> change lane (solid ~0 -> 4.2)
 *
 * All props are low-poly primitives (boxes/cones), vertex-coloured and
 * merged into ONE geometry per variant => 1 draw call per obstacle,
 * shared material. Everything is pooled; nothing is allocated during play.
 *
 * Fairness guards:
 *  - Rows always leave at least one lane free.
 *  - The first INTRO_ROWS rows are single LOW obstacles (tutorial).
 *  - A BLOCKER never spawns in the same lane shortly after a HIGH obstacle
 *    (the slide locks the lane — see PLAYER.SLIDE_DURATION).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, OBSTACLES, LANES } from '../config.js';
import { ObjectPool } from '../utils/ObjectPool.js';

const TYPES = OBSTACLES.TYPES;

export class ObstacleManager {
    /** @param {THREE.Scene} scene @param {{poolPerVariant?:number, shadows?:boolean}} opts */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.poolPerVariant = opts.poolPerVariant ?? 4;
        this.castShadows = opts.shadows ?? true;

        this.pools = new Map();       // variantId -> ObjectPool
        this.active = [];             // {mesh, type, variant, lane, x, z, halfW, halfD, yMin, yMax}
        this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
        this._geometries = new Map(); // variantId -> merged geometry (shared)

        // spawn pacing
        this._rowsSpawned = 0;
        this._spawnAccum = 0;
        this._currentGap = 0;
        this._lastHighAt = [-Infinity, -Infinity, -Infinity]; // lane -> z of last HIGH

        /** @type {function(number, number)|null} (lane, z) — called per spawn */
        this.onSpawned = null;
    }

    /** Build all variant geometries + pools. No async work needed. */
    init() {
        for (const [typeName, type] of Object.entries(TYPES)) {
            for (const variant of type.variants) {
                const geometry = buildVariantGeometry(typeName, variant.id);
                this._geometries.set(variant.id, geometry);
                const pool = new ObjectPool(
                    () => this._createMesh(variant.id),
                    this.poolPerVariant
                );
                // pre-warm instances stay hidden outside the scene until acquired
                this.pools.set(variant.id, pool);
            }
        }
    }

    _createMesh(variantId) {
        const mesh = new THREE.Mesh(this._geometries.get(variantId), this.material);
        mesh.castShadow = this.castShadows;
        mesh.receiveShadow = false;
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
    }

    // ------------------------------------------------------------------
    // Update: move, recycle, spawn
    // ------------------------------------------------------------------

    /**
     * @param {number} distance world units advanced this frame
     * @param {{spawnChance:number, t:number}} difficulty
     * @param {boolean} spawning enabled only during PLAYING
     */
    update(distance, difficulty, spawning = true) {
        // move + recycle (world scrolls toward the camera, +z)
        for (let i = this.active.length - 1; i >= 0; i--) {
            const o = this.active[i];
            const z = o.mesh.position.z + distance;
            o.mesh.position.z = z;
            o.z = z;
            if (z - o.halfD > OBSTACLES.DESPAWN_DISTANCE) {
                this.pools.get(o.variant.id).release(o.mesh);
                this.active.splice(i, 1);
            }
        }

        if (!spawning) return;

        // spawn pacing: rows are spaced by a randomised gap >= MIN_GAP_BETWEEN
        this._spawnAccum += distance;
        if (this._spawnAccum >= this._currentGap) {
            this._spawnAccum = 0;
            this._currentGap = this._nextGap(difficulty.t);
            if (Math.random() < difficulty.spawnChance) {
                this._spawnRow(-OBSTACLES.SPAWN_DISTANCE_AHEAD, difficulty.t);
            }
        }
    }

    _nextGap(t) {
        const base = THREE.MathUtils.lerp(26, 15, t);
        return base + Math.random() * 9;
    }

    _spawnRow(z, t) {
        // 1 or 2 obstacles, never blocking all lanes
        const doubleChance = THREE.MathUtils.lerp(
            OBSTACLES.DOUBLE_CHANCE_START, OBSTACLES.DOUBLE_CHANCE_MAX, t);
        const count = (this._rowsSpawned >= OBSTACLES.INTRO_ROWS && Math.random() < doubleChance)
            ? 2 : 1;

        // pick lanes
        const lanes = [0, 1, 2];
        shuffleInPlace(lanes);
        const chosen = lanes.slice(0, count);

        for (const lane of chosen) {
            let type = this._pickType(t);
            // slide-lock fairness guard: BLOCKER can't follow a HIGH closely
            // in the same lane (see header comment)
            if (type === 'BLOCKER'
                && Math.abs(z - this._lastHighAt[lane]) < OBSTACLES.HIGH_LOCK_SAFE_DISTANCE) {
                type = 'LOW';
            }
            const def = TYPES[type];
            const variant = def.variants[(Math.random() * def.variants.length) | 0];
            this._spawnOne(type, variant, lane, z);
        }
        this._rowsSpawned++;
    }

    _pickType(t) {
        if (this._rowsSpawned < OBSTACLES.INTRO_ROWS) return 'LOW';
        const W = OBSTACLES.WEIGHTS;
        const weights = [
            ['LOW', THREE.MathUtils.lerp(W.LOW[0], W.LOW[1], t)],
            ['HIGH', THREE.MathUtils.lerp(W.HIGH[0], W.HIGH[1], t)],
            ['BLOCKER', THREE.MathUtils.lerp(W.BLOCKER[0], W.BLOCKER[1], t)],
        ];
        let total = 0;
        for (const w of weights) total += w[1];
        let roll = Math.random() * total;
        for (const [name, w] of weights) {
            roll -= w;
            if (roll <= 0) return name;
        }
        return 'LOW';
    }

    _spawnOne(type, variant, lane, z) {
        const pool = this.pools.get(variant.id);
        const mesh = pool.acquire();
        mesh.visible = true;
        mesh.position.set(LANES.POSITIONS[lane], 0, z);
        if (type === 'HIGH') this._lastHighAt[lane] = z;
        this.active.push({
            mesh,
            type,
            variant,
            lane,
            x: LANES.POSITIONS[lane],
            z,
            halfW: variant.halfW,
            halfD: variant.halfD,
            yMin: variant.yMin,
            yMax: variant.yMax,
        });
        // let the collectible manager clear papers out of the new obstacle
        if (this.onSpawned) this.onSpawned(lane, z);
    }

    // ------------------------------------------------------------------
    // Collision (AABB intervals on a reused bounds object — zero allocation)
    // ------------------------------------------------------------------

    /**
     * @param {{x:number, z:number, halfW:number, halfD:number, yMin:number, yMax:number}} pb
     * @returns {object|null} the hit obstacle record or null
     */
    checkCollision(pb) {
        for (let i = 0; i < this.active.length; i++) {
            const o = this.active[i];
            if (Math.abs(pb.x - o.x) >= pb.halfW + o.halfW) continue;
            if (Math.abs(pb.z - o.z) >= pb.halfD + o.halfD) continue;
            if (pb.yMin >= o.yMax || pb.yMax <= o.yMin) continue;
            return o;
        }
        return null;
    }

    /**
     * Lane-occupancy probe for the collectible spawner: is the lane blocked
     * within `radius` units of z (either side)?
     */
    isLaneBlocked(lane, z, radius) {
        const x = LANES.POSITIONS[lane];
        for (let i = 0; i < this.active.length; i++) {
            const o = this.active[i];
            if (o.x !== x) continue;
            if (Math.abs(o.z - z) <= radius + o.halfD) return true;
        }
        return false;
    }

    /** Active obstacle count (debug/telemetry). */
    get count() { return this.active.length; }

    reset() {
        for (let i = this.active.length - 1; i >= 0; i--) {
            this.pools.get(this.active[i].variant.id).release(this.active[i].mesh);
        }
        this.active.length = 0;
        this._rowsSpawned = 0;
        this._spawnAccum = -OBSTACLES.START_GRACE_DISTANCE;  // opening grace
        this._currentGap = this._nextGap(0);
        this._lastHighAt = [-Infinity, -Infinity, -Infinity];
    }

    dispose() {
        for (const geo of this._geometries.values()) geo.dispose();
        this._geometries.clear();
    }
}

// ---------------------------------------------------------------------------
// Variant geometry builders — cheerful low-poly school props from primitives
// (merged + vertex-coloured => 1 draw call each; all well under 300 tris)
// ---------------------------------------------------------------------------
const variantCache = new Map();

function cBox(w, h, d, x, y, z, hex, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    return colorize(g, hex);
}

function colorize(g, hex) {
    const color = new THREE.Color(hex);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
}

function buildVariantGeometry(typeName, id) {
    const key = `${typeName}:${id}`;
    if (variantCache.has(key)) return variantCache.get(key);
    const C = OBSTACLES.COLORS;
    let parts;

    if (id === 'desk') {
        parts = [
            cBox(1.7, 0.12, 1.0, 0, 1.05, 0, C.wood),               // desktop
            cBox(0.12, 1.0, 0.12, -0.7, 0.5, -0.38, C.woodDark),    // legs
            cBox(0.12, 1.0, 0.12, 0.7, 0.5, -0.38, C.woodDark),
            cBox(0.12, 1.0, 0.12, -0.7, 0.5, 0.38, C.woodDark),
            cBox(0.12, 1.0, 0.12, 0.7, 0.5, 0.38, C.woodDark),
            cBox(0.5, 0.09, 0.35, 0.25, 1.16, 0.05, C.red),         // book
            cBox(0.4, 0.07, 0.3, -0.35, 1.14, -0.1, C.blue),        // notebook
        ];
    } else if (id === 'crate') {
        parts = [
            cBox(1.3, 1.05, 1.0, 0, 0.53, 0, C.crate),
            cBox(1.38, 0.14, 1.08, 0, 1.0, 0, C.woodDark),          // rim top
            cBox(1.38, 0.14, 1.08, 0, 0.08, 0, C.woodDark),         // rim bottom
            cBox(1.34, 0.1, 1.04, 0, 0.55, 0, C.woodDark),          // band
        ];
    } else if (id === 'bench') {
        parts = [
            cBox(1.8, 0.12, 0.5, 0, 0.92, 0, C.blue),               // seat
            cBox(0.12, 0.9, 0.45, -0.72, 0.46, 0, C.metal),         // legs
            cBox(0.12, 0.9, 0.45, 0.72, 0.46, 0, C.metal),
            cBox(1.8, 0.1, 0.12, 0, 1.32, -0.2, C.wood),            // backrest
        ];
    } else if (id === 'barrier') {
        parts = [
            cBox(0.18, 3.8, 0.18, -1.75, 1.9, 0, C.metal),          // posts
            cBox(0.18, 3.8, 0.18, 1.75, 1.9, 0, C.metal),
            cBox(3.68, 1.7, 0.12, 0, 2.95, 0, C.blue),              // banner 2.1..3.8
            cBox(3.7, 0.24, 0.14, 0, 3.0, 0, C.gold),               // gold stripe
            cBox(3.7, 0.14, 0.14, 0, 2.32, 0, C.white),             // bottom trim
        ];
    } else if (id === 'gate') {
        parts = [
            cBox(0.2, 3.9, 0.2, -1.78, 1.95, 0, C.metal),
            cBox(0.2, 3.9, 0.2, 1.78, 1.95, 0, C.metal),
            cBox(3.96, 0.45, 0.3, 0, 3.75, 0, C.blueDark),          // header 3.5..3.95
            cBox(2.7, 1.3, 0.1, 0, 2.75, 0, C.green),               // sign 2.1..3.4
            cBox(2.72, 0.18, 0.12, 0, 2.75, 0, C.white),
            cBox(0.3, 0.5, 0.3, -1.78, 0.25, 0, C.gold),            // post feet
            cBox(0.3, 0.5, 0.3, 1.78, 0.25, 0, C.gold),
        ];
    } else if (id === 'locker') {
        parts = [
            cBox(1.5, 4.2, 0.8, 0, 2.1, 0, C.lockerBlue),            // body
            cBox(0.06, 4.0, 0.82, 0, 2.1, 0, C.blueDark),           // door seam
            cBox(1.42, 0.1, 0.84, 0, 3.55, 0, C.blueDark),          // vents
            cBox(1.42, 0.1, 0.84, 0, 3.35, 0, C.blueDark),
            cBox(0.1, 0.32, 0.1, 0.5, 2.3, 0.44, C.gold),           // handle
            cBox(1.56, 0.16, 0.86, 0, 0.08, 0, C.blueDark),         // base
        ];
    } else { // roadblock
        parts = [
            cBox(2.5, 3.85, 0.14, 0, 2.25, 0, C.white),             // panel 0.32..4.2
            cBox(2.54, 0.55, 0.18, 0, 3.75, 0, C.orange),           // stripes
            cBox(2.54, 0.55, 0.18, 0, 2.1, 0, C.orange),
            cBox(0.2, 4.2, 0.2, -1.05, 2.1, 0, C.orange),           // posts
            cBox(0.2, 4.2, 0.2, 1.05, 2.1, 0, C.orange),
            cBox(0.6, 0.14, 1.0, -1.05, 0.07, 0, C.metal),          // feet
            cBox(0.6, 0.14, 1.0, 1.05, 0.07, 0, C.metal),
        ];
    }

    const geometry = mergeGeometries(parts, false);
    variantCache.set(key, geometry);
    return geometry;
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}
