/**
 * find-ground-crop.mjs — pick a clean, perspective-matched square of *pavers*
 * out of `assets/source-art/ground-gravel-source.png` for make-ground-tile.mjs.
 *
 * Why this exists
 * ---------------
 * The source is a perspective photo of the whole walkway: pavers in the
 * middle, and a concrete border + metal railing + hedge on both sides. The
 * original crop search only rejected TRANSPARENT pixels (`MIN_ALPHA`), so it
 * happily returned a square that included the left border and hedge — and the
 * shipped ground tile therefore baked a wall + railing strip into the road.
 * Tiled down the track, that reads as a duplicated border running along the
 * left lane, ending in a hard diagonal seam.
 *
 * This tool classifies every pixel as road / hedge / metal / stone / sky and
 * scores candidate squares on:
 *   purity   — fraction of non-road pixels (must be ~0)
 *   stretch  — how much the walkway narrows over the square's own y-range
 *              (the crop is stretched to fill a square tile, so a tall crop of
 *              a converging corridor bakes that convergence into the texture)
 *   tone     — luminance drift top→bottom (shadows that fade across the tile
 *              show up as bands every TILE_LENGTH metres)
 * Usage: node find-ground-crop.mjs [src.png]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = process.argv[2] || '/home/user/jyoti-run/assets/source-art/ground-gravel-source.png';
const MIN_N = Number(process.argv[3] || 300);   // smallest useful square
const MAX_N = Number(process.argv[4] || 520);   // larger = more perspective error
const STEP = 20;                                 // candidate lattice

const png = PNG.sync.read(fs.readFileSync(path.resolve(SRC)));
const { width: W, height: H, data } = png;

/** 0 = road, 1 = reject. */
function classify(x, y) {
    const i = (y * W + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 240) return 1;                                   // sky / horizon fade
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (g > r && g > b && sat > 0.18) return 1;              // hedge / plants
    if (lum < 0.28 && sat < 0.35) return 1;                  // dark metal railing
    if (lum > 0.72 && sat < 0.14) return 1;                  // pale stone kerb
    return 0;
}

const bad = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bad[y * W + x] = classify(x, y);

/** left/right road edge per scanline, from the bad map (edges = outermost run of rejects) */
const edgeL = new Int32Array(H).fill(0);
const edgeR = new Int32Array(H).fill(W - 1);
for (let y = 0; y < H; y++) {
    let l = 0;
    while (l < W && bad[y * W + l]) l++;
    let r = W - 1;
    while (r >= 0 && bad[y * W + r]) r--;
    edgeL[y] = l; edgeR[y] = r;
}

/** integral image of `bad` for fast purity queries */
const sat2 = new Int32Array((W + 1) * (H + 1));
for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
        row += bad[y * W + x];
        sat2[(y + 1) * (W + 1) + x + 1] = sat2[y * (W + 1) + x + 1] + row;
    }
}
const badCount = (x, y, n) =>
    sat2[(y + n) * (W + 1) + x + n] - sat2[y * (W + 1) + x + n]
    - sat2[(y + n) * (W + 1) + x] + sat2[y * (W + 1) + x];

const lumAt = (x, y) => {
    const i = (y * W + x) * 4;
    return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
};

const candidates = [];
for (let n = MAX_N; n >= MIN_N; n -= 10) {
    for (let y = 0; y + n <= H; y += STEP) {
        for (let x = 0; x + n <= W; x += STEP) {
            const rejects = badCount(x, y, n);
            if (rejects / (n * n) > 0.02) continue;          // keep it clean

            // stretch: road width at the bottom of the crop vs at the top.
            // 1.0 = orthographic (no convergence baked in).
            const yTop = y + 2, yBot = y + n - 2;
            const wTop = Math.max(1, edgeR[yTop] - edgeL[yTop]);
            const wBot = Math.max(1, edgeR[yBot] - edgeL[yBot]);
            const stretch = wBot / wTop;
            if (stretch > 1.35) continue;                     // too much convergence

            // tone drift: mean |lum| of the top vs bottom band
            let lt = 0, lb = 0, band = Math.max(4, Math.floor(n * 0.12));
            for (let j = 0; j < band; j++) {
                for (let i = 0; i < n; i += 3) {
                    lt += lumAt(x + i, y + j);
                    lb += lumAt(x + i, y + n - 1 - j);
                }
            }
            const samples = band * Math.ceil(n / 3);
            const drift = Math.abs(lt - lb) / samples;

            const score = n * (1 - Math.min(1, stretch - 1) * 1.2) * (1 - Math.min(1, drift * 6));
            candidates.push({ x, y, n, rejects, stretch: +stretch.toFixed(3), drift: +drift.toFixed(4), score });
        }
    }
}

candidates.sort((a, b) => b.score - a.score);
console.log(`searched ${W}×${H}; ${candidates.length} clean candidates\n`);
console.log('top candidates (x, y, n, rejects, stretch, toneDrift, score):');
for (const c of candidates.slice(0, 8)) {
    console.log(`  ${String(c.x).padStart(4)},${String(c.y).padStart(4)}  n=${c.n}`
        + `  rejects=${String(c.rejects).padStart(5)}`
        + `  stretch=${c.stretch}  drift=${c.drift}  score=${c.score.toFixed(0)}`);
}
if (candidates.length) {
    const b = candidates[0];
    console.log(`\nrecommended: node make-ground-tile.mjs <src> <out> 1024 64 ${b.x} ${b.y} ${b.n}`);
}
