/**
 * Difficulty — pure function of distance, fully config-driven
 * (research report §4.3).
 *
 *  - Speed: linear ramp 15 -> 45 via SPEED_INCREMENT/s, then flat.
 *  - Spawn chance: 25% -> 65%, smoothstep-eased between the 500 m and
 *    1500 m tier marks (no difficulty cliffs).
 *  - Grade tier: exactly per the spec table (D/C from 0 m, B from 500 m,
 *    A+ from 1500 m).
 */
import { CONFIG, GRADES, OBSTACLES } from '../config.js';

export const lerp = (a, b, t) => a + (b - a) * t;

export const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

/**
 * @param {number} distanceMeters total distance run
 * @param {number} elapsedSeconds play time
 * @returns {{speed:number, spawnChance:number, tier:object, t:number}}
 */
export function calculateDifficulty(distanceMeters, elapsedSeconds) {
    const { INITIAL_SPEED, MAX_SPEED, SPEED_INCREMENT } = CONFIG.GROUND;

    // 1) Speed: linear ramp, then capped.
    const speed = Math.min(MAX_SPEED, INITIAL_SPEED + SPEED_INCREMENT * elapsedSeconds);

    // 2) Spawn chance: 25% -> 65%, eased between the 500 m and 1500 m marks.
    const t = smoothstep(500, 1500, distanceMeters);
    const spawnChance = lerp(OBSTACLES.INITIAL_SPAWN_CHANCE, OBSTACLES.MAX_SPAWN_CHANCE, t);

    // 3) Grade tier: exactly per spec table.
    const tier = getCurrentTierInfo(distanceMeters);

    return { speed, spawnChance, tier, t };
}

/** Highest grade tier unlocked at this distance (D/C -> B -> A+). */
export function getCurrentTierInfo(distanceMeters) {
    let current = GRADES.TIERS[0];
    for (const tier of GRADES.TIERS) {
        if (distanceMeters >= tier.minDistance) current = tier;
    }
    return current;
}

/**
 * Weighted random tier for paper spawning. Only the newest distance band and
 * the one before it are eligible (spec table: 0-500 m -> D/C, 500-1500 -> C/B,
 * 1500+ -> B/A+). Within the newest band, tiers use their full spawnWeight;
 * the older band is damped by GRADES.SUPERSEDED_WEIGHT.
 * @returns {object} tier definition from CONFIG.GRADES.TIERS
 */
export function pickSpawnTier(distanceMeters, random = Math.random()) {
    const unlocked = GRADES.TIERS.filter(t => distanceMeters >= t.minDistance);
    if (unlocked.length === 0) return GRADES.TIERS[0];

    // group by distance band; keep the newest band intact and only the best
    // grade of the previous band (0-500: D/C -> 500-1500: C/B -> 1500+: B/A+)
    const bands = [];
    for (const t of unlocked) {
        if (!bands.length || bands[bands.length - 1].min !== t.minDistance) {
            bands.push({ min: t.minDistance, tiers: [] });
        }
        bands[bands.length - 1].tiers.push(t);
    }
    const kept = bands.slice(-2);
    const eligible = kept.flatMap((b, i) =>
        (i === kept.length - 1 || b.tiers.length === 1) ? b.tiers : [b.tiers[b.tiers.length - 1]]);
    const newestMin = bands[bands.length - 1].min;

    let total = 0;
    const weights = eligible.map(t => {
        const w = t.spawnWeight * (t.minDistance === newestMin ? 1 : GRADES.SUPERSEDED_WEIGHT);
        total += w;
        return w;
    });
    let roll = random * total;
    for (let i = 0; i < eligible.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return eligible[i];
    }
    return eligible[eligible.length - 1];
}
