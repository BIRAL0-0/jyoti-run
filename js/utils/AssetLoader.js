/**
 * AssetLoader — user-asset override helpers with silent fallbacks
 * (research report §10 error-handling pattern).
 *
 * The game must boot with a completely empty assets/ folder. Every optional
 * file is probed with fetch() first (a 404 on fetch does not spam the console
 * the way an <img>/TextureLoader error does), and only loaded when present.
 */
import * as THREE from 'three';
import { AUDIO } from '../config.js';

/**
 * Probe a list of URLs; resolve to the subset that exists (HTTP 200).
 * Never rejects — network errors just count as "missing".
 * @param {string[]} urls
 * @returns {Promise<Set<string>>}
 */
export async function probeExisting(urls) {
    const existing = new Set();
    await Promise.all(urls.map(async (url) => {
        if (!url) return;
        try {
            const res = await fetch(url, { method: 'GET', cache: 'force-cache' });
            if (res.ok) existing.add(url);
        } catch (e) { /* offline / blocked — treat as missing */ }
    }));
    return existing;
}

/**
 * Load a texture from a URL known to exist, configured for the game.
 * @param {string} url
 * @param {{repeat?:[number,number], anisotropy?:number}} [opts]
 * @returns {Promise<THREE.Texture|null>}
 */
export function loadImageTexture(url, opts = {}) {
    return new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        loader.load(
            url,
            (texture) => {
                configureTexture(texture, opts);
                resolve(texture);
            },
            undefined,
            () => resolve(null) // never reject: caller falls back to procedural art
        );
    });
}

/**
 * Wrap an already-drawn canvas in a game-ready texture.
 * @param {HTMLCanvasElement} canvas
 * @param {{repeat?:[number,number], anisotropy?:number, mipmaps?:boolean}} [opts]
 * @returns {THREE.CanvasTexture}
 */
export function canvasTexture(canvas, opts = {}) {
    const texture = new THREE.CanvasTexture(canvas);
    configureTexture(texture, opts);
    return texture;
}

function configureTexture(texture, { repeat, anisotropy = 4, mipmaps = true } = {}) {
    texture.colorSpace = THREE.SRGBColorSpace;   // r152+: correct colours
    if (repeat) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat[0], repeat[1]);
    }
    texture.anisotropy = anisotropy;
    if (!mipmaps) {
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;  // allows non-POT canvases
    }
    texture.needsUpdate = true;
}

/**
 * Lazy-load Howler.js 2.2.4 (pinned) as a classic script, but only when real
 * mp3 files exist. Resolves window.Howl or null. Never throws.
 * @returns {Promise<typeof Howl|null>}
 */
export function loadHowler() {
    return new Promise((resolve) => {
        if (window.Howl) return resolve(window.Howl);
        if (typeof document === 'undefined') return resolve(null);
        const script = document.createElement('script');
        const timeout = setTimeout(() => resolve(null), 5000);
        script.src = AUDIO.HOWLER_URL;
        script.onload = () => {
            clearTimeout(timeout);
            resolve(window.Howl || null);
        };
        script.onerror = () => {
            clearTimeout(timeout);
            resolve(null);
        };
        document.head.appendChild(script);
    });
}
