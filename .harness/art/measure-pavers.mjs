/**
 * measure-pavers.mjs — autocorrelation probe for the walkway source.
 *
 * Estimates the pixel period of the paver courses along x and y for a given
 * crop. Used to pick a crop size that is a whole number of pavers, so the
 * seamless tile repeats the pattern instead of chopping it mid-block.
 *
 * Usage: node measure-pavers.mjs [src.png] [cropX cropY cropSize]
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [src, cx, cy, cn] = process.argv.slice(2);
const png = PNG.sync.read(fs.readFileSync(src || '/home/user/jyoti-run/assets/source-art/ground-gravel-source.png'));
const { width: W, height: H, data } = png;

const x0 = Number(cx || 0), y0 = Number(cy || 0);
const n = Number(cn || Math.min(W, H));

const gray = new Float64Array(n * n);
for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
        const i = ((y0 + y) * W + (x0 + x)) * 4;
        gray[y * n + x] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
}

const prof = (axis) => {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += axis === 0 ? gray[j * n + i] : gray[i * n + j];
        out[i] = s / n;
    }
    return out;
};

const autocorr = (p) => {
    const mean = p.reduce((a, b) => a + b, 0) / p.length;
    const d = p.map((v) => v - mean);
    const denom = d.reduce((a, b) => a + b * b, 0) || 1;
    const r = new Float64Array(n);
    for (let lag = 1; lag < n; lag++) {
        let s = 0;
        for (let i = 0; i + lag < n; i++) s += d[i] * d[i + lag];
        r[lag] = s / denom;
    }
    return r;
};

for (const [name, axis] of [['x (across the path)', 0], ['y (along the path)', 1]]) {
    const r = autocorr(prof(axis));
    const peaks = [];
    for (let lag = 4; lag < n - 4; lag++) {
        if (r[lag] > r[lag - 1] && r[lag] > r[lag + 1] && r[lag] > 0.12) {
            peaks.push({ lag, v: r[lag] });
        }
    }
    peaks.sort((a, b) => b.v - a.v);
    const top = peaks.slice(0, 3).sort((a, b) => a.lag - b.lag);
    console.log(`${name}: ${top.map((p) => `period ${p.lag}px (r=${p.v.toFixed(2)})`).join(' | ') || 'no strong period'}`);
    for (const p of top) {
        const fits = Math.floor(n / p.lag);
        console.log(`    -> ${fits} courses fit in ${n}px (residual ${n - fits * p.lag}px)`);
    }
}
