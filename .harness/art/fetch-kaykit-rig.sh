#!/usr/bin/env bash
# fetch-kaykit-rig.sh — pull the CC0 "Universal Rig" animation library that the
# 3D characters animate with.
#
# Source (CC0-1.0):  https://github.com/sketchpunklabs/kaykit_char
#   a mirror of Kay Lousberg's "KayKit Character Animations" pack
#   https://kaylousberg.itch.io/kaykit-character-animations
#
# Why this source: quaternius.com / kenney.nl / poly.pizza / threejs.org /
# raw.githubusercontent.com are all unreachable from the build sandbox, but
# codeload.github.com (repo tarballs) is. This repo is plain git (no LFS), so
# the GLBs arrive as real bytes.
#
# Output (committed to the game):
#   assets/models/rig/Med_MovementBasic.glb     run / jump / walk clips
#   assets/models/rig/Med_MovementAdvanced.glb  crouch / dodge / sneak clips
#   assets/models/rig/Med_General.glb           idle / hit / death / pickup
#   assets/models/rig/mannequin.gltf + .bin     the reference rig (bones only)
#   assets/models/rig/mannequin_texture.png
#   assets/models/rig/LICENSE                   the CC0-1.0 text
#   assets/models/rig/SOURCES.md                provenance
# Dev-only output (not loaded by the game):
#   .harness/art/rig-rest.json                  rest pose extracted from the mannequin
#
# Usage:  bash .harness/art/fetch-kaykit-rig.sh [--keep-tarball]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/assets/models/rig"
REPO="sketchpunklabs/kaykit_char"
BRANCH="main"
URL="https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ downloading $URL"
curl -sSL --fail --retry 3 -o "$TMP/repo.tgz" "$URL"
echo "  $(stat -c%s "$TMP/repo.tgz") bytes"

tar xzf "$TMP/repo.tgz" -C "$TMP"
SRC="$(find "$TMP" -maxdepth 1 -type d -name 'kaykit_char-*' | head -1)"
[ -n "$SRC" ] || { echo "!! unexpected tarball layout"; exit 1; }

# --- license must be CC0 before anything is copied -------------------------
grep -q "CC0 1.0 Universal" "$SRC/LICENSE" || { echo "!! LICENSE is not CC0-1.0 — refusing"; exit 1; }

mkdir -p "$OUT"
for f in Med_MovementBasic Med_MovementAdvanced Med_General; do
  cp "$SRC/res/anim/$f.glb" "$OUT/$f.glb"
  echo "  + assets/models/rig/$f.glb"
done
cp "$SRC/res/models/mannequin_v2/manny_med_mod.gltf"  "$OUT/mannequin.gltf"
cp "$SRC/res/models/mannequin_v2/manny_med_mod.bin"    "$OUT/mannequin.bin"
cp "$SRC/res/models/mannequin_v2/mannequin_texture.png" "$OUT/mannequin_texture.png"
cp "$SRC/LICENSE" "$OUT/LICENSE"

SHA="$(sha256sum "$TMP/repo.tgz" | cut -d' ' -f1)"
cat > "$OUT/SOURCES.md" <<EOF
# Character rig & animation library — provenance

| | |
|---|---|
| Files | \`Med_MovementBasic.glb\`, \`Med_MovementAdvanced.glb\`, \`Med_General.glb\` (animation-only GLBs, \`Rig_Medium\` skeleton), \`mannequin.gltf\` + \`mannequin.bin\` + \`mannequin_texture.png\` (reference rig) |
| Upstream | https://github.com/sketchpunklabs/kaykit_char (branch \`$BRANCH\`) |
| Original author | Kay Lousberg — *KayKit Character Animations* https://kaylousberg.itch.io/kaykit-character-animations |
| License | **CC0 1.0 Universal** (public domain dedication) — see \`LICENSE\` in this folder |
| Fetched by | \`.harness/art/fetch-kaykit-rig.sh\` |
| Tarball sha256 | \`$SHA\` |
| Modified? | **No** — the GLB/glTF bytes are upstream, unmodified. The animation clips were re-exported from FBX to GLB by the upstream repo (meshes removed) to keep the files small. |

The game *does* modify the rig in the sense the project brief asks for: the
bodies skinned onto these bones are authored in \`js/characters/\` (student
uniform, teacher saree/blazer, hair, props), and the clips are re-timed,
blended and layered with procedural poses (the bending slide). See
\`research/CHARACTER_SYSTEM_PLAN.md\`.

Only three of the eight upstream clip packs are vendored — the ones a runner
needs. Re-run the fetch script to pull more (\`Med_Simulation\`,
\`Med_Special\`, \`Med_Tools\`, \`Med_CombatMelee\`, \`Med_CombatRanged\`).
EOF

# --- extract the rest pose for the bone builder (dev artifact) --------------
node "$HERE/extract-rig-rest.mjs" "$OUT/mannequin.gltf" "$HERE/rig-rest.json"

if [ "${1:-}" = "--keep-tarball" ]; then
  cp "$TMP/repo.tgz" "$ROOT/.harness/art/kaykit_char.tgz"
  echo "  + .harness/art/kaykit_char.tgz (kept)"
fi

echo "✓ done — $(du -sh "$OUT" | cut -f1) in assets/models/rig/"
