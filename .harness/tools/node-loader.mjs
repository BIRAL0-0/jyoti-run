/**
 * node-loader.mjs — let Node import the *game's* ES modules verbatim.
 *
 * The browser resolves `three` / `three/addons/*` through index.html's import
 * map. Node has no import map, so this hook rewrites exactly those two
 * specifiers to the pinned three@0.160.0 in .harness/node_modules. Everything
 * else (js/config.js, js/characters/*.js, …) resolves normally, which means
 * the offline tools and the browser always exercise the same source.
 *
 *   node --import ../tools/node-loader.mjs tools/inspect-rig.mjs
 */
import { register } from 'node:module';

register('./resolve-hooks.mjs', import.meta.url);
