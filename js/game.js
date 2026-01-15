// Bug Fights - Game Engine v2
// Enhanced visual feedback: hit pause, anticipation, lunges, impact effects

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

const ATTRIBUTES = {
    venomous: { desc: "Attacks can poison", color: '#0f0' },
    armored: { desc: "Reduces damage", color: '#888' },
    winged: { desc: "Harder to hit", color: '#aaf' },
    mandibles: { desc: "Powerful bite", color: '#a50' },
    stinger: { desc: "Pierces armor", color: '#f80' },
    regenerative: { desc: "Heals over time", color: '#5f5' },
    multistrike: { desc: "Multiple attacks", color: '#ff0' },
    burrower: { desc: "Can dodge", color: '#850' },
    webspinner: { desc: "Slows enemies", color: '#fff' },
    camouflage: { desc: "First strike", color: '#595' }
};

// ============================================
// GAME STATE
// ============================================

let canvas, ctx;
let gameState = 'countdown';
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

// Countdown
const COUNTDOWN_SECONDS = 10;
let countdownTimer = COUNTDOWN_SECONDS;
let lastCountdownUpdate = 0;
let fightNumber = 0;

// Hit pause system - freezes the game briefly on impacts
let hitPause = 0;
let impactFlash = { active: false, x: 0, y: 0, radius: 0, alpha: 0 };

// Slow motion for dramatic moments
let slowMotion = 1;

// ============================================
// FIGHTER CLASS
// ============================================

class Fighter {
    constructor(bugKey, side) {
        this.key = bugKey;
        this.data = BUG_DATA[bugKey];
        this.sprite = SPRITES[bugKey];
        this.side = side;

        // Position
        this.x = side === 'left' ? 120 : 480;
        this.y = 275;
        this.baseX = this.x;
        this.baseY = this.y;
        this.targetX = this.x;
        this.targetY = this.y;
        this.facingRight = side === 'left';

        // Combat stats
        this.maxHp = 50 + this.data.stats.VIT * 10;
        this.hp = this.maxHp;
        this.poisoned = 0;
        this.webbed = 0;
        this.attackCooldown = 30 + Math.random() * 30;

        // Animation state machine
        // States: idle, windup, attack, hit, death, victory
        this.state = 'idle';
        this.animTick = 0;
        this.animFrame = 0;
        this.stateTimer = 0;

        // Attack targeting
        this.attackTarget = null;
        this.lungeX = 0;
        this.lungeY = 0;

        // Visual effects
        this.flashTimer = 0;
        this.squash = 1; // For squash/stretch
        this.stretch = 1;

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
            this.stateTimer = 0;
        }
    }

    updateAnimation() {
        if (hitPause > 0) return; // Frozen during hit pause

        this.stateTimer++;
        this.animTick++;

        // Decay visual effects
        if (this.flashTimer > 0) this.flashTimer--;
        this.squash += (1 - this.squash) * 0.2;
        this.stretch += (1 - this.stretch) * 0.2;

        // Decay lunge
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
                    if (this.isAlive) {
                        this.setState('idle');
                    } else {
                        this.setState('death');
                    }
                } else {
                    this.animFrame = 0;
                }
            }
        }

        // Windup state - shake and prepare
        if (this.state === 'windup') {
            // Vibrate in anticipation
            this.lungeX = (Math.random() - 0.5) * 4;
            this.lungeY = (Math.random() - 0.5) * 2;

            // After windup, execute attack
            if (this.stateTimer >= 12) {
                this.executeAttack();
            }
        }

        // Victory dance
        if (this.state === 'victory') {
            if (this.stateTimer % 20 < 10) {
                this.squash = 0.9;
                this.stretch = 1.1;
            } else {
                this.squash = 1.1;
                this.stretch = 0.9;
            }
        }
    }

    startAttack(target) {
        if (this.state !== 'idle') return;
        this.attackTarget = target;
        this.setState('windup');

        // Face target
        this.facingRight = target.x > this.x;
    }

    executeAttack() {
        if (!this.attackTarget || !this.isAlive) return;

        const target = this.attackTarget;
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.setState('attack');

        // Lunge toward target
        const lungeStrength = 30;
        this.lungeX = (dx / dist) * lungeStrength;
        this.lungeY = (dy / dist) * lungeStrength * 0.5;

        // Squash on attack
        this.squash = 0.7;
        this.stretch = 1.3;

        // Hit check
        const hitRoll = rollDice(20) + this.data.stats.SPD;
        const dodgeRoll = rollDice(20) + target.data.stats.INS;
        const evasionBonus = target.data.attributes.includes('winged') ? 5 : 0;

        if (hitRoll > dodgeRoll + evasionBonus) {
            // Calculate damage
            let damage = this.data.stats.PWR + rollDice(6);
            if (this.data.attributes.includes('mandibles')) damage += 2;

            let armor = target.data.stats.ARM;
            if (this.data.attributes.includes('stinger')) armor = Math.floor(armor / 2);
            damage -= Math.floor(armor / 2);

            // Crit check
            let isCrit = false;
            if (rollDice(20) <= this.data.stats.FER) {
                damage = Math.floor(damage * 1.5);
                isCrit = true;
                addCommentary(`CRITICAL HIT!`, '#ff0');
            }

            damage = Math.max(1, damage);

            // Multistrike
            let strikes = 1;
            if (this.data.attributes.includes('multistrike') && rollDice(4) === 4) {
                strikes = 2;
                addCommentary(`${this.data.name} strikes twice!`, '#ff0');
            }

            // Apply damage with delay for impact feel
            setTimeout(() => {
                for (let i = 0; i < strikes; i++) {
                    this.applyHit(target, damage, isCrit);
                }
            }, 50);
        } else {
            // Miss
            spawnParticles(this.x + dx * 0.7, this.y + dy * 0.7, 'dust', 5);
            addCommentary(`${this.data.name} misses!`, '#888');
        }

        this.attackTarget = null;
    }

    applyHit(target, damage, isCrit) {
        if (!target.isAlive) return;

        target.hp -= damage;
        target.setState('hit');

        // Hit pause - more for crits and kills
        const pauseFrames = isCrit ? 12 : (target.hp <= 0 ? 20 : 8);
        hitPause = Math.max(hitPause, pauseFrames);

        // Screen shake - more for crits
        screenShake.intensity = isCrit ? 15 : 8;

        // Impact flash
        impactFlash = {
            active: true,
            x: target.x,
            y: target.y,
            radius: isCrit ? 60 : 40,
            alpha: 1
        };

        // Target visual feedback
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

        // Particles - more for crits
        const particleCount = isCrit ? 15 : 8;
        spawnParticles(target.x, target.y, 'blood', particleCount);
        if (isCrit) {
            spawnParticles(target.x, target.y, 'spark', 10);
        }
        addBloodStain(target.x, target.y + 15);

        // Status effects
        if (this.data.attributes.includes('venomous') && rollDice(4) === 4) {
            target.poisoned = 5;
            addCommentary(`${target.data.name} is poisoned!`, '#0f0');
            spawnParticles(target.x, target.y, 'poison', 10);
        }

        if (this.data.attributes.includes('webspinner') && rollDice(4) === 4) {
            target.webbed = 4;
            addCommentary(`${target.data.name} is webbed!`, '#fff');
            spawnParticles(target.x, target.y, 'web', 12);
        }

        addCommentary(`${this.data.name} deals ${damage} damage!`, isCrit ? '#ff0' : '#f80');

        // Death check
        if (target.hp <= 0) {
            target.hp = 0;
            target.setState('death');
            hitPause = 25; // Extra long pause for kills
            slowMotion = 0.3; // Slow-mo on kill
            setTimeout(() => { slowMotion = 1; }, 500);
            addCommentary(`${target.data.name} is DEFEATED!`, '#f00');
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

        // Face opponent
        if (this.state === 'idle') {
            this.facingRight = dx > 0;
        }

        const moveSpeed = (0.5 + this.data.stats.SPD * 0.15) * slowMotion;
        const preferred = this.data.preferredDistance;
        const webPenalty = this.webbed > 0 ? 0.3 : 1;

        // Circle around
        if (this.moveTimer % 3 === 0) {
            this.circleAngle += (this.side === 'left' ? 0.02 : -0.02) * this.data.stats.SPD * webPenalty;
        }

        // Calculate target position
        if (dist < preferred - 20) {
            this.targetX = this.x - dx * 0.1;
            this.targetY = this.y - dy * 0.1;
        } else if (dist > preferred + 20) {
            this.targetX = this.x + dx * 0.1;
            this.targetY = this.y + dy * 0.1;
        } else {
            this.targetX = opponent.x + Math.cos(this.circleAngle) * preferred;
            this.targetY = opponent.y + Math.sin(this.circleAngle) * preferred * 0.5;
        }

        // Clamp to arena
        this.targetX = Math.max(50, Math.min(550, this.targetX));
        this.targetY = Math.max(200, Math.min(360, this.targetY));

        // Move toward target
        this.x += (this.targetX - this.x) * moveSpeed * 0.1 * webPenalty;
        this.y += (this.targetY - this.y) * moveSpeed * 0.1 * webPenalty;
    }

    render(ctx, scale) {
        const spriteState = (this.state === 'windup' || this.state === 'victory') ? 'idle' : this.state;
        const frames = this.sprite[spriteState];
        const frame = frames[Math.min(this.animFrame, frames.length - 1)];
        const colors = this.sprite.colors;

        const size = 16 * scale;

        // Apply lunge offset
        const renderX = this.x + this.lungeX;
        const renderY = this.y + this.lungeY;

        // Apply squash/stretch
        const scaleX = scale * this.squash;
        const scaleY = scale * this.stretch;
        const sizeX = 16 * scaleX;
        const sizeY = 16 * scaleY;

        const startX = renderX - sizeX / 2;
        const startY = renderY - sizeY / 2 + (size - sizeY) / 2; // Anchor to bottom

        ctx.save();

        // Flash white when hit
        if (this.flashTimer > 0) {
            ctx.globalAlpha = 0.5 + (this.flashTimer / 16);
        }

        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const colorIdx = parseInt(frame[py][this.facingRight ? px : 15 - px]);
                if (colorIdx === 0) continue;

                // Flash white on hit
                if (this.flashTimer > 0 && this.flashTimer % 2 === 0) {
                    ctx.fillStyle = '#fff';
                } else {
                    ctx.fillStyle = colors[colorIdx];
                }

                ctx.fillRect(
                    startX + px * scaleX,
                    startY + py * scaleY,
                    scaleX + 0.5,
                    scaleY + 0.5
                );
            }
        }

        ctx.restore();

        // Health bar
        if (this.isAlive || this.state === 'death') {
            const barWidth = 50;
            const barHeight = 6;
            const barX = this.x - barWidth / 2;
            const barY = renderY - size / 2 - 20;

            // Background
            ctx.fillStyle = '#000';
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Health
            const hpPercent = Math.max(0, this.hp / this.maxHp);
            const hpColor = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
            ctx.fillStyle = hpColor;
            ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * hpPercent, barHeight - 2);

            // Status indicators
            let indicatorX = barX + barWidth + 4;
            if (this.poisoned > 0) {
                ctx.fillStyle = '#0f0';
                ctx.fillRect(indicatorX, barY, 4, barHeight);
                indicatorX += 6;
            }
            if (this.webbed > 0) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(indicatorX, barY, 4, barHeight);
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
                this.size = 2 + Math.random() * 2;
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
                this.size = 2;
                break;
            case 'web':
                this.vx = (Math.random() - 0.5) * 3;
                this.vy = Math.random() * 2;
                this.color = '#fff';
                this.gravity = 0.1;
                this.decay = 0.01;
                this.size = 1;
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
            // Draw spark as a line
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
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, type));
    }
}

function addBloodStain(x, y) {
    bloodStains.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        size: 4 + Math.random() * 8,
        alpha: 0.4 + Math.random() * 0.3
    });
    if (bloodStains.length > 40) bloodStains.shift();
}

// ============================================
// COMBAT SYSTEM
// ============================================

function rollDice(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function processCombatTick() {
    if (gameState !== 'fighting') return;
    if (hitPause > 0) return;

    combatTick++;

    const [f1, f2] = fighters;

    if (!f1.isAlive || !f2.isAlive) {
        endFight();
        return;
    }

    // Process poison
    fighters.forEach(f => {
        if (f.poisoned > 0 && combatTick % 30 === 0) {
            f.hp -= 3;
            f.poisoned--;
            f.flashTimer = 4;
            spawnParticles(f.x, f.y, 'poison', 3);
            if (f.hp <= 0) {
                f.hp = 0;
                f.setState('death');
                hitPause = 20;
                addCommentary(`${f.data.name} succumbs to poison!`, '#0f0');
                spawnParticles(f.x, f.y, 'blood', 20);
            }
        }
        if (f.webbed > 0 && combatTick % 60 === 0) f.webbed--;
    });

    // Regeneration
    fighters.forEach(f => {
        if (f.isAlive && f.data.attributes.includes('regenerative') && combatTick % 40 === 0) {
            f.hp = Math.min(f.maxHp, f.hp + 3);
            spawnParticles(f.x, f.y, 'spark', 5);
        }
    });

    // Attack cooldowns
    fighters.forEach((f, i) => {
        if (!f.isAlive) return;
        if (f.state !== 'idle') return;

        f.attackCooldown -= slowMotion;
        if (f.attackCooldown <= 0) {
            const opponent = fighters[1 - i];
            const dx = opponent.x - f.x;
            const dy = opponent.y - f.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 120) {
                f.startAttack(opponent);
                const cooldown = Math.max(30, 80 - f.data.stats.SPD * 5);
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
    const f1Power = new Fighter(bug1, 'left').getPowerRating();
    const f2Power = new Fighter(bug2, 'right').getPowerRating();
    const total = f1Power + f2Power;

    return {
        [bug1]: (total / f1Power).toFixed(2),
        [bug2]: (total / f2Power).toFixed(2)
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

    if (currentBet.amount > 0) {
        player.money += currentBet.amount;
    }

    currentBet = { amount, on: bugKey };
    player.money -= amount;
    updateUI();

    addCommentary(`Bet $${amount} on ${BUG_DATA[bugKey].name}!`, '#0f0');
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
// MATCHUP SYSTEM
// ============================================

function getRandomBugs() {
    const keys = Object.keys(BUG_DATA);
    const bug1 = keys[Math.floor(Math.random() * keys.length)];
    let bug2 = bug1;
    while (bug2 === bug1) {
        bug2 = keys[Math.floor(Math.random() * keys.length)];
    }
    return { bug1, bug2 };
}

function setupNextFight() {
    nextFighters = getRandomBugs();
    updateMatchupDisplay();
}

function updateMatchupDisplay() {
    const b1 = BUG_DATA[nextFighters.bug1];
    const b2 = BUG_DATA[nextFighters.bug2];
    const odds = calculateOdds(nextFighters.bug1, nextFighters.bug2);

    document.getElementById('fighter1-name').textContent = b1.name;
    document.getElementById('fighter1-stats').innerHTML =
        `PWR:${b1.stats.PWR} SPD:${b1.stats.SPD} ARM:${b1.stats.ARM}<br>` +
        `VIT:${b1.stats.VIT} FER:${b1.stats.FER} INS:${b1.stats.INS}`;
    document.getElementById('fighter1-attrs').innerHTML =
        b1.attributes.map(a => `<span style="color:${ATTRIBUTES[a].color}">${a}</span>`).join(' ');
    document.getElementById('odds1').textContent = odds[nextFighters.bug1] + 'x';

    document.getElementById('fighter2-name').textContent = b2.name;
    document.getElementById('fighter2-stats').innerHTML =
        `PWR:${b2.stats.PWR} SPD:${b2.stats.SPD} ARM:${b2.stats.ARM}<br>` +
        `VIT:${b2.stats.VIT} FER:${b2.stats.FER} INS:${b2.stats.INS}`;
    document.getElementById('fighter2-attrs').innerHTML =
        b2.attributes.map(a => `<span style="color:${ATTRIBUTES[a].color}">${a}</span>`).join(' ');
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

    particles = [];
    combatTick = 0;
    hitPause = 0;
    slowMotion = 1;
    gameState = 'fighting';

    document.getElementById('countdown-display').classList.add('hidden');
    document.getElementById('bet-buttons').classList.add('disabled');

    addCommentary(`${fighters[0].data.name} vs ${fighters[1].data.name}!`, '#ff0');
    addCommentary("FIGHT!", '#f00');

    // Camouflage first strike
    fighters.forEach(f => {
        if (f.data.attributes.includes('camouflage')) {
            f.attackCooldown = 10;
            addCommentary(`${f.data.name} strikes from the shadows!`, '#595');
        }
    });
}

function endFight() {
    gameState = 'victory';
    const winner = fighters.find(f => f.isAlive);

    if (winner) {
        winner.setState('victory');
        addCommentary(`${winner.data.name} WINS!`, '#ff0');
        resolveBet(winner);

        // Victory particles
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                spawnParticles(winner.x, winner.y - 20, 'spark', 8);
            }, i * 200);
        }
    }

    setTimeout(() => {
        startCountdown();
    }, 4000);
}

// ============================================
// RENDERING
// ============================================

function renderArena() {
    // Hit pause countdown
    if (hitPause > 0) hitPause--;

    // Screen shake
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.9;

    // Impact flash decay
    if (impactFlash.active) {
        impactFlash.alpha *= 0.85;
        impactFlash.radius *= 1.1;
        if (impactFlash.alpha < 0.05) impactFlash.active = false;
    }

    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    // Arena background
    const gradient = ctx.createRadialGradient(300, 300, 50, 300, 300, 350);
    gradient.addColorStop(0, '#8B7355');
    gradient.addColorStop(0.5, '#6B5344');
    gradient.addColorStop(1, '#3a2718');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Arena border
    ctx.strokeStyle = '#1a0a00';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 150, 560, 250);

    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 158, 544, 234);

    // Blood stains
    bloodStains.forEach(stain => {
        ctx.globalAlpha = stain.alpha * 0.6;
        ctx.fillStyle = '#400';
        ctx.beginPath();
        ctx.arc(stain.x, stain.y, stain.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Impact flash
    if (impactFlash.active) {
        ctx.globalAlpha = impactFlash.alpha;
        const flashGrad = ctx.createRadialGradient(
            impactFlash.x, impactFlash.y, 0,
            impactFlash.x, impactFlash.y, impactFlash.radius
        );
        flashGrad.addColorStop(0, '#fff');
        flashGrad.addColorStop(0.5, '#ff8');
        flashGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    }

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

    // Fighter names
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

    if (gameState === 'fighting') {
        processCombatTick();
    }

    renderArena();
    gameLoop = requestAnimationFrame(gameLoopFn);
}

// ============================================
// UI
// ============================================

function updateUI() {
    document.getElementById('money').textContent = player.money;

    if (currentBet.amount > 0) {
        document.getElementById('current-bet').textContent = `$${currentBet.amount} on ${BUG_DATA[currentBet.on].name}`;
    } else {
        document.getElementById('current-bet').textContent = 'None';
    }
}

function initGame() {
    canvas = document.getElementById('arena');
    ctx = canvas.getContext('2d');

    document.getElementById('bet-fighter1').addEventListener('click', () => placeBet(nextFighters.bug1));
    document.getElementById('bet-fighter2').addEventListener('click', () => placeBet(nextFighters.bug2));

    fighters = [];
    updateUI();
    startCountdown();
    gameLoopFn();
}

document.addEventListener('DOMContentLoaded', initGame);
