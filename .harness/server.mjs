/**
 * server.mjs — offline static server for the harness.
 *
 * The shipped game loads three.js / Howler from jsDelivr; this sandbox has no
 * route to that CDN, so this server rewrites ONLY the response bodies it
 * serves (index.html's import map + js/config.js's HOWLER_URL) to the vendored
 * copies in .harness/vendor/. Repo files are never touched, so the shipped
 * code path is what gets tested.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8', '.sh': 'text/plain; charset=utf-8',
};

const CDN_THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const CDN_ADDONS = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/';
const CDN_HOWLER = 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js';

export function createServer(root, opts = {}) {
  const {
    vendorDir = path.join(HERE, 'vendor'),
    /** 404 every optional game asset (simulates a fresh clone) */
    hideAssets = false,
    /** synthetic files layered on top of root: { relPath: Buffer } */
    overlay = {},
    port = 0,
  } = opts;

  const log = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const clean = rel.replace(/^\/+/, '');
    log.push({ url: req.url, method: req.method });

    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': type });
      res.end(body);
    };

    const vendor = {
      '__vendor/three.module.js': 'three.module.js',
      '__vendor/addons/utils/BufferGeometryUtils.js': 'BufferGeometryUtils.js',
      '__vendor/BufferGeometryUtils.js': 'BufferGeometryUtils.js',
      '__vendor/howler.min.js': 'howler.min.js',
    };
    if (vendor[clean]) {
      return send(200, fs.readFileSync(path.join(vendorDir, vendor[clean])), MIME['.js']);
    }

    // synthetic fixtures win over everything (harness-only files)
    if (overlay[clean]) {
      return send(200, overlay[clean], MIME[path.extname(clean)] || 'application/octet-stream');
    }
    if (hideAssets && /^assets\/(textures|sounds|models|scenery)\//.test(clean)) {
      return send(404, 'not found');
    }

    const filePath = path.join(root, clean);
    if (!filePath.startsWith(root)) return send(403, 'forbidden');
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return send(404, 'not found');
    }

    const ext = path.extname(filePath);
    let body = fs.readFileSync(filePath);
    if (ext === '.html') {
      let html = body.toString('utf8')
        .replaceAll(CDN_THREE, '/__vendor/three.module.js')
        .replaceAll(CDN_ADDONS, '/__vendor/addons/')
        // offline harness: remote webfonts are unreachable here (they are fine
        // in a normal browser) — strip the <link> tags so the console is clean
        .replace(/\s*<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>/g, '');
      body = Buffer.from(html, 'utf8');
    } else if (clean === 'js/config.js') {
      body = Buffer.from(body.toString('utf8').replaceAll(CDN_HOWLER, '/__vendor/howler.min.js'), 'utf8');
    }
    return send(200, body, MIME[ext] || 'application/octet-stream');
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({
      server, log,
      port: server.address().port,
      base: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}
