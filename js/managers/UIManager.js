/**
 * UIManager — screens, HUD, overlays & feedback
 * (spec §8 + design system from research report §6).
 *
 * All UI is DOM-over-canvas (cheap, crisp text, no per-frame canvas text).
 * HUD values are cached and only touched when they change (report §7 #13).
 */
import * as THREE from 'three';
import { CONFIG, UI } from '../config.js';

const $ = (id) => document.getElementById(id);

export class UIManager {
    /**
     * @param {object} callbacks {onStart, onRestart, onResume, onToggleMute, onPause}
     */
    constructor(callbacks = {}) {
        this.callbacks = callbacks;

        // screens
        this.startScreen = $('start-screen');
        this.gameOverScreen = $('gameover-screen');
        this.pauseScreen = $('pause-screen');
        this.loadingScreen = $('loading-screen');
        this.unsupportedScreen = $('unsupported-screen');

        // HUD
        this.hud = $('game-screen');
        this.scoreEl = $('score');
        this.gradeEl = $('grade');
        this.distanceEl = $('distance');
        this.muteBtn = $('mute-btn');
        this.pauseBtn = $('pause-btn');
        this.bestLine = $('best-line');
        // Mistake pips. Off by default (owner review #3: they read as "health
        // icons", which is misleading). The pressure cue is now purely the red
        // warning vignette. Set CONFIG.UI.SHOW_MISTAKE_PIPS = true to bring
        // the three dots back — the underlying 3-mistake rule is unchanged.
        this.mistakePips = $('mistake-pips');
        if (this.mistakePips && !CONFIG.UI.SHOW_MISTAKE_PIPS) {
            this.mistakePips.remove();
            this.mistakePips = null;
        }

        // overlays
        this.warningOverlay = $('warning-overlay');
        this.damageOverlay = $('damage-overlay');
        this.toastEl = $('toast');
        this.fpsEl = $('fps-monitor');

        // game-over stats
        this.finalScore = $('final-score');
        this.finalDistance = $('final-distance');
        this.finalGrades = $('final-grades');
        this.bestBadge = $('best-badge');

        // cached HUD values (only update DOM on change)
        this._score = -1;
        this._distance = -1;
        this._grade = '';
        this._warning = -1;
        this._pips = -1;

        // projected popup pool
        this._popups = [];
        this._vector = new THREE.Vector3();
        this.camera = null;
        this._toastTimer = null;

        // fps monitor (research report §7 snippet)
        this._fpsFrames = 0;
        this._fpsLast = performance.now();
        this._fpsText = '';

        this._buildPopupPool();
        this._wireButtons();
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------

    _wireButtons() {
        const bind = (el, fn) => {
            if (!el) return;
            el.addEventListener('click', (e) => {
                el.blur();                       // keep Space for jump
                fn();
            });
        };
        bind($('start-btn'), () => this.callbacks.onStart?.());
        bind($('restart-btn'), () => this.callbacks.onRestart?.());
        bind($('resume-btn'), () => this.callbacks.onResume?.());
        bind(this.muteBtn, () => this.callbacks.onToggleMute?.());
        bind(this.pauseBtn, () => this.callbacks.onPause?.());
    }

    attachCamera(camera) { this.camera = camera; }

    // ------------------------------------------------------------------
    // Screens
    // ------------------------------------------------------------------

    showScreen(name) {
        const screens = {
            start: this.startScreen,
            gameover: this.gameOverScreen,
            pause: this.pauseScreen,
        };
        for (const [key, el] of Object.entries(screens)) {
            el?.classList.toggle('active', key === name);
        }
        this.hud.classList.toggle('active', name === null || name === 'pause');
        if (name === 'gameover') this.hud.classList.remove('active');
    }

    hideAllScreens() {
        this.showScreen(null);
    }

    showLoading(visible) {
        this.loadingScreen?.classList.toggle('hidden', !visible);
    }

    showUnsupported(problems) {
        this.showLoading(false);
        const list = $('unsupported-problems');
        if (list && problems?.length) {
            list.innerHTML = '';
            for (const p of problems) {
                const li = document.createElement('li');
                li.textContent = p;
                list.appendChild(li);
            }
        }
        this.unsupportedScreen?.classList.add('active');
    }

    // ------------------------------------------------------------------
    // HUD
    // ------------------------------------------------------------------

    /**
     * @param {object} s {score, distance, tier, mistakes, mistakeMax}
     */
    updateHUD({ score, distance, tier, mistakes = 0, mistakeMax = 0 }) {
        if (score !== this._score) {
            this._score = score;
            this.scoreEl.textContent = score.toLocaleString('en-US');
            this._pulse(this.scoreEl.parentElement);
        }
        const d = Math.floor(distance);
        if (d !== this._distance) {
            this._distance = d;
            this.distanceEl.textContent = d.toLocaleString('en-US');
        }
        if (tier && tier.grade !== this._grade) {
            this._grade = tier.grade;
            this.gradeEl.textContent = `Grade ${tier.grade}`;
            this.gradeEl.style.borderColor = tier.cssColor;
            this.gradeEl.style.color = tier.cssColor;
            this._pulse(this.gradeEl);
        }
        const pips = mistakeMax > 0 ? mistakes : 0;
        if (pips !== this._pips) {
            this._pips = pips;
            this._renderPips(pips, mistakeMax);
        }
    }

    _renderPips(count, max) {
        if (!this.mistakePips) return;
        if (count <= 0) {
            this.mistakePips.classList.remove('visible');
            return;
        }
        this.mistakePips.classList.add('visible');
        const children = this.mistakePips.children;
        for (let i = 0; i < children.length; i++) {
            children[i].classList.toggle('filled', i < count);
            children[i].classList.toggle('danger', i === max - 1);
        }
    }

    _pulse(el) {
        if (!el) return;
        el.classList.remove('pulse');
        void el.offsetWidth;         // restart the animation
        el.classList.add('pulse');
    }

    // ------------------------------------------------------------------
    // Warning vignette / damage flash
    // ------------------------------------------------------------------

    showWarning(intensity) {
        const v = Math.round(THREE.MathUtils.clamp(intensity, 0, 1) * 100) / 100;
        if (v === this._warning) return;
        this._warning = v;
        this.warningOverlay.style.opacity = v;
        this.warningOverlay.classList.toggle('visible', v > 0.01);
    }

    flashDamage() {
        const el = this.damageOverlay;
        if (!el) return;
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
    }

    // ------------------------------------------------------------------
    // Popups (score gains, projected from world space)
    // ------------------------------------------------------------------

    _buildPopupPool() {
        const host = $('popup-layer');
        if (!host) return;
        for (let i = 0; i < UI.POPUP_POOL_SIZE; i++) {
            const el = document.createElement('div');
            el.className = 'popup';
            host.appendChild(el);
            this._popups.push(el);
        }
        this._popupIndex = 0;
    }

    /**
     * @param {string} text
     * @param {THREE.Vector3} worldPos
     * @param {string} [color]
     */
    popup(text, worldPos, color = CONFIG.COLORS.PRIMARY) {
        const el = this._popups[this._popupIndex];
        this._popupIndex = (this._popupIndex + 1) % this._popups.length;
        if (!el) return;

        let x = window.innerWidth / 2, y = window.innerHeight * 0.62;
        if (this.camera && worldPos) {
            this._vector.copy(worldPos).project(this.camera);
            x = (this._vector.x * 0.5 + 0.5) * window.innerWidth;
            y = (-this._vector.y * 0.5 + 0.5) * window.innerHeight;
        }
        el.textContent = text;
        el.style.color = color;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    // ------------------------------------------------------------------
    // Toast
    // ------------------------------------------------------------------

    toast(message, duration = UI.TOAST_DURATION) {
        if (!this.toastEl) return;
        this.toastEl.textContent = message;
        this.toastEl.classList.add('visible');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(
            () => this.toastEl.classList.remove('visible'), duration);
    }

    // ------------------------------------------------------------------
    // Start / game-over data
    // ------------------------------------------------------------------

    setBestLine(best) {
        if (!this.bestLine) return;
        if (best && (best.score > 0 || best.distance > 0)) {
            this.bestLine.textContent =
                `🏆 BEST · ${best.score.toLocaleString('en-US')} pts · ${best.distance.toLocaleString('en-US')} m`;
            this.bestLine.classList.add('visible');
        } else {
            this.bestLine.classList.remove('visible');
        }
    }

    showGameOver(stats, bestInfo) {
        this.finalScore.textContent = stats.score.toLocaleString('en-US');
        this.finalDistance.textContent = stats.distance.toLocaleString('en-US');

        // grade chips
        this.finalGrades.innerHTML = '';
        const tiers = CONFIG.GRADES.TIERS;
        for (const tier of tiers) {
            const chip = document.createElement('span');
            chip.className = 'grade-chip';
            chip.style.setProperty('--chip', tier.cssColor);
            chip.textContent = `${tier.grade} ×${stats.gradesCollected[tier.grade] || 0}`;
            this.finalGrades.appendChild(chip);
        }

        const isBest = bestInfo && (bestInfo.newBestScore || bestInfo.newBestDistance);
        this.bestBadge.classList.toggle('visible', !!isBest);
        this.showScreen('gameover');
    }

    // ------------------------------------------------------------------
    // Misc
    // ------------------------------------------------------------------

    setMuteIcon(muted) {
        if (!this.muteBtn) return;
        this.muteBtn.textContent = muted ? '🔇' : '🔊';
        this.muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    }

    /** Called once per frame from the game loop. */
    tickFps(renderer) {
        if (!this.fpsEl || !this.fpsEl.classList.contains('visible')) return;
        this._fpsFrames++;
        const now = performance.now();
        if (this._fpsFrames >= 30) {
            const fps = Math.round(this._fpsFrames * 1000 / (now - this._fpsLast));
            const calls = renderer ? renderer.info.render.calls : 0;
            const tris = renderer ? renderer.info.render.triangles : 0;
            this.fpsEl.textContent = `${fps} FPS · ${calls} calls · ${(tris / 1000).toFixed(1)}k tris`;
            this._fpsFrames = 0;
            this._fpsLast = now;
        }
    }

    setShowFps(visible) {
        this.fpsEl?.classList.toggle('visible', visible);
    }
}
