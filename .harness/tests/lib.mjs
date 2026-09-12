/**
 * lib.mjs — assertion/reporting helpers for the harness suites.
 */
import { PNG } from 'pngjs';

export class Report {
  constructor(name) { this.name = name; this.results = []; }
  check(label, ok, detail = '') {
    this.results.push({ label, ok: !!ok, detail });
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
    return !!ok;
  }
  get failed() { return this.results.filter((r) => !r.ok); }
}

export const section = (title) => console.log(`\n=== ${title} ===`);

/** Decode a screenshot buffer and count exact RGB values inside a region. */
export function pixelStats(rawBuffer, region) {
  const png = PNG.sync.read(Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer));
  const { x, y, w, h } = region;
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(png.width, Math.round(x + w)), y1 = Math.min(png.height, Math.round(y + h));
  const counts = new Map();
  let total = 0;
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = ((png.width * py) + px) << 2;
      const key = `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      total++;
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total, unique: counts.size,
    top: sorted.slice(0, 8).map(([rgb, n]) => ({ rgb, n })),
    has: (rgb) => counts.has(rgb),
    countOf: (rgb) => counts.get(rgb) || 0,
    keys: new Set(counts.keys()),
  };
}

export const jaccard = (a, b) => {
  let inter = 0;
  for (const k of a) if (b.has(k)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
};
