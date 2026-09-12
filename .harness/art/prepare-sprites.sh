#!/usr/bin/env bash
# prepare-sprites.sh — turn a character render into a contract-plane sprite.
#
#   prepare-sprites.sh <source.png> <WxH canvas> <out.png>
#
# The committed sprites were produced from assets/source-art/*.png with:
#   .harness/art/prepare-sprites.sh assets/source-art/student-back.png  900x1500  assets/textures/student-character.png
#   .harness/art/prepare-sprites.sh assets/source-art/student-front.png 900x1500  assets/textures/student-character-front.png
#   .harness/art/prepare-sprites.sh assets/source-art/teacher-back.png  1000x1500 assets/textures/teacher-character.png
#   .harness/art/prepare-sprites.sh assets/source-art/teacher-front.png 1000x1500 assets/textures/teacher-character-front.png
#
# The figure is trimmed to its real alpha content, scaled to fill the canvas
# height (width follows the figure's own proportions — never squashed) and
# anchored so the feet sit on the bottom edge, centred, on a transparent
# background. The canvas ratio IS the contract ratio (3:5 student, 2:3 teacher).
set -euo pipefail

SRC="$1"; CANVAS="$2"; OUT="$3"
CW="${CANVAS%x*}"; CH="${CANVAS#*x}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. binary mask of everything that is actually visible (alpha > 12%)
convert "$SRC" -alpha extract -threshold 12% "$TMP/mask.png"

# 2. content bbox from the mask
BBOX="$(convert "$TMP/mask.png" -format '%@' info:)"      # WxH+X+Y
W="${BBOX%%x*}"; REST="${BBOX#*x}"; H="${REST%%+*}"
OX="${BBOX#*+}"; OX="${OX%%+*}"; OY="${BBOX##*+}"

# 3. crop the render to that bbox (keeps alpha), then fit it to the canvas
#    height; if the figure is wider than the canvas ratio allows, fit width.
SRC_ASPECT=$(awk -v w="$W" -v h="$H" 'BEGIN{printf "%.6f", w/h}')
CAN_ASPECT=$(awk -v w="$CW" -v h="$CH" 'BEGIN{printf "%.6f", w/h}')
if awk -v a="$SRC_ASPECT" -v b="$CAN_ASPECT" 'BEGIN{exit !(a<=b)}'; then
  FIT_H="$CH"; FIT_W=""
else
  FIT_W="$CW"; FIT_H=""
fi

convert "$SRC" -crop "${W}x${H}+${OX}+${OY}" +repage \
  -resize "${FIT_W:+${FIT_W}}${FIT_H:+x${FIT_H}}" \
  -background none -gravity south -extent "${CW}x${CH}" \
  -strip -define png:compression-level=9 \
  "$OUT"

echo "  trimmed   : ${W}x${H} at +${OX}+${OY} (figure aspect ${SRC_ASPECT})"
echo "  canvas    : ${CW}x${CH} (plane aspect ${CAN_ASPECT})"
echo "  fit       : ${FIT_H:+full height}${FIT_W:+full width}"
echo "  wrote     : ${OUT}"
