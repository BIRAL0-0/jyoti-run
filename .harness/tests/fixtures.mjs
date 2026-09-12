/**
 * fixtures.mjs — synthetic test assets (harness-only, never shipped).
 * Stand-ins that exercise the aspect/palette paths independently of the art.
 */
import { PNG } from 'pngjs';

/** Opaque body with a marker stripe, transparent margin, feet on the bottom. */
export function characterPng(width, height, body, marker) {
  const png = new PNG({ width, height });
  const x0 = Math.floor(width * 0.15), x1 = Math.floor(width * 0.85);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = ((width * y) + x) << 2;
      const inside = x >= x0 && x < x1 && y >= Math.floor(height * 0.02) && y < height;
      png.data[i] = inside ? body[0] : 0;
      png.data[i + 1] = inside ? body[1] : 0;
      png.data[i + 2] = inside ? body[2] : 0;
      png.data[i + 3] = inside ? 255 : 0;
      if (inside && y > height * 0.35 && y < height * 0.55 && x > width * 0.35 && x < width * 0.65) {
        png.data[i] = marker[0]; png.data[i + 1] = marker[1]; png.data[i + 2] = marker[2];
      }
    }
  }
  return PNG.sync.write(png);
}

/** Seamless-by-construction gravel stand-in (≥1024², tiles on both axes). */
export function gravelPng(size = 1024) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = ((size * y) + x) << 2;
      const v = ((x * 7) ^ (y * 13) ^ ((x * y) % 251)) & 0xff;
      const base = 110 + (v % 60);
      png.data[i] = base; png.data[i + 1] = base + 6; png.data[i + 2] = base + 12; png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}
