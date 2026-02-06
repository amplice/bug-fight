// Bug Fights - Client
// Connects to server, receives state, manages betting

// ============================================
// CONNECTION
// ============================================

let ws: WebSocket | null = null;
let connected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

// Game state received from server
let gameState: GameState = {
    phase: 'countdown',
    countdown: 10,
    tick: 0,
    fightNumber: 0,
    fighters: [],
    bugs: [],
    bugNames: [],
    bugRecords: [],
    odds: { fighter1: '1.00', fighter2: '1.00', american1: 0, american2: 0, prob1: 50, prob2: 50 },
    events: [],
    winner: null,
};

// Local betting state
let player = {
    money: parseInt(localStorage.getItem('bugfights_money') || '1000') || 1000,
};
let currentBet: { amount: number; on: number | null } = { amount: 0, on: null };
// Odds format preference
let oddsFormat: 'decimal' | 'american' = (localStorage.getItem('bugfights_odds_format') as 'decimal' | 'american') || 'decimal';

// Multi-listener pattern for state updates
let stateListeners: Array<(state: GameState) => void> = [];
let onEvent: ((event: GameEvent) => void) | null = null;

function addStateListener(cb: (state: GameState) => void): () => void {
    stateListeners.push(cb);
    return () => {
        stateListeners = stateListeners.filter(l => l !== cb);
    };
}

function connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log('Connecting to', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = (): void => {
        console.log('Connected to server');
        connected = true;
        reconnectAttempts = 0;
        updateConnectionStatus(true);
    };

    ws.onmessage = (event: MessageEvent): void => {
        try {
            const data: WSServerMessage = JSON.parse(event.data);
            handleMessage(data);
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    };

    ws.onclose = (): void => {
        console.log('Disconnected from server');
        connected = false;
        updateConnectionStatus(false);

        // Reconnect with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(connect, delay);
        } else {
            console.error('Max reconnect attempts reached. Refresh the page to reconnect.');
            updateConnectionStatus(false, true);
        }
    };

    ws.onerror = (): void => {
        console.error('WebSocket error');
    };
}

function handleMessage(data: WSServerMessage): void {
    switch (data.type) {
        case 'init':
        case 'state':
            updateGameState(data.state);
            break;
        default:
            console.log('Unknown message type:', (data as { type: string }).type);
    }
}

function updateGameState(state: GameState): void {
    gameState = state;

    // Process events
    if (state.events && state.events.length > 0) {
        state.events.forEach(event => {
            processEvent(event);
        });
    }

    // Update UI
    updateUI();

    // Notify all listeners
    stateListeners.forEach(cb => cb(gameState));
}

function processEvent(event: GameEvent): void {
    switch (event.type) {
        case 'commentary':
            addCommentary(event.data, event.color);
            break;
        case 'hit':
        case 'wallImpact':
            if (onEvent) onEvent(event);
            break;
        case 'fightEnd':
            resolveBet(event.data.winner);
            break;
    }
}

// ============================================
// BETTING
// ============================================

function placeBet(which: number): boolean {
    if (gameState.phase !== 'countdown') {
        addCommentary("Betting closed!", '#f00');
        return false;
    }

    const betInput = document.getElementById('bet-amount') as HTMLInputElement | null;
    const amount = parseInt(betInput?.value || '0') || 0;
    if (amount <= 0) {
        addCommentary("Enter a bet amount!", '#f00');
        return false;
    }

    // If switching fighters, refund old bet first
    if (currentBet.amount > 0 && currentBet.on !== which) {
        player.money += currentBet.amount;
        const oldBugName = currentBet.on === 1 ? gameState.bugNames[0] : gameState.bugNames[1];
        addCommentary(`Switched from ${oldBugName}!`, '#ff0');
        currentBet = { amount: 0, on: null };
    }

    if (amount > player.money) {
        addCommentary("Not enough money!", '#f00');
        return false;
    }

    // Add to existing bet on same fighter, or start new bet
    currentBet.amount += amount;
    currentBet.on = which;
    player.money -= amount;
    saveMoney();
    updateUI();

    const bugName = which === 1 ? gameState.bugNames[0] : gameState.bugNames[1];
    addCommentary(`Bet $${amount} on ${bugName}! (Total: $${currentBet.amount})`, '#0f0');

    // Update button states
    document.getElementById('bet-fighter1')?.classList.toggle('selected', which === 1);
    document.getElementById('bet-fighter2')?.classList.toggle('selected', which === 2);

    return true;
}

function resolveBet(winner: number | null): void {
    if (currentBet.amount > 0) {
        if (currentBet.on === winner) {
            // Won!
            const odds = currentBet.on === 1 ? parseFloat(gameState.odds.fighter1) : parseFloat(gameState.odds.fighter2);
            const winnings = Math.floor(currentBet.amount * odds);
            player.money += winnings;
            addCommentary(`WON $${winnings}!`, '#0f0');
        } else if (winner === 0) {
            // Draw - refund
            player.money += currentBet.amount;
            addCommentary('Draw - bet refunded', '#ff0');
        } else {
            // Lost
            addCommentary(`Lost $${currentBet.amount}`, '#f00');
        }

        saveMoney();
    }

    // Reset bet
    currentBet = { amount: 0, on: null };

    // Clear button states
    document.getElementById('bet-fighter1')?.classList.remove('selected');
    document.getElementById('bet-fighter2')?.classList.remove('selected');

    updateUI();
}

function saveMoney(): void {
    localStorage.setItem('bugfights_money', player.money.toString());
}

// ============================================
// UI
// ============================================

let commentary: CommentaryEntry[] = [];

function addCommentary(text: string, color: string = '#fff'): void {
    commentary.unshift({ text, color, age: 0 });
    if (commentary.length > 6) commentary.pop();
}

function updateUI(): void {
    // Money
    const moneyEl = document.getElementById('money');
    if (moneyEl) moneyEl.textContent = String(player.money);

    // Current bet
    const betEl = document.getElementById('current-bet');
    if (betEl) {
        if (currentBet.amount > 0) {
            const name = currentBet.on === 1 ? gameState.bugNames[0] : gameState.bugNames[1];
            betEl.textContent = `$${currentBet.amount} on ${name}`;
        } else {
            betEl.textContent = 'None';
        }
    }

    // Countdown
    const countdownEl = document.getElementById('countdown-timer');
    const countdownDisplay = document.getElementById('countdown-display');
    if (gameState.phase === 'countdown') {
        countdownDisplay?.classList.remove('hidden');
        if (countdownEl) countdownEl.textContent = String(gameState.countdown);
    } else {
        countdownDisplay?.classList.add('hidden');
    }

    // Fighter info
    if (gameState.bugNames.length >= 2) {
        const f1Name = document.getElementById('fighter1-name');
        const f2Name = document.getElementById('fighter2-name');
        if (f1Name) f1Name.textContent = gameState.bugNames[0] ?? '';
        if (f2Name) f2Name.textContent = gameState.bugNames[1] ?? '';
    }

    if (gameState.bugs.length >= 2) {
        const bug1 = gameState.bugs[0]!;
        const bug2 = gameState.bugs[1]!;

        const f1Stats = document.getElementById('fighter1-stats');
        const f2Stats = document.getElementById('fighter2-stats');
        if (f1Stats) {
            f1Stats.innerHTML = `BLK: ${bug1.bulk} | SPD: ${bug1.speed} | FRY: ${bug1.fury} | INS: ${bug1.instinct}`;
        }
        if (f2Stats) {
            f2Stats.innerHTML = `BLK: ${bug2.bulk} | SPD: ${bug2.speed} | FRY: ${bug2.fury} | INS: ${bug2.instinct}`;
        }

        const f1Attrs = document.getElementById('fighter1-attrs');
        const f2Attrs = document.getElementById('fighter2-attrs');
        if (f1Attrs) f1Attrs.innerHTML = formatAttrs(bug1);
        if (f2Attrs) f2Attrs.innerHTML = formatAttrs(bug2);
    }

    // Odds - display in selected format
    const odds = gameState.odds;
    const odds1El = document.getElementById('odds1');
    const odds2El = document.getElementById('odds2');
    if (oddsFormat === 'american') {
        if (odds1El) odds1El.textContent = String(odds.american1);
        if (odds2El) odds2El.textContent = String(odds.american2);
    } else {
        if (odds1El) odds1El.textContent = odds.fighter1 + 'x';
        if (odds2El) odds2El.textContent = odds.fighter2 + 'x';
    }

    // Update odds format button
    const oddsBtn = document.getElementById('odds-format-btn');
    if (oddsBtn) {
        oddsBtn.textContent = oddsFormat === 'american' ? 'AMERICAN' : 'DECIMAL';
    }

    // Bet buttons state
    if (gameState.phase === 'countdown') {
        document.querySelectorAll('.fighter-card').forEach(card => card.classList.remove('disabled'));
    } else {
        document.querySelectorAll('.fighter-card').forEach(card => card.classList.add('disabled'));
    }
}

function formatAttrs(bug: GenomeData): string {
    return `<span class="weapon">${bug.weapon}</span> ` +
           `<span class="defense">${bug.defense}</span> ` +
           `<span class="mobility">${bug.mobility}</span>`;
}

function updateConnectionStatus(isConnected: boolean, gaveUp: boolean = false): void {
    const badge = document.querySelector('.live-badge') as HTMLElement | null;
    if (badge) {
        if (isConnected) {
            badge.textContent = 'LIVE 24/7';
            badge.style.background = 'linear-gradient(180deg, #f00 0%, #900 100%)';
        } else if (gaveUp) {
            badge.textContent = 'OFFLINE';
            badge.style.background = 'linear-gradient(180deg, #800 0%, #400 100%)';
        } else {
            badge.textContent = 'CONNECTING...';
            badge.style.background = 'linear-gradient(180deg, #888 0%, #444 100%)';
        }
    }
}

// ============================================
// INIT
// ============================================

function toggleOddsFormat(): void {
    oddsFormat = oddsFormat === 'decimal' ? 'american' : 'decimal';
    localStorage.setItem('bugfights_odds_format', oddsFormat);
    updateUI();
}

function initClient(): void {
    // Set up bet buttons
    document.getElementById('bet-fighter1')?.addEventListener('click', () => placeBet(1));
    document.getElementById('bet-fighter2')?.addEventListener('click', () => placeBet(2));

    // Set up odds format toggle
    document.getElementById('odds-format-btn')?.addEventListener('click', toggleOddsFormat);

    // Visitor counter
    let visits = parseInt(localStorage.getItem('bugfights_visits') || '0');
    visits++;
    localStorage.setItem('bugfights_visits', visits.toString());
    const counter = document.getElementById('visitor-count');
    if (counter) {
        counter.textContent = String(visits).padStart(6, '0');
    }

    // Connect to server
    connect();

    // Initial UI update
    updateUI();
}

export const BugFightsClient: BugFightsClientAPI = {
    init: initClient,
    getState: () => gameState,
    getCommentary: () => commentary,
    setOnStateUpdate: (cb) => {
        // Backwards compat: register as a listener
        if (cb) {
            addStateListener(cb);
        }
    },
    setOnEvent: (cb) => { onEvent = cb; },
    addCommentary: addCommentary,
    addStateListener: addStateListener,
};
