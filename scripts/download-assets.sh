#!/usr/bin/env bash
# =============================================================================
# School Runner: Teacher Chase — Asset Download Script (Phase 1 deliverable)
#
# Downloads the free/CC0 assets found in research/RESEARCH_REPORT.md and
# organizes them into the Phase 2 file structure.
#
# Usage:   bash scripts/download-assets.sh
# Needs:   curl + unzip (and a browser for the few click-driven items listed
#          at the end).
#
# Everything this script downloads is CC0 / public domain (Kenney, Quaternius,
# KayKit, ambientCG). Mixkit sounds are Mixkit License (free, no attribution)
# but their download buttons are not scriptable — URLs are listed at the end.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/assets"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST/models/environment" "$DEST/models/obstacles" \
         "$DEST/textures" "$DEST/sounds" "$DEST/lib"

fetch() { # fetch <url> <outfile>
  echo "⬇  $1"
  curl -fL --retry 3 --connect-timeout 20 -o "$2" "$1"
}

# -----------------------------------------------------------------------------
# 1) Kenney — Furniture Kit (CC0, 116 GLB props: desks, benches, shelves, carts)
#    Powers environment dressing + LOW obstacles (school desks).
# -----------------------------------------------------------------------------
KELLY_ZIP="$TMP/kenney-furniture.zip"
# Kenney's stable download endpoint (pack slug -> zip):
fetch "https://kenney.nl/media/pages/assets/furniture-kit/kenney_furniture-kit.zip" \
      "$KELLY_ZIP" || echo "⚠  Kenney Furniture Kit URL moved — grab it manually: https://kenney.nl/assets/furniture-kit"
if [ -s "$KELLY_ZIP" ]; then
  unzip -q -o "$KELLY_ZIP" -d "$TMP/furniture"
  find "$TMP/furniture" -iname "*.glb" -exec cp {} "$DEST/models/environment/" \; 2>/dev/null || true
fi

# -----------------------------------------------------------------------------
# 2) Quaternius / KayKit obstacle props (CC0) via poly.pizza direct GLB links
#    poly.pizza exposes a stable per-model GLB endpoint:
#      https://poly.pizza/api/download/{model-id}  (falls back to the model page)
#    If a link 302s to an HTML page, download that model from its page instead.
# -----------------------------------------------------------------------------
declare -A OBSTACLES=(
  ["cone.glb"]="https://poly.pizza/m/lAx8JytxGD"        # Quaternius Traffic Cone
  ["barrier.glb"]="https://poly.pizza/m/cM3aJPU9NS"     # Quaternius Traffic Barrier
  ["desk.glb"]="https://poly.pizza/m/V86Go2rlnq"        # Quaternius Desk
)
for name in "${!OBSTACLES[@]}"; do
  url="${OBSTACLES[$name]}"
  out="$DEST/models/obstacles/$name"
  # Try the page's GLB endpoint first; verify we actually got a binary file.
  if fetch "$url" "$out" 2>/dev/null && file "$out" | grep -qiE '(glb|binary|zip|data)'; then
    echo "✅ $name"
  else
    rm -f "$out"
    echo "⚠  $name — poly.pizza uses click-through downloads. Open: $url"
  fi
done

# -----------------------------------------------------------------------------
# 3) ambientCG — fallback ground texture (CC0) in case user PNG is unavailable
# -----------------------------------------------------------------------------
fetch "https://ambientcg.com/get?file=Gravel001_1K-JPG.zip" "$TMP/gravel.zip" \
  && unzip -q -o "$TMP/gravel.zip" -d "$TMP/gravel" \
  && cp "$TMP/gravel/"*Color* "$DEST/textures/fallback-gravel.jpg" 2>/dev/null \
  || echo "⚠  ambientCG fallback skipped (user-provided ground-gravel.png takes priority anyway)"

# -----------------------------------------------------------------------------
# 4) Library cache (optional but recommended for offline / GitHub Pages)
# -----------------------------------------------------------------------------
fetch "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" "$DEST/lib/three.module.js" || true
fetch "https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js"    "$DEST/lib/howler.min.js"    || true

# =============================================================================
# MANUAL ITEMS (click-driven, ~3 minutes total):
# -----------------------------------------------------------------------------
# SOUNDS → assets/sounds/   (Mixkit License: free, no attribution — see §5B):
#   jump.mp3          https://mixkit.co/free-sound-effects/jump/   ("Player jumping in a video game")
#   collect.mp3       https://mixkit.co/free-sound-effects/game/   ("Winning a coin, video game")
#   hit.mp3           …same page…                                  ("Small hit in a game")
#   teacher-alert.mp3 …same page…                                  ("Retro arcade casino notification")
#   gameover.mp3      …same page…                                  ("Player losing or failing")
#   bg-music.mp3      …same page…                                  ("Game level music", 30 s loop)
#   Alt/CC0: https://kenney.nl/assets/ui-audio + /music-jingles
#
# USER IMAGES → assets/textures/:
#   ground-gravel.png      (seamless, ≥1024²)
#   student-character.png  (transparent PNG, ≥512²)
#   teacher-character.png  (transparent PNG, ≥512²)
# =============================================================================
echo
echo "Done. Review assets/ then check the MANUAL ITEMS list above."
