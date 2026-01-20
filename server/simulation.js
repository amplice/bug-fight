// Bug Fights - Server Simulation
// Handles all game logic, runs 24/7

const BugGenome = require('./BugGenome');

// ============================================
// CONSTANTS
// ============================================

const ARENA = {
    width: 900,
    height: 600,
    floorY: 550,
    ceilingY: 80,
    leftWall: 50,
    rightWall: 850,
};

const COUNTDOWN_SECONDS = 10;
const TICK_RATE = 30; // ticks per second
const TICK_MS = 1000 / TICK_RATE;

// ============================================
// HELPER FUNCTIONS
// ============================================

function rollDice(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// ============================================
// FIGHTER CLASS (Server - No Rendering)
// ============================================

class Fighter {
    constructor(genome, side, name) {
        this.genome = genome;
        this.name = name;
        this.side = side;

        // Mobility type
        this.isFlying = genome.mobility === 'winged';
        this.isWallcrawler = genome.mobility === 'wallcrawler';
        this.isGround = genome.mobility === 'ground';

        // Position
        this.initializePosition();
        this.facingRight = side === 'left';

        // Combat stats
        this.maxHp = 30 + Math.floor(genome.bulk * 1.2);
        this.hp = this.maxHp;
        this.poisoned = 0;
        this.attackCooldown = 30 + Math.random() * 30;

        // Animation state
        this.state = 'idle';
        this.animFrame = 0;
        this.animTick = 0;
        this.stateTimer = 0;

        // Victory/Death animation
        this.victoryBounce = 0;
        this.deathRotation = 0;
        this.deathAlpha = 1;

        // Physics
        this.vx = 0;
        this.vy = 0;
        this.mass = 0.5 + (genome.bulk / 100) * 1.5;
        this.grounded = !this.isFlying;
        this.gravity = this.isFlying ? 0.05 : 0.6;
        this.friction = 0.85;
        this.airFriction = 0.95;

        // Jump
        this.jumpPower = this.calculateJumpPower();
        this.jumpCooldown = 0;

        // AI
        this.aiState = 'aggressive';
        this.aiStateTimer = 0;
        this.stunTimer = 0;
        this.moveTimer = 0;
        this.circleAngle = side === 'left' ? 0 : Math.PI;

        // Wall climbing
        this.onWall = false;
        this.wallSide = null;

        // Drive system
        const furyNorm = genome.fury / 100;
        this.drives = {
            aggression: 0.3 + furyNorm * 0.4,
            caution: 0.3 + (1 - furyNorm) * 0.4,
            adaptRate: 0.02 + (genome.instinct / 100) * 0.03,
        };

        // Stamina
        this.maxStamina = 50 + genome.bulk;
        this.stamina = this.maxStamina;
        this.staminaRegen = 0.3 + (genome.speed / 100) * 0.5;

        // Visual state (for client)
        this.squash = 1;
        this.stretch = 1;
        this.lungeX = 0;
        this.lungeY = 0;
        this.flashTimer = 0;

        // Size multiplier for bounds
        this.sizeMultiplier = genome.getSizeMultiplier();
        this.spriteSize = Math.round(32 * this.sizeMultiplier);
        this.spriteSize = Math.max(20, Math.min(48, this.spriteSize));
    }

    calculateJumpPower() {
        const legStyle = this.genome.legStyle;
        const baseJump = 8 + (this.genome.speed / 20);
        switch (legStyle) {
            case 'curved-back':
            case 'curved-forward':
                return baseJump * 1.5;
            case 'short':
                return baseJump * 0.5;
            default:
                return baseJump;
        }
    }

    initializePosition() {
        if (this.isGround) {
            this.x = this.side === 'left' ? 200 : 700;
            this.y = ARENA.floorY - 20;
        } else if (this.isFlying) {
            this.x = this.side === 'left' ? 200 : 700;
            this.y = ARENA.ceilingY + 100 + Math.random() * 150;
        } else if (this.isWallcrawler) {
            this.x = this.side === 'left' ? 150 : 750;
            this.y = ARENA.floorY - 20;
        }
    }

    get isAlive() {
        return this.hp > 0;
    }

    getPowerRating() {
        const g = this.genome;
        let rating = g.bulk + g.speed + g.fury + g.instinct;
        if (g.weapon === 'claws') rating += 10;
        if (g.weapon === 'stinger') rating += 8;
        if (g.defense === 'shell') rating += 10;
        if (g.mobility === 'winged') rating += 15;
        if (g.mobility === 'wallcrawler') rating += 10;
        return rating;
    }

    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.animFrame = 0;
            this.stateTimer = 0;
        }
    }

    getAttackStaminaCost() {
        switch (this.genome.weapon) {
            case 'mandibles': return 15;
            case 'stinger': return 10;
            case 'claws': return 8;
            case 'fangs': return 10;
            default: return 10;
        }
    }

    spendStamina(amount) {
        if (this.stamina >= amount) {
            this.stamina -= amount;
            return true;
        }
        return false;
    }

    hasStamina(amount) {
        return this.stamina >= amount;
    }

    // Drive system updates
    onHitLanded(damage) {
        this.drives.aggression = Math.min(1, this.drives.aggression + this.drives.adaptRate * 2);
        this.drives.caution = Math.max(0, this.drives.caution - this.drives.adaptRate);
    }

    onDamageTaken(damage) {
        const furyNorm = this.genome.fury / 100;
        if (furyNorm > 0.5) {
            this.drives.aggression = Math.min(1, this.drives.aggression + this.drives.adaptRate * furyNorm * 3);
        } else {
            this.drives.caution = Math.min(1, this.drives.caution + this.drives.adaptRate * (1 - furyNorm) * 3);
            this.drives.aggression = Math.max(0, this.drives.aggression - this.drives.adaptRate);
        }
    }

    updateDrives() {
        const furyNorm = this.genome.fury / 100;
        const baseAggression = 0.3 + furyNorm * 0.4;
        const baseCaution = 0.3 + (1 - furyNorm) * 0.4;

        this.drives.aggression += (baseAggression - this.drives.aggression) * 0.001;
        this.drives.caution += (baseCaution - this.drives.caution) * 0.001;

        const staminaPercent = this.stamina / this.maxStamina;
        if (staminaPercent < 0.3) {
            const exhaustionFactor = (0.3 - staminaPercent) * 2;
            this.drives.caution = Math.min(1, this.drives.caution + exhaustionFactor * 0.02);
            this.drives.aggression = Math.max(0, this.drives.aggression - exhaustionFactor * 0.02);
        }

        const regenMultiplier = this.aiState === 'circling' || this.aiState === 'retreating' ? 1.5 : 1.0;
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * regenMultiplier);
    }

    // Update state timers, animation frames, and special animations
    updateState() {
        this.stateTimer++;
        this.animTick++;

        // Animation frame cycling
        const frameCount = { idle: 4, attack: 4, hit: 2, death: 4, victory: 4 };
        const frameDelay = this.state === 'idle' ? 8 : 5;

        if (this.animTick >= frameDelay) {
            this.animTick = 0;
            this.animFrame++;
            const maxFrames = frameCount[this.state] || 4;
            if (this.animFrame >= maxFrames) {
                if (this.state === 'death') {
                    this.animFrame = maxFrames - 1; // Stay on last frame
                } else if (this.state === 'attack') {
                    this.setState('idle');
                } else if (this.state === 'hit') {
                    this.isAlive ? this.setState('idle') : this.setState('death');
                } else {
                    this.animFrame = 0; // Loop
                }
            }
        }

        // Victory animation - bouncing
        if (this.state === 'victory') {
            this.victoryBounce = Math.sin(this.stateTimer / 8) * 10;
        } else {
            this.victoryBounce = 0;
        }

        // Death animation - rotation and fade
        if (this.state === 'death') {
            const targetRotation = this.facingRight ? Math.PI / 2 : -Math.PI / 2;
            this.deathRotation += (targetRotation - this.deathRotation) * 0.1;
            if (this.stateTimer > 120) {
                this.deathAlpha = Math.max(0.3, this.deathAlpha - 0.005);
            }
        } else {
            this.deathRotation = 0;
            this.deathAlpha = 1;
        }
    }

    // Physics update
    updatePhysics() {
        if (!this.isAlive || this.state === 'death') return;

        const halfSize = this.spriteSize / 2;
        const bounceFactor = 0.6;

        if (!this.onWall) {
            this.vy += this.gravity;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Floor
        const floorLevel = ARENA.floorY - halfSize;
        if (this.y >= floorLevel) {
            this.y = floorLevel;
            if (this.isFlying) {
                this.vy = -Math.abs(this.vy) * bounceFactor;
            } else {
                this.vy = 0;
                this.grounded = true;
                if (this.onWall) this.onWall = false;
            }
        } else if (!this.onWall && !this.isFlying) {
            this.grounded = false;
        }

        // Ceiling
        const ceilingLevel = ARENA.ceilingY + halfSize;
        if (this.y < ceilingLevel) {
            this.y = ceilingLevel;
            this.vy = Math.abs(this.vy) * bounceFactor;
        }

        // Walls
        const leftLimit = ARENA.leftWall + halfSize;
        if (this.x < leftLimit) {
            this.x = leftLimit;
            if (this.isWallcrawler && !this.onWall && this.grounded) {
                this.onWall = true;
                this.wallSide = 'left';
                this.vx = 0;
            } else {
                this.vx = Math.abs(this.vx) * bounceFactor;
            }
        }

        const rightLimit = ARENA.rightWall - halfSize;
        if (this.x > rightLimit) {
            this.x = rightLimit;
            if (this.isWallcrawler && !this.onWall && this.grounded) {
                this.onWall = true;
                this.wallSide = 'right';
                this.vx = 0;
            } else {
                this.vx = -Math.abs(this.vx) * bounceFactor;
            }
        }

        // Friction
        const frictionFactor = this.grounded ? this.friction : this.airFriction;
        this.vx *= frictionFactor;
        if (this.isFlying) this.vy *= this.airFriction;

        if (this.jumpCooldown > 0) this.jumpCooldown--;
        if (this.stunTimer > 0) this.stunTimer--;

        // Visual decay
        this.squash += (1 - this.squash) * 0.2;
        this.stretch += (1 - this.stretch) * 0.2;
        this.lungeX *= 0.85;
        this.lungeY *= 0.85;
        if (this.flashTimer > 0) this.flashTimer--;
    }

    jump(power = 1.0) {
        if (this.jumpCooldown > 0) return false;
        if (!this.grounded && !this.onWall && !this.isFlying) return false;

        const jumpStaminaCost = Math.floor(5 * power);
        if (!this.spendStamina(jumpStaminaCost)) return false;

        const jumpForce = this.jumpPower * power;

        if (this.onWall) {
            this.vy = -jumpForce * 0.8;
            this.vx = this.wallSide === 'left' ? 6 : -6;
            this.onWall = false;
            this.grounded = false;
        } else {
            this.vy = -jumpForce;
            this.grounded = false;
        }

        this.jumpCooldown = 20;
        this.squash = 0.7;
        this.stretch = 1.3;
        return true;
    }

    // AI
    updateAI(opponent) {
        if (!this.isAlive || this.state === 'death') return;
        if (this.state === 'windup' || this.state === 'attack') return;

        this.moveTimer++;
        this.aiStateTimer++;

        const dx = opponent.x - this.x;
        const dy = opponent.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Attack range based on combined sprite sizes
        const attackRange = (this.spriteSize + opponent.spriteSize) / 2 + 15;

        if (this.state === 'idle' && !this.onWall) {
            this.facingRight = dx > 0;
        }

        if (this.stunTimer > 0) {
            this.aiState = 'stunned';
            return;
        }

        this.updateAIStateTransitions(opponent, dist, attackRange);

        switch (this.aiState) {
            case 'aggressive':
                this.executeAggressiveAI(opponent, dx, dy, dist, attackRange);
                break;
            case 'circling':
                this.executeCirclingAI(opponent, dx, dy, dist);
                break;
            case 'retreating':
                this.executeRetreatingAI(opponent, dx, dy, dist);
                break;
        }

        if (this.isWallcrawler) {
            this.updateWallClimbing(opponent, dist);
        }
    }

    updateAIStateTransitions(opponent, dist, attackRange) {
        const hpPercent = this.hp / this.maxHp;
        const { aggression, caution } = this.drives;

        if (hpPercent < 0.4 && caution > 0.5 && (this.isFlying || this.isWallcrawler) && Math.random() < caution * 0.08) {
            this.aiState = 'retreating';
            this.aiStateTimer = 0;
        } else if (dist < attackRange * 1.5 && Math.random() < aggression * 0.12) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        } else if (dist < attackRange * 2 && this.aiStateTimer > 40 && Math.random() < caution * 0.06) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
            this.circleAngle = Math.atan2(this.y - opponent.y, this.x - opponent.x);
        } else if (dist > attackRange * 2 && this.aiStateTimer > Math.floor(60 - aggression * 40)) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeAggressiveAI(opponent, dx, dy, dist, attackRange) {
        const baseSpeed = 0.3 + (this.genome.speed / 150);
        const staminaPercent = this.stamina / this.maxStamina;
        const staminaFactor = 0.5 + staminaPercent * 0.5;
        const speed = baseSpeed * (0.7 + this.drives.aggression * 0.6) * staminaFactor;

        if (this.isFlying) {
            const heightAdvantage = this.y < opponent.y - 30;
            if (heightAdvantage && dist < attackRange * 1.5) {
                this.vx += Math.sign(dx) * speed * 2;
                this.vy += 0.8;
            } else if (staminaPercent < 0.3) {
                this.vx += Math.sign(dx) * speed * 0.5;
                this.vy -= 0.4;
            } else if (opponent.isFlying) {
                this.vx += Math.sign(dx) * speed;
                this.vy += this.y > opponent.y ? -0.5 : 0.3;
            } else {
                const idealHeight = opponent.y - 80;
                if (this.y > idealHeight) {
                    this.vy -= 0.4;
                } else {
                    this.vy += 0.2;
                }
                this.vx += Math.sign(dx) * speed * 1.2;
            }
            if (!heightAdvantage || dist > attackRange * 2) {
                this.vy += Math.sin(this.moveTimer / 8) * 0.2;
            }
        } else if (this.onWall) {
            this.vy = Math.sign(dy) * speed * 3;
            const horizDist = Math.abs(dx);
            if (horizDist < 150 && Math.abs(dy) < 50 && Math.random() < 0.03 + this.drives.aggression * 0.05) {
                this.jump(1.0);
                this.vx = Math.sign(dx) * 8;
            }
        } else {
            this.vx += Math.sign(dx) * speed;
            if (opponent.isFlying || opponent.onWall || opponent.y < this.y - 50) {
                if (this.grounded && dist < attackRange * 2 && Math.random() < 0.04 + this.drives.aggression * 0.06) {
                    this.jump(1.0);
                    this.vx += Math.sign(dx) * 3;
                }
            }
        }
    }

    executeCirclingAI(opponent, dx, dy, dist) {
        const speed = 0.2 + (this.genome.speed / 200);
        const circleRadius = 60 + this.drives.caution * 60;

        this.circleAngle += (this.side === 'left' ? 0.04 : -0.04) * (this.genome.speed / 50);

        if (this.isFlying) {
            const targetX = opponent.x + Math.cos(this.circleAngle) * circleRadius;
            const targetY = opponent.y - 60 + Math.sin(this.circleAngle) * circleRadius * 0.4;
            this.vx += (targetX - this.x) * 0.025;
            this.vy += (targetY - this.y) * 0.025;
            if (!opponent.isFlying && this.y > opponent.y - 40) {
                this.vy -= 0.3;
            }
        } else if (this.isWallcrawler && this.onWall) {
            const targetY = opponent.y;
            this.vy = Math.sign(targetY - this.y) * speed * 2;
        } else {
            this.vx += Math.cos(this.circleAngle) * speed * 2;
            if (this.grounded && Math.random() < 0.02) {
                this.jump(0.5);
            }
        }

        const breakoutTime = Math.floor(120 - this.drives.aggression * 80);
        if (this.aiStateTimer > breakoutTime) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeRetreatingAI(opponent, dx, dy, dist) {
        const speed = 0.25 + (this.genome.speed / 200);

        if (this.isFlying) {
            this.vx -= Math.sign(dx) * speed * 1.5;
            this.vy -= 0.5;
            if (this.y < ARENA.ceilingY + 80) {
                this.vy += 0.3;
            }
        } else if (this.isWallcrawler) {
            if (this.onWall) {
                this.vy = -speed * 4;
            } else {
                const nearestWall = this.x < ARENA.width / 2 ? 'left' : 'right';
                this.vx += nearestWall === 'left' ? -speed * 3 : speed * 3;
            }
        } else {
            this.vx -= Math.sign(dx) * speed;
            if (this.grounded && Math.random() < 0.05) {
                this.jump(0.6);
                this.vx -= Math.sign(dx) * 3;
            }
        }

        const retreatDuration = Math.floor(40 + this.drives.caution * 60 - this.drives.aggression * 30);
        if (this.aiStateTimer > retreatDuration || dist > 300) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
        }
    }

    updateWallClimbing(opponent, dist) {
        const halfSize = this.spriteSize / 2;
        const staminaPercent = this.stamina / this.maxStamina;

        if (this.onWall) {
            if (this.wallSide === 'left') {
                this.x = ARENA.leftWall + halfSize;
            } else {
                this.x = ARENA.rightWall - halfSize;
            }

            const minY = ARENA.ceilingY + halfSize + 10;
            const maxY = ARENA.floorY - halfSize - 10;
            this.y = Math.max(minY, Math.min(maxY, this.y));

            this.vx = 0;
            this.grounded = true;

            if (this.aiState === 'aggressive') {
                const targetY = opponent.y;
                if (Math.abs(this.y - targetY) > 30) {
                    this.vy = Math.sign(targetY - this.y) * 3;
                }
            } else if (this.aiState === 'retreating') {
                this.vy = -3;
            } else {
                this.vy = Math.sin(this.moveTimer / 20) * 2;
            }

            const horizDist = Math.abs(opponent.x - this.x);
            const vertDist = Math.abs(opponent.y - this.y);

            if (horizDist < 180 && vertDist < 60 && this.drives.aggression > 0.4) {
                if (Math.random() < 0.05 + this.drives.aggression * 0.08) {
                    this.onWall = false;
                    this.grounded = false;
                    const pounceDir = this.wallSide === 'left' ? 1 : -1;
                    this.vx = pounceDir * (10 + this.genome.speed / 10);
                    this.vy = -4;
                }
            }

            if (dist > 400 || (staminaPercent > 0.7 && this.aiState === 'retreating')) {
                this.onWall = false;
                this.grounded = false;
            }
        } else {
            const nearLeftWall = this.x < ARENA.leftWall + 80;
            const nearRightWall = this.x > ARENA.rightWall - 80;

            if ((nearLeftWall || nearRightWall) && this.grounded) {
                const wantToClimb =
                    staminaPercent < 0.4 ||
                    opponent.isFlying ||
                    opponent.y < this.y - 50 ||
                    (this.drives.caution > 0.5 && Math.random() < 0.1) ||
                    (dist < 150 && Math.random() < 0.08);

                if (wantToClimb) {
                    this.onWall = true;
                    this.wallSide = nearLeftWall ? 'left' : 'right';
                    this.vy = 0;
                }
            }

            if ((this.aiState === 'retreating' || staminaPercent < 0.3) && !this.onWall) {
                const nearestWall = this.x < ARENA.width / 2 ? 'left' : 'right';
                this.vx += nearestWall === 'left' ? -0.5 : 0.5;
            }
        }
    }

    // Serialize state for transmission
    toState() {
        return {
            x: Math.round(this.x * 10) / 10,
            y: Math.round(this.y * 10) / 10,
            hp: this.hp,
            maxHp: this.maxHp,
            stamina: Math.round(this.stamina),
            maxStamina: this.maxStamina,
            state: this.state,
            animFrame: this.animFrame,
            aiState: this.aiState,
            facingRight: this.facingRight,
            onWall: this.onWall,
            wallSide: this.wallSide,
            squash: Math.round(this.squash * 100) / 100,
            stretch: Math.round(this.stretch * 100) / 100,
            lungeX: Math.round(this.lungeX * 10) / 10,
            lungeY: Math.round(this.lungeY * 10) / 10,
            flashTimer: this.flashTimer,
            poisoned: this.poisoned,
            drives: {
                aggression: Math.round(this.drives.aggression * 100) / 100,
                caution: Math.round(this.drives.caution * 100) / 100,
            },
            // Animation properties
            spriteSize: this.spriteSize,
            victoryBounce: Math.round(this.victoryBounce * 10) / 10,
            deathRotation: Math.round(this.deathRotation * 100) / 100,
            deathAlpha: Math.round(this.deathAlpha * 100) / 100,
        };
    }
}

// ============================================
// GAME SIMULATION
// ============================================

class Simulation {
    constructor() {
        this.phase = 'countdown'; // countdown, fighting, victory
        this.countdown = COUNTDOWN_SECONDS;
        this.tick = 0;
        this.fightNumber = 0;

        this.fighters = [];
        this.bugs = []; // Genome data for client
        this.bugNames = [];

        this.events = []; // Events this tick (hits, commentary, etc.)
        this.winner = null;

        this.attackCooldowns = [0, 0];

        this.setupNextFight();
    }

    setupNextFight() {
        this.fightNumber++;
        this.phase = 'countdown';
        this.countdown = COUNTDOWN_SECONDS;
        this.winner = null;

        // Generate two new bugs
        const genome1 = new BugGenome();
        const genome2 = new BugGenome();
        const name1 = genome1.getName();
        const name2 = genome2.getName();

        this.bugs = [genome1.toJSON(), genome2.toJSON()];
        this.bugNames = [name1, name2];

        this.fighters = [
            new Fighter(genome1, 'left', name1),
            new Fighter(genome2, 'right', name2),
        ];

        this.attackCooldowns = [30 + Math.random() * 30, 30 + Math.random() * 30];

        this.addEvent('commentary', `FIGHT #${this.fightNumber} - Place your bets!`, '#ff0');
    }

    calculateOdds() {
        const p1 = this.fighters[0].getPowerRating();
        const p2 = this.fighters[1].getPowerRating();
        const total = p1 + p2;
        return {
            fighter1: (total / p1).toFixed(2),
            fighter2: (total / p2).toFixed(2),
        };
    }

    addEvent(type, data, color = null) {
        this.events.push({ type, data, color, tick: this.tick });
    }

    update() {
        this.tick++;
        this.events = []; // Clear events from last tick

        if (this.phase === 'countdown') {
            // Countdown logic - decrement every second (TICK_RATE ticks)
            if (this.tick % TICK_RATE === 0) {
                this.countdown--;
                if (this.countdown <= 3 && this.countdown > 0) {
                    this.addEvent('commentary', `${this.countdown}...`, '#f00');
                }
                if (this.countdown <= 0) {
                    this.startFight();
                }
            }
        } else if (this.phase === 'fighting') {
            this.updateFight();
        } else if (this.phase === 'victory') {
            // Wait a bit then start next fight
            if (this.tick % (TICK_RATE * 5) === 0) { // 5 seconds
                this.setupNextFight();
            }
        }
    }

    startFight() {
        this.phase = 'fighting';
        this.addEvent('commentary', 'FIGHT!', '#f00');
    }

    resolveFighterCollision(f1, f2) {
        // Skip if either is dead
        if (!f1.isAlive || !f2.isAlive) return;

        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Combined collision radius based on sprite sizes
        const minDist = (f1.spriteSize + f2.spriteSize) / 2 * 0.7;

        if (dist < minDist && dist > 0) {
            // Calculate overlap
            const overlap = minDist - dist;

            // Normalize direction
            const nx = dx / dist;
            const ny = dy / dist;

            // Push apart based on mass ratio
            const totalMass = f1.mass + f2.mass;
            const f1Ratio = f2.mass / totalMass;
            const f2Ratio = f1.mass / totalMass;

            // Separate the fighters
            f1.x -= nx * overlap * f1Ratio;
            f1.y -= ny * overlap * f1Ratio;
            f2.x += nx * overlap * f2Ratio;
            f2.y += ny * overlap * f2Ratio;

            // Add some bounce velocity
            const bounce = 0.3;
            f1.vx -= nx * bounce;
            f2.vx += nx * bounce;
        }
    }

    updateFight() {
        const [f1, f2] = this.fighters;

        // Update state timers (handles attack/hit state resets)
        f1.updateState();
        f2.updateState();

        // Update physics
        f1.updatePhysics();
        f2.updatePhysics();

        // Resolve body collision between fighters
        this.resolveFighterCollision(f1, f2);

        // Update drives
        f1.updateDrives();
        f2.updateDrives();

        // Update AI
        f1.updateAI(f2);
        f2.updateAI(f1);

        // Process combat
        this.processCombat(f1, f2, 0);
        this.processCombat(f2, f1, 1);

        // Poison damage
        this.processPoison(f1);
        this.processPoison(f2);

        // Check for winner
        if (!f1.isAlive || !f2.isAlive) {
            this.endFight();
        }
    }

    processCombat(attacker, target, attackerIndex) {
        if (!attacker.isAlive || attacker.state !== 'idle') return;
        if (attacker.stunTimer > 0) return;

        this.attackCooldowns[attackerIndex]--;

        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Attack range based on combined sprite sizes
        const attackRange = (attacker.spriteSize + target.spriteSize) / 2 + 15;

        if (this.attackCooldowns[attackerIndex] <= 0 && dist < attackRange) {
            // Attempt attack
            const attackCost = attacker.getAttackStaminaCost();
            if (!attacker.spendStamina(attackCost)) {
                return; // Too tired
            }

            attacker.setState('attack');
            attacker.facingRight = dx > 0;

            // Weapon behavior affects lunge
            const dirX = dx / dist;
            const dirY = dy / dist;
            attacker.lungeX = dirX * 25;
            attacker.lungeY = dirY * 15;
            attacker.squash = 0.7;
            attacker.stretch = 1.3;

            // Hit check
            let hitRoll = rollDice(100) + attacker.genome.speed;
            let dodgeRoll = rollDice(100) + target.genome.instinct;

            if (target.isFlying) dodgeRoll += 15;
            if (target.stunTimer > 0) dodgeRoll -= 30;

            if (hitRoll > dodgeRoll) {
                // Calculate damage
                let damage = Math.floor((attacker.genome.bulk + attacker.genome.fury) / 10) + rollDice(6);

                // Defense reduction
                if (target.genome.defense === 'shell') {
                    damage = Math.max(1, damage - Math.floor(target.genome.bulk / 20));
                }

                // Crit check
                const isCrit = rollDice(100) <= attacker.genome.fury / 2;
                if (isCrit) {
                    damage = Math.floor(damage * 1.5);
                    this.addEvent('commentary', 'CRITICAL HIT!', '#ff0');
                }

                damage = Math.max(1, damage);

                // Apply damage
                target.hp -= damage;
                target.setState('hit');
                target.stunTimer = isCrit ? 25 : 15;
                target.flashTimer = 4;
                target.squash = 1.2;
                target.stretch = 0.8;

                // Knockback
                const massRatio = attacker.mass / target.mass;
                const knockbackForce = (isCrit ? 10 : 6) * Math.sqrt(massRatio);
                target.vx += dirX * knockbackForce;
                target.vy += dirY * knockbackForce * 0.4 - 2;

                // Update drives
                attacker.onHitLanded(damage);
                target.onDamageTaken(damage);

                // Events
                this.addEvent('hit', {
                    x: target.x,
                    y: target.y,
                    damage,
                    isCrit,
                    attacker: attacker.name,
                    target: target.name,
                });

                // Poison from fangs
                if (attacker.genome.weapon === 'fangs' && rollDice(3) === 3) {
                    target.poisoned = 4;
                    this.addEvent('commentary', `${target.name} is poisoned!`, '#0f0');
                }

                // Toxic defense
                if (target.genome.defense === 'toxic') {
                    const toxicDamage = Math.floor(target.genome.bulk / 25);
                    if (toxicDamage > 0) {
                        attacker.hp -= toxicDamage;
                        attacker.flashTimer = 4;
                        this.addEvent('commentary', `${attacker.name} takes ${toxicDamage} toxic damage!`, '#0f0');
                    }
                }

                if (target.hp <= 0) {
                    target.hp = 0;
                    target.setState('death');
                    this.addEvent('commentary', `${target.name} is defeated!`, '#f00');
                }
            } else {
                this.addEvent('commentary', `${attacker.name} misses!`, '#888');
            }

            // Reset cooldown
            const baseCD = 60 - attacker.genome.speed / 3;
            this.attackCooldowns[attackerIndex] = baseCD + Math.random() * 20;
        }
    }

    processPoison(fighter) {
        if (fighter.poisoned > 0 && this.tick % TICK_RATE === 0) {
            const poisonDamage = 2;
            fighter.hp -= poisonDamage;
            fighter.flashTimer = 2;
            fighter.poisoned--;
            this.addEvent('hit', {
                x: fighter.x,
                y: fighter.y,
                damage: poisonDamage,
                isPoison: true,
            });
            if (fighter.hp <= 0) {
                fighter.hp = 0;
                fighter.setState('death');
                this.addEvent('commentary', `${fighter.name} succumbs to poison!`, '#0f0');
            }
        }
    }

    endFight() {
        this.phase = 'victory';

        const [f1, f2] = this.fighters;
        if (f1.isAlive && !f2.isAlive) {
            this.winner = 1;
            f1.setState('victory');
            this.addEvent('commentary', `${f1.name} WINS!`, '#ff0');
        } else if (f2.isAlive && !f1.isAlive) {
            this.winner = 2;
            f2.setState('victory');
            this.addEvent('commentary', `${f2.name} WINS!`, '#ff0');
        } else {
            // Both dead - draw
            this.winner = 0;
            this.addEvent('commentary', 'DRAW!', '#888');
        }

        this.addEvent('fightEnd', { winner: this.winner });
    }

    // Get state to broadcast
    getState() {
        return {
            phase: this.phase,
            countdown: this.countdown,
            tick: this.tick,
            fightNumber: this.fightNumber,
            fighters: this.fighters.map(f => f.toState()),
            bugs: this.bugs,
            bugNames: this.bugNames,
            odds: this.calculateOdds(),
            events: this.events,
            winner: this.winner,
        };
    }
}

module.exports = { Simulation, Fighter, ARENA, TICK_RATE, TICK_MS };
