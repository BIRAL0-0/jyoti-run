/**
 * CharacterBody — authors a fully-3D (closed, all-sides) male humanoid around
 * the CC0 rig bones, with wardrobes that MATCH the shipped reference PNGs:
 *
 *   STUDENT (assets/source-art/student-*.png): black suit (blazer + trousers),
 *     lavender collared shirt + dark tie, BLUE LANYARD with an ID badge, curly
 *     black hair, black dress shoes.
 *   TEACHER (assets/source-art/teacher-*.png): grey baseball CAP, blue
 *     short-sleeve POLO (collar + placket + chest logo), blue JEANS with back
 *     pockets, grey/white SNEAKERS, a WHISTLE on a ring at the belt.
 *
 * Geometry is generated in rig bind space (feet y=0, T-pose). Limbs/torso are
 * smooth skinned tubes that bend at the joints; head/hands/feet/hair/clothing
 * props are rigid blobs bound to one bone. Back-facing details (suit vent,
 * cap strap, jean pockets, sneaker heels) are included because the chase camera
 * mostly sees the runner from behind.
 */
import * as THREE from 'three';
import { buildChainTube, buildBlob, buildCap } from './skinning.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function place(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    _q.setFromEuler(new THREE.Euler(rx, ry, rz));
    _v.set(x, y, z); _s.set(sx, sy, sz);
    return _m.compose(_v, _q, _s).clone();
}

/**
 * @param {object} rig { byName, index(name), pos(name) }
 * @param {object} spec outfit/proportions (see CharacterFactory)
 * @returns {{geometry:THREE.BufferGeometry, material:THREE.Material}[]}
 */
export function buildCharacterParts(rig, spec) {
    const parts = [];
    const add = (geometry, material) => parts.push({ geometry, material });
    const P = (n) => rig.pos(n);
    const I = (n) => rig.index(n);
    const M = spec.materials;
    const bulk = spec.bulk ?? 1;
    const R = spec.radial;
    const o = spec.outfit;             // 'suit' | 'polo'

    const hips = P('hips'), spine = P('spine'), chest = P('chest'), head = P('head');
    const shoulderY = chest.y + 0.13;
    const front = 1;                   // bind-space forward = +Z
    const back = -1;

    // ============================================================== TORSO ====
    // Jacket (suit) is slightly roomier + flares at the hem; polo is slimmer.
    const jacket = o === 'suit';
    add(buildChainTube({
        points: [hips.clone(), spine.clone(), chest.clone(), new THREE.Vector3(0, shoulderY, 0)],
        boneIds: [I('hips'), I('spine'), I('chest'), I('chest')], radial: R,
        stations: [
            { t: 0.00, rx: (jacket ? 0.165 : 0.155) * bulk, rz: (jacket ? 0.140 : 0.130) * bulk },
            { t: 0.30, rx: (jacket ? 0.155 : 0.145) * bulk, rz: (jacket ? 0.130 : 0.122) * bulk },
            { t: 0.62, rx: (jacket ? 0.170 : 0.165) * bulk, rz: (jacket ? 0.132 : 0.128) * bulk },
            { t: 0.86, rx: (jacket ? 0.198 : 0.192) * bulk, rz: (jacket ? 0.126 : 0.122) * bulk },
            { t: 1.00, rx: (jacket ? 0.170 : 0.165) * bulk, rz: (jacket ? 0.108 : 0.105) * bulk },
        ],
    }), M.top);
    add(buildCap(new THREE.Vector3(0, shoulderY, 0), 0.17 * bulk, 0.108 * bulk,
        new THREE.Vector3(0, 1, 0), I('chest'), R), M.top);
    // jacket/polo hem (below the hips) so the top isn't a floating shell
    add(buildChainTube({
        points: [new THREE.Vector3(0, hips.y + 0.06, 0), new THREE.Vector3(0, hips.y - (jacket ? 0.20 : 0.12), 0)],
        boneIds: [I('hips'), I('hips')], radial: R,
        stations: [
            { t: 0, rx: (jacket ? 0.168 : 0.156) * bulk, rz: (jacket ? 0.142 : 0.132) * bulk },
            { t: 1, rx: (jacket ? 0.176 : 0.160) * bulk, rz: (jacket ? 0.150 : 0.136) * bulk },
        ],
    }), M.top);

    // ============================================================== NECK =====
    add(buildChainTube({
        points: [new THREE.Vector3(0, shoulderY - 0.02, 0), head.clone()],
        boneIds: [I('chest'), I('head')], radial: R,
        stations: [{ t: 0, rx: 0.062, rz: 0.062 }, { t: 1, rx: 0.058, rz: 0.058 }],
    }), M.skin);
    // collar ring (white shirt collar for the suit; folded polo collar otherwise)
    add(buildBlob(new THREE.TorusGeometry(0.085, 0.028, 8, 18),
        place(0, shoulderY + 0.02, 0, 1, 1, 1, Math.PI / 2, 0, 0), I('chest')), M.collar);

    // ============================================================== HEAD =====
    const skullY = head.y + 0.135;
    add(buildBlob(new THREE.SphereGeometry(0.155, 22, 16),
        place(0, skullY, 0.005, 1, 1.12, 1.02), I('head')), M.skin);
    add(buildBlob(new THREE.SphereGeometry(0.10, 14, 12),
        place(0, skullY - 0.075, 0.045, 0.92, 0.78, 0.95), I('head')), M.skin);   // jaw
    for (const sx of [-1, 1]) {                                                    // ears
        add(buildBlob(new THREE.SphereGeometry(0.035, 8, 8),
            place(sx * 0.15, skullY - 0.005, 0, 0.5, 1, 0.8), I('head')), M.skin);
    }
    add(buildBlob(new THREE.ConeGeometry(0.028, 0.06, 8),                          // nose
        place(0, skullY - 0.01, 0.155 * front, 1, 1, 1, Math.PI / 2, 0, 0), I('head')), M.skin);
    for (const sx of [-1, 1]) {                                                    // eyes + brows
        add(buildBlob(new THREE.SphereGeometry(0.028, 10, 8),
            place(sx * 0.062, skullY + 0.015, 0.132 * front, 1, 1, 0.6), I('head')), M.eyeWhite);
        add(buildBlob(new THREE.SphereGeometry(0.014, 8, 8),
            place(sx * 0.062, skullY + 0.013, 0.152 * front, 1, 1, 0.6), I('head')), M.eyeDark);
        add(buildBlob(new THREE.BoxGeometry(0.06, 0.012, 0.02),
            place(sx * 0.062, skullY + 0.055, 0.135 * front), I('head')), M.hair);
    }
    add(buildBlob(new THREE.BoxGeometry(0.055, 0.012, 0.015),                      // mouth
        place(0, skullY - 0.075, 0.132 * front), I('head')), M.mouth);

    // ============================================================== HAIR =====
    buildHair(add, spec, I, skullY, M);

    // ============================================================ HEADWEAR ===
    if (spec.headwear === 'cap') buildCapHat(add, I, skullY, M);

    // ============================================================== ARMS =====
    const longSleeve = o === 'suit';
    for (const side of ['l', 'r']) {
        const sh = P('upperarm' + side), el = P('lowerarm' + side), wr = P('wrist' + side);
        const sleeveMat = M.top;
        const foreMat = longSleeve ? M.top : M.skin;
        add(buildBlob(new THREE.SphereGeometry(0.078 * bulk, 12, 10),              // shoulder
            place(sh.x, sh.y, sh.z), I('upperarm' + side)), sleeveMat);
        if (longSleeve) {
            add(buildChainTube({                                                   // full blazer sleeve
                points: [sh.clone(), el.clone(), wr.clone()],
                boneIds: [I('upperarm' + side), I('lowerarm' + side), I('wrist' + side)],
                radial: R,
                stations: [
                    { t: 0, rx: 0.070 * bulk, rz: 0.070 * bulk },
                    { t: 0.5, rx: 0.058 * bulk, rz: 0.058 * bulk },
                    { t: 1, rx: 0.049 * bulk, rz: 0.049 * bulk },
                ],
            }), sleeveMat);
            add(buildBlob(new THREE.TorusGeometry(0.05, 0.014, 8, 14),             // shirt cuff
                place(wr.x, wr.y, wr.z, 1, 1, 1, 0, 0, Math.PI / 2), I('wrist' + side)), M.collar);
        } else {
            add(buildChainTube({                                                   // short polo sleeve
                points: [sh.clone(), el.clone()],
                boneIds: [I('upperarm' + side), I('lowerarm' + side)], radial: R,
                stations: [
                    { t: 0, rx: 0.075 * bulk, rz: 0.075 * bulk },
                    { t: 0.72, rx: 0.066 * bulk, rz: 0.066 * bulk },
                    { t: 1, rx: 0.068 * bulk, rz: 0.068 * bulk },                  // hem flare
                ],
            }), sleeveMat);
            add(buildChainTube({                                                   // bare forearm
                points: [el.clone(), wr.clone()],
                boneIds: [I('lowerarm' + side), I('wrist' + side)], radial: R,
                stations: [{ t: 0, rx: 0.055 * bulk, rz: 0.055 * bulk }, { t: 1, rx: 0.044 * bulk, rz: 0.044 * bulk }],
            }), M.skin);
        }
        const hand = P('hand' + side);
        add(buildBlob(new THREE.SphereGeometry(0.055, 10, 8),
            place(hand.x, hand.y - 0.01, hand.z, 0.8, 1.15, 0.6), I('hand' + side)), M.skin);
    }

    // polo placket + chest logo (front)
    if (o === 'polo') {
        add(buildBlob(new THREE.BoxGeometry(0.05, 0.16, 0.02),
            place(0, chest.y + 0.06, 0.13 * front), I('chest')), M.collar);
        for (const yy of [0.10, 0.045]) {
            add(buildBlob(new THREE.SphereGeometry(0.011, 8, 6),
                place(0, chest.y + yy, 0.145 * front), I('chest')), M.eyeWhite);
        }
        add(buildBlob(new THREE.BoxGeometry(0.05, 0.02, 0.01),
            place(-0.09, chest.y + 0.10, 0.125 * front), I('chest')), M.accent);   // logo
    }

    // suit front: shirt V, lapels, tie, buttons, lanyard + ID badge
    if (o === 'suit') {
        add(buildBlob(new THREE.BoxGeometry(0.10, 0.20, 0.02),                     // shirt V
            place(0, chest.y + 0.10, 0.128 * front, 1, 1, 1, 0.12, 0, 0), I('chest')), M.shirt);
        for (const sx of [-1, 1]) {                                                // lapels
            add(buildBlob(new THREE.BoxGeometry(0.07, 0.26, 0.02),
                place(sx * 0.055, chest.y + 0.06, 0.135 * front, 1, 1, 1, 0.10, 0, sx * -0.35), I('chest')), M.top);
        }
        add(buildBlob(new THREE.BoxGeometry(0.05, 0.30, 0.02),                     // tie
            place(0, chest.y - 0.02, 0.14 * front, 1, 1, 1, 0.06, 0, 0), I('chest')), M.tie);
        add(buildBlob(new THREE.BoxGeometry(0.07, 0.05, 0.02),                     // tie knot
            place(0, chest.y + 0.15, 0.145 * front), I('chest')), M.tie);
        for (const yy of [-0.06, -0.16]) {                                         // jacket buttons
            add(buildBlob(new THREE.SphereGeometry(0.016, 8, 6),
                place(0.02, chest.y + yy, 0.15 * front), I('chest')), M.metal);
        }
        for (const sx of [-1, 1]) {                                                // lanyard straps
            add(buildBlob(new THREE.BoxGeometry(0.025, 0.34, 0.012),
                place(sx * 0.05, chest.y + 0.04, 0.15 * front, 1, 1, 1, 0.1, 0, sx * 0.22), I('chest')), M.lanyard);
        }
        add(buildBlob(new THREE.BoxGeometry(0.10, 0.13, 0.015),                    // ID badge
            place(0, chest.y - 0.16, 0.155 * front), I('chest')), M.badge);
        add(buildBlob(new THREE.BoxGeometry(0.055, 0.06, 0.017),                   // badge photo
            place(0, chest.y - 0.15, 0.162 * front), I('chest')), M.shirt);
        // back vent seam
        add(buildBlob(new THREE.BoxGeometry(0.012, 0.30, 0.012),
            place(0, hips.y + 0.02, -0.15 * front), I('hips')), M.metal);
    }

    // ============================================================== LEGS =====
    for (const side of ['l', 'r']) {
        const hp = P('upperleg' + side), kn = P('lowerleg' + side), an = P('foot' + side);
        add(buildBlob(new THREE.SphereGeometry(0.10 * bulk, 12, 10),               // hip
            place(hp.x, hp.y, hp.z), I('upperleg' + side)), M.trouser);
        add(buildChainTube({                                                       // thigh (trousers)
            points: [hp.clone(), kn.clone()],
            boneIds: [I('upperleg' + side), I('lowerleg' + side)], radial: R,
            stations: [
                { t: 0, rx: 0.098 * bulk, rz: 0.100 * bulk },
                { t: 1, rx: 0.070 * bulk, rz: 0.073 * bulk },
            ],
        }), M.trouser);
        add(buildChainTube({                                                       // shin (trousers)
            points: [kn.clone(), an.clone()],
            boneIds: [I('lowerleg' + side), I('foot' + side)], radial: R,
            stations: [
                { t: 0, rx: 0.068 * bulk, rz: 0.070 * bulk },
                { t: 0.75, rx: 0.056 * bulk, rz: 0.058 * bulk },
                { t: 1, rx: 0.052 * bulk, rz: 0.055 * bulk },
            ],
        }), M.trouser);
        buildShoe(add, spec, I, an, side, M);
    }
    // jean back pockets (visible from the chase camera)
    if (spec.bottomDetail === 'jeans') {
        for (const sx of [-1, 1]) {
            add(buildBlob(new THREE.BoxGeometry(0.11, 0.12, 0.015),
                place(sx * 0.085, hips.y - 0.02, -0.135 * front, 1, 1, 1, 0, 0, sx * 0.06), I('hips')), M.stitch);
        }
        add(buildBlob(new THREE.BoxGeometry(0.012, 0.10, 0.012),                   // back belt loop / seam
            place(0, hips.y + 0.03, -0.14 * front), I('hips')), M.stitch);
    }

    // ========================================================= ACCESSORIES ===
    if (spec.accessory === 'whistle') {
        // a whistle on a ring at the belt, front-right (as in the PNG)
        add(buildBlob(new THREE.TorusGeometry(0.035, 0.006, 6, 14),
            place(-0.10, hips.y + 0.02, 0.12 * front, 1, 1, 1, Math.PI / 2, 0, 0), I('hips')), M.metal);
        add(buildBlob(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 10),
            place(-0.10, hips.y - 0.03, 0.13 * front, 1, 1, 1, 0, 0, 0.3), I('hips')), M.metal);
    }

    return parts;
}

// ---------------------------------------------------------------- shoes -----
function buildShoe(add, spec, I, an, side, M) {
    const bone = I('foot' + side), toe = I('toes' + side);
    if (spec.shoeStyle === 'dress') {
        // sleek black dress shoe: low profile, slight heel
        add(buildBlob(new THREE.BoxGeometry(0.10, 0.07, 0.26),
            place(an.x, an.y - 0.015, an.z + 0.06), bone), M.shoe);
        add(buildBlob(new THREE.SphereGeometry(0.05, 10, 8),
            place(an.x, an.y - 0.005, an.z + 0.18, 1, 0.6, 1.25), toe), M.shoe);
        add(buildBlob(new THREE.BoxGeometry(0.10, 0.02, 0.26),                   // thin sole
            place(an.x, an.y - 0.05, an.z + 0.06), bone), M.sole);
        add(buildBlob(new THREE.BoxGeometry(0.09, 0.03, 0.06),                 // heel
            place(an.x, an.y - 0.045, an.z - 0.05), bone), M.sole);
    } else {
        // chunky sneaker: dark upper + thick white sole + heel tab
        add(buildBlob(new THREE.BoxGeometry(0.105, 0.085, 0.26),
            place(an.x, an.y - 0.005, an.z + 0.05), bone), M.shoe);
        add(buildBlob(new THREE.SphereGeometry(0.055, 10, 8),
            place(an.x, an.y + 0.005, an.z + 0.17, 1, 0.7, 1.25), toe), M.shoe);
        add(buildBlob(new THREE.BoxGeometry(0.115, 0.035, 0.28),               // white sole
            place(an.x, an.y - 0.055, an.z + 0.05), bone), M.sole);
        add(buildBlob(new THREE.BoxGeometry(0.05, 0.05, 0.02),                 // heel tab
            place(an.x, an.y + 0.02, an.z - 0.075), bone), M.sole);
    }
}

// ---------------------------------------------------------------- hair ------
function buildHair(add, spec, I, skullY, M) {
    const style = spec.hairStyle;
    if (style === 'curly') {
        // student: a cap of tight curls — base dome + clustered spheres
        add(buildBlob(new THREE.SphereGeometry(0.163, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
            place(0, skullY + 0.005, -0.01, 1.02, 1.12, 1.05), I('head')), M.hair);
        const rnd = mulberry(7);
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const rr = 0.13 + (i % 3) * 0.015;
            const yy = skullY + 0.10 + ((i % 4) - 1.5) * 0.02;
            add(buildBlob(new THREE.SphereGeometry(0.05 + rnd() * 0.02, 8, 8),
                place(Math.cos(a) * rr, yy, Math.sin(a) * rr * 0.9 - 0.01), I('head')), M.hair);
        }
        // fringe over the forehead
        add(buildBlob(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
            place(0, skullY + 0.05, 0.04, 1.12, 0.85, 0.95), I('head')), M.hair);
    } else {
        // teacher: short cropped hair (mostly hidden under the cap)
        add(buildBlob(new THREE.SphereGeometry(0.162, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
            place(0, skullY + 0.0, -0.015, 1.02, 1.10, 1.05), I('head')), M.hair);
        // sideburns / nape
        add(buildBlob(new THREE.BoxGeometry(0.30, 0.06, 0.16),
            place(0, skullY - 0.05, -0.04), I('head')), M.hair);
    }
}

// ------------------------------------------------------------- baseball cap -
function buildCapHat(add, I, skullY, M) {
    // dome
    add(buildBlob(new THREE.SphereGeometry(0.175, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
        place(0, skullY + 0.015, -0.005, 1.03, 1.05, 1.06), I('head')), M.cap);
    // front brim (flattened, angled slightly down) — faces +Z (bind forward)
    add(buildBlob(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 18, 1, false, -Math.PI / 2, Math.PI),
        place(0, skullY + 0.02, 0.16, 1, 1, 1.25, Math.PI / 2, 0, 0), I('head')), M.cap);
    // top button
    add(buildBlob(new THREE.SphereGeometry(0.02, 8, 6),
        place(0, skullY + 0.185, -0.005), I('head')), M.cap);
    // back strap + opening (seen by the chase camera)
    add(buildBlob(new THREE.BoxGeometry(0.14, 0.03, 0.03),
        place(0, skullY - 0.01, -0.16), I('head')), M.cap);
    add(buildBlob(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI),
        place(0, skullY - 0.01, -0.155, 1, 1, 1, 0, 0, Math.PI), I('head')), M.capDark);
}

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
