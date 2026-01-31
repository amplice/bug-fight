// Bug Fights - Procedural Sound Engine
// All sounds generated via Web Audio API - no audio files needed

const BugFightsSound = (() => {
    let ctx = null;
    let masterGain = null;
    let muted = false;
    let volume = 0.5;
    let initialized = false;
    let noiseBuffer = null;

    // Continuous sound tracking
    let ambientNodes = null;
    let wingBuzzNodes = [null, null];
    let skitterNodes = [null, null];
    let lastPhase = null;

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        if (initialized) return;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = volume;
            masterGain.connect(ctx.destination);

            // Pre-generate noise buffer (1 second)
            const sampleRate = ctx.sampleRate;
            const bufferSize = sampleRate;
            noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            initialized = true;
            startAmbient();
            console.log('Sound engine initialized');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    function ensureContext() {
        if (!ctx) return false;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        return initialized && !muted;
    }

    // ============================================
    // UTILITY
    // ============================================

    function createNoiseBurst(duration, filterFreq, filterQ, filterType, gainValue, decayTime) {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = filterType || 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = filterQ || 3;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(gainValue * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        source.start(now);
        source.stop(now + duration);
    }

    function createTone(freq, type, gainValue, attack, decay, duration) {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = freq;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(gainValue * volume, now + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + duration);
    }

    // ============================================
    // ONE-SHOT SOUNDS
    // ============================================

    function playHit(damage, isCrit, isPoison) {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        // Scale based on damage (typical range 5-40)
        const intensity = Math.min(1, damage / 35);

        // Impact noise burst
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        if (isPoison) {
            filter.frequency.value = 900;
            filter.Q.value = 8;
        } else {
            // Lower pitch = harder hit
            filter.frequency.value = 600 - intensity * 400;
            filter.Q.value = isCrit ? 2 : 4;
        }

        const gain = ctx.createGain();
        const vol = (0.35 + intensity * 0.35) * volume;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.3 : 0.18));

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        source.start(now);
        source.stop(now + 0.4);

        // Crit: add sub-bass thump
        if (isCrit) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

            const critGain = ctx.createGain();
            critGain.gain.setValueAtTime(0.35 * volume, now);
            critGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(critGain);
            critGain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.4);
        }

        // Poison: add sizzle
        if (isPoison) {
            const sizzle = ctx.createBufferSource();
            sizzle.buffer = noiseBuffer;
            sizzle.playbackRate.value = 2.0;

            const hpf = ctx.createBiquadFilter();
            hpf.type = 'highpass';
            hpf.frequency.value = 4000;

            const sizzleGain = ctx.createGain();
            sizzleGain.gain.setValueAtTime(0.15 * volume, now);
            sizzleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            sizzle.connect(hpf);
            hpf.connect(sizzleGain);
            sizzleGain.connect(masterGain);
            sizzle.start(now);
            sizzle.stop(now + 0.35);
        }
    }

    function playDodge() {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        // Quick whoosh - noise with sweeping bandpass
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.playbackRate.value = 1.5;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(3000, now + 0.08);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        filter.Q.value = 5;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        source.start(now);
        source.stop(now + 0.25);
    }

    function playFeint(result) {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        // Quick sharp snap - short noise click
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        source.start(now);
        source.stop(now + 0.12);

        // If target was baited: add a quick descending tone (gotcha!)
        if (result === 'dodge-bait' || result === 'flinch') {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now + 0.03);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

            const baitGain = ctx.createGain();
            baitGain.gain.setValueAtTime(0.2 * volume, now + 0.03);
            baitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(baitGain);
            baitGain.connect(masterGain);
            osc.start(now + 0.03);
            osc.stop(now + 0.25);
        }
    }

    function playWallImpact(velocity) {
        if (!ensureContext()) return;
        const now = ctx.currentTime;
        const intensity = Math.min(1, velocity / 12);

        // Heavy thud - low-pass filtered noise
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200 + intensity * 200;
        filter.Q.value = 1;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime((0.25 + intensity * 0.3) * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + intensity * 0.15);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        source.start(now);
        source.stop(now + 0.5);

        // Sub-bass for heavy impacts
        if (intensity > 0.4) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 40 + intensity * 20;

            const subGain = ctx.createGain();
            subGain.gain.setValueAtTime(0.3 * intensity * volume, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            osc.connect(subGain);
            subGain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.35);
        }
    }

    function playMiss() {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        // Light whoosh - quick and thin
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.playbackRate.value = 2.0;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, now);
        filter.frequency.exponentialRampToValueAtTime(2000, now + 0.06);
        filter.Q.value = 8;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        source.start(now);
        source.stop(now + 0.12);
    }

    function playFightStart() {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        // Bell/gong - sine + harmonics
        const freqs = [440, 880, 1320];
        const gains = [0.18, 0.1, 0.06];

        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(gains[i] * volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 1.8);
        });

        // Metallic hit component
        createNoiseBurst(0.3, 3000, 10, 'bandpass', 0.1, 0.15);
    }

    function playCountdown() {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        // Short beep
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 660;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    function playVictory() {
        if (!ensureContext()) return;
        const now = ctx.currentTime;

        // Triumphant major chord: C5, E5, G5
        const chord = [523, 659, 784];

        chord.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now + i * 0.08);
            gain.gain.linearRampToValueAtTime(0.12 * volume, now + i * 0.08 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 2.5);
        });

        // Add octave root for fullness
        const root = ctx.createOscillator();
        root.type = 'sine';
        root.frequency.value = 262; // C4

        const rootGain = ctx.createGain();
        rootGain.gain.setValueAtTime(0, now + 0.15);
        rootGain.gain.linearRampToValueAtTime(0.08 * volume, now + 0.2);
        rootGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

        root.connect(rootGain);
        rootGain.connect(masterGain);
        root.start(now);
        root.stop(now + 3.0);
    }

    // ============================================
    // CONTINUOUS SOUNDS
    // ============================================

    function startAmbient() {
        if (!ensureContext() || ambientNodes) return;

        // Low drone - barely audible atmosphere
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 55; // Low A

        const gain = ctx.createGain();
        gain.gain.value = 0.04 * volume;

        // Subtle LFO for movement
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 3;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start();
        lfo.start();

        // Very soft filtered noise for texture
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 200;

        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.02 * volume;

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        noise.start();

        ambientNodes = { osc, gain, lfo, lfoGain, noise, noiseFilter, noiseGain };
    }

    function stopAmbient() {
        if (!ambientNodes) return;
        try {
            ambientNodes.osc.stop();
            ambientNodes.lfo.stop();
            ambientNodes.noise.stop();
        } catch (e) { /* already stopped */ }
        ambientNodes = null;
    }

    function updateWingBuzz(bugIndex, isFlying, grounded, speed) {
        if (!ensureContext()) return;

        const shouldBuzz = isFlying && !grounded;
        const node = wingBuzzNodes[bugIndex];

        if (shouldBuzz && !node) {
            // Start wing buzz
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 110 + speed * 0.5;

            // LFO for wing flapping
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 20 + speed * 0.3;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 30 + speed * 0.2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // Filter to soften
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            filter.Q.value = 2;

            const gain = ctx.createGain();
            gain.gain.value = 0.06 * volume;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);

            osc.start();
            lfo.start();

            wingBuzzNodes[bugIndex] = { osc, lfo, lfoGain, filter, gain };

        } else if (!shouldBuzz && node) {
            // Stop wing buzz
            try {
                node.osc.stop();
                node.lfo.stop();
            } catch (e) { /* already stopped */ }
            wingBuzzNodes[bugIndex] = null;

        } else if (shouldBuzz && node) {
            // Update buzz parameters based on speed
            const speedMag = Math.sqrt(speed);
            node.osc.frequency.value = 110 + speedMag * 15;
            node.lfo.frequency.value = 20 + speedMag * 5;
            node.gain.gain.value = Math.min(0.1, 0.04 + speedMag * 0.01) * volume;
        }
    }

    function updateSkitter(bugIndex, grounded, speed, isFlying) {
        if (!ensureContext()) return;

        // Skitter when grounded and moving (not flying bugs)
        const shouldSkitter = grounded && !isFlying && speed > 1.5;
        const node = skitterNodes[bugIndex];

        if (shouldSkitter && !node) {
            // High-pass filtered noise for chitinous tapping
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            noise.loop = true;

            const hpf = ctx.createBiquadFilter();
            hpf.type = 'highpass';
            hpf.frequency.value = 3000;
            hpf.Q.value = 2;

            // Rapid amplitude modulation = individual "taps"
            const lfo = ctx.createOscillator();
            lfo.type = 'square';
            lfo.frequency.value = 12 + speed * 2;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 1;
            const modGain = ctx.createGain();
            modGain.gain.value = 0;
            lfo.connect(lfoGain);
            lfoGain.connect(modGain.gain);

            // Output gain
            const gain = ctx.createGain();
            gain.gain.value = 0.08 * volume;

            noise.connect(hpf);
            hpf.connect(modGain);
            modGain.connect(gain);
            gain.connect(masterGain);

            noise.start();
            lfo.start();

            skitterNodes[bugIndex] = { noise, hpf, lfo, lfoGain, modGain, gain };

        } else if (!shouldSkitter && node) {
            try {
                node.noise.stop();
                node.lfo.stop();
            } catch (e) { /* already stopped */ }
            skitterNodes[bugIndex] = null;

        } else if (shouldSkitter && node) {
            // Update rate and volume based on speed
            const speedFactor = Math.min(speed / 8, 1);
            node.lfo.frequency.value = 12 + speed * 2;
            node.gain.gain.value = (0.05 + speedFactor * 0.08) * volume;
        }
    }

    // ============================================
    // UPDATE (called each frame from renderer)
    // ============================================

    function update(state) {
        if (!initialized || !state) return;

        // Initialize on first state update (user has interacted)
        if (!ctx) {
            init();
            return;
        }

        // Phase change sounds
        if (lastPhase !== state.phase) {
            if (state.phase === 'fighting' && lastPhase === 'countdown') {
                playFightStart();
            }
            if (state.phase === 'victory') {
                playVictory();
                // Stop wing buzzes and skitter
                wingBuzzNodes.forEach((_, i) => updateWingBuzz(i, false, true, 0));
                skitterNodes.forEach((_, i) => updateSkitter(i, false, 0, false));
            }
            lastPhase = state.phase;
        }

        // Countdown beeps
        if (state.phase === 'countdown' && state.countdown <= 3 && state.countdown > 0) {
            // Only beep once per countdown number (check events)
            if (state.events) {
                state.events.forEach(e => {
                    if (e.type === 'commentary' && e.data && typeof e.data === 'string' && e.data.match(/^\d\.\.\./)) {
                        playCountdown();
                    }
                });
            }
        }

        // Update wing buzzes and skitter during fights
        if (state.phase === 'fighting' && state.fighters && state.fighters.length >= 2) {
            state.fighters.forEach((f, i) => {
                const speed = Math.sqrt(
                    (f.vx || 0) * (f.vx || 0) +
                    (f.vy || 0) * (f.vy || 0) +
                    (f.vz || 0) * (f.vz || 0)
                );
                // Wing buzz and skitter disabled - too grating, needs rework
                // updateWingBuzz(i, f.isFlying, f.grounded, speed);
                // updateSkitter(i, f.grounded, speed, f.isFlying);
            });
        }

        // Update ambient volume
        if (ambientNodes) {
            ambientNodes.gain.gain.value = 0.04 * volume;
            ambientNodes.noiseGain.gain.value = 0.02 * volume;
        }
    }

    // ============================================
    // EVENT HANDLER (called from renderer processEvents)
    // ============================================

    function handleEvent(event) {
        if (!ensureContext()) return;

        if (event.type === 'hit') {
            playHit(event.data.damage || 5, event.data.isCrit, event.data.isPoison);
        } else if (event.type === 'wallImpact') {
            playWallImpact(event.data.velocity || 5);
        } else if (event.type === 'feint') {
            playFeint(event.data.result);
        } else if (event.type === 'commentary') {
            const text = typeof event.data === 'string' ? event.data : '';
            if (text.includes('dodges!')) {
                playDodge();
            } else if (text.includes('misses!')) {
                playMiss();
            } else if (text === 'FIGHT!') {
                playFightStart();
            }
        }
    }

    // ============================================
    // CONTROLS
    // ============================================

    function setMuted(m) {
        muted = m;
        if (masterGain) {
            masterGain.gain.value = muted ? 0 : volume;
        }
        // Stop continuous sounds when muted
        if (muted) {
            wingBuzzNodes.forEach((_, i) => updateWingBuzz(i, false, true, 0));
            skitterNodes.forEach((_, i) => updateSkitter(i, false, 0, false));
        }
    }

    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        if (masterGain && !muted) {
            masterGain.gain.value = volume;
        }
    }

    function toggleMute() {
        setMuted(!muted);
        return muted;
    }

    function isMuted() {
        return muted;
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        init,
        update,
        handleEvent,
        setMuted,
        setVolume,
        toggleMute,
        isMuted,
        // Direct access for testing
        playHit,
        playDodge,
        playFeint,
        playWallImpact,
        playMiss,
        playFightStart,
        playVictory,
        playCountdown,
    };
})();

// Export
window.BugFightsSound = BugFightsSound;
