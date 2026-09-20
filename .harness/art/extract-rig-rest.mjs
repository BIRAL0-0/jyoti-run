/**
 * extract-rig-rest.mjs — read the CC0 mannequin glTF and dump the rig's rest
 * pose (joint order, hierarchy, local transforms) as JSON.
 *
 * The game rebuilds the same skeleton from this file (js/characters/RigSkeleton.js
 * is generated from it, then hand-checked), so the KayKit animation clips
 * retarget onto our authored bodies with zero name mapping.
 *
 *   node extract-rig-rest.mjs <mannequin.gltf> <out.json>
 */
import fs from 'node:fs';
import path from 'node:path';

const [gltfPath, outPath] = process.argv.slice(2);
if (!gltfPath || !outPath) {
    console.error('usage: node extract-rig-rest.mjs <mannequin.gltf> <out.json>');
    process.exit(1);
}

const gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
const nodes = gltf.nodes;

const parent = new Array(nodes.length).fill(-1);
nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));

const skin = gltf.skins?.[0];
if (!skin) throw new Error('no skin in ' + gltfPath);

// A joint's "bone space" is the parent's space; the depth tells us how far the
// bone is from the floor, which is what the body author cares about.
const depth = (i) => (parent[i] < 0 ? 0 : depth(parent[i]) + 1);

const joints = skin.joints.map((nodeIndex) => {
    const n = nodes[nodeIndex];
    return {
        name: n.name,
        parent: parent[nodeIndex] >= 0 && skin.joints.includes(parent[nodeIndex])
            ? nodes[parent[nodeIndex]].name
            : null,
        translation: n.translation ?? [0, 0, 0],
        rotation: n.rotation ?? [0, 0, 0, 1],
        scale: n.scale ?? [1, 1, 1],
        depth: depth(nodeIndex),
    };
});

const out = {
    source: path.basename(gltfPath),
    license: 'CC0-1.0 (KayKit Character Animations — Kay Lousberg)',
    skinName: skin.name,
    joints,
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`✓ ${joints.length} joints → ${outPath}`);
for (const j of joints) {
    const t = j.translation.map((v) => v.toFixed(4)).join(' ');
    console.log(`   ${'  '.repeat(Math.max(0, j.depth - 1))}${j.name.padEnd(12)} local T(${t})`);
}
