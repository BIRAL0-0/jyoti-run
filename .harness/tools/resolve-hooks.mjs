/**
 * resolve-hooks.mjs — customization hooks used by node-loader.mjs.
 * Maps the browser import-map specifiers onto the pinned three@0.160.0 that
 * .harness installs for offline testing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// three's package.json is not in its "exports" map, so locate the package by
// walking up from this file to the .harness that owns node_modules.
function findThree() {
    let dir = import.meta.dirname;
    for (let i = 0; i < 8; i++) {
        const cand = path.join(dir, 'node_modules/three');
        if (fs.existsSync(path.join(cand, 'build/three.module.js'))) return cand;
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    throw new Error('three@0.160.0 not found — run: cd .harness && npm install three@0.160.0');
}

const THREE_PKG = findThree();
const THREE_URL = pathToFileURL(path.join(THREE_PKG, 'build/three.module.js')).href;
const ADDONS_URL = pathToFileURL(path.join(THREE_PKG, 'examples/jsm/')).href;

export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: THREE_URL, shortCircuit: true, format: 'module' };
    if (specifier.startsWith('three/addons/')) {
        return {
            url: new URL(specifier.slice('three/addons/'.length), ADDONS_URL).href,
            shortCircuit: true,
            format: 'module',
        };
    }
    return nextResolve(specifier, context);
}
