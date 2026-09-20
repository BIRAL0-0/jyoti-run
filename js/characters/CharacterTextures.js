/**
 * CharacterTextures — procedural PBR-ish materials for the "semi-realistic"
 * look: skin with pores, woven fabric with a bump, streaked hair, plus plain
 * materials for shoes/props. Everything is drawn to a canvas at load and
 * cached, so the student and teacher share textures by (type, colour).
 *
 * A tiny Sobel pass turns a grayscale height canvas into a tangent-space normal
 * map, which is what makes the weave/pores catch the sun instead of looking
 * flat. Deterministic (seeded) so screenshots are stable across runs.
 */
import * as THREE from 'three';

const _cache = new Map();

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
}

function toTexture(canvas, { srgb = true, repeat = 1 } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
}

/** Sobel height→normal map. strength in world-ish units. */
function heightToNormal(heightCanvas, strength = 2.0) {
    const size = heightCanvas.width;
    const src = heightCanvas.getContext('2d').getImageData(0, 0, size, size);
    const out = makeCanvas(size);
    const dst = out.getContext('2d').createImageData(size, size);
    const at = (x, y) => {
        const xi = (x + size) % size, yi = (y + size) % size;
        return src.data[(yi * size + xi) * 4] / 255;
    };
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
            const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
            // normal = normalize(-dx, -dy, 1)
            const len = Math.hypot(dx, dy, 1);
            const o = (y * size + x) * 4;
            dst.data[o] = ((-dx / len) * 0.5 + 0.5) * 255;
            dst.data[o + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
            dst.data[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
            dst.data[o + 3] = 255;
        }
    }
    out.getContext('2d').putImageData(dst, 0, 0);
    return out;
}

function shade(hex, amt) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amt);
    return `#${c.getHexString()}`;
}

// --- skin ------------------------------------------------------------------
function skinMaps(color, size = 256) {
    const rnd = mulberry32(hashStr('skin' + color));
    const albedo = makeCanvas(size);
    const a = albedo.getContext('2d');
    a.fillStyle = color; a.fillRect(0, 0, size, size);
    // mottling
    for (let i = 0; i < 900; i++) {
        const x = rnd() * size, y = rnd() * size, r = 1 + rnd() * 5;
        a.fillStyle = rnd() > 0.5 ? shade(color, 0.03) : shade(color, -0.03);
        a.globalAlpha = 0.25; a.beginPath(); a.arc(x, y, r, 0, 7); a.fill();
    }
    a.globalAlpha = 1;
    // pore height
    const h = makeCanvas(size); const hc = h.getContext('2d');
    hc.fillStyle = '#808080'; hc.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
        const x = rnd() * size, y = rnd() * size;
        hc.fillStyle = rnd() > 0.5 ? '#8c8c8c' : '#747474';
        hc.globalAlpha = 0.5; hc.fillRect(x, y, 1.4, 1.4);
    }
    hc.globalAlpha = 1;
    return { albedo, normal: heightToNormal(h, 0.7) };
}

// --- fabric ----------------------------------------------------------------
function fabricMaps(color, size = 256, pattern = 'weave') {
    const rnd = mulberry32(hashStr('fabric' + color + pattern));
    const albedo = makeCanvas(size); const a = albedo.getContext('2d');
    a.fillStyle = color; a.fillRect(0, 0, size, size);
    const h = makeCanvas(size); const hc = h.getContext('2d');
    hc.fillStyle = '#808080'; hc.fillRect(0, 0, size, size);

    const step = 4;
    if (pattern === 'weave' || pattern === 'knit') {
        for (let y = 0; y < size; y += step) {
            for (let x = 0; x < size; x += step) {
                const over = ((x / step) + (y / step)) % 2 === 0;
                a.fillStyle = over ? shade(color, 0.035) : shade(color, -0.035);
                a.fillRect(x, y, step, step);
                hc.fillStyle = over ? '#9a9a9a' : '#6a6a6a';
                hc.fillRect(x, y, step, step);
            }
        }
    } else if (pattern === 'plaid') {
        a.fillStyle = color; a.fillRect(0, 0, size, size);
        const band = size / 6;
        a.globalAlpha = 0.35;
        a.fillStyle = shade(color, -0.18);
        for (let i = 0; i < size; i += band) { a.fillRect(i, 0, band * 0.4, size); a.fillRect(0, i, size, band * 0.4); }
        a.globalAlpha = 0.5; a.fillStyle = shade(color, 0.22);
        for (let i = 0; i < size; i += band) { a.fillRect(i + band * 0.5, 0, 2, size); a.fillRect(0, i + band * 0.5, size, 2); }
        a.globalAlpha = 1;
        hc.fillStyle = '#7a7a7a';
        for (let i = 0; i < size; i += band) hc.fillRect(i, 0, band * 0.4, size);
    } else if (pattern === 'stripe') {
        for (let x = 0; x < size; x += 8) {
            a.fillStyle = (x / 8) % 2 ? shade(color, 0.06) : shade(color, -0.06);
            a.fillRect(x, 0, 8, size);
        }
    }
    // fibre noise
    for (let i = 0; i < 1500; i++) {
        const x = rnd() * size, y = rnd() * size;
        a.fillStyle = shade(color, rnd() > 0.5 ? 0.02 : -0.02); a.globalAlpha = 0.15;
        a.fillRect(x, y, 2, 1);
        hc.fillStyle = rnd() > 0.5 ? '#8a8a8a' : '#767676'; hc.globalAlpha = 0.4; hc.fillRect(x, y, 2, 1);
    }
    a.globalAlpha = 1; hc.globalAlpha = 1;
    return { albedo, normal: heightToNormal(h, 1.1) };
}

// --- hair ------------------------------------------------------------------
function hairMaps(color, size = 256) {
    const rnd = mulberry32(hashStr('hair' + color));
    const albedo = makeCanvas(size); const a = albedo.getContext('2d');
    a.fillStyle = color; a.fillRect(0, 0, size, size);
    for (let i = 0; i < 220; i++) {
        const x = rnd() * size;
        a.strokeStyle = rnd() > 0.5 ? shade(color, 0.07) : shade(color, -0.09);
        a.globalAlpha = 0.4; a.lineWidth = 1 + rnd() * 2;
        a.beginPath(); a.moveTo(x, 0);
        a.bezierCurveTo(x + (rnd() - 0.5) * 12, size * 0.33, x + (rnd() - 0.5) * 12, size * 0.66, x + (rnd() - 0.5) * 8, size);
        a.stroke();
    }
    a.globalAlpha = 1;
    return { albedo };
}

function cached(key, fn) {
    if (!_cache.has(key)) _cache.set(key, fn());
    return _cache.get(key);
}

/**
 * Semi-realistic skin material.
 * @param {number|string} color @param {{roughness?:number}} [o]
 */
export function skinMaterial(color, o = {}) {
    const hex = typeof color === 'number' ? `#${new THREE.Color(color).getHexString()}` : color;
    return cached('skin:' + hex, () => {
        const { albedo, normal } = skinMaps(hex);
        return new THREE.MeshStandardMaterial({
            map: toTexture(albedo),
            normalMap: toTexture(normal, { srgb: false }),
            normalScale: new THREE.Vector2(0.5, 0.5),
            roughness: o.roughness ?? 0.72,
            metalness: 0.0,
        });
    });
}

/**
 * Woven/knit/plaid/stripe fabric material.
 * @param {number|string} color @param {{pattern?:string, roughness?:number, repeat?:number}} [o]
 */
export function fabricMaterial(color, o = {}) {
    const hex = typeof color === 'number' ? `#${new THREE.Color(color).getHexString()}` : color;
    const pattern = o.pattern || 'weave';
    const repeat = o.repeat ?? 3;
    return cached(`fab:${hex}:${pattern}:${repeat}`, () => {
        const { albedo, normal } = fabricMaps(hex, 256, pattern);
        return new THREE.MeshStandardMaterial({
            map: toTexture(albedo, { repeat }),
            normalMap: toTexture(normal, { srgb: false, repeat }),
            normalScale: new THREE.Vector2(0.6, 0.6),
            roughness: o.roughness ?? 0.85,
            metalness: 0.0,
        });
    });
}

/** Streaked hair material. */
export function hairMaterial(color, o = {}) {
    const hex = typeof color === 'number' ? `#${new THREE.Color(color).getHexString()}` : color;
    return cached('hair:' + hex, () => {
        const { albedo } = hairMaps(hex);
        return new THREE.MeshStandardMaterial({
            map: toTexture(albedo, { repeat: 2 }),
            roughness: o.roughness ?? 0.55,
            metalness: 0.05,
        });
    });
}

/** Plain matte/glossy material (shoes, bags, frames, eyes). */
export function plainMaterial(color, o = {}) {
    const key = `plain:${color}:${o.roughness ?? 0.6}:${o.metalness ?? 0}`;
    return cached(key, () => new THREE.MeshStandardMaterial({
        color,
        roughness: o.roughness ?? 0.6,
        metalness: o.metalness ?? 0.0,
        ...(o.emissive ? { emissive: o.emissive, emissiveIntensity: o.emissiveIntensity ?? 1 } : {}),
    }));
}

/** Dispose every cached texture/material (tests / hot reload). */
export function disposeTextures() {
    for (const m of _cache.values()) {
        m.map?.dispose?.(); m.normalMap?.dispose?.();
        m.dispose?.();
    }
    _cache.clear();
}
