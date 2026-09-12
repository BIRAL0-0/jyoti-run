/**
 * make-ground-tile.mjs — turn a perspective ground photo into a square,
 * truly seamless, tileable texture.
 *
 * Why this exists
 * ---------------
 * `assets/source-art/ground-gravel-source.png` is a *photograph* of gravel
 * taken in perspective: the far field fades into transparency near the
 * horizon, and the tile is portrait (1024×1536). Tiled raw it shows hard
 * seams — the wrap-around row pair differs from an average interior row pair
 * by ~14×, so the repeat is obvious.
 *
 * Pipeline
 * --------
 *   1. find the largest square of "ground" (alpha >= MIN_ALPHA) with a
 *      summed-area table, so the crop never includes horizon transparency
 *   2. crop it and flatten alpha to 255 (the source carries a uniform
 *      alpha of 249 — visually opaque, but it would still blend 2% of the
 *      grass through the ground)
 *   3. upscale to (N + B)² with ImageMagick Lanczos — we need N + B source
 *      pixels because step 4 borrows a B-wide continuation band
 *   4. WRAP CROSS-FADE: blend each pixel with its sample one tile away
 *      (x + N, y + N) using a smoothstep weight that is 1 on the tile edge
 *      and 0 at B pixels in. This is what makes it tileable —
 *
 *        the last column of the tile is src(N-1), the first column is
 *        src(N); those are *adjacent* columns in the source, so the seam
 *        becomes an ordinary interior adjacency instead of a jump.
 *
 *   5. verify: seam vs interior neighbour deltas, and a 2×2 tiled seam scan
 *
 * Usage: node make-ground-tile.mjs <src.png> <out.png> [N] [B] [cropX cropY cropSize]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const MIN_ALPHA = 249;          // "this pixel is ground, not horizon"
const smoothstep = (t) => t * t * (3 - 2 * t);

const [srcFile, outFile] = process.argv.slice(2);
const N = Number(process.argv[4] || 1024);   // final tile size
const B = Number(process.argv[5] || 64);     // cross-fade band width
const cropOverride = process.argv[6]
    ? process.argv.slice(6, 9).map(Number)
    : null;

if (!srcFile || !outFile) {
    console.error('usage: node make-ground-tile.mjs <src.png> <out.png> [N] [B] [cropX cropY cropSize]');
    process.exit(1);
}

const src = PNG.sync.read(fs.readFileSync(srcFile));
const { width: W, height: H, data } = src;

// ---------------------------------------------------------------- 1. crop
function largestGroundSquare() {
    // summed-area table of "not ground" pixels
    const sat = new Int32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) {
        let row = 0;
        for (let x = 0; x < W; x++) {
            row += data[(y * W + x) * 4 + 3] < MIN_ALPHA ? 1 : 0;
            sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row;
        }
    }
    const bad = (x, y, w, h) =>
        sat[(y + h) * (W + 1) + x + w] - sat[y * (W + 1) + x + w]
        - sat[(y + h) * (W + 1) + x] + sat[y * (W + 1) + x];
    for (let n = Math.min(W, H); n >= 128; n--) {
        for (let y = 0; y + n <= H; y++) {
            for (let x = 0; x + n <= W; x++) {
                if (bad(x, y, n, n) === 0) return { x, y, n };
            }
        }
    }
    throw new Error('no fully-opaque ground square found');
}

const crop = cropOverride
    ? { x: cropOverride[0], y: cropOverride[1], n: cropOverride[2] }
    : largestGroundSquare();
console.log(`crop: ${crop.n}×${crop.n} at (${crop.x}, ${crop.y})`);

// flatten alpha while cropping (source alpha is a uniform 249 — opaque in
// practice, but it would still let 2% of the grass bleed through)
const flat = new PNG({ width: crop.n, height: crop.n });
for (let y = 0; y < crop.n; y++) {
    for (let x = 0; x < crop.n; x++) {
        const s = ((crop.y + y) * W + crop.x + x) * 4;
        const d = (y * crop.n + x) * 4;
        flat.data[d] = src.data[s];
        flat.data[d + 1] = src.data[s + 1];
        flat.data[d + 2] = src.data[s + 2];
        flat.data[d + 3] = 255;
    }
}

// ------------------------------------------------------- 3. upscale to N+B
const tmp = path.join(os.tmpdir(), `ground-src-${process.pid}.png`);
const tmpUp = path.join(os.tmpdir(), `ground-up-${process.pid}.png`);
fs.writeFileSync(tmp, PNG.sync.write(flat));
execFileSync('convert', [tmp, '-filter', 'Lanczos', '-resize', `${N + B}x${N + B}!`, tmpUp]);
const up = PNG.sync.read(fs.readFileSync(tmpUp));
fs.unlinkSync(tmp);
fs.unlinkSync(tmpUp);
if (up.width !== N + B || up.height !== N + B) {
    throw new Error(`resize produced ${up.width}×${up.height}, expected ${N + B}²`);
}

// ------------------------------------------------------- 4. wrap cross-fade
const S = N + B;
const out = new PNG({ width: N, height: N });
const px = (x, y, c) => up.data[((y % S) * S + (x % S)) * 4 + c];

for (let y = 0; y < N; y++) {
    const uy = y < B ? 1 - smoothstep(y / B) : 0;
    for (let x = 0; x < N; x++) {
        const ux = x < B ? 1 - smoothstep(x / B) : 0;
        const w00 = (1 - ux) * (1 - uy);
        const w10 = ux * (1 - uy);
        const w01 = (1 - ux) * uy;
        const w11 = ux * uy;
        const d = (y * N + x) * 4;
        for (let c = 0; c < 3; c++) {
            out.data[d + c] = Math.round(
                w00 * px(x, y, c) + w10 * px(x + N, y, c)
                + w01 * px(x, y + N, c) + w11 * px(x + N, y + N, c)
            );
        }
        out.data[d + 3] = 255;
    }
}
fs.writeFileSync(outFile, PNG.sync.write(out));

// ------------------------------------------------------------- 5. verify
function seamReport(png) {
    const { width: w, height: h, data: d } = png;
    const lum = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) {
        const i = p * 4;
        lum[p] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    }
    const colDiff = (a, b) => {
        let s = 0;
        for (let y = 0; y < h; y++) s += Math.abs(lum[y * w + a] - lum[y * w + b]);
        return s / h;
    };
    const rowDiff = (a, b) => {
        let s = 0;
        for (let x = 0; x < w; x++) s += Math.abs(lum[a * w + x] - lum[b * w + x]);
        return s / w;
    };
    let cs = 0;
    for (let x = 0; x < w - 1; x++) cs += colDiff(x, x + 1);
    const interiorCol = cs / (w - 1);
    let rs = 0;
    for (let y = 0; y < h - 1; y++) rs += rowDiff(y, y + 1);
    const interiorRow = rs / (h - 1);
    const seamCol = colDiff(w - 1, 0);
    const seamRow = rowDiff(h - 1, 0);
    return {
        size: `${w}×${h}`,
        col: { seam: +seamCol.toFixed(3), interior: +interiorCol.toFixed(3), ratio: +(seamCol / interiorCol).toFixed(2) },
        row: { seam: +seamRow.toFixed(3), interior: +interiorRow.toFixed(3), ratio: +(seamRow / interiorRow).toFixed(2) },
    };
}

console.log('\nbefore (raw source crop):');
console.log(JSON.stringify(seamReport(flat), null, 2));
console.log('\nafter (seamless tile):');
console.log(JSON.stringify(seamReport(out), null, 2));
console.log(`\nwrote ${outFile} — ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`);
