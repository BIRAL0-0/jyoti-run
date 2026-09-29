/**
 * make-walkway-tile.mjs — synthesize the seamless concrete-paver walkway tile.
 *
 * Implements research/WALKWAY_PLAN.md §3 (PR 2): one purpose-built, exactly
 * seamless tile that replaces the photo crop in assets/textures/ground-gravel.png.
 * The file name is kept on purpose (it is the documented drop-in slot), only
 * the pixels change.
 *
 * Module arithmetic (plan §3.1)
 * ------------------------------
 *   image        1536 × 1280 px  = 12 m × 10 m at 128 px/m (square texels)
 *   block module 32 × 64 px      = 0.25 m across × 0.50 m along (long axis = travel)
 *   courses      12 / 0.25 = 48 blocks per course   (integer  ⇒ x wraps)
 *   rows         10 / 0.50 = 20 courses per period  (even     ⇒ the running-bond
 *                                                    stagger wraps)
 *   PR 3 (interlocking zigzag): column k is shifted along travel by
 *                (k mod 2) × 32 px (half a block); every vertical joint is a
 *                square wave (+6 px in the middle half of the block, 0 in the
 *                outer quarters) → interlocking "I" pavers across the whole
 *                walkway; column lattice shifted +16 px so red columns 15/31
 *                sit on the lane lines x = ±2 m
 *   grout        2 px warm-tan jointing-sand line
 *
 * Why this is seamless BY CONSTRUCTION (plan §2):
 *  - every block is drawn from its wrapped lattice coordinate, so the pixel at
 *    x=1535 and the pixel at x=0 are ordinary interior neighbours;
 *  - block colour is a seeded hash of the wrapped (course, column) pair, so the
 *    colour of a block that crosses the wrap agrees on both sides;
 *  - the only per-pixel randomness (aggregate speckle) is a white-noise hash,
 *    statistically identical everywhere — there is no feature with a unique
 *    location, therefore nothing the eye can use to find the repeat.
 *
 * Surface look (plan §3.2): three luminance-matched colour families (light
 * gray / warm beige / soft reddish-pink) in a 40/40/20 mix with per-block
 * lightness jitter; a constant per-block top-left → bottom-right micro-ramp
 * (sunlight bevel, identical on every block — a ramp, not a stain); a 1 px
 * chamfer highlight on the lit edges; fine per-texel speckle. No stains, moss,
 * patches, markings or baked shadows.
 *
 * The truecolour image is quantised to 256 palette entries with ImageMagick
 * (`-strip -colors 256`), the same convention the old gravel tile shipped
 * under — nearest-palette mapping, no dither, so identical colours map
 * identically and the wrap stays exact. Keeps the committed PNG ≈ 1 MB.
 *
 * Usage: node make-walkway-tile.mjs <out.png> [report.json]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

// ------------------------------------------------------------ module lattice
const PXM = 128;                       // pixels per metre (square texels)
const W = 12 * PXM;                    // 1536 px = 12 m (GROUND.TILE_WIDTH)
const H = 10 * PXM;                    // 1280 px = 10 m (TILE_LENGTH / REPEAT_Y)
const BW = Math.round(0.25 * PXM);     // 32 px block width  (across the path)
const BL = Math.round(0.50 * PXM);     // 64 px block length (along the path)
const COLS = W / BW;                   // 48
const ROWS = H / BL;                   // 20
if (W % BW !== 0 || H % BL !== 0 || ROWS % 2 !== 0) {
    throw new Error('module must divide the tile exactly and rows must be even');
}

// ------------------------------------------------------- seeded, deterministic
// 32-bit integer hash → [0,1). Same (x,y) always gives the same value; the
// values are white-noise distributed (no clusters, no structure).
function hash2(x, y, seed = 0) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 974711)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
}

// ------------------------------------------------ colour families (plan §3.2)
// The three families are matched in LUMINANCE (they differ in hue, not in
// brightness): that is what keeps the surface free of large-scale light/dark
// structure while the gray/beige/pink mix still reads clearly.
const FAMILY = {
    gray:  { rgb: [201, 200, 198] },   // L ≈ 200 (neutral)
    beige: { rgb: [209, 200, 184] },   // L ≈ 200 (yellow-leaning chroma)
    pink:  { rgb: [223, 194, 191] },   // L ≈ 200 (red-leaning chroma)
};
const FAMILY_ORDER = ['gray', 'gray', 'beige', 'beige', 'pink'];  // 40/40/20

// stratified family pick: (column + 2·row) mod 5 cycles through the five slots,
// so every five consecutive blocks in a course contain exactly one pink block
// (even local mix); the hash dither breaks the diagonal regularity.
function familyOf(k, r) {
    const dith = hash2(k, r, 11) < 0.5 ? 0 : 1;
    return FAMILY_ORDER[((k + 2 * r + dith) % 5 + 5) % 5];
}

// jointing sand: neutral, slightly darker than the block field so the thin
// joint lines stay readable against every family (measured contrast ≈ 20/255)
const GROUT = [196, 178, 148];      // warm tan jointing sand (L ≈ 180)

// red lane-line pavers: luminance-matched (L ≈ 199), saturation ≈ 0.26.
// Shifted lattice (BAND = 16 px): column 15 centre = 4 m, column 31 = 8 m from
// the tile's left edge ⇒ world x = −2 m / +2 m (dividers of lanes −4/0/4).
const BAND = 16;
const RED = [244, 188, 180];
const RED_COLS = new Set([15, 31]);

// Per-block variation lives mostly in CHROMA (like real paver mixes, the
// families share brightness and differ in hue); lightness stays tight so the
// surface has no large-scale luminance structure (T5).
const JITTER = 0.008;      // per-block lightness jitter ±0.8 %
const CHAN_JITTER = 0.02;  // per-block per-channel hue micro-jitter ±2 %
const RAMP = 0.015;        // per-block TL→BR sunlight ramp ±1.5 %
const CHAMFER = 0.02;      // 1 px chamfer highlight/shade ±2 %
const SPECKLE = 0.04;      // per-texel aggregate speckle ±4 %

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

const out = new PNG({ width: W, height: H });

for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const speck = 1 + (hash2(x, y, 77) - 0.5) * 2 * SPECKLE;
        const cell = pavCell(x, y);
        if (cell.joint) {
            for (let c = 0; c < 3; c++) {
                out.data[i + c] = Math.max(0, Math.min(255, Math.round(GROUT[c] * speck)));
            }
            out.data[i + 3] = 255;
            continue;
        }
        const { k, r, lx, ly } = cell;
        const jl = 1 + (hash2(k, r, 21) - 0.5) * 2 * JITTER;
        const j0 = 1 + (hash2(k, r, 31) - 0.5) * 2 * CHAN_JITTER;
        const j1 = 1 + (hash2(k, r, 32) - 0.5) * 2 * CHAN_JITTER;
        const j2 = 1 + (hash2(k, r, 33) - 0.5) * 2 * CHAN_JITTER;
        const bx = Math.min(1, (lx - 1) / (BW - 3));
        const by = (ly - 2) / (BL - 3);
        let shade = 1 + (0.5 - (bx + by) / 2) * 2 * RAMP;
        if (lx === 1 || ly === 2) shade *= 1 + CHAMFER;
        else if (lx === BW - 2 || ly === BL - 1) shade *= 1 - CHAMFER;
        const base = RED_COLS.has(k) ? RED : FAMILY[familyOf(k, r)].rgb;
        const f = shade * jl * speck;
        out.data[i]     = Math.max(0, Math.min(255, Math.round(base[0] * f * j0)));
        out.data[i + 1] = Math.max(0, Math.min(255, Math.round(base[1] * f * j1)));
        out.data[i + 2] = Math.max(0, Math.min(255, Math.round(base[2] * f * j2)));
        out.data[i + 3] = 255;
    }
}

const [,, outFile, reportFile] = process.argv;
if (!outFile) {
    console.error('usage: node make-walkway-tile.mjs <out.png> [report.json]');
    process.exit(1);
}

// truecolour → 256-entry palette, repo convention (no dither: wrap stays exact)
const tmpTrue = path.join(os.tmpdir(), `walkway-true-${process.pid}.png`);
fs.writeFileSync(tmpTrue, PNG.sync.write(out));
execFileSync('convert', [tmpTrue, '-strip', '-colors', '256', outFile]);
fs.unlinkSync(tmpTrue);

// family census over the block lattice (not pixels)
const famCount = { gray: 0, beige: 0, pink: 0 };
for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) if (!RED_COLS.has(k)) famCount[familyOf(k, r)]++;
const faces = (COLS - RED_COLS.size) * ROWS;

const report = {
    size: `${W}×${H}`,
    pxPerMetre: PXM,
    block: `${BW}×${BL} px (0.25 m × 0.50 m)`,
    courses: COLS, rows: ROWS,
    stagger: `${BL / 2} px between adjacent columns (along travel); zigzag joints ±6 px square wave`,
    redColumns: `${[...RED_COLS].join(',')} (world x = ±2 m) rgb ${RED.join(',')}`,
    families: Object.fromEntries(Object.entries(famCount).map(([f, n]) =>
        [f, { blocks: n, pct: +(100 * n / faces).toFixed(1) }])),
    grout: `${GROUT.join(',')} @ 2 px`,
    bytes: fs.statSync(outFile).size,
};
if (reportFile) fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
console.log(`wrote ${outFile} — ${(report.bytes / 1024).toFixed(0)} KB`);
