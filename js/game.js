// Bug Fights - Game Engine v4
// Larger arena with proper mobility-based positioning

// ============================================
// CONSTANTS
// ============================================

const ARENA = {
    width: 900,
    height: 600,
    floorY: 550,       // Floor level (bottom of enclosure)
    ceilingY: 80,      // Top of enclosure
    leftWall: 50,      // Left wall
    rightWall: 850,    // Right wall
};

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
        this.spriteSize = bug.size || 24; // Dynamic sprite size
        this.side = side;

        // Calculate actual pixel bounds from sprite
        this.calculateSpriteBounds();

        // Mobility type
        this.isFlying = this.genome.mobility === 'winged';
        this.isWallcrawler = this.genome.mobility === 'wallcrawler';
        this.isGround = this.genome.mobility === 'ground';

        // Starting position based on mobility
        this.initializePosition();

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

        // Physics
        this.vx = 0;
        this.vy = 0;
        this.mass = 0.5 + (this.genome.bulk / 100) * 1.5; // Mass from 0.5 to 2.0
        this.grounded = !this.isFlying;
        this.gravity = this.isFlying ? 0.05 : 0.6; // Flyers have minimal gravity
        this.friction = 0.85;
        this.airFriction = 0.95;

        // Jump properties based on leg style
        this.jumpPower = this.calculateJumpPower();
        this.jumpCooldown = 0;

        // Combat AI state
        this.aiState = 'aggressive'; // aggressive, circling, lunging, stunned, retreating
        this.aiStateTimer = 0;
        this.aiTarget = null;
        this.stunTimer = 0;

        // Wall climbing
        this.onWall = false;
        this.wallSide = null;
        this.climbDirection = 1; // 1 = up, -1 = down
        this.wallTransitionTimer = 0;

        // Legacy (keeping for compatibility)
        this.circleAngle = side === 'left' ? 0 : Math.PI;
        this.moveTimer = 0;
    }

    calculateJumpPower() {
        const legStyle = this.genome.legStyle;
        const baseJump = 8 + (this.genome.speed / 20); // Speed helps jumping

        switch (legStyle) {
            case 'curved-back':
            case 'curved-forward':
                return baseJump * 1.5; // Spring-loaded legs jump highest
            case 'straight':
                return baseJump * 1.0; // Normal jump
            case 'short':
                return baseJump * 0.5; // Small hop only
            default:
                return baseJump;
        }
    }

    calculateSpriteBounds() {
        // Find actual bounds of non-transparent pixels in sprite
        const frame = this.sprite.idle[0]; // Use first idle frame
        let minX = this.spriteSize, maxX = 0;
        let minY = this.spriteSize, maxY = 0;

        for (let y = 0; y < this.spriteSize; y++) {
            for (let x = 0; x < this.spriteSize; x++) {
                const colorIdx = parseInt(frame[y][x]);
                if (colorIdx !== 0) { // Non-transparent pixel
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        // Store bounds relative to sprite center
        const centerX = this.spriteSize / 2;
        const centerY = this.spriteSize / 2;

        this.bounds = {
            left: centerX - minX,      // Distance from center to left edge
            right: maxX - centerX,     // Distance from center to right edge
            top: centerY - minY,       // Distance from center to top edge
            bottom: maxY - centerY,    // Distance from center to bottom edge (feet)
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    initializePosition() {
        const bounds = this.getScaledBounds();

        // Position based on mobility type
        if (this.isGround) {
            // Ground bugs stay on the floor
            this.x = this.side === 'left' ? 200 : 700;
            this.y = ARENA.floorY - bounds.bottom;
        } else if (this.isFlying) {
            // Flying bugs start in the air
            this.x = this.side === 'left' ? 200 : 700;
            this.y = ARENA.ceilingY + 100 + Math.random() * 150;
        } else if (this.isWallcrawler) {
            // Wallcrawlers start on floor
            this.x = this.side === 'left' ? 150 : 750;
            this.y = ARENA.floorY - bounds.bottom;
        }
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
        // 'none' defense has no rating bonus

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

        // Lunge with velocity
        const lungeStrength = 25 + this.genome.fury / 10;
        this.lungeX = (dx / dist) * lungeStrength;
        this.lungeY = (dy / dist) * lungeStrength * 0.5;
        this.vx += (dx / dist) * 5; // Add momentum to lunge
        this.squash = 0.7;
        this.stretch = 1.3;

        // === POSITIONING BONUSES ===

        // Height advantage: attacking from above
        const heightAdvantage = this.y < target.y - 20;

        // Facing advantage: attacking from behind (target facing away from attacker)
        const attackingFromRight = dx < 0; // Attacker is to the right of target
        const targetFacingRight = target.facingRight;
        const backstab = (attackingFromRight && targetFacingRight) || (!attackingFromRight && !targetFacingRight);

        // Hit check: SPEED vs INSTINCT + evasion
        let hitRoll = rollDice(100) + this.genome.speed;
        let dodgeRoll = rollDice(100) + target.genome.instinct;

        // Positioning affects hit chance
        if (heightAdvantage) hitRoll += 15;
        if (backstab) hitRoll += 20; // Hard to dodge attacks from behind

        // Evasion bonuses
        if (target.isFlying) dodgeRoll += 15;
        if (target.stunTimer > 0) dodgeRoll -= 30; // Stunned targets can't dodge well

        if (hitRoll > dodgeRoll) {
            // Calculate damage: BULK + FURY
            let damage = Math.floor((this.genome.bulk + this.genome.fury) / 10) + rollDice(6);

            // Positioning damage bonuses
            if (heightAdvantage) {
                damage += 2;
                addCommentary(`Height advantage!`, '#8af');
            }
            if (backstab) {
                damage = Math.floor(damage * 1.3);
                addCommentary(`Backstab!`, '#f8a');
            }

            // Weapon effects
            if (this.genome.weapon === 'mandibles' && target.genome.defense === 'shell') {
                damage += 3;
            }
            if (this.genome.weapon === 'stinger') {
                damage += 2;
            }

            // Defense reduction
            if (target.genome.defense === 'shell') {
                damage = Math.max(1, damage - Math.floor(target.genome.bulk / 20));
            }

            // Crit check based on FURY (higher chance on backstab)
            let critChance = this.genome.fury / 2;
            if (backstab) critChance += 15;
            let isCrit = rollDice(100) <= critChance;
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

        // Stun the target briefly
        target.stunTimer = isCrit ? 25 : 15;
        target.aiState = 'stunned';

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

        // Physics-based knockback - apply velocity, not position
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Knockback force scales with attacker mass vs target mass
        const massRatio = this.mass / target.mass;
        const baseKnockback = isCrit ? 12 : 7;
        const knockbackForce = baseKnockback * Math.sqrt(massRatio);

        target.vx += (dx / dist) * knockbackForce;
        target.vy += (dy / dist) * knockbackForce * 0.4 - 3; // Slight upward pop

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

    getScale() {
        const baseScale = 1.0;
        const sizeRatio = this.spriteSize / 24;
        return baseScale * sizeRatio;
    }

    getRenderedSize() {
        return this.spriteSize * this.getScale();
    }

    getHalfSize() {
        return this.getRenderedSize() / 2;
    }

    // Get actual bounds scaled for rendering
    getScaledBounds() {
        const scale = this.getScale();
        return {
            left: this.bounds.left * scale,
            right: this.bounds.right * scale,
            top: this.bounds.top * scale,
            bottom: this.bounds.bottom * scale,  // Distance from center to feet
            width: this.bounds.width * scale,
            height: this.bounds.height * scale
        };
    }

    constrainToArena() {
        const bounds = this.getScaledBounds();

        if (this.isGround) {
            // Ground bugs stay on the floor - actual feet touch floor
            this.x = Math.max(ARENA.leftWall + bounds.left, Math.min(ARENA.rightWall - bounds.right, this.x));
            this.y = ARENA.floorY - bounds.bottom;
        } else if (this.isFlying) {
            // Flyers can go anywhere in the enclosure
            this.x = Math.max(ARENA.leftWall + bounds.left, Math.min(ARENA.rightWall - bounds.right, this.x));
            this.y = Math.max(ARENA.ceilingY + bounds.top, Math.min(ARENA.floorY - bounds.bottom, this.y));
        } else if (this.isWallcrawler) {
            // Wallcrawlers can be on floor or walls
            if (this.onWall) {
                // On wall: rotated 90°, so bounds swap (height becomes width)
                // bounds.bottom is distance from center to feet, which now points toward wall
                const wallOffset = bounds.bottom + 2; // Feet touching wall
                this.x = this.wallSide === 'left' ? ARENA.leftWall + wallOffset : ARENA.rightWall - wallOffset;
                // Vertical bounds: original left/right become top/bottom when rotated
                this.y = Math.max(ARENA.ceilingY + bounds.right + 5, Math.min(ARENA.floorY - bounds.left - 5, this.y));
            } else {
                this.x = Math.max(ARENA.leftWall + bounds.left, Math.min(ARENA.rightWall - bounds.right, this.x));
                this.y = ARENA.floorY - bounds.bottom;
            }
        }
    }

    // ==================== PHYSICS ====================

    updatePhysics() {
        if (hitPause > 0) return;
        if (!this.isAlive || this.state === 'death') return;

        const bounds = this.getScaledBounds();
        const bounceFactor = 0.6; // How much velocity is retained on bounce

        // Apply gravity (reduced for flyers, zero when on wall)
        if (!this.onWall) {
            this.vy += this.gravity * slowMotion;
        }

        // Apply velocity
        this.x += this.vx * slowMotion;
        this.y += this.vy * slowMotion;

        // === ARENA BOUNDARY COLLISION (all bugs must stay inside) ===

        // Floor collision
        const floorLevel = ARENA.floorY - bounds.bottom;
        if (this.y >= floorLevel) {
            this.y = floorLevel;
            if (this.isFlying) {
                // Flyers bounce off floor
                this.vy = -Math.abs(this.vy) * bounceFactor;
            } else {
                this.vy = 0;
                this.grounded = true;
                if (this.onWall) {
                    this.onWall = false;
                }
            }
        } else if (!this.onWall && !this.isFlying) {
            this.grounded = false;
        }

        // Ceiling collision (all bugs)
        const ceilingLevel = ARENA.ceilingY + bounds.top;
        if (this.y < ceilingLevel) {
            this.y = ceilingLevel;
            this.vy = Math.abs(this.vy) * bounceFactor; // Bounce down
        }

        // Left wall collision
        const leftLimit = ARENA.leftWall + bounds.left;
        if (this.x < leftLimit) {
            this.x = leftLimit;
            if (this.isWallcrawler && !this.onWall && this.grounded) {
                // Wallcrawlers can grab the wall
                this.onWall = true;
                this.wallSide = 'left';
                this.vx = 0;
            } else {
                this.vx = Math.abs(this.vx) * bounceFactor; // Bounce right
            }
        }

        // Right wall collision
        const rightLimit = ARENA.rightWall - bounds.right;
        if (this.x > rightLimit) {
            this.x = rightLimit;
            if (this.isWallcrawler && !this.onWall && this.grounded) {
                // Wallcrawlers can grab the wall
                this.onWall = true;
                this.wallSide = 'right';
                this.vx = 0;
            } else {
                this.vx = -Math.abs(this.vx) * bounceFactor; // Bounce left
            }
        }

        // Friction
        const frictionFactor = this.grounded ? this.friction : this.airFriction;
        this.vx *= frictionFactor;

        // Flyers have air friction on Y too
        if (this.isFlying) {
            this.vy *= this.airFriction;
        }

        // Cooldowns
        if (this.jumpCooldown > 0) this.jumpCooldown--;
        if (this.stunTimer > 0) this.stunTimer--;
    }

    jump(power = 1.0) {
        if (this.jumpCooldown > 0) return false;
        if (!this.grounded && !this.onWall && !this.isFlying) return false;

        const jumpForce = this.jumpPower * power;

        if (this.onWall) {
            // Wall jump - jump away from wall
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

    // ==================== AI STATE MACHINE ====================

    updateAI(opponent) {
        if (hitPause > 0) return;
        if (!this.isAlive || this.state === 'death') return;
        if (this.state === 'windup' || this.state === 'attack') return;

        this.moveTimer++;
        this.aiStateTimer++;

        const dx = opponent.x - this.x;
        const dy = opponent.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const bounds = this.getScaledBounds();
        const oppBounds = opponent.getScaledBounds();
        const attackRange = bounds.right + oppBounds.left + 40;

        // Update facing (except when on wall)
        if (this.state === 'idle' && !this.onWall) {
            this.facingRight = dx > 0;
        } else if (this.onWall) {
            this.facingRight = this.wallSide === 'right';
        }

        // Stunned state - can't do anything
        if (this.stunTimer > 0) {
            this.aiState = 'stunned';
            return;
        }

        // State transitions
        this.updateAIStateTransitions(opponent, dist, attackRange);

        // Execute current state behavior
        switch (this.aiState) {
            case 'aggressive':
                this.executeAggressiveAI(opponent, dx, dy, dist, attackRange);
                break;
            case 'circling':
                this.executeCirclingAI(opponent, dx, dy, dist);
                break;
            case 'lunging':
                this.executeLungingAI(opponent, dx, dy, dist);
                break;
            case 'retreating':
                this.executeRetreatingAI(opponent, dx, dy, dist);
                break;
            case 'stunned':
                // Do nothing while stunned
                break;
        }

        // Wallcrawler-specific climbing behavior
        if (this.isWallcrawler) {
            this.updateWallClimbing(opponent, dist);
        }
    }

    updateAIStateTransitions(opponent, dist, attackRange) {
        const hpPercent = this.hp / this.maxHp;
        const furyFactor = this.genome.fury / 100;
        const instinctFactor = this.genome.instinct / 100;

        // Low HP + high instinct = more likely to retreat (flyers/wallcrawlers only)
        if (hpPercent < 0.3 && (this.isFlying || this.isWallcrawler) && Math.random() < instinctFactor * 0.1) {
            this.aiState = 'retreating';
            this.aiStateTimer = 0;
        }
        // In attack range + high fury = aggressive
        else if (dist < attackRange * 1.2 && Math.random() < furyFactor * 0.15) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
        // Sometimes circle to find opening
        else if (dist < attackRange * 1.5 && this.aiStateTimer > 60 && Math.random() < instinctFactor * 0.05) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
            this.circleAngle = Math.atan2(this.y - opponent.y, this.x - opponent.x);
        }
        // Far away = aggressive approach
        else if (dist > attackRange * 2 && this.aiStateTimer > 30) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeAggressiveAI(opponent, dx, dy, dist, attackRange) {
        const speed = 0.3 + (this.genome.speed / 150);

        if (this.isFlying) {
            // Flyers thrust toward opponent
            this.vx += Math.sign(dx) * speed * 1.2;
            this.vy += Math.sign(dy) * speed * 0.8;

            // Bobbing motion
            this.vy += Math.sin(this.moveTimer / 8) * 0.3;
        } else if (this.onWall) {
            // Wall climbing - move toward opponent's height
            this.vy = Math.sign(dy) * speed * 3;

            // Jump off wall to attack if close enough horizontally
            const horizDist = Math.abs(dx);
            if (horizDist < 150 && Math.abs(dy) < 50 && Math.random() < 0.05) {
                this.jump(1.0);
                this.vx = Math.sign(dx) * 8;
            }
        } else {
            // Ground movement - accelerate toward opponent
            this.vx += Math.sign(dx) * speed;

            // Jump to reach flying opponents
            if (opponent.isFlying || opponent.onWall || opponent.y < this.y - 50) {
                if (this.grounded && dist < attackRange * 2 && Math.random() < 0.08) {
                    this.jump(1.0);
                    // Add horizontal velocity toward opponent
                    this.vx += Math.sign(dx) * 3;
                }
            }
        }
    }

    executeCirclingAI(opponent, dx, dy, dist) {
        const speed = 0.2 + (this.genome.speed / 200);
        const circleRadius = 80 + (100 - this.genome.fury) / 2;

        this.circleAngle += (this.side === 'left' ? 0.04 : -0.04) * (this.genome.speed / 50);

        if (this.isFlying) {
            const targetX = opponent.x + Math.cos(this.circleAngle) * circleRadius;
            const targetY = opponent.y + Math.sin(this.circleAngle) * circleRadius * 0.6;
            this.vx += (targetX - this.x) * 0.02;
            this.vy += (targetY - this.y) * 0.02;
        } else {
            // Ground bugs strafe side to side
            this.vx += Math.cos(this.circleAngle) * speed * 2;

            // Occasionally jump while circling
            if (this.grounded && Math.random() < 0.02) {
                this.jump(0.5);
            }
        }

        // Exit circling after a while and go aggressive
        if (this.aiStateTimer > 90) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeLungingAI(opponent, dx, dy, dist) {
        // Committed forward attack - big burst of speed
        const lungeSpeed = 0.8 + (this.genome.fury / 100);

        if (this.isFlying) {
            this.vx += Math.sign(dx) * lungeSpeed;
            this.vy += Math.sign(dy) * lungeSpeed * 0.5;
        } else {
            this.vx += Math.sign(dx) * lungeSpeed * 1.5;
            if (this.grounded && Math.abs(dy) > 30) {
                this.jump(0.7);
            }
        }

        // Lunge is brief
        if (this.aiStateTimer > 20) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeRetreatingAI(opponent, dx, dy, dist) {
        const speed = 0.25 + (this.genome.speed / 200);

        if (this.isFlying) {
            // Fly away and up
            this.vx -= Math.sign(dx) * speed;
            this.vy -= 0.3;
        } else if (this.isWallcrawler && !this.onWall) {
            // Try to get to a wall
            const nearestWall = this.x < ARENA.width / 2 ? 'left' : 'right';
            this.vx += nearestWall === 'left' ? -speed * 2 : speed * 2;
        } else {
            // Ground bugs back away and jump
            this.vx -= Math.sign(dx) * speed;
            if (this.grounded && Math.random() < 0.05) {
                this.jump(0.6);
                this.vx -= Math.sign(dx) * 3;
            }
        }

        // Don't retreat forever
        if (this.aiStateTimer > 60 || dist > 300) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
        }
    }

    // ==================== WALL CLIMBING ====================

    updateWallClimbing(opponent, dist) {
        const bounds = this.getScaledBounds();

        if (this.onWall) {
            // Currently on wall - handle wall movement
            const wallOffset = bounds.bottom + 2;

            // Snap to wall
            if (this.wallSide === 'left') {
                this.x = ARENA.leftWall + wallOffset;
            } else {
                this.x = ARENA.rightWall - wallOffset;
            }

            // Constrain to wall bounds
            const minY = ARENA.ceilingY + bounds.right + 10;
            const maxY = ARENA.floorY - bounds.left - 10;
            this.y = Math.max(minY, Math.min(maxY, this.y));

            // Zero out horizontal velocity on wall
            this.vx = 0;
            this.grounded = true; // Can jump from wall

            // Occasionally change climb direction
            if (Math.random() < 0.02) {
                this.climbDirection *= -1;
            }

            // Drop off wall if opponent is far or to attack
            if (dist > 350 || (dist < 100 && Math.random() < 0.03)) {
                this.onWall = false;
                this.grounded = false;
            }
        } else {
            // Not on wall - check if should climb
            // Near a wall and strategic reason to climb
            const nearLeftWall = this.x < ARENA.leftWall + 60;
            const nearRightWall = this.x > ARENA.rightWall - 60;

            if ((nearLeftWall || nearRightWall) && this.grounded) {
                // Climb if opponent is above or to gain height advantage
                const shouldClimb = opponent.y < this.y - 30 ||
                                   opponent.isFlying ||
                                   (dist < 200 && Math.random() < 0.03);

                if (shouldClimb) {
                    this.onWall = true;
                    this.wallSide = nearLeftWall ? 'left' : 'right';
                    this.climbDirection = 1; // Start climbing up
                    this.vy = 0;
                }
            }
        }
    }

    render(ctx) {
        const spriteState = (this.state === 'windup' || this.state === 'victory') ? 'idle' : this.state;
        const frames = this.sprite[spriteState];
        const frame = frames[Math.min(this.animFrame, frames.length - 1)];
        const colors = this.sprite.colors;

        // Scale based on sprite size - 1x scale
        const baseScale = 1.0;
        const sizeRatio = this.spriteSize / 24;
        const scale = baseScale * sizeRatio;

        const renderX = this.x + this.lungeX;
        const renderY = this.y + this.lungeY;

        const scaleX = scale * this.squash;
        const scaleY = scale * this.stretch;
        const sizeX = this.spriteSize * scaleX;
        const sizeY = this.spriteSize * scaleY;

        const startX = renderX - sizeX / 2;
        const startY = renderY - sizeY / 2;

        ctx.save();

        if (this.flashTimer > 0) {
            ctx.globalAlpha = 0.5 + (this.flashTimer / 16);
        } else if (this.genome.defense === 'camouflage') {
            // Camouflage bugs are semi-transparent
            ctx.globalAlpha = 0.6;
        }

        // Wallcrawlers on walls: full 90° rotation, feet on wall, head pointing up
        let rotation = 0;
        if (this.isWallcrawler && this.onWall) {
            if (this.wallSide === 'left') {
                // Sprite is flipped (facingRight=false), rotate 90° CW to get head up, feet left
                rotation = Math.PI / 2;
            } else {
                // Normal sprite, rotate 90° CCW to get head up, feet right
                rotation = -Math.PI / 2;
            }
        }

        // Apply rotation around bug center
        if (rotation !== 0) {
            ctx.translate(renderX, renderY);
            ctx.rotate(rotation);
            ctx.translate(-renderX, -renderY);
        }

        // Draw each pixel
        for (let py = 0; py < this.spriteSize; py++) {
            for (let px = 0; px < this.spriteSize; px++) {
                const colorIdx = parseInt(frame[py][this.facingRight ? px : this.spriteSize - 1 - px]);
                if (colorIdx === 0) continue;

                ctx.fillStyle = (this.flashTimer > 0 && this.flashTimer % 2 === 0) ? '#fff' : colors[colorIdx];
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
            const barWidth = 50 * sizeRatio;
            const barHeight = 6;
            const barX = this.x - barWidth / 2;
            const barY = renderY - sizeY / 2 - 15;

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

    // Physics-based collision - mass determines who pushes who
    if (f1.isAlive && f2.isAlive) {
        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Use actual sprite bounds for collision
        const bounds1 = f1.getScaledBounds();
        const bounds2 = f2.getScaledBounds();
        const minDist = (bounds1.width / 2) + (bounds2.width / 2);

        if (dist < minDist && dist > 0) {
            // Calculate push based on mass - heavier bugs push lighter bugs more
            const totalMass = f1.mass + f2.mass;
            const f1Push = f2.mass / totalMass; // f1 gets pushed proportional to f2's mass
            const f2Push = f1.mass / totalMass; // f2 gets pushed proportional to f1's mass

            const overlap = minDist - dist;
            const pushStrength = 0.8; // How strongly to resolve collision
            const nx = dx / dist; // Normalized direction
            const ny = dy / dist;

            // Apply position correction
            f1.x -= nx * overlap * f1Push * pushStrength;
            f2.x += nx * overlap * f2Push * pushStrength;

            // Apply velocity impulse - bugs bounce off each other
            const relVelX = f2.vx - f1.vx;
            const relVelY = f2.vy - f1.vy;
            const relVelDotNormal = relVelX * nx + relVelY * ny;

            // Only resolve if moving toward each other
            if (relVelDotNormal < 0) {
                const impulse = relVelDotNormal * 0.5;
                f1.vx += nx * impulse * f1Push;
                f1.vy += ny * impulse * f1Push * 0.3; // Less vertical push
                f2.vx -= nx * impulse * f2Push;
                f2.vy -= ny * impulse * f2Push * 0.3;
            }

            // Spawn dust on collision
            if (overlap > 3) {
                spawnParticles((f1.x + f2.x) / 2, Math.max(f1.y, f2.y), 'dust', 2);
            }
        }
    }

    // Attack timing
    fighters.forEach((f, i) => {
        if (!f.isAlive || f.state !== 'idle') return;

        f.attackCooldown -= slowMotion;
        if (f.attackCooldown <= 0) {
            const opponent = fighters[1 - i];
            const dx = opponent.x - f.x;
            const dy = opponent.y - f.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Attack range based on actual sprite bounds
            const bounds = f.getScaledBounds();
            const oppBounds = opponent.getScaledBounds();
            const attackRange = bounds.right + oppBounds.left + 30;
            if (dist < attackRange) {
                f.startAttack(opponent);
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

    // Background - 2D side-view enclosure
    const gradient = ctx.createLinearGradient(0, 0, 0, ARENA.height);
    gradient.addColorStop(0, '#1a1a2a');
    gradient.addColorStop(1, '#0a0a15');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Enclosure interior (lighter area)
    ctx.fillStyle = '#151520';
    ctx.fillRect(ARENA.leftWall, ARENA.ceilingY, ARENA.rightWall - ARENA.leftWall, ARENA.floorY - ARENA.ceilingY);

    // Floor (bottom of enclosure)
    ctx.fillStyle = '#3a3020';
    ctx.fillRect(ARENA.leftWall, ARENA.floorY, ARENA.rightWall - ARENA.leftWall, 20);

    // Enclosure frame (thick border)
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 10;
    ctx.strokeRect(ARENA.leftWall - 5, ARENA.ceilingY - 5, ARENA.rightWall - ARENA.leftWall + 10, ARENA.floorY - ARENA.ceilingY + 30);

    // Inner frame highlight
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(ARENA.leftWall, ARENA.ceilingY, ARENA.rightWall - ARENA.leftWall, ARENA.floorY - ARENA.ceilingY)

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
    fighters.forEach(f => f.render(ctx));

    // Particles
    particles.forEach(p => { p.update(); p.render(ctx); });
    particles = particles.filter(p => p.life > 0);

    ctx.restore();

    // Title
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUG FIGHTS', canvas.width / 2, 35);

    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText(`FIGHT #${fightNumber}`, canvas.width / 2, 55);

    // VS display
    if (fighters.length === 2 || gameState === 'countdown') {
        const n1 = gameState === 'countdown' ? nextBugs.bug1.name : fighters[0].bug.name;
        const n2 = gameState === 'countdown' ? nextBugs.bug2.name : fighters[1].bug.name;

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(n1, 50, 90);
        ctx.textAlign = 'right';
        ctx.fillText(n2, canvas.width - 50, 90);

        ctx.fillStyle = '#f00';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VS', canvas.width / 2, 90);
    }

    // Countdown
    if (gameState === 'countdown') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(canvas.width / 2 - 100, 250, 200, 120);
        ctx.fillStyle = countdownTimer <= 3 ? '#f00' : '#ff0';
        ctx.font = 'bold 64px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(countdownTimer, canvas.width / 2, 330);
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.fillText('PLACE YOUR BETS', canvas.width / 2, 360);
    }

    // Commentary
    ctx.textAlign = 'left';
    ctx.font = '13px monospace';
    commentary.forEach((c, i) => {
        c.age++;
        ctx.globalAlpha = Math.max(0, 1 - c.age / 180);
        ctx.fillStyle = c.color;
        ctx.fillText(c.text, 50, canvas.height - 60 + i * 18);
    });
    ctx.globalAlpha = 1;
    commentary = commentary.filter(c => c.age < 180);
}

function gameLoopFn() {
    updateCountdown();

    fighters.forEach(f => {
        f.updateAnimation();
        if (gameState === 'fighting') {
            f.updatePhysics();
            f.updateAI(fighters.find(o => o !== f));
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
