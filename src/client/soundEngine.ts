// Bug Fights - Procedural Sound Engine
// All sounds generated via Web Audio API - no audio files needed

interface AmbientNodes {
    osc: OscillatorNode;
    gain: GainNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
    noise: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    noiseGain: GainNode;
}

interface WingBuzzNodes {
    osc: OscillatorNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
    filter: BiquadFilterNode;
    gain: GainNode;
}

interface SkitterNodes {
    noise: AudioBufferSourceNode;
    hpf: BiquadFilterNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
    modGain: GainNode;
    gain: GainNode;
}

const BugFightsSound: BugFightsSoundAPI = (() => {
    let ctx: AudioContext | null = null;
    let masterGain: GainNode | null = null;
    let muted: boolean = false;
    let volume: number = 0.5;
    let initialized: boolean = false;
    let noiseBuffer: AudioBuffer | null = null;

    // Continuous sound tracking
    let ambientNodes: AmbientNodes | null = null;
    let wingBuzzNodes: [WingBuzzNodes | null, WingBuzzNodes | null] = [null, null];
    let skitterNodes: [SkitterNodes | null, SkitterNodes | null] = [null, null];
    let lastPhase: GamePhase | null = null;

    // ============================================
    // INITIALIZATION
    // ============================================

    function init(): void {
        if (initialized) return;
        try {
            ctx = new AudioContext();
            masterGain = ctx.createGain();
            masterGain.gain.value = volume;
            masterGain.connect(ctx.destination);

            // Pre-generate noise buffer (1 second)
            const sampleRate: number = ctx.sampleRate;
            const bufferSize: number = sampleRate;
            noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
            const data: Float32Array = noiseBuffer.getChannelData(0);
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

    function ensureContext(): boolean {
        if (!ctx) return false;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        return initialized && !muted;
    }

    // ============================================
    // UTILITY
    // ============================================

    function createNoiseBurst(
        duration: number,
        filterFreq: number,
        filterQ: number,
        filterType: BiquadFilterType,
        gainValue: number,
        decayTime: number
    ): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        const source: AudioBufferSourceNode = ctx!.createBufferSource();
        source.buffer = noiseBuffer;

        const filter: BiquadFilterNode = ctx!.createBiquadFilter();
        filter.type = filterType || 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = filterQ || 3;

        const gain: GainNode = ctx!.createGain();
        gain.gain.setValueAtTime(gainValue * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain!);

        source.start(now);
        source.stop(now + duration);
    }

    function createTone(
        freq: number,
        type: OscillatorType,
        gainValue: number,
        attack: number,
        decay: number,
        duration: number
    ): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        const osc: OscillatorNode = ctx!.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = freq;

        const gain: GainNode = ctx!.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(gainValue * volume, now + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

        osc.connect(gain);
        gain.connect(masterGain!);

        osc.start(now);
        osc.stop(now + duration);
    }

    // ============================================
    // ONE-SHOT SOUNDS
    // ============================================

    function playHitInternal(damage: number, isCrit: boolean, isPoison: boolean): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        // Scale based on damage (typical range 5-40)
        const intensity: number = Math.min(1, damage / 35);

        // Impact noise burst
        const source: AudioBufferSourceNode = ctx!.createBufferSource();
        source.buffer = noiseBuffer;

        const filter: BiquadFilterNode = ctx!.createBiquadFilter();
        filter.type = 'bandpass';
        if (isPoison) {
            filter.frequency.value = 900;
            filter.Q.value = 8;
        } else {
            // Lower pitch = harder hit
            filter.frequency.value = 600 - intensity * 400;
            filter.Q.value = isCrit ? 2 : 4;
        }

        const gain: GainNode = ctx!.createGain();
        const vol: number = (0.35 + intensity * 0.35) * volume;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.3 : 0.18));

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain!);

        source.start(now);
        source.stop(now + 0.4);

        // Crit: add sub-bass thump
        if (isCrit) {
            const osc: OscillatorNode = ctx!.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

            const critGain: GainNode = ctx!.createGain();
            critGain.gain.setValueAtTime(0.35 * volume, now);
            critGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(critGain);
            critGain.connect(masterGain!);
            osc.start(now);
            osc.stop(now + 0.4);
        }

        // Poison: add sizzle
        if (isPoison) {
            const sizzle: AudioBufferSourceNode = ctx!.createBufferSource();
            sizzle.buffer = noiseBuffer;
            sizzle.playbackRate.value = 2.0;

            const hpf: BiquadFilterNode = ctx!.createBiquadFilter();
            hpf.type = 'highpass';
            hpf.frequency.value = 4000;

            const sizzleGain: GainNode = ctx!.createGain();
            sizzleGain.gain.setValueAtTime(0.15 * volume, now);
            sizzleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            sizzle.connect(hpf);
            hpf.connect(sizzleGain);
            sizzleGain.connect(masterGain!);
            sizzle.start(now);
            sizzle.stop(now + 0.35);
        }
    }

    function playHit(data: HitEventData): void {
        playHitInternal(data.damage || 5, !!data.isCrit, !!data.isPoison);
    }

    function playDodge(): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        // Quick whoosh - noise with sweeping bandpass
        const source: AudioBufferSourceNode = ctx!.createBufferSource();
        source.buffer = noiseBuffer;
        source.playbackRate.value = 1.5;

        const filter: BiquadFilterNode = ctx!.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(3000, now + 0.08);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        filter.Q.value = 5;

        const gain: GainNode = ctx!.createGain();
        gain.gain.setValueAtTime(0.35 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain!);

        source.start(now);
        source.stop(now + 0.25);
    }

    function playFeint(result: string): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        // Quick sharp snap - short noise click
        const source: AudioBufferSourceNode = ctx!.createBufferSource();
        source.buffer = noiseBuffer;

        const filter: BiquadFilterNode = ctx!.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        const gain: GainNode = ctx!.createGain();
        gain.gain.setValueAtTime(0.25 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain!);

        source.start(now);
        source.stop(now + 0.12);

        // If target was baited: add a quick descending tone (gotcha!)
        if (result === 'dodge-bait' || result === 'flinch') {
            const osc: OscillatorNode = ctx!.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now + 0.03);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

            const baitGain: GainNode = ctx!.createGain();
            baitGain.gain.setValueAtTime(0.2 * volume, now + 0.03);
            baitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(baitGain);
            baitGain.connect(masterGain!);
            osc.start(now + 0.03);
            osc.stop(now + 0.25);
        }
    }

    function playWallImpactInternal(velocity: number): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;
        const intensity: number = Math.min(1, velocity / 12);

        // Heavy thud - low-pass filtered noise
        const source: AudioBufferSourceNode = ctx!.createBufferSource();
        source.buffer = noiseBuffer;

        const filter: BiquadFilterNode = ctx!.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200 + intensity * 200;
        filter.Q.value = 1;

        const gain: GainNode = ctx!.createGain();
        gain.gain.setValueAtTime((0.25 + intensity * 0.3) * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + intensity * 0.15);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain!);

        source.start(now);
        source.stop(now + 0.5);

        // Sub-bass for heavy impacts
        if (intensity > 0.4) {
            const osc: OscillatorNode = ctx!.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 40 + intensity * 20;

            const subGain: GainNode = ctx!.createGain();
            subGain.gain.setValueAtTime(0.3 * intensity * volume, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            osc.connect(subGain);
            subGain.connect(masterGain!);
            osc.start(now);
            osc.stop(now + 0.35);
        }
    }

    function playWallImpact(data: WallImpactEventData): void {
        playWallImpactInternal(data.velocity || 5);
    }

    function playMiss(): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        // Light whoosh - quick and thin
        const source: AudioBufferSourceNode = ctx!.createBufferSource();
        source.buffer = noiseBuffer;
        source.playbackRate.value = 2.0;

        const filter: BiquadFilterNode = ctx!.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, now);
        filter.frequency.exponentialRampToValueAtTime(2000, now + 0.06);
        filter.Q.value = 8;

        const gain: GainNode = ctx!.createGain();
        gain.gain.setValueAtTime(0.15 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain!);

        source.start(now);
        source.stop(now + 0.12);
    }

    function playFightStart(): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        // Bell/gong - sine + harmonics
        const freqs: number[] = [440, 880, 1320];
        const gains: number[] = [0.18, 0.1, 0.06];

        freqs.forEach((freq: number, i: number) => {
            const osc: OscillatorNode = ctx!.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain: GainNode = ctx!.createGain();
            const gainVal: number | undefined = gains[i];
            gain.gain.setValueAtTime((gainVal !== undefined ? gainVal : 0.1) * volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            osc.connect(gain);
            gain.connect(masterGain!);
            osc.start(now);
            osc.stop(now + 1.8);
        });

        // Metallic hit component
        createNoiseBurst(0.3, 3000, 10, 'bandpass', 0.1, 0.15);
    }

    function playCountdown(_count: number): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        // Short beep
        const osc: OscillatorNode = ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 660;

        const gain: GainNode = ctx!.createGain();
        gain.gain.setValueAtTime(0.15 * volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(masterGain!);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    function playVictory(): void {
        if (!ensureContext()) return;
        const now: number = ctx!.currentTime;

        // Triumphant major chord: C5, E5, G5
        const chord: number[] = [523, 659, 784];

        chord.forEach((freq: number, i: number) => {
            const osc: OscillatorNode = ctx!.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;

            const gain: GainNode = ctx!.createGain();
            gain.gain.setValueAtTime(0, now + i * 0.08);
            gain.gain.linearRampToValueAtTime(0.12 * volume, now + i * 0.08 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

            osc.connect(gain);
            gain.connect(masterGain!);
            osc.start(now);
            osc.stop(now + 2.5);
        });

        // Add octave root for fullness
        const root: OscillatorNode = ctx!.createOscillator();
        root.type = 'sine';
        root.frequency.value = 262; // C4

        const rootGain: GainNode = ctx!.createGain();
        rootGain.gain.setValueAtTime(0, now + 0.15);
        rootGain.gain.linearRampToValueAtTime(0.08 * volume, now + 0.2);
        rootGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

        root.connect(rootGain);
        rootGain.connect(masterGain!);
        root.start(now);
        root.stop(now + 3.0);
    }

    // ============================================
    // CONTINUOUS SOUNDS
    // ============================================

    function startAmbient(): void {
        if (!ensureContext() || ambientNodes) return;

        // Low drone - barely audible atmosphere
        const osc: OscillatorNode = ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 55; // Low A

        const gain: GainNode = ctx!.createGain();
        gain.gain.value = 0.04 * volume;

        // Subtle LFO for movement
        const lfo: OscillatorNode = ctx!.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;
        const lfoGain: GainNode = ctx!.createGain();
        lfoGain.gain.value = 3;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(gain);
        gain.connect(masterGain!);

        osc.start();
        lfo.start();

        // Very soft filtered noise for texture
        const noise: AudioBufferSourceNode = ctx!.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const noiseFilter: BiquadFilterNode = ctx!.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 200;

        const noiseGain: GainNode = ctx!.createGain();
        noiseGain.gain.value = 0.02 * volume;

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain!);
        noise.start();

        ambientNodes = { osc, gain, lfo, lfoGain, noise, noiseFilter, noiseGain };
    }

    function stopAmbient(): void {
        if (!ambientNodes) return;
        try {
            ambientNodes.osc.stop();
            ambientNodes.lfo.stop();
            ambientNodes.noise.stop();
        } catch (e) { /* already stopped */ }
        ambientNodes = null;
    }

    function updateWingBuzz(bugIndex: number, isFlying: boolean, grounded: boolean, speed: number): void {
        if (!ensureContext()) return;

        const shouldBuzz: boolean = isFlying && !grounded;
        const node: WingBuzzNodes | null | undefined = wingBuzzNodes[bugIndex];

        if (shouldBuzz && !node) {
            // Start wing buzz
            const osc: OscillatorNode = ctx!.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 110 + speed * 0.5;

            // LFO for wing flapping
            const lfo: OscillatorNode = ctx!.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 20 + speed * 0.3;
            const lfoGain: GainNode = ctx!.createGain();
            lfoGain.gain.value = 30 + speed * 0.2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            // Filter to soften
            const filter: BiquadFilterNode = ctx!.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            filter.Q.value = 2;

            const gain: GainNode = ctx!.createGain();
            gain.gain.value = 0.06 * volume;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain!);

            osc.start();
            lfo.start();

            wingBuzzNodes[bugIndex as 0 | 1] = { osc, lfo, lfoGain, filter, gain };

        } else if (!shouldBuzz && node) {
            // Stop wing buzz
            try {
                node.osc.stop();
                node.lfo.stop();
            } catch (e) { /* already stopped */ }
            wingBuzzNodes[bugIndex as 0 | 1] = null;

        } else if (shouldBuzz && node) {
            // Update buzz parameters based on speed
            const speedMag: number = Math.sqrt(speed);
            node.osc.frequency.value = 110 + speedMag * 15;
            node.lfo.frequency.value = 20 + speedMag * 5;
            node.gain.gain.value = Math.min(0.1, 0.04 + speedMag * 0.01) * volume;
        }
    }

    function updateSkitter(bugIndex: number, grounded: boolean, speed: number, isFlying: boolean): void {
        if (!ensureContext()) return;

        // Skitter when grounded and moving (not flying bugs)
        const shouldSkitter: boolean = grounded && !isFlying && speed > 1.5;
        const node: SkitterNodes | null | undefined = skitterNodes[bugIndex];

        if (shouldSkitter && !node) {
            // High-pass filtered noise for chitinous tapping
            const noise: AudioBufferSourceNode = ctx!.createBufferSource();
            noise.buffer = noiseBuffer;
            noise.loop = true;

            const hpf: BiquadFilterNode = ctx!.createBiquadFilter();
            hpf.type = 'highpass';
            hpf.frequency.value = 3000;
            hpf.Q.value = 2;

            // Rapid amplitude modulation = individual "taps"
            const lfo: OscillatorNode = ctx!.createOscillator();
            lfo.type = 'square';
            lfo.frequency.value = 12 + speed * 2;
            const lfoGain: GainNode = ctx!.createGain();
            lfoGain.gain.value = 1;
            const modGain: GainNode = ctx!.createGain();
            modGain.gain.value = 0;
            lfo.connect(lfoGain);
            lfoGain.connect(modGain.gain);

            // Output gain
            const gain: GainNode = ctx!.createGain();
            gain.gain.value = 0.08 * volume;

            noise.connect(hpf);
            hpf.connect(modGain);
            modGain.connect(gain);
            gain.connect(masterGain!);

            noise.start();
            lfo.start();

            skitterNodes[bugIndex as 0 | 1] = { noise, hpf, lfo, lfoGain, modGain, gain };

        } else if (!shouldSkitter && node) {
            try {
                node.noise.stop();
                node.lfo.stop();
            } catch (e) { /* already stopped */ }
            skitterNodes[bugIndex as 0 | 1] = null;

        } else if (shouldSkitter && node) {
            // Update rate and volume based on speed
            const speedFactor: number = Math.min(speed / 8, 1);
            node.lfo.frequency.value = 12 + speed * 2;
            node.gain.gain.value = (0.05 + speedFactor * 0.08) * volume;
        }
    }

    // ============================================
    // UPDATE (called each frame from renderer)
    // ============================================

    function update(fighters: FighterState[]): void {
        if (!initialized || !fighters) return;

        // Initialize on first state update (user has interacted)
        if (!ctx) {
            init();
            return;
        }

        // Update wing buzzes and skitter during fights
        if (fighters.length >= 2) {
            fighters.forEach((f: FighterState, i: number) => {
                const speed: number = Math.sqrt(
                    (f.vx || 0) * (f.vx || 0) +
                    (f.vy || 0) * (f.vy || 0) +
                    (f.vz || 0) * (f.vz || 0)
                );
                // Wing buzz and skitter disabled - too grating, needs rework
                // updateWingBuzz(i, f.isFlying, f.grounded, speed);
                // updateSkitter(i, f.grounded, speed, f.isFlying);
                void speed; // suppress unused variable warning
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

    function handleEvent(event: GameEvent): void {
        if (!ensureContext()) return;

        if (event.type === 'hit') {
            playHitInternal(event.data.damage || 5, !!event.data.isCrit, !!event.data.isPoison);
        } else if (event.type === 'wallImpact') {
            playWallImpactInternal(event.data.velocity || 5);
        } else if (event.type === 'feint') {
            playFeint(event.data.result);
        } else if (event.type === 'commentary') {
            const text: string = typeof event.data === 'string' ? event.data : '';
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

    function setMuted(m: boolean): void {
        muted = m;
        if (masterGain) {
            masterGain.gain.value = muted ? 0 : volume;
        }
        // Stop continuous sounds when muted
        if (muted) {
            wingBuzzNodes.forEach((_: WingBuzzNodes | null, i: number) => updateWingBuzz(i, false, true, 0));
            skitterNodes.forEach((_: SkitterNodes | null, i: number) => updateSkitter(i, false, 0, false));
        }
    }

    function setVolume(v: number): void {
        volume = Math.max(0, Math.min(1, v));
        if (masterGain && !muted) {
            masterGain.gain.value = volume;
        }
    }

    function toggleMute(): boolean {
        setMuted(!muted);
        return muted;
    }

    function isMuted(): boolean {
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
