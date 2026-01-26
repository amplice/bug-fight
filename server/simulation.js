// Bug Fights - Server Simulation
// Handles all game logic, runs 24/7

const BugGenome = require('./BugGenome');
const RosterManager = require('./roster');

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
    // 3D depth bounds (z-axis)
    frontWall: 250,   // positive z
    backWall: -250,   // negative z
    depth: 500,       // total z range
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
        this.vz = 0;  // 3D: z-axis velocity
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

        // Knockback tracking
        this.isKnockedBack = false;
        this.knockbackVelocity = 0; // Track velocity at knockback for wall stun calc
        this.wallStunTimer = 0; // Additional stun from hitting wall

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
        // Z position - start near center with slight random offset
        this.z = (Math.random() - 0.5) * 100;

        if (this.isGround) {
            this.x = this.side === 'left' ? 200 : 700;
            this.y = ARENA.floorY - 20;
        } else if (this.isFlying) {
            this.x = this.side === 'left' ? 200 : 700;
            this.y = ARENA.ceilingY + 100 + Math.random() * 150;
            this.z = (Math.random() - 0.5) * 200; // Flying bugs spread more in z
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
        this.z += this.vz;  // 3D: apply z velocity

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

        // Walls - with wall stun detection
        const leftLimit = ARENA.leftWall + halfSize;
        if (this.x < leftLimit) {
            const impactVelocity = Math.abs(this.vx);
            this.x = leftLimit;

            if (this.isWallcrawler && !this.onWall && this.grounded) {
                this.onWall = true;
                this.wallSide = 'left';
                this.vx = 0;
            } else {
                // Check for wall stun from knockback
                if (this.isKnockedBack && impactVelocity > 4) {
                    this.applyWallStun(impactVelocity, 'left');
                }
                this.vx = Math.abs(this.vx) * bounceFactor;
            }
        }

        const rightLimit = ARENA.rightWall - halfSize;
        if (this.x > rightLimit) {
            const impactVelocity = Math.abs(this.vx);
            this.x = rightLimit;

            if (this.isWallcrawler && !this.onWall && this.grounded) {
                this.onWall = true;
                this.wallSide = 'right';
                this.vx = 0;
            } else {
                // Check for wall stun from knockback
                if (this.isKnockedBack && impactVelocity > 4) {
                    this.applyWallStun(impactVelocity, 'right');
                }
                this.vx = -Math.abs(this.vx) * bounceFactor;
            }
        }

        // 3D: Front and back walls (z-axis bounds)
        const frontLimit = ARENA.frontWall - halfSize;
        if (this.z > frontLimit) {
            const impactVelocity = Math.abs(this.vz);
            this.z = frontLimit;

            if (this.isWallcrawler && !this.onWall && this.grounded) {
                this.onWall = true;
                this.wallSide = 'front';
                this.vz = 0;
            } else {
                if (this.isKnockedBack && impactVelocity > 4) {
                    this.applyWallStun(impactVelocity, 'front');
                }
                this.vz = -Math.abs(this.vz) * bounceFactor;
            }
        }

        const backLimit = ARENA.backWall + halfSize;
        if (this.z < backLimit) {
            const impactVelocity = Math.abs(this.vz);
            this.z = backLimit;

            if (this.isWallcrawler && !this.onWall && this.grounded) {
                this.onWall = true;
                this.wallSide = 'back';
                this.vz = 0;
            } else {
                if (this.isKnockedBack && impactVelocity > 4) {
                    this.applyWallStun(impactVelocity, 'back');
                }
                this.vz = Math.abs(this.vz) * bounceFactor;
            }
        }

        // Friction
        const frictionFactor = this.grounded ? this.friction : this.airFriction;
        this.vx *= frictionFactor;
        this.vz *= frictionFactor;  // 3D: z friction
        if (this.isFlying) {
            this.vy *= this.airFriction;
            this.vz *= this.airFriction;  // Flying bugs have air friction in z too
        }

        if (this.jumpCooldown > 0) this.jumpCooldown--;
        if (this.stunTimer > 0) this.stunTimer--;
        if (this.wallStunTimer > 0) this.wallStunTimer--;

        // Knockback decay - clear knockback state when velocity drops or grounded
        if (this.isKnockedBack) {
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);  // 3D: include vz
            if (speed < 2 || this.grounded) {
                this.isKnockedBack = false;
                this.knockbackVelocity = 0;
            }
        }

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

    // Wall stun from knockback impact
    applyWallStun(impactVelocity, wallSide) {
        // Base stun scales with impact velocity
        let wallStun = Math.floor(impactVelocity * 3);

        // Wallcrawlers are used to walls - reduced stun
        if (this.isWallcrawler) {
            wallStun = Math.floor(wallStun * 0.3);
        }

        // Shell defense absorbs some impact
        if (this.genome.defense === 'shell') {
            wallStun = Math.floor(wallStun * 0.7);
        }

        // Flying bugs take more impact (not used to ground/walls)
        if (this.isFlying) {
            wallStun = Math.floor(wallStun * 1.3);
        }

        // Apply the stun
        this.wallStunTimer = wallStun;
        this.stunTimer = Math.max(this.stunTimer, wallStun);

        // Visual feedback - squash against wall
        this.squash = 1.4;
        this.stretch = 0.6;
        this.flashTimer = 3;

        // Store impact info for event generation
        this.lastWallImpact = {
            velocity: impactVelocity,
            wallSide: wallSide,
            stunApplied: wallStun,
        };
    }

    // Wall awareness helpers
    getWallProximity() {
        // Returns 0-1 value, 1 = at wall, 0 = at center
        const arenaCenter = (ARENA.leftWall + ARENA.rightWall) / 2;
        const arenaHalfWidth = (ARENA.rightWall - ARENA.leftWall) / 2;
        const distFromCenter = Math.abs(this.x - arenaCenter);
        return distFromCenter / arenaHalfWidth;
    }

    getNearestWallSide() {
        const arenaCenter = (ARENA.leftWall + ARENA.rightWall) / 2;
        return this.x < arenaCenter ? 'left' : 'right';
    }

    getDistanceToWall(side) {
        if (side === 'left') {
            return this.x - ARENA.leftWall;
        } else {
            return ARENA.rightWall - this.x;
        }
    }

    isCornered(threshold = 100) {
        // Returns true if within threshold pixels of a wall
        const leftDist = this.x - ARENA.leftWall;
        const rightDist = ARENA.rightWall - this.x;
        return Math.min(leftDist, rightDist) < threshold;
    }

    getEscapeDirection() {
        // Returns direction to move away from nearest wall (toward center)
        const arenaCenter = (ARENA.leftWall + ARENA.rightWall) / 2;
        return this.x < arenaCenter ? 1 : -1; // Move right if on left, left if on right
    }

    // AI
    updateAI(opponent) {
        if (!this.isAlive || this.state === 'death') return;
        if (this.state === 'windup' || this.state === 'attack') return;

        this.moveTimer++;
        this.aiStateTimer++;

        const dx = opponent.x - this.x;
        const dy = opponent.y - this.y;
        const dz = opponent.z - this.z;  // 3D: z difference
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);  // 3D: full 3D distance
        const distXZ = Math.sqrt(dx * dx + dz * dz);  // Horizontal distance (for some checks)
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
                this.executeAggressiveAI(opponent, dx, dy, dz, dist, attackRange);
                break;
            case 'circling':
                this.executeCirclingAI(opponent, dx, dy, dz, dist, attackRange);
                break;
            case 'retreating':
                this.executeRetreatingAI(opponent, dx, dy, dz, dist);
                break;
        }

        if (this.isWallcrawler) {
            this.updateWallClimbing(opponent, dist);
        }
    }

    updateAIStateTransitions(opponent, dist, attackRange) {
        const hpPercent = this.hp / this.maxHp;
        const { aggression, caution } = this.drives;
        const instinctFactor = this.genome.instinct / 100;

        // CORNER ESCAPE: High instinct bugs recognize when they're trapped
        const iAmCornered = this.isCornered(100);
        const wallProximity = this.getWallProximity();

        if (iAmCornered && instinctFactor > 0.4) {
            // Cornered! High instinct bugs try to escape
            const escapeUrgency = wallProximity * instinctFactor;

            // More likely to retreat/escape when:
            // - Very close to wall (high wallProximity)
            // - Low HP
            // - Just got hit (high caution from damage)
            // - Opponent is close (pressure)
            const pressured = dist < attackRange * 1.5;
            const desperate = hpPercent < 0.5;

            if ((pressured || desperate) && Math.random() < escapeUrgency * 0.15) {
                this.aiState = 'retreating'; // Will use smart escape logic
                this.aiStateTimer = 0;
                return; // Priority escape
            }
        }

        // Normal state transitions
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

    executeAggressiveAI(opponent, dx, dy, dz, dist, attackRange) {
        const baseSpeed = 0.3 + (this.genome.speed / 150);
        const staminaPercent = this.stamina / this.maxStamina;
        const staminaFactor = 0.5 + staminaPercent * 0.5;
        const speed = baseSpeed * (0.7 + this.drives.aggression * 0.6) * staminaFactor;
        const instinctFactor = this.genome.instinct / 100;

        // 3D distance calculations
        const horizDist = Math.sqrt(dx * dx + dz * dz);  // XZ plane distance
        const heightDiff = opponent.y - this.y;  // Positive = opponent higher

        if (this.isFlying) {
            // TRUE 3D AERIAL COMBAT
            const hasHeightAdvantage = this.y < opponent.y - 40;  // We're above them
            const canDive = hasHeightAdvantage && horizDist < 200 && staminaPercent > 0.4;

            if (opponent.isFlying) {
                // AIR-TO-AIR DOGFIGHT
                // Maintain height advantage while pursuing
                const targetHeight = opponent.y - 60 - (instinctFactor * 40);  // Higher instinct = more height advantage

                // Pursuit in full 3D space
                this.vx += Math.sign(dx) * speed * 1.2;
                this.vz += Math.sign(dz) * speed * 1.2;  // Full z pursuit

                // Height management - try to get above opponent
                if (this.y > targetHeight) {
                    this.vy -= 0.6;  // Climb to get above
                } else if (this.y < targetHeight - 50) {
                    this.vy += 0.4;  // Don't go too far above
                }

                // Banking maneuvers - strafe while pursuing
                if (dist < attackRange * 2 && instinctFactor > 0.3) {
                    const strafeDir = Math.sin(this.moveTimer / 10) * instinctFactor;
                    // Strafe perpendicular to approach direction
                    const perpX = -dz / (horizDist || 1);
                    const perpZ = dx / (horizDist || 1);
                    this.vx += perpX * strafeDir * speed * 2;
                    this.vz += perpZ * strafeDir * speed * 2;
                }

                // Slight bobbing for natural flight
                this.vy += Math.sin(this.moveTimer / 6) * 0.15;
                this.vz += Math.cos(this.moveTimer / 8) * 0.1;

            } else if (canDive) {
                // DIVE ATTACK on ground opponent
                // Commit to dive - accelerate downward at target
                const diveAngle = Math.atan2(heightDiff, horizDist);
                const diveSpeed = speed * 3;  // Fast dive

                this.vx += Math.sign(dx) * diveSpeed * Math.cos(diveAngle);
                this.vy += 1.2;  // Strong downward force
                this.vz += Math.sign(dz) * diveSpeed * 0.8;

                // Mark as diving for damage bonus
                this.isDiving = true;

            } else if (staminaPercent < 0.3) {
                // LOW STAMINA - retreat upward
                this.vx += Math.sign(dx) * speed * 0.3;
                this.vy -= 0.6;  // Climb away
                this.vz += Math.sign(dz) * speed * 0.3;
                this.isDiving = false;

            } else {
                // POSITIONING - circle above ground opponent
                const idealHeight = opponent.y - 100 - (instinctFactor * 50);
                const idealDist = 120 + (1 - this.drives.aggression) * 80;

                // Adjust height
                if (this.y > idealHeight) {
                    this.vy -= 0.5;
                } else if (this.y < idealHeight - 30) {
                    this.vy += 0.3;
                }

                // Circle around opponent in 3D - figure-8 pattern
                const circlePhase = this.moveTimer / 25;
                const circleRadius = idealDist;
                const targetX = opponent.x + Math.cos(circlePhase) * circleRadius;
                const targetZ = opponent.z + Math.sin(circlePhase * 2) * circleRadius * 0.6;  // Figure-8 in z

                this.vx += (targetX - this.x) * 0.03;
                this.vz += (targetZ - this.z) * 0.03;

                // Occasional altitude changes
                this.vy += Math.sin(this.moveTimer / 15) * 0.2;

                this.isDiving = false;
            }

        } else if (this.onWall) {
            // WALL ATTACK POSITIONING
            this.vy = Math.sign(dy) * speed * 3;

            if (horizDist < 150 && Math.abs(dy) < 60 && Math.random() < 0.03 + this.drives.aggression * 0.05) {
                // Wall pounce in full 3D
                this.jump(1.0);
                const pounceDir = this.wallSide === 'left' ? 1 : -1;
                this.vx = pounceDir * 10;
                this.vz = Math.sign(dz) * 6;  // Strong z-component for 3D pounce
            }

        } else {
            // GROUND BUG - 3D FLANKING AND PURSUIT
            const opponentCornered = opponent.isCornered(120);
            const opponentWallSide = opponent.getNearestWallSide();

            // HIGH INSTINCT: 3D flanking maneuvers
            if (instinctFactor > 0.4 && dist < attackRange * 3) {
                if (opponentCornered) {
                    // Press cornered opponent - cut off escape
                    const arenaCenter = (ARENA.leftWall + ARENA.rightWall) / 2;
                    const cutoffX = opponentWallSide === 'left'
                        ? opponent.x + 60
                        : opponent.x - 60;

                    const cutoffDx = cutoffX - this.x;
                    if (Math.abs(cutoffDx) > 30) {
                        this.vx += Math.sign(cutoffDx) * speed * 1.2;
                    } else {
                        this.vx += Math.sign(dx) * speed;
                    }
                    // Pin them against wall in z too
                    this.vz += Math.sign(dz) * speed * 0.8;

                } else {
                    // FLANKING: approach from the side in z-axis
                    const flankPhase = this.moveTimer / 20;
                    const flankOffset = Math.sin(flankPhase) * 60 * instinctFactor;
                    const targetZ = opponent.z + flankOffset;

                    this.vx += Math.sign(dx) * speed;
                    this.vz += (targetZ - this.z) * 0.04 + Math.sign(dz) * speed * 0.3;
                }
            } else {
                // Direct pursuit in 3D
                this.vx += Math.sign(dx) * speed;
                this.vz += Math.sign(dz) * speed * 0.7;  // Strong z pursuit
            }

            // Jump at elevated opponents
            if (opponent.isFlying || opponent.onWall || opponent.y < this.y - 50) {
                if (this.grounded && horizDist < attackRange * 2.5 && Math.random() < 0.05 + this.drives.aggression * 0.08) {
                    this.jump(1.0);
                    // Jump toward opponent in full 3D
                    const jumpDist = Math.sqrt(dx * dx + dz * dz);
                    if (jumpDist > 0) {
                        this.vx += (dx / jumpDist) * 5;
                        this.vz += (dz / jumpDist) * 4;
                    }
                }
            }
        }
    }

    executeCirclingAI(opponent, dx, dy, dz, dist, attackRange) {
        const speed = 0.2 + (this.genome.speed / 200);
        const circleRadius = 80 + this.drives.caution * 80;  // Increased for better 3D space
        const instinctFactor = this.genome.instinct / 100;

        // Circular motion speed - faster for speedy bugs
        const circleSpeed = (this.side === 'left' ? 0.05 : -0.05) * (this.genome.speed / 50);
        this.circleAngle += circleSpeed;

        // Separate angle for vertical oscillation
        const verticalAngle = this.moveTimer / 20;

        // High instinct: avoid walls
        const iAmCornered = this.isCornered(100);
        const wallAvoidance = iAmCornered ? this.getEscapeDirection() * instinctFactor * 0.8 : 0;

        if (this.isFlying) {
            // TRUE 3D AERIAL CIRCLING - orbit in a tilted ellipse around opponent
            const orbitTilt = 0.4;  // How much the orbit tilts in Y
            const zRadius = circleRadius * 0.8;  // Elliptical orbit

            let targetX = opponent.x + Math.cos(this.circleAngle) * circleRadius;
            let targetZ = opponent.z + Math.sin(this.circleAngle) * zRadius;
            let targetY = opponent.y - 80 + Math.sin(this.circleAngle) * circleRadius * orbitTilt;

            // Add vertical bobbing for more dynamic flight
            targetY += Math.sin(verticalAngle) * 30;

            // Wall avoidance
            if (instinctFactor > 0.3) {
                const arenaCenter = (ARENA.leftWall + ARENA.rightWall) / 2;
                const wallBias = (arenaCenter - targetX) * instinctFactor * 0.2;
                targetX += wallBias;
                targetZ = clamp(targetZ, ARENA.backWall + 80, ARENA.frontWall - 80);
            }

            // Ceiling/floor avoidance
            targetY = clamp(targetY, ARENA.ceilingY + 60, ARENA.floorY - 60);

            // Smooth movement toward target
            this.vx += (targetX - this.x) * 0.035;
            this.vy += (targetY - this.y) * 0.035;
            this.vz += (targetZ - this.z) * 0.035;

            // Maintain height advantage over grounded opponents
            if (!opponent.isFlying && this.y > opponent.y - 50) {
                this.vy -= 0.4;
            }

            // Subtle z-weave for unpredictability
            this.vz += Math.sin(this.moveTimer / 8) * 0.15;

        } else if (this.isWallcrawler && this.onWall) {
            // Wall circling - move up and down while tracking
            const targetY = opponent.y + Math.sin(this.circleAngle * 2) * 50;
            this.vy = clamp((targetY - this.y) * 0.1, -speed * 3, speed * 3);

        } else {
            // GROUND BUG - Full 3D circling around opponent
            // Circle in the XZ plane with occasional feints
            const effectiveRadius = circleRadius * (1 + Math.sin(verticalAngle) * 0.2);
            let targetX = opponent.x + Math.cos(this.circleAngle) * effectiveRadius;
            let targetZ = opponent.z + Math.sin(this.circleAngle) * effectiveRadius * 0.8;

            // Wall avoidance
            if (iAmCornered && instinctFactor > 0.3) {
                targetX += wallAvoidance * 50;
                // Reverse direction if heading into wall
                const predictedX = this.x + (targetX - this.x) * 0.5;
                if (predictedX < ARENA.leftWall + 80 || predictedX > ARENA.rightWall - 80) {
                    this.circleAngle += Math.PI;
                    targetX = opponent.x + Math.cos(this.circleAngle) * effectiveRadius;
                }
            }

            // Z-wall avoidance
            targetZ = clamp(targetZ, ARENA.backWall + 60, ARENA.frontWall - 60);

            // Move toward target position
            this.vx += (targetX - this.x) * 0.04;
            this.vz += (targetZ - this.z) * 0.04;

            // Occasional hop for unpredictability
            if (this.grounded && Math.random() < 0.015 + instinctFactor * 0.02) {
                this.jump(0.4);
                // Small lateral hop
                this.vx += (Math.random() - 0.5) * 3;
                this.vz += (Math.random() - 0.5) * 3;
            }
        }

        // Break out of circling when aggressive enough - faster engagement
        const breakoutTime = Math.floor(60 - this.drives.aggression * 50);
        if (this.aiStateTimer > breakoutTime || dist < attackRange * 1.2) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeRetreatingAI(opponent, dx, dy, dz, dist) {
        const speed = 0.25 + (this.genome.speed / 200);
        const instinctFactor = this.genome.instinct / 100;

        // Calculate escape vectors
        const iAmCornered = this.isCornered(100);
        const iAmCorneredZ = this.z > ARENA.frontWall - 80 || this.z < ARENA.backWall + 80;
        const escapeDir = this.getEscapeDirection();
        const escapeDirZ = this.z > 0 ? -1 : 1;  // Toward z-center

        // Default: away from opponent
        const retreatDir = -Math.sign(dx) || (Math.random() > 0.5 ? 1 : -1);
        const retreatDirZ = -Math.sign(dz) || (Math.random() > 0.5 ? 1 : -1);

        if (this.isFlying) {
            // FLYING RETREAT - use full 3D space to escape
            // Primary strategy: gain altitude while creating distance

            // Climb away - higher = safer
            this.vy -= 0.7;

            // Wall-aware horizontal retreat
            let retreatX = retreatDir;
            let retreatZ = retreatDirZ;

            if (iAmCornered) {
                // X-cornered: escape toward center
                retreatX = escapeDir * 0.8 + retreatDir * 0.2;
            }
            if (iAmCorneredZ) {
                // Z-cornered: escape toward z-center
                retreatZ = escapeDirZ * 0.8 + retreatDirZ * 0.2;
            }

            // High instinct: evasive maneuvers while retreating
            if (instinctFactor > 0.4) {
                const evadePhase = this.moveTimer / 6;
                retreatX += Math.sin(evadePhase) * instinctFactor * 0.5;
                retreatZ += Math.cos(evadePhase) * instinctFactor * 0.5;
            }

            this.vx += retreatX * speed * 1.8;
            this.vz += retreatZ * speed * 1.5;

            // Ceiling bounce
            if (this.y < ARENA.ceilingY + 80) {
                this.vy += 0.5;
            }

            // If opponent is also flying and close, perform evasive dive
            if (opponent.isFlying && dist < 150 && Math.random() < 0.03) {
                this.vy += 1.5;  // Sudden dive
                this.vz += (Math.random() > 0.5 ? 1 : -1) * speed * 3;
            }

        } else if (this.isWallcrawler) {
            if (this.onWall) {
                // Climb up for safety
                this.vy = -speed * 4;
            } else {
                // Rush to nearest wall for safety
                const nearestWall = this.x < (ARENA.leftWall + ARENA.rightWall) / 2 ? 'left' : 'right';
                this.vx += nearestWall === 'left' ? -speed * 3 : speed * 3;
                // Also retreat in z
                this.vz += retreatDirZ * speed * 0.5;
            }

        } else {
            // GROUND RETREAT - 3D escape routes
            const panicFactor = this.getWallProximity();
            const panicFactorZ = Math.abs(this.z) / (ARENA.frontWall - 50);

            if ((iAmCornered || iAmCorneredZ) && instinctFactor > 0.3) {
                // CORNERED - use 3D space to escape

                if (panicFactor > 0.7 || panicFactorZ > 0.7) {
                    // Critically cornered - desperate escape
                    if (this.grounded && Math.random() < 0.12 * instinctFactor) {
                        this.jump(1.0);
                        // Jump in best escape direction
                        if (iAmCornered) {
                            this.vx += escapeDir * 7;
                        } else {
                            this.vx += retreatDir * 4;
                        }
                        if (iAmCorneredZ) {
                            this.vz += escapeDirZ * 6;
                        } else {
                            this.vz += retreatDirZ * 4;
                        }
                    } else {
                        // Strafe escape in 3D
                        this.vx += (iAmCornered ? escapeDir : retreatDir) * speed * 1.5;
                        this.vz += (iAmCorneredZ ? escapeDirZ : retreatDirZ) * speed * 1.5;
                    }
                } else {
                    // Partially cornered - angled retreat
                    this.vx += (retreatDir * 0.4 + escapeDir * 0.6 * instinctFactor) * speed * 1.2;
                    this.vz += (retreatDirZ * 0.4 + escapeDirZ * 0.6 * instinctFactor) * speed * 1.2;
                }

            } else {
                // Not cornered - standard 3D retreat
                this.vx += retreatDir * speed * 1.2;
                this.vz += retreatDirZ * speed * 0.8;

                // Slight lateral movement for unpredictability
                if (instinctFactor > 0.3) {
                    const dodgeDir = Math.sin(this.moveTimer / 5) * instinctFactor;
                    this.vz += dodgeDir * speed;
                }
            }

            // Occasional retreat hop
            if (this.grounded && Math.random() < 0.04 + instinctFactor * 0.02) {
                this.jump(0.5);
                this.vx += (iAmCornered ? escapeDir : retreatDir) * 2;
                this.vz += (iAmCorneredZ ? escapeDirZ : retreatDirZ) * 2;
            }
        }

        // Exit retreat when safe
        const retreatDuration = Math.floor(50 + this.drives.caution * 50 - this.drives.aggression * 25);
        if (this.aiStateTimer > retreatDuration || dist > 280) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
        }
    }

    updateWallClimbing(opponent, dist) {
        const halfSize = this.spriteSize / 2;
        const staminaPercent = this.stamina / this.maxStamina;
        const arenaCenter = (ARENA.leftWall + ARENA.rightWall) / 2;

        if (this.onWall) {
            // Snap to wall position
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

            // Enhanced stamina recovery on wall
            this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * 1.5);

            // Wall climbing movement - always try to match or gain height advantage
            const targetY = opponent.y - 30; // Want to be slightly above opponent
            const heightDiff = this.y - targetY;

            if (this.aiState === 'aggressive') {
                // Aggressively match opponent height for attack positioning
                if (Math.abs(heightDiff) > 20) {
                    const climbSpeed = 4 + (this.genome.speed / 30);
                    this.vy = Math.sign(targetY - this.y) * climbSpeed;
                } else {
                    // In position - prepare to pounce
                    this.vy = Math.sin(this.moveTimer / 10) * 1; // Subtle movement
                }
            } else if (this.aiState === 'retreating' || staminaPercent < 0.4) {
                // Climb high for safety and recovery
                this.vy = -3.5;
            } else if (this.aiState === 'circling') {
                // Circle by moving up and down on wall
                this.vy = Math.sin(this.moveTimer / 15) * 2.5;
            } else {
                this.vy = Math.sin(this.moveTimer / 20) * 2;
            }

            // WALL JUMP / POUNCE ATTACK
            const horizDist = Math.abs(opponent.x - this.x);
            const vertDist = Math.abs(opponent.y - this.y);
            const hasLineOfSight = vertDist < 80;

            // Pounce conditions - more likely when:
            // - Opponent is in range horizontally
            // - We have height advantage or are at same level
            // - We have stamina
            // - We're aggressive
            if (horizDist < 250 && hasLineOfSight && staminaPercent > 0.3) {
                const heightAdvantage = this.y < opponent.y - 10;
                const pounceChance = 0.03 +
                    (this.drives.aggression * 0.1) +
                    (heightAdvantage ? 0.05 : 0) +
                    (horizDist < 150 ? 0.03 : 0);

                if (Math.random() < pounceChance) {
                    // WALL JUMP!
                    this.onWall = false;
                    this.grounded = false;

                    const pounceDir = this.wallSide === 'left' ? 1 : -1;
                    const jumpPower = 12 + (this.genome.speed / 8);

                    // Calculate trajectory towards opponent
                    const dx = opponent.x - this.x;
                    const dy = opponent.y - this.y;
                    const angle = Math.atan2(dy, Math.abs(dx));

                    this.vx = pounceDir * jumpPower * Math.cos(angle);
                    this.vy = -6 + Math.min(4, dy / 40); // Upward arc, adjusted for height diff

                    // Use some stamina for the jump
                    this.spendStamina(5);
                }
            }

            // Leave wall if too far from action or fully recovered
            if (dist > 450 || (staminaPercent > 0.85 && this.aiState !== 'retreating' && this.drives.aggression > 0.5)) {
                this.onWall = false;
                this.grounded = false;
                // Drop down with slight push toward center
                this.vx = this.wallSide === 'left' ? 3 : -3;
            }
        } else {
            // NOT ON WALL - decide whether to seek wall
            const nearLeftWall = this.x < ARENA.leftWall + 80;
            const nearRightWall = this.x > ARENA.rightWall - 80;

            // Climb if near wall and conditions are right
            if ((nearLeftWall || nearRightWall) && this.grounded) {
                const wantToClimb =
                    staminaPercent < 0.5 ||  // Low stamina - go recover
                    opponent.isFlying ||      // Opponent flying - match vertical mobility
                    opponent.y < this.y - 40 || // Opponent above - gain height
                    (this.drives.caution > 0.6 && Math.random() < 0.15) ||
                    (dist < 120 && Math.random() < 0.12) || // Close combat - escape up
                    (this.aiState === 'retreating');

                if (wantToClimb) {
                    this.onWall = true;
                    this.wallSide = nearLeftWall ? 'left' : 'right';
                    this.vy = -3; // Initial upward boost
                }
            }

            // ACTIVELY SEEK WALLS when:
            // - Opponent is flying and we're grounded
            // - Low stamina
            // - Retreating
            // - Opponent has range advantage
            const shouldSeekWall =
                (opponent.isFlying && !this.onWall) ||
                (staminaPercent < 0.35 && !this.onWall) ||
                (this.aiState === 'retreating' && !this.onWall) ||
                (dist > 200 && opponent.y < this.y - 50); // They're above us at range

            if (shouldSeekWall) {
                // Move toward nearest wall
                const nearestWall = this.x < arenaCenter ? 'left' : 'right';
                const wallForce = 1.2 + (this.genome.speed / 80);
                this.vx += nearestWall === 'left' ? -wallForce : wallForce;
            }
        }
    }

    // Serialize state for transmission
    toState() {
        return {
            x: Math.round(this.x * 10) / 10,
            y: Math.round(this.y * 10) / 10,
            z: Math.round(this.z * 10) / 10,  // 3D: z coordinate
            // Velocity for visual tilt/banking
            vx: Math.round(this.vx * 10) / 10,
            vy: Math.round(this.vy * 10) / 10,
            vz: Math.round(this.vz * 10) / 10,
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
            grounded: this.grounded,
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
            // Knockback state
            isKnockedBack: this.isKnockedBack,
            wallStunTimer: this.wallStunTimer,
            // 3D mobility info
            isFlying: this.isFlying,
            isWallcrawler: this.isWallcrawler,
            isDiving: this.isDiving || false,
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

        this.roster = new RosterManager();

        this.fighters = [];
        this.bugs = []; // Genome data for client
        this.bugNames = [];
        this.bugIds = []; // IDs of current fighters in roster
        this.bugRecords = []; // W-L records

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

        // Select two bugs from roster
        const [bug1, bug2] = this.roster.selectFighters();

        const genome1 = new BugGenome(bug1.genome);
        const genome2 = new BugGenome(bug2.genome);

        this.bugs = [bug1.genome, bug2.genome];
        this.bugNames = [bug1.name, bug2.name];
        this.bugIds = [bug1.id, bug2.id];
        this.bugRecords = [
            { wins: bug1.wins, losses: bug1.losses },
            { wins: bug2.wins, losses: bug2.losses }
        ];

        this.fighters = [
            new Fighter(genome1, 'left', bug1.name),
            new Fighter(genome2, 'right', bug2.name),
        ];

        this.attackCooldowns = [30 + Math.random() * 30, 30 + Math.random() * 30];

        this.addEvent('commentary', `FIGHT #${this.fightNumber} - Place your bets!`, '#ff0');
    }

    calculateOdds() {
        const p1 = this.fighters[0].getPowerRating();
        const p2 = this.fighters[1].getPowerRating();
        const total = p1 + p2;

        // True win probabilities (normalized)
        const prob1 = p1 / total;
        const prob2 = p2 / total;

        // Apply house edge (5% spread)
        // This reduces payouts slightly - the "juice" or "vig"
        const houseEdge = 0.05;
        const adjustedProb1 = prob1 + (houseEdge / 2);
        const adjustedProb2 = prob2 + (houseEdge / 2);

        // Convert to decimal odds (European style)
        // Decimal odds = 1 / probability
        const decimal1 = (1 / adjustedProb1).toFixed(2);
        const decimal2 = (1 / adjustedProb2).toFixed(2);

        // Convert to American odds
        // If prob > 50%: American = -100 * (prob / (1 - prob))
        // If prob < 50%: American = 100 * ((1 - prob) / prob)
        const toAmerican = (prob) => {
            if (prob >= 0.5) {
                return Math.round(-100 * (prob / (1 - prob)));
            } else {
                return '+' + Math.round(100 * ((1 - prob) / prob));
            }
        };

        const american1 = toAmerican(adjustedProb1);
        const american2 = toAmerican(adjustedProb2);

        return {
            fighter1: decimal1,
            fighter2: decimal2,
            american1: american1,
            american2: american2,
            prob1: Math.round(prob1 * 100),
            prob2: Math.round(prob2 * 100),
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
        const dz = f2.z - f1.z;  // 3D: z difference
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);  // 3D: full distance

        // Combined collision radius - nearly full sprite size to prevent overlap
        const minDist = (f1.spriteSize + f2.spriteSize) / 2 * 0.95;

        if (dist < minDist) {
            // Handle edge case where bugs are at same position
            if (dist < 1) {
                f1.x -= 10;
                f2.x += 10;
                f1.z -= 5;  // 3D: also separate in z
                f2.z += 5;
                return;
            }

            // Calculate overlap
            const overlap = minDist - dist;

            // Normalize direction
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;  // 3D: z normal

            // Push apart based on mass ratio
            const totalMass = f1.mass + f2.mass;
            const f1Ratio = f2.mass / totalMass;
            const f2Ratio = f1.mass / totalMass;

            // Immediately separate the fighters (no partial - full separation)
            const separationForce = overlap + 2; // Extra push to ensure separation
            f1.x -= nx * separationForce * f1Ratio;
            f1.y -= ny * separationForce * f1Ratio * 0.3; // Less vertical push
            f1.z -= nz * separationForce * f1Ratio;  // 3D: z separation
            f2.x += nx * separationForce * f2Ratio;
            f2.y += ny * separationForce * f2Ratio * 0.3;
            f2.z += nz * separationForce * f2Ratio;  // 3D: z separation

            // Bounce velocity to keep them moving apart
            const bounce = 1.5;
            f1.vx -= nx * bounce;
            f1.vz -= nz * bounce * 0.5;  // 3D: z bounce
            f2.vx += nx * bounce;
            f2.vz += nz * bounce * 0.5;  // 3D: z bounce
        }
    }

    checkWallImpact(fighter) {
        if (fighter.lastWallImpact) {
            const impact = fighter.lastWallImpact;

            // Generate event for renderer (screen shake, particles)
            this.addEvent('wallImpact', {
                x: fighter.x,
                y: fighter.y,
                name: fighter.name,
                velocity: impact.velocity,
                wallSide: impact.wallSide,
                stunApplied: impact.stunApplied,
            });

            // Commentary based on impact severity
            if (impact.stunApplied >= 20) {
                this.addEvent('commentary', `${fighter.name} SLAMMED into the wall!`, '#f80');
            } else if (impact.stunApplied >= 10) {
                this.addEvent('commentary', `${fighter.name} crashes into the wall!`, '#fa0');
            }

            // Clear the impact info
            fighter.lastWallImpact = null;
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

        // Check for wall impacts and generate events
        this.checkWallImpact(f1);
        this.checkWallImpact(f2);

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
        const dz = target.z - attacker.z;  // 3D: z difference
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);  // 3D: full distance
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

                // DIVE ATTACK BONUS - flying bug attacking from above
                const isDiveAttack = attacker.isFlying && attacker.isDiving && attacker.y < target.y;
                if (isDiveAttack) {
                    const heightBonus = Math.min(1.5, 1 + Math.abs(target.y - attacker.y) / 200);
                    damage = Math.floor(damage * heightBonus);
                    this.addEvent('commentary', 'DIVE ATTACK!', '#f80');
                }

                // HEIGHT ADVANTAGE BONUS - any bug attacking from above
                const heightAdvantage = target.y - attacker.y;
                if (heightAdvantage > 40 && !isDiveAttack) {
                    damage = Math.floor(damage * 1.15);  // 15% bonus
                }

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

                // Knockback - enhanced with weapon types and damage scaling
                const massRatio = attacker.mass / target.mass;
                const damageRatio = damage / 10; // Scale knockback with damage

                // Weapon knockback multipliers
                let weaponKnockback = 1.0;
                switch (attacker.genome.weapon) {
                    case 'mandibles': weaponKnockback = 0.8; break;  // Grip, less knockback
                    case 'stinger': weaponKnockback = 1.4; break;    // Pierce, more knockback
                    case 'claws': weaponKnockback = 1.2; break;      // Slash, good knockback
                    case 'fangs': weaponKnockback = 1.0; break;      // Bite, standard
                }

                // Defense knockback resistance
                let defenseResist = 1.0;
                if (target.genome.defense === 'shell') {
                    defenseResist = 0.7; // Heavy shell resists knockback
                } else if (target.genome.defense === 'agility') {
                    defenseResist = 1.3; // Light, more knockback
                }

                const baseKnockback = isCrit ? 12 : 7;
                const knockbackForce = baseKnockback * Math.sqrt(massRatio) * weaponKnockback * defenseResist * (0.8 + damageRatio * 0.3);

                // 3D: Calculate 3D direction vector for knockback
                const dirZ = dist > 0 ? dz / dist : 0;
                target.vx += dirX * knockbackForce;
                target.vy += dirY * knockbackForce * 0.3 - 3; // Slight upward pop
                target.vz += dirZ * knockbackForce * 0.7;  // 3D: z knockback

                // Track knockback state for wall stun detection
                target.isKnockedBack = true;
                target.knockbackVelocity = knockbackForce;

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
            // Record win/loss
            this.roster.recordWin(this.bugIds[0]);
            this.roster.recordLoss(this.bugIds[1]);
        } else if (f2.isAlive && !f1.isAlive) {
            this.winner = 2;
            f2.setState('victory');
            this.addEvent('commentary', `${f2.name} WINS!`, '#ff0');
            // Record win/loss
            this.roster.recordWin(this.bugIds[1]);
            this.roster.recordLoss(this.bugIds[0]);
        } else {
            // Both dead - draw (no record change)
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
            bugRecords: this.bugRecords,
            odds: this.calculateOdds(),
            events: this.events,
            winner: this.winner,
        };
    }

    // Get full roster for client
    getRoster() {
        return this.roster.getRosterForClient();
    }
}

module.exports = { Simulation, Fighter, ARENA, TICK_RATE, TICK_MS };
