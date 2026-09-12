/**
 * GameState — state machine, scoring and persistence
 * (spec §9 + best-score localStorage extras).
 *
 * States: START -> PLAYING <-> PAUSED -> GAME_OVER
 */
import { CONFIG, GROUND, GRADES } from '../config.js';

const STATE = Object.freeze({
    START: 'START',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
});

export class GameState {
    constructor() {
        this.state = STATE.START;
        this.score = 0;
        this.distance = 0;              // metres run this game
        this.elapsed = 0;               // seconds of active play
        this.currentSpeed = GROUND.INITIAL_SPEED;
        this.gradesCollected = { D: 0, C: 0, B: 0, 'A+': 0 };
        this.combo = 0;                 // consecutive collects within COMBO_WINDOW
        this._lastCollectAt = -Infinity;
        this.best = GameState.loadBest();
    }

    static loadBest() {
        const S = CONFIG.STORAGE;
        let score = 0, distance = 0;
        try {
            score = parseInt(localStorage.getItem(`${S.PREFIX}.${S.BEST_SCORE_KEY}`) || '0', 10) || 0;
            distance = parseInt(localStorage.getItem(`${S.PREFIX}.${S.BEST_DISTANCE_KEY}`) || '0', 10) || 0;
        } catch (e) { /* storage unavailable (private mode) — ignore */ }
        return { score, distance };
    }

    /** Persist a new best (if beaten) and return which records were set. */
    commitBest() {
        const newBestScore = this.score > this.best.score;
        const newBestDistance = Math.floor(this.distance) > this.best.distance;
        if (newBestScore) this.best.score = this.score;
        if (newBestDistance) this.best.distance = Math.floor(this.distance);
        try {
            const S = CONFIG.STORAGE;
            if (newBestScore) localStorage.setItem(`${S.PREFIX}.${S.BEST_SCORE_KEY}`, String(this.best.score));
            if (newBestDistance) localStorage.setItem(`${S.PREFIX}.${S.BEST_DISTANCE_KEY}`, String(this.best.distance));
        } catch (e) { /* ignore */ }
        return { newBestScore, newBestDistance };
    }

    start() {
        this.reset();
        this.state = STATE.PLAYING;
    }

    pause() {
        if (this.state === STATE.PLAYING) this.state = STATE.PAUSED;
    }

    resume() {
        if (this.state === STATE.PAUSED) this.state = STATE.PLAYING;
    }

    gameOver() {
        this.state = STATE.GAME_OVER;
    }

    updateDistance(delta) {
        this.distance += delta;
    }

    updateSpeed(deltaTime) {
        if (this.currentSpeed < GROUND.MAX_SPEED) {
            this.currentSpeed = Math.min(
                GROUND.MAX_SPEED,
                this.currentSpeed + GROUND.SPEED_INCREMENT * deltaTime
            );
        }
    }

    /** @returns {object} the tier definition just collected (for points/audio) */
    collectGrade(tier, now = performance.now()) {
        this.gradesCollected[tier.grade] = (this.gradesCollected[tier.grade] || 0) + 1;
        this.score += tier.points;
        if (now - this._lastCollectAt <= GRADES.COMBO_WINDOW * 1000) {
            this.combo = Math.min(this.combo + 1, 12);
        } else {
            this.combo = 1;
        }
        this._lastCollectAt = now;
        return tier;
    }

    reset() {
        this.score = 0;
        this.distance = 0;
        this.elapsed = 0;
        this.currentSpeed = GROUND.INITIAL_SPEED;
        this.gradesCollected = { D: 0, C: 0, B: 0, 'A+': 0 };
        this.combo = 0;
        this._lastCollectAt = -Infinity;
    }

    getStats() {
        return {
            score: this.score,
            distance: Math.floor(this.distance),
            gradesCollected: { ...this.gradesCollected },
            totalPapers: Object.values(this.gradesCollected).reduce((a, b) => a + b, 0),
            best: { ...this.best },
        };
    }
}

export { STATE };
