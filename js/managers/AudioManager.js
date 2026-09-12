/**
 * AudioManager — sound effects & music
 * (spec §7, API per research report §5C).
 *
 * Two engines behind ONE public API:
 *  1. If real files exist in assets/sounds/*.mp3, they are played through
 *     Howler.js 2.2.4 (lazy-loaded, pinned CDN URL, config AUDIO.HOWLER_URL).
 *  2. Anything missing falls back to Web-Audio synthesis — the game ships
 *     fully playable with zero asset files:
 *       jump  = rising triangle sweep
 *       collect = two-note sine ding (pitch rises with combo)
 *       hit    = filtered noise thud + low sine
 *       teacherAlert = two-tone descending saw
 *       gameOver = descending sting
 *       music  = upbeat chiptune loop (square lead / triangle bass /
 *                noise hats / kick) scheduled with a look-ahead scheduler
 *
 * The public API is identical to the Howler version in the research report,
 * so dropping real mp3s in later requires no game-code changes.
 */
import { AUDIO, STORAGE } from '../config.js';
import { probeExisting, loadHowler } from '../utils/AssetLoader.js';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---- chiptune loop: 4 bars of 16th notes at MUSIC_BPM ----
// 0 = rest. Lead (square), bass (triangle, quarter notes).
const LEAD = [
    // bar 1 (C)
    76, 0, 79, 0, 84, 0, 79, 0, 76, 0, 79, 0, 81, 79, 76, 0,
    // bar 2 (Am)
    69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 72, 0, 74, 72, 69, 0,
    // bar 3 (F)
    77, 0, 76, 0, 74, 0, 76, 0, 77, 0, 79, 0, 81, 0, 79, 0,
    // bar 4 (G)
    74, 0, 71, 0, 67, 0, 71, 0, 74, 0, 76, 0, 79, 0, 76, 74,
];
const BASS = [
    48, 0, 0, 0, 48, 0, 0, 0, 55, 0, 0, 0, 52, 0, 0, 0,
    45, 0, 0, 0, 45, 0, 0, 0, 52, 0, 0, 0, 48, 0, 0, 0,
    41, 0, 0, 0, 41, 0, 0, 0, 48, 0, 0, 0, 45, 0, 0, 0,
    43, 0, 0, 0, 43, 0, 0, 0, 50, 0, 0, 0, 47, 0, 0, 0,
];

export class AudioManager {
    constructor() {
        /** @type {AudioContext|null} */
        this.ctx = null;
        this.master = null;
        this.sfxGain = null;
        this.musicGain = null;
        this._noiseBuffer = null;

        /** @type {Map<string, import('howler').Howl>} */
        this.howls = new Map();
        this.Howler = null;

        this.muted = false;
        this._musicOn = false;
        this._musicTimer = null;
        this._nextNoteTime = 0;
        this._step = 0;
        this._comboPitch = 1;

        try {
            this.muted = localStorage.getItem(`${STORAGE.PREFIX}.${STORAGE.MUTED_KEY}`) === '1';
        } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    /**
     * Detect real sound files and load them via Howler; anything missing
     * stays on the synth engine. Never throws.
     *
     * Probing strategy: a single sentinel request (bg-music.mp3) keeps the
     * console clean on a default install — the full per-file probe only
     * runs once the user has actually added sounds.
     */
    async load() {
        const defs = AUDIO.SOUNDS;
        const sentinel = defs.bgMusic;
        if (!sentinel) return;
        try {
            const sentinelExists = (await probeExisting([sentinel])).size > 0;
            if (!sentinelExists) return;

            const urls = Object.values(defs).filter(Boolean);
            const existing = await probeExisting(urls);
            if (existing.size === 0) return;
            const Howl = await loadHowler();
            if (!Howl) return;
            this.Howler = window.Howler || null;
            for (const [key, src] of Object.entries(defs)) {
                if (!src || !existing.has(src)) continue;
                const isMusic = key === 'bgMusic';
                this.howls.set(key, new Howl({
                    src: [src],
                    loop: isMusic,
                    volume: isMusic ? AUDIO.MUSIC_VOLUME : AUDIO.SFX_VOLUME,
                    preload: true,
                }));
            }
        } catch (e) {
            // synth fallback — never break the boot
            this.howls.clear();
        }
    }

    /**
     * Create/resume the AudioContext. MUST be called from a user gesture
     * (the START button click) to satisfy autoplay policies.
     */
    unlock() {
        try {
            if (!this.ctx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                this.ctx = new Ctx();

                this.master = this.ctx.createGain();
                this.master.gain.value = this.muted ? 0 : AUDIO.MASTER_VOLUME;
                this.master.connect(this.ctx.destination);

                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = AUDIO.SFX_VOLUME;
                this.sfxGain.connect(this.master);

                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = AUDIO.MUSIC_VOLUME;
                this.musicGain.connect(this.master);

                // 1 s of white noise, reused by hit/hat sounds
                const len = this.ctx.sampleRate;
                this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                const data = this._noiseBuffer.getChannelData(0);
                for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

                // auto-resume after mobile backgrounding
                this.ctx.addEventListener('statechange', () => {
                    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
                });
            }
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        } catch (e) { /* audio unavailable — game runs silent */ }
    }

    // ------------------------------------------------------------------
    // Public API (identical shape to the research report §5C)
    // ------------------------------------------------------------------

    /** Play a named sound effect. */
    play(name, opts = {}) {
        const howl = this.howls.get(name);
        if (howl) {
            try { howl.play(); } catch (e) { /* ignore */ }
            return;
        }
        this._synth(name, opts);
    }

    /** Alias kept for spec parity. */
    playSound(name) { this.play(name); }

    startMusic() {
        if (this._musicOn) return;
        const howl = this.howls.get('bgMusic');
        if (howl) {
            try { howl.play(); } catch (e) { /* ignore */ }
            this._musicOn = true;
            return;
        }
        if (!this.ctx) return;
        this._musicOn = true;
        this._step = 0;
        this._nextNoteTime = this.ctx.currentTime + 0.06;
        this._musicTimer = setInterval(() => this._scheduleMusic(), AUDIO.MUSIC_TIMER_MS);
    }

    stopMusic() {
        this._musicOn = false;
        if (this._musicTimer) {
            clearInterval(this._musicTimer);
            this._musicTimer = null;
        }
        const howl = this.howls.get('bgMusic');
        if (howl) { try { howl.stop(); } catch (e) { /* ignore */ } }
    }

    /** @returns {boolean} the new muted state */
    toggleMute() {
        this.muted = !this.muted;
        if (this.Howler) { try { this.Howler.mute(this.muted); } catch (e) { /* ignore */ } }
        if (this.master && this.ctx) {
            const t = this.ctx.currentTime;
            this.master.gain.cancelScheduledValues(t);
            this.master.gain.setTargetAtTime(this.muted ? 0 : AUDIO.MASTER_VOLUME, t, 0.03);
        }
        try {
            localStorage.setItem(`${STORAGE.PREFIX}.${STORAGE.MUTED_KEY}`, this.muted ? '1' : '0');
        } catch (e) { /* ignore */ }
        return this.muted;
    }

    setMasterVolume(v) {
        if (this.master && !this.muted) this.master.gain.value = Math.max(0, Math.min(1, v));
        if (this.Howler) { try { this.Howler.volume(v); } catch (e) { /* ignore */ } }
    }

    /** Pitch bump for collect combos (1.0 = normal). */
    setComboPitch(mult) { this._comboPitch = mult; }

    get isMuted() { return this.muted; }

    // ------------------------------------------------------------------
    // Synth voices
    // ------------------------------------------------------------------

    _synth(name, opts = {}) {
        if (!this.ctx || !this.sfxGain) return;
        try {
            switch (name) {
                case 'jump': return this._sfxJump();
                case 'collect': return this._sfxCollect();
                case 'hit': return this._sfxHit();
                case 'teacherAlert': return this._sfxTeacherAlert();
                case 'gameOver': return this._sfxGameOver();
                case 'caught': return this._sfxCaught();
                case 'ui': return this._sfxUi();
                default: return;
            }
        } catch (e) { /* never let audio errors surface */ }
    }

    _env(t0, attack, peak, decay) {
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
        return g;
    }

    _osc(type, f0, t0, dur) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t0);
        o.start(t0);
        o.stop(t0 + dur);
        return o;
    }

    _sfxJump() {
        const t = this.ctx.currentTime;
        const o = this._osc('triangle', 240, t, 0.2);
        o.frequency.exponentialRampToValueAtTime(580, t + 0.15);
        const g = this._env(t, 0.008, 0.5, 0.17);
        o.connect(g).connect(this.sfxGain);
    }

    _sfxCollect() {
        const t = this.ctx.currentTime;
        const p = this._comboPitch;
        const g1 = this._env(t, 0.004, 0.32 * p, 0.10);
        this._osc('sine', 784 * p, t, 0.12).connect(g1).connect(this.sfxGain);
        const g2 = this._env(t + 0.07, 0.004, 0.30 * p, 0.16);
        this._osc('sine', 1175 * p, t + 0.07, 0.18).connect(g2).connect(this.sfxGain);
    }

    _sfxHit() {
        const t = this.ctx.currentTime;
        // filtered noise thud
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;
        const g = this._env(t, 0.005, 0.55, 0.22);
        src.connect(lp).connect(g).connect(this.sfxGain);
        src.start(t);
        src.stop(t + 0.3);
        // low body impact
        const o = this._osc('sine', 110, t, 0.22);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        const g2 = this._env(t, 0.005, 0.5, 0.2);
        o.connect(g2).connect(this.sfxGain);
    }

    _sfxTeacherAlert() {
        const t = this.ctx.currentTime;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;
        const g = this._env(t, 0.01, 0.4, 0.55);
        lp.connect(g).connect(this.sfxGain);
        const o1 = this._osc('sawtooth', 523.25, t, 0.2);
        o1.frequency.setValueAtTime(523.25, t + 0.18);
        const o2 = this._osc('sawtooth', 415.3, t + 0.18, 0.4);
        o1.connect(lp);
        o2.connect(lp);
    }

    _sfxCaught() {
        const t = this.ctx.currentTime;
        const o = this._osc('sawtooth', 180, t, 0.35);
        o.frequency.exponentialRampToValueAtTime(760, t + 0.3);
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        const g = this._env(t, 0.01, 0.42, 0.32);
        o.connect(lp).connect(g).connect(this.sfxGain);
        this._sfxHit();
    }

    _sfxGameOver() {
        const t = this.ctx.currentTime;
        const notes = [523.25, 392, 329.63, 261.63];
        notes.forEach((f, i) => {
            const ti = t + i * 0.16;
            const g = this._env(ti, 0.008, 0.34, 0.24);
            this._osc('triangle', f, ti, 0.3).connect(g).connect(this.sfxGain);
        });
        const last = this._osc('triangle', 196, t + notes.length * 0.16, 0.7);
        const gl = this._env(t + notes.length * 0.16, 0.01, 0.3, 0.65);
        last.connect(gl).connect(this.sfxGain);
    }

    _sfxUi() {
        const t = this.ctx.currentTime;
        const g = this._env(t, 0.004, 0.22, 0.08);
        this._osc('sine', 660, t, 0.1).connect(g).connect(this.sfxGain);
    }

    // ------------------------------------------------------------------
    // Chiptune scheduler
    // ------------------------------------------------------------------

    _scheduleMusic() {
        if (!this._musicOn || !this.ctx) return;
        const stepDur = 60 / AUDIO.MUSIC_BPM / 4;   // 16th note
        while (this._nextNoteTime < this.ctx.currentTime + AUDIO.MUSIC_LOOKAHEAD) {
            this._scheduleStep(this._step, this._nextNoteTime, stepDur);
            this._nextNoteTime += stepDur;
            this._step = (this._step + 1) % LEAD.length;
        }
    }

    _scheduleStep(step, t, stepDur) {
        const inBar = step % 16;

        // lead
        const lead = LEAD[step];
        if (lead) {
            const g = this._env(t, 0.005, 0.12, stepDur * 1.6);
            this._osc('square', midiToFreq(lead), t, stepDur * 2)
                .connect(g).connect(this.musicGain);
        }
        // bass
        const bass = BASS[step];
        if (bass) {
            const g = this._env(t, 0.005, 0.22, stepDur * 3.2);
            this._osc('triangle', midiToFreq(bass), t, stepDur * 3.5)
                .connect(g).connect(this.musicGain);
        }
        // hat: 8th notes
        if (inBar % 2 === 0) {
            const src = this.ctx.createBufferSource();
            src.buffer = this._noiseBuffer;
            const hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 7000;
            const g = this._env(t, 0.001, inBar % 4 === 2 ? 0.05 : 0.028, 0.03);
            src.connect(hp).connect(g).connect(this.musicGain);
            src.start(t);
            src.stop(t + 0.05);
        }
        // kick: beats 1 & 3
        if (inBar === 0 || inBar === 8) {
            const o = this._osc('sine', 130, t, 0.12);
            o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
            const g = this._env(t, 0.003, 0.30, 0.11);
            o.connect(g).connect(this.musicGain);
        }
    }
}
