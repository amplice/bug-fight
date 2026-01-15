// Bug Fights - Game Engine
// Imports sprites from sprites.js

// ============================================
// BUG DATA DEFINITIONS
// ============================================

const BUG_DATA = {
    rhino: {
        name: "Rhinoceros Beetle",
        stats: { PWR: 9, SPD: 3, ARM: 9, VIT: 8, FER: 6, INS: 4 },
        attributes: ['armored', 'mandibles'],
        preferredDistance: 60
    },
    stag: {
        name: "Stag Beetle",
        stats: { PWR: 8, SPD: 4, ARM: 7, VIT: 7, FER: 7, INS: 5 },
        attributes: ['mandibles', 'armored'],
        preferredDistance: 55
    },
    centipede: {
        name: "Giant Centipede",
        stats: { PWR: 6, SPD: 8, ARM: 4, VIT: 6, FER: 8, INS: 6 },
        attributes: ['venomous', 'multistrike'],
        preferredDistance: 45
    },
    scorpion: {
        name: "Emperor Scorpion",
        stats: { PWR: 7, SPD: 5, ARM: 8, VIT: 7, FER: 7, INS: 6 },
        attributes: ['venomous', 'stinger', 'armored'],
        preferredDistance: 50
    },
    mantis: {
        name: "Praying Mantis",
        stats: { PWR: 7, SPD: 7, ARM: 3, VIT: 5, FER: 9, INS: 8 },
        attributes: ['multistrike', 'camouflage'],
        preferredDistance: 55
    },
    tarantula: {
        name: "Goliath Tarantula",
        stats: { PWR: 6, SPD: 5, ARM: 5, VIT: 7, FER: 6, INS: 7 },
        attributes: ['venomous', 'webspinner'],
        preferredDistance: 65
    },
    hornet: {
        name: "Asian Giant Hornet",
        stats: { PWR: 5, SPD: 9, ARM: 3, VIT: 4, FER: 9, INS: 7 },
        attributes: ['winged', 'stinger', 'venomous'],
        preferredDistance: 70
    },
    widow: {
        name: "Black Widow",
        stats: { PWR: 4, SPD: 6, ARM: 2, VIT: 3, FER: 7, INS: 9 },
        attributes: ['venomous', 'webspinner'],
        preferredDistance: 80
    },
    hercules: {
        name: "Hercules Beetle",
        stats: { PWR: 10, SPD: 3, ARM: 8, VIT: 9, FER: 5, INS: 3 },
        attributes: ['armored', 'mandibles'],
        preferredDistance: 50
    },
    tiger: {
        name: "Tiger Beetle",
        stats: { PWR: 5, SPD: 10, ARM: 4, VIT: 5, FER: 8, INS: 6 },
        attributes: ['mandibles', 'multistrike'],
        preferredDistance: 45
    },
    ant: {
        name: "Bullet Ant",
        stats: { PWR: 4, SPD: 7, ARM: 5, VIT: 6, FER: 10, INS: 5 },
        attributes: ['venomous', 'stinger', 'regenerative'],
        preferredDistance: 40
    },
    goliath: {
        name: "Goliath Beetle",
        stats: { PWR: 9, SPD: 2, ARM: 9, VIT: 10, FER: 4, INS: 4 },
        attributes: ['armored', 'mandibles'],
        preferredDistance: 55
    }
};

// Attribute effects
const ATTRIBUTES = {
    venomous: { desc: "Attacks can poison, dealing damage over time", color: '#0f0' },
    armored: { desc: "Reduces incoming damage", color: '#888' },
    winged: { desc: "Can fly, harder to hit", color: '#aaf' },
    mandibles: { desc: "Powerful bite attacks", color: '#a50' },
    stinger: { desc: "Piercing attacks ignore some armor", color: '#f80' },
    regenerative: { desc: "Slowly recovers health", color: '#5f5' },
    multistrike: { desc: "Can attack multiple times", color: '#ff0' },
    burrower: { desc: "Can dodge by burrowing", color: '#850' },
    webspinner: { desc: "Can slow enemies with webs", color: '#fff' },
    camouflage: { desc: "First strike advantage", color: '#595' }
};

// ============================================
// GAME STATE
// ============================================

let canvas, ctx;
let gameState = 'countdown'; // countdown, fighting, victory
let player = { money: 1000 };
let currentBet = { amount: 0, on: null };
let nextFighters = { bug1: null, bug2: null };
let fighters = [];
let particles = [];
let bloodStains = [];
let commentary = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let gameLoop = null;
let combatTick = 0;

// Countdown system
const COUNTDOWN_SECONDS = 10;
let countdownTimer = COUNTDOWN_SECONDS;
let lastCountdownUpdate = 0;
let fightNumber = 0;

// ============================================
// FIGHTER CLASS
// ============================================

class Fighter {
    constructor(bugKey, side) {
        this.key = bugKey;
        this.data = BUG_DATA[bugKey];
        this.sprite = SPRITES[bugKey];
        this.side = side; // 'left' or 'right'

        // Position
        this.x = side === 'left' ? 120 : 480;
        this.y = 275;
        this.targetX = this.x;
        this.targetY = this.y;
        this.facingRight = side === 'left';

        // Combat stats
        this.maxHp = 50 + this.data.stats.VIT * 10;
        this.hp = this.maxHp;
        this.poisoned = 0;
        this.webbed = 0;
        this.attackCooldown = 0;

        // Animation
        this.state = 'idle'; // idle, attack, hit, death
        this.animTick = 0;
        this.animFrame = 0;

        // Movement
        this.circleAngle = side === 'left' ? 0 : Math.PI;
        this.moveTimer = 0;
    }

    get isAlive() {
        return this.hp > 0;
    }

    getPowerRating() {
        const s = this.data.stats;
        return s.PWR * 2 + s.SPD * 1.5 + s.ARM * 1.5 + s.VIT * 2 + s.FER * 1.2 + s.INS * 0.8 +
               this.data.attributes.length * 3;
    }

    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.animTick = 0;
            this.animFrame = 0;
        }
    }

    updateAnimation() {
        this.animTick++;

        const frames = this.sprite[this.state];
        const frameDelay = this.state === 'idle' ? 8 : 5;

        if (this.animTick >= frameDelay) {
            this.animTick = 0;
            this.animFrame++;

            if (this.animFrame >= frames.length) {
                if (this.state === 'death') {
                    this.animFrame = frames.length - 1; // Stay on last death frame
                } else if (this.state === 'attack' || this.state === 'hit') {
                    this.setState('idle');
                } else {
                    this.animFrame = 0;
                }
            }
        }
    }

    updateMovement(opponent) {
        if (!this.isAlive || this.state === 'death') return;

        this.moveTimer++;

        const dx = opponent.x - this.x;
        const dy = opponent.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Face opponent
        this.facingRight = dx > 0;

        // Calculate movement based on SPD
        const moveSpeed = 0.5 + this.data.stats.SPD * 0.15;
        const preferred = this.data.preferredDistance;

        // Webbed slows movement
        const webPenalty = this.webbed > 0 ? 0.3 : 1;

        // Circle around opponent
        if (this.moveTimer % 3 === 0) {
            this.circleAngle += (this.side === 'left' ? 0.02 : -0.02) * this.data.stats.SPD * webPenalty;
        }

        // Calculate target position
        if (dist < preferred - 20) {
            // Too close, back up
            this.targetX = this.x - dx * 0.1;
            this.targetY = this.y - dy * 0.1;
        } else if (dist > preferred + 20) {
            // Too far, approach
            this.targetX = this.x + dx * 0.1;
            this.targetY = this.y + dy * 0.1;
        } else {
            // Circle at preferred distance
            const centerX = opponent.x;
            const centerY = opponent.y;
            this.targetX = centerX + Math.cos(this.circleAngle) * preferred;
            this.targetY = centerY + Math.sin(this.circleAngle) * preferred * 0.5 + 275;
        }

        // Clamp to arena bounds
        this.targetX = Math.max(50, Math.min(550, this.targetX));
        this.targetY = Math.max(180, Math.min(370, this.targetY));

        // Move toward target
        this.x += (this.targetX - this.x) * moveSpeed * 0.1 * webPenalty;
        this.y += (this.targetY - this.y) * moveSpeed * 0.1 * webPenalty;
    }

    knockback(fromX, fromY, force) {
        const dx = this.x - fromX;
        const dy = this.y - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.x += (dx / dist) * force;
        this.y += (dy / dist) * force;
        this.x = Math.max(50, Math.min(550, this.x));
        this.y = Math.max(180, Math.min(370, this.y));
    }

    render(ctx, scale) {
        const frames = this.sprite[this.state];
        const frame = frames[Math.min(this.animFrame, frames.length - 1)];
        const colors = this.sprite.colors;

        const size = 16 * scale;
        const startX = this.x - size / 2;
        const startY = this.y - size / 2;

        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const colorIdx = parseInt(frame[py][this.facingRight ? px : 15 - px]);
                if (colorIdx === 0) continue; // Transparent

                ctx.fillStyle = colors[colorIdx];
                ctx.fillRect(
                    startX + px * scale,
                    startY + py * scale,
                    scale, scale
                );
            }
        }

        // Draw health bar
        if (this.isAlive) {
            const barWidth = 50;
            const barHeight = 6;
            const barX = this.x - barWidth / 2;
            const barY = this.y - size / 2 - 15;

            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const hpPercent = this.hp / this.maxHp;
            ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
            ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * hpPercent, barHeight - 2);

            // Poison indicator
            if (this.poisoned > 0) {
                ctx.fillStyle = '#0f0';
                ctx.fillRect(barX + barWidth + 3, barY, 4, barHeight);
            }

            // Web indicator
            if (this.webbed > 0) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(barX + barWidth + 9, barY, 4, barHeight);
            }
        }
    }
}

// ============================================
// PARTICLE SYSTEM
// ============================================

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 1;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4 - 2;
        this.size = 2 + Math.random() * 3;

        switch(type) {
            case 'blood':
                this.color = ['#800', '#a00', '#f00'][Math.floor(Math.random() * 3)];
                this.gravity = 0.15;
                this.decay = 0.02;
                break;
            case 'poison':
                this.color = '#0f0';
                this.gravity = -0.05;
                this.decay = 0.03;
                this.size = 2;
                break;
            case 'dust':
                this.color = '#a98';
                this.gravity = 0.02;
                this.decay = 0.015;
                break;
            case 'spark':
                this.color = '#ff0';
                this.gravity = 0;
                this.decay = 0.05;
                this.size = 1;
                break;
            case 'web':
                this.color = '#fff';
                this.gravity = 0.1;
                this.decay = 0.01;
                this.size = 1;
                break;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
        this.vx *= 0.98;
    }

    render(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

function spawnParticles(x, y, type, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, type));
    }
}

function addBloodStain(x, y) {
    bloodStains.push({
        x: x,
        y: y,
        size: 3 + Math.random() * 5,
        alpha: 0.6 + Math.random() * 0.3
    });
    if (bloodStains.length > 30) bloodStains.shift();
}

// ============================================
// COMBAT SYSTEM
// ============================================

function rollDice(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function calculateDamage(attacker, defender) {
    let damage = attacker.data.stats.PWR + rollDice(6);

    // Mandibles bonus
    if (attacker.data.attributes.includes('mandibles')) {
        damage += 2;
    }

    // Armor reduction
    let armor = defender.data.stats.ARM;

    // Stinger pierces armor
    if (attacker.data.attributes.includes('stinger')) {
        armor = Math.floor(armor / 2);
    }

    damage -= Math.floor(armor / 2);

    // Ferocity crit chance
    if (rollDice(20) <= attacker.data.stats.FER) {
        damage = Math.floor(damage * 1.5);
        addCommentary(`Critical hit!`, '#ff0');
    }

    return Math.max(1, damage);
}

function performAttack(attacker, defender) {
    if (!attacker.isAlive || !defender.isAlive) return;

    // Distance check
    const dx = defender.x - attacker.x;
    const dy = defender.y - attacker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 100) return; // Too far to attack

    // Hit check based on SPD vs INS
    const hitRoll = rollDice(20) + attacker.data.stats.SPD;
    const dodgeRoll = rollDice(20) + defender.data.stats.INS;

    // Winged evasion bonus
    const evasionBonus = defender.data.attributes.includes('winged') ? 5 : 0;

    attacker.setState('attack');

    if (hitRoll > dodgeRoll + evasionBonus) {
        // Hit!
        let damage = calculateDamage(attacker, defender);

        // Multistrike chance
        let strikes = 1;
        if (attacker.data.attributes.includes('multistrike') && rollDice(4) === 4) {
            strikes = 2;
            addCommentary(`${attacker.data.name} strikes twice!`, '#ff0');
        }

        for (let i = 0; i < strikes; i++) {
            defender.hp -= damage;
            defender.setState('hit');
            defender.knockback(attacker.x, attacker.y, 15);

            // Effects
            spawnParticles(defender.x, defender.y, 'blood', 5);
            addBloodStain(defender.x, defender.y + 20);
            screenShake.intensity = 5;

            // Poison application
            if (attacker.data.attributes.includes('venomous') && rollDice(4) === 4) {
                defender.poisoned = 5;
                addCommentary(`${defender.data.name} is poisoned!`, '#0f0');
                spawnParticles(defender.x, defender.y, 'poison', 8);
            }

            // Web application
            if (attacker.data.attributes.includes('webspinner') && rollDice(4) === 4) {
                defender.webbed = 4;
                addCommentary(`${defender.data.name} is webbed!`, '#fff');
                spawnParticles(defender.x, defender.y, 'web', 10);
            }
        }

        addCommentary(`${attacker.data.name} deals ${damage * strikes} damage!`, '#f80');

        if (defender.hp <= 0) {
            defender.hp = 0;
            defender.setState('death');
            addCommentary(`${defender.data.name} is defeated!`, '#f00');
            spawnParticles(defender.x, defender.y, 'blood', 20);
        }
    } else {
        // Miss
        spawnParticles(attacker.x + dx * 0.5, attacker.y + dy * 0.5, 'dust', 3);
        addCommentary(`${attacker.data.name} misses!`, '#888');
    }
}

function processCombatTick() {
    if (gameState !== 'fighting') return;

    combatTick++;

    const [f1, f2] = fighters;

    if (!f1.isAlive || !f2.isAlive) {
        endFight();
        return;
    }

    // Process poison damage
    fighters.forEach(f => {
        if (f.poisoned > 0) {
            f.hp -= 2;
            f.poisoned--;
            spawnParticles(f.x, f.y, 'poison', 2);
            if (f.hp <= 0) {
                f.hp = 0;
                f.setState('death');
                addCommentary(`${f.data.name} succumbs to poison!`, '#0f0');
            }
        }
        if (f.webbed > 0) f.webbed--;
    });

    // Regeneration
    fighters.forEach(f => {
        if (f.isAlive && f.data.attributes.includes('regenerative') && combatTick % 20 === 0) {
            f.hp = Math.min(f.maxHp, f.hp + 3);
            spawnParticles(f.x, f.y, 'spark', 3);
        }
    });

    // Attack cooldowns based on SPD
    fighters.forEach((f, i) => {
        if (!f.isAlive) return;
        f.attackCooldown--;
        if (f.attackCooldown <= 0) {
            const cooldown = Math.max(20, 60 - f.data.stats.SPD * 4);
            f.attackCooldown = cooldown + rollDice(20);
            performAttack(f, fighters[1 - i]);
        }
    });
}

// ============================================
// COMMENTARY SYSTEM
// ============================================

function addCommentary(text, color = '#fff') {
    commentary.unshift({ text, color, age: 0 });
    if (commentary.length > 6) commentary.pop();
}

// ============================================
// BETTING SYSTEM
// ============================================

function calculateOdds(bug1, bug2) {
    const f1 = new Fighter(bug1, 'left');
    const f2 = new Fighter(bug2, 'right');

    const p1 = f1.getPowerRating();
    const p2 = f2.getPowerRating();
    const total = p1 + p2;

    return {
        [bug1]: (total / p1).toFixed(2),
        [bug2]: (total / p2).toFixed(2)
    };
}

function placeBet(bugKey) {
    if (gameState !== 'countdown') {
        addCommentary("Betting closed!", '#f00');
        return false;
    }

    const amount = parseInt(document.getElementById('bet-amount').value) || 0;

    if (amount <= 0) {
        addCommentary("Enter a bet amount!", '#f00');
        return false;
    }

    if (amount > player.money) {
        addCommentary("Not enough money!", '#f00');
        return false;
    }

    // If already bet, refund previous bet
    if (currentBet.amount > 0) {
        player.money += currentBet.amount;
    }

    currentBet = { amount, on: bugKey };
    player.money -= amount;
    updateUI();

    const bugName = BUG_DATA[bugKey].name;
    addCommentary(`Bet $${amount} on ${bugName}!`, '#0f0');
    return true;
}

function resolveBet(winner) {
    if (currentBet.amount > 0) {
        if (currentBet.on === winner.key) {
            const odds = calculateOdds(fighters[0].key, fighters[1].key);
            const winnings = Math.floor(currentBet.amount * parseFloat(odds[winner.key]));
            player.money += winnings;
            addCommentary(`You won $${winnings}!`, '#0f0');
        } else {
            addCommentary(`You lost $${currentBet.amount}!`, '#f00');
        }
    }
    currentBet = { amount: 0, on: null };
    updateUI();
}

// ============================================
// RANDOM MATCHUP SYSTEM
// ============================================

function getRandomBugs() {
    const bugKeys = Object.keys(BUG_DATA);
    const bug1 = bugKeys[Math.floor(Math.random() * bugKeys.length)];
    let bug2 = bug1;
    while (bug2 === bug1) {
        bug2 = bugKeys[Math.floor(Math.random() * bugKeys.length)];
    }
    return { bug1, bug2 };
}

function setupNextFight() {
    nextFighters = getRandomBugs();
    updateMatchupDisplay();
}

function updateMatchupDisplay() {
    const bug1Data = BUG_DATA[nextFighters.bug1];
    const bug2Data = BUG_DATA[nextFighters.bug2];
    const odds = calculateOdds(nextFighters.bug1, nextFighters.bug2);

    // Update fighter 1 display
    document.getElementById('fighter1-name').textContent = bug1Data.name;
    document.getElementById('fighter1-stats').innerHTML =
        `PWR:${bug1Data.stats.PWR} SPD:${bug1Data.stats.SPD} ARM:${bug1Data.stats.ARM}<br>` +
        `VIT:${bug1Data.stats.VIT} FER:${bug1Data.stats.FER} INS:${bug1Data.stats.INS}`;
    document.getElementById('fighter1-attrs').innerHTML =
        bug1Data.attributes.map(a => `<span style="color:${ATTRIBUTES[a].color}">${a}</span>`).join(' ');
    document.getElementById('odds1').textContent = odds[nextFighters.bug1] + 'x';

    // Update fighter 2 display
    document.getElementById('fighter2-name').textContent = bug2Data.name;
    document.getElementById('fighter2-stats').innerHTML =
        `PWR:${bug2Data.stats.PWR} SPD:${bug2Data.stats.SPD} ARM:${bug2Data.stats.ARM}<br>` +
        `VIT:${bug2Data.stats.VIT} FER:${bug2Data.stats.FER} INS:${bug2Data.stats.INS}`;
    document.getElementById('fighter2-attrs').innerHTML =
        bug2Data.attributes.map(a => `<span style="color:${ATTRIBUTES[a].color}">${a}</span>`).join(' ');
    document.getElementById('odds2').textContent = odds[nextFighters.bug2] + 'x';
}

// ============================================
// GAME FLOW
// ============================================

function startCountdown() {
    gameState = 'countdown';
    countdownTimer = COUNTDOWN_SECONDS;
    lastCountdownUpdate = Date.now();
    fightNumber++;

    setupNextFight();

    addCommentary(`FIGHT #${fightNumber} - Place your bets!`, '#ff0');

    document.getElementById('countdown-display').classList.remove('hidden');
    document.getElementById('bet-buttons').classList.remove('disabled');
}

function updateCountdown() {
    if (gameState !== 'countdown') return;

    const now = Date.now();
    if (now - lastCountdownUpdate >= 1000) {
        lastCountdownUpdate = now;
        countdownTimer--;

        document.getElementById('countdown-timer').textContent = countdownTimer;

        if (countdownTimer <= 3 && countdownTimer > 0) {
            addCommentary(`${countdownTimer}...`, '#f00');
        }

        if (countdownTimer <= 0) {
            startFight();
        }
    }
}

function startFight() {
    fighters = [
        new Fighter(nextFighters.bug1, 'left'),
        new Fighter(nextFighters.bug2, 'right')
    ];

    bloodStains = [];
    particles = [];
    combatTick = 0;
    gameState = 'fighting';

    document.getElementById('countdown-display').classList.add('hidden');
    document.getElementById('bet-buttons').classList.add('disabled');

    addCommentary(`${fighters[0].data.name} vs ${fighters[1].data.name}!`, '#ff0');
    addCommentary("FIGHT!", '#f00');

    // Camouflage first strike
    fighters.forEach((f, i) => {
        if (f.data.attributes.includes('camouflage')) {
            f.attackCooldown = 10;
            addCommentary(`${f.data.name} has the element of surprise!`, '#595');
        }
    });
}

function endFight() {
    gameState = 'victory';
    const winner = fighters.find(f => f.isAlive);

    if (winner) {
        addCommentary(`${winner.data.name} WINS!`, '#ff0');
        resolveBet(winner);
    }

    // Start next countdown after delay
    setTimeout(() => {
        startCountdown();
    }, 4000);
}

// ============================================
// RENDERING
// ============================================

function renderArena() {
    // Clear with shake
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.9;

    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    // Arena background - dirt floor
    const gradient = ctx.createRadialGradient(300, 350, 50, 300, 300, 350);
    gradient.addColorStop(0, '#8B7355');
    gradient.addColorStop(0.5, '#6B5344');
    gradient.addColorStop(1, '#4a3728');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Arena border
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 150, 560, 250);

    // Inner border
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 2;
    ctx.strokeRect(25, 155, 550, 240);

    // Blood stains
    bloodStains.forEach(stain => {
        ctx.globalAlpha = stain.alpha * 0.5;
        ctx.fillStyle = '#600';
        ctx.beginPath();
        ctx.arc(stain.x, stain.y, stain.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Fighters
    fighters.forEach(f => f.render(ctx, 4));

    // Particles
    particles.forEach(p => {
        p.update();
        p.render(ctx);
    });
    particles = particles.filter(p => p.life > 0);

    ctx.restore();

    // Title
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUG FIGHTS', 300, 40);

    // Fight number
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText(`FIGHT #${fightNumber}`, 300, 60);

    // VS text and fighter names
    if (fighters.length === 2 || gameState === 'countdown') {
        ctx.fillStyle = '#f00';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('VS', 300, 130);

        const name1 = gameState === 'countdown' ? BUG_DATA[nextFighters.bug1].name : fighters[0].data.name;
        const name2 = gameState === 'countdown' ? BUG_DATA[nextFighters.bug2].name : fighters[1].data.name;

        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(name1, 30, 130);
        ctx.textAlign = 'right';
        ctx.fillText(name2, 570, 130);
    }

    // Countdown overlay
    if (gameState === 'countdown') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(200, 250, 200, 80);

        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(countdownTimer, 300, 305);

        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.fillText('PLACE YOUR BETS', 300, 325);
    }

    // Commentary
    ctx.textAlign = 'left';
    ctx.font = '12px monospace';
    commentary.forEach((c, i) => {
        c.age++;
        const alpha = Math.max(0, 1 - c.age / 200);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = c.color;
        ctx.fillText(c.text, 30, 430 + i * 16);
    });
    ctx.globalAlpha = 1;
    commentary = commentary.filter(c => c.age < 200);
}

function gameLoopFn() {
    // Update countdown
    updateCountdown();

    // Update animations
    fighters.forEach(f => {
        f.updateAnimation();
        if (gameState === 'fighting') {
            f.updateMovement(fighters.find(o => o !== f));
        }
    });

    // Process combat
    if (gameState === 'fighting' && combatTick % 2 === 0) {
        processCombatTick();
    }
    combatTick++;

    // Render
    renderArena();

    gameLoop = requestAnimationFrame(gameLoopFn);
}

// ============================================
// UI FUNCTIONS
// ============================================

function updateUI() {
    document.getElementById('money').textContent = player.money;

    // Update bet display
    if (currentBet.amount > 0) {
        const bugName = BUG_DATA[currentBet.on].name;
        document.getElementById('current-bet').textContent = `$${currentBet.amount} on ${bugName}`;
    } else {
        document.getElementById('current-bet').textContent = 'None';
    }
}

function initGame() {
    canvas = document.getElementById('arena');
    ctx = canvas.getContext('2d');

    // Event listeners for betting
    document.getElementById('bet-fighter1').addEventListener('click', () => {
        placeBet(nextFighters.bug1);
    });

    document.getElementById('bet-fighter2').addEventListener('click', () => {
        placeBet(nextFighters.bug2);
    });

    // Initialize
    fighters = [];
    updateUI();

    // Start the show!
    startCountdown();

    // Start game loop
    gameLoopFn();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', initGame);
