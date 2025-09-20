// Global effects controller namespace
        window.weatherEffects = window.weatherEffects || {};
        // Clouds background effect (morphing multi-puff clouds, respects reduced motion)
        (function() {
            const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const canvas = document.getElementById('cloudsCanvas');
            if (!canvas || prefersReduced) return;

            const ctx = canvas.getContext('2d');
            let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            let width = 0, height = 0;
            let clouds = [];
            let time = 0;
            let lastTs = 0;

            // Tunables (multipliers)
            let cloudDensityMul = 1;
            let cloudSpeedMul = 1;
            let cloudOpacity = parseFloat(getComputedStyle(canvas).opacity || '0.65') || 0.65;
            let cloudsEnabled = true;

            function resize() {
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                // Build a few large cloud blobs
                const baseCount = Math.max(4, Math.round(width / 300));
                const target = Math.max(1, Math.round(baseCount * cloudDensityMul));
                clouds = Array.from({ length: target }, () => makeCloud());
            }

            function makeCloud() {
                const w = 260 + Math.random() * 400;
                const h = 120 + Math.random() * 220;
                const z = 0.7 + Math.random() * 0.8; // depth factor (parallax)
                return {
                    x: Math.random() * width,
                    y: Math.random() * Math.min(height * 0.8, 600),
                    w,
                    h,
                    z,
                    // base speed in pixels per second, scaled by depth
                    baseSpeed: (12 + Math.random() * 18) * (0.6 + z),
                    alpha: 0.22 + Math.random() * 0.2,
                    puffs: createPuffs(w, h)
                };
            }

            function createPuffs(w, h) {
                const n = 5 + Math.floor(Math.random() * 3); // 5-7 puffs
                const puffs = [];
                for (let i = 0; i < n; i++) {
                    const ox = (i / (n - 1)) * w + (Math.random() * 20 - 10);
                    const oy = (Math.random() * 0.3 - 0.15) * h; // small vertical variance
                    const r = (h * (0.35 + Math.random() * 0.25)) * (0.85 + Math.random() * 0.3);
                    puffs.push({
                        ox,
                        oy,
                        r,
                        phase: Math.random() * Math.PI * 2,
                        ampX: 2 + Math.random() * 4,
                        ampY: 1 + Math.random() * 3
                    });
                }
                return puffs;
            }

            function drawCloud(c) {
                ctx.save();
                const baseY = c.y + c.h * 0.35;
                const bob = Math.sin(time * 0.3 + c.w * 0.001) * 4 * c.z; // subtle vertical bob
                for (const p of c.puffs) {
                    const px = c.x + p.ox + Math.sin(time * 0.8 + p.phase) * p.ampX;
                    const py = baseY + p.oy + Math.cos(time * 0.9 + p.phase) * p.ampY + bob;
                    const grad = ctx.createRadialGradient(px, py, 0, px, py, p.r);
                    const localAlpha = Math.min(1, (0.85 * c.alpha));
                    grad.addColorStop(0, `rgba(255,255,255,${0.95 * localAlpha})`);
                    grad.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = grad;
                    ctx.globalAlpha = 1;
                    ctx.beginPath();
                    ctx.arc(px, py, p.r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            function step(ts) {
                if (!lastTs) lastTs = ts;
                const dt = Math.min(0.05, (ts - lastTs) / 1000);
                lastTs = ts;
                time += dt;
                ctx.clearRect(0, 0, width, height);
                for (let i = 0; i < clouds.length; i++) {
                    const c = clouds[i];
                    drawCloud(c);
                    c.x += (c.baseSpeed * cloudSpeedMul) * dt; // horizontal drift in px/sec
                    if (c.x - c.w > width + 50) {
                        clouds[i] = makeCloud();
                        clouds[i].x = -clouds[i].w - 20;
                    }
                }
                requestAnimationFrame(step);
            }

            window.addEventListener('resize', () => {
                dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                resize();
            });
            function applyCloudSettings() {
                canvas.style.opacity = String(cloudOpacity);
                if (!cloudsEnabled) {
                    ctx.clearRect(0, 0, width, height);
                    return;
                }
                // Adjust cloud count smoothly to target
                const baseCount = Math.max(4, Math.round(width / 300));
                const target = Math.max(1, Math.round(baseCount * cloudDensityMul));
                const diff = target - clouds.length;
                if (diff > 0) {
                    for (let i = 0; i < diff; i++) clouds.push(makeCloud());
                } else if (diff < 0) {
                    clouds.splice(target);
                }
            }

            // Expose controls for outside scripts
            window.weatherEffects.clouds = {
                set(config = {}) {
                    if (typeof config.density === 'number') cloudDensityMul = Math.max(0, config.density);
                    if (typeof config.speed === 'number') cloudSpeedMul = Math.max(0, config.speed);
                    if (typeof config.opacity === 'number') cloudOpacity = Math.max(0, Math.min(1, config.opacity));
                    if (typeof config.enabled === 'boolean') cloudsEnabled = config.enabled;
                    applyCloudSettings();
                }
            };

            resize();
            applyCloudSettings();
            requestAnimationFrame(step);
        })();

        // Sun background effect (soft glow + rays)
        (function() {
            const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const canvas = document.getElementById('sunCanvas');
            if (!canvas || prefersReduced) return;

            const ctx = canvas.getContext('2d');
            let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            let width = 0, height = 0;
            let sunEnabled = true;
            let intensity = 0.9; // 0..1 affects opacity
            let sizeMul = 1.0;   // scales radius
            let angle = 0;
            let sunX = 140, sunY = 140; // left-side default
            let lockCenter = false; // default: not centered

            function resize() {
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                if (lockCenter) {
                    sunX = width * 0.5;
                    sunY = height * 0.5;
                }
            }

            function draw() {
                ctx.clearRect(0, 0, width, height);
                if (!sunEnabled) return;
                const r = 85 * sizeMul;
                const grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r * 2.8);
                grad.addColorStop(0, `rgba(255,235,130,${0.9 * intensity})`);
                grad.addColorStop(0.5, `rgba(255,220,100,${0.35 * intensity})`);
                grad.addColorStop(1, 'rgba(255,220,100,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(sunX, sunY, r * 2.6, 0, Math.PI * 2);
                ctx.fill();

                // Rays
                ctx.save();
                ctx.translate(sunX, sunY);
                ctx.rotate(angle);
                const rays = 12;
                for (let i = 0; i < rays; i++) {
                    ctx.rotate((Math.PI * 2) / rays);
                    ctx.globalAlpha = 0.22 * intensity;
                    ctx.fillStyle = 'rgba(255, 240, 150, 1)';
                    ctx.beginPath();
                    ctx.moveTo(r * 0.8, 0);
                    ctx.lineTo(r * 2.0, 6);
                    ctx.lineTo(r * 2.0, -6);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }

            function step(ts) {
                angle += 0.0006; // slow rotation
                draw();
                requestAnimationFrame(step);
            }

            window.addEventListener('resize', () => {
                dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                resize();
            });

            window.weatherEffects.sun = {
                set(config = {}) {
                    if (typeof config.enabled === 'boolean') sunEnabled = config.enabled;
                    if (typeof config.intensity === 'number') intensity = Math.max(0, Math.min(1, config.intensity));
                    if (typeof config.size === 'number') sizeMul = Math.max(0.3, config.size);
                    if (typeof config.center === 'boolean') lockCenter = config.center;
                    if (typeof config.x === 'number' || typeof config.y === 'number') {
                        lockCenter = false;
                        if (typeof config.x === 'number') sunX = config.x;
                        if (typeof config.y === 'number') sunY = config.y;
                    }
                    if (lockCenter) {
                        sunX = width * 0.5;
                        sunY = height * 0.5;
                    } else if (typeof config.x !== 'number' && typeof config.y !== 'number') {
                        // If not centered and no explicit coords, place on left
                        sunX = Math.max(100, width * 0.18);
                        sunY = Math.max(90, height * 0.22);
                    }
                    draw();
                }
            };

            resize();
            draw();
            requestAnimationFrame(step);
        })();

        // Wind background effect (subtle streaks)
        (function() {
            const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const canvas = document.getElementById('windCanvas');
            if (!canvas || prefersReduced) return;

            const ctx = canvas.getContext('2d');
            let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            let width = 0, height = 0;
            let streaks = [];
            let densityMul = 0.4;
            let speedMul = 1.0;
            let opacity = parseFloat(getComputedStyle(canvas).opacity || '0.25') || 0.25;
            let enabled = false;
            let angleDeg = -10; // slight tilt

            function resize() {
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                rebuild();
            }

            function makeStreak() {
                const len = 60 + Math.random() * 140;
                const base = 120 + Math.random() * 160;
                return {
                    x: Math.random() * width,
                    y: Math.random() * height,
                    l: len,
                    s: (base / 60) * speedMul, // px/frame
                    w: 1 + Math.random() * 2,
                    a: 0.15 + Math.random() * 0.25
                };
            }

            function rebuild() {
                const baseCount = (width * height) / 45000;
                const target = enabled ? Math.round(baseCount * densityMul) : 0;
                streaks = Array.from({ length: target }, () => makeStreak());
            }

            function step() {
                ctx.clearRect(0, 0, width, height);
                if (!enabled) return requestAnimationFrame(step);
                ctx.globalAlpha = opacity;
                ctx.strokeStyle = 'rgba(200, 230, 255, 0.9)';
                ctx.lineCap = 'round';
                const ang = (angleDeg * Math.PI) / 180;
                const dx = Math.cos(ang);
                const dy = Math.sin(ang);
                for (let i = 0; i < streaks.length; i++) {
                    const s = streaks[i];
                    ctx.lineWidth = s.w;
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(s.x + dx * s.l, s.y + dy * s.l);
                    ctx.stroke();
                    s.x += s.s * dx;
                    s.y += s.s * dy;
                    if (s.x - s.l > width + 20 || s.y - s.l > height + 20) {
                        streaks[i] = makeStreak();
                        streaks[i].x = -Math.random() * 60;
                        streaks[i].y = Math.random() * height;
                    }
                }
                ctx.globalAlpha = 1;
                requestAnimationFrame(step);
            }

            window.addEventListener('resize', () => {
                dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                resize();
            });

            window.weatherEffects.wind = {
                set(config = {}) {
                    if (typeof config.density === 'number') densityMul = Math.max(0, config.density);
                    if (typeof config.speed === 'number') speedMul = Math.max(0, config.speed);
                    if (typeof config.opacity === 'number') opacity = Math.max(0, Math.min(1, config.opacity));
                    if (typeof config.enabled === 'boolean') enabled = config.enabled;
                    if (typeof config.angle === 'number') angleDeg = config.angle;
                    canvas.style.opacity = String(opacity);
                    rebuild();
                }
            };

            resize();
            rebuild();
            requestAnimationFrame(step);
        })();

        // Lightning background effect (occasional bolts + screen flash)
        (function() {
            const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const canvas = document.getElementById('lightningCanvas');
            if (!canvas || prefersReduced) return;

            const ctx = canvas.getContext('2d');
            let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            let width = 0, height = 0;
            let enabled = false;
            let frequency = 0; // events per second
            let intensity = 0.8; // flash brightness 0..1
            let bolts = [];
            let flashAlpha = 0;

            function resize() {
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            function spawnBolt() {
                const startX = Math.random() * width;
                const startY = 0 + Math.random() * (height * 0.25);
                const segs = 8 + Math.floor(Math.random() * 6);
                const pts = [{ x: startX, y: startY }];
                let x = startX, y = startY;
                for (let i = 0; i < segs; i++) {
                    x += (Math.random() - 0.5) * 60;
                    y += (height / (segs + 1)) * (0.3 + Math.random() * 0.7);
                    pts.push({ x, y });
                }
                return { pts, life: 14 + Math.floor(Math.random() * 10) };
            }

            function step(ts) {
                ctx.clearRect(0, 0, width, height);
                if (enabled) {
                    // Random chance to spawn based on frequency
                    if (Math.random() < frequency / 60) { // approx per-frame probability at 60fps
                        bolts.push(spawnBolt());
                        flashAlpha = Math.max(flashAlpha, 0.25 * intensity + Math.random() * 0.35 * intensity);
                    }
                }

                // Draw bolts
                ctx.lineCap = 'round';
                for (let i = bolts.length - 1; i >= 0; i--) {
                    const b = bolts[i];
                    ctx.lineWidth = 2 + Math.random() * 1.5;
                    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
                    ctx.beginPath();
                    ctx.moveTo(b.pts[0].x, b.pts[0].y);
                    for (let j = 1; j < b.pts.length; j++) ctx.lineTo(b.pts[j].x, b.pts[j].y);
                    ctx.stroke();
                    // blue outer glow
                    ctx.lineWidth = 5;
                    ctx.strokeStyle = 'rgba(150, 190, 255, 0.35)';
                    ctx.stroke();
                    b.life--;
                    if (b.life <= 0) bolts.splice(i, 1);
                }

                // Screen flash
                if (flashAlpha > 0) {
                    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
                    ctx.fillRect(0, 0, width, height);
                    flashAlpha *= 0.85; // fade out
                    if (flashAlpha < 0.02) flashAlpha = 0;
                }

                requestAnimationFrame(step);
            }

            window.addEventListener('resize', () => {
                dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                resize();
            });

            window.weatherEffects.lightning = {
                set(config = {}) {
                    if (typeof config.enabled === 'boolean') enabled = config.enabled;
                    if (typeof config.frequency === 'number') frequency = Math.max(0, config.frequency);
                    if (typeof config.intensity === 'number') intensity = Math.max(0, Math.min(1, config.intensity));
                }
            };

            resize();
            requestAnimationFrame(step);
        })();

        // Rain background effect (lightweight, respects reduced motion)
        (function() {
            const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const canvas = document.getElementById('rainCanvas');
            if (!canvas || prefersReduced) return;

            const ctx = canvas.getContext('2d');
            let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            let drops = [];
            let width = 0, height = 0;

            // Tunables (multipliers)
            let rainDensityMul = 1;
            let rainSpeedMul = 1;
            let rainLengthMul = 1;
            let rainWindMul = 1;
            let rainOpacity = parseFloat(getComputedStyle(canvas).opacity || '0.75') || 0.75;
            let rainEnabled = true;

            function resize() {
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                rebuildDrops();
            }

            function makeDrop() {
                const baseSpeed = 5 + Math.random() * 5; // px/frame base
                const speed = baseSpeed * rainSpeedMul;
                const len = (14 + Math.random() * 20) * rainLengthMul; // px (longer)
                return {
                    x: Math.random() * width,
                    y: Math.random() * height,
                    l: len,
                    s: speed,
                    w: 1.6 + Math.random() * 1.2,  // thicker
                    a: 0.65 + Math.random() * 0.3  // slightly more opaque
                };
            }

            function rebuildDrops() {
                const baseCount = (width * height) / 14000; // density baseline
                const targetCount = rainEnabled ? Math.round(baseCount * rainDensityMul) : 0;
                drops = Array.from({ length: targetCount }, () => makeDrop());
            }

            function step() {
                ctx.clearRect(0, 0, width, height);
                ctx.strokeStyle = 'rgba(200,220,255,0.7)';
                ctx.lineCap = 'round';
                for (let i = 0; i < drops.length; i++) {
                    const d = drops[i];
                    ctx.globalAlpha = d.a;
                    ctx.lineWidth = d.w;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d.x, d.y + d.l);
                    ctx.stroke();

                    d.y += d.s;
                    d.x += 0.5 * rainWindMul; // wind
                    if (d.y - d.l > height || d.x > width + 10) {
                        drops[i] = makeDrop();
                        drops[i].y = -Math.random() * 40;
                    }
                }
                ctx.globalAlpha = 1;
                requestAnimationFrame(step);
            }

            window.addEventListener('resize', () => {
                dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                resize();
            });
            function applyRainSettings() {
                canvas.style.opacity = String(rainOpacity);
                rebuildDrops();
            }

            // Expose controls for outside scripts
            window.weatherEffects.rain = {
                set(config = {}) {
                    if (typeof config.density === 'number') rainDensityMul = Math.max(0, config.density);
                    if (typeof config.speed === 'number') rainSpeedMul = Math.max(0, config.speed);
                    if (typeof config.length === 'number') rainLengthMul = Math.max(0, config.length);
                    if (typeof config.wind === 'number') rainWindMul = Math.max(0, config.wind);
                    if (typeof config.opacity === 'number') rainOpacity = Math.max(0, Math.min(1, config.opacity));
                    if (typeof config.enabled === 'boolean') rainEnabled = config.enabled;
                    applyRainSettings();
                }
            };

            resize();
            applyRainSettings();
            requestAnimationFrame(step);
        })();

        // Function to determine rain type based on precipitation amount
        function getRainType(precipitation) {
            const value = parseFloat(precipitation);
            if (isNaN(value) || value <= 0) return 'No Rain';
            if (value <= 2.5) return 'Light';
            if (value <= 7.5) return 'Moderate';
            if (value <= 15) return 'Heavy';
            if (value <= 30) return 'Intense';
            return 'Torrential';
        }

        // Function to get appropriate weather icon and class based on rain type
        function getWeatherIconAndClass(rainType) {
            switch(rainType) {
                case 'No Rain':
                    return { icon: '☀️', class: '' }; // Clear
                case 'Light':
                    return { icon: '🌤️', class: '' }; // Partly cloudy
                case 'Moderate':
                    return { icon: '🌦️', class: 'rain' }; // Light rain
                case 'Heavy':
                    return { icon: '🌧️', class: 'rain' }; // Heavy rain
                case 'Intense':
                    return { icon: '⛈️', class: 'rain' }; // Thunderstorm
                case 'Torrential':
                    return { icon: '🌪️', class: 'rain' }; // Tornado/extreme weather
                default:
                    return { icon: '☀️', class: '' }; // Default sunny
            }
        }

        // Add interactive functionality
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize rain types based on current precipitation values
            updateRainTypes();

            // Weather card hover effects
            const weatherCards = document.querySelectorAll('.weather-card');
            weatherCards.forEach(card => {
                card.addEventListener('click', function() {
                    weatherCards.forEach(c => c.classList.remove('today'));
                    this.classList.add('today');
                    updateBackgroundFromActiveCard();
                });
            });

            // Chart interactions - show visible tooltip and titles
            const chartContainer = document.querySelector('.chart-container');
            const tooltip = document.getElementById('chartTooltip');
            const chartDots = document.querySelectorAll('.chart-dots');
            const labelsGroup = document.querySelector('.chart-data-labels');

            function updateDataLabelsFromDots() {
                if (!labelsGroup) return;
                // Clear existing labels
                while (labelsGroup.firstChild) labelsGroup.removeChild(labelsGroup.firstChild);
                // Render labels above each dot
                document.querySelectorAll('.chart-dots').forEach((dot, i) => {
                    const x = parseFloat(dot.getAttribute('cx')) || 0;
                    const y = parseFloat(dot.getAttribute('cy')) || 0;
                    const value = dot.getAttribute('data-value') || '';
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('class', 'chart-data-text');
                    text.setAttribute('x', String(x));
                    text.setAttribute('y', String(Math.max(14, y - 10)));
                    text.textContent = value;
                    labelsGroup.appendChild(text);
                });
            }
            chartDots.forEach((dot, index) => {
                // Ensure native tooltip also shows as fallback
                dot.setAttribute('title', dot.getAttribute('data-value') || '');

                dot.addEventListener('mouseenter', function(e) {
                    this.setAttribute('r', '7');
                    this.setAttribute('fill', 'rgba(255, 255, 255, 1)');
                    const value = this.getAttribute('data-value');
                    const dayLabelEl = document.querySelectorAll('.chart-labels span')[index];
                    const dayLabel = dayLabelEl ? dayLabelEl.textContent : `Day ${index + 1}`;
                    tooltip.textContent = `${dayLabel}: ${value}`;
                    tooltip.style.display = 'block';
                });

                dot.addEventListener('mousemove', function(e) {
                    const rect = chartContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    tooltip.style.left = `${x}px`;
                    tooltip.style.top = `${y}px`;
                });
                
                dot.addEventListener('mouseleave', function() {
                    this.setAttribute('r', '5');
                    this.setAttribute('fill', 'rgba(255, 193, 7, 1)');
                    tooltip.style.display = 'none';
                });
            });

            // Initial render of persistent labels
            updateDataLabelsFromDots();

            // Sidebar navigation
            const sidebarIcons = document.querySelectorAll('.sidebar-icon');
            sidebarIcons.forEach(icon => {
                icon.addEventListener('click', function() {
                    sidebarIcons.forEach(i => i.classList.remove('active'));
                    this.classList.add('active');
                });
            });

            // Municipality selector functionality
            const municipalitySelect = document.getElementById('municipalitySelect');
            const currentMunicipality = document.getElementById('current-municipality');
            
            municipalitySelect.addEventListener('change', function() {
                const selectedMunicipality = this.value;
                currentMunicipality.textContent = selectedMunicipality;
                
                // Generate random weather data for demonstration
                generateRandomWeatherData(selectedMunicipality);
                updateBackgroundFromActiveCard();
            });

            // Search functionality
            const searchInput = document.querySelector('.search-input');
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const options = municipalitySelect.options;
                
                for (let i = 0; i < options.length; i++) {
                    const option = options[i];
                    if (option.text.toLowerCase().includes(searchTerm)) {
                        municipalitySelect.value = option.value;
                        currentMunicipality.textContent = option.value;
                        generateRandomWeatherData(option.value);
                        updateBackgroundFromActiveCard();
                        break;
                    }
                }
            });

            // Function to update rain types for all weather cards
            function updateRainTypes() {
                const weatherCards = document.querySelectorAll('.weather-card');
                weatherCards.forEach(card => {
                    const precipitationElement = card.querySelector('.precipitation');
                    const rainTypeElement = card.querySelector('.rain-type');
                    const iconElement = card.querySelector('.weather-icon');
                    
                    if (precipitationElement && rainTypeElement && iconElement) {
                        const precipitationValue = parseFloat(precipitationElement.textContent);
                        const rainType = getRainType(precipitationValue);
                        const iconData = getWeatherIconAndClass(rainType);
                        
                        rainTypeElement.textContent = rainType;
                        iconElement.textContent = iconData.icon;
                        iconElement.className = `weather-icon ${iconData.class}`;
                    }
                });
            }

            //Make sure the data here will be fetch from the model
            // Function to generate random weather data for each municipality
            function generateRandomWeatherData(municipality) {
                const weatherCards = document.querySelectorAll('.weather-card');
                
                // Update weather cards with random data
                weatherCards.forEach((card, index) => {
                    const randomPrecipitation = (Math.random() * 35).toFixed(1); // 0-35mm with decimals
                    const rainType = getRainType(parseFloat(randomPrecipitation));
                    const iconData = getWeatherIconAndClass(rainType);
                    
                    const icon = card.querySelector('.weather-icon');
                    const precipitation = card.querySelector('.precipitation');
                    const rainTypeElement = card.querySelector('.rain-type');
                    
                    icon.textContent = iconData.icon;
                    icon.className = `weather-icon ${iconData.class}`;
                    precipitation.textContent = `${randomPrecipitation}mm`;
                    rainTypeElement.textContent = rainType;
                });
                
                // Update chart with new random data
                updateChart();
                
                // Update statistics
                updateStatistics();
                
                // Sync background to current active card
                updateBackgroundFromActiveCard();
            }

            function updateBackgroundFromActiveCard() {
                const active = document.querySelector('.weather-card.today') || document.querySelector('.weather-card');
                const typeEl = active ? active.querySelector('.rain-type') : null;
                const type = (typeEl ? typeEl.textContent : 'Light') || 'Light';
                setEffectsForRainType(type);
            }

            function setEffectsForRainType(type) {
                const t = String(type || '').toLowerCase();
                let cloudsCfg = { density: 1, speed: 1, opacity: 0.6, enabled: true };
                let rainCfg   = { density: 1, speed: 1, length: 1, wind: 1, opacity: 0.8, enabled: true };
                let sunCfg    = { enabled: true, intensity: 0.9, size: 1.2, center: false };
                let windCfg   = { enabled: false, density: 0.4, speed: 1.0, opacity: 0.25, angle: -12 };
                let boltCfg   = { enabled: false, frequency: 0.0, intensity: 0.8 };

                if (t.includes('no')) {
                    cloudsCfg = { density: 0.5, speed: 0.7, opacity: 0.35, enabled: true };
                    rainCfg   = { density: 0.0, speed: 1.0, length: 1.0, wind: 0.0, opacity: 0.0, enabled: false };
                    sunCfg    = { enabled: true, intensity: 1.0, size: 1.35, center: false };
                    windCfg   = { enabled: false, density: 0.3, speed: 0.8, opacity: 0.18, angle: -10 };
                    boltCfg   = { enabled: false, frequency: 0.0, intensity: 0.0 };
                } else if (t.includes('torrential')) {
                    cloudsCfg = { density: 2.6, speed: 1.3, opacity: 0.78, enabled: true };
                    rainCfg   = { density: 3.2, speed: 1.9, length: 1.7, wind: 1.2, opacity: 1.0, enabled: true };
                    sunCfg    = { enabled: false, intensity: 0.0, size: 1.0, center: false };
                    windCfg   = { enabled: true, density: 2.0, speed: 2.0, opacity: 0.35, angle: -18 };
                    boltCfg   = { enabled: true, frequency: 0.28, intensity: 1.0 };
                } else if (t.includes('intense')) {
                    cloudsCfg = { density: 1.9, speed: 1.2, opacity: 0.72, enabled: true };
                    rainCfg   = { density: 2.4, speed: 1.5, length: 1.5, wind: 1.0, opacity: 0.95, enabled: true };
                    sunCfg    = { enabled: false, intensity: 0.0, size: 1.0, center: false };
                    windCfg   = { enabled: true, density: 1.4, speed: 1.6, opacity: 0.3, angle: -16 };
                    boltCfg   = { enabled: true, frequency: 0.20, intensity: 0.85 };
                } else if (t.includes('heavy')) {
                    cloudsCfg = { density: 1.6, speed: 1.0, opacity: 0.67, enabled: true };
                    rainCfg   = { density: 1.8, speed: 1.3, length: 1.3, wind: 0.8, opacity: 0.88, enabled: true };
                    sunCfg    = { enabled: false, intensity: 0.0, size: 1.0, center: false };
                    windCfg   = { enabled: true, density: 0.9, speed: 1.2, opacity: 0.28, angle: -14 };
                    boltCfg   = { enabled: true, frequency: 0.08, intensity: 0.7 };
                } else if (t.includes('moderate')) {
                    cloudsCfg = { density: 1.2, speed: 0.95, opacity: 0.58, enabled: true };
                    rainCfg   = { density: 1.0, speed: 1.0, length: 1.0, wind: 0.6, opacity: 0.78, enabled: true };
                    sunCfg    = { enabled: true, intensity: 0.65, size: 1.1, center: false };
                    windCfg   = { enabled: true, density: 0.6, speed: 1.0, opacity: 0.22, angle: -12 };
                    boltCfg   = { enabled: false, frequency: 0.0, intensity: 0.0 };
                } else if (t.includes('light')) {
                    cloudsCfg = { density: 1.0, speed: 0.85, opacity: 0.48, enabled: true };
                    rainCfg   = { density: 0.5, speed: 0.8, length: 0.9, wind: 0.4, opacity: 0.65, enabled: true };
                    sunCfg    = { enabled: true, intensity: 0.95, size: 1.3, center: false };
                    windCfg   = { enabled: false, density: 0.4, speed: 0.8, opacity: 0.18, angle: -10 };
                    boltCfg   = { enabled: false, frequency: 0.0, intensity: 0.0 };
                } else {
                    cloudsCfg = { density: 0.6, speed: 0.7, opacity: 0.3, enabled: true };
                    rainCfg   = { density: 0.0, speed: 1.0, length: 1.0, wind: 0.0, opacity: 0.0, enabled: false };
                    sunCfg    = { enabled: true, intensity: 0.85, size: 1.2, center: false };
                    windCfg   = { enabled: false, density: 0.3, speed: 0.8, opacity: 0.2, angle: -10 };
                    boltCfg   = { enabled: false, frequency: 0.0, intensity: 0.0 };
                }
                if (window.weatherEffects && window.weatherEffects.clouds) window.weatherEffects.clouds.set(cloudsCfg);
                if (window.weatherEffects && window.weatherEffects.rain) window.weatherEffects.rain.set(rainCfg);
                if (window.weatherEffects && window.weatherEffects.sun) window.weatherEffects.sun.set(sunCfg);
                if (window.weatherEffects && window.weatherEffects.wind) window.weatherEffects.wind.set(windCfg);
                if (window.weatherEffects && window.weatherEffects.lightning) window.weatherEffects.lightning.set(boltCfg);
            }

            function updateChart() {
                // Pull precipitation data from weather cards to match chart values
                const precipEls = Array.from(document.querySelectorAll('.weather-card .precipitation'));
                const dataPoints = precipEls.map(el => parseFloat((el.textContent || '0').replace(/mm/i, '').trim()) || 0);

                // Guard: if not enough data, skip
                if (dataPoints.length === 0) return;

                const minValue = Math.min(...dataPoints);
                const maxValue = Math.max(...dataPoints);
                
                // Update chart path and dots
                const chartPath = document.querySelector('.chart-line-path');
                const chartDots = document.querySelectorAll('.chart-dots');
                
                // Calculate positions based on chart dimensions
                const chartWidth = 350;
                const chartHeight = 120;
                const startX = 50;
                const stepX = chartWidth / 6;
                
                let pathD = `M ${startX}`;
                
                chartDots.forEach((dot, index) => {
                    const x = startX + (index * stepX);
                    const range = Math.max(1e-6, (maxValue - minValue));
                    const norm = (dataPoints[index] - minValue) / range; // 0 at min, 1 at max
                    const y = 140 - (norm * chartHeight); // Map to [20,140]
                    
                    dot.setAttribute('cx', x);
                    dot.setAttribute('cy', y);
                    dot.setAttribute('data-value', `${dataPoints[index]}mm`);
                    // Keep native tooltip label updated
                    dot.setAttribute('title', `${dataPoints[index]}mm`);
                    
                    if (index === 0) {
                        pathD += ` ${y}`;
                    } else {
                        pathD += ` L ${x} ${y}`;
                    }
                });
                
                chartPath.setAttribute('d', pathD);
                
                // Update min/max labels and indicators
                document.querySelector('.chart-min').textContent = `Min: ${minValue.toFixed(1)}mm`;
                document.querySelector('.chart-max').textContent = `Max: ${maxValue.toFixed(1)}mm`;
                
                // Update Y-axis labels based on data range
                const yLabels = document.querySelectorAll('.chart-labels-y');
                const step = (maxValue - minValue) / 4;
                yLabels.forEach((label, index) => {
                    const value = (maxValue - (step * index)).toFixed(1);
                    label.textContent = `${value}mm`;
                });

                // Update bottom day labels to match cards
                const dayNames = Array.from(document.querySelectorAll('.weather-card .day-name')).map(el => el.textContent.trim());
                const bottomLabels = document.querySelectorAll('.chart-labels span');
                bottomLabels.forEach((el, i) => {
                    if (dayNames[i]) el.textContent = dayNames[i];
                });

                // Refresh persistent data labels after updating dots
                updateDataLabelsFromDots();
            }

            function updateStatistics() {
                // Calculate and update statistics
                const precipitationValues = Array.from(document.querySelectorAll('.precipitation'))
                    .map(el => parseFloat(el.textContent));
                
                const average = (precipitationValues.reduce((a, b) => a + b, 0) / precipitationValues.length).toFixed(1);
                const wetDays = precipitationValues.filter(val => val > 0.5).length; // Consider >0.5mm as wet
                const maxValue = Math.max(...precipitationValues);
                const minValue = Math.min(...precipitationValues);
                const maxDayIndices = precipitationValues.map((val, idx) => val === maxValue ? idx : -1).filter(idx => idx !== -1);
                
                const dayNames = ['Tomorrow', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const peakDays = maxDayIndices.map(idx => dayNames[idx]).join(' and ');
                
                // Determine overall variability range
                const minType = getRainType(minValue);
                const maxType = getRainType(maxValue);
                let variabilityText = minType;
                if (minType !== maxType) {
                    variabilityText = `${minType} to ${maxType}`;
                }
                
                // Update stat cards
                document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = `${average}mm`;
                document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = peakDays;
                document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = wetDays;
                document.querySelector('.stat-card:nth-child(4) .stat-value').textContent = variabilityText;
            }

            // Initialize chart from current weather card values on load
            updateChart();
            updateBackgroundFromActiveCard();
        });