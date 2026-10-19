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
            } else if (type === 'voltBlink') {
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);

                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

                osc.connect(gain);
                gain.connect(context.destination);
                osc.start(now);
                osc.stop(now + 0.13);
            } else if (type === 'echoPhase') {
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(360, now);
                osc.frequency.linearRampToValueAtTime(720, now + 0.08);
                osc.frequency.linearRampToValueAtTime(480, now + 0.18);

                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

                osc.connect(gain);
                gain.connect(context.destination);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'cinderRewind') {
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(640, now + 0.65);

                gain.gain.setValueAtTime(0.14, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

                osc.connect(gain);
                gain.connect(context.destination);
                osc.start(now);
                osc.stop(now + 0.7);
            } else if (type === 'cinderExplosion') {
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(190, now);
                osc.frequency.exponentialRampToValueAtTime(26, now + 0.45);

                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

                osc.connect(gain);
                gain.connect(context.destination);
                osc.start(now);
                osc.stop(now + 0.48);
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
        const CHARACTER_ROSTER_FILE = './flappy_pixel_9_character_svg_roster_ability_animations.html';
        const CHARACTER_ROSTER = [
            { id: 'cube01', spriteId: 'svg-char-01', name: 'CUBE-01', title: 'THE ORIGIN', ability: 'BASELINE ARCADE SKILL', description: 'No automatic ability. A pure handling test.', color: '#e4e4e7' },
            { id: 'volt', spriteId: 'svg-char-02', name: 'VOLT-CUBE', title: 'THUNDER', ability: 'PHASE BLINK // LIGHT PIXEL TRAIL', description: 'Teleports forward every 3rd flap, releasing a light yellow pixelated trail.', color: '#facc15' },
            { id: 'nimbus', spriteId: 'svg-char-03', name: 'NIMBUS', title: 'CLOUD', ability: 'MIST FORM // EVERY 5TH JUMP', description: 'Phases through obstacles for two seconds.', color: '#7dd3fc' },
            { id: 'aegis', spriteId: 'svg-char-04', name: 'AEGIS', title: 'IRONCLAD', ability: 'ABLATIVE ARMOR // 1-HIT SHIELD', description: 'Blocks one crash and recharges after five passes.', color: '#fb923c' },
            { id: 'prism', spriteId: 'svg-char-05', name: 'PRISM', title: 'GLASS', ability: 'SHARD RESONANCE // EVERY 4TH OBSTACLE', description: 'Widens every fourth obstacle gap by forty-five percent.', color: '#e879f9' },
            { id: 'chrono', spriteId: 'svg-char-06', name: 'CHRONO', title: 'GLITCH', ability: 'TIME DILATION // LOW JUMP SLOW-MO', description: 'Slows the world near danger with decreased jump height for precise threading.', color: '#34d399' },
            { id: 'cinder', spriteId: 'svg-char-07', name: 'CINDER', title: 'PHOENIX', ability: 'THERMAL UPDRAFT + ASH REBIRTH', description: 'Bounces off floor; upon crash, camera rewinds to death point and revives with an obstacle-clearing blast.', color: '#f97316' },
            { id: 'grav0', spriteId: 'svg-char-08', name: 'GRAV-0', title: 'VOID', ability: 'FEATHER-FALL // EVERY 2ND JUMP HOVER', description: 'Applies apex hover and lower gravity only after every 2 jumps.', color: '#a78bfa' },
            { id: 'echo', spriteId: 'svg-char-09', name: 'ECHO', title: 'PHANTOM', ability: 'SHADOW DECOY // PHANTOM TRAIL', description: 'Every 6th jump summons an animated shadow decoy with ghost trails and double score.', color: '#2dd4bf' }
        ];

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
            await preloadCharacterRosterSprites();
        }

        async function preloadCharacterRosterSprites() {
            try {
                const response = await fetch(CHARACTER_ROSTER_FILE);
                if (!response.ok) return;
                const rosterDoc = new DOMParser().parseFromString(await response.text(), 'text/html');
                await Promise.all(CHARACTER_ROSTER.map(async (character) => {
                    const node = rosterDoc.getElementById(character.spriteId);
                    SPRITE_CACHE[`character-${character.id}`] = await rasterizeSymbolNode(node);
                }));
            } catch (err) {
                console.warn('Character roster sprites could not be loaded:', err);
            }
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

        let selectedCharacterId = 'cube01';
        let jumpCount = 0;
        let passCount = 0;
        let obstacleCount = 0;
        let phaseTimer = 0;
        let chronoTimer = 0;
        let gravHoverTimer = 0;
        let gravHoverArmed = false;
        let gravJumpCount = 0;
        let echoTimer = 0;
        let echoDodgeReady = false;
        let echoTrailHistory = [];
        let aegisShieldReady = true;
        let aegisRechargePasses = 0;
        let chronoReady = true;
        let chronoRechargeJumps = 0;
        let cinderReviveReady = true;
        let cinderAuraTimer = 0;
        let voltTrailTimer = 0;
        let voltDashTimer = 0;
        const voltDashDuration = 0.14; // Snappy 140ms phase warp
        const voltDashTotalDist = 112;
        let voltTrailHistory = [];
        let cinderReviveSequence = {
            active: false,
            phase: 'none',
            timer: 0,
            deathX: 0,
            deathY: 0,
            cameraOffset: 0,
            targetObstacle: null,
            ashParticles: []
        };
        let abilityFlashTimer = 0;
        let abilityFlashText = '';

        function getActiveCharacter() {
            return CHARACTER_ROSTER.find((character) => character.id === selectedCharacterId) || CHARACTER_ROSTER[0];
        }

        function resetCharacterRunState() {
            jumpCount = 0;
            passCount = 0;
            obstacleCount = 0;
            phaseTimer = 0;
            chronoTimer = 0;
            gravHoverTimer = 0;
            gravHoverArmed = false;
            gravJumpCount = 0;
            echoTimer = 0;
            echoDodgeReady = false;
            echoTrailHistory = [];
            aegisShieldReady = true;
            aegisRechargePasses = 0;
            chronoReady = true;
            chronoRechargeJumps = 0;
            cinderReviveReady = true;
            cinderAuraTimer = 0;
            voltTrailTimer = 0;
            voltDashTimer = 0;
            voltTrailHistory = [];
            cinderReviveSequence = {
                active: false,
                phase: 'none',
                timer: 0,
                deathX: 0,
                deathY: 0,
                cameraOffset: 0,
                targetObstacle: null,
                ashParticles: []
            };
            abilityFlashTimer = 0;
            abilityFlashText = '';
            updateCharacterUI();
        }

        function announceAbility(text, duration = 0.9) {
            abilityFlashText = text;
            abilityFlashTimer = duration;
            updateCharacterUI();
        }

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
            const isChronoSlow = selectedCharacterId === 'chrono' && chronoTimer > 0;
            const isVoltBlink = selectedCharacterId === 'volt' && jumpCount % 3 === 0;

            shockwaves.push({
                x: hero.x + hero.width / 2,
                y: hero.y + hero.height + 2,
                w: 36,
                h: 6,
                maxW: isChronoSlow ? 60 : 92,
                life: 1.0,
                type: 'flap'
            });

            for (let i = 0; i < 18; i++) {
                const isHollow = i < 7;
                const size = isHollow ? (8 + (i % 2) * 4) : (4 + (i % 2) * 2);
                const spreadAngle = (Math.PI * 0.5) + (Math.random() - 0.5) * 1.15;
                const speed = (isChronoSlow ? 80 : 130) + Math.random() * (isChronoSlow ? 120 : 210);

                let pColor = i % 3 === 0 ? '#d4d4de' : '#ffffff';
                if (isChronoSlow) {
                    pColor = i % 2 === 0 ? '#34d399' : '#a7f3d0';
                } else if (isVoltBlink) {
                    pColor = i % 2 === 0 ? '#fef08a' : '#facc15';
                }

                particles.push({
                    x: hero.x + hero.width * 0.5 + (Math.random() * 24 - 12),
                    y: hero.y + hero.height - 2,
                    vx: Math.cos(spreadAngle) * speed - 90,
                    vy: Math.sin(spreadAngle) * speed * 0.85,
                    size: size,
                    hollow: isHollow,
                    color: pColor,
                    innerColor: '#08080a',
                    life: 1.0,
                    decay: 1.6 + Math.random() * 1.1,
                    gravity: 340
                });
            }
        }

        function spawnVoltBlinkBurst() {
            const colors = ['#fef08a', '#facc15', '#fef9c3', '#ffffff', '#fde047'];
            for (let i = 0; i < 20; i++) {
                const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.35;
                const speed = 70 + Math.random() * 150;
                particles.push({
                    x: hero.x + hero.width * 0.5,
                    y: hero.y + hero.height * 0.5,
                    vx: Math.cos(angle) * speed - 90,
                    vy: Math.sin(angle) * speed * 0.65,
                    size: (i % 2 === 0) ? 6 : 4,
                    hollow: Math.random() < 0.35,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    innerColor: '#18181b',
                    life: 0.8,
                    decay: 1.5 + Math.random() * 0.8,
                    gravity: 0
                });
            }
        }

        function spawnEchoAbilityBurst() {
            shockwaves.push({
                x: hero.x + hero.width / 2,
                y: hero.y + hero.height / 2,
                w: 36,
                h: 36,
                maxW: 140,
                life: 1.0,
                type: 'explosion'
            });
            const colors = ['#2dd4bf', '#5eead4', '#99f6e4', '#14b8a6'];
            for (let i = 0; i < 24; i++) {
                const angle = (Math.PI * 2 * i) / 24;
                const speed = 90 + Math.random() * 140;
                particles.push({
                    x: hero.x + hero.width / 2,
                    y: hero.y + hero.height / 2,
                    vx: Math.cos(angle) * speed - 60,
                    vy: Math.sin(angle) * speed,
                    size: i % 2 === 0 ? 6 : 4,
                    hollow: i % 3 === 0,
                    color: colors[i % colors.length],
                    innerColor: '#042f2e',
                    life: 0.9,
                    decay: 1.4,
                    gravity: 0
                });
            }
        }

        function spawnEchoDecoyShatter(cx, cy) {
            impactFlashAlpha = 0.6;
            screenShakeTime = 0.25;
            screenShakeIntensity = 8;
            shockwaves.push({
                x: cx + 20,
                y: cy + 20,
                w: 24,
                h: 24,
                maxW: 130,
                life: 0.8,
                type: 'explosion'
            });
            for (let i = 0; i < 28; i++) {
                const angle = (Math.PI * 2 * i) / 28;
                const speed = 100 + Math.random() * 220;
                particles.push({
                    x: cx + 20,
                    y: cy + 20,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 40,
                    size: i % 2 === 0 ? 8 : 4,
                    hollow: true,
                    color: i % 2 === 0 ? '#2dd4bf' : '#99f6e4',
                    innerColor: '#09090b',
                    life: 0.8,
                    decay: 1.6,
                    gravity: 300
                });
            }
        }

        function findNearestObstacle(heroX) {
            if (obstacles.length === 0) return null;
            let closest = null;
            let minDist = Infinity;
            for (let i = 0; i < obstacles.length; i++) {
                const ob = obstacles[i];
                const dist = Math.abs((ob.x + ob.width / 2) - heroX);
                if (dist < minDist) {
                    minDist = dist;
                    closest = ob;
                }
            }
            return closest;
        }

        function spawnObstacleExplosionFragments(ob) {
            const ox = ob.x + ob.width / 2;
            for (let i = 0; i < 22; i++) {
                const py = Math.random() * ob.gapTop;
                particles.push({
                    x: ox + (Math.random() * 64 - 32),
                    y: py,
                    vx: (Math.random() - 0.4) * 360,
                    vy: (Math.random() - 0.5) * 320 - 90,
                    size: 6 + Math.floor(Math.random() * 4) * 2,
                    hollow: Math.random() < 0.4,
                    color: Math.random() < 0.45 ? '#f97316' : (Math.random() < 0.5 ? '#ffffff' : '#3f3f46'),
                    innerColor: '#09090b',
                    life: 1.2,
                    decay: 0.85 + Math.random() * 0.5,
                    gravity: 720
                });
            }
            for (let i = 0; i < 22; i++) {
                const py = ob.gapBottom + Math.random() * (GAME_HEIGHT - ob.gapBottom);
                particles.push({
                    x: ox + (Math.random() * 64 - 32),
                    y: py,
                    vx: (Math.random() - 0.4) * 360,
                    vy: (Math.random() - 0.5) * 320 - 90,
                    size: 6 + Math.floor(Math.random() * 4) * 2,
                    hollow: Math.random() < 0.4,
                    color: Math.random() < 0.45 ? '#fde047' : (Math.random() < 0.5 ? '#e4e4e7' : '#27272a'),
                    innerColor: '#09090b',
                    life: 1.2,
                    decay: 0.85 + Math.random() * 0.5,
                    gravity: 720
                });
            }
            shockwaves.push({
                x: ox,
                y: Math.max(40, ob.gapTop - 20),
                w: 48,
                h: 48,
                maxW: 180,
                life: 0.95,
                type: 'explosion'
            });
            shockwaves.push({
                x: ox,
                y: Math.min(GAME_HEIGHT - 40, ob.gapBottom + 20),
                w: 48,
                h: 48,
                maxW: 180,
                life: 0.95,
                type: 'explosion'
            });
        }

        function startCinderReviveSequence(obstacle) {
            cinderReviveSequence.active = true;
            cinderReviveSequence.phase = 'shatter';
            cinderReviveSequence.timer = 0;
            cinderReviveSequence.deathX = hero.x;
            cinderReviveSequence.deathY = hero.y;
            cinderReviveSequence.cameraOffset = 0;
            cinderReviveSequence.targetObstacle = obstacle || findNearestObstacle(hero.x);
            cinderReviveSequence.ashParticles = [];

            hero.alive = false;
            screenShakeTime = 0.35;
            screenShakeIntensity = 12;
            impactFlashAlpha = 0.9;
            playPixelSound('collision');

            const colors = ['#f97316', '#ef4444', '#fde047', '#ffffff', '#ea580c'];
            for (let i = 0; i < 46; i++) {
                const angle = (Math.PI * 2 * i) / 46 + (Math.random() - 0.5) * 0.3;
                const speed = 60 + Math.random() * 220;
                cinderReviveSequence.ashParticles.push({
                    x: hero.x + hero.width / 2,
                    y: hero.y + hero.height / 2,
                    originX: hero.x + hero.width / 2,
                    originY: hero.y + hero.height / 2,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 30,
                    size: i % 2 === 0 ? 6 : 4,
                    color: colors[i % colors.length],
                    alpha: 1.0
                });
            }

            announceAbility('ASH REBIRTH // REVERSING TIME...', 1.4);
        }

        function updateCinderReviveSequence(dt) {
            cinderReviveSequence.timer += dt;

            if (cinderReviveSequence.phase === 'shatter') {
                for (let i = 0; i < cinderReviveSequence.ashParticles.length; i++) {
                    const p = cinderReviveSequence.ashParticles[i];
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.vx *= 0.92;
                    p.vy *= 0.92;
                }
                if (cinderReviveSequence.timer >= 0.4) {
                    cinderReviveSequence.phase = 'rewind';
                    cinderReviveSequence.timer = 0;
                    playPixelSound('cinderRewind');
                    announceAbility('TIME REVERSING // RECONVERGING AT DEATH POINT', 1.0);
                }
            } else if (cinderReviveSequence.phase === 'rewind') {
                const duration = 0.8;
                const t = Math.min(1, cinderReviveSequence.timer / duration);
                const rewindMax = 180;
                cinderReviveSequence.cameraOffset = Math.sin(t * Math.PI) * rewindMax;

                const targetX = cinderReviveSequence.deathX + hero.width / 2;
                const targetY = cinderReviveSequence.deathY + hero.height / 2;
                for (let i = 0; i < cinderReviveSequence.ashParticles.length; i++) {
                    const p = cinderReviveSequence.ashParticles[i];
                    p.x += (targetX - p.x) * 6 * dt;
                    p.y += (targetY - p.y) * 6 * dt;
                }

                if (cinderReviveSequence.timer >= duration) {
                    cinderReviveSequence.phase = 'explode';
                    cinderReviveSequence.timer = 0;
                    cinderReviveSequence.cameraOffset = 0;

                    playPixelSound('cinderExplosion');
                    screenShakeTime = 0.48;
                    screenShakeIntensity = 18;
                    impactFlashAlpha = 1.0;

                    shockwaves.push({
                        x: targetX,
                        y: targetY,
                        w: 32,
                        h: 32,
                        maxW: 240,
                        life: 1.0,
                        type: 'explosion'
                    });

                    const colors = ['#f97316', '#fde047', '#ef4444', '#ffffff'];
                    for (let i = 0; i < 50; i++) {
                        const angle = (Math.PI * 2 * i) / 50;
                        const speed = 120 + Math.random() * 340;
                        particles.push({
                            x: targetX,
                            y: targetY,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 50,
                            size: i % 2 === 0 ? 8 : 4,
                            hollow: i % 3 === 0,
                            color: colors[i % colors.length],
                            innerColor: '#09090b',
                            life: 1.1,
                            decay: 1.0 + Math.random() * 0.5,
                            gravity: 500
                        });
                    }

                    let destroyedAny = false;
                    for (let i = obstacles.length - 1; i >= 0; i--) {
                        const ob = obstacles[i];
                        if (ob === cinderReviveSequence.targetObstacle ||
                            (ob.x < hero.x + 130 && ob.x + ob.width > hero.x - 50)) {
                            spawnObstacleExplosionFragments(ob);
                            obstacles.splice(i, 1);
                            destroyedAny = true;
                        }
                    }
                    if (!destroyedAny) {
                        const nearest = findNearestObstacle(hero.x);
                        if (nearest) {
                            spawnObstacleExplosionFragments(nearest);
                            const idx = obstacles.indexOf(nearest);
                            if (idx >= 0) obstacles.splice(idx, 1);
                        }
                    }

                    hero.alive = true;
                    hero.x = cinderReviveSequence.deathX;
                    hero.y = Math.max(40, Math.min(GAME_HEIGHT - 120, cinderReviveSequence.deathY));
                    hero.vy = -430;
                    cinderAuraTimer = 1.3;
                    announceAbility('PHOENIX REBIRTH // OBSTACLE DESTROYED!', 1.4);
                }
            } else if (cinderReviveSequence.phase === 'explode') {
                if (cinderReviveSequence.timer >= 0.4) {
                    cinderReviveSequence.active = false;
                    cinderReviveSequence.phase = 'none';
                    cinderReviveSequence.cameraOffset = 0;
                    cinderReviveSequence.ashParticles = [];
                }
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
            let gapTop = minTop + Math.random() * (maxTop - minTop);
            let gapBottom = gapTop + gap;
            obstacleCount += 1;
            const prismResonance = selectedCharacterId === 'prism' && obstacleCount % 4 === 0;
            if (prismResonance) {
                const widening = gap * 0.225;
                gapTop = Math.max(28, gapTop - widening);
                gapBottom = Math.min(GAME_HEIGHT - 28, gapBottom + widening);
                announceAbility('SHARD RESONANCE', 0.8);
            }

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
                prismResonance: prismResonance,
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
            resetCharacterRunState();
            updateScoreUI();
        }

        function triggerFlapAction(e) {
            if (e && e.type === 'touchstart') {
                e.preventDefault();
            }

            // During Cinder's shatter/rewind cutscene, ignore flap until revived
            if (cinderReviveSequence.active && cinderReviveSequence.phase !== 'explode') {
                return;
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
            let impulse = preset.jumpImpulse;
            // Chrono: In slowed motion, decrease the jump height for tight, controlled micro-hops
            if (selectedCharacterId === 'chrono' && chronoTimer > 0) {
                impulse *= 0.65;
            }
            hero.vy = impulse;
            hero.scaleX = (selectedCharacterId === 'chrono' && chronoTimer > 0) ? 1.09 : 1.18;
            hero.scaleY = (selectedCharacterId === 'chrono' && chronoTimer > 0) ? 0.91 : 0.82;
            hero.flapAnimTimer = 0.16;

            spawnFlapBurstParticles();
            playPixelSound('flap');
            activateFlapAbility();
        }

        function activateFlapAbility() {
            jumpCount += 1;

            if (selectedCharacterId === 'volt' && jumpCount % 3 === 0) {
                voltDashTimer = voltDashDuration;
                voltTrailTimer = 0.65;
                phaseTimer = Math.max(phaseTimer, 0.22);
                spawnVoltBlinkBurst();
                announceAbility('PHASE BLINK // LIGHT TRAIL', 0.65);
                playPixelSound('voltBlink');
            } else if (selectedCharacterId === 'nimbus' && jumpCount % 5 === 0) {
                phaseTimer = 2;
                announceAbility('MIST FORM // 2.0S', 2);
            } else if (selectedCharacterId === 'chrono' && !chronoReady) {
                chronoRechargeJumps += 1;
                if (chronoRechargeJumps >= 6) {
                    chronoReady = true;
                    chronoRechargeJumps = 0;
                    announceAbility('TIME CORE READY', 0.8);
                }
            } else if (selectedCharacterId === 'grav0') {
                // Grav-O: Ability applied only after 2 jumps, not after every
                gravJumpCount += 1;
                if (gravJumpCount % 2 === 0) {
                    gravHoverArmed = true;
                    announceAbility('VOID CORE READY // APEX HOVER ARMED', 0.65);
                } else {
                    gravHoverArmed = false;
                    announceAbility('GRAV-0 CHARGING // JUMP 1/2', 0.5);
                }
            } else if (selectedCharacterId === 'echo' && jumpCount % 6 === 0) {
                echoTimer = 2.5;
                echoDodgeReady = true;
                echoTrailHistory = [];
                spawnEchoAbilityBurst();
                announceAbility('SHADOW DECOY // PHANTOM TRAIL', 2.5);
                playPixelSound('echoPhase');
            }
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

        function updateCharacterUI() {
            const character = getActiveCharacter();
            const menuEl = document.getElementById('selectedPilotMenu');
            const abilityEl = document.getElementById('abilityHud');
            if (menuEl) menuEl.textContent = character.name;
            if (abilityEl) {
                const liveStatus = abilityFlashTimer > 0 ? abilityFlashText : character.ability;
                abilityEl.textContent = `${character.name} // ${liveStatus}`;
                abilityEl.style.borderColor = character.color;
            }
        }

        function drawShopSpriteThumbnails() {
            CHARACTER_ROSTER.forEach((character) => {
                const thumb = document.getElementById(`shopSprite-${character.id}`);
                const sprite = SPRITE_CACHE[`character-${character.id}`];
                if (!thumb || !sprite) return;
                const thumbCtx = thumb.getContext('2d');
                thumbCtx.imageSmoothingEnabled = false;
                thumbCtx.clearRect(0, 0, thumb.width, thumb.height);

                // Subtle floor shadow pedestal under the cube
                thumbCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                thumbCtx.fillRect(Math.round(thumb.width * 0.15), thumb.height - 10, Math.round(thumb.width * 0.7), 6);

                // Draw sprite large, crisp, edge-to-edge
                thumbCtx.drawImage(sprite, 2, 2, thumb.width - 4, thumb.height - 12);
            });

            // Also draw the large active pilot showcase preview in the shop detail footer
            const active = getActiveCharacter();
            const bigCanvas = document.getElementById('shopSelectedHeroBig');
            const bigSprite = SPRITE_CACHE[`character-${active.id}`];
            if (bigCanvas && bigSprite) {
                const bigCtx = bigCanvas.getContext('2d');
                bigCtx.imageSmoothingEnabled = false;
                bigCtx.clearRect(0, 0, bigCanvas.width, bigCanvas.height);

                // Pedestal shadow
                bigCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                bigCtx.fillRect(16, bigCanvas.height - 14, bigCanvas.width - 32, 8);

                // Draw large showcase cube
                bigCtx.drawImage(bigSprite, 4, 4, bigCanvas.width - 8, bigCanvas.height - 16);
            }
        }

        function renderShop() {
            const grid = document.getElementById('characterShopGrid');
            const detail = document.getElementById('shopSelectionDetail');
            if (!grid || !detail) return;

            grid.innerHTML = CHARACTER_ROSTER.map((character, index) => {
                const selected = character.id === selectedCharacterId;
                return `<button type="button" onclick="selectCharacter('${character.id}')" class="group relative border-2 bg-neutral-900 p-3 sm:p-4 text-left transition-all active:translate-y-px ${selected ? 'border-white bg-neutral-800/90 shadow-[0_0_16px_rgba(255,255,255,0.2)]' : 'border-neutral-700 hover:border-neutral-400 hover:bg-neutral-850'}" aria-pressed="${selected}">
                    <div class="flex items-start justify-between gap-2 mb-1.5">
                        <span class="font-pixel text-[10px] font-bold" style="color:${character.color}">0${index + 1}</span>
                        <span class="font-pixel text-[8px] px-1.5 py-0.5 rounded-sm ${selected ? 'bg-white text-black font-bold' : 'text-neutral-400 bg-neutral-950/80 border border-neutral-800'}">${selected ? 'EQUIPPED' : 'SELECT'}</span>
                    </div>
                    <!-- Large Sprite Canvas Display -->
                    <div class="relative py-2 flex items-center justify-center bg-neutral-950/70 rounded-md border border-neutral-800/80 my-2">
                        <canvas id="shopSprite-${character.id}" width="160" height="160" class="block h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 drop-shadow-[0_4px_8px_rgba(0,0,0,0.65)] transition-transform group-hover:scale-105"></canvas>
                    </div>
                    <span class="block font-pixel text-xs sm:text-sm text-white font-bold tracking-wide">${character.name}</span>
                    <span class="mt-0.5 block font-pixel text-[9px] leading-snug" style="color:${character.color}">${character.title}</span>
                </button>`;
            }).join('');

            const active = getActiveCharacter();
            detail.innerHTML = `
                <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <div class="relative flex-shrink-0">
                        <canvas id="shopSelectedHeroBig" width="180" height="180" class="w-24 h-24 sm:w-28 sm:h-28 border-2 bg-neutral-950 p-1.5 rounded-md" style="border-color:${active.color}; box-shadow: 0 0 18px ${active.color}40;"></canvas>
                        <span class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black border text-[8px] font-pixel text-white whitespace-nowrap shadow-sm" style="border-color:${active.color}">EQUIPPED</span>
                    </div>
                    <div class="flex-1 text-center sm:text-left">
                        <div class="flex flex-wrap items-center justify-center sm:justify-between gap-2 border-b border-neutral-800 pb-2">
                            <div>
                                <span class="font-pixel text-sm sm:text-base font-bold text-white tracking-wider">${active.name}</span>
                                <span class="ml-2 font-pixel text-[10px] px-2 py-0.5 rounded-sm" style="color:${active.color}; background: ${active.color}22; border: 1px solid ${active.color}66">${active.title}</span>
                            </div>
                            <span class="font-pixel text-[9px] text-neutral-400">PILOT HANGAR // STATUS: READY</span>
                        </div>
                        <div class="mt-2.5">
                            <span class="font-pixel text-[10px] text-amber-300 block mb-1">ABILITY: ${active.ability}</span>
                            <p class="text-xs leading-relaxed text-neutral-300">${active.description}</p>
                        </div>
                    </div>
                </div>`;
            drawShopSpriteThumbnails();
        }

        function openShop() {
            const shop = document.getElementById('shopOverlay');
            if (shop) shop.classList.remove('hidden');
            renderShop();
        }

        function closeShop() {
            const shop = document.getElementById('shopOverlay');
            if (shop) shop.classList.add('hidden');
        }

        function selectCharacter(characterId) {
            if (!CHARACTER_ROSTER.some((character) => character.id === characterId)) return;
            selectedCharacterId = characterId;
            try {
                localStorage.setItem('flappy_pixel_character', selectedCharacterId);
            } catch (e) {}
            resetCharacterRunState();
            renderShop();
        }

        /***********************************************************************
         * 7. 60FPS PHYSICS UPDATE & COLLISION DETECTION
         ***********************************************************************/
        function avertCrash(obstacle) {
            if (phaseTimer > 0 && obstacle) return true;

            if (selectedCharacterId === 'aegis' && aegisShieldReady) {
                aegisShieldReady = false;
                const obstacleIndex = obstacles.indexOf(obstacle);
                if (obstacleIndex >= 0) obstacles.splice(obstacleIndex, 1);
                hero.vy = -280;
                announceAbility('ABLATIVE ARMOR SHATTERED', 1.1);
                playPixelSound('score');
                return true;
            }

            if (selectedCharacterId === 'echo' && echoDodgeReady) {
                echoDodgeReady = false;
                echoTimer = 0;
                spawnEchoDecoyShatter(hero.x - 56, hero.y);
                if (obstacle) {
                    hero.y = Math.max(12, Math.min(GAME_HEIGHT - hero.height - 28, (obstacle.gapTop + obstacle.gapBottom) / 2 - hero.height / 2));
                    const obstacleIndex = obstacles.indexOf(obstacle);
                    if (obstacleIndex >= 0) obstacles.splice(obstacleIndex, 1);
                }
                hero.vy = -220;
                announceAbility('DECOY SWAP // CRASH AVOIDED', 1.1);
                return true;
            }

            if (selectedCharacterId === 'cinder' && cinderReviveReady) {
                cinderReviveReady = false;
                startCinderReviveSequence(obstacle);
                return true;
            }

            return false;
        }

        function triggerGameOver(reasonText, obstacle = null) {
            if (!hero.alive) return;
            if (cinderReviveSequence.active) return;
            if (avertCrash(obstacle)) return;
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
            if (cinderReviveSequence.active) {
                updateCinderReviveSequence(dt);
                return;
            }

            const preset = DIFFICULTY_PRESETS[currentDifficulty];
            const chronoMultiplier = chronoTimer > 0 ? 0.6 : 1;
            const scrollSpeed = (gameState === 'PLAYING' ? preset.speed : (gameState === 'START' ? 110 : 40)) * chronoMultiplier;

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
            if (phaseTimer > 0) phaseTimer = Math.max(0, phaseTimer - dt);
            if (chronoTimer > 0) chronoTimer = Math.max(0, chronoTimer - dt);
            if (gravHoverTimer > 0) gravHoverTimer = Math.max(0, gravHoverTimer - dt);
            if (cinderAuraTimer > 0) cinderAuraTimer = Math.max(0, cinderAuraTimer - dt);

            // Volt Cube: High-speed smooth phase dash (Zero camera lag, 60fps continuous interpolation)
            let voltPhaseSpeed = 0;
            if (voltDashTimer > 0) {
                const stepDt = Math.min(dt, voltDashTimer);
                voltDashTimer -= stepDt;
                voltPhaseSpeed = voltDashTotalDist / voltDashDuration;
                const extraMove = voltPhaseSpeed * stepDt;

                for (let i = 0; i < obstacles.length; i++) {
                    obstacles[i].x -= extraMove;
                }
                for (let i = 0; i < bgParallaxLayers.length; i++) {
                    bgParallaxLayers[i].scrollX = (bgParallaxLayers[i].scrollX + extraMove * bgParallaxLayers[i].speedFactor) % 320;
                }
                for (let i = 0; i < skyAshMotes.length; i++) {
                    skyAshMotes[i].x -= extraMove * 0.2;
                }

                hero.scaleX = 1.34;
                hero.scaleY = 0.76;
            }

            // Volt Cube: Continuous light yellow pixelated trail during blink ability
            if (voltTrailTimer > 0 || voltDashTimer > 0) {
                if (voltTrailTimer > 0) voltTrailTimer = Math.max(0, voltTrailTimer - dt);

                // Record dynamic trail snapshot in world space
                voltTrailHistory.unshift({
                    x: hero.x,
                    y: hero.y,
                    rotation: hero.rotation,
                    scaleX: hero.scaleX,
                    scaleY: hero.scaleY,
                    alpha: 1.0
                });
                if (voltTrailHistory.length > 22) voltTrailHistory.pop();

                if (Math.random() < 0.9) {
                    const colors = ['#fef08a', '#facc15', '#fef9c3', '#ffffff', '#fde047'];
                    particles.push({
                        x: hero.x - 4 + (Math.random() * 8 - 4),
                        y: hero.y + hero.height * 0.5 + (Math.random() * 22 - 11),
                        vx: -(150 + Math.random() * 80) - (voltDashTimer > 0 ? 300 : 0),
                        vy: (Math.random() - 0.5) * 40,
                        size: Math.random() < 0.45 ? 6 : 4,
                        hollow: Math.random() < 0.35,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        innerColor: '#09090b',
                        life: 0.8,
                        decay: 1.7 + Math.random() * 0.8,
                        gravity: 0
                    });
                }
            } else {
                if (voltTrailHistory.length > 0) voltTrailHistory.pop();
            }

            // Scroll and fade active volt trail snapshots with world movement
            for (let i = 0; i < voltTrailHistory.length; i++) {
                const pt = voltTrailHistory[i];
                pt.x -= (preset.speed * chronoMultiplier + voltPhaseSpeed) * dt;
                pt.alpha = Math.max(0, pt.alpha - dt * 2.8);
            }

            // Echo: Continuous phantom trail particles and position history during shadow decoy ability
            if (echoTimer > 0) {
                echoTimer = Math.max(0, echoTimer - dt);
                echoTrailHistory.unshift({ x: hero.x, y: hero.y, rotation: hero.rotation });
                if (echoTrailHistory.length > 20) echoTrailHistory.pop();

                if (Math.random() < 0.85) {
                    const colors = ['#2dd4bf', '#5eead4', '#99f6e4', '#14b8a6'];
                    particles.push({
                        x: hero.x - 8 + (Math.random() * 8 - 4),
                        y: hero.y + hero.height * 0.5 + (Math.random() * 24 - 12),
                        vx: -(130 + Math.random() * 70),
                        vy: (Math.random() - 0.5) * 35,
                        size: Math.random() < 0.4 ? 6 : 4,
                        hollow: Math.random() < 0.35,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        innerColor: '#042f2e',
                        life: 0.8,
                        decay: 1.6 + Math.random() * 0.8,
                        gravity: 0
                    });
                }
            } else {
                if (echoTrailHistory.length > 0) echoTrailHistory.pop();
            }

            if (abilityFlashTimer > 0) {
                abilityFlashTimer = Math.max(0, abilityFlashTimer - dt);
                if (abilityFlashTimer === 0) updateCharacterUI();
            }

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
            let gravityMultiplier = chronoTimer > 0 ? 0.6 : 1;
            if (selectedCharacterId === 'grav0') {
                // Feather-fall gravity applies only when apex hover is armed (jump 2) or active
                if (gravHoverArmed || gravHoverTimer > 0) {
                    gravityMultiplier *= 0.65;
                }
            }
            hero.vy += preset.gravity * gravityMultiplier * dt;
            if (selectedCharacterId === 'grav0' && gravHoverArmed && hero.vy >= 0) {
                gravHoverArmed = false;
                gravHoverTimer = 0.65;
                hero.vy = 0;
                announceAbility('APEX HOVER // 0.65S', 0.65);
            }
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
                ob.x -= preset.speed * chronoMultiplier * dt;

                if (!ob.passed && ob.x + ob.width < hero.x) {
                    ob.passed = true;
                    passCount += 1;
                    const scoreGain = echoTimer > 0 ? 2 : 1;
                    score += scoreGain;
                    if (selectedCharacterId === 'aegis' && !aegisShieldReady) {
                        aegisRechargePasses += 1;
                        if (aegisRechargePasses >= 5) {
                            aegisRechargePasses = 0;
                            aegisShieldReady = true;
                            announceAbility('ABLATIVE ARMOR RESTORED', 1);
                        }
                    }
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

                if (selectedCharacterId === 'chrono' && chronoReady && chronoTimer <= 0 &&
                    ob.x + ob.width > hero.x - 10 && ob.x < hero.x + 180 &&
                    (hero.y < ob.gapTop + 34 || hero.y + hero.height > ob.gapBottom - 34)) {
                    chronoReady = false;
                    chronoRechargeJumps = 0;
                    chronoTimer = 1.5;
                    announceAbility('TIME DILATION // 1.5S', 1.5);
                }

                if (hx2 > obLeft && hx1 < obRight) {
                    if (hy1 < ob.gapTop - 4) {
                        const msg = ob.style === 'shards'
                            ? 'Shattered against a hanging Mountain Cave Stalactite Shard.'
                            : 'Collided with an inverted Ceiling Junk Shadow Tower (House/Window/Chair).';
                        triggerGameOver(msg, ob);
                        return;
                    }
                    if (hy2 > ob.gapBottom + 4) {
                        const msg = ob.style === 'shards'
                            ? 'Impaled on a rising Crystalline Cave Stalagmite Shard.'
                            : 'Crashed into a stacked Real-Object Shadow Tower (House/Desk/Window/Chair).';
                        triggerGameOver(msg, ob);
                        return;
                    }
                }

                if (ob.x + ob.width < -120) {
                    obstacles.splice(i, 1);
                }
            }

            if (hero.y + hero.height > GAME_HEIGHT - 22) {
                hero.y = GAME_HEIGHT - 22 - hero.height;
                if (selectedCharacterId === 'cinder') {
                    hero.vy = -430;
                    announceAbility('THERMAL UPDRAFT', 0.7);
                } else {
                    triggerGameOver('Consumed by the dense industrial pixel smoke trench below.');
                }
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

                if (ob.prismResonance) {
                    ctx.strokeStyle = '#e879f9';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x + 4, topH - 8, w - 8, 8);
                    ctx.strokeRect(x + 4, botY, w - 8, 8);
                }
            }
        }

        function drawActiveAbilityEffect() {
            const cx = Math.round(hero.x + hero.width / 2);
            const cy = Math.round(hero.y + hero.height / 2);
            const character = getActiveCharacter();
            const active = phaseTimer > 0 || chronoTimer > 0 || gravHoverTimer > 0 || echoTimer > 0 ||
                voltTrailTimer > 0 || gravHoverArmed || cinderAuraTimer > 0 ||
                (selectedCharacterId === 'aegis' && aegisShieldReady);
            if (!active) return;

            ctx.save();
            ctx.globalAlpha = phaseTimer > 0 ? 0.42 : 0.8;
            ctx.strokeStyle = character.color;
            ctx.lineWidth = 3;

            if (selectedCharacterId === 'aegis' && aegisShieldReady) {
                ctx.strokeRect(cx - 38, cy - 38, 76, 76);
                ctx.strokeRect(cx - 34, cy - 34, 68, 68);
            } else if (selectedCharacterId === 'echo' && echoTimer > 0) {
                // 1. Phasing ghost trail along recent flight trajectory
                for (let i = 0; i < echoTrailHistory.length; i += 4) {
                    const ghost = echoTrailHistory[i];
                    if (!ghost) continue;
                    const ghostIndex = i / 4;
                    const ghostAlpha = Math.max(0, (1 - ghostIndex * 0.28) * 0.5);
                    ctx.save();
                    ctx.globalAlpha = ghostAlpha;
                    ctx.strokeStyle = '#2dd4bf';
                    ctx.lineWidth = 2;
                    const gx = Math.round(ghost.x + hero.width / 2);
                    const gy = Math.round(ghost.y + hero.height / 2);
                    const glitchOffset = Math.sin(performance.now() * 0.04 + ghostIndex) * 3;
                    ctx.strokeRect(gx - 22 + glitchOffset, gy - 22, 44, 44);
                    ctx.fillStyle = '#5eead4';
                    ctx.globalAlpha = ghostAlpha * 0.22;
                    ctx.fillRect(gx - 20 + glitchOffset, gy - 20, 40, 40);
                    ctx.restore();
                }

                // 2. Animated Shadow Decoy with holographic scanlines & 2X badge
                const decoyX = cx - 58;
                const decoyY = cy + Math.sin(performance.now() * 0.007) * 7;
                ctx.save();
                ctx.strokeStyle = '#2dd4bf';
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = 0.8 + Math.sin(performance.now() * 0.02) * 0.2;
                ctx.strokeRect(decoyX - 22, decoyY - 22, 44, 44);
                ctx.fillStyle = '#115e59';
                ctx.globalAlpha = 0.25;
                ctx.fillRect(decoyX - 20, decoyY - 20, 40, 40);

                const echoSprite = SPRITE_CACHE['character-echo'];
                if (echoSprite) {
                    ctx.globalAlpha = 0.45;
                    ctx.drawImage(echoSprite, decoyX - 22, decoyY - 22, 44, 44);
                }

                ctx.fillStyle = '#2dd4bf';
                ctx.globalAlpha = 0.6;
                for (let sy = -18; sy <= 18; sy += 6) {
                    ctx.fillRect(decoyX - 20, decoyY + sy, 40, 1.5);
                }

                ctx.fillStyle = '#09090b';
                ctx.globalAlpha = 0.85;
                ctx.fillRect(decoyX - 28, decoyY - 34, 56, 12);
                ctx.strokeStyle = '#2dd4bf';
                ctx.lineWidth = 1;
                ctx.strokeRect(decoyX - 28, decoyY - 34, 56, 12);
                ctx.fillStyle = '#5eead4';
                ctx.font = '7px Silkscreen, monospace';
                ctx.textAlign = 'center';
                ctx.fillText('2X DECOY', decoyX, decoyY - 25);
                ctx.restore();
            } else if (selectedCharacterId === 'volt' && (voltTrailTimer > 0 || voltTrailHistory.length > 0)) {
                // 1. Fluid, dynamic light-yellow pixelated ghost trail in world coordinates
                for (let i = 2; i < voltTrailHistory.length; i += 3) {
                    const pt = voltTrailHistory[i];
                    if (!pt || pt.alpha <= 0.05) continue;
                    const trailAlpha = pt.alpha * Math.min(1, voltTrailTimer / 0.5) * 0.85;
                    if (trailAlpha <= 0.02) continue;

                    ctx.save();
                    const tx = Math.round(pt.x + hero.width / 2);
                    const ty = Math.round(pt.y + hero.height / 2);
                    ctx.translate(tx, ty);
                    ctx.rotate(pt.rotation || 0);
                    ctx.scale(pt.scaleX || 1, pt.scaleY || 1);

                    // Light yellow pixel ghost outline
                    ctx.globalAlpha = trailAlpha;
                    ctx.strokeStyle = '#fef08a';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(-22, -22, 44, 44);

                    // Translucent glowing yellow core
                    ctx.fillStyle = '#fde047';
                    ctx.globalAlpha = trailAlpha * 0.22;
                    ctx.fillRect(-20, -20, 40, 40);

                    // Yellow electric spark ticks
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = trailAlpha * 0.85;
                    ctx.fillRect(6, -8, 6, 4);
                    ctx.fillRect(-12, 8, 4, 4);

                    ctx.restore();
                }

                // 2. High-speed phase electric streaks during the dash
                if (voltDashTimer > 0) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
                    for (let s = 0; s < 7; s++) {
                        const sy = cy - 22 + s * 7;
                        const slen = 35 + (s % 3) * 20;
                        ctx.fillRect(cx - 24 - slen, sy, slen, 2);
                    }
                    ctx.restore();
                }
            } else if (selectedCharacterId === 'chrono' && chronoTimer > 0) {
                ctx.strokeRect(cx - 46, cy - 46, 92, 92);
                ctx.strokeRect(cx - 40, cy - 40, 80, 80);
            } else if (selectedCharacterId === 'grav0') {
                if (gravHoverTimer > 0) {
                    ctx.fillStyle = character.color;
                    ctx.fillRect(cx - 50, cy + 35, 100, 3);
                    ctx.fillRect(cx - 36, cy + 41, 72, 2);
                } else if (gravHoverArmed) {
                    // Glowing void frame indicating 2nd jump apex hover armed
                    ctx.save();
                    ctx.strokeStyle = character.color;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.55 + Math.sin(performance.now() * 0.015) * 0.3;
                    ctx.strokeRect(cx - 28, cy - 28, 56, 56);
                    ctx.restore();
                }
            } else if (selectedCharacterId === 'nimbus' && phaseTimer > 0) {
                ctx.strokeRect(cx - 42, cy - 42, 84, 84);
                ctx.strokeRect(cx - 34, cy - 34, 68, 68);
            }

            if (selectedCharacterId === 'cinder' && cinderAuraTimer > 0) {
                ctx.save();
                const auraAlpha = (cinderAuraTimer / 1.3) * 0.9;
                ctx.globalAlpha = auraAlpha;
                ctx.strokeStyle = '#f97316';
                ctx.lineWidth = 3;
                const pulse = Math.sin(performance.now() * 0.025) * 5;
                ctx.strokeRect(cx - 26 - pulse, cy - 26 - pulse, 52 + pulse * 2, 52 + pulse * 2);
                ctx.strokeStyle = '#fde047';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - 23, cy - 23, 46, 46);
                ctx.restore();
            }

            ctx.restore();
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
                drawActiveAbilityEffect();
                const characterSprite = SPRITE_CACHE[`character-${selectedCharacterId}`];
                const sprite = characterSprite || (hero.flapAnimTimer > 0 ? SPRITE_CACHE.heroFlap : SPRITE_CACHE.heroIdle);
                ctx.save();
                const cx = Math.round(hero.x + hero.width / 2);
                const cy = Math.round(hero.y + hero.height / 2);
                ctx.translate(cx, cy);
                ctx.rotate(hero.rotation);
                ctx.scale(hero.scaleX, hero.scaleY);

                if (phaseTimer > 0) ctx.globalAlpha = 0.5;

                if (sprite) {
                    const size = characterSprite ? 72 : 56;
                    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(-22, -22, 44, 44);
                }

                const orbitY = Math.round(Math.sin(performance.now() * 0.01) * 12);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(28, orbitY, 4, 4);
                ctx.restore();
            } else if (!cinderReviveSequence.active) {
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

            // Apply camera rewind offset during Cinder's revival sequence
            if (cinderReviveSequence.active && cinderReviveSequence.cameraOffset !== 0) {
                ctx.translate(Math.round(cinderReviveSequence.cameraOffset), 0);
            }

            drawLighterAtmosphericSky();
            drawParallaxBackgroundTowers();
            drawVolumetricSmoke(false);
            drawObstacles();
            drawHeroAndParticles();

            // Draw Cinder Phoenix ash particles during revival
            if (cinderReviveSequence.active && cinderReviveSequence.ashParticles) {
                for (let i = 0; i < cinderReviveSequence.ashParticles.length; i++) {
                    const ap = cinderReviveSequence.ashParticles[i];
                    ctx.save();
                    ctx.globalAlpha = ap.alpha || 1.0;
                    ctx.fillStyle = ap.color;
                    ctx.fillRect(Math.round(ap.x), Math.round(ap.y), ap.size, ap.size);
                    ctx.restore();
                }
            }

            // Rewind scanlines and glitch streaks during Cinder rewind phase
            if (cinderReviveSequence.active && cinderReviveSequence.phase === 'rewind') {
                ctx.save();
                ctx.fillStyle = 'rgba(249, 115, 22, 0.08)';
                for (let y = 0; y < GAME_HEIGHT; y += 6) {
                    ctx.fillRect(0, y, GAME_WIDTH, 2);
                }
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                for (let s = 0; s < 10; s++) {
                    const lx = (performance.now() * 1.8 + s * 95) % GAME_WIDTH;
                    const ly = (s * 53) % GAME_HEIGHT;
                    ctx.fillRect(lx, ly, 28, 2);
                }
                ctx.restore();
            }

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
        const savedCharacter = localStorage.getItem('flappy_pixel_character');
        if (CHARACTER_ROSTER.some((character) => character.id === savedCharacter)) {
            selectedCharacterId = savedCharacter;
        }
    } catch (e) {}

    updateScoreUI();
    updateCharacterUI();
    initEnvironment();
    await preloadAllSvgSprites();
    renderShop();

    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
});
