/**
 * skinning.js — procedural skinned-geometry helpers.
 *
 * Characters are authored in *rig bind space* (feet at y=0, T-pose, rig units)
 * and skinned to the CC0 KayKit bones. Two builders cover the whole body:
 *
 *   buildChainTube — a surface swept along a polyline of bones (limbs, torso,
 *                    neck). Skin weights blend across each joint over a window,
 *                    so a knee/elbow/waist BENDS smoothly instead of snapping.
 *   buildBlob      — a rigid primitive bound 100% to one bone (head, hands,
 *                    feet, hair, backpack, glasses …).
 *
 * Every part is emitted NON-INDEXED with exactly {position, normal, uv,
 * skinIndex, skinWeight} so parts that share a material merge cleanly with
 * BufferGeometryUtils.mergeGeometries.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const STD_ATTRS = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'];

/** Fraction of a bone segment (at its distal end) that blends into the next. */
const JOINT_WINDOW = 0.46;

function smoothstep(edge0, edge1, x) {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function arcTable(pts) {
    const cum = [0];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { total += pts[i].distanceTo(pts[i - 1]); cum.push(total); }
    return { cum, total };
}

/** Strip non-standard attributes; keep the five merge-compatible ones. */
function finalize(geo) {
    for (const name of Object.keys(geo.attributes)) {
        if (!STD_ATTRS.includes(name)) geo.deleteAttribute(name);
    }
    return geo;
}

/**
 * Sweep an elliptical cross-section along a bone polyline.
 *
 * @param {object} o
 * @param {THREE.Vector3[]} o.points  bone world positions (bind space), n>=2
 * @param {number[]}        o.boneIds skeleton index of each point's bone
 * @param {{t:number,rx:number,rz?:number}[]} o.stations rings along the chain
 *                   t=0 at points[0], t=1 at the last point
 * @param {number} [o.radial=12] around-segments
 * @returns {THREE.BufferGeometry} non-indexed, uv + smooth skin weights
 */
export function buildChainTube({ points, boneIds, stations, radial = 12 }) {
    const { cum, total } = arcTable(points);
    const nSt = stations.length;
    const cols = radial + 1;                       // duplicate seam for clean uv/normals

    // --- build rings (positions + per-ring weights) ---
    const rings = [];                              // [{pts:[Vector3], uvU:[..], a,b,wA,wB}]
    const pos = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const bin = new THREE.Vector3();
    const ref = new THREE.Vector3();

    for (let s = 0; s < nSt; s++) {
        const st = stations[s];
        const arc = THREE.MathUtils.clamp(st.t, 0, 1) * total;
        // locate segment
        let i = 1;
        while (i < cum.length - 1 && cum[i] < arc) i++;
        const segIndex = i - 1;
        const segLen = Math.max(1e-6, cum[segIndex + 1] - cum[segIndex]);
        const u = THREE.MathUtils.clamp((arc - cum[segIndex]) / segLen, 0, 1);
        pos.lerpVectors(points[segIndex], points[segIndex + 1], u);
        tan.subVectors(points[segIndex + 1], points[segIndex]).normalize();

        if (Math.abs(tan.y) > 0.98) ref.set(1, 0, 0); else ref.set(0, 1, 0);
        nrm.crossVectors(tan, ref).normalize();
        bin.crossVectors(nrm, tan).normalize();

        const rx = st.rx, rz = st.rz ?? st.rx;
        const wB = smoothstep(1 - JOINT_WINDOW, 1, u);
        const a = boneIds[Math.min(segIndex, boneIds.length - 1)];
        const b = boneIds[Math.min(segIndex + 1, boneIds.length - 1)];

        const pts = [];
        for (let c = 0; c < cols; c++) {
            const th = (c / radial) * Math.PI * 2;
            const ct = Math.cos(th), sn = Math.sin(th);
            pts.push(new THREE.Vector3(
                pos.x + nrm.x * rx * ct + bin.x * rz * sn,
                pos.y + nrm.y * rx * ct + bin.y * rz * sn,
                pos.z + nrm.z * rx * ct + bin.z * rz * sn,
            ));
        }
        rings.push({ pts, a, b, wA: 1 - wB, wB });
    }

    // --- stitch rings into triangles (non-indexed) ---
    const positions = [], uvs = [], si = [], sw = [];
    const push = (v, uu, vv, ring) => {
        positions.push(v.x, v.y, v.z);
        uvs.push(uu, vv);
        si.push(ring.a, ring.b, 0, 0);
        sw.push(ring.wA, ring.wB, 0, 0);
    };
    for (let s = 0; s < nSt - 1; s++) {
        const r0 = rings[s], r1 = rings[s + 1];
        for (let c = 0; c < radial; c++) {
            const t0 = c / radial, t1 = (c + 1) / radial;
            const v00 = r0.pts[c], v01 = r0.pts[c + 1];
            const v10 = r1.pts[c], v11 = r1.pts[c + 1];
            const st0 = stations[s].t, st1 = stations[s + 1].t;
            push(v00, t0, st0, r0); push(v10, t0, st1, r1); push(v01, t1, st0, r0);
            push(v01, t1, st0, r0); push(v10, t0, st1, r1); push(v11, t1, st1, r1);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(si), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(sw), 4));
    geo.computeVertexNormals();
    return finalize(geo);
}

/**
 * A flat disc fan, bound 100% to one bone — used to cap an open tube end.
 * @param {THREE.Vector3} center @param {number} rx @param {number} rz
 * @param {THREE.Vector3} normal outward direction @param {number} boneId
 */
export function buildCap(center, rx, rz, normal, boneId, radial = 12) {
    const ref = Math.abs(normal.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const nrm = new THREE.Vector3().crossVectors(normal, ref).normalize();
    const bin = new THREE.Vector3().crossVectors(nrm, normal).normalize();
    const positions = [], uvs = [], si = [], sw = [];
    const ring = [];
    for (let c = 0; c <= radial; c++) {
        const th = (c / radial) * Math.PI * 2;
        ring.push(new THREE.Vector3(
            center.x + nrm.x * rx * Math.cos(th) + bin.x * rz * Math.sin(th),
            center.y + nrm.y * rx * Math.cos(th) + bin.y * rz * Math.sin(th),
            center.z + nrm.z * rx * Math.cos(th) + bin.z * rz * Math.sin(th),
        ));
    }
    for (let c = 0; c < radial; c++) {
        positions.push(center.x, center.y, center.z); uvs.push(0.5, 0.5);
        positions.push(ring[c].x, ring[c].y, ring[c].z); uvs.push(0.5, 0.5);
        positions.push(ring[c + 1].x, ring[c + 1].y, ring[c + 1].z); uvs.push(0.5, 0.5);
        for (let k = 0; k < 3; k++) { si.push(boneId, 0, 0, 0); sw.push(1, 0, 0, 0); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(si), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(sw), 4));
    geo.computeVertexNormals();
    return finalize(geo);
}

/**
 * Bind a rigid primitive 100% to one bone.
 * @param {THREE.BufferGeometry} src e.g. SphereGeometry (any three primitive)
 * @param {THREE.Matrix4|null} matrix applied to vertices (bind-space placement)
 * @param {number} boneId skeleton index
 */
export function buildBlob(src, matrix, boneId) {
    let geo = src.index ? src.toNonIndexed() : src.clone();
    if (matrix) geo.applyMatrix4(matrix);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const count = geo.attributes.position.count;
    if (!geo.attributes.uv) {
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    const si = new Uint16Array(count * 4);
    const sw = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { si[i * 4] = boneId; sw[i * 4] = 1; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return finalize(geo);
}

/**
 * Merge parts that share a material into one geometry each.
 * @param {{geometry:THREE.BufferGeometry, material:THREE.Material}[]} parts
 * @returns {{material:THREE.Material, geometry:THREE.BufferGeometry}[]}
 */
export function mergeByMaterial(parts) {
    const groups = new Map();
    for (const p of parts) {
        if (!groups.has(p.material)) groups.set(p.material, []);
        groups.get(p.material).push(p.geometry);
    }
    const out = [];
    for (const [material, geos] of groups) {
        const norm = geos.map((g) => {
            const gg = g.index ? g.toNonIndexed() : g;
            finalize(gg);
            if (!gg.attributes.uv) {
                const c = gg.attributes.position.count;
                gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c * 2), 2));
            }
            if (!gg.attributes.normal) gg.computeVertexNormals();
            return gg;
        });
        const merged = norm.length === 1 ? norm[0] : mergeGeometries(norm, false);
        if (merged) { merged.computeBoundingSphere(); out.push({ material, geometry: merged }); }
    }
    return out;
}
