// Bug Fights - App Initialization & UI Controls
// Camera control, sound toggle, debug overlay, and DOMContentLoaded init

// ============================================
// CAMERA CONTROL
// ============================================

function setCamera(preset: string): void {
    window.BugFightsRenderer3D.setCameraPreset(preset);

    // Update button states
    document.querySelectorAll('.camera-btn').forEach(btn => btn.classList.remove('active'));
    const btnId = 'cam-' + (preset === 'isometric' ? 'iso' : preset);
    document.getElementById(btnId)?.classList.add('active');
}

// ============================================
// SOUND TOGGLE
// ============================================

function toggleSound(): void {
    if (window.BugFightsSound) {
        window.BugFightsSound.init(); // Ensure initialized
        const muted = window.BugFightsSound.toggleMute();
        const btn = document.getElementById('sound-toggle');
        if (btn) {
            btn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
            btn.classList.toggle('active', !muted);
        }
    }
}

// ============================================
// DEBUG OVERLAY
// ============================================

let debugEnabled = false;

function toggleDebugOverlay(): void {
    debugEnabled = !debugEnabled;
    const overlay = document.getElementById('debug-overlay');
    const btn = document.getElementById('debug-toggle');

    if (overlay) overlay.style.display = debugEnabled ? 'flex' : 'none';
    if (btn) btn.classList.toggle('active', debugEnabled);
}

function updateDebugOverlay(state: GameState): void {
    if (!debugEnabled || !state || !state.fighters) return;

    state.fighters.forEach((fighter: FighterState, idx: number) => {
        const i = idx + 1;

        // AI State with color
        const aiStateEl = document.getElementById(`dbg${i}-aistate`);
        if (aiStateEl) {
            aiStateEl.textContent = fighter.aiState || '-';
            aiStateEl.className = 'debug-value state-' + (fighter.aiState || 'idle');
        }

        // Animation state
        const animStateEl = document.getElementById(`dbg${i}-animstate`);
        if (animStateEl) {
            animStateEl.textContent = fighter.state || '-';
        }

        // Stun timer
        const stunEl = document.getElementById(`dbg${i}-stun`);
        if (stunEl) stunEl.textContent = String(fighter.stunTimer || 0);

        // Determine action based on velocity and state
        let action = 'idle';
        const speed = Math.sqrt(fighter.vx * fighter.vx + (fighter.vz || 0) * (fighter.vz || 0));
        if (fighter.state === 'attack') action = 'attacking';
        else if (fighter.state === 'hit') action = 'hit';
        else if (fighter.isKnockedBack) action = 'knocked back';
        else if (speed > 2) {
            const facingX = Math.sin(fighter.facingAngle || 0);
            const facingZ = Math.cos(fighter.facingAngle || 0);
            const dot = fighter.vx * facingX + (fighter.vz || 0) * facingZ;
            if (dot > 0.5) action = 'advancing';
            else if (dot < -0.5) action = 'retreating';
            else action = 'strafing';
        }
        const actionEl = document.getElementById(`dbg${i}-action`);
        if (actionEl) actionEl.textContent = action;

        // Facing angle in degrees
        const facingDeg = ((fighter.facingAngle || 0) * 180 / Math.PI).toFixed(0);
        const facingEl = document.getElementById(`dbg${i}-facing`);
        if (facingEl) facingEl.textContent = `${facingDeg}°`;

        // Position
        const posEl = document.getElementById(`dbg${i}-pos`);
        if (posEl) {
            posEl.textContent = `${fighter.x.toFixed(0)}, ${fighter.y.toFixed(0)}, ${(fighter.z || 0).toFixed(0)}`;
        }

        // Velocity
        const velMag = Math.sqrt(fighter.vx * fighter.vx + fighter.vy * fighter.vy + (fighter.vz || 0) * (fighter.vz || 0));
        const velEl = document.getElementById(`dbg${i}-vel`);
        if (velEl) velEl.textContent = velMag.toFixed(1);

        // Stamina bar
        const staminaPct = (fighter.stamina / fighter.maxStamina) * 100;
        const staminaBar = document.getElementById(`dbg${i}-stamina-bar`) as HTMLElement | null;
        if (staminaBar) staminaBar.style.width = staminaPct + '%';

        // Drive bars
        const aggrPct = (fighter.drives?.aggression || 0) * 100;
        const cautPct = (fighter.drives?.caution || 0) * 100;
        const aggrBar = document.getElementById(`dbg${i}-aggr-bar`) as HTMLElement | null;
        const cautBar = document.getElementById(`dbg${i}-caut-bar`) as HTMLElement | null;
        if (aggrBar) aggrBar.style.width = aggrPct + '%';
        if (cautBar) cautBar.style.width = cautPct + '%';

        // Grounded / On Wall
        const groundedEl = document.getElementById(`dbg${i}-grounded`);
        if (groundedEl) groundedEl.textContent = fighter.grounded ? 'YES' : 'NO';
        const wallEl = document.getElementById(`dbg${i}-wall`);
        if (wallEl) wallEl.textContent = fighter.onWall ? (fighter.wallSide || 'YES') : 'NO';
    });
}

function hookDebugOverlay(): void {
    if (window.BugFightsClient) {
        // Poll for state changes to update debug
        setInterval(() => {
            if (debugEnabled && window.BugFightsClient) {
                const state = window.BugFightsClient.getState();
                if (state) updateDebugOverlay(state);
            }
        }, 100);
    }
}

// ============================================
// INITIALIZATION
// ============================================

let roster3DViewer: Roster3DViewer;

document.addEventListener('DOMContentLoaded', () => {
    window.BugFightsClient.init();
    window.BugFightsRenderer3D.init();
    roster3DViewer = new Roster3DViewer();
    hookDebugOverlay();
});
