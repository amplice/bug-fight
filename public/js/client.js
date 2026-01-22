// Bug Fights - Client
// Connects to server, receives state, manages betting

// ============================================
// CONNECTION
// ============================================

let ws = null;
let connected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000;

// Game state received from server
let gameState = {
    phase: 'countdown',
    countdown: 10,
    tick: 0,
    fightNumber: 0,
    fighters: [],
    bugs: [],
    bugNames: [],
    odds: { fighter1: '1.00', fighter2: '1.00' },
    events: [],
    winner: null,
};

// Local betting state
let player = {
    money: parseInt(localStorage.getItem('bugfights_money')) || 1000,
};
let currentBet = { amount: 0, on: null };
let lastFightNumber = 0;

// Odds format preference
let oddsFormat = localStorage.getItem('bugfights_odds_format') || 'decimal';

// Callbacks for renderer
let onStateUpdate = null;
let onEvent = null;

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
        connected = true;
        reconnectAttempts = 0;
        updateConnectionStatus(true);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        connected = false;
        updateConnectionStatus(false);

        // Try to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttempts})`);
            setTimeout(connect, RECONNECT_DELAY);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function handleMessage(data) {
    switch (data.type) {
        case 'init':
        case 'state':
            updateGameState(data.state);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function updateGameState(state) {
    const previousPhase = gameState.phase;
    const previousFightNumber = gameState.fightNumber;

    gameState = state;

    // New fight started - resolve previous bet and reset
    if (state.fightNumber !== previousFightNumber && previousFightNumber > 0) {
        // This is handled by the fightEnd event
    }

    // Process events
    if (state.events && state.events.length > 0) {
        state.events.forEach(event => {
            processEvent(event);
        });
    }

    // Update UI
    updateUI();

    // Notify renderer
    if (onStateUpdate) {
        onStateUpdate(gameState);
    }
}

function processEvent(event) {
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

function placeBet(which) {
    if (gameState.phase !== 'countdown') {
        addCommentary("Betting closed!", '#f00');
        return false;
    }

    const amount = parseInt(document.getElementById('bet-amount').value) || 0;
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
    document.getElementById('bet-fighter1').classList.toggle('selected', which === 1);
    document.getElementById('bet-fighter2').classList.toggle('selected', which === 2);

    return true;
}

function resolveBet(winner) {
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
    document.getElementById('bet-fighter1').classList.remove('selected');
    document.getElementById('bet-fighter2').classList.remove('selected');

    updateUI();
}

function saveMoney() {
    localStorage.setItem('bugfights_money', player.money.toString());
}

// ============================================
// UI
// ============================================

let commentary = [];

function addCommentary(text, color = '#fff') {
    commentary.unshift({ text, color, age: 0 });
    if (commentary.length > 6) commentary.pop();
}

function updateUI() {
    // Money
    document.getElementById('money').textContent = player.money;

    // Current bet
    if (currentBet.amount > 0) {
        const name = currentBet.on === 1 ? gameState.bugNames[0] : gameState.bugNames[1];
        document.getElementById('current-bet').textContent = `$${currentBet.amount} on ${name}`;
    } else {
        document.getElementById('current-bet').textContent = 'None';
    }

    // Countdown
    const countdownEl = document.getElementById('countdown-timer');
    const countdownDisplay = document.getElementById('countdown-display');
    if (gameState.phase === 'countdown') {
        countdownDisplay.classList.remove('hidden');
        countdownEl.textContent = gameState.countdown;
    } else {
        countdownDisplay.classList.add('hidden');
    }

    // Fighter info
    if (gameState.bugNames.length >= 2) {
        document.getElementById('fighter1-name').textContent = gameState.bugNames[0];
        document.getElementById('fighter2-name').textContent = gameState.bugNames[1];
    }

    if (gameState.bugs.length >= 2) {
        const bug1 = gameState.bugs[0];
        const bug2 = gameState.bugs[1];

        document.getElementById('fighter1-stats').innerHTML =
            `BLK: ${bug1.bulk} | SPD: ${bug1.speed} | FRY: ${bug1.fury} | INS: ${bug1.instinct}`;
        document.getElementById('fighter2-stats').innerHTML =
            `BLK: ${bug2.bulk} | SPD: ${bug2.speed} | FRY: ${bug2.fury} | INS: ${bug2.instinct}`;

        document.getElementById('fighter1-attrs').innerHTML = formatAttrs(bug1);
        document.getElementById('fighter2-attrs').innerHTML = formatAttrs(bug2);
    }

    // Odds - display in selected format
    const odds = gameState.odds;
    if (oddsFormat === 'american') {
        document.getElementById('odds1').textContent = odds.american1;
        document.getElementById('odds2').textContent = odds.american2;
    } else {
        document.getElementById('odds1').textContent = odds.fighter1 + 'x';
        document.getElementById('odds2').textContent = odds.fighter2 + 'x';
    }

    // Update odds format button
    const oddsBtn = document.getElementById('odds-format-btn');
    if (oddsBtn) {
        oddsBtn.textContent = oddsFormat === 'american' ? 'AMERICAN' : 'DECIMAL';
    }

    // Bet buttons state
    const betButtons = document.getElementById('bet-buttons');
    if (gameState.phase === 'countdown') {
        document.querySelectorAll('.fighter-card').forEach(card => card.classList.remove('disabled'));
    } else {
        document.querySelectorAll('.fighter-card').forEach(card => card.classList.add('disabled'));
    }
}

function formatAttrs(bug) {
    return `<span class="weapon">${bug.weapon}</span> ` +
           `<span class="defense">${bug.defense}</span> ` +
           `<span class="mobility">${bug.mobility}</span>`;
}

function updateConnectionStatus(isConnected) {
    const badge = document.querySelector('.live-badge');
    if (badge) {
        if (isConnected) {
            badge.textContent = 'LIVE 24/7';
            badge.style.background = 'linear-gradient(180deg, #f00 0%, #900 100%)';
        } else {
            badge.textContent = 'CONNECTING...';
            badge.style.background = 'linear-gradient(180deg, #888 0%, #444 100%)';
        }
    }
}

// ============================================
// ROSTER MODAL
// ============================================

let rosterSprites = {}; // Cache for roster bug sprites

async function loadRoster() {
    try {
        const response = await fetch('/api/roster');
        const roster = await response.json();
        renderRosterModal(roster);
    } catch (err) {
        console.error('Failed to load roster:', err);
    }
}

function renderRosterModal(roster) {
    const grid = document.getElementById('roster-grid');
    grid.innerHTML = '';

    roster.forEach((bug, index) => {
        const card = document.createElement('div');
        card.className = 'roster-card';

        const winRate = bug.wins + bug.losses > 0
            ? Math.round((bug.wins / (bug.wins + bug.losses)) * 100)
            : 0;

        card.innerHTML = `
            <div class="roster-card-header">
                <div class="roster-card-name">${bug.name}</div>
                <div class="roster-card-record">${bug.wins}W - ${bug.losses}L</div>
            </div>
            <div class="roster-card-sprite" id="roster-sprite-${index}"></div>
            <div class="roster-card-stats">
                <div>BLK: ${bug.stats.bulk}
                    <div class="roster-stat-bar"><div class="roster-stat-bar-fill bulk" style="width: ${bug.stats.bulk}%"></div></div>
                </div>
                <div>SPD: ${bug.stats.speed}
                    <div class="roster-stat-bar"><div class="roster-stat-bar-fill speed" style="width: ${bug.stats.speed}%"></div></div>
                </div>
                <div>FRY: ${bug.stats.fury}
                    <div class="roster-stat-bar"><div class="roster-stat-bar-fill fury" style="width: ${bug.stats.fury}%"></div></div>
                </div>
                <div>INS: ${bug.stats.instinct}
                    <div class="roster-stat-bar"><div class="roster-stat-bar-fill instinct" style="width: ${bug.stats.instinct}%"></div></div>
                </div>
            </div>
            <div class="roster-card-attrs">
                <span class="weapon">${bug.weapon}</span>
                <span class="defense">${bug.defense}</span>
                <span class="mobility">${bug.mobility}</span>
            </div>
        `;

        grid.appendChild(card);

        // Generate sprite for this bug
        renderRosterSprite(bug, index);
    });
}

function renderRosterSprite(bug, index) {
    const container = document.getElementById(`roster-sprite-${index}`);
    if (!container) return;

    // Create canvas for this bug's sprite
    const canvas = document.createElement('canvas');
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${size * 1.5}px`;
    canvas.style.height = `${size * 1.5}px`;

    const ctx = canvas.getContext('2d');

    // Generate sprite
    const genome = new BugGenome(bug.genome);
    const generator = new BugSpriteGenerator(genome);
    const frames = generator.generateAllFrames();
    const frame = frames.idle[0];
    const colors = frames.colors;

    // Draw pixels
    const scale = size / generator.size;
    for (let py = 0; py < generator.size; py++) {
        for (let px = 0; px < generator.size; px++) {
            const colorIdx = parseInt(frame[py][px]);
            if (colorIdx === 0) continue;

            ctx.fillStyle = colors[colorIdx];
            ctx.fillRect(px * scale, py * scale, scale + 0.5, scale + 0.5);
        }
    }

    container.appendChild(canvas);
}

function openRosterModal() {
    document.getElementById('roster-modal').classList.remove('hidden');
    loadRoster();
}

function closeRosterModal() {
    document.getElementById('roster-modal').classList.add('hidden');
}

// ============================================
// INIT
// ============================================

function toggleOddsFormat() {
    oddsFormat = oddsFormat === 'decimal' ? 'american' : 'decimal';
    localStorage.setItem('bugfights_odds_format', oddsFormat);
    updateUI();
}

function initClient() {
    // Set up bet buttons
    document.getElementById('bet-fighter1').addEventListener('click', () => placeBet(1));
    document.getElementById('bet-fighter2').addEventListener('click', () => placeBet(2));

    // Set up odds format toggle
    document.getElementById('odds-format-btn').addEventListener('click', toggleOddsFormat);

    // Set up roster modal
    document.getElementById('roster-btn').addEventListener('click', openRosterModal);
    document.getElementById('close-roster').addEventListener('click', closeRosterModal);
    document.getElementById('roster-modal').addEventListener('click', (e) => {
        if (e.target.id === 'roster-modal') closeRosterModal();
    });

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

// Export for renderer
window.BugFightsClient = {
    init: initClient,
    getState: () => gameState,
    getCommentary: () => commentary,
    setOnStateUpdate: (cb) => { onStateUpdate = cb; },
    setOnEvent: (cb) => { onEvent = cb; },
    addCommentary: addCommentary,
};
