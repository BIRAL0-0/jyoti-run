/**
 * analyze-tile.mjs — numeric inspection of a candidate tileable texture.
 *
 * Reports:
 *  - size / alpha coverage / opaque bounding box
 *  - luminance stats (mean, stddev) so we can tell gravel from sky
 *  - SEAM ERROR: how different the wrap-around neighbours are (column N-1 ->
 *    column 0, row N-1 -> row 0) versus the average interior neighbour pair.
 *    A tile is "seamless enough" when seamError is close to interiorError.
 *
 * Usage: node analyze-tile.mjs <file.png> [cropX cropY cropSize]
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const file = process.argv[2];
let png = PNG.sync.read(fs.readFileSync(file));

if (process.argv[3]) {
    const [cx, cy, size] = process.argv.slice(3, 6).map(Number);
    const out = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const s = ((cy + y) * png.width + (cx + x)) * 4;
            const d = (y * size + x) * 4;
            out.data[d] = png.data[s];
            out.data[d + 1] = png.data[s + 1];
            out.data[d + 2] = png.data[s + 2];
            out.data[d + 3] = png.data[s + 3];
        }
    }
    png = out;
}

const { width: W, height: H, data } = png;

// ---- alpha / opaque bbox -------------------------------------------------
let opaque = 0, minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] > 250) {
            opaque++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
}

// ---- luminance stats -----------------------------------------------------
const lum = new Float32Array(W * H);
let sum = 0;
for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    lum[p] = l; sum += l;
}
const mean = sum / (W * H);
let varSum = 0;
for (let p = 0; p < W * H; p++) varSum += (lum[p] - mean) ** 2;
const stddev = Math.sqrt(varSum / (W * H));

// ---- seam vs interior ----------------------------------------------------
function colPairDiff(a, b) {
    let s = 0;
    for (let y = 0; y < H; y++) s += Math.abs(lum[y * W + a] - lum[y * W + b]);
    return s / H;
}
function rowPairDiff(a, b) {
    let s = 0;
    for (let x = 0; x < W; x++) s += Math.abs(lum[a * W + x] - lum[b * W + x]);
    return s / W;
}

// interior baseline: average over all adjacent pairs
let colSum = 0;
for (let x = 0; x < W - 1; x++) colSum += colPairDiff(x, x + 1);
const interiorCol = colSum / (W - 1);
let rowSum = 0;
for (let y = 0; y < H - 1; y++) rowSum += rowPairDiff(y, y + 1);
const interiorRow = rowSum / (H - 1);

const seamCol = colPairDiff(W - 1, 0);   // wrap-around column pair
const seamRow = rowPairDiff(H - 1, 0);   // wrap-around row pair

// also RGB-space seam, not just luminance
function rgbColDiff(a, b) {
    let s = 0;
    for (let y = 0; y < H; y++) {
        const i = (y * W + a) * 4, j = (y * W + b) * 4;
        s += Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
    }
    return s / (H * 3);
}
function rgbRowDiff(a, b) {
    let s = 0;
    for (let x = 0; x < W; x++) {
        const i = (a * W + x) * 4, j = (b * W + x) * 4;
        s += Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
    }
    return s / (W * 3);
}
let rgbColSum = 0;
for (let x = 0; x < W - 1; x++) rgbColSum += rgbColDiff(x, x + 1);
const rgbInteriorCol = rgbColSum / (W - 1);
let rgbRowSum = 0;
for (let y = 0; y < H - 1; y++) rgbRowSum += rgbRowDiff(y, y + 1);
const rgbInteriorRow = rgbRowSum / (H - 1);

const pct = (v) => (v / 255 * 100).toFixed(2) + '%';
const ratio = (a, b) => (b > 0 ? (a / b) : Infinity).toFixed(2);

console.log(JSON.stringify({
    file, size: `${W}×${H}`,
    opaquePct: +(opaque / (W * H) * 100).toFixed(2),
    opaqueBBox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    luminance: { mean: +mean.toFixed(2), stddev: +stddev.toFixed(2) },
    seam: {
        col: { wrap: +seamCol.toFixed(3), interior: +interiorCol.toFixed(3), ratio: ratio(seamCol, interiorCol) },
        row: { wrap: +seamRow.toFixed(3), interior: +interiorRow.toFixed(3), ratio: ratio(seamRow, interiorRow) },
    },
    seamRGB: {
        col: { wrap: +rgbColDiff(W - 1, 0).toFixed(3), interior: +rgbInteriorCol.toFixed(3), ratio: ratio(rgbColDiff(W - 1, 0), rgbInteriorCol) },
        row: { wrap: +rgbRowDiff(H - 1, 0).toFixed(3), interior: +rgbInteriorRow.toFixed(3), ratio: ratio(rgbRowDiff(H - 1, 0), rgbInteriorRow) },
    },
}, null, 2));
console.log(`\nseam luminance: col wrap ${pct(seamCol)} vs interior ${pct(interiorCol)} (×${ratio(seamCol, interiorCol)}) | row wrap ${pct(seamRow)} vs interior ${pct(interiorRow)} (×${ratio(seamRow, interiorRow)})`);
