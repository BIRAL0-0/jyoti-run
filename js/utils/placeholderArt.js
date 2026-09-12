/**
 * placeholderArt — procedural placeholder art, generated on offscreen
 * canvases at load time (research report §12 / §2B).
 *
 * The game boots with ZERO asset files: everything below is drawn in code.
 * Drop real PNGs into assets/textures/ to override (see README.md):
 *   ground-gravel.png / student-character.png / teacher-character.png
 *
 * All functions return plain HTMLCanvasElements; main.js wraps them in
 * THREE.CanvasTexture. Keep this file swappable — the rest of the game
 * never assumes where textures come from.
 */

const OUTLINE = '#2f2a3e';

/** Create a canvas + 2d context pair. */
function makeCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    return { canvas, ctx };
}

/** Rounded-rectangle path helper. */
function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/** Filled + outlined shape using the current path. */
function shape(ctx, fill, stroke = OUTLINE, lw = 5) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/** Thick capsule (arm/leg) from (x1,y1) to (x2,y2). */
function capsule(ctx, x1, y1, x2, y2, width, fill, stroke = OUTLINE, lw = 5) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = width + lw * 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = width;
    ctx.strokeStyle = fill;
    ctx.stroke();
}

/** Circle helper. */
function circle(ctx, x, y, r, fill, stroke = OUTLINE, lw = 5) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    shape(ctx, fill, stroke, lw);
}

// ---------------------------------------------------------------------------
// STUDENT — back view (running away from the camera), 240×400 canvas
// aspect 0.6 matches SPRITE_WIDTH/SPRITE_HEIGHT = 1.5/2.5
// ---------------------------------------------------------------------------
const SKIN = '#f0b98d';
const HAIR = '#4a3324';
const SHIRT = '#ffd23f';
const PACK = '#4169e1';
const PACK_DARK = '#2b3a8f';
const SHORTS = '#2b3a67';
const SHOE = '#f4f6f8';
const SHOE_RED = '#d9534f';

function drawStudent(pose) {
    const { canvas, ctx } = makeCanvas(240, 400);
    const cx = 120;

    if (pose === 'slide') {
        // ---- compact crouch-slide (occupies the bottom ~55% of the frame) ----
        // folded legs
        capsule(ctx, 68, 372, 38, 330, 26, SKIN);         // left leg tucked
        capsule(ctx, 172, 372, 202, 330, 26, SKIN);       // right leg tucked
        circle(ctx, 40, 326, 22, SHOE, OUTLINE, 4);
        circle(ctx, 200, 326, 22, SHOE, OUTLINE, 4);
        // torso low, leaning forward
        rr(ctx, 66, 268, 108, 84, 26);
        shape(ctx, SHIRT);
        // backpack
        rr(ctx, 78, 258, 84, 74, 18);
        shape(ctx, PACK);
        rr(ctx, 92, 292, 56, 32, 10);
        shape(ctx, PACK_DARK, OUTLINE, 4);
        // head low between shoulders
        circle(ctx, cx, 236, 44, SKIN);
        // hair (back of head)
        ctx.beginPath();
        ctx.arc(cx, 236, 46, Math.PI * 0.95, Math.PI * 2.05);
        ctx.quadraticCurveTo(cx + 40, 262, cx, 268);
        ctx.quadraticCurveTo(cx - 40, 262, cx - 45, 232);
        shape(ctx, HAIR, null, 0);
        // arms out for balance
        capsule(ctx, 74, 286, 22, 320, 20, SKIN);
        capsule(ctx, 166, 286, 218, 320, 20, SKIN);
        circle(ctx, 20, 324, 15, SKIN, OUTLINE, 4);
        circle(ctx, 220, 324, 15, SKIN, OUTLINE, 4);
        // speed lines behind
        ctx.strokeStyle = 'rgba(47,42,62,0.35)';
        ctx.lineWidth = 4;
        for (const y of [300, 336]) {
            ctx.beginPath(); ctx.moveTo(196, y); ctx.lineTo(236, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(44, y); ctx.stroke();
        }
        return canvas;
    }

    if (pose === 'jump') {
        // ---- airborne tuck ----
        // legs bent up under the body
        capsule(ctx, 96, 268, 66, 316, 24, SKIN);
        capsule(ctx, 144, 268, 174, 316, 24, SKIN);
        circle(ctx, 62, 320, 21, SHOE, OUTLINE, 4);
        circle(ctx, 178, 320, 21, SHOE, OUTLINE, 4);
        rr(ctx, 62, 320, 26, 10, 5); shape(ctx, SHOE_RED, null, 0);
        rr(ctx, 165, 320, 26, 10, 5); shape(ctx, SHOE_RED, null, 0);
        // shorts
        rr(ctx, 78, 214, 84, 60, 18);
        shape(ctx, SHORTS);
        // torso + backpack
        rr(ctx, 74, 128, 92, 96, 24);
        shape(ctx, SHIRT);
        rr(ctx, 84, 136, 72, 84, 16);
        shape(ctx, PACK);
        rr(ctx, 96, 166, 48, 40, 10);
        shape(ctx, PACK_DARK, OUTLINE, 4);
        // arms up
        capsule(ctx, 84, 142, 34, 96, 20, SKIN);
        capsule(ctx, 156, 142, 206, 96, 20, SKIN);
        circle(ctx, 32, 92, 16, SKIN, OUTLINE, 4);
        circle(ctx, 208, 92, 16, SKIN, OUTLINE, 4);
        // head + hair
        circle(ctx, cx, 92, 46, SKIN);
        ctx.beginPath();
        ctx.arc(cx, 90, 48, Math.PI * 0.9, Math.PI * 2.1);
        ctx.quadraticCurveTo(cx + 44, 122, cx, 128);
        ctx.quadraticCurveTo(cx - 44, 122, cx - 47, 92);
        shape(ctx, HAIR, null, 0);
        // hair tuft
        capsule(ctx, cx, 48, cx + 12, 26, 12, HAIR, null, 0);
        return canvas;
    }

    // ---- run poses A/B (legPhase = -1 : left forward, +1 : right forward) ----
    const legPhase = pose === 'runA' ? -1 : 1;

    // back leg (extended)
    const backHip = { x: cx + legPhase * 22, y: 244 };
    const backFoot = { x: cx + legPhase * 34, y: 366 };
    capsule(ctx, backHip.x, backHip.y, backFoot.x, backFoot.y - 18, 24, SKIN);
    // front leg (bent up)
    const frontHip = { x: cx - legPhase * 22, y: 244 };
    const frontKnee = { x: cx - legPhase * 40, y: 316 };
    capsule(ctx, frontHip.x, frontHip.y, frontKnee.x, frontKnee.y, 24, SKIN);
    capsule(ctx, frontKnee.x, frontKnee.y, frontKnee.x + legPhase * 12, frontKnee.y + 34, 22, SKIN);
    // shoes
    circle(ctx, backFoot.x, backFoot.y - 12, 20, SHOE, OUTLINE, 4);
    circle(ctx, frontKnee.x + legPhase * 12, frontKnee.y + 40, 19, SHOE, OUTLINE, 4);
    rr(ctx, backFoot.x - 20, backFoot.y - 6, 40, 11, 5); shape(ctx, SHOE_RED, null, 0);
    rr(ctx, frontKnee.x + legPhase * 12 - 19, frontKnee.y + 47, 38, 10, 5); shape(ctx, SHOE_RED, null, 0);

    // shorts
    rr(ctx, 76, 208, 88, 56, 18);
    shape(ctx, SHORTS);

    // torso (t-shirt)
    rr(ctx, 72, 126, 96, 96, 24);
    shape(ctx, SHIRT);

    // backpack over the torso (we see the student's back)
    rr(ctx, 82, 132, 76, 88, 16);
    shape(ctx, PACK);
    rr(ctx, 94, 162, 52, 42, 10);
    shape(ctx, PACK_DARK, OUTLINE, 4);
    // straps over the shoulders
    capsule(ctx, 88, 138, 96, 128, 10, PACK_DARK, null, 0);
    capsule(ctx, 152, 138, 144, 128, 10, PACK_DARK, null, 0);

    // arms pumping opposite to the legs
    const armSide = -legPhase;
    capsule(ctx, 84, 140, 84 - armSide * 16, 196 - armSide * 30, 20, SKIN);
    capsule(ctx, 156, 140, 156 + armSide * 16, 196 + armSide * 30, 20, SKIN);
    circle(ctx, 84 - armSide * 16, 200 - armSide * 32, 14, SKIN, OUTLINE, 4);
    circle(ctx, 156 + armSide * 16, 200 + armSide * 32, 14, SKIN, OUTLINE, 4);

    // head (back of head: mostly hair)
    circle(ctx, cx, 90, 46, SKIN);
    ctx.beginPath();
    ctx.arc(cx, 88, 48, Math.PI * 0.9, Math.PI * 2.1);
    ctx.quadraticCurveTo(cx + 44, 120, cx, 126);
    ctx.quadraticCurveTo(cx - 44, 120, cx - 47, 90);
    shape(ctx, HAIR, null, 0);
    // ears
    circle(ctx, cx - 44, 96, 9, SKIN, OUTLINE, 4);
    circle(ctx, cx + 44, 96, 9, SKIN, OUTLINE, 4);
    // bouncing hair tuft
    capsule(ctx, cx, 46, cx + legPhase * 14, 24, 12, HAIR, null, 0);

    return canvas;
}

// ---------------------------------------------------------------------------
// TEACHER — front view (chasing toward the camera), 240×360 canvas
// aspect 0.667 matches SPRITE_WIDTH/SPRITE_HEIGHT = 2/3
// ---------------------------------------------------------------------------
const T_SKIN = '#f2c9a4';
const T_HAIR = '#cfd4dc';
const T_SUIT = '#34495e';
const T_SUIT_DARK = '#26364a';
const T_BLOUSE = '#f4f6f8';
const T_GLASSES = '#2f2a3e';

function drawTeacher(pose) {
    const { canvas, ctx } = makeCanvas(240, 360);
    const cx = 120;

    if (pose === 'grab') {
        // ---- lunging grab at the camera: both arms out, huge hands ----
        // skirt + legs
        ctx.beginPath();
        ctx.moveTo(84, 236); ctx.lineTo(156, 236); ctx.lineTo(174, 312); ctx.lineTo(66, 312);
        ctx.closePath();
        shape(ctx, T_SUIT);
        capsule(ctx, 100, 306, 100, 340, 20, T_SKIN);
        capsule(ctx, 140, 306, 140, 340, 20, T_SKIN);
        rr(ctx, 84, 332, 34, 12, 6); shape(ctx, T_SUIT_DARK, null, 0);
        rr(ctx, 122, 332, 34, 12, 6); shape(ctx, T_SUIT_DARK, null, 0);
        // torso leaning in (bigger = closer to camera)
        rr(ctx, 62, 148, 116, 104, 30);
        shape(ctx, T_SUIT);
        // blouse V
        ctx.beginPath();
        ctx.moveTo(cx - 24, 150); ctx.lineTo(cx, 208); ctx.lineTo(cx + 24, 150);
        ctx.closePath();
        shape(ctx, T_BLOUSE, null, 0);
        // arms thrust at the camera — long + foreshortened
        capsule(ctx, 78, 172, 44, 240, 26, T_SUIT);
        capsule(ctx, 162, 172, 196, 240, 26, T_SUIT);
        circle(ctx, 40, 258, 34, T_SKIN, OUTLINE, 5);   // big grabbing hands
        circle(ctx, 200, 258, 34, T_SKIN, OUTLINE, 5);
        capsule(ctx, 40, 262, 28, 288, 12, T_SKIN, null, 0);
        capsule(ctx, 40, 258, 40, 292, 12, T_SKIN, null, 0);
        capsule(ctx, 40, 254, 52, 282, 12, T_SKIN, null, 0);
        capsule(ctx, 200, 262, 212, 288, 12, T_SKIN, null, 0);
        capsule(ctx, 200, 258, 200, 292, 12, T_SKIN, null, 0);
        capsule(ctx, 200, 254, 188, 282, 12, T_SKIN, null, 0);
        // head — furious, wide open mouth
        circle(ctx, cx, 96, 44, T_SKIN);
        // hair with bun
        ctx.beginPath();
        ctx.arc(cx, 94, 46, Math.PI * 0.98, Math.PI * 2.02);
        ctx.quadraticCurveTo(cx + 46, 130, cx, 136);
        ctx.quadraticCurveTo(cx - 46, 130, cx - 46, 94);
        shape(ctx, T_HAIR, null, 0);
        circle(ctx, cx, 44, 18, T_HAIR);
        drawTeacherFace(ctx, cx, 96, { shocked: true });
        return canvas;
    }

    // ---- run poses A/B ----
    const phase = pose === 'runA' ? -1 : 1;

    // legs striding
    capsule(ctx, cx - 16, 300, cx - 14 - phase * 26, 340, 22, T_SKIN);
    capsule(ctx, cx + 16, 300, cx + 14 + phase * 26, 340, 22, T_SKIN);
    rr(ctx, cx - 34 - phase * 26, 334, 36, 12, 6); shape(ctx, T_SUIT_DARK, null, 0);
    rr(ctx, cx - 2 + phase * 26, 334, 36, 12, 6); shape(ctx, T_SUIT_DARK, null, 0);

    // skirt
    ctx.beginPath();
    ctx.moveTo(88, 222); ctx.lineTo(152, 222); ctx.lineTo(168, 310); ctx.lineTo(72, 310);
    ctx.closePath();
    shape(ctx, T_SUIT);

    // torso / blazer
    rr(ctx, 72, 138, 96, 96, 22);
    shape(ctx, T_SUIT);
    // lapels + blouse
    ctx.beginPath();
    ctx.moveTo(cx - 22, 140); ctx.lineTo(cx - 4, 186); ctx.lineTo(cx - 22, 186);
    ctx.closePath(); shape(ctx, T_SUIT_DARK, null, 0);
    ctx.beginPath();
    ctx.moveTo(cx + 22, 140); ctx.lineTo(cx + 4, 186); ctx.lineTo(cx + 22, 186);
    ctx.closePath(); shape(ctx, T_SUIT_DARK, null, 0);
    ctx.beginPath();
    ctx.moveTo(cx - 20, 140); ctx.lineTo(cx + 20, 140); ctx.lineTo(cx, 196);
    ctx.closePath(); shape(ctx, T_BLOUSE, null, 0);

    // left arm swings; right arm holds the ruler up (waving with the stride)
    const armSwing = phase * 26;
    capsule(ctx, 80, 152, 66, 208 + armSwing, 20, T_SUIT);
    circle(ctx, 64, 214 + armSwing, 14, T_SKIN, OUTLINE, 4);
    // ruler arm
    const rulerTip = { x: 196, y: 84 - phase * 22 };
    capsule(ctx, 160, 152, 182, 118 - phase * 12, 20, T_SUIT);
    circle(ctx, 186, 112 - phase * 12, 14, T_SKIN, OUTLINE, 4);
    // the ruler
    ctx.save();
    ctx.translate(188, 108 - phase * 12);
    ctx.rotate(-0.7 + phase * 0.18);
    rr(ctx, -7, -74, 14, 92, 4);
    shape(ctx, '#e8d9a0');
    ctx.strokeStyle = 'rgba(47,42,62,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(-4, -62 + i * 16); ctx.lineTo(4, -62 + i * 16); ctx.stroke();
    }
    ctx.restore();

    // head
    circle(ctx, cx, 92, 42, T_SKIN);
    // hair + bun
    ctx.beginPath();
    ctx.arc(cx, 90, 44, Math.PI * 0.98, Math.PI * 2.02);
    ctx.quadraticCurveTo(cx + 44, 124, cx, 130);
    ctx.quadraticCurveTo(cx - 44, 124, cx - 44, 90);
    shape(ctx, T_HAIR, null, 0);
    circle(ctx, cx, 42, 16, T_HAIR);
    drawTeacherFace(ctx, cx, 92, {});
    return canvas;
}

/** Angry teacher face: glasses, furious brows, shouting mouth. */
function drawTeacherFace(ctx, cx, cy, { shocked = false } = {}) {
    // glasses
    ctx.fillStyle = 'rgba(174, 214, 241, 0.75)';
    for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + side * 19, cy - 2, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = T_GLASSES; ctx.lineWidth = 4; ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 2); ctx.lineTo(cx + 7, cy - 2);
    ctx.strokeStyle = T_GLASSES; ctx.lineWidth = 4; ctx.stroke();
    // eyes
    ctx.fillStyle = T_GLASSES;
    if (shocked) {
        circle(ctx, cx - 19, cy - 2, 6, '#ffffff', T_GLASSES, 3);
        circle(ctx, cx + 19, cy - 2, 6, '#ffffff', T_GLASSES, 3);
    }
    ctx.beginPath();
    ctx.arc(cx - 19, cy - 2, shocked ? 3.4 : 3.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 19, cy - 2, shocked ? 3.4 : 3.8, 0, Math.PI * 2); ctx.fill();
    // furious eyebrows
    ctx.strokeStyle = '#5b5568';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - 32, cy - 20); ctx.lineTo(cx - 8, cy - 12); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 32, cy - 20); ctx.lineTo(cx + 8, cy - 12); ctx.stroke();
    // shouting mouth
    ctx.beginPath();
    if (shocked) {
        ctx.ellipse(cx, cy + 22, 12, 15, 0, 0, Math.PI * 2);
        shape(ctx, '#8c2f39');
    } else {
        ctx.ellipse(cx, cy + 20, 14, 10, 0, 0, Math.PI * 2);
        shape(ctx, '#8c2f39');
        // teeth
        ctx.fillStyle = '#ffffff';
        rr(ctx, cx - 8, cy + 12, 16, 5, 2); ctx.fill();
    }
}

// ---------------------------------------------------------------------------
// GROUND — seamless gravel + paving + baked lane dividers, 512×512 (POT)
// Texture maps a 12×10 u area (TILE_WIDTH × TILE_LENGTH / TEXTURE_REPEAT_Y).
// ---------------------------------------------------------------------------
export function drawGroundTexture() {
    const { canvas, ctx } = makeCanvas(512, 512);
    const px = 512 / 12; // pixels per world unit (x)

    // base warm gravel
    ctx.fillStyle = '#d8cdb8';
    ctx.fillRect(0, 0, 512, 512);

    // subtle paving joints (tiles every 128 px = 2.5 u)
    ctx.strokeStyle = 'rgba(120, 104, 82, 0.18)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(512, i * 128); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 512); ctx.stroke();
    }

    // speckle noise
    let seed = 1337;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 1600; i++) {
        const x = rand() * 512, y = rand() * 512;
        const shade = rand();
        ctx.fillStyle = shade < 0.5
            ? `rgba(120, 104, 82, ${0.05 + rand() * 0.12})`
            : `rgba(245, 238, 220, ${0.05 + rand() * 0.12})`;
        const s = 1 + rand() * 2.4;
        ctx.fillRect(x, y, s, s);
    }
    // rounded pebbles
    for (let i = 0; i < 46; i++) {
        const x = rand() * 512, y = rand() * 512, r = 2.5 + rand() * 5;
        const tone = rand();
        const fill = tone < 0.4 ? '#c4b49a' : tone < 0.75 ? '#bda887' : '#e8dfca';
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.78, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = 'rgba(110, 95, 75, 0.35)'; ctx.lineWidth = 1.4; ctx.stroke();
    }

    // lane divider dashed lines at x = ±2 u (avoid the paving joints' look)
    const dashes = [64, 64]; // dash, gap — 4 seamless periods per texture
    for (const ux of [-2, 2]) {
        const x = (ux + 6) * px;
        let y = 0, k = 0;
        while (y < 512) {
            const seg = dashes[k % 2];
            if (k % 2 === 0) {
                ctx.fillStyle = 'rgba(255, 215, 0, 0.85)';
                rr(ctx, x - 4, y + 2, 8, seg - 4, 4); ctx.fill();
                ctx.strokeStyle = 'rgba(120, 100, 40, 0.4)'; ctx.lineWidth = 1.5;
                rr(ctx, x - 4, y + 2, 8, seg - 4, 4); ctx.stroke();
            }
            y += seg; k++;
        }
    }

    // royal-blue track edging (~0.5 u each side) with a white inner line
    const edge = 22;
    ctx.fillStyle = '#4169e1';
    ctx.fillRect(0, 0, edge, 512);
    ctx.fillRect(512 - edge, 0, edge, 512);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(edge, 0, 4, 512);
    ctx.fillRect(512 - edge - 4, 0, 4, 512);
    // subtle darker top band for depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
    ctx.fillRect(0, 0, edge, 6); ctx.fillRect(512 - edge, 0, edge, 6);

    return canvas;
}

// ---------------------------------------------------------------------------
// GRADE PAPER — square "graded test" card, 256×256 (POT), tier-coloured
// ---------------------------------------------------------------------------
export function drawPaperCard(tier) {
    const { canvas, ctx } = makeCanvas(256, 256);
    const color = '#' + tier.color.toString(16).padStart(6, '0');

    // drop shadow
    rr(ctx, 28, 28, 212, 218, 18);
    ctx.fillStyle = 'rgba(47, 42, 62, 0.25)'; ctx.fill();

    // card
    rr(ctx, 20, 16, 212, 218, 18);
    shape(ctx, '#fdfdf6', '#c9c3ae', 4);

    // top band in the tier colour
    ctx.save();
    rr(ctx, 20, 16, 212, 218, 18);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(20, 16, 212, 42);
    ctx.restore();

    // band text
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px Orbitron, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GRADE', 126, 38);

    // A+ radiating rays
    if (tier.grade === 'A+') {
        ctx.save();
        ctx.translate(126, 148);
        ctx.fillStyle = 'rgba(255, 20, 147, 0.18)';
        for (let i = 0; i < 8; i++) {
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(-16, -108); ctx.lineTo(16, -108);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }

    // the big grade letter
    ctx.font = '900 118px Orbitron, Arial, sans-serif';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(47, 42, 62, 0.9)';
    ctx.strokeText(tier.grade, 126, 150);
    ctx.fillStyle = color;
    ctx.fillText(tier.grade, 126, 150);

    // teacher's red-pen circle around the grade
    ctx.save();
    ctx.translate(126, 148);
    ctx.rotate(-0.12);
    ctx.strokeStyle = 'rgba(217, 83, 79, 0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 86, 62, 0, Math.PI * 0.15, Math.PI * 2.05);
    ctx.stroke();
    ctx.restore();

    // ruled lines at the bottom (test answers)
    ctx.strokeStyle = 'rgba(90, 110, 160, 0.5)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(52, 204 + i * 18);
        ctx.lineTo(204, 204 + i * 18);
        ctx.stroke();
    }
    // red checkmark
    ctx.strokeStyle = '#d9534f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(196, 216); ctx.lineTo(206, 228); ctx.lineTo(226, 200);
    ctx.stroke();

    return canvas;
}

// ---------------------------------------------------------------------------
// PARTICLES & SKY (soft radial sprites)
// ---------------------------------------------------------------------------
function radialSprite(size, stops) {
    const { canvas, ctx } = makeCanvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [pos, color] of stops) g.addColorStop(pos, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return canvas;
}

/** Soft white dust puff. */
export const drawDust = () => radialSprite(128, [
    [0, 'rgba(255, 250, 240, 0.95)'],
    [0.45, 'rgba(240, 230, 210, 0.55)'],
    [1, 'rgba(240, 230, 210, 0)'],
]);

/** Additive glow (A+ papers & collect sparkles). */
export const drawGlow = () => radialSprite(128, [
    [0, 'rgba(255, 255, 255, 0.95)'],
    [0.3, 'rgba(255, 130, 220, 0.55)'],
    [1, 'rgba(255, 20, 147, 0)'],
]);

/** Soft blob shadow under characters. */
export const drawShadowBlob = () => radialSprite(128, [
    [0, 'rgba(20, 24, 40, 0.42)'],
    [0.6, 'rgba(20, 24, 40, 0.28)'],
    [1, 'rgba(20, 24, 40, 0)'],
]);

/** Puffy cartoon cloud. */
export function drawCloud() {
    const { canvas, ctx } = makeCanvas(256, 256);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    const blobs = [
        [78, 150, 44], [128, 122, 56], [186, 148, 42], [110, 168, 38], [156, 172, 36],
    ];
    for (const [x, y, r] of blobs) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // flat-ish bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    rr(ctx, 44, 150, 172, 44, 22); ctx.fill();
    // soft shading
    ctx.fillStyle = 'rgba(150, 190, 235, 0.35)';
    rr(ctx, 60, 176, 140, 16, 8); ctx.fill();
    return canvas;
}

// ---------------------------------------------------------------------------
// PUBLIC API — canvases for the asset pipeline
// ---------------------------------------------------------------------------
export function generateStudentFrames() {
    return {
        runA: drawStudent('runA'),
        runB: drawStudent('runB'),
        jump: drawStudent('jump'),
        slide: drawStudent('slide'),
    };
}

export function generateTeacherFrames() {
    return {
        runA: drawTeacher('runA'),
        runB: drawTeacher('runB'),
        grab: drawTeacher('grab'),
    };
}

/**
 * Paving slabs for the campus sidewalk — light concrete with darker joints.
 * The grid lines sit ON the canvas edges, so the two halves of each line
 * join up when the texture tiles (seamless in both axes).
 */
export function drawPavingTexture() {
    const S = 256;
    const { canvas, ctx } = makeCanvas(S, S);
    ctx.fillStyle = '#d9d3c5';
    ctx.fillRect(0, 0, S, S);

    // fine speckle so large slabs do not read as flat colour
    for (let i = 0; i < 3000; i++) {
        const a = Math.random() * 0.055;
        ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
        ctx.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }

    ctx.strokeStyle = '#b5ae9e';
    ctx.lineWidth = 5;
    const n = 2, cell = S / n;
    for (let i = 0; i <= n; i++) {
        ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(S, i * cell); ctx.stroke();
    }
    return canvas;
}

/**
 * Facade for one school building variant: stone plinth, yellow wall with a
 * recessed band per floor, and a grid of framed windows. Sized to the
 * variant's floor/column count so the window grid is never stretched.
 *
 * Note: CampusManager maps this to all six faces of a box (one material, one
 * draw call). The roof is never visible — the camera sits far below the
 * parapet — so the extra faces cost nothing.
 *
 * @param {{floors:number, cols:number}} v  building variant from config
 */
export function drawBuildingFacade(v) {
    const cell = 56;
    const plinth = Math.round(cell * 0.55);
    const cornice = Math.round(cell * 0.5);
    const W = v.cols * cell;
    const H = v.floors * cell + plinth + cornice;
    const { canvas, ctx } = makeCanvas(W, H);

    const C = {
        wall: '#e6c469', shade: '#cfab52', window: '#4d6f8c',
        glass: '#7d9db8', frame: '#f4f1e8', plinth: '#8d6a4a', cornice: '#b8863f',
    };

    // wall
    ctx.fillStyle = C.wall;
    ctx.fillRect(0, 0, W, H);

    // grime gradient (semi-realistic: dirt settles low)
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,0.14)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(60,40,10,0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // floors, bottom-up: row 0 is the ground floor
    for (let f = 0; f < v.floors; f++) {
        const yTop = H - cornice - (f + 1) * cell;
        // recessed band under each floor slab
        ctx.fillStyle = C.shade;
        ctx.fillRect(0, yTop + cell - 9, W, 9);

        for (let c = 0; c < v.cols; c++) {
            const ww = Math.round(cell * 0.56);
            const wh = Math.round(cell * 0.6);
            const x = c * cell + (cell - ww) / 2;
            const y = yTop + (cell - wh) / 2 + 2;

            // frame
            ctx.fillStyle = C.frame;
            ctx.fillRect(x - 4, y - 4, ww + 8, wh + 8);
            // glass
            ctx.fillStyle = C.window;
            ctx.fillRect(x, y, ww, wh);
            // a believable highlight + the odd lit/unlit room
            const lit = Math.random() < 0.22;
            ctx.fillStyle = lit ? '#f6e7b4' : C.glass;
            ctx.fillRect(x, y, ww, Math.round(wh * 0.42));
            // mullion
            ctx.fillStyle = C.frame;
            ctx.fillRect(x + Math.round(ww / 2) - 2, y, 4, wh);
        }
    }

    // stone plinth + roof cornice
    ctx.fillStyle = C.plinth;
    ctx.fillRect(0, H - plinth, W, plinth);
    ctx.fillStyle = C.cornice;
    ctx.fillRect(0, 0, W, cornice);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, cornice - 6, W, 6);

    return canvas;
}

/**
 * Vertical sky gradient used as the scene background ("skybox" without a cube
 * map). The bottom colour IS the horizon colour, and LIGHTING.FOG.color is
 * pinned to the same value, so distant buildings dissolve into the sky with
 * no visible seam.
 *
 * @param {string} top      zenith colour
 * @param {string} horizon  colour at the horizon line
 */
export function drawSkyGradient(top, horizon) {
    const W = 4, H = 256;
    const { canvas, ctx } = makeCanvas(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.62, horizon);
    g.addColorStop(1, horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return canvas;
}
