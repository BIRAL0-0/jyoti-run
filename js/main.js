/**
 * School Runner: Teacher Chase — main entry
 * (spec §10: init, asset loading, game loop, collisions, camera, state flow).
 *
 * Boot order:
 *   1. support check (WebGL)
 *   2. platform tuning (mobile/low-end overrides, research report §7)
 *   3. Three.js setup (scene/camera/renderer/lights/fog)
 *   4. async asset load (user PNG overrides -> procedural placeholders)
 *   5. input + UI wiring
 *   6. requestAnimationFrame loop
 *
 * World model: the player stays at z = 0 and the world scrolls toward the
 * camera (+z). "Behind the player" = positive z.
 */
import * as THREE from 'three';
import {
    CONFIG, GROUND, LANES, PLAYER, TEACHER, OBSTACLES, GRADES,
    SKY, CAMERA, LIGHTING, PERFORMANCE,
} from './config.js';
import { GroundManager } from './managers/GroundManager.js';
import { ObstacleManager } from './managers/ObstacleManager.js';
import { CollectibleManager } from './managers/CollectibleManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { UIManager } from './managers/UIManager.js';
import { Player } from './entities/Player.js';
import { Teacher } from './entities/Teacher.js';
import { InputHandler } from './utils/InputHandler.js';
import { GameState, STATE } from './utils/GameState.js';
import { calculateDifficulty } from './utils/Difficulty.js';
import { probeExisting, loadImageTexture } from './utils/AssetLoader.js';

const TEXTURE_URLS = {
    ground: 'assets/textures/ground-gravel.png',
    student: 'assets/textures/student-character.png',
    teacher: 'assets/textures/teacher-character.png',
};

class SchoolRunnerGame {
    constructor() {
        window.__gameBooted = true;
        /** live config reference (console tuning / tests) */
        this.config = CONFIG;

        if (!SchoolRunnerGame.checkWebGLSupport()) {
            this.ui = new UIManager({});
            this.ui.showUnsupported(['WebGL is not available in this browser.',
                'Try Chrome 120+, Edge 120+, Firefox 120+ or Safari 17+.']);
            return;
        }

        this.isMobile = SchoolRunnerGame.detectMobile();
        this.applyPlatformTuning();

        this.setupThreeJS();
        this.setupManagers();

        this.gameState = new GameState();
        this.clock = new THREE.Clock();

        // camera shake state
        this._shakeTime = 0;
        this._shakeIntensity = 0;

        this.setupUI();
        this.setupInput();
        this.setupEvents();

        // async boot
        this.ready = false;
        this.ui.showLoading(true);
        this.loadAssets()
            .then(() => {
                this.ready = true;
                this.ui.showLoading(false);
                this.ui.setBestLine(this.gameState.best);
                this.ui.setMuteIcon(this.audio.isMuted);
                this.ui.setShowFps(CONFIG.DEBUG.SHOW_FPS);
                this.ui.showScreen('start');
                if (CONFIG.DEBUG.SKIP_START_SCREEN) this.startGame();
            })
            .catch((err) => {
                console.error('Failed to load game assets:', err?.stack || err);
                this.ui.showLoading(false);
                this.ui.showUnsupported(['An error occurred while loading the game.',
                    String(err?.message || err)]);
            });

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        if (CONFIG.DEBUG.EXPOSE_TO_WINDOW) window.__game = this;
    }

    // ------------------------------------------------------------------
    // Platform detection & tuning (research report §7 mobile table)
    // ------------------------------------------------------------------

    static detectMobile() {
        const params = new URLSearchParams(location.search);
        if (params.get('desktop') === '1') return false;
        if (params.get('mobile') === '1') return true;
        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches
            || 'ontouchstart' in window;
        const lowEnd = (navigator.deviceMemory || 8) <= 4
            || (navigator.hardwareConcurrency || 8) <= 4;
        return coarsePointer || lowEnd;
    }

    static checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
        } catch (e) {
            return false;
        }
    }

    applyPlatformTuning() {
        if (!this.isMobile) return;
        const M = PERFORMANCE.MOBILE_OVERRIDES;
        GROUND.VISIBLE_TILES = Math.min(GROUND.VISIBLE_TILES, M.visibleTiles);
        LIGHTING.SHADOWS.enabled = PERFORMANCE.ENABLE_SHADOWS_MOBILE && LIGHTING.SHADOWS.enabled;
        LIGHTING.SHADOWS.mapSize = Math.min(LIGHTING.SHADOWS.mapSize, 1024);
        this.obstaclePoolPerVariant = M.obstaclePoolPerVariant;
        this.paperPool = M.paperPool;
        this.decorDensity = M.decorDensity;
        this.anisotropy = M.anisotropy;
        this.pixelRatioCap = PERFORMANCE.MOBILE_PIXEL_RATIO;
        this.antialias = false;
    }

    // ------------------------------------------------------------------
    // Three.js setup
    // ------------------------------------------------------------------

    setupThreeJS() {
        // platform defaults (desktop) if not set by tuning
        this.obstaclePoolPerVariant ??= 4;
        this.paperPool ??= GRADES.POOL_SIZE;
        this.decorDensity ??= 1;
        this.anisotropy ??= PERFORMANCE.DESKTOP_ANISOTROPY;
        this.pixelRatioCap ??= PERFORMANCE.DESKTOP_PIXEL_RATIO;
        this.antialias ??= window.devicePixelRatio < 2;

        const canvas = document.getElementById('game-canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: this.antialias,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = LIGHTING.SHADOWS.enabled;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(SKY.COLOR);

        if (LIGHTING.FOG.enabled) {
            // fog matches the sky for a seamless horizon
            this.scene.fog = new THREE.Fog(SKY.COLOR, LIGHTING.FOG.near, LIGHTING.FOG.far);
        }

        this.camera = new THREE.PerspectiveCamera(
            CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            CAMERA.NEAR,
            CAMERA.FAR
        );
        this.camera.position.set(
            CAMERA.POSITION_OFFSET.x,
            CAMERA.POSITION_OFFSET.y,
            CAMERA.POSITION_OFFSET.z
        );

        // lighting rig (config-driven)
        const { AMBIENT, DIRECTIONAL, HEMISPHERE, SHADOWS } = LIGHTING;
        this.scene.add(new THREE.AmbientLight(AMBIENT.color, AMBIENT.intensity));
        this.scene.add(new THREE.HemisphereLight(
            HEMISPHERE.skyColor, HEMISPHERE.groundColor, HEMISPHERE.intensity));

        const sun = new THREE.DirectionalLight(DIRECTIONAL.color, DIRECTIONAL.intensity);
        sun.position.set(DIRECTIONAL.position.x, DIRECTIONAL.position.y, DIRECTIONAL.position.z);
        if (SHADOWS.enabled && DIRECTIONAL.castShadow) {
            sun.castShadow = true;
            sun.shadow.mapSize.set(SHADOWS.mapSize, SHADOWS.mapSize);
            const s = SHADOWS.cameraSize * 1.8;
            sun.shadow.camera.left = -s;
            sun.shadow.camera.right = s;
            sun.shadow.camera.top = s;
            sun.shadow.camera.bottom = -s;
            sun.shadow.camera.near = 1;
            sun.shadow.camera.far = 90;
            sun.shadow.bias = -0.0004;
        }
        // aim the shadow frustum down the track (player is at z=0, world runs -z)
        this.sunTarget = new THREE.Object3D();
        this.sunTarget.position.set(0, 0, -20);
        this.scene.add(this.sunTarget);
        sun.target = this.sunTarget;
        this.scene.add(sun);
    }

    setupManagers() {
        this.audio = new AudioManager();
        this.ground = new GroundManager(this.scene, { anisotropy: this.anisotropy });
        this.obstacles = new ObstacleManager(this.scene, {
            poolPerVariant: this.obstaclePoolPerVariant,
            shadows: LIGHTING.SHADOWS.enabled,
        });
        this.collectibles = new CollectibleManager(this.scene, this.obstacles, {
            poolSize: this.paperPool,
        });
        this.player = new Player(this.scene);
        this.teacher = new Teacher(this.scene);

        // freshly spawned obstacles push overlapping papers out of the way
        this.obstacles.onSpawned = (lane, z) => this.collectibles.evict(lane, z);
    }

    // ------------------------------------------------------------------
    // Assets
    // ------------------------------------------------------------------

    async loadAssets() {
        // paper cards use Orbitron — give webfonts a brief chance to load
        try {
            await Promise.race([
                document.fonts?.ready ?? Promise.resolve(),
                new Promise((r) => setTimeout(r, 1200)),
            ]);
        } catch (e) { /* fonts are optional */ }

        const existing = await probeExisting(Object.values(TEXTURE_URLS));

        const groundTex = existing.has(TEXTURE_URLS.ground)
            ? await loadImageTexture(TEXTURE_URLS.ground, {
                repeat: [1, GROUND.TEXTURE_REPEAT_Y],
                anisotropy: this.anisotropy,
            })
            : null;
        const studentTex = existing.has(TEXTURE_URLS.student)
            ? await loadImageTexture(TEXTURE_URLS.student, { mipmaps: false })
            : null;
        const teacherTex = existing.has(TEXTURE_URLS.teacher)
            ? await loadImageTexture(TEXTURE_URLS.teacher, { mipmaps: false })
            : null;

        this.ground.load(groundTex, this.decorDensity);
        this.player.load(studentTex);
        this.teacher.load(teacherTex);
        this.obstacles.init();
        this.collectibles.init();
        await this.audio.load();

        // player feedback wiring
        this.player.onEvent = (type) => {
            if (type === 'jump') this.audio.play('jump');
        };
        this.teacher.onEvent = (type) => {
            if (type === 'appear' || type === 'surge') this.audio.play('teacherAlert');
            if (type === 'caught') {
                this.audio.play('caught');
                this.shake(0.55);
            }
        };

        // gentle notice when running on generated art
        const placeholders = [
            !groundTex && 'ground', !studentTex && 'student', !teacherTex && 'teacher',
        ].filter(Boolean);
        if (placeholders.length) {
            this.ui.toast('🎨 Built-in placeholder art in use — drop your PNGs into ' +
                'assets/textures/ to customize (see README)', 4500);
        }
    }

    // ------------------------------------------------------------------
    // UI + input wiring
    // ------------------------------------------------------------------

    setupUI() {
        this.ui = new UIManager({
            onStart: () => this.startGame(),
            onRestart: () => this.startGame(),
            onResume: () => this.resumeGame(),
            onToggleMute: () => {
                const muted = this.audio.toggleMute();
                this.ui.setMuteIcon(muted);
            },
            onPause: () => this.togglePause(),
        });
        this.ui.attachCamera(this.camera);
    }

    setupInput() {
        this.input = new InputHandler({
            onLeft: () => this.ifPlaying(() => this.player.switchLane(-1)),
            onRight: () => this.ifPlaying(() => this.player.switchLane(1)),
            onJump: () => this.ifPlaying(() => this.player.jump()),
            onSlide: () => this.ifPlaying(() => this.player.slide()),
            onTogglePause: () => this.togglePause(),
            onToggleMute: () => {
                const muted = this.audio.toggleMute();
                this.ui.setMuteIcon(muted);
            },
        });
    }

    ifPlaying(fn) {
        if (this.gameState.state === STATE.PLAYING) fn();
    }

    setupEvents() {
        // auto-pause when the tab is hidden (report §7 #14)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.pauseGame(true);
        });

        // debounced resize
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.onResize(), 120);
        });

        // WebGL context loss -> pause (report §10)
        const canvas = this.renderer.domElement;
        canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            this.pauseGame(true);
        });
    }

    onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    // ------------------------------------------------------------------
    // Game flow
    // ------------------------------------------------------------------

    startGame() {
        this.audio.unlock();
        this.audio.play('ui');

        this.gameState.start();
        this.player.reset();
        this.teacher.reset();
        this.ground.reset();
        this.obstacles.reset();
        this.collectibles.reset();

        this.ui.showScreen(null);
        this.ui.updateHUD({
            score: 0, distance: 0,
            tier: calculateDifficulty(0, 0).tier,
            mistakes: 0, mistakeMax: 0,
        });
        this.ui.showWarning(0);
        this.audio.startMusic();
        this.clock.getDelta();   // discard pause-time delta
    }

    pauseGame(auto = false) {
        if (this.gameState.state !== STATE.PLAYING) return;
        this.gameState.pause();
        this.audio.stopMusic();
        this.ui.showScreen('pause');
    }

    resumeGame() {
        if (this.gameState.state !== STATE.PAUSED) return;
        this.gameState.resume();
        this.ui.showScreen(null);
        this.audio.startMusic();
        this.clock.getDelta();   // discard paused delta
    }

    togglePause() {
        if (this.gameState.state === STATE.PLAYING) this.pauseGame();
        else if (this.gameState.state === STATE.PAUSED) this.resumeGame();
    }

    endGame() {
        if (this.gameState.state !== STATE.PLAYING) return;
        this.gameState.gameOver();
        this.audio.stopMusic();
        this.audio.play('gameOver');
        this.shake(0.5);

        const stats = this.gameState.getStats();
        const bestInfo = this.gameState.commitBest();
        this.ui.setBestLine(this.gameState.best);

        // short beat so the grab pose registers before the panel slides in
        setTimeout(() => {
            this.ui.showGameOver(stats, bestInfo);
        }, 650);
    }

    // ------------------------------------------------------------------
    // Effects
    // ------------------------------------------------------------------

    shake(intensity) {
        this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
        this._shakeTime = CAMERA.SHAKE_DURATION;
    }

    // ------------------------------------------------------------------
    // Per-frame updates
    // ------------------------------------------------------------------

    updatePlay(deltaTime) {
        const gs = this.gameState;
        gs.updateSpeed(deltaTime);
        gs.elapsed += deltaTime;

        const effectiveSpeed = gs.currentSpeed * this.player.getSpeedMultiplier();
        const distance = effectiveSpeed * deltaTime;

        gs.updateDistance(distance);

        const diff = calculateDifficulty(gs.distance, gs.elapsed);

        this.ground.update(distance, deltaTime);
        this.player.update(deltaTime, gs.currentSpeed);
        this.obstacles.update(distance, diff, true);
        this.collectibles.update(deltaTime, distance, gs.distance, diff, true);

        // ---- obstacle collisions ----
        if (!this.player.isStumbling && !CONFIG.DEBUG.GOD_MODE) {
            const hit = this.obstacles.checkCollision(this.player.getBounds());
            if (hit) this.onPlayerHit();
        }

        // ---- collectibles ----
        const collected = this.collectibles.checkCollection(this.player.getBounds());
        for (let i = 0; i < collected.length; i++) {
            const paper = collected[i];
            gs.collectGrade(paper.tier);
            this.audio.setComboPitch(1 + Math.min(gs.combo, 8) * 0.055);
            this.audio.play('collect');
            this.ui.popup(`+${paper.tier.points}`, paper.group.position, paper.tier.cssColor);
            if (paper.tier.grade === 'A+') {
                this.collectibles.burstAt(
                    paper.group.position.x, paper.group.position.y, paper.group.position.z);
                this.shake(0.14);
            }
        }

        // ---- teacher chase ----
        this.teacher.updateRecovery(distance, !this.player.isStumbling);
        const teacherStatus = this.teacher.update(
            deltaTime, effectiveSpeed, this.player.laneX,
            this.player.isJumping || this.player.isSliding);
        if (teacherStatus === 'CAUGHT') {
            this.endGame();
            return;
        }

        // ---- HUD ----
        this.ui.updateHUD({
            score: gs.score,
            distance: gs.distance,
            tier: diff.tier,
            mistakes: this.teacher.isChasing ? this.teacher.mistakes : 0,
            mistakeMax: TEACHER.MAJOR_BLUNDER_THRESHOLD,
        });
        this.ui.showWarning(this.teacher.getWarningIntensity());
    }

    onPlayerHit() {
        this.player.stumble();
        this.audio.play('hit');
        this.shake(0.4);
        this.ui.flashDamage();
        this.teacher.onPlayerMistake();  // may trigger the chase / catch
    }

    /** Ambient scroll behind the start screen. */
    updateMenu(deltaTime) {
        const distance = CONFIG.UI.START_SCREEN_SCROLL_SPEED * deltaTime;
        this.ground.update(distance, deltaTime);
        this.player.update(deltaTime, CONFIG.UI.START_SCREEN_SCROLL_SPEED);
        this.obstacles.update(distance, { spawnChance: 0, t: 0 }, false);
        this.collectibles.update(deltaTime, distance, 0, {}, false);
    }

    updateCamera(deltaTime) {
        const px = this.player?.laneX ?? 0;
        const speed = this.gameState?.currentSpeed ?? GROUND.INITIAL_SPEED;

        // lateral follow (lerp)
        const targetX = px * CAMERA.LATERAL_FOLLOW;
        this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, 8 * deltaTime);

        // shake decay
        let sx = 0, sy = 0;
        if (this._shakeTime > 0) {
            this._shakeTime -= deltaTime;
            const amp = this._shakeIntensity
                * Math.max(0, this._shakeTime / CAMERA.SHAKE_DURATION);
            sx = (Math.random() - 0.5) * 2 * amp;
            sy = (Math.random() - 0.5) * 2 * amp;
            if (this._shakeTime <= 0) this._shakeIntensity = 0;
        }

        this.camera.position.y = CAMERA.POSITION_OFFSET.y + sy;
        this.camera.position.z = CAMERA.POSITION_OFFSET.z;
        this.camera.lookAt(px * 0.3, 1.6, -CAMERA.LOOK_AHEAD_DISTANCE);

        // subtle speed FOV kick
        const t = THREE.MathUtils.clamp(
            (speed - GROUND.INITIAL_SPEED) / (GROUND.MAX_SPEED - GROUND.INITIAL_SPEED), 0, 1);
        const fov = CAMERA.FOV + t * CAMERA.FOV_SPEED_KICK;
        if (Math.abs(fov - this.camera.fov) > 0.05) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }

    // ------------------------------------------------------------------
    // Main loop
    // ------------------------------------------------------------------

    animate() {
        requestAnimationFrame(this.animate);
        if (!this.renderer || !this.ready) return;

        const rawDelta = this.clock.getDelta();
        const deltaTime = Math.min(rawDelta, PERFORMANCE.MAX_DELTA);

        switch (this.gameState?.state) {
            case STATE.PLAYING:
                this.updatePlay(deltaTime);
                break;
            case STATE.START:
                this.updateMenu(deltaTime);
                break;
            // PAUSED / GAME_OVER: world frozen, still rendered behind overlays
        }

        this.updateCamera(deltaTime);
        this.ui?.tickFps(this.renderer);
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SchoolRunnerGame());
} else {
    new SchoolRunnerGame();
}
