/**
 * InputHandler — keyboard + touch swipe controls, no on-screen buttons
 * (spec §6 + swipe pattern from research report §4.1).
 *
 *  - Desktop: ← → / A D switch lanes; ↑ / W / Space jump; ↓ / S slide;
 *    P / Esc pause; M mute.
 *  - Mobile: swipes (24 px threshold, 120 ms cooldown, axis decided by the
 *    larger delta), preventDefault on touchmove to kill page scroll, and a
 *    16 px dead zone at the screen edges (Android back-gesture safety,
 *    report §9).
 */
import { CONFIG } from '../config.js';

export class InputHandler {
    /**
     * @param {object} handlers {onLeft, onRight, onJump, onSlide, onTogglePause, onToggleMute}
     */
    constructor(handlers) {
        this.handlers = handlers;
        this._swipeStartX = 0;
        this._swipeStartY = 0;
        this._swipeStartTime = 0;
        this._lastSwipe = 0;
        this._edgeDeadZone = CONFIG.INPUT.EDGE_DEAD_ZONE;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);
        this._onContextMenu = (e) => e.preventDefault();

        window.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('touchstart', this._onTouchStart, { passive: true });
        document.addEventListener('touchmove', this._onTouchMove, { passive: false });
        document.addEventListener('touchend', this._onTouchEnd, { passive: true });
        document.addEventListener('contextmenu', this._onContextMenu);
    }

    _onKeyDown(e) {
        const h = this.handlers;
        switch (e.code) {
            case 'ArrowLeft': case 'KeyA':
                e.preventDefault(); if (!e.repeat) h.onLeft?.(); break;
            case 'ArrowRight': case 'KeyD':
                e.preventDefault(); if (!e.repeat) h.onRight?.(); break;
            case 'ArrowUp': case 'KeyW': case 'Space':
                e.preventDefault(); if (!e.repeat) h.onJump?.(); break;
            case 'ArrowDown': case 'KeyS':
                e.preventDefault(); if (!e.repeat) h.onSlide?.(); break;
            case 'KeyP': case 'Escape':
                if (!e.repeat) h.onTogglePause?.(); break;
            case 'KeyM':
                if (!e.repeat) h.onToggleMute?.(); break;
        }
    }

    _onTouchStart(e) {
        const t = e.changedTouches[0];
        // ignore touches that begin in the edge dead zone (system gestures)
        if (t.clientX < this._edgeDeadZone
            || t.clientX > window.innerWidth - this._edgeDeadZone) return;
        this._swipeStartX = t.clientX;
        this._swipeStartY = t.clientY;
        this._swipeStartTime = performance.now();
    }

    _onTouchMove(e) {
        e.preventDefault();   // no page scroll / pull-to-refresh / zoom
    }

    _onTouchEnd(e) {
        const t = e.changedTouches[0];
        const dx = t.clientX - this._swipeStartX;
        const dy = t.clientY - this._swipeStartY;
        const now = performance.now();

        if (now - this._lastSwipe < CONFIG.INPUT.SWIPE_COOLDOWN_MS) return;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < CONFIG.INPUT.SWIPE_THRESHOLD) return; // tap
        this._lastSwipe = now;

        const h = this.handlers;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) h.onRight?.(); else h.onLeft?.();
        } else {
            if (dy < 0) h.onJump?.(); else h.onSlide?.();
        }
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('touchstart', this._onTouchStart);
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchend', this._onTouchEnd);
        document.removeEventListener('contextmenu', this._onContextMenu);
    }
}
