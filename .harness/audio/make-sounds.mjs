/**
 * make-sounds.mjs — regenerate the committed sound set in assets/sounds/.
 *
 * WHY THIS EXISTS
 * ---------------
 * The six mp3s in assets/sounds/ were originally synthesized by a scratch
 * script that was never committed and is now gone. The mp3s became the
 * contract, which left them un-tweakable. This is that script, rebuilt.
 *
 * It mirrors AudioManager._synth voice-for-voice: same waveforms, same
 * frequencies, same envelope times, same chiptune note tables. Change a
 * number here, re-run it, and the shipped mp3s follow.
 *
 * Everything is pure JS (no Web Audio, no ffmpeg — neither exists in a
 * headless sandbox). Samples are rendered into Float32 buffers and encoded
 * with @breezystack/lamejs.
 *
 *   NOTE: the plain `lamejs` npm package is broken under Node (it relies on
 *   implicit globals). Use @breezystack/lamejs.
 *
 * Usage
 * -----
 *   cd .harness
 *   npm install --no-save @breezystack/lamejs
 *   node audio/make-sounds.mjs                # writes all six mp3s
 *   node audio/make-sounds.mjs jump hit       # only those voices
 *   node audio/make-sounds.mjs --dry-run      # render + report, write nothing
 *   node audio/make-sounds.mjs --out /tmp/sfx # write somewhere else to audition
 *
 * The committed mp3s stay byte-identical unless you re-run this: encoding is
 * deterministic for a given lamejs version and bitrate.
 */
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Config (keep in step with js/config.js AUDIO.*)
// ---------------------------------------------------------------------------
const RATE = 44100;
const KBPS = 128;
const DEFAULT_OUT_DIR = path.resolve(import.meta.dirname, '../../assets/sounds');
let OUT_DIR_OVERRIDE = null;

const MUSIC_BPM = 132;
const MASTER = 0.7;

// ---- chiptune loop (copied verbatim from AudioManager) ----
const LEAD = [
    76, 0, 79, 0, 84, 0, 79, 0, 76, 0, 79, 0, 81, 79, 76, 0,
    69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 72, 0, 74, 72, 69, 0,
    77, 0, 76, 0, 74, 0, 76, 0, 77, 0, 79, 0, 81, 0, 79, 0,
    74, 0, 71, 0, 67, 0, 71, 0, 74, 0, 76, 0, 79, 0, 76, 74,
];
const BASS = [
    48, 0, 0, 0, 48, 0, 0, 0, 55, 0, 0, 0, 52, 0, 0, 0,
    45, 0, 0, 0, 45, 0, 0, 0, 52, 0, 0, 0, 48, 0, 0, 0,
    41, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0, 45, 0, 0, 0,
    43, 0, 0, 0, 43, 0, 0, 0, 50, 0, 0, 0, 47, 0, 0, 0,
];

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------
// Tiny offline audio graph
// ---------------------------------------------------------------------------

/** Mixing buffer with helpers, standing in for an AudioContext. */
class Buf {
    constructor(seconds) {
        this.n = Math.ceil(seconds * RATE);
        this.data = new Float32Array(this.n);
    }
    /** add an oscillator from t0 for dur seconds */
    osc(type, f0, t0, dur, env, glideTo = null, glideTime = dur) {
        const start = Math.floor(t0 * RATE);
        const len = Math.floor(dur * RATE);
        if (start >= this.n) return;
        const end = Math.min(this.n, start + len);
        for (let i = start; i < end; i++) {
            const localT = (i - start) / RATE;
            const f = glideTo != null
                ? f0 * Math.pow(glideTo / f0, Math.min(1, localT / glideTime))
                : f0;
            const phase = (localT * f) % 1;
            let s;
            switch (type) {
                case 'sine': s = Math.sin(2 * Math.PI * phase); break;
                case 'square': s = phase < 0.5 ? 1 : -1; break;
                case 'sawtooth': s = 2 * phase - 1; break;
                case 'triangle': s = 4 * Math.abs(phase - 0.5) - 1; break;
                default: s = 0;
            }
            this.data[i] += s * env.at(localT, (end - i) / RATE);
        }
    }
    /** add filtered noise from t0 at sample index */
    noise(t0, dur, env, filter) {
        const start = Math.floor(t0 * RATE);
        const len = Math.floor(dur * RATE);
        if (start >= this.n) return;
        const end = Math.min(this.n, start + len);
        let lpState = 0, hpPrevIn = 0, hpPrevOut = 0;
        const dt = 1 / RATE;
        for (let i = start; i < end; i++) {
            const localT = (i - start) / RATE;
            let v = Math.random() * 2 - 1;
            if (filter === 'lowpass') {
                // one-pole @ 420 Hz (matches _sfxHit)
                const a = 1 - Math.exp(-2 * Math.PI * 420 * dt);
                lpState += a * (v - lpState);
                v = lpState;
            } else if (filter === 'highpass') {
                // one-pole @ 7000 Hz (matches the hat)
                const a = 1 / (1 + 2 * Math.PI * 7000 * dt);
                const out = a * (hpPrevOut + v - hpPrevIn);
                hpPrevIn = v; hpPrevOut = out;
                v = out;
            }
            this.data[i] += v * env.at(localT, (end - i) / RATE);
        }
    }
    /** soft-clip + scale, ready for the encoder */
    toPcm16(scale = MASTER) {
        const out = new Int16Array(this.n);
        for (let i = 0; i < this.n; i++) {
            out[i] = Math.max(-1, Math.min(1, Math.tanh(this.data[i] * scale)) * 32767);
        }
        return out;
    }
}

/**
 * Exponential AD envelope, matching AudioManager._env:
 *   gain: 0.0001 -> peak over `attack`, then -> 0.0001 over `decay`.
 * Web Audio uses an exponential ramp toward a floor, so the tail is a
 * long quiet decay rather than a hard cut; we mirror that shape.
 */
function env(attack, peak, decay) {
    const floor = 0.0001;
    return {
        at(localT) {
            if (localT < attack) {
                const k = localT / attack;
                return floor * Math.pow(Math.max(peak, 0.0002) / floor, k);
            }
            const k = (localT - attack) / decay;
            if (k >= 1) return floor * Math.pow(floor / Math.max(peak, 0.0002), k - 1);
            return Math.max(peak, 0.0002) * Math.pow(floor / Math.max(peak, 0.0002), k);
        },
    };
}

// ---------------------------------------------------------------------------
// Voices — 1:1 with AudioManager._sfx*
// ---------------------------------------------------------------------------

const VOICES = {
    // _sfxJump: triangle 240 -> 580 Hz over 0.15 s
    jump: { seconds: 0.35, render(b) {
        b.osc('triangle', 240, 0, 0.2, env(0.008, 0.5, 0.17), 580, 0.15);
    } },

    // _sfxCollect: two sine blips at 784 and 1175 Hz (combo pitch = 1.0)
    collect: { seconds: 0.4, render(b) {
        b.osc('sine', 784, 0, 0.12, env(0.004, 0.32, 0.10));
        b.osc('sine', 1175, 0.07, 0.18, env(0.004, 0.30, 0.16));
    } },

    // _sfxHit: lowpassed noise thud + a 110 -> 42 Hz body impact
    hit: { seconds: 0.6, render(b) {
        b.noise(0, 0.3, env(0.005, 0.55, 0.22), 'lowpass');
        b.osc('sine', 110, 0, 0.22, env(0.005, 0.5, 0.2), 42, 0.18);
    } },

    // _sfxTeacherAlert: two saw notes (523.25 then 415.3) through a 1.1 kHz LPF
    teacherAlert: { seconds: 0.9, render(b) {
        const e = env(0.01, 0.4, 0.55);
        // the LPF is approximated by rolling the saw's upper harmonics off
        b.osc('sawtooth', 523.25, 0, 0.2, e, null, 0.2, 1100);
        b.osc('sawtooth', 415.3, 0.18, 0.4, e, null, 0.4, 1100);
    } },

    // _sfxGameOver: a falling C-G-E-C figure, then a low 196 Hz tail
    gameOver: { seconds: 1.8, render(b) {
        const notes = [523.25, 392, 329.63, 261.63];
        notes.forEach((f, i) => {
            b.osc('triangle', f, i * 0.16, 0.3, env(0.008, 0.34, 0.24));
        });
        b.osc('triangle', 196, notes.length * 0.16, 0.7, env(0.01, 0.3, 0.65));
    } },

    // _scheduleStep × 2 loops of the 4-bar chiptune (lead + bass + hat + kick)
    bgMusic: { seconds: (60 / MUSIC_BPM / 4) * LEAD.length * 2 + 0.4, render(b) {
        const stepDur = 60 / MUSIC_BPM / 4;
        const loops = 2;
        for (let l = 0; l < loops; l++) {
            const base = l * LEAD.length * stepDur;
            for (let step = 0; step < LEAD.length; step++) {
                const t = base + step * stepDur;
                const inBar = step % 16;

                const lead = LEAD[step];
                if (lead) {
                    b.osc('square', midiToFreq(lead), t, stepDur * 2,
                        env(0.005, 0.12, stepDur * 1.6));
                }
                const bass = BASS[step];
                if (bass) {
                    b.osc('triangle', midiToFreq(bass), t, stepDur * 3.5,
                        env(0.005, 0.22, stepDur * 3.2));
                }
                if (inBar % 2 === 0) {
                    b.noise(t, 0.05,
                        env(0.001, inBar % 4 === 2 ? 0.05 : 0.028, 0.03), 'highpass');
                }
                if (inBar === 0 || inBar === 8) {
                    b.osc('sine', 130, t, 0.12, env(0.003, 0.30, 0.11), 46, 0.1);
                }
            }
        }
    } },
};

/** synth-only voices: no mp3 is committed for these (see AUDIO.SOUNDS) */
const SYNTH_ONLY = ['caught', 'ui'];

/** voice key -> the filename the game actually probes (AUDIO.SOUNDS) */
const FILE_FOR = {
    jump: 'jump.mp3',
    collect: 'collect.mp3',
    hit: 'hit.mp3',
    teacherAlert: 'teacher-alert.mp3',   // NB: kebab-case on disk
    gameOver: 'gameover.mp3',
    bgMusic: 'bg-music.mp3',
};

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

async function encode(pcm16) {
    const { default: lamejs } = await import('@breezystack/lamejs');
    const Mp3Encoder = lamejs.Mp3Encoder ?? lamejs;
    const enc = new Mp3Encoder(1, RATE, KBPS);
    const chunks = [];
    const BLOCK = 1152;
    for (let i = 0; i < pcm16.length; i += BLOCK) {
        const block = pcm16.subarray(i, Math.min(i + BLOCK, pcm16.length));
        const buf = enc.encodeBuffer(block);
        if (buf.length) chunks.push(Buffer.from(buf));
    }
    const tail = enc.flush();
    if (tail.length) chunks.push(Buffer.from(tail));
    return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outIdx = args.indexOf('--out');
if (outIdx >= 0) OUT_DIR_OVERRIDE = path.resolve(args[outIdx + 1]);
const wanted = args.filter((a) => !a.startsWith('--')
    && a !== OUT_DIR_OVERRIDE && args[args.indexOf(a) - 1] !== '--out');
const names = wanted.length ? wanted : Object.keys(VOICES);

for (const name of names) {
    if (!VOICES[name]) {
        console.error(`unknown voice "${name}". Known: ${Object.keys(VOICES).join(', ')}`);
        console.error(`(synth-only, no mp3 committed: ${SYNTH_ONLY.join(', ')})`);
        process.exit(1);
    }
}

const OUT_DIR = OUT_DIR_OVERRIDE ?? DEFAULT_OUT_DIR;
if (!dryRun) fs.mkdirSync(OUT_DIR, { recursive: true });

console.log(`rate ${RATE} Hz, mono, ${KBPS} kbps, master ${MASTER}\n`);
for (const name of names) {
    const voice = VOICES[name];
    const b = new Buf(voice.seconds);
    voice.render(b);
    const pcm = b.toPcm16();
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]) / 32768);

    if (dryRun) {
        console.log(`${name.padEnd(13)} ${voice.seconds.toFixed(2)} s  peak ${peak.toFixed(3)}  (dry run, not written)`);
        continue;
    }
    const mp3 = await encode(pcm);
    const file = path.join(OUT_DIR, FILE_FOR[name] ?? `${name}.mp3`);
    fs.writeFileSync(file, mp3);
    console.log(`${name.padEnd(13)} ${voice.seconds.toFixed(2)} s  peak ${peak.toFixed(3)}  -> ${path.relative(process.cwd(), file)} (${(mp3.length / 1024).toFixed(1)} KB)`);
}

console.log(`\n${dryRun ? 'Dry run' : 'Wrote'} ${names.length} file(s).`);
if (!dryRun) console.log('Verify in-game: the harness asserts all 6 mp3s decode and that the synth never double-plays.');
