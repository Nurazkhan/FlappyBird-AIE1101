/**
 * Flappy Pixel — Milestone 1 (game.js)
 * 100% Identical to the Live Preview Engine:
 * - Locked 960x540 Canvas Coordinate Space
 * - Fetches ./assets.svg and wraps each <symbol viewBox="0 0 W H"> into an explicit WxH <svg>
 *   so there is zero 300x150 browser viewport offset.
 */

/***********************************************************************
         * 1. RETRO PIXEL SOUND SYNTHESIZER (Web Audio API - No External Files)
         ***********************************************************************/
        let audioCtx = null;
        let soundEnabled = true;
        let audioResumePromise = null;

        function ensureAudioContext() {
            if (!audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    audioCtx = new AudioContextClass();
                }
            }
            return audioCtx;
        }

        function unlockAudio() {
            let context = null;
            try {
                context = ensureAudioContext();
            } catch (e) {
                return Promise.resolve(null);
            }
            if (!context || context.state === 'running') {
                return Promise.resolve(context);
            }

            // resume() must be requested from a click/key gesture. Keep one pending
            // request so repeated flaps do not create a rejected-promise cascade.
            if (!audioResumePromise) {
                audioResumePromise = Promise.resolve(context.resume())
                    .catch(() => null)
                    .finally(() => {
                        audioResumePromise = null;
                    });
            }

            return audioResumePromise.then(() => context.state === 'running' ? context : null);
        }

        function renderPixelSound(context, type) {
            const now = context.currentTime;

            if (type === 'flap') {
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(190, now);
                osc.frequency.exponentialRampToValueAtTime(520, now + 0.085);

                gain.gain.setValueAtTime(0.11, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

                osc.connect(gain);
                gain.connect(context.destination);
                osc.start(now);
                osc.stop(now + 0.09);
            } else if (type === 'score') {
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.06); // A5

                gain.gain.setValueAtTime(0.14, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

                osc.connect(gain);
                gain.connect(context.destination);
                osc.start(now);
                osc.stop(now + 0.22);
            } else if (type === 'collision') {
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(32, now + 0.32);

                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

                osc.connect(gain);
                gain.connect(context.destination);
                osc.start(now);
                osc.stop(now + 0.34);
            }
        }

        function playPixelSound(type) {
            if (!soundEnabled) return;
            try {
                const context = ensureAudioContext();
                if (!context) return;

                if (context.state === 'running') {
                    renderPixelSound(context, type);
                } else {
                    // The first sound is created only after the browser has accepted
                    // the user-gesture resume request.
                    unlockAudio().then((runningContext) => {
                        if (runningContext && soundEnabled) {
                            renderPixelSound(runningContext, type);
                        }
                    }).catch(() => {});
                }
            } catch (e) {
                // Audio should never be able to interrupt the game loop.
            }
        }

        function toggleSound() {
            soundEnabled = !soundEnabled;
            if (soundEnabled) unlockAudio();
            const icon = document.getElementById('soundIcon');
            if (icon) {
                icon.textContent = soundEnabled ? 'SFX: ON' : 'SFX: MUTED';
            }
        }

        /***********************************************************************
         * 2. PIXEL-LOCKED SVG <symbol> RASTERIZER (Fixes 300x150 Viewport Offset)
         ***********************************************************************/
        const SPRITE_CACHE = {};

        /**
         * Extracts a <symbol id="..." viewBox="0 0 W H"> from an SVG document
         * and wraps it into a standalone <svg width="W" height="H" viewBox="0 0 W H" preserveAspectRatio="none">
         * so browsers rasterize it at exact 1:1 pixel dimensions with zero viewport offset.
         */
        function rasterizeSymbolNode(symbolNode) {
            return new Promise((resolve) => {
                if (!symbolNode) {
                    resolve(null);
                    return;
                }
                const viewBox = symbolNode.getAttribute('viewBox') || '0 0 64 64';
                const parts = viewBox.trim().split(/[\s,]+/).map(Number);
                const w = parts[2] || 64;
                const h = parts[3] || 64;

                const standaloneSvg =
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}" preserveAspectRatio="none" shape-rendering="crispEdges">` +
                    symbolNode.innerHTML +
                    `</svg>`;

                const blob = new Blob([standaloneSvg], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.width = w;
                img.height = h;
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve(img);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve(null);
                };
                img.src = url;
            });
        }

        async function preloadAllSvgSprites() {
            const spriteMap = {
                heroIdle: 'sprite-hero-idle',
                heroFlap: 'sprite-hero-flap',
                junkBottom: 'sprite-obstacle-junk-bottom',
                junkTop: 'sprite-obstacle-junk-top',
                caveTop: 'sprite-cave-top',
                caveBottom: 'sprite-cave-bottom',
                hybridBottom: 'sprite-obstacle-hybrid',
                bgTowers: 'sprite-bg-towers'
            };

            let svgDoc = document;

            // When running from /Milestone1 via Python HTTP server, fetch ./assets.svg if not embedded
            if (!document.getElementById('milestone-assets-svg')) {
                try {
                    const response = await fetch('./assets.svg');
                    if (response.ok) {
                        const svgText = await response.text();
                        svgDoc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
                    }
                } catch (err) {
                    console.warn('Fallback to embedded DOM symbols:', err);
                }
            }

            const promises = Object.entries(spriteMap).map(async ([key, symbolId]) => {
                const symbolNode = svgDoc.getElementById(symbolId) || document.getElementById(symbolId);
                SPRITE_CACHE[key] = await rasterizeSymbolNode(symbolNode);
            });

            await Promise.all(promises);
        }

        /***********************************************************************
         * 3. FLAPPY PIXEL 60FPS GAME ENGINE (Locked 960x540 Coordinate Space)
         ***********************************************************************/
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        const GAME_WIDTH = 960;
        const GAME_HEIGHT = 540;
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;

        const DIFFICULTY_PRESETS = {
            chill: { speed: 245, gravity: 1180, jumpImpulse: -395, gapSize: 176, spawnInterval: 1.85 },
            normal: { speed: 300, gravity: 1380, jumpImpulse: -435, gapSize: 154, spawnInterval: 1.52 },
            intense: { speed: 375, gravity: 1580, jumpImpulse: -470, gapSize: 138, spawnInterval: 1.22 }
        };

        let currentDifficulty = 'normal';
        let obstacleThemeMode = 'mixed'; // 'mixed' | 'junk' | 'shards'

        let gameState = 'START'; // 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
        let score = 0;
        let bestScore = 0;
        let lastFrameTime = performance.now();
        let fpsSmooth = 60;
        let gameOverOverlayTimer = null;

        // Screen Shake & Flash State
        let screenShakeTime = 0;
        let screenShakeIntensity = 0;
        let impactFlashAlpha = 0;
        let crashCoordinates = { x: 0, y: 0 };

        // Hero Cubic Pixel State
        const hero = {
            x: 220,
            y: GAME_HEIGHT / 2 - 20,
            width: 44,
            height: 44,
            vy: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            flapAnimTimer: 0,
            trailTimer: 0,
            alive: true
        };

        // Dynamic Arrays for Obstacles, Parallax, Smoke & Particles
        let obstacles = [];
        let obstacleSpawnTimer = 0;
        let particles = [];
        let shockwaves = [];
        let shatteredFragments = [];
        let smokePuffs = [];
        let skyAshMotes = [];
        let bgParallaxLayers = [];

        function initEnvironment() {
            // 1. Lighter Sky Drifting Ash Motes
            skyAshMotes = [];
            for (let i = 0; i < 42; i++) {
                skyAshMotes.push({
                    x: Math.random() * GAME_WIDTH,
                    y: Math.random() * (GAME_HEIGHT - 80),
                    size: Math.random() < 0.7 ? 2 : 4,
                    speedX: 18 + Math.random() * 35,
                    speedY: -6 + Math.random() * 12,
                    alpha: 0.25 + Math.random() * 0.55,
                    color: Math.random() > 0.5 ? '#e4e4ec' : '#9898a4'
                });
            }

            // 2. Parallax Background Gray Junk Towers (Far & Mid Layers)
            bgParallaxLayers = [
                { scrollX: 0, speedFactor: 0.18, yOffset: 155, scale: 1.55, alpha: 0.55 },
                { scrollX: 180, speedFactor: 0.36, yOffset: 195, scale: 1.32, alpha: 0.85 }
            ];

            // 3. Heavy Volumetric Pixel Smoke Puffs along the Floor & Chimney Vents
            smokePuffs = [];
            for (let i = 0; i < 55; i++) {
                smokePuffs.push(createSmokePuff(Math.random() * GAME_WIDTH, false));
            }
        }

        function createSmokePuff(xPos, fromBottom = true) {
            const layerRoll = Math.random();
            let color = '#52525c';
            let yBase = GAME_HEIGHT - 36 - Math.random() * 48;

            if (layerRoll < 0.28) {
                color = '#8e8e9a'; // Light silver-mist back smoke
                yBase = GAME_HEIGHT - 58 - Math.random() * 64;
            } else if (layerRoll < 0.52) {
                color = '#dcdce6'; // Crisp white/silver smoke billow highlight
                yBase = GAME_HEIGHT - 44 - Math.random() * 54;
            } else if (layerRoll > 0.8) {
                color = '#24242b'; // Deep charcoal foreground smoke trench
                yBase = GAME_HEIGHT - 22 - Math.random() * 24;
            }

            return {
                x: xPos,
                y: fromBottom ? GAME_HEIGHT + 10 : yBase,
                targetY: yBase,
                w: 24 + Math.floor(Math.random() * 8) * 6,
                h: 12 + Math.floor(Math.random() * 5) * 4,
                vx: -(35 + Math.random() * 75),
                vy: -(12 + Math.random() * 28),
                color: color,
                alpha: 0.55 + Math.random() * 0.4,
                life: 1.0,
                decay: 0.12 + Math.random() * 0.18
            };
        }

        /***********************************************************************
         * 4. PIXEL PARTICLE EFFECTS SYSTEM (Flap Thrust, Trail, Shatter)
         ***********************************************************************/
        function spawnHeroTrailParticle() {
            const isHollow = Math.random() < 0.48;
            const size = isHollow ? (8 + Math.floor(Math.random() * 3) * 2) : (4 + Math.floor(Math.random() * 2) * 2);
            particles.push({
                x: hero.x - 6 + (Math.random() * 6 - 3),
                y: hero.y + hero.height * 0.5 + (Math.random() * 26 - 13),
                vx: -(120 + Math.random() * 90),
                vy: (Math.random() - 0.5) * 45,
                size: size,
                hollow: isHollow,
                color: Math.random() > 0.3 ? '#ffffff' : '#b8b8c4',
                innerColor: '#09090b',
                life: 1.0,
                decay: 1.5 + Math.random() * 0.9,
                gravity: 0
            });
        }

        function spawnFlapBurstParticles() {
            shockwaves.push({
                x: hero.x + hero.width / 2,
                y: hero.y + hero.height + 2,
                w: 36,
                h: 6,
                maxW: 92,
                life: 1.0,
                type: 'flap'
            });

            for (let i = 0; i < 18; i++) {
                const isHollow = i < 7;
                const size = isHollow ? (8 + (i % 2) * 4) : (4 + (i % 2) * 2);
                const spreadAngle = (Math.PI * 0.5) + (Math.random() - 0.5) * 1.15;
                const speed = 130 + Math.random() * 210;

                particles.push({
                    x: hero.x + hero.width * 0.5 + (Math.random() * 24 - 12),
                    y: hero.y + hero.height - 2,
                    vx: Math.cos(spreadAngle) * speed - 90,
                    vy: Math.sin(spreadAngle) * speed * 0.85,
                    size: size,
                    hollow: isHollow,
                    color: i % 3 === 0 ? '#d4d4de' : '#ffffff',
                    innerColor: '#08080a',
                    life: 1.0,
                    decay: 1.6 + Math.random() * 1.1,
                    gravity: 340
                });
            }
        }

        function spawnCollisionShatter(cx, cy) {
            crashCoordinates = { x: cx, y: cy };
            impactFlashAlpha = 1.0;
            screenShakeTime = 0.42;
            screenShakeIntensity = 14;

            shockwaves.push({
                x: cx,
                y: cy,
                w: 24,
                h: 24,
                maxW: 190,
                life: 1.0,
                type: 'explosion'
            });

            const quadrants = [
                { dx: -1, dy: -1, label: 'bevel' },
                { dx: 1, dy: -1, label: 'visor' },
                { dx: -1, dy: 1, label: 'vent' },
                { dx: 1, dy: 1, label: 'core' }
            ];

            shatteredFragments = quadrants.map((q) => ({
                x: cx + q.dx * 10,
                y: cy + q.dy * 10,
                vx: q.dx * (140 + Math.random() * 140),
                vy: q.dy * (140 + Math.random() * 120) - 120,
                rot: 0,
                vRot: (Math.random() - 0.5) * 12,
                type: q.label,
                size: 20
            }));

            for (let i = 0; i < 48; i++) {
                const angle = (Math.PI * 2 * i) / 48 + (Math.random() - 0.5) * 0.25;
                const speed = 90 + Math.random() * 380;
                const isHollow = i % 3 === 0;
                particles.push({
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 60,
                    size: isHollow ? 10 : (4 + (i % 3) * 2),
                    hollow: isHollow,
                    color: i % 4 === 0 ? '#a8a8b4' : '#ffffff',
                    innerColor: '#08080a',
                    life: 1.0,
                    decay: 0.75 + Math.random() * 0.75,
                    gravity: 680
                });
            }
        }

        /***********************************************************************
         * 5. OBSTACLE GENERATOR (Junk Shadow Towers & Mountain Cave Shards)
         ***********************************************************************/
        function spawnObstaclePair() {
            const preset = DIFFICULTY_PRESETS[currentDifficulty];
            const gap = preset.gapSize;
            const minTop = 74;
            const maxTop = GAME_HEIGHT - gap - 104;
            const gapTop = minTop + Math.random() * (maxTop - minTop);
            const gapBottom = gapTop + gap;

            let style = 'junk';
            if (obstacleThemeMode === 'junk') {
                style = Math.random() < 0.75 ? 'junk' : 'hybrid';
            } else if (obstacleThemeMode === 'shards') {
                style = 'shards';
            } else {
                const roll = Math.random();
                if (roll < 0.45) style = 'junk';
                else if (roll < 0.80) style = 'shards';
                else style = 'hybrid';
            }

            obstacles.push({
                x: GAME_WIDTH + 40,
                width: 96,
                gapTop: gapTop,
                gapBottom: gapBottom,
                style: style,
                passed: false,
                splinterOffset: Math.random() * Math.PI * 2
            });
        }

        /***********************************************************************
         * 6. PLAYER INPUT & GAME STATE MANAGEMENT
         ***********************************************************************/
        function resetGameEntities() {
            const preset = DIFFICULTY_PRESETS[currentDifficulty];
            if (gameOverOverlayTimer) {
                clearTimeout(gameOverOverlayTimer);
                gameOverOverlayTimer = null;
            }
            hero.x = 220;
            hero.y = GAME_HEIGHT * 0.44;
            hero.vy = 0;
            hero.rotation = 0;
            hero.scaleX = 1;
            hero.scaleY = 1;
            hero.flapAnimTimer = 0;
            hero.alive = true;

            obstacles = [];
            obstacleSpawnTimer = preset.spawnInterval * 0.65;
            particles = [];
            shockwaves = [];
            shatteredFragments = [];
            score = 0;
            updateScoreUI();
        }

        function triggerFlapAction(e) {
            if (e && e.type === 'touchstart') {
                e.preventDefault();
            }

            // Request the audio unlock inside the actual input event. Browsers will
            // otherwise keep Web Audio suspended even though the game is running.
            if (soundEnabled) unlockAudio();

            const flapBtn = document.getElementById('flapControlBtn');
            if (flapBtn) {
                flapBtn.classList.add('active-press');
                setTimeout(() => flapBtn.classList.remove('active-press'), 90);
            }

            if (gameState === 'START') {
                startGame();
                applyHeroFlapImpulse();
            } else if (gameState === 'PLAYING') {
                applyHeroFlapImpulse();
            } else if (gameState === 'GAMEOVER') {
                restartGame();
            }
        }

        function applyHeroFlapImpulse() {
            const preset = DIFFICULTY_PRESETS[currentDifficulty];
            hero.vy = preset.jumpImpulse;
            hero.scaleX = 1.18;
            hero.scaleY = 0.82;
            hero.flapAnimTimer = 0.16;

            spawnFlapBurstParticles();
            playPixelSound('flap');
        }

        function startGame() {
            resetGameEntities();
            gameState = 'PLAYING';
            const startEl = document.getElementById('startOverlay');
            const overEl = document.getElementById('gameOverOverlay');
            if (startEl) startEl.classList.add('hidden');
            if (overEl) overEl.classList.add('hidden');
        }

        function restartGame() {
            resetGameEntities();
            gameState = 'PLAYING';
            const startEl = document.getElementById('startOverlay');
            const overEl = document.getElementById('gameOverOverlay');
            if (startEl) startEl.classList.add('hidden');
            if (overEl) overEl.classList.add('hidden');
            applyHeroFlapImpulse();
        }

        function returnToMainMenu() {
            resetGameEntities();
            gameState = 'START';
            lastFrameTime = performance.now();

            const startEl = document.getElementById('startOverlay');
            const overEl = document.getElementById('gameOverOverlay');
            const pauseBtn = document.getElementById('pauseBtn');
            if (startEl) startEl.classList.remove('hidden');
            if (overEl) overEl.classList.add('hidden');
            if (pauseBtn) pauseBtn.textContent = '⏸ PAUSE [P]';
        }

        function togglePause() {
            const pauseBtn = document.getElementById('pauseBtn');
            if (gameState === 'PLAYING') {
                gameState = 'PAUSED';
                if (pauseBtn) pauseBtn.textContent = '▶ RESUME [P]';
            } else if (gameState === 'PAUSED') {
                gameState = 'PLAYING';
                lastFrameTime = performance.now();
                if (pauseBtn) pauseBtn.textContent = '⏸ PAUSE [P]';
            }
        }

        function setDifficulty(level) {
            currentDifficulty = level;
            ['chill', 'normal', 'intense'].forEach((k) => {
                const btn = document.getElementById(`diff-${k}`);
                if (btn) {
                    btn.className = (k === level)
                        ? 'pixel-btn px-2.5 py-1.5 rounded font-pixel text-[11px]'
                        : 'pixel-btn-dark px-2.5 py-1.5 rounded font-pixel text-[11px]';
                }
            });
        }

        function changeObstacleMode(mode) {
            obstacleThemeMode = mode;
        }

        function updateScoreUI() {
            const liveEl = document.getElementById('liveScoreDisplay');
            const bestEl = document.getElementById('bestScoreHud');
            if (liveEl) liveEl.textContent = score;
            if (bestEl) bestEl.textContent = bestScore;
        }

        /***********************************************************************
         * 7. 60FPS PHYSICS UPDATE & COLLISION DETECTION
         ***********************************************************************/
        function triggerGameOver(reasonText) {
            if (!hero.alive) return;
            hero.alive = false;
            gameState = 'GAMEOVER';
            playPixelSound('collision');

            spawnCollisionShatter(hero.x + hero.width / 2, hero.y + hero.height / 2);

            if (score > bestScore) {
                bestScore = score;
                try {
                    localStorage.setItem('flappy_pixel_best', String(bestScore));
                } catch (e) {}
            }

            updateScoreUI();
            const finalScoreEl = document.getElementById('finalScoreText');
            const finalBestEl = document.getElementById('finalBestText');
            const crashReasonEl = document.getElementById('crashReasonText');
            if (finalScoreEl) finalScoreEl.textContent = score;
            if (finalBestEl) finalBestEl.textContent = bestScore;
            if (crashReasonEl) crashReasonEl.textContent = reasonText;

            gameOverOverlayTimer = setTimeout(() => {
                gameOverOverlayTimer = null;
                if (gameState === 'GAMEOVER') {
                    const overEl = document.getElementById('gameOverOverlay');
                    if (overEl) overEl.classList.remove('hidden');
                }
            }, 260);
        }

        function updateGame(dt) {
            const preset = DIFFICULTY_PRESETS[currentDifficulty];
            const scrollSpeed = gameState === 'PLAYING' ? preset.speed : (gameState === 'START' ? 110 : 40);

            // 1. Update Sky Ash Motes
            for (let i = 0; i < skyAshMotes.length; i++) {
                const m = skyAshMotes[i];
                m.x -= (m.speedX + scrollSpeed * 0.15) * dt;
                m.y += m.speedY * dt;
                if (m.x < -10) m.x = GAME_WIDTH + 10;
                if (m.y < 0) m.y = GAME_HEIGHT - 90;
                if (m.y > GAME_HEIGHT - 80) m.y = 10;
            }

            // 2. Update Parallax Background Junk Towers
            for (let i = 0; i < bgParallaxLayers.length; i++) {
                const layer = bgParallaxLayers[i];
                layer.scrollX = (layer.scrollX + scrollSpeed * layer.speedFactor * dt) % 320;
            }

            // 3. Update Heavy Volumetric Smoke Production
            if (Math.random() < 0.65) {
                smokePuffs.push(createSmokePuff(GAME_WIDTH + 20, false));
            }
            if (Math.random() < 0.45) {
                smokePuffs.push(createSmokePuff(Math.random() * GAME_WIDTH, true));
            }

            for (let i = smokePuffs.length - 1; i >= 0; i--) {
                const sp = smokePuffs[i];
                sp.x += (sp.vx - scrollSpeed * 0.35) * dt;
                sp.y += sp.vy * dt;
                sp.life -= sp.decay * dt;
                if (sp.life <= 0 || sp.x + sp.w < -40) {
                    smokePuffs.splice(i, 1);
                }
            }

            // 4. Update Active Particles & Shockwaves
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.vy += p.gravity * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= p.decay * dt;
                if (p.life <= 0) {
                    particles.splice(i, 1);
                }
            }

            for (let i = shockwaves.length - 1; i >= 0; i--) {
                const sw = shockwaves[i];
                sw.w += (sw.maxW - sw.w) * 9 * dt;
                if (sw.type === 'explosion') {
                    sw.h = sw.w;
                } else {
                    sw.y += 48 * dt;
                }
                sw.life -= 2.4 * dt;
                if (sw.life <= 0) {
                    shockwaves.splice(i, 1);
                }
            }

            // 5. Update Shattered Hero Quadrants (when Game Over)
            for (let i = 0; i < shatteredFragments.length; i++) {
                const frag = shatteredFragments[i];
                frag.vy += 820 * dt;
                frag.x += frag.vx * dt;
                frag.y += frag.vy * dt;
                frag.rot += frag.vRot * dt;
            }

            if (screenShakeTime > 0) screenShakeTime = Math.max(0, screenShakeTime - dt);
            if (impactFlashAlpha > 0) impactFlashAlpha = Math.max(0, impactFlashAlpha - dt * 3.8);

            // Idle Bobbing on Start Screen
            if (gameState === 'START') {
                hero.y = GAME_HEIGHT * 0.44 + Math.sin(performance.now() * 0.0045) * 9;
                hero.trailTimer += dt;
                if (hero.trailTimer >= 0.045) {
                    hero.trailTimer = 0;
                    spawnHeroTrailParticle();
                }
                return;
            }

            if (gameState !== 'PLAYING') return;

            // 6. Update Hero Physics (Smooth 60FPS Gravity, Squash & Stretch)
            hero.vy += preset.gravity * dt;
            hero.y += hero.vy * dt;

            hero.scaleX += (1.0 - hero.scaleX) * 14 * dt;
            hero.scaleY += (1.0 - hero.scaleY) * 14 * dt;

            if (hero.flapAnimTimer > 0) {
                hero.flapAnimTimer = Math.max(0, hero.flapAnimTimer - dt);
            }

            const targetRot = Math.max(-0.38, Math.min(0.65, hero.vy * 0.0011));
            hero.rotation += (targetRot - hero.rotation) * 12 * dt;

            hero.trailTimer += dt;
            if (hero.trailTimer >= 0.032) {
                hero.trailTimer = 0;
                spawnHeroTrailParticle();
            }

            // 7. Spawn & Move Obstacles
            obstacleSpawnTimer += dt;
            if (obstacleSpawnTimer >= preset.spawnInterval) {
                obstacleSpawnTimer = 0;
                spawnObstaclePair();
            }

            const hx1 = hero.x + 6;
            const hy1 = hero.y + 6;
            const hx2 = hero.x + hero.width - 6;
            const hy2 = hero.y + hero.height - 6;

            for (let i = obstacles.length - 1; i >= 0; i--) {
                const ob = obstacles[i];
                ob.x -= preset.speed * dt;

                if (!ob.passed && ob.x + ob.width < hero.x) {
                    ob.passed = true;
                    score += 1;
                    updateScoreUI();
                    playPixelSound('score');

                    const badge = document.getElementById('comboBadge');
                    if (badge) {
                        badge.classList.remove('hidden');
                        clearTimeout(window.badgeTimer);
                        window.badgeTimer = setTimeout(() => badge.classList.add('hidden'), 650);
                    }
                }

                const obLeft = ob.x + 14;
                const obRight = ob.x + ob.width - 14;

                if (hx2 > obLeft && hx1 < obRight) {
                    if (hy1 < ob.gapTop - 4) {
                        const msg = ob.style === 'shards'
                            ? 'Shattered against a hanging Mountain Cave Stalactite Shard.'
                            : 'Collided with an inverted Ceiling Junk Shadow Tower (House/Window/Chair).';
                        triggerGameOver(msg);
                        return;
                    }
                    if (hy2 > ob.gapBottom + 4) {
                        const msg = ob.style === 'shards'
                            ? 'Impaled on a rising Crystalline Cave Stalagmite Shard.'
                            : 'Crashed into a stacked Real-Object Shadow Tower (House/Desk/Window/Chair).';
                        triggerGameOver(msg);
                        return;
                    }
                }

                if (ob.x + ob.width < -120) {
                    obstacles.splice(i, 1);
                }
            }

            if (hero.y + hero.height > GAME_HEIGHT - 22) {
                hero.y = GAME_HEIGHT - 22 - hero.height;
                triggerGameOver('Consumed by the dense industrial pixel smoke trench below.');
            } else if (hero.y < -12) {
                hero.y = -12;
                triggerGameOver('Struck the upper cavern ceiling shadow boundary.');
            }
        }

        /***********************************************************************
         * 8. HIGH-RES MONOCHROME PIXEL SCENE RENDERER (Zero Edge Offset)
         ***********************************************************************/
        function drawLighterAtmosphericSky() {
            const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
            skyGrad.addColorStop(0.0, '#74747e');
            skyGrad.addColorStop(0.38, '#5f5f69');
            skyGrad.addColorStop(0.74, '#4b4b54');
            skyGrad.addColorStop(1.0, '#36363e');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fillRect(0, 0, GAME_WIDTH, 68);
            ctx.fillRect(0, 68, GAME_WIDTH, 64);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
            for (let y = 0; y < GAME_HEIGHT; y += 8) {
                ctx.fillRect(0, y, GAME_WIDTH, 1);
            }

            for (let i = 0; i < skyAshMotes.length; i++) {
                const m = skyAshMotes[i];
                ctx.fillStyle = m.color;
                ctx.globalAlpha = m.alpha;
                ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
            }
            ctx.globalAlpha = 1.0;
        }

        function drawParallaxBackgroundTowers() {
            const bgImg = SPRITE_CACHE.bgTowers;
            if (!bgImg) return;

            for (let i = 0; i < bgParallaxLayers.length; i++) {
                const layer = bgParallaxLayers[i];
                const drawW = 320;
                const drawH = 266;
                const yPos = GAME_HEIGHT - drawH - (i === 0 ? 34 : 10);

                ctx.save();
                ctx.globalAlpha = layer.alpha;
                for (let x = -layer.scrollX; x < GAME_WIDTH + drawW; x += drawW) {
                    ctx.drawImage(bgImg, Math.round(x), Math.round(yPos), drawW, drawH);
                }
                ctx.restore();
            }
        }

        function drawVolumetricSmoke(foregroundPass) {
            if (!foregroundPass) {
                ctx.fillStyle = '#8a8a96';
                ctx.fillRect(0, GAME_HEIGHT - 64, GAME_WIDTH, 64);
                ctx.fillStyle = '#52525c';
                ctx.fillRect(0, GAME_HEIGHT - 44, GAME_WIDTH, 44);
            } else {
                ctx.fillStyle = '#222228';
                ctx.fillRect(0, GAME_HEIGHT - 22, GAME_WIDTH, 22);
            }

            for (let i = 0; i < smokePuffs.length; i++) {
                const sp = smokePuffs[i];
                const isDarkFront = sp.color === '#24242b';
                if (foregroundPass !== isDarkFront) continue;

                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, sp.life * sp.alpha));
                ctx.fillStyle = sp.color;
                const rx = Math.round(sp.x / 2) * 2;
                const ry = Math.round(sp.y / 2) * 2;
                ctx.fillRect(rx, ry, sp.w, sp.h);

                if (sp.color === '#52525c') {
                    ctx.fillStyle = '#d8d8e2';
                    ctx.fillRect(rx + 4, ry - 4, Math.max(8, sp.w - 8), 4);
                }
                ctx.restore();
            }
        }

        function drawObstacles() {
            const now = performance.now() * 0.004;
            const SPRITE_H = 220;

            for (let i = 0; i < obstacles.length; i++) {
                const ob = obstacles[i];
                const x = Math.round(ob.x);
                const w = ob.width;

                // 1. TOP OBSTACLE: Anchored flush to ob.gapTop (y = topH - 220 .. topH) with zero squishing or negative source Y
                const topH = Math.max(24, Math.round(ob.gapTop));
                const topSprite = ob.style === 'shards' ? SPRITE_CACHE.caveTop : SPRITE_CACHE.junkTop;
                if (topSprite) {
                    if (topH > SPRITE_H) {
                        const extH = topH - SPRITE_H + 4;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(x + 10, 0, w - 20, extH);
                        ctx.fillStyle = '#09090b';
                        ctx.fillRect(x + 12, 0, w - 24, extH);
                    }
                    ctx.drawImage(topSprite, x, topH - SPRITE_H, w, SPRITE_H);
                }

                // 2. BOTTOM OBSTACLE: Anchored flush to ob.gapBottom (y = botY .. botY + 220) with foundation column down to 540
                const botY = Math.round(ob.gapBottom);
                const botH = Math.max(24, GAME_HEIGHT - botY);
                let botSprite = SPRITE_CACHE.junkBottom;
                if (ob.style === 'shards') botSprite = SPRITE_CACHE.caveBottom;
                else if (ob.style === 'hybrid') botSprite = SPRITE_CACHE.hybridBottom;

                if (botSprite) {
                    if (botH > SPRITE_H) {
                        const extY = botY + SPRITE_H - 4;
                        const extH = GAME_HEIGHT - extY;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(x + 10, extY, w - 20, extH);
                        ctx.fillStyle = '#09090b';
                        ctx.fillRect(x + 12, extY, w - 24, extH);
                    }
                    ctx.drawImage(botSprite, x, botY, w, SPRITE_H);
                }

                // 3. Floating Pixel Dust / Crystal Splinters around Obstacle Tips
                const hoverOffset = Math.round(Math.sin(now + ob.splinterOffset) * 4);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x + 8, topH - 18 + hoverOffset, 4, 6);
                ctx.fillRect(x + w - 12, botY + 12 - hoverOffset, 4, 6);
            }
        }

        function drawHeroAndParticles() {
            for (let i = 0; i < shockwaves.length; i++) {
                const sw = shockwaves[i];
                ctx.save();
                ctx.globalAlpha = Math.max(0, sw.life);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                const rx = Math.round(sw.x - sw.w / 2);
                const ry = Math.round(sw.y - sw.h / 2);
                ctx.strokeRect(rx, ry, Math.round(sw.w), Math.round(sw.h));
                ctx.restore();
            }

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
                const px = Math.round(p.x);
                const py = Math.round(p.y);
                const s = Math.round(p.size);

                ctx.fillStyle = p.color;
                ctx.fillRect(px, py, s, s);

                if (p.hollow && s >= 6) {
                    ctx.fillStyle = p.innerColor;
                    ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
                }
                ctx.restore();
            }

            if (hero.alive) {
                const sprite = hero.flapAnimTimer > 0 ? SPRITE_CACHE.heroFlap : SPRITE_CACHE.heroIdle;
                ctx.save();
                const cx = Math.round(hero.x + hero.width / 2);
                const cy = Math.round(hero.y + hero.height / 2);
                ctx.translate(cx, cy);
                ctx.rotate(hero.rotation);
                ctx.scale(hero.scaleX, hero.scaleY);

                if (sprite) {
                    ctx.drawImage(sprite, -28, -28, 56, 56);
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(-22, -22, 44, 44);
                }

                const orbitY = Math.round(Math.sin(performance.now() * 0.01) * 12);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(28, orbitY, 4, 4);
                ctx.restore();
            } else {
                if (impactFlashAlpha > 0) {
                    ctx.save();
                    ctx.globalAlpha = impactFlashAlpha;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(crashCoordinates.x - 4, crashCoordinates.y - 44, 8, 88);
                    ctx.fillRect(crashCoordinates.x - 44, crashCoordinates.y - 4, 88, 8);
                    ctx.restore();
                }

                for (let i = 0; i < shatteredFragments.length; i++) {
                    const frag = shatteredFragments[i];
                    ctx.save();
                    ctx.translate(Math.round(frag.x), Math.round(frag.y));
                    ctx.rotate(frag.rot);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(-10, -10, 20, 20);
                    ctx.fillStyle = '#08080a';
                    ctx.fillRect(-8, -8, 16, 16);
                    ctx.fillStyle = frag.type === 'visor' ? '#ffffff' : '#888894';
                    ctx.fillRect(-4, -4, 8, 6);
                    ctx.restore();
                }
            }
        }

        function renderScene() {
            ctx.imageSmoothingEnabled = false;
            ctx.save();

            if (screenShakeTime > 0) {
                const dx = (Math.random() - 0.5) * screenShakeIntensity * 2;
                const dy = (Math.random() - 0.5) * screenShakeIntensity * 2;
                ctx.translate(Math.round(dx), Math.round(dy));
            }

            drawLighterAtmosphericSky();
            drawParallaxBackgroundTowers();
            drawVolumetricSmoke(false);
            drawObstacles();
            drawHeroAndParticles();
            drawVolumetricSmoke(true);

            ctx.restore();
        }

        /***********************************************************************
         * 9. MAIN 60FPS GAME LOOP & EVENT LISTENERS
         ***********************************************************************/
        function gameLoop(timestamp) {
            const rawDt = (timestamp - lastFrameTime) / 1000;
            lastFrameTime = timestamp;
            const dt = Math.min(rawDt, 0.05);

            if (rawDt > 0) {
                const currentFps = 1 / rawDt;
                fpsSmooth = fpsSmooth * 0.9 + currentFps * 0.1;
            }

            if (Math.random() < 0.2) {
                const fpsEl = document.getElementById('fpsCounter');
                const partEl = document.getElementById('particleCounter');
                if (fpsEl) fpsEl.textContent = Math.round(fpsSmooth);
                if (partEl) partEl.textContent = particles.length + smokePuffs.length;
            }

            updateGame(dt);
            renderScene();

            requestAnimationFrame(gameLoop);
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                e.preventDefault();
                triggerFlapAction();
            } else if (e.code === 'KeyP') {
                togglePause();
            } else if (e.code === 'KeyR' && gameState === 'GAMEOVER') {
                restartGame();
            }
        });

        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            triggerFlapAction(e);
        });

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            triggerFlapAction(e);
        }, { passive: false });

// Boot the game once the window and ./assets.svg sprites are loaded
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const savedBest = localStorage.getItem('flappy_pixel_best');
        if (savedBest) bestScore = parseInt(savedBest, 10) || 0;
    } catch (e) {}

    updateScoreUI();
    initEnvironment();
    await preloadAllSvgSprites();

    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
});
