/**
 * CollectibleManager — grade-paper pickups
 * (spec §5 + procedural paper visuals per research report §2B).
 *
 * - Each paper is a two-sided card (front + back plane share one material,
 *   so the letter is never mirrored) that spins on Y and bobs on a sine.
 * - Tier visuals: one canvas texture per tier (D brown / C gold / B royal
 *   blue / A+ hot pink) — a material swap, never a new mesh.
 * - A+ papers carry an additive glow sprite.
 * - Patterns: line (one lane), across (all lanes), arc, zigzag.
 * - Spawn tiers are distance-gated (0 / 0 / 500 / 1500 m) with the newest
 *   tier weighted up (Difficulty.pickSpawnTier).
 * - Pooled; collected list is reused (no per-frame allocation).
 */
import * as THREE from 'three';
import { CONFIG, GRADES, LANES } from '../config.js';
import { canvasTexture } from '../utils/AssetLoader.js';
import { drawPaperCard, drawGlow } from '../utils/placeholderArt.js';
import { ObjectPool } from '../utils/ObjectPool.js';
import { pickSpawnTier } from '../utils/Difficulty.js';

export class CollectibleManager {
    /**
     * @param {THREE.Scene} scene
     * @param {ObstacleManager} obstacles lane-occupancy probe
     * @param {{poolSize?:number}} opts
     */
    constructor(scene, obstacles, opts = {}) {
        this.scene = scene;
        this.obstacles = obstacles;
        this.poolSize = opts.poolSize ?? GRADES.POOL_SIZE;

        this.tierMaterials = new Map();   // grade -> MeshBasicMaterial
        this.tierTextures = new Map();
        this.glowTexture = null;
        this.pool = null;
        this.active = [];                 // paper records (see _spawnPaper)
        this.collected = [];              // reused result array

        // spawn pacing
        this._windowAccum = 0;
        this._nextWindow = 0;
        this._time = 0;

        // sparkle burst pool (A+ collection feedback)
        this._sparkles = [];
    }

    /** Build materials + pools. */
    init() {
        for (const tier of GRADES.TIERS) {
            const texture = canvasTexture(drawPaperCard(tier));
            this.tierTextures.set(tier.grade, texture);
            this.tierMaterials.set(tier.grade, new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.FrontSide,
                transparent: true,
                alphaTest: 0.05,
            }));
        }
        this.glowTexture = canvasTexture(drawGlow(), { mipmaps: false });

        const paperGeo = new THREE.PlaneGeometry(GRADES.PAPER_WIDTH, GRADES.PAPER_HEIGHT);
        this._paperGeo = paperGeo;

        this.pool = new ObjectPool(() => this._createPaper(), Math.ceil(this.poolSize / 2));

        // sparkle sprites
        for (let i = 0; i < 9; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: this.glowTexture,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                opacity: 0,
            }));
            sprite.visible = false;
            this.scene.add(sprite);
            this._sparkles.push({ sprite, life: 0, vx: 0, vy: 0 });
        }
    }

    _createPaper() {
        const group = new THREE.Group();
        const front = new THREE.Mesh(this._paperGeo, this.tierMaterials.get('C'));
        const back = new THREE.Mesh(this._paperGeo, this.tierMaterials.get('C'));
        back.rotation.y = Math.PI;
        group.add(front);
        group.add(back);

        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.glowTexture,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            opacity: 0.85,
        }));
        glow.scale.set(2.6, 2.6, 1);
        glow.visible = false;
        group.add(glow);

        group.visible = false;
        this.scene.add(group);
        // stash parts on the object for cheap per-frame updates
        group.userData = { front, back, glow };
        return group;
    }

    // ------------------------------------------------------------------
    // Update
    // ------------------------------------------------------------------

    /**
     * @param {number} deltaTime  seconds this frame
     * @param {number} distance   world units advanced this frame
     * @param {number} totalDistance total metres run (tier gating)
     * @param {{spawnChance?:number}} [difficulty]
     * @param {boolean} spawning  enabled only during PLAYING
     */
    update(deltaTime, distance, totalDistance, difficulty = {}, spawning = true) {
        this._time += deltaTime;   // animation clock (seconds)

        // move + animate + recycle
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            const z = p.group.position.z + distance;
            p.group.position.z = z;

            // bob + spin
            p.group.position.y = GRADES.FLOAT_HEIGHT
                + Math.sin(this._time * GRADES.FLOAT_BOB_SPEED + p.phase) * GRADES.FLOAT_BOB_AMOUNT;
            p.group.rotation.y += GRADES.FLOAT_ROTATION_SPEED * deltaTime;

            if (p.tier.grade === 'A+' && p.group.userData.glow.visible) {
                const pulse = 2.3 + Math.sin(this._time * 3 + p.phase) * 0.5;
                p.group.userData.glow.scale.set(pulse, pulse, 1);
            }

            if (z > 12) {   // passed the camera
                this.pool.release(p.group);
                this.active.splice(i, 1);
            }
        }

        this._updateSparkles(deltaTime);

        if (!spawning) return;

        // spawn windows
        this._windowAccum += distance;
        if (this._windowAccum >= this._nextWindow) {
            this._windowAccum = 0;
            this._nextWindow = GRADES.SPAWN_WINDOW_MIN + Math.random() * GRADES.SPAWN_WINDOW_VAR;
            if (totalDistance >= GRADES.START_GRACE_DISTANCE
                && Math.random() < GRADES.SPAWN_CHANCE) {
                this._spawnPattern(totalDistance);
            }
        }
    }

    // ------------------------------------------------------------------
    // Patterns
    // ------------------------------------------------------------------

    _spawnPattern(totalDistance) {
        const pattern = GRADES.PATTERNS[(Math.random() * GRADES.PATTERNS.length) | 0];
        const tier = pickSpawnTier(totalDistance);
        const step = GRADES.PATTERN_STEP;
        const z0 = -GRADES.SPAWN_DISTANCE_AHEAD;
        const laneCount = LANES.COUNT;

        /** @type {Array<{lane:number, dz:number}>} */
        const slots = [];

        if (pattern === 'line') {
            const lane = (Math.random() * laneCount) | 0;
            const n = GRADES.PATTERN_LENGTHS.line;
            for (let i = 0; i < n; i++) slots.push({ lane, dz: -i * step });
        } else if (pattern === 'across') {
            const rows = GRADES.PATTERN_LENGTHS.across;
            for (let r = 0; r < rows; r++) {
                for (let lane = 0; lane < laneCount; lane++) slots.push({ lane, dz: -r * step });
            }
        } else if (pattern === 'arc') {
            // curved path drifting across lanes
            const n = GRADES.PATTERN_LENGTHS.arc;
            let lane = (Math.random() * laneCount) | 0;
            let dir = Math.random() < 0.5 ? -1 : 1;
            for (let i = 0; i < n; i++) {
                slots.push({ lane, dz: -i * step });
                if (i % 2 === 1) {
                    const next = lane + dir;
                    if (next < 0 || next >= laneCount) dir = -dir;
                    lane = THREE.MathUtils.clamp(lane + dir, 0, laneCount - 1);
                }
            }
        } else { // zigzag
            const n = GRADES.PATTERN_LENGTHS.zigzag;
            const seq = [0, 1, 2, 1, 0, 1, 2];
            for (let i = 0; i < n; i++) {
                slots.push({ lane: seq[i % seq.length], dz: -i * step });
            }
        }

        for (const s of slots) {
            // never place a paper on top of an obstacle
            if (this.obstacles && this.obstacles.isLaneBlocked(s.lane, z0 + s.dz, 3.2)) continue;
            this._spawnPaper(tier, LANES.POSITIONS[s.lane], z0 + s.dz);
        }
    }

    _spawnPaper(tier, x, z) {
        if (this.active.length >= this.poolSize) return;
        const group = this.pool.acquire();
        group.visible = true;
        group.position.set(x, GRADES.FLOAT_HEIGHT, z);
        group.rotation.y = Math.random() * Math.PI * 2;
        const ud = group.userData;
        ud.front.material = this.tierMaterials.get(tier.grade);
        ud.back.material = this.tierMaterials.get(tier.grade);
        ud.glow.visible = tier.grade === 'A+';
        this.active.push({ group, tier, phase: Math.random() * Math.PI * 2 });
    }

    /** Drop papers that ended up inside a freshly spawned obstacle row. */
    evict(lane, z, radius = 5) {
        const x = LANES.POSITIONS[lane];
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            if (p.group.position.x === x && Math.abs(p.group.position.z - z) <= radius) {
                this.pool.release(p.group);
                this.active.splice(i, 1);
            }
        }
    }

    // ------------------------------------------------------------------
    // Collection
    // ------------------------------------------------------------------

    /**
     * @param {{x:number, z:number, halfW:number, halfD:number, yMin:number, yMax:number}} pb
     * @returns {Array<{tier:object, group:THREE.Group}>} reused array — consume immediately
     */
    checkCollection(pb) {
        this.collected.length = 0;
        const r = GRADES.COLLECTION_RADIUS + pb.halfW;
        const halfH = GRADES.COLLECTION_HALF_HEIGHT;
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            const dx = p.group.position.x - pb.x;
            const dz = p.group.position.z - pb.z;
            if (dx * dx + dz * dz > r * r) continue;
            const py = p.group.position.y;
            if (pb.yMin > py + halfH || pb.yMax < py - halfH) continue;
            this.active.splice(i, 1);
            this.pool.release(p.group);
            this.collected.push(p);
        }
        return this.collected;
    }

    /** A+ collect burst: additive sparkles. */
    burstAt(x, y, z, count = 4) {
        let spawned = 0;
        for (const s of this._sparkles) {
            if (s.life > 0) continue;
            s.life = 0.5;
            s.vx = (Math.random() - 0.5) * 5;
            s.vy = 1.5 + Math.random() * 2.5;
            s.sprite.position.set(x, y, z);
            s.sprite.material.opacity = 0.9;
            s.sprite.scale.setScalar(0.7 + Math.random() * 0.5);
            s.sprite.visible = true;
            if (++spawned >= count) break;
        }
    }

    _updateSparkles(dt) {
        for (const s of this._sparkles) {
            if (s.life <= 0) continue;
            s.life -= dt;
            if (s.life <= 0) {
                s.sprite.visible = false;
                continue;
            }
            s.sprite.position.x += s.vx * dt;
            s.sprite.position.y += s.vy * dt;
            s.sprite.position.z += 0;   // world moves; sparkles ride the world
            s.sprite.material.opacity = 1.8 * s.life;
            s.sprite.scale.multiplyScalar(1 + 2.2 * dt);
        }
    }

    get count() { return this.active.length; }

    reset() {
        for (let i = this.active.length - 1; i >= 0; i--) {
            this.pool.release(this.active[i].group);
        }
        this.active.length = 0;
        this.collected.length = 0;
        this._windowAccum = -GRADES.START_GRACE_DISTANCE;
        this._nextWindow = GRADES.SPAWN_WINDOW_MIN + Math.random() * GRADES.SPAWN_WINDOW_VAR;
        for (const s of this._sparkles) {
            s.life = 0;
            s.sprite.visible = false;
        }
    }
}
