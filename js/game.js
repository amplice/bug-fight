// Bug Fights - Game Engine v3
// Now with procedural bug generation

// ============================================
// GAME STATE
// ============================================

let canvas, ctx;
let gameState = 'countdown';
let player = { money: 1000 };
let currentBet = { amount: 0, on: null };
let nextBugs = { bug1: null, bug2: null };
let fighters = [];
let particles = [];
let bloodStains = [];
let commentary = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let gameLoop = null;
let combatTick = 0;

// Countdown
const COUNTDOWN_SECONDS = 10;
let countdownTimer = COUNTDOWN_SECONDS;
let lastCountdownUpdate = 0;
let fightNumber = 0;

// Hit pause system
let hitPause = 0;
let impactFlash = { active: false, x: 0, y: 0, radius: 0, alpha: 0 };
let slowMotion = 1;

// ============================================
// FIGHTER CLASS
// ============================================

class Fighter {
    constructor(bug, side) {
        this.bug = bug;
        this.genome = bug.genome;
        this.sprite = bug.sprite;
        this.side = side;

        // Position
        this.x = side === 'left' ? 120 : 480;
        this.y = 275;
        this.targetX = this.x;
        this.targetY = this.y;
        this.facingRight = side === 'left';

        // Combat stats derived from genome
        this.maxHp = 30 + Math.floor(this.genome.bulk * 1.2);
        this.hp = this.maxHp;
        this.poisoned = 0;
        this.attackCooldown = 30 + Math.random() * 30;

        // Animation state
        this.state = 'idle';
        this.animTick = 0;
        this.animFrame = 0;
        this.stateTimer = 0;

        // Attack
        this.attackTarget = null;
        this.lungeX = 0;
        this.lungeY = 0;

        // Visual effects
        this.flashTimer = 0;
        this.squash = 1;
        this.stretch = 1;

        // Movement
        this.circleAngle = side === 'left' ? 0 : Math.PI;
        this.moveTimer = 0;

        // Mobility effects
        this.isFlying = this.genome.mobility === 'winged';
        this.isWallcrawler = this.genome.mobility === 'wallcrawler';
    }

    get isAlive() {
        return this.hp > 0;
    }

    getPowerRating() {
        const g = this.genome;
        let rating = g.bulk + g.speed + g.fury + g.instinct;

        // Weapon bonuses
        if (g.weapon === 'claws') rating += 10;
        if (g.weapon === 'stinger') rating += 8;

        // Defense bonuses
        if (g.defense === 'shell') rating += 10;
        if (g.defense === 'agility') rating += g.speed * 0.1;

        // Mobility bonuses
        if (g.mobility === 'winged') rating += 15;
        if (g.mobility === 'wallcrawler') rating += 10;

        return rating;
    }

    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.animTick = 0;
            this.animFrame = 0;
            this.stateTimer = 0;
        }
    }

    updateAnimation() {
        if (hitPause > 0) return;

        this.stateTimer++;
        this.animTick++;

        if (this.flashTimer > 0) this.flashTimer--;
        this.squash += (1 - this.squash) * 0.2;
        this.stretch += (1 - this.stretch) * 0.2;
        this.lungeX *= 0.85;
        this.lungeY *= 0.85;

        const spriteState = (this.state === 'windup' || this.state === 'victory') ? 'idle' : this.state;
        const frames = this.sprite[spriteState];
        const frameDelay = this.state === 'idle' ? 8 : (this.state === 'windup' ? 4 : 5);

        if (this.animTick >= frameDelay) {
            this.animTick = 0;
            this.animFrame++;

            if (this.animFrame >= frames.length) {
                if (this.state === 'death') {
                    this.animFrame = frames.length - 1;
                } else if (this.state === 'attack') {
                    this.setState('idle');
                } else if (this.state === 'hit') {
                    this.isAlive ? this.setState('idle') : this.setState('death');
                } else {
                    this.animFrame = 0;
                }
            }
        }

        if (this.state === 'windup') {
            this.lungeX = (Math.random() - 0.5) * 4;
            this.lungeY = (Math.random() - 0.5) * 2;
            if (this.stateTimer >= 12) this.executeAttack();
        }

        if (this.state === 'victory') {
            this.squash = this.stateTimer % 20 < 10 ? 0.9 : 1.1;
            this.stretch = this.stateTimer % 20 < 10 ? 1.1 : 0.9;
        }
    }

    startAttack(target) {
        if (this.state !== 'idle') return;
        this.attackTarget = target;
        this.setState('windup');
        this.facingRight = target.x > this.x;
    }

    executeAttack() {
        if (!this.attackTarget || !this.isAlive) return;

        const target = this.attackTarget;
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.setState('attack');

        // Lunge
        const lungeStrength = 25 + this.genome.fury / 10;
        this.lungeX = (dx / dist) * lungeStrength;
        this.lungeY = (dy / dist) * lungeStrength * 0.5;
        this.squash = 0.7;
        this.stretch = 1.3;

        // Hit check: SPEED vs INSTINCT + evasion
        const hitRoll = rollDice(100) + this.genome.speed;
        let dodgeRoll = rollDice(100) + target.genome.instinct;

        // Evasion bonuses
        if (target.genome.defense === 'agility') dodgeRoll += 20;
        if (target.isFlying) dodgeRoll += 15;

        if (hitRoll > dodgeRoll) {
            // Calculate damage: BULK + FURY
            let damage = Math.floor((this.genome.bulk + this.genome.fury) / 10) + rollDice(6);

            // Weapon effects
            if (this.genome.weapon === 'mandibles' && target.genome.defense === 'shell') {
                damage += 3; // Crush bonus vs shell
            }
            if (this.genome.weapon === 'stinger') {
                // Piercing - ignore some defense
                damage += 2;
            }

            // Defense reduction
            if (target.genome.defense === 'shell') {
                damage = Math.max(1, damage - Math.floor(target.genome.bulk / 20));
            }

            // Crit check based on FURY
            let isCrit = rollDice(100) <= this.genome.fury / 2;
            if (isCrit) {
                damage = Math.floor(damage * 1.5);
                addCommentary(`CRITICAL HIT!`, '#ff0');
            }

            damage = Math.max(1, damage);

            // Multistrike for claws
            let strikes = 1;
            if (this.genome.weapon === 'claws' && rollDice(4) === 4) {
                strikes = 2;
                addCommentary(`Double slash!`, '#ff0');
            }

            setTimeout(() => {
                for (let i = 0; i < strikes; i++) {
                    this.applyHit(target, damage, isCrit);
                }
            }, 50);
        } else {
            spawnParticles(this.x + dx * 0.7, this.y + dy * 0.7, 'dust', 5);
            addCommentary(`${this.bug.name} misses!`, '#888');
        }

        this.attackTarget = null;
    }

    applyHit(target, damage, isCrit) {
        if (!target.isAlive) return;

        target.hp -= damage;
        target.setState('hit');

        // Hit pause
        hitPause = Math.max(hitPause, isCrit ? 12 : (target.hp <= 0 ? 20 : 8));
        screenShake.intensity = isCrit ? 15 : 8;

        // Impact flash
        impactFlash = {
            active: true,
            x: target.x,
            y: target.y,
            radius: isCrit ? 60 : 40,
            alpha: 1
        };

        target.flashTimer = 8;
        target.squash = 1.4;
        target.stretch = 0.6;

        // Knockback
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const knockbackForce = isCrit ? 25 : 15;
        target.x += (dx / dist) * knockbackForce;
        target.y += (dy / dist) * knockbackForce * 0.5;
        target.x = Math.max(50, Math.min(550, target.x));
        target.y = Math.max(180, Math.min(370, target.y));

        // Particles
        spawnParticles(target.x, target.y, 'blood', isCrit ? 15 : 8);
        if (isCrit) spawnParticles(target.x, target.y, 'spark', 10);
        addBloodStain(target.x, target.y + 15);

        // Venom from fangs
        if (this.genome.weapon === 'fangs' && rollDice(3) === 3) {
            target.poisoned = 4;
            addCommentary(`${target.bug.name} is poisoned!`, '#0f0');
            spawnParticles(target.x, target.y, 'poison', 10);
        }

        // Toxic defense
        if (target.genome.defense === 'toxic') {
            const toxicDamage = Math.floor(target.genome.bulk / 25);
            if (toxicDamage > 0) {
                this.hp -= toxicDamage;
                this.flashTimer = 4;
                addCommentary(`${this.bug.name} takes ${toxicDamage} toxic damage!`, '#0f0');
            }
        }

        addCommentary(`${this.bug.name} deals ${damage} damage!`, isCrit ? '#ff0' : '#f80');

        if (target.hp <= 0) {
            target.hp = 0;
            target.setState('death');
            hitPause = 25;
            slowMotion = 0.3;
            setTimeout(() => { slowMotion = 1; }, 500);
            addCommentary(`${target.bug.name} is DEFEATED!`, '#f00');
            spawnParticles(target.x, target.y, 'blood', 30);
        }
    }

    updateMovement(opponent) {
        if (hitPause > 0) return;
        if (!this.isAlive || this.state === 'death') return;
        if (this.state === 'windup' || this.state === 'attack') return;

        this.moveTimer++;

        const dx = opponent.x - this.x;
        const dy = opponent.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this.state === 'idle') this.facingRight = dx > 0;

        // Speed affects movement
        const moveSpeed = (0.3 + this.genome.speed / 200) * slowMotion;
        const preferredDist = 50 + (100 - this.genome.fury) / 3;

        if (this.moveTimer % 3 === 0) {
            this.circleAngle += (this.side === 'left' ? 0.02 : -0.02) * (this.genome.speed / 50);
        }

        if (dist < preferredDist - 20) {
            this.targetX = this.x - dx * 0.1;
            this.targetY = this.y - dy * 0.1;
        } else if (dist > preferredDist + 20) {
            this.targetX = this.x + dx * 0.1;
            this.targetY = this.y + dy * 0.1;
        } else {
            this.targetX = opponent.x + Math.cos(this.circleAngle) * preferredDist;
            this.targetY = opponent.y + Math.sin(this.circleAngle) * preferredDist * 0.5;
        }

        // Wallcrawler can use edges
        if (this.isWallcrawler) {
            if (Math.random() < 0.02) {
                // Occasionally move to wall
                this.targetY = Math.random() < 0.5 ? 190 : 350;
            }
        }

        // Flying bugs bob up and down
        if (this.isFlying) {
            this.targetY += Math.sin(this.moveTimer / 10) * 5;
        }

        this.targetX = Math.max(50, Math.min(550, this.targetX));
        this.targetY = Math.max(200, Math.min(360, this.targetY));

        this.x += (this.targetX - this.x) * moveSpeed * 0.1;
        this.y += (this.targetY - this.y) * moveSpeed * 0.1;
    }

    render(ctx, scale) {
        const spriteState = (this.state === 'windup' || this.state === 'victory') ? 'idle' : this.state;
        const frames = this.sprite[spriteState];
        const frame = frames[Math.min(this.animFrame, frames.length - 1)];
        const colors = this.sprite.colors;

        const size = 16 * scale;
        const renderX = this.x + this.lungeX;
        const renderY = this.y + this.lungeY;

        const scaleX = scale * this.squash;
        const scaleY = scale * this.stretch;
        const sizeX = 16 * scaleX;
        const sizeY = 16 * scaleY;

        const startX = renderX - sizeX / 2;
        const startY = renderY - sizeY / 2 + (size - sizeY) / 2;

        ctx.save();

        if (this.flashTimer > 0) {
            ctx.globalAlpha = 0.5 + (this.flashTimer / 16);
        }

        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const colorIdx = parseInt(frame[py][this.facingRight ? px : 15 - px]);
                if (colorIdx === 0) continue;

                ctx.fillStyle = (this.flashTimer > 0 && this.flashTimer % 2 === 0) ? '#fff' : colors[colorIdx];
                ctx.fillRect(startX + px * scaleX, startY + py * scaleY, scaleX + 0.5, scaleY + 0.5);
            }
        }

        ctx.restore();

        // Health bar
        if (this.isAlive || this.state === 'death') {
            const barWidth = 50;
            const barHeight = 6;
            const barX = this.x - barWidth / 2;
            const barY = renderY - size / 2 - 20;

            ctx.fillStyle = '#000';
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const hpPercent = Math.max(0, this.hp / this.maxHp);
            ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
            ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * hpPercent, barHeight - 2);

            if (this.poisoned > 0) {
                ctx.fillStyle = '#0f0';
                ctx.fillRect(barX + barWidth + 4, barY, 4, barHeight);
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
        this.size = 2 + Math.random() * 3;

        switch(type) {
            case 'blood':
                this.vx = (Math.random() - 0.5) * 8;
                this.vy = (Math.random() - 0.5) * 8 - 4;
                this.color = ['#600', '#800', '#a00', '#c00'][Math.floor(Math.random() * 4)];
                this.gravity = 0.3;
                this.decay = 0.015;
                this.size = 3 + Math.random() * 4;
                break;
            case 'poison':
                this.vx = (Math.random() - 0.5) * 3;
                this.vy = -1 - Math.random() * 2;
                this.color = '#0f0';
                this.gravity = -0.05;
                this.decay = 0.025;
                break;
            case 'dust':
                this.vx = (Math.random() - 0.5) * 4;
                this.vy = (Math.random() - 0.5) * 2;
                this.color = '#a98';
                this.gravity = 0.02;
                this.decay = 0.02;
                break;
            case 'spark':
                this.vx = (Math.random() - 0.5) * 10;
                this.vy = (Math.random() - 0.5) * 10;
                this.color = ['#ff0', '#fa0', '#f80'][Math.floor(Math.random() * 3)];
                this.gravity = 0;
                this.decay = 0.04;
                break;
        }
    }

    update() {
        if (hitPause > 0) return;
        this.x += this.vx * slowMotion;
        this.y += this.vy * slowMotion;
        this.vy += this.gravity * slowMotion;
        this.life -= this.decay * slowMotion;
        this.vx *= 0.98;
    }

    render(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        if (this.type === 'spark') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.vx * 2, this.y - this.vy * 2);
            ctx.stroke();
        } else {
            ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        }
        ctx.globalAlpha = 1;
    }
}

function spawnParticles(x, y, type, count) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, type));
}

function addBloodStain(x, y) {
    bloodStains.push({ x: x + (Math.random()-0.5)*20, y, size: 4+Math.random()*8, alpha: 0.4+Math.random()*0.3 });
    if (bloodStains.length > 40) bloodStains.shift();
}

// ============================================
// COMBAT
// ============================================

function rollDice(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function processCombatTick() {
    if (gameState !== 'fighting' || hitPause > 0) return;

    combatTick++;
    const [f1, f2] = fighters;

    if (!f1.isAlive || !f2.isAlive) {
        endFight();
        return;
    }

    // Poison tick
    fighters.forEach(f => {
        if (f.poisoned > 0 && combatTick % 30 === 0) {
            const poisonDmg = 2;
            f.hp -= poisonDmg;
            f.poisoned--;
            f.flashTimer = 4;
            spawnParticles(f.x, f.y, 'poison', 3);
            if (f.hp <= 0) {
                f.hp = 0;
                f.setState('death');
                hitPause = 20;
                addCommentary(`${f.bug.name} succumbs to poison!`, '#0f0');
            }
        }
    });

    // Attack timing
    fighters.forEach((f, i) => {
        if (!f.isAlive || f.state !== 'idle') return;

        f.attackCooldown -= slowMotion;
        if (f.attackCooldown <= 0) {
            const opponent = fighters[1 - i];
            const dx = opponent.x - f.x;
            const dy = opponent.y - f.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 120) {
                f.startAttack(opponent);
                // Faster bugs attack more often
                const cooldown = Math.max(25, 80 - f.genome.speed / 2);
                f.attackCooldown = cooldown + rollDice(30);
            }
        }
    });
}

// ============================================
// COMMENTARY
// ============================================

function addCommentary(text, color = '#fff') {
    commentary.unshift({ text, color, age: 0 });
    if (commentary.length > 6) commentary.pop();
}

// ============================================
// BETTING
// ============================================

function calculateOdds(bug1, bug2) {
    const p1 = new Fighter(bug1, 'left').getPowerRating();
    const p2 = new Fighter(bug2, 'right').getPowerRating();
    const total = p1 + p2;

    return {
        bug1: (total / p1).toFixed(2),
        bug2: (total / p2).toFixed(2)
    };
}

function placeBet(which) {
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

    if (currentBet.amount > 0) player.money += currentBet.amount;

    currentBet = { amount, on: which };
    player.money -= amount;
    updateUI();

    const bugName = which === 1 ? nextBugs.bug1.name : nextBugs.bug2.name;
    addCommentary(`Bet $${amount} on ${bugName}!`, '#0f0');
    return true;
}

function resolveBet(winnerSide) {
    if (currentBet.amount > 0) {
        if (currentBet.on === winnerSide) {
            const odds = calculateOdds(nextBugs.bug1, nextBugs.bug2);
            const mult = parseFloat(winnerSide === 1 ? odds.bug1 : odds.bug2);
            const winnings = Math.floor(currentBet.amount * mult);
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
// MATCHUP
// ============================================

function setupNextFight() {
    nextBugs.bug1 = BugFactory.createRandom();
    nextBugs.bug2 = BugFactory.createRandom();
    updateMatchupDisplay();
}

function updateMatchupDisplay() {
    const b1 = nextBugs.bug1;
    const b2 = nextBugs.bug2;
    const odds = calculateOdds(b1, b2);

    // Fighter 1
    document.getElementById('fighter1-name').textContent = b1.name;
    document.getElementById('fighter1-stats').innerHTML =
        `BLK:${b1.genome.bulk} SPD:${b1.genome.speed} FRY:${b1.genome.fury} INS:${b1.genome.instinct}`;
    document.getElementById('fighter1-attrs').innerHTML =
        `<span class="weapon">${b1.genome.weapon}</span> ` +
        `<span class="defense">${b1.genome.defense}</span> ` +
        `<span class="mobility">${b1.genome.mobility}</span>`;
    document.getElementById('odds1').textContent = odds.bug1 + 'x';

    // Fighter 2
    document.getElementById('fighter2-name').textContent = b2.name;
    document.getElementById('fighter2-stats').innerHTML =
        `BLK:${b2.genome.bulk} SPD:${b2.genome.speed} FRY:${b2.genome.fury} INS:${b2.genome.instinct}`;
    document.getElementById('fighter2-attrs').innerHTML =
        `<span class="weapon">${b2.genome.weapon}</span> ` +
        `<span class="defense">${b2.genome.defense}</span> ` +
        `<span class="mobility">${b2.genome.mobility}</span>`;
    document.getElementById('odds2').textContent = odds.bug2 + 'x';
}

// ============================================
// GAME FLOW
// ============================================

function startCountdown() {
    gameState = 'countdown';
    countdownTimer = COUNTDOWN_SECONDS;
    lastCountdownUpdate = Date.now();
    fightNumber++;
    bloodStains = [];

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
        if (countdownTimer <= 0) startFight();
    }
}

function startFight() {
    fighters = [
        new Fighter(nextBugs.bug1, 'left'),
        new Fighter(nextBugs.bug2, 'right')
    ];

    particles = [];
    combatTick = 0;
    hitPause = 0;
    slowMotion = 1;
    gameState = 'fighting';

    document.getElementById('countdown-display').classList.add('hidden');
    document.getElementById('bet-buttons').classList.add('disabled');

    addCommentary(`${fighters[0].bug.name} vs ${fighters[1].bug.name}!`, '#ff0');
    addCommentary("FIGHT!", '#f00');

    // Camouflage first strike
    fighters.forEach(f => {
        if (f.genome.defense === 'camouflage') {
            f.attackCooldown = 5;
            addCommentary(`${f.bug.name} strikes from the shadows!`, '#595');
        }
    });
}

function endFight() {
    gameState = 'victory';
    const winner = fighters.find(f => f.isAlive);
    const winnerSide = winner === fighters[0] ? 1 : 2;

    if (winner) {
        winner.setState('victory');
        addCommentary(`${winner.bug.name} WINS!`, '#ff0');
        resolveBet(winnerSide);

        for (let i = 0; i < 5; i++) {
            setTimeout(() => spawnParticles(winner.x, winner.y - 20, 'spark', 8), i * 200);
        }
    }

    setTimeout(startCountdown, 4000);
}

// ============================================
// RENDERING
// ============================================

function renderArena() {
    if (hitPause > 0) hitPause--;

    screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.9;

    if (impactFlash.active) {
        impactFlash.alpha *= 0.85;
        impactFlash.radius *= 1.1;
        if (impactFlash.alpha < 0.05) impactFlash.active = false;
    }

    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    // Background
    const gradient = ctx.createRadialGradient(300, 300, 50, 300, 300, 350);
    gradient.addColorStop(0, '#8B7355');
    gradient.addColorStop(0.5, '#6B5344');
    gradient.addColorStop(1, '#3a2718');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#1a0a00';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 150, 560, 250);
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 158, 544, 234);

    // Blood stains
    bloodStains.forEach(s => {
        ctx.globalAlpha = s.alpha * 0.6;
        ctx.fillStyle = '#400';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Impact flash
    if (impactFlash.active) {
        ctx.globalAlpha = impactFlash.alpha;
        const fg = ctx.createRadialGradient(impactFlash.x, impactFlash.y, 0, impactFlash.x, impactFlash.y, impactFlash.radius);
        fg.addColorStop(0, '#fff');
        fg.addColorStop(0.5, '#ff8');
        fg.addColorStop(1, 'transparent');
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    }

    // Fighters
    fighters.forEach(f => f.render(ctx, 4));

    // Particles
    particles.forEach(p => { p.update(); p.render(ctx); });
    particles = particles.filter(p => p.life > 0);

    ctx.restore();

    // Title
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUG FIGHTS', 300, 40);

    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText(`FIGHT #${fightNumber}`, 300, 60);

    // VS
    if (fighters.length === 2 || gameState === 'countdown') {
        ctx.fillStyle = '#f00';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('VS', 300, 130);

        const n1 = gameState === 'countdown' ? nextBugs.bug1.name : fighters[0].bug.name;
        const n2 = gameState === 'countdown' ? nextBugs.bug2.name : fighters[1].bug.name;

        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(n1, 30, 130);
        ctx.textAlign = 'right';
        ctx.fillText(n2, 570, 130);
    }

    // Countdown
    if (gameState === 'countdown') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(200, 240, 200, 100);
        ctx.fillStyle = countdownTimer <= 3 ? '#f00' : '#ff0';
        ctx.font = 'bold 56px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(countdownTimer, 300, 305);
        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.fillText('PLACE YOUR BETS', 300, 330);
    }

    // Commentary
    ctx.textAlign = 'left';
    ctx.font = '12px monospace';
    commentary.forEach((c, i) => {
        c.age++;
        ctx.globalAlpha = Math.max(0, 1 - c.age / 180);
        ctx.fillStyle = c.color;
        ctx.fillText(c.text, 30, 430 + i * 16);
    });
    ctx.globalAlpha = 1;
    commentary = commentary.filter(c => c.age < 180);
}

function gameLoopFn() {
    updateCountdown();

    fighters.forEach(f => {
        f.updateAnimation();
        if (gameState === 'fighting') {
            f.updateMovement(fighters.find(o => o !== f));
        }
    });

    if (gameState === 'fighting') processCombatTick();
    renderArena();
    gameLoop = requestAnimationFrame(gameLoopFn);
}

// ============================================
// UI
// ============================================

function updateUI() {
    document.getElementById('money').textContent = player.money;
    if (currentBet.amount > 0) {
        const name = currentBet.on === 1 ? nextBugs.bug1.name : nextBugs.bug2.name;
        document.getElementById('current-bet').textContent = `$${currentBet.amount} on ${name}`;
    } else {
        document.getElementById('current-bet').textContent = 'None';
    }
}

function initGame() {
    canvas = document.getElementById('arena');
    ctx = canvas.getContext('2d');

    document.getElementById('bet-fighter1').addEventListener('click', () => placeBet(1));
    document.getElementById('bet-fighter2').addEventListener('click', () => placeBet(2));

    fighters = [];
    updateUI();
    startCountdown();
    gameLoopFn();
}

document.addEventListener('DOMContentLoaded', initGame);
