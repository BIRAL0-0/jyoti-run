/**
 * analyze-walkway-tile.mjs — independent verification of the walkway tile
 * (research/WALKWAY_PLAN.md §5.1, checks T1–T6).
 *
 * It re-derives everything from the pixels alone (it does not import the
 * generator): seam error, block period by autocorrelation, running-bond phase,
 * colour-family mix, saturation ceiling, low-frequency flatness and joint
 * contrast. Exits non-zero when any threshold fails.
 *
 * Usage: node analyze-walkway-tile.mjs <tile.png>
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const file = process.argv[2];
if (!file) { console.error('usage: node analyze-walkway-tile.mjs <tile.png>'); process.exit(1); }
const { width: W, height: H, data } = PNG.sync.read(fs.readFileSync(file));

const lum = new Float64Array(W * H);
for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    lum[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
}
let meanL = 0;
for (let p = 0; p < W * H; p++) meanL += lum[p];
meanL /= W * H;

// ------------------------------------------------------------------ T1 seam
// wrap-around neighbour difference ÷ average interior neighbour difference
function colDiff(a, b) {
    let s = 0;
    for (let y = 0; y < H; y++) s += Math.abs(lum[y * W + a] - lum[y * W + b]);
    return s / H;
}
function rowDiff(a, b) {
    let s = 0;
    for (let x = 0; x < W; x++) s += Math.abs(lum[a * W + x] - lum[b * W + x]);
    return s / W;
}
let ic = 0; for (let x = 0; x < W - 1; x++) ic += colDiff(x, x + 1); ic /= W - 1;
let ir = 0; for (let y = 0; y < H - 1; y++) ir += rowDiff(y, y + 1); ir /= H - 1;
const t1 = { colRatio: +(colDiff(W - 1, 0) / ic).toFixed(3), rowRatio: +(rowDiff(H - 1, 0) / ir).toFixed(3) };

// --------------------------------------------------- T2 block period + phase
const profX = new Float64Array(W);   // column-mean luminance profile
const profY = new Float64Array(H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    profX[x] += lum[y * W + x] / H;
    profY[y] += lum[y * W + x] / W;
}
function autocorr(p) {
    const n = p.length;
    let m = 0; for (let i = 0; i < n; i++) m += p[i]; m /= n;
    const d = Float64Array.from(p, (v) => v - m);
    let denom = 0; for (let i = 0; i < n; i++) denom += d[i] * d[i];
    const r = new Float64Array(n);
    for (let lag = 1; lag < n; lag++) {
        let s = 0;
        for (let i = 0; i + lag < n; i++) s += d[i] * d[i + lag];
        r[lag] = s / denom;
    }
    return r;
}
function firstStrongPeak(r, minLag, maxLag) {
    let best = -1, bv = 0.05;
    for (let lag = minLag; lag <= maxLag; lag++) {
        if (r[lag] > r[lag - 1] && r[lag] >= r[lag + 1] && r[lag] > bv) { bv = r[lag]; best = lag; }
    }
    return { lag: best, v: +bv.toFixed(3) };
}
const BAND = 16, COLS = 48;
// --------------------------------------------- interlocking zigzag lattice
// Column lattice shifted +16 px (BAND) so red columns 15/31 are centred on
// the lane dividers x = ±2 m. Adjacent columns stagger by half a block (32 px)
// along travel. The left joint of every column is a square wave: offset +6 px
// in the middle half of that column's block (ly ∈ [16,48)), 0 in the outer
// quarters; square-wave corners at ly ∈ [16,18) ∪ [46,48), lx < 8.
// Returns { joint, k, r, lx, ly } of the OWNING block (tab pixels → k−1).
function pavCell(x, y) {
    y += 1;   // joint rows straddle the y wrap (1279 | 0) like every interior line
    const ux = ((x - BAND) % W + W) % W;
    const k = ux >> 5, lx = ux & 31;
    const yy = ((y - (k & 1) * 32) % H + H) % H;
    const ly = yy & 63;
    const mid = ly >= 16 && ly < 48;
    const kn = (k + 1) % COLS;
    const lyN = (((y - (kn & 1) * 32) % H + H) % H) & 63;
    const midN = lyN >= 16 && lyN < 48;
    if ((ly >= 16 && ly < 18) || (ly >= 46 && ly < 48)) { if (lx < 8) return { joint: true }; }
    if (!mid && lx === 0) return { joint: true };
    if (mid && (lx === 5 || lx === 6)) return { joint: true };
    if (!midN && lx === 31) return { joint: true };
    let ko = k, olx = lx;
    if (mid && lx < 5) { ko = (k + COLS - 1) % COLS; olx = lx + 32; }
    const yo = ((y - (ko & 1) * 32) % H + H) % H;
    const oly = yo & 63;
    if (oly < 2) return { joint: true };
    return { joint: false, k: ko, r: yo >> 6, lx: olx, ly: oly };
}

// along-travel profile of ONE column strip (columns stagger by 32 px, so the
// whole-image row profile would show a 32 px period)
function columnProfile(k) {
    const p = new Float64Array(H);
    const x0 = (BAND + k * 32 + 8) % W;
    for (let y = 0; y < H; y++) for (let x = x0; x < x0 + 16; x++) p[y] += lum[y * W + (x % W)] / 16;
    return p;
}
const rx = autocorr(courseProfile(0));           // one course: joints every block
const ry = autocorr(columnProfile(0));
const px = firstStrongPeak(rx, 24, 64);         // expect 32 px across (block width)
const py = firstStrongPeak(ry, 16, 128);        // expect 64 px along (one course)

// running-bond phase: best x-shift aligning course r's profile with course r+1
function courseProfile(r) {
    const p = new Float64Array(W);
    for (let y = r * 64; y < (r + 1) * 64; y++) for (let x = 0; x < W; x++) p[x] += lum[y * W + x] / 64;
    return p;
}
function bestShift(a, b) {
    let best = 0, bv = -Infinity;
    for (let s = 0; s < 32; s++) {
        let dot = 0;
        for (let x = 0; x < W; x++) dot += a[x] * b[(x + s) % W];
        if (dot > bv) { bv = dot; best = s; }
    }
    return best;
}
// adjacent-COLUMN phase along travel: best y-shift aligning column k with k+1
function bestShiftY(a, b) {
    let best = 0, bv = -Infinity;
    for (let s = 0; s < 64; s++) {
        let dot = 0;
        for (let y = 0; y < H; y++) dot += a[y] * b[(y + s) % H];
        if (dot > bv) { bv = dot; best = s; }
    }
    return best;
}
const shifts = [];
for (let k = 0; k < 48; k += 2) shifts.push(bestShiftY(columnProfile(k), columnProfile(k + 1)));
const phase = shifts.reduce((a, b) => a + b, 0) / shifts.length;

// ------------------------------------------------------- T3 colour families
// classify each block face centre by chroma: gray (R−B small), else beige
// (yellow-leaning: G−B large) vs pink (G−B small)
const fam = { gray: 0, beige: 0, pink: 0 };
const faces = [];
let redFaces = 0;
for (let r = 0; r < 20; r++) {
    for (let k = 0; k < 48; k++) {
        const cx = (BAND + k * 32 + 16) % W;
        const cy = ((k % 2) * 32 + r * 64 + 32) % H;
        if (k === 15 || k === 31) {   // red lane-line columns (tolerated, counted apart)
            let R = 0, G = 0, B = 0;   // 7×7 face-centre mean (speckle-robust)
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
                const j = (((cy + dy + H) % H) * W + cx + dx) * 4;
                R += data[j] / 49; G += data[j + 1] / 49; B += data[j + 2] / 49;
            }
            if (R - B >= 40 && R - G >= 30) redFaces++;
            continue;
        }
        const i = (cy * W + cx) * 4;
        const R = data[i], G = data[i + 1], B = data[i + 2];
        const f = (R - B) < 12 ? 'gray' : (G - B) > 12 ? 'beige' : 'pink';
        fam[f]++;
        faces.push([R, G, B]);
    }
}
const famPct = Object.fromEntries(Object.entries(fam).map(([f, n]) => [f, +(100 * n / 880).toFixed(1)]));

// --------------------------------------------------- T4 saturation / no blue
let maxSat = 0, blueDom = 0, maxYellow = 0;
for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const R = data[i], G = data[i + 1], B = data[i + 2];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx > 0) maxSat = Math.max(maxSat, (mx - mn) / mx);
    if (B > R + 10) blueDom++;
    if (R > 200 && G > 180 && B < 120) maxYellow++;
}

// --------------------------------------------- T5 low-frequency flatness
// A baked shadow/stain/patch is an APERIODIC large-scale feature. The block
// lattice itself is periodic by design, and a stain detector must not fire on
// it: a 16 px cell straddling a joint line is darker by construction, uniformly
// everywhere. So: 16× downsample → 96×80 cells; every cell has a lattice phase
// (the pattern period is 32×64 px ⇒ 2×4 phases); expected[phase] is the mean of
// all cells sharing that phase. |cell − expected(phase)| isolates exactly the
// aperiodic component — a stain would show up there, the perfect lattice does
// not. The raw deviation vs the global mean is reported too (that is the
// lattice's own grain, ≈ the joint contrast, not structure).
function cellMeans(cs) {
    const cw = W / cs, ch = H / cs, out = [];
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
        let s = 0;
        for (let y = 0; y < cs; y++) for (let x = 0; x < cs; x++) s += lum[(cy * cs + y) * W + cx * cs + x];
        out.push({ cx, cy, m: s / (cs * cs) });
    }
    return out;
}
function aperiodicDev(cells, periodX, periodY) {
    const byPhase = new Map();
    for (const c of cells) {
        const ph = (c.cx % periodX) + ',' + (c.cy % periodY);
        if (!byPhase.has(ph)) byPhase.set(ph, []);
        byPhase.get(ph).push(c.m);
    }
    const exp = new Map();
    for (const [ph, arr] of byPhase) exp.set(ph, arr.reduce((a, b) => a + b, 0) / arr.length);
    let raw = 0, ap = 0;
    for (const c of cells) {
        const ph = (c.cx % periodX) + ',' + (c.cy % periodY);
        raw = Math.max(raw, Math.abs(c.m - meanL) / meanL);
        ap = Math.max(ap, Math.abs(c.m - exp.get(ph)) / meanL);
    }
    return { raw, ap };
}
const c16 = cellMeans(16);                       // 96×80 cells (16× downsample)
const c32 = cellMeans(32);
const t5a = aperiodicDev(c16, 4, 4);   // zigzag lattice period 64×64 px             // 16 px cells vs phase expectation
const t5b = aperiodicDev(c32, 2, 2);             // 32 px cells vs phase expectation
const maxDev = t5a.ap, maxDev32 = t5b.ap;

// ------------------------------------------------------- T6 joint contrast
// joint pixels: 1 px either side of each lattice line; faces: interior ≥2 px
let jSum = 0, jN = 0, fSum = 0, fN = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = lum[y * W + x];
    if (pavCell(x, y).joint) { jSum += p; jN++; } else { fSum += p; fN++; }
}
const jointL = jSum / jN, faceL = fSum / fN;
const t6 = { joint: +jointL.toFixed(1), face: +faceL.toFixed(1), contrast: +(faceL - jointL).toFixed(1) };

// ------------------------------------------------------------------ verdicts
const checks = [
    ['T1 wrap seam invisible (ratio ≤ 1.0)', t1.colRatio <= 1.0 && t1.rowRatio <= 1.0, `${t1.colRatio} / ${t1.rowRatio}`],
    ['T2 module 32 px across, 64 px along', px.lag === 32 && py.lag === 64, `x ${px.lag} (v ${px.v}), y ${py.lag} (v ${py.v})`],
    ['T2b adjacent-column phase ≈ 32 px along travel', Math.abs(phase - 32) <= 1, `mean shift ${phase.toFixed(2)} px`],
    ['T3 all three families ≥ 8 %', famPct.gray >= 8 && famPct.beige >= 8 && famPct.pink >= 8, JSON.stringify(famPct)],
    ['T3b red lane columns 15/31 red on every course', redFaces === 40, `${redFaces}/40 red faces`],
    ['T4 max saturation ≤ 0.35', maxSat <= 0.35, maxSat.toFixed(3)],
    ['T4b no blue-dominant / vivid-yellow pixel', blueDom === 0 && maxYellow === 0, `blue ${blueDom}, yellow ${maxYellow}`],
    ['T5 no aperiodic structure at 16 px cells (≤ 4 %)', maxDev <= 0.04, `aperiodic ${(100 * maxDev).toFixed(2)} % (raw lattice grain ${(100 * t5a.raw).toFixed(2)} %)`],
    ['T5b no aperiodic structure at 32 px cells (≤ 2.5 %)', maxDev32 <= 0.025, `aperiodic ${(100 * maxDev32).toFixed(2)} % (raw ${(100 * t5b.raw).toFixed(2)} %)`],
    ['T6 joints thin + contrast in 8–45 band', t6.contrast >= 8 && t6.contrast <= 45, `contrast ${t6.contrast}`],
];

console.log(JSON.stringify({
    file, size: `${W}×${H}`, meanLum: +meanL.toFixed(1),
    t1, t2: { across: px, along: py, phaseStep: +phase.toFixed(2) },
    families: famPct, maxSat: +maxSat.toFixed(3),
    t5: {
        cells16: { aperiodic: +(100 * t5a.ap).toFixed(2) + '%', raw: +(100 * t5a.raw).toFixed(2) + '%' },
        cells32: { aperiodic: +(100 * t5b.ap).toFixed(2) + '%', raw: +(100 * t5b.raw).toFixed(2) + '%' },
    }, t6,
}, null, 2));

let failed = 0;
for (const [label, ok, detail] of checks) {
    console.log(`${ok ? '✅' : '❌'} ${label} — ${detail}`);
    if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
