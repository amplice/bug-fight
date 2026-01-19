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
let player = { money: parseInt(localStorage.getItem('bugfights_money')) || 1000 };
let currentBet = { amount: 0, on: null };
let nextBugs = { bug1: null, bug2: null };
let fighters = [];
let particles = [];
let bloodStains = [];
let commentary = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let gameLoop = null;
let combatTick = 0;

// Dynamic camera system
let camera = {
    x: ARENA.width / 2,
    y: ARENA.height / 2,
    targetX: ARENA.width / 2,
    targetY: ARENA.height / 2,
    zoom: 1.0,
    targetZoom: 1.0,
    focusTarget: null,       // Fighter to focus on, or null for center
    focusIntensity: 0,       // How strongly to focus (0-1)
    shakeX: 0,
    shakeY: 0,
    shakeIntensity: 0,
    dramaticZoom: false,
    dramaticTimer: 0
};

// Countdown
const COUNTDOWN_SECONDS = 10;
let countdownTimer = COUNTDOWN_SECONDS;
let lastCountdownUpdate = 0;
let fightNumber = 0;

// Hit pause system
let hitPause = 0;
let impactFlash = { active: false, x: 0, y: 0, radius: 0, alpha: 0 };
let slowMotion = 1;

// Floating damage numbers
let floatingNumbers = [];

// Terrarium decorations (generated once per fight)
let terrarium = {
    plants: [],
    rocks: [],
    substrate: [],
    hazards: [],
    initialized: false
};

// Hazard types for arena
const HAZARD_TYPES = {
    puddle: { color: '#2a4a6a', damagePerTick: 0, slowFactor: 0.5, radius: 40 },
    thornPatch: { color: '#2a4a2a', damagePerTick: 1, slowFactor: 0.8, radius: 35 },
    hotSpot: { color: '#4a2a1a', damagePerTick: 2, slowFactor: 1, radius: 30 },
    sporeCloud: { color: '#4a4a2a', damagePerTick: 0, slowFactor: 1, missChanceBonus: 0.2, radius: 45 }
};

function generateTerrariumDecorations() {
    terrarium.plants = [];
    terrarium.rocks = [];
    terrarium.substrate = [];

    // Generate substrate particles (dirt/sand texture)
    for (let i = 0; i < 150; i++) {
        terrarium.substrate.push({
            x: ARENA.leftWall + Math.random() * (ARENA.rightWall - ARENA.leftWall),
            y: ARENA.floorY + Math.random() * 18,
            size: 1 + Math.random() * 3,
            color: ['#4a3a28', '#5a4a35', '#3a2a18', '#6a5a45'][Math.floor(Math.random() * 4)]
        });
    }

    // Generate rocks (2-4 rocks)
    const numRocks = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numRocks; i++) {
        const baseX = ARENA.leftWall + 80 + Math.random() * (ARENA.rightWall - ARENA.leftWall - 160);
        const rockWidth = 20 + Math.random() * 40;
        const rockHeight = 15 + Math.random() * 25;
        terrarium.rocks.push({
            x: baseX,
            y: ARENA.floorY - rockHeight * 0.7,
            width: rockWidth,
            height: rockHeight,
            color: ['#4a4a4a', '#5a5a5a', '#3a3a3a', '#606060'][Math.floor(Math.random() * 4)],
            highlight: ['#6a6a6a', '#7a7a7a', '#5a5a5a'][Math.floor(Math.random() * 3)]
        });
    }

    // Generate plants (3-6 plants on sides)
    const numPlants = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numPlants; i++) {
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const baseX = side === 'left'
            ? ARENA.leftWall + 10 + Math.random() * 80
            : ARENA.rightWall - 90 + Math.random() * 80;

        const plantType = Math.floor(Math.random() * 3); // 0=grass, 1=fern, 2=succulent
        const height = 30 + Math.random() * 50;
        const leaves = [];

        if (plantType === 0) {
            // Grass - multiple blades
            const numBlades = 5 + Math.floor(Math.random() * 5);
            for (let j = 0; j < numBlades; j++) {
                leaves.push({
                    offsetX: (Math.random() - 0.5) * 15,
                    height: height * (0.6 + Math.random() * 0.4),
                    curve: (Math.random() - 0.5) * 20,
                    width: 2 + Math.random() * 2
                });
            }
        } else if (plantType === 1) {
            // Fern - drooping fronds
            const numFronds = 4 + Math.floor(Math.random() * 3);
            for (let j = 0; j < numFronds; j++) {
                const angle = -Math.PI/2 + (j / (numFronds-1) - 0.5) * Math.PI * 0.8;
                leaves.push({
                    angle: angle,
                    length: height * (0.5 + Math.random() * 0.5),
                    droop: 0.3 + Math.random() * 0.3
                });
            }
        } else {
            // Succulent - rosette
            const numLeaves = 6 + Math.floor(Math.random() * 4);
            for (let j = 0; j < numLeaves; j++) {
                const angle = (j / numLeaves) * Math.PI * 2;
                leaves.push({
                    angle: angle,
                    length: 10 + Math.random() * 15,
                    width: 5 + Math.random() * 5
                });
            }
        }

        terrarium.plants.push({
            x: baseX,
            y: ARENA.floorY,
            type: plantType,
            height: height,
            leaves: leaves,
            color: ['#2d5a2d', '#3d6a3d', '#4d7a4d', '#2a4a2a'][Math.floor(Math.random() * 4)],
            darkColor: ['#1a3a1a', '#2a4a2a', '#1a2a1a'][Math.floor(Math.random() * 3)]
        });
    }

    // Generate hazards (0-2 hazards per fight, 30% chance for any hazard)
    terrarium.hazards = [];
    if (Math.random() < 0.3) {
        const hazardTypes = Object.keys(HAZARD_TYPES);
        const numHazards = 1 + Math.floor(Math.random() * 2);

        for (let i = 0; i < numHazards; i++) {
            const type = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
            const hazardInfo = HAZARD_TYPES[type];

            terrarium.hazards.push({
                type: type,
                x: ARENA.leftWall + 100 + Math.random() * (ARENA.rightWall - ARENA.leftWall - 200),
                y: ARENA.floorY - 10,
                radius: hazardInfo.radius + Math.random() * 15,
                ...hazardInfo,
                pulsePhase: Math.random() * Math.PI * 2,
                lastDamageTick: 0
            });
        }

        // Announce hazards
        if (terrarium.hazards.length > 0) {
            const hazardName = terrarium.hazards[0].type.replace(/([A-Z])/g, ' $1').trim();
            setTimeout(() => {
                addCommentary(`Watch out! ${hazardName} on the field!`, '#f80');
            }, 500);
        }
    }

    terrarium.initialized = true;
}

function renderTerrarium(ctx) {
    // Render substrate texture
    terrarium.substrate.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    // Render rocks
    terrarium.rocks.forEach(rock => {
        // Rock shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(rock.x + rock.width/2, ARENA.floorY + 2, rock.width/2 + 5, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rock body
        ctx.fillStyle = rock.color;
        ctx.beginPath();
        ctx.ellipse(rock.x + rock.width/2, rock.y + rock.height/2, rock.width/2, rock.height/2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rock highlight
        ctx.fillStyle = rock.highlight;
        ctx.beginPath();
        ctx.ellipse(rock.x + rock.width/2 - rock.width*0.15, rock.y + rock.height*0.3, rock.width/4, rock.height/4, -0.3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Render plants
    terrarium.plants.forEach(plant => {
        ctx.save();
        ctx.translate(plant.x, plant.y);

        if (plant.type === 0) {
            // Grass blades
            plant.leaves.forEach(leaf => {
                ctx.strokeStyle = plant.color;
                ctx.lineWidth = leaf.width;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(leaf.offsetX, 0);
                ctx.quadraticCurveTo(
                    leaf.offsetX + leaf.curve,
                    -leaf.height/2,
                    leaf.offsetX + leaf.curve * 1.5,
                    -leaf.height
                );
                ctx.stroke();
            });
        } else if (plant.type === 1) {
            // Fern fronds
            plant.leaves.forEach(leaf => {
                ctx.strokeStyle = plant.color;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';

                const endX = Math.cos(leaf.angle) * leaf.length;
                const endY = Math.sin(leaf.angle) * leaf.length + leaf.droop * leaf.length;

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(
                    endX * 0.5,
                    Math.sin(leaf.angle) * leaf.length * 0.5,
                    endX,
                    endY
                );
                ctx.stroke();

                // Frond leaflets
                ctx.lineWidth = 1;
                for (let i = 0.2; i < 1; i += 0.15) {
                    const px = endX * i;
                    const py = Math.sin(leaf.angle) * leaf.length * i + leaf.droop * leaf.length * i * i;
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + 5, py + 3);
                    ctx.moveTo(px, py);
                    ctx.lineTo(px - 5, py + 3);
                    ctx.stroke();
                }
            });
        } else {
            // Succulent rosette
            plant.leaves.forEach(leaf => {
                ctx.fillStyle = plant.color;
                ctx.beginPath();
                const tipX = Math.cos(leaf.angle) * leaf.length;
                const tipY = Math.sin(leaf.angle) * leaf.length - 10;
                ctx.ellipse(tipX/2, tipY/2 - 5, leaf.width, leaf.length/2, leaf.angle, 0, Math.PI * 2);
                ctx.fill();

                // Highlight
                ctx.fillStyle = plant.darkColor;
                ctx.beginPath();
                ctx.ellipse(tipX/2, tipY/2 - 5, leaf.width * 0.5, leaf.length/3, leaf.angle, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        ctx.restore();
    });

    // Render hazards
    terrarium.hazards.forEach(hazard => {
        hazard.pulsePhase += 0.05;
        const pulse = 0.7 + Math.sin(hazard.pulsePhase) * 0.3;

        // Hazard glow
        const gradient = ctx.createRadialGradient(
            hazard.x, hazard.y, 0,
            hazard.x, hazard.y, hazard.radius
        );

        switch (hazard.type) {
            case 'puddle':
                gradient.addColorStop(0, `rgba(40, 80, 120, ${0.6 * pulse})`);
                gradient.addColorStop(0.7, `rgba(30, 60, 100, ${0.4 * pulse})`);
                gradient.addColorStop(1, 'transparent');
                break;
            case 'thornPatch':
                gradient.addColorStop(0, `rgba(60, 100, 40, ${0.7 * pulse})`);
                gradient.addColorStop(0.7, `rgba(40, 80, 30, ${0.5 * pulse})`);
                gradient.addColorStop(1, 'transparent');
                // Draw thorns
                ctx.strokeStyle = '#3a5a2a';
                ctx.lineWidth = 2;
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const len = hazard.radius * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(hazard.x, hazard.y);
                    ctx.lineTo(
                        hazard.x + Math.cos(angle) * len,
                        hazard.y + Math.sin(angle) * len * 0.5 - 5
                    );
                    ctx.stroke();
                }
                break;
            case 'hotSpot':
                gradient.addColorStop(0, `rgba(180, 80, 20, ${0.8 * pulse})`);
                gradient.addColorStop(0.5, `rgba(120, 40, 10, ${0.5 * pulse})`);
                gradient.addColorStop(1, 'transparent');
                // Occasional ember particles
                if (Math.random() < 0.05) {
                    spawnParticles(
                        hazard.x + (Math.random() - 0.5) * hazard.radius,
                        hazard.y - 5,
                        'spark', 1
                    );
                }
                break;
            case 'sporeCloud':
                gradient.addColorStop(0, `rgba(100, 100, 40, ${0.5 * pulse})`);
                gradient.addColorStop(0.7, `rgba(80, 80, 30, ${0.3 * pulse})`);
                gradient.addColorStop(1, 'transparent');
                // Floating spore particles
                if (Math.random() < 0.08) {
                    spawnParticles(
                        hazard.x + (Math.random() - 0.5) * hazard.radius,
                        hazard.y - Math.random() * 20,
                        'poison', 1
                    );
                }
                break;
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(hazard.x, hazard.y, hazard.radius, hazard.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Floating damage number class
class FloatingNumber {
    constructor(x, y, value, color, isCrit = false) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.color = color;
        this.isCrit = isCrit;
        this.vy = -3;
        this.life = 1;
        this.scale = isCrit ? 1.5 : 1;
    }

    update() {
        this.y += this.vy;
        this.vy += 0.1; // Gravity
        this.life -= 0.02;
        if (this.isCrit) {
            this.scale *= 0.98;
        }
    }

    render(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = `bold ${Math.floor(16 * this.scale)}px monospace`;
        ctx.textAlign = 'center';

        // Shadow
        ctx.fillStyle = '#000';
        ctx.fillText(this.value, this.x + 1, this.y + 1);

        // Main text
        ctx.fillStyle = this.color;
        ctx.fillText(this.value, this.x, this.y);

        if (this.isCrit) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeText(this.value, this.x, this.y);
        }
        ctx.restore();
    }
}

function spawnFloatingNumber(x, y, value, color = '#fff', isCrit = false) {
    floatingNumbers.push(new FloatingNumber(
        x + (Math.random() - 0.5) * 20,
        y - 20,
        (isCrit ? '!' : '') + value,
        color,
        isCrit
    ));
}

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

        // Intro animation
        this.introState = 'waiting'; // waiting, entering, ready
        this.introTimer = 0;
        this.targetX = this.x; // Store final position
        this.targetY = this.y;
        this.introOffsetX = 0;
        this.introScale = 0;

        // Attack
        this.attackTarget = null;
        this.lungeX = 0;
        this.lungeY = 0;

        // Visual effects
        this.flashTimer = 0;
        this.squash = 1;
        this.stretch = 1;

        // Death/victory animation
        this.deathRotation = 0;
        this.deathAlpha = 1;
        this.victoryBounce = 0;

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

        // Special ability system
        this.specialAbility = this.determineSpecialAbility();
        this.abilityCharge = 0;
        this.abilityMaxCharge = 100;
        this.abilityActive = false;
        this.abilityTimer = 0;
        this.abilityCooldown = 0;

        // Drive system - simple 0-1 values that shift based on fight outcomes
        // Fury affects initial aggression, instinct affects how fast drives adapt
        const furyNorm = this.genome.fury / 100;
        const instinctNorm = this.genome.instinct / 100;
        this.drives = {
            aggression: 0.3 + furyNorm * 0.4,  // 0.3-0.7 based on fury
            caution: 0.3 + (1 - furyNorm) * 0.4,  // inverse
            adaptRate: 0.02 + instinctNorm * 0.03,  // how fast drives shift (0.02-0.05)
            recentHits: 0,  // hits landed recently
            recentDamage: 0  // damage taken recently
        };

        // Stamina system - energy for actions
        // Bulk determines pool size, Speed determines regen rate
        this.maxStamina = 50 + this.genome.bulk;  // 50-150 based on bulk
        this.stamina = this.maxStamina;
        this.staminaRegen = 0.3 + (this.genome.speed / 100) * 0.5;  // 0.3-0.8 per tick

        // Combo system
        this.comboCount = 0;
        this.comboTimer = 0;
        this.lastHitTime = 0;

        // Fight statistics
        this.stats = {
            damageDealt: 0,
            damageTaken: 0,
            hitsLanded: 0,
            hitsMissed: 0,
            criticalHits: 0,
            dodges: 0,
            specialsUsed: 0
        };

        // Legacy (keeping for compatibility)
        this.circleAngle = side === 'left' ? 0 : Math.PI;
        this.moveTimer = 0;
    }

    determineSpecialAbility() {
        // Assign special ability based on weapon/defense/mobility combination
        const w = this.genome.weapon;
        const d = this.genome.defense;
        const m = this.genome.mobility;

        // Weapon-primary abilities
        if (w === 'mandibles') {
            return { type: 'deathGrip', name: 'Death Grip', desc: 'Crushing hold that deals massive damage', chargeRate: 0.8 };
        } else if (w === 'stinger') {
            return { type: 'venomStrike', name: 'Venom Strike', desc: 'Toxic blast that poisons and damages', chargeRate: 1.0 };
        } else if (w === 'claws') {
            return { type: 'bladeFury', name: 'Blade Fury', desc: 'Rapid slashing frenzy', chargeRate: 1.2 };
        } else if (w === 'fangs') {
            return { type: 'drainBite', name: 'Drain Bite', desc: 'Vampiric bite that heals', chargeRate: 0.9 };
        } else if (w === 'horns') {
            return { type: 'chargeRam', name: 'Charge Ram', desc: 'Devastating charge attack', chargeRate: 0.7 };
        }

        // Defense-based fallback
        if (d === 'shell') {
            return { type: 'fortify', name: 'Fortify', desc: 'Become temporarily invulnerable', chargeRate: 0.6 };
        } else if (d === 'toxic') {
            return { type: 'toxicCloud', name: 'Toxic Cloud', desc: 'Release damaging poison cloud', chargeRate: 0.85 };
        } else if (d === 'camouflage') {
            return { type: 'ambush', name: 'Ambush', desc: 'Vanish and strike with guaranteed crit', chargeRate: 1.1 };
        } else if (d === 'spikes') {
            return { type: 'spinAttack', name: 'Spike Spin', desc: 'Spinning spike attack', chargeRate: 0.95 };
        }

        // Mobility fallback
        if (m === 'winged') {
            return { type: 'diveBomb', name: 'Dive Bomb', desc: 'Aerial dive attack', chargeRate: 1.0 };
        } else if (m === 'wallcrawler') {
            return { type: 'pounce', name: 'Wall Pounce', desc: 'Leap from wall with force', chargeRate: 1.0 };
        }

        // Default
        return { type: 'berserk', name: 'Berserk', desc: 'Enter rage mode with increased damage', chargeRate: 1.0 };
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

    startIntro(delay) {
        this.introState = 'waiting';
        this.introTimer = delay;
        // Start off-screen
        this.introOffsetX = this.side === 'left' ? -200 : 200;
        this.introScale = 0.3;
    }

    updateIntro() {
        if (this.introState === 'waiting') {
            this.introTimer--;
            if (this.introTimer <= 0) {
                this.introState = 'entering';
                // Spawn entry dust
                const dustX = this.side === 'left' ? ARENA.leftWall + 30 : ARENA.rightWall - 30;
                spawnParticles(dustX, ARENA.floorY - 10, 'dust', 3);
            }
        } else if (this.introState === 'entering') {
            // Smoothly move toward target position
            this.introOffsetX *= 0.85;
            this.introScale += (1 - this.introScale) * 0.12;

            // Check if intro is complete
            if (Math.abs(this.introOffsetX) < 2 && Math.abs(1 - this.introScale) < 0.05) {
                this.introState = 'ready';
                this.introOffsetX = 0;
                this.introScale = 1;
                // Ready pose - slight bounce
                this.squash = 0.8;
                this.stretch = 1.2;
                spawnParticles(this.x, this.y, 'landing', 4);
            }
        }
    }

    isIntroComplete() {
        return this.introState === 'ready';
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

        // Victory celebration - bouncing and spinning
        if (this.state === 'victory') {
            this.victoryBounce = Math.sin(this.stateTimer / 8) * 10;
            this.squash = 0.85 + Math.sin(this.stateTimer / 6) * 0.15;
            this.stretch = 1.15 - Math.sin(this.stateTimer / 6) * 0.15;

            // Occasional victory particles
            if (this.stateTimer % 30 === 0) {
                spawnParticles(this.x, this.y - 15, 'spark', 5);
            }
        }

        // Death animation - fall over and fade
        if (this.state === 'death') {
            // Rotate toward the ground
            const targetRotation = this.facingRight ? Math.PI / 2 : -Math.PI / 2;
            this.deathRotation += (targetRotation - this.deathRotation) * 0.1;

            // Flatten
            this.squash = Math.min(1.3, this.squash + 0.02);
            this.stretch = Math.max(0.5, this.stretch - 0.02);

            // Twitch occasionally
            if (this.stateTimer < 60 && Math.random() < 0.1) {
                this.lungeX = (Math.random() - 0.5) * 3;
                this.lungeY = (Math.random() - 0.5) * 2;
            }

            // Fade out gradually
            if (this.stateTimer > 120) {
                this.deathAlpha = Math.max(0.3, this.deathAlpha - 0.005);
            }
        } else {
            this.deathRotation = 0;
            this.deathAlpha = 1;
            this.victoryBounce = 0;
        }
    }

    startAttack(target) {
        if (this.state !== 'idle') return;

        // Attacks cost stamina - heavier weapons cost more
        const attackCost = this.getAttackStaminaCost();
        if (!this.spendStamina(attackCost)) {
            return; // Too tired to attack
        }

        this.attackTarget = target;
        this.setState('windup');
        this.facingRight = target.x > this.x;
    }

    getAttackStaminaCost() {
        // Different weapons have different stamina costs
        switch (this.genome.weapon) {
            case 'mandibles': return 15;  // Heavy crushing attacks
            case 'horns': return 18;      // Charging attacks
            case 'stinger': return 10;    // Precise thrusts
            case 'claws': return 8;       // Quick slashes
            case 'fangs': return 10;      // Biting attacks
            default: return 10;
        }
    }

    getWeaponBehavior(dx, dy, dist) {
        const weapon = this.genome.weapon;
        const fury = this.genome.fury;
        const dirX = dx / dist;
        const dirY = dy / dist;

        switch (weapon) {
            case 'mandibles':
                // Crushing grip - strong lunge forward, wide stance
                return {
                    lungeX: dirX * (30 + fury / 8),
                    lungeY: dirY * 15,
                    momentumX: dirX * 8,
                    momentumY: 0,
                    squash: 1.2, // Wide grip stance
                    stretch: 0.8,
                    particles: 'dust',
                    particleCount: 3
                };

            case 'claws':
                // Quick slashing - fast, multi-directional
                return {
                    lungeX: dirX * (20 + fury / 12),
                    lungeY: dirY * 20 + (Math.random() - 0.5) * 10, // Varied slash angle
                    momentumX: dirX * 4,
                    momentumY: (Math.random() - 0.5) * 3,
                    squash: 0.6, // Coiled for slash
                    stretch: 1.4,
                    particles: 'spark',
                    particleCount: 4
                };

            case 'stinger':
                // Precise thrust - straight line attack
                return {
                    lungeX: dirX * (35 + fury / 6),
                    lungeY: dirY * 25,
                    momentumX: dirX * 6,
                    momentumY: dirY * 2,
                    squash: 0.5, // Extended thrust
                    stretch: 1.6,
                    particles: null // Silent deadly strike
                };

            case 'fangs':
                // Venomous bite - quick lunge then clamp
                return {
                    lungeX: dirX * (28 + fury / 10),
                    lungeY: dirY * 18,
                    momentumX: dirX * 5,
                    momentumY: -2, // Slight upward for bite angle
                    squash: 0.65,
                    stretch: 1.35,
                    particles: 'poison',
                    particleCount: 3
                };

            case 'horns':
                // Charging ram - heavy forward momentum
                return {
                    lungeX: dirX * (40 + fury / 5),
                    lungeY: dirY * 10,
                    momentumX: dirX * 12, // Heavy charge momentum
                    momentumY: -3, // Slight lift from impact
                    squash: 0.9,
                    stretch: 1.15,
                    particles: 'dust',
                    particleCount: 8
                };

            default:
                // Generic attack
                return {
                    lungeX: dirX * (25 + fury / 10),
                    lungeY: dirY * 15,
                    momentumX: dirX * 5,
                    momentumY: 0,
                    squash: 0.7,
                    stretch: 1.3,
                    particles: null
                };
        }
    }

    executeAttack() {
        if (!this.attackTarget || !this.isAlive) return;

        const target = this.attackTarget;
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.setState('attack');

        // Weapon-specific attack animations and effects
        const weaponBehavior = this.getWeaponBehavior(dx, dy, dist);

        this.lungeX = weaponBehavior.lungeX;
        this.lungeY = weaponBehavior.lungeY;
        this.vx += weaponBehavior.momentumX;
        this.vy += weaponBehavior.momentumY || 0;
        this.squash = weaponBehavior.squash;
        this.stretch = weaponBehavior.stretch;

        // Spawn weapon-specific particles
        if (weaponBehavior.particles) {
            spawnParticles(this.x + dx * 0.3, this.y + dy * 0.3, weaponBehavior.particles, weaponBehavior.particleCount || 5);
        }

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
                addCommentary(getRandomPhrase('heightAdvantage'), '#8af');
            }
            if (backstab) {
                damage = Math.floor(damage * 1.3);
                addCommentary(getRandomPhrase('backstab'), '#f8a');
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
                addCommentary(getRandomPhrase('criticalHit'), '#ff0');
            }

            damage = Math.max(1, damage);

            // Multistrike for claws
            let strikes = 1;
            if (this.genome.weapon === 'claws' && rollDice(4) === 4) {
                strikes = 2;
                addCommentary(getRandomPhrase('doubleslash'), '#ff0');
            }

            setTimeout(() => {
                for (let i = 0; i < strikes; i++) {
                    this.applyHit(target, damage, isCrit);
                }
            }, 50);
        } else {
            // Track miss and dodge stats
            this.stats.hitsMissed++;
            target.stats.dodges++;

            spawnParticles(this.x + dx * 0.7, this.y + dy * 0.7, 'dust', 5);
            addCommentary(getRandomPhrase('miss', { name: this.bug.name }), '#888');
        }

        this.attackTarget = null;
    }

    applyHit(target, damage, isCrit) {
        if (!target.isAlive) return;

        // Check invulnerability
        if (target.isInvulnerable()) {
            spawnParticles(target.x, target.y, 'spark', 5);
            addCommentary(`${target.bug.name} is invulnerable!`, '#8af');
            return;
        }

        // Track stats
        this.stats.hitsLanded++;
        this.stats.damageDealt += damage;
        target.stats.damageTaken += damage;
        if (isCrit) this.stats.criticalHits++;

        // Update combo
        this.addComboHit();

        // Update drives - attacker gains confidence, target responds based on fury
        this.onHitLanded(damage);
        target.onDamageTaken(damage);

        // Apply combo bonus damage
        let comboDamage = damage;
        if (this.comboCount >= 3) {
            const comboBonus = 1 + (this.comboCount - 2) * 0.1; // 10% more per hit after 3rd
            comboDamage = Math.floor(damage * comboBonus);
        }

        target.hp -= comboDamage;
        target.setState('hit');

        // Stun the target briefly
        target.stunTimer = isCrit ? 25 : 15;
        target.aiState = 'stunned';

        // Brief hit pause for impact feel
        hitPause = Math.max(hitPause, isCrit ? 6 : 3);
        screenShake.intensity = isCrit ? 5 : 2;

        target.flashTimer = 4;
        target.squash = 1.2;
        target.stretch = 0.8;

        // Physics-based knockback
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const massRatio = this.mass / target.mass;
        const baseKnockback = isCrit ? 10 : 6;
        const knockbackForce = baseKnockback * Math.sqrt(massRatio);

        target.vx += (dx / dist) * knockbackForce;
        target.vy += (dy / dist) * knockbackForce * 0.4 - 2;

        // Minimal particles - just enough to show contact
        spawnParticles(target.x, target.y, 'blood', isCrit ? 5 : 2);
        addBloodStain(target.x, target.y + 15);

        // Floating damage number
        spawnFloatingNumber(target.x, target.y, damage, isCrit ? '#ff0' : '#f80', isCrit);

        // Venom from fangs
        if (this.genome.weapon === 'fangs' && rollDice(3) === 3) {
            target.poisoned = 4;
            addCommentary(getRandomPhrase('poison', { name: target.bug.name }), '#0f0');
            spawnParticles(target.x, target.y, 'poison', 3);
        }

        // Toxic defense
        if (target.genome.defense === 'toxic') {
            const toxicDamage = Math.floor(target.genome.bulk / 25);
            if (toxicDamage > 0) {
                this.hp -= toxicDamage;
                this.flashTimer = 4;
                spawnFloatingNumber(this.x, this.y, toxicDamage, '#0f0', false);
                addCommentary(getRandomPhrase('toxic', { name: this.bug.name, dmg: toxicDamage }), '#0f0');
            }
        }

        // Use weapon-specific commentary sometimes, generic damage otherwise
        if (Math.random() < 0.4) {
            const weaponPhrase = getWeaponPhrase(this.genome.weapon, this.bug.name);
            if (weaponPhrase) {
                addCommentary(weaponPhrase, isCrit ? '#ff0' : '#f80');
            } else {
                addCommentary(getRandomPhrase('damage', { name: this.bug.name, dmg: damage }), isCrit ? '#ff0' : '#f80');
            }
        } else {
            addCommentary(getRandomPhrase('damage', { name: this.bug.name, dmg: damage }), isCrit ? '#ff0' : '#f80');
        }

        if (target.hp <= 0) {
            target.hp = 0;
            target.setState('death');
            hitPause = 8;
            addCommentary(getRandomPhrase('defeat', { name: target.bug.name }), '#f00');
            spawnParticles(target.x, target.y, 'blood', 3);
        }
    }

    // Charge ability over time during combat
    chargeAbility() {
        if (this.abilityCooldown > 0) {
            this.abilityCooldown--;
            return;
        }
        if (this.abilityActive) return;
        if (this.abilityCharge >= this.abilityMaxCharge) return;

        // Charge rate based on fury stat and ability-specific rate
        const chargeAmount = (0.3 + this.genome.fury / 200) * this.specialAbility.chargeRate;
        this.abilityCharge = Math.min(this.abilityMaxCharge, this.abilityCharge + chargeAmount);
    }

    canUseAbility() {
        return this.abilityCharge >= this.abilityMaxCharge &&
               !this.abilityActive &&
               this.abilityCooldown <= 0 &&
               this.state === 'idle';
    }

    activateAbility(target) {
        if (!this.canUseAbility()) return false;

        // Special abilities cost significant stamina
        const abilityCost = 25;
        if (!this.spendStamina(abilityCost)) {
            return false; // Too tired for special ability
        }

        this.abilityActive = true;
        this.abilityTimer = 0;
        this.abilityCharge = 0;
        this.abilityCooldown = 180; // 3 seconds cooldown
        this.stats.specialsUsed++;

        // Subtle feedback
        screenShake.intensity = 3;
        hitPause = 4;

        addCommentary(`${this.bug.name} uses ${this.specialAbility.name}!`, '#f0f');

        this.executeAbility(target);
        return true;
    }

    executeAbility(target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        switch (this.specialAbility.type) {
            case 'deathGrip':
                // Massive damage single hit
                this.setState('attack');
                this.lungeX = (dx / dist) * 50;
                this.squash = 1.4;
                this.stretch = 0.6;
                setTimeout(() => {
                    const damage = Math.floor((this.genome.bulk + this.genome.fury) / 4);
                    this.applyHit(target, damage, true);
                    spawnParticles(target.x, target.y, 'impact', 4);
                }, 100);
                break;

            case 'venomStrike':
                // Poison attack + AoE damage
                this.setState('attack');
                this.lungeX = (dx / dist) * 40;
                setTimeout(() => {
                    target.poisoned = 8;
                    const damage = Math.floor(this.genome.fury / 3);
                    this.applyHit(target, damage, false);
                    spawnParticles(target.x, target.y, 'poison', 6);
                    addCommentary(`${target.bug.name} is badly poisoned!`, '#0f0');
                }, 80);
                break;

            case 'bladeFury':
                // Rapid multi-hit attack
                this.setState('attack');
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => {
                        if (!target.isAlive) return;
                        const damage = Math.floor((this.genome.fury / 15) + 2);
                        this.applyHit(target, damage, Math.random() < 0.3);
                        this.lungeX = ((dx / dist) * 20) * (i % 2 === 0 ? 1 : -0.5);
                        spawnParticles(target.x + (Math.random()-0.5)*20, target.y, 'spark', 3);
                    }, i * 80);
                }
                break;

            case 'drainBite':
                // Damage + heal
                this.setState('attack');
                this.lungeX = (dx / dist) * 35;
                setTimeout(() => {
                    const damage = Math.floor((this.genome.bulk + this.genome.fury) / 6);
                    this.applyHit(target, damage, false);
                    const heal = Math.floor(damage * 0.6);
                    this.hp = Math.min(this.maxHp, this.hp + heal);
                    spawnFloatingNumber(this.x, this.y - 20, '+' + heal, '#0f0', false);
                    spawnParticles(this.x, this.y, 'poison', 2);
                    addCommentary(`${this.bug.name} drains ${heal} HP!`, '#0f0');
                }, 100);
                break;

            case 'chargeRam':
                // Huge knockback + damage
                this.vx = (dx / dist) * 25;
                this.vy = -5;
                this.setState('attack');
                setTimeout(() => {
                    const damage = Math.floor((this.genome.bulk * 1.5) / 5);
                    target.vx += (dx / dist) * 30;
                    target.vy -= 8;
                    this.applyHit(target, damage, true);
                    spawnParticles(target.x, target.y, 'dust', 5);
                    screenShake.intensity = 8;
                }, 150);
                break;

            case 'fortify':
                // Temporary invulnerability
                this.abilityTimer = 120; // 2 seconds of invuln
                this.squash = 1.3;
                this.stretch = 0.7;
                spawnParticles(this.x, this.y, 'spark', 5);
                addCommentary(`${this.bug.name} becomes invulnerable!`, '#8af');
                break;

            case 'toxicCloud':
                // AoE poison cloud
                for (let i = 0; i < 8; i++) {
                    setTimeout(() => {
                        spawnParticles(this.x + (Math.random()-0.5)*80, this.y + (Math.random()-0.5)*60, 'poison', 1);
                    }, i * 40);
                }
                setTimeout(() => {
                    if (dist < 100) {
                        target.poisoned = 6;
                        const damage = Math.floor(this.genome.bulk / 5);
                        this.applyHit(target, damage, false);
                    }
                }, 200);
                break;

            case 'ambush':
                // Vanish and guaranteed crit
                this.abilityTimer = 60;
                addCommentary(`${this.bug.name} vanishes!`, '#888');
                setTimeout(() => {
                    this.x = target.x + (this.side === 'left' ? -40 : 40);
                    this.y = target.y;
                    this.setState('attack');
                    this.lungeX = (target.x - this.x) * 0.8;
                    const damage = Math.floor((this.genome.fury + this.genome.instinct) / 4);
                    this.applyHit(target, damage, true);
                    spawnParticles(target.x, target.y, 'impact', 4);
                    addCommentary(`Ambush strike!`, '#f0f');
                }, 500);
                break;

            case 'spinAttack':
                // Spinning spike damage
                this.abilityTimer = 90;
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (!target.isAlive) return;
                        this.squash = 0.8;
                        this.stretch = 0.8;
                        if (dist < 80) {
                            const damage = Math.floor(this.genome.bulk / 8) + 3;
                            this.applyHit(target, damage, false);
                        }
                        spawnParticles(this.x, this.y, 'spark', 2);
                    }, i * 150);
                }
                break;

            case 'diveBomb':
                // Aerial dive
                this.y = ARENA.ceilingY + 50;
                this.x = target.x;
                this.vy = 20;
                setTimeout(() => {
                    const damage = Math.floor((this.genome.speed + this.genome.fury) / 5);
                    if (Math.abs(this.x - target.x) < 40 && Math.abs(this.y - target.y) < 60) {
                        this.applyHit(target, damage, true);
                        target.vy += 10;
                    }
                    spawnParticles(this.x, this.y, 'dust', 4);
                    spawnParticles(this.x, this.y, 'impact', 3);
                }, 300);
                break;

            case 'pounce':
                // Wall pounce attack
                const pounceDir = this.wallSide === 'left' ? 1 : -1;
                this.vx = pounceDir * 20;
                this.vy = -10;
                this.onWall = false;
                setTimeout(() => {
                    if (Math.abs(this.x - target.x) < 60 && Math.abs(this.y - target.y) < 40) {
                        const damage = Math.floor((this.genome.speed + this.genome.bulk) / 5);
                        this.applyHit(target, damage, true);
                        target.vx += pounceDir * 15;
                    }
                    spawnParticles(this.x, this.y, 'dust', 3);
                }, 200);
                break;

            case 'berserk':
                // Rage mode - temp damage boost
                this.abilityTimer = 180;
                this.genome.fury += 30; // Temporary boost
                setTimeout(() => { this.genome.fury -= 30; }, 3000);
                spawnParticles(this.x, this.y, 'spark', 4);
                addCommentary(`${this.bug.name} goes BERSERK!`, '#f00');
                break;
        }

        setTimeout(() => { this.abilityActive = false; }, 500);
    }

    isInvulnerable() {
        return this.abilityActive &&
               (this.specialAbility.type === 'fortify' || this.specialAbility.type === 'ambush') &&
               this.abilityTimer > 0;
    }

    updateAbility() {
        if (this.abilityTimer > 0) this.abilityTimer--;
        this.chargeAbility();
    }

    // Update combo system
    updateCombo() {
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
            }
        }
    }

    addComboHit() {
        this.comboCount++;
        this.comboTimer = 90; // 1.5 seconds to continue combo

        if (this.comboCount >= 3) {
            addCommentary(`${this.comboCount}-HIT COMBO!`, '#ff0');
        }
    }

    // Drive system: shift drives based on combat outcomes
    onHitLanded(damage) {
        // Landing hits rewards aggression - what's working continues
        this.drives.recentHits++;
        this.drives.aggression = Math.min(1, this.drives.aggression + this.drives.adaptRate * 2);
        this.drives.caution = Math.max(0, this.drives.caution - this.drives.adaptRate);
    }

    onDamageTaken(damage) {
        // Taking damage - response depends on fury (genome)
        // High fury bugs get MORE aggressive when hurt
        // Low fury bugs get MORE cautious when hurt
        this.drives.recentDamage += damage;
        const furyNorm = this.genome.fury / 100;

        if (furyNorm > 0.5) {
            // Fury response: fight back harder
            this.drives.aggression = Math.min(1, this.drives.aggression + this.drives.adaptRate * furyNorm * 3);
        } else {
            // Cautious response: back off
            this.drives.caution = Math.min(1, this.drives.caution + this.drives.adaptRate * (1 - furyNorm) * 3);
            this.drives.aggression = Math.max(0, this.drives.aggression - this.drives.adaptRate);
        }
    }

    // Called each combat tick to decay recent counters and drift drives toward baseline
    updateDrives() {
        // Slowly decay recent hit/damage counters
        this.drives.recentHits *= 0.99;
        this.drives.recentDamage *= 0.99;

        // Drives slowly drift back toward genome-based baseline
        const furyNorm = this.genome.fury / 100;
        const baseAggression = 0.3 + furyNorm * 0.4;
        const baseCaution = 0.3 + (1 - furyNorm) * 0.4;

        this.drives.aggression += (baseAggression - this.drives.aggression) * 0.001;
        this.drives.caution += (baseCaution - this.drives.caution) * 0.001;

        // Stamina affects drives - low stamina increases caution, decreases aggression
        const staminaPercent = this.stamina / this.maxStamina;
        if (staminaPercent < 0.3) {
            // Exhausted - forced caution
            const exhaustionFactor = (0.3 - staminaPercent) * 2;  // 0-0.6
            this.drives.caution = Math.min(1, this.drives.caution + exhaustionFactor * 0.02);
            this.drives.aggression = Math.max(0, this.drives.aggression - exhaustionFactor * 0.02);
        }

        // Regenerate stamina (faster when not in aggressive state)
        const regenMultiplier = this.aiState === 'circling' || this.aiState === 'retreating' ? 1.5 : 1.0;
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * regenMultiplier);
    }

    // Spend stamina for an action - returns true if had enough
    spendStamina(amount) {
        if (this.stamina >= amount) {
            this.stamina -= amount;
            return true;
        }
        return false;
    }

    // Check if has enough stamina for an action
    hasStamina(amount) {
        return this.stamina >= amount;
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
        const wasAirborne = !this.grounded && !this.onWall;
        if (this.y >= floorLevel) {
            this.y = floorLevel;
            if (this.isFlying) {
                // Flyers bounce off floor
                if (Math.abs(this.vy) > 3) {
                    spawnParticles(this.x, this.y + bounds.bottom, 'landing', 2);
                }
                this.vy = -Math.abs(this.vy) * bounceFactor;
            } else {
                // Landing dust for ground bugs
                if (wasAirborne && Math.abs(this.vy) > 2) {
                    spawnParticles(this.x, this.y + bounds.bottom, 'landing', 3);
                }
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

        // Jumps cost stamina proportional to power
        const jumpStaminaCost = Math.floor(5 * power);
        if (!this.spendStamina(jumpStaminaCost)) {
            return false; // Too tired to jump
        }

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

    // Calculate tactical positioning adjustments based on instinct
    getTacticalPositioning(opponent, dx, dy, dist) {
        const instinctFactor = this.genome.instinct / 100;
        let adjustX = 0;
        let adjustY = 0;

        // Low instinct bugs don't think tactically
        if (instinctFactor < 0.3) return { adjustX: 0, adjustY: 0 };

        // Arena awareness
        const arenaCenter = ARENA.width / 2;
        const distFromCenter = this.x - arenaCenter;
        const opponentDistFromCenter = opponent.x - arenaCenter;

        // 1. Cut off opponent's escape - get between them and arena center
        if (Math.abs(opponentDistFromCenter) > Math.abs(distFromCenter)) {
            // Opponent is closer to a wall - try to trap them
            const cutoffDir = Math.sign(opponentDistFromCenter);
            adjustX -= cutoffDir * instinctFactor * 0.3;
        }

        // 2. Avoid being trapped against walls ourselves
        if (Math.abs(distFromCenter) > ARENA.width * 0.35) {
            // We're near a wall - try to move toward center
            adjustX -= Math.sign(distFromCenter) * instinctFactor * 0.4;
        }

        // 3. Height advantage for ground bugs - prefer higher ground when possible
        if (!this.isFlying && !this.onWall && opponent.y < this.y - 20) {
            // Opponent has height - try to get on equal footing
            if (this.grounded && Math.random() < instinctFactor * 0.03) {
                adjustY = -1;  // Trigger jump consideration
            }
        }

        // 4. Flank when circling - don't approach head-on
        if (this.aiState === 'circling' && dist < 150) {
            const flankDir = this.side === 'left' ? 1 : -1;
            adjustX += flankDir * instinctFactor * 0.5;
        }

        // 5. Control space - maintain optimal attack range
        const weaponRange = this.getWeaponRange();
        const optimalDist = weaponRange * 0.8;
        if (dist < optimalDist * 0.6 && this.drives.caution > 0.4) {
            // Too close - back off slightly for better positioning
            adjustX -= Math.sign(dx) * instinctFactor * 0.3;
        }

        return { adjustX, adjustY };
    }

    getWeaponRange() {
        switch (this.genome.weapon) {
            case 'horns': return 45;
            case 'stinger': return 40;
            case 'mandibles': return 25;
            case 'claws': return 35;
            case 'fangs': return 30;
            default: return 30;
        }
    }

    updateAIStateTransitions(opponent, dist, attackRange) {
        const hpPercent = this.hp / this.maxHp;
        const { aggression, caution } = this.drives;

        // Drives determine behavior probabilities per tick
        // High caution + low HP = retreat (flyers/wallcrawlers only)
        if (hpPercent < 0.4 && caution > 0.5 && (this.isFlying || this.isWallcrawler) && Math.random() < caution * 0.08) {
            this.aiState = 'retreating';
            this.aiStateTimer = 0;
        }
        // High aggression = push forward, especially when close
        else if (dist < attackRange * 1.5 && Math.random() < aggression * 0.12) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
        // High caution = circle and probe for openings
        else if (dist < attackRange * 2 && this.aiStateTimer > 40 && Math.random() < caution * 0.06) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
            this.circleAngle = Math.atan2(this.y - opponent.y, this.x - opponent.x);
        }
        // Far away - aggression determines how fast we close distance
        else if (dist > attackRange * 2 && this.aiStateTimer > Math.floor(60 - aggression * 40)) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeAggressiveAI(opponent, dx, dy, dist, attackRange) {
        // Aggression drive amplifies approach speed
        const baseSpeed = 0.3 + (this.genome.speed / 150);
        // Stamina affects movement - exhausted bugs are slower
        const staminaPercent = this.stamina / this.maxStamina;
        const staminaFactor = 0.5 + staminaPercent * 0.5;  // 0.5-1.0
        const speed = baseSpeed * (0.7 + this.drives.aggression * 0.6) * staminaFactor;

        if (this.isFlying) {
            // Flyers use height advantage tactically
            const heightAdvantage = this.y < opponent.y - 30;
            const staminaPercent = this.stamina / this.maxStamina;

            if (heightAdvantage && dist < attackRange * 1.5) {
                // DIVE ATTACK from above
                this.vx += Math.sign(dx) * speed * 2;
                this.vy += 0.8;  // Dive down
            } else if (staminaPercent < 0.3) {
                // Low stamina - gain altitude to recover
                this.vx += Math.sign(dx) * speed * 0.5;
                this.vy -= 0.4;
            } else if (opponent.isFlying) {
                // Air-to-air - try to get above them
                this.vx += Math.sign(dx) * speed;
                this.vy += this.y > opponent.y ? -0.5 : 0.3;
            } else {
                // Opponent on ground - maintain height, swoop in
                const idealHeight = opponent.y - 80;
                if (this.y > idealHeight) {
                    this.vy -= 0.4;  // Gain altitude
                } else {
                    this.vy += 0.2;  // Descend to attack
                }
                this.vx += Math.sign(dx) * speed * 1.2;
            }

            // Bobbing motion (reduced when diving)
            if (!heightAdvantage || dist > attackRange * 2) {
                this.vy += Math.sin(this.moveTimer / 8) * 0.2;
            }
        } else if (this.onWall) {
            // Wall climbing - move toward opponent's height
            this.vy = Math.sign(dy) * speed * 3;

            // Jump off wall to attack - aggression increases willingness
            const horizDist = Math.abs(dx);
            if (horizDist < 150 && Math.abs(dy) < 50 && Math.random() < 0.03 + this.drives.aggression * 0.05) {
                this.jump(1.0);
                this.vx = Math.sign(dx) * 8;
            }
        } else {
            // Ground movement - accelerate toward opponent
            this.vx += Math.sign(dx) * speed;

            // Apply tactical positioning for high-instinct bugs
            const tactical = this.getTacticalPositioning(opponent, dx, dy, dist);
            this.vx += tactical.adjustX;
            if (tactical.adjustY < 0 && this.grounded) {
                // Tactical suggests gaining height
                this.jump(0.6);
            }

            // Jump to reach flying opponents - aggression affects willingness
            if (opponent.isFlying || opponent.onWall || opponent.y < this.y - 50) {
                if (this.grounded && dist < attackRange * 2 && Math.random() < 0.04 + this.drives.aggression * 0.06) {
                    this.jump(1.0);
                    // Add horizontal velocity toward opponent
                    this.vx += Math.sign(dx) * 3;
                }
            }
        }
    }

    executeCirclingAI(opponent, dx, dy, dist) {
        const speed = 0.2 + (this.genome.speed / 200);
        // Cautious bugs circle wider, aggressive bugs stay closer
        const circleRadius = 60 + this.drives.caution * 60;

        this.circleAngle += (this.side === 'left' ? 0.04 : -0.04) * (this.genome.speed / 50);

        if (this.isFlying) {
            // Flyers circle ABOVE opponent for tactical advantage
            const targetX = opponent.x + Math.cos(this.circleAngle) * circleRadius;
            const targetY = opponent.y - 60 + Math.sin(this.circleAngle) * circleRadius * 0.4;  // Stay above
            this.vx += (targetX - this.x) * 0.025;
            this.vy += (targetY - this.y) * 0.025;

            // Maintain minimum height above ground opponents
            if (!opponent.isFlying && this.y > opponent.y - 40) {
                this.vy -= 0.3;
            }
        } else if (this.isWallcrawler && this.onWall) {
            // Wallcrawlers on wall - move vertically to match opponent
            const targetY = opponent.y;
            this.vy = Math.sign(targetY - this.y) * speed * 2;
        } else {
            // Ground bugs strafe side to side
            this.vx += Math.cos(this.circleAngle) * speed * 2;

            // Apply tactical positioning while circling
            const tactical = this.getTacticalPositioning(opponent, opponent.x - this.x, opponent.y - this.y, dist);
            this.vx += tactical.adjustX * 0.5;  // Reduced influence during circling

            // Occasionally jump while circling
            if (this.grounded && Math.random() < 0.02) {
                this.jump(0.5);
            }
        }

        // High aggression breaks out of circling to attack
        // Low aggression stays cautious longer
        const breakoutTime = Math.floor(120 - this.drives.aggression * 80);
        if (this.aiStateTimer > breakoutTime) {
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
            // Fly away and UP - gain altitude for safety
            this.vx -= Math.sign(dx) * speed * 1.5;
            this.vy -= 0.5;  // Strong upward retreat
            // Don't go too high
            if (this.y < ARENA.ceilingY + 80) {
                this.vy += 0.3;
            }
        } else if (this.isWallcrawler) {
            if (this.onWall) {
                // Already on wall - climb UP for safety
                this.vy = -speed * 4;
            } else {
                // Sprint to nearest wall
                const nearestWall = this.x < ARENA.width / 2 ? 'left' : 'right';
                this.vx += nearestWall === 'left' ? -speed * 3 : speed * 3;
            }
        } else {
            // Ground bugs back away and jump
            this.vx -= Math.sign(dx) * speed;
            if (this.grounded && Math.random() < 0.05) {
                this.jump(0.6);
                this.vx -= Math.sign(dx) * 3;
            }
        }

        // High caution = retreat longer, high aggression = return to fight sooner
        const retreatDuration = Math.floor(40 + this.drives.caution * 60 - this.drives.aggression * 30);
        if (this.aiStateTimer > retreatDuration || dist > 300) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
        }
    }

    // ==================== WALL CLIMBING ====================

    updateWallClimbing(opponent, dist) {
        const bounds = this.getScaledBounds();
        const staminaPercent = this.stamina / this.maxStamina;

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

            // Strategic wall behavior based on state
            if (this.aiState === 'aggressive') {
                // Position for pounce attack - match opponent's height
                const targetY = opponent.y;
                if (Math.abs(this.y - targetY) > 30) {
                    this.vy = Math.sign(targetY - this.y) * 3;
                }
            } else if (this.aiState === 'retreating') {
                // Climb UP for safety
                this.vy = -3;
            } else {
                // Circling - move unpredictably
                this.vy = Math.sin(this.moveTimer / 20) * 2;
            }

            // Decide when to drop/pounce
            const horizDist = Math.abs(opponent.x - this.x);
            const vertDist = Math.abs(opponent.y - this.y);

            // Pounce attack when aligned and aggressive
            if (horizDist < 180 && vertDist < 60 && this.drives.aggression > 0.4) {
                if (Math.random() < 0.05 + this.drives.aggression * 0.08) {
                    // POUNCE!
                    this.onWall = false;
                    this.grounded = false;
                    const pounceDir = this.wallSide === 'left' ? 1 : -1;
                    this.vx = pounceDir * (10 + this.genome.speed / 10);
                    this.vy = -4;
                }
            }

            // Drop off if too far from opponent or low stamina recovered
            if (dist > 400 || (staminaPercent > 0.7 && this.aiState === 'retreating')) {
                this.onWall = false;
                this.grounded = false;
            }
        } else {
            // Not on wall - should we climb?
            const nearLeftWall = this.x < ARENA.leftWall + 80;
            const nearRightWall = this.x > ARENA.rightWall - 80;

            if ((nearLeftWall || nearRightWall) && this.grounded) {
                // Reasons to climb:
                // 1. Low stamina - recover on wall
                // 2. Opponent is flying/above us
                // 3. High caution - use wall for safety
                // 4. Tactical positioning
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

            // Actively seek wall when retreating or exhausted
            if ((this.aiState === 'retreating' || staminaPercent < 0.3) && !this.onWall) {
                const nearestWall = this.x < ARENA.width / 2 ? 'left' : 'right';
                const wallX = nearestWall === 'left' ? ARENA.leftWall : ARENA.rightWall;
                const distToWall = Math.abs(this.x - wallX);

                // Move toward wall
                if (distToWall > 50) {
                    this.vx += nearestWall === 'left' ? -0.5 : 0.5;
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
        let scale = baseScale * sizeRatio;

        // Apply intro animation scaling
        if (this.introState !== 'ready') {
            scale *= this.introScale;
        }

        // Apply intro offset to render position
        const renderX = this.x + this.lungeX + this.introOffsetX;
        // Victory bounce affects Y position
        const renderY = this.y + this.lungeY - this.victoryBounce;

        const scaleX = scale * this.squash;
        const scaleY = scale * this.stretch;
        const sizeX = this.spriteSize * scaleX;
        const sizeY = this.spriteSize * scaleY;

        const startX = renderX - sizeX / 2;
        const startY = renderY - sizeY / 2;

        ctx.save();

        // Death fade
        if (this.state === 'death') {
            ctx.globalAlpha = this.deathAlpha;
        } else if (this.flashTimer > 0) {
            ctx.globalAlpha = 0.5 + (this.flashTimer / 16);
        } else if (this.genome.defense === 'camouflage') {
            // Camouflage bugs are semi-transparent
            ctx.globalAlpha = 0.6;
        }

        // Calculate rotation
        let rotation = 0;

        // Death rotation (falling over)
        if (this.state === 'death') {
            rotation = this.deathRotation;
        }
        // Wallcrawlers on walls: full 90° rotation, feet on wall, head pointing up
        else if (this.isWallcrawler && this.onWall) {
            if (this.wallSide === 'left') {
                rotation = Math.PI / 2;
            } else {
                rotation = -Math.PI / 2;
            }
        }
        // Drive-based body language (not during death/wall states)
        else if (this.state !== 'death' && this.drives) {
            // Aggressive bugs lean forward, cautious bugs lean back
            const driveBalance = this.drives.aggression - this.drives.caution;
            const leanDir = this.facingRight ? 1 : -1;
            rotation = driveBalance * 0.15 * leanDir;  // Max ~8.5 degrees lean

            // Low stamina = droopy posture
            const staminaPct = this.stamina / this.maxStamina;
            if (staminaPct < 0.3) {
                rotation += (0.3 - staminaPct) * 0.3;  // Droop forward when exhausted
            }
        }

        // Apply rotation around bug center
        if (rotation !== 0) {
            ctx.translate(renderX, renderY);
            ctx.rotate(rotation);
            ctx.translate(-renderX, -renderY);
        }

        // Calculate drive-based color tint
        let driveTint = null;
        if (this.drives && this.state !== 'death') {
            const aggression = this.drives.aggression;
            const caution = this.drives.caution;
            // Strong aggression = red tint, strong caution = blue tint
            if (aggression > 0.7) {
                const intensity = (aggression - 0.7) / 0.3;  // 0-1
                driveTint = { r: Math.floor(60 * intensity), g: 0, b: 0 };
            } else if (caution > 0.7) {
                const intensity = (caution - 0.7) / 0.3;  // 0-1
                driveTint = { r: 0, g: 0, b: Math.floor(60 * intensity) };
            }
        }

        // Draw each pixel
        for (let py = 0; py < this.spriteSize; py++) {
            for (let px = 0; px < this.spriteSize; px++) {
                const colorIdx = parseInt(frame[py][this.facingRight ? px : this.spriteSize - 1 - px]);
                if (colorIdx === 0) continue;

                let pixelColor = colors[colorIdx];

                // Apply flash effect
                if (this.flashTimer > 0 && this.flashTimer % 2 === 0) {
                    pixelColor = '#fff';
                }
                // Apply drive tint
                else if (driveTint) {
                    // Parse the color and add tint
                    const hex = pixelColor.replace('#', '');
                    let r = parseInt(hex.substr(0, 2), 16) || parseInt(hex[0], 16) * 17;
                    let g = parseInt(hex.substr(2, 2), 16) || parseInt(hex[1], 16) * 17;
                    let b = parseInt(hex.substr(4, 2), 16) || parseInt(hex[2], 16) * 17;
                    r = Math.min(255, r + driveTint.r);
                    g = Math.min(255, g + driveTint.g);
                    b = Math.min(255, b + driveTint.b);
                    pixelColor = `rgb(${r},${g},${b})`;
                }

                ctx.fillStyle = pixelColor;
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

            // AI state indicator (small text below health bar)
            if (this.aiState && this.state !== 'death') {
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';

                let stateText = '';
                let stateColor = '#888';

                switch (this.aiState) {
                    case 'aggressive':
                        stateText = '→';  // Arrow toward
                        stateColor = '#f66';
                        break;
                    case 'circling':
                        stateText = '◯';  // Circle
                        stateColor = '#ff0';
                        break;
                    case 'retreating':
                        stateText = '←';  // Arrow away
                        stateColor = '#6af';
                        break;
                    case 'stunned':
                        stateText = '✕';  // Stunned
                        stateColor = '#f00';
                        break;
                }

                // Flip arrow direction based on facing
                if (stateText === '→' && !this.facingRight) stateText = '←';
                else if (stateText === '←' && !this.facingRight) stateText = '→';

                ctx.fillStyle = stateColor;
                ctx.fillText(stateText, this.x, barY + barHeight + 10);
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
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.2;

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
            case 'landing':
                // Dust cloud when landing
                const angle = Math.random() * Math.PI;
                const speed = 2 + Math.random() * 3;
                this.vx = Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1);
                this.vy = -Math.random() * 1.5;
                this.color = ['#8a7a6a', '#9a8a7a', '#7a6a5a'][Math.floor(Math.random() * 3)];
                this.gravity = 0.08;
                this.decay = 0.03;
                this.size = 4 + Math.random() * 6;
                break;
            case 'impact':
                // Impact ring particle
                const impAngle = Math.random() * Math.PI * 2;
                const impSpeed = 5 + Math.random() * 8;
                this.vx = Math.cos(impAngle) * impSpeed;
                this.vy = Math.sin(impAngle) * impSpeed;
                this.color = '#fff';
                this.gravity = 0;
                this.decay = 0.08;
                this.size = 2 + Math.random() * 2;
                break;
            case 'trail':
                // Movement trail
                this.vx = (Math.random() - 0.5) * 1;
                this.vy = (Math.random() - 0.5) * 1;
                this.color = 'rgba(255,255,255,0.5)';
                this.gravity = 0;
                this.decay = 0.06;
                this.size = 2 + Math.random() * 2;
                break;
            case 'shockwave':
                // Expanding ring effect
                this.vx = 0;
                this.vy = 0;
                this.radius = 5;
                this.maxRadius = 40 + Math.random() * 20;
                this.color = '#fff';
                this.gravity = 0;
                this.decay = 0.05;
                break;
            case 'confetti':
                // Victory confetti
                this.vx = (Math.random() - 0.5) * 6;
                this.vy = -3 - Math.random() * 5;
                this.color = ['#ff0', '#f0f', '#0ff', '#0f0', '#f80'][Math.floor(Math.random() * 5)];
                this.gravity = 0.15;
                this.decay = 0.008;
                this.size = 4 + Math.random() * 4;
                break;

            // === VARIANT PARTICLE TYPES ===
            case 'sparkle':
                // Golden/shiny sparkles
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = -1 - Math.random() * 2;
                this.color = ['#ffd700', '#fff8dc', '#ffec8b', '#fff'][Math.floor(Math.random() * 4)];
                this.gravity = -0.02;
                this.decay = 0.03;
                this.size = 2 + Math.random() * 3;
                this.twinkle = Math.random() * Math.PI * 2;
                break;
            case 'flame':
                // Fire/infernal flames
                this.vx = (Math.random() - 0.5) * 3;
                this.vy = -2 - Math.random() * 3;
                this.color = ['#ff4500', '#ff6600', '#ff8c00', '#ffa500'][Math.floor(Math.random() * 4)];
                this.gravity = -0.1;
                this.decay = 0.04;
                this.size = 4 + Math.random() * 6;
                break;
            case 'ice':
                // Ice/glacial crystals
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = (Math.random() - 0.5) * 2;
                this.color = ['#87ceeb', '#b0e0e6', '#add8e6', '#e0ffff', '#fff'][Math.floor(Math.random() * 5)];
                this.gravity = 0.05;
                this.decay = 0.025;
                this.size = 2 + Math.random() * 4;
                this.crystal = true;
                break;
            case 'electric':
                // Electric/storm sparks
                this.vx = (Math.random() - 0.5) * 8;
                this.vy = (Math.random() - 0.5) * 8;
                this.color = ['#00ffff', '#00bfff', '#87ceeb', '#fff'][Math.floor(Math.random() * 4)];
                this.gravity = 0;
                this.decay = 0.08;
                this.size = 1 + Math.random() * 2;
                this.electric = true;
                break;
            case 'void':
                // Void/dark energy
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = -0.5 - Math.random();
                this.color = ['#4b0082', '#800080', '#9400d3', '#000'][Math.floor(Math.random() * 4)];
                this.gravity = -0.03;
                this.decay = 0.02;
                this.size = 3 + Math.random() * 5;
                break;
            case 'celestial':
                // Celestial light motes
                this.vx = (Math.random() - 0.5) * 1.5;
                this.vy = -1 - Math.random() * 1.5;
                this.color = ['#fff', '#fffacd', '#fafad2', '#ffffe0'][Math.floor(Math.random() * 4)];
                this.gravity = -0.05;
                this.decay = 0.015;
                this.size = 2 + Math.random() * 3;
                this.halo = true;
                break;
            case 'crystal':
                // Crystalline shards
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = (Math.random() - 0.5) * 2;
                this.color = ['#e6e6fa', '#dda0dd', '#ee82ee', '#da70d6'][Math.floor(Math.random() * 4)];
                this.gravity = 0.02;
                this.decay = 0.02;
                this.size = 3 + Math.random() * 4;
                this.facets = 3 + Math.floor(Math.random() * 3);
                break;
            case 'phantom':
                // Ghostly wisps
                this.vx = (Math.random() - 0.5) * 1;
                this.vy = -0.5 - Math.random() * 1.5;
                this.color = 'rgba(200,200,255,0.7)';
                this.gravity = -0.02;
                this.decay = 0.015;
                this.size = 5 + Math.random() * 8;
                this.wisp = true;
                break;
            case 'prismatic':
                // Rainbow prismatic
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = -1 - Math.random() * 2;
                this.hue = Math.random() * 360;
                this.color = `hsl(${this.hue}, 100%, 70%)`;
                this.gravity = -0.02;
                this.decay = 0.02;
                this.size = 2 + Math.random() * 3;
                this.rainbow = true;
                break;
            case 'toxicDrip':
                // Toxic variant drips
                this.vx = (Math.random() - 0.5) * 1;
                this.vy = 1 + Math.random() * 2;
                this.color = ['#00ff00', '#32cd32', '#7cfc00', '#adff2f'][Math.floor(Math.random() * 4)];
                this.gravity = 0.15;
                this.decay = 0.025;
                this.size = 2 + Math.random() * 3;
                break;
            case 'ancient':
                // Ancient runes/glyphs
                this.vx = (Math.random() - 0.5) * 1;
                this.vy = -0.5 - Math.random();
                this.color = ['#daa520', '#b8860b', '#cd853f', '#d2691e'][Math.floor(Math.random() * 4)];
                this.gravity = -0.01;
                this.decay = 0.012;
                this.size = 4 + Math.random() * 4;
                this.glyph = true;
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
        this.rotation += this.rotSpeed;

        // Shockwave expansion
        if (this.type === 'shockwave') {
            this.radius += 3;
            if (this.radius > this.maxRadius) this.life = 0;
        }
    }

    render(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);

        if (this.type === 'spark') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.vx * 2, this.y - this.vy * 2);
            ctx.stroke();
        } else if (this.type === 'shockwave') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3 * this.life;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'confetti') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size/2, -this.size/4, this.size, this.size/2);
            ctx.restore();
        } else if (this.type === 'landing' || this.type === 'dust') {
            // Soft circular dust
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, this.color);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'sparkle' && this.twinkle !== undefined) {
            // Twinkling star shape
            const twinkleMod = Math.sin(Date.now() * 0.01 + this.twinkle) * 0.5 + 0.5;
            ctx.globalAlpha *= twinkleMod;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x + this.size * 0.3, this.y);
            ctx.lineTo(this.x, this.y + this.size);
            ctx.lineTo(this.x - this.size * 0.3, this.y);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(this.x - this.size, this.y);
            ctx.lineTo(this.x, this.y + this.size * 0.3);
            ctx.lineTo(this.x + this.size, this.y);
            ctx.lineTo(this.x, this.y - this.size * 0.3);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'flame') {
            // Soft flame glow
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, this.color);
            grad.addColorStop(0.5, this.color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.size * 0.3, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'ice' && this.crystal) {
            // Crystal shard shape
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(0, -this.size);
            ctx.lineTo(this.size * 0.5, this.size * 0.5);
            ctx.lineTo(-this.size * 0.5, this.size * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } else if (this.type === 'electric' && this.electric) {
            // Lightning bolt
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            const segments = 3;
            let cx = this.x, cy = this.y;
            for (let i = 0; i < segments; i++) {
                cx += (Math.random() - 0.5) * 8;
                cy += (Math.random() - 0.5) * 8;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        } else if (this.type === 'void') {
            // Dark energy blob with glow
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 1.5);
            grad.addColorStop(0, this.color);
            grad.addColorStop(0.5, 'rgba(75, 0, 130, 0.5)');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'celestial' && this.halo) {
            // Halo ring with center light
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 1.2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'crystal' && this.facets) {
            // Faceted crystal
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            for (let i = 0; i < this.facets; i++) {
                const angle = (i / this.facets) * Math.PI * 2;
                const r = this.size * (i % 2 ? 0.5 : 1);
                if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } else if (this.type === 'phantom' && this.wisp) {
            // Ghostly wisp
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, 'rgba(200, 200, 255, 0.6)');
            grad.addColorStop(0.5, 'rgba(180, 180, 255, 0.3)');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.size, this.size * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'prismatic' && this.rainbow) {
            // Rainbow shifting color
            this.hue = (this.hue + 5) % 360;
            ctx.fillStyle = `hsl(${this.hue}, 100%, 70%)`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'ancient' && this.glyph) {
            // Ancient glyph/rune shape
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation * 0.5);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Simple rune pattern
            ctx.moveTo(-this.size * 0.5, -this.size);
            ctx.lineTo(0, this.size);
            ctx.lineTo(this.size * 0.5, -this.size);
            ctx.moveTo(-this.size * 0.3, 0);
            ctx.lineTo(this.size * 0.3, 0);
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        }
        ctx.globalAlpha = 1;
    }
}

// Ambient floating dust motes in the arena
let ambientParticles = [];

function initAmbientParticles() {
    ambientParticles = [];
    for (let i = 0; i < 20; i++) {
        ambientParticles.push({
            x: ARENA.leftWall + Math.random() * (ARENA.rightWall - ARENA.leftWall),
            y: ARENA.ceilingY + Math.random() * (ARENA.floorY - ARENA.ceilingY),
            size: 1 + Math.random() * 2,
            speed: 0.1 + Math.random() * 0.3,
            angle: Math.random() * Math.PI * 2,
            wobble: Math.random() * Math.PI * 2
        });
    }
}

function updateAmbientParticles() {
    ambientParticles.forEach(p => {
        p.wobble += 0.02;
        p.x += Math.sin(p.wobble) * 0.3;
        p.y += p.speed;

        // Reset at bottom
        if (p.y > ARENA.floorY) {
            p.y = ARENA.ceilingY;
            p.x = ARENA.leftWall + Math.random() * (ARENA.rightWall - ARENA.leftWall);
        }
    });
}

function renderAmbientParticles(ctx) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ambientParticles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Vignette effect for atmosphere
function renderVignette(ctx) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.max(canvas.width, canvas.height) * 0.7;

    const vignette = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderFightHUD(ctx) {
    const f1 = fighters[0];
    const f2 = fighters[1];
    const barWidth = 280;
    const barHeight = 20;
    const abilityBarHeight = 8;

    // === LEFT FIGHTER HUD ===
    const leftX = 30;
    const hudY = 70;

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(f1.bug.name.toUpperCase(), leftX, hudY);

    // Health bar background
    ctx.fillStyle = '#300';
    ctx.fillRect(leftX, hudY + 5, barWidth, barHeight);

    // Health bar fill with gradient
    const hp1Pct = Math.max(0, f1.hp / f1.maxHp);
    const hpGrad1 = ctx.createLinearGradient(leftX, 0, leftX + barWidth * hp1Pct, 0);
    if (hp1Pct > 0.5) {
        hpGrad1.addColorStop(0, '#0a0');
        hpGrad1.addColorStop(1, '#0f0');
    } else if (hp1Pct > 0.25) {
        hpGrad1.addColorStop(0, '#a80');
        hpGrad1.addColorStop(1, '#ff0');
    } else {
        hpGrad1.addColorStop(0, '#a00');
        hpGrad1.addColorStop(1, '#f00');
    }
    ctx.fillStyle = hpGrad1;
    ctx.fillRect(leftX, hudY + 5, barWidth * hp1Pct, barHeight);

    // Health bar segments
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(leftX + (barWidth / 10) * i, hudY + 5);
        ctx.lineTo(leftX + (barWidth / 10) * i, hudY + 5 + barHeight);
        ctx.stroke();
    }

    // Health bar border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX, hudY + 5, barWidth, barHeight);

    // HP text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(0, f1.hp)} / ${f1.maxHp}`, leftX + barWidth / 2, hudY + 20);

    // Stamina bar
    const staminaY1 = hudY + 26;
    const staminaBarHeight = 4;
    ctx.fillStyle = '#220';
    ctx.fillRect(leftX, staminaY1, barWidth, staminaBarHeight);
    const stam1Pct = Math.max(0, f1.stamina / f1.maxStamina);
    const stamColor1 = stam1Pct > 0.3 ? '#fc0' : '#f60';
    ctx.fillStyle = stamColor1;
    ctx.fillRect(leftX, staminaY1, barWidth * stam1Pct, staminaBarHeight);

    // Ability charge bar
    const abilityY1 = hudY + 34;
    ctx.fillStyle = '#224';
    ctx.fillRect(leftX, abilityY1, barWidth, abilityBarHeight);

    const charge1Pct = f1.abilityCharge / f1.abilityMaxCharge;
    const abilityGrad1 = ctx.createLinearGradient(leftX, 0, leftX + barWidth, 0);
    abilityGrad1.addColorStop(0, '#60f');
    abilityGrad1.addColorStop(1, '#f0f');
    ctx.fillStyle = abilityGrad1;
    ctx.fillRect(leftX, abilityY1, barWidth * charge1Pct, abilityBarHeight);

    // Ability ready glow
    if (f1.abilityCharge >= f1.abilityMaxCharge) {
        ctx.strokeStyle = '#f0f';
        ctx.lineWidth = 2;
        ctx.strokeRect(leftX - 1, abilityY1 - 1, barWidth + 2, abilityBarHeight + 2);
        ctx.fillStyle = '#f0f';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(f1.specialAbility.name.toUpperCase() + ' READY!', leftX, abilityY1 + 18);
    } else {
        ctx.fillStyle = '#88a';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(f1.specialAbility.name, leftX, abilityY1 + 18);
    }

    // === RIGHT FIGHTER HUD ===
    const rightX = canvas.width - 30 - barWidth;

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(f2.bug.name.toUpperCase(), rightX + barWidth, hudY);

    // Health bar background
    ctx.fillStyle = '#300';
    ctx.fillRect(rightX, hudY + 5, barWidth, barHeight);

    // Health bar fill with gradient (right to left)
    const hp2Pct = Math.max(0, f2.hp / f2.maxHp);
    const hpGrad2 = ctx.createLinearGradient(rightX + barWidth, 0, rightX + barWidth * (1 - hp2Pct), 0);
    if (hp2Pct > 0.5) {
        hpGrad2.addColorStop(0, '#0a0');
        hpGrad2.addColorStop(1, '#0f0');
    } else if (hp2Pct > 0.25) {
        hpGrad2.addColorStop(0, '#a80');
        hpGrad2.addColorStop(1, '#ff0');
    } else {
        hpGrad2.addColorStop(0, '#a00');
        hpGrad2.addColorStop(1, '#f00');
    }
    ctx.fillStyle = hpGrad2;
    ctx.fillRect(rightX + barWidth * (1 - hp2Pct), hudY + 5, barWidth * hp2Pct, barHeight);

    // Health bar segments
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(rightX + (barWidth / 10) * i, hudY + 5);
        ctx.lineTo(rightX + (barWidth / 10) * i, hudY + 5 + barHeight);
        ctx.stroke();
    }

    // Health bar border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(rightX, hudY + 5, barWidth, barHeight);

    // HP text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(0, f2.hp)} / ${f2.maxHp}`, rightX + barWidth / 2, hudY + 20);

    // Stamina bar (fills from right)
    const staminaY2 = hudY + 26;
    ctx.fillStyle = '#220';
    ctx.fillRect(rightX, staminaY2, barWidth, staminaBarHeight);
    const stam2Pct = Math.max(0, f2.stamina / f2.maxStamina);
    const stamColor2 = stam2Pct > 0.3 ? '#fc0' : '#f60';
    ctx.fillStyle = stamColor2;
    ctx.fillRect(rightX + barWidth * (1 - stam2Pct), staminaY2, barWidth * stam2Pct, staminaBarHeight);

    // Ability charge bar
    const abilityY2 = hudY + 34;
    ctx.fillStyle = '#224';
    ctx.fillRect(rightX, abilityY2, barWidth, abilityBarHeight);

    const charge2Pct = f2.abilityCharge / f2.abilityMaxCharge;
    const abilityGrad2 = ctx.createLinearGradient(rightX + barWidth, 0, rightX, 0);
    abilityGrad2.addColorStop(0, '#60f');
    abilityGrad2.addColorStop(1, '#f0f');
    ctx.fillStyle = abilityGrad2;
    ctx.fillRect(rightX + barWidth * (1 - charge2Pct), abilityY2, barWidth * charge2Pct, abilityBarHeight);

    // Ability ready glow
    if (f2.abilityCharge >= f2.abilityMaxCharge) {
        ctx.strokeStyle = '#f0f';
        ctx.lineWidth = 2;
        ctx.strokeRect(rightX - 1, abilityY2 - 1, barWidth + 2, abilityBarHeight + 2);
        ctx.fillStyle = '#f0f';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(f2.specialAbility.name.toUpperCase() + ' READY!', rightX + barWidth, abilityY2 + 18);
    } else {
        ctx.fillStyle = '#88a';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(f2.specialAbility.name, rightX + barWidth, abilityY2 + 18);
    }

    // === VS BADGE ===
    ctx.fillStyle = '#f00';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VS', canvas.width / 2, hudY + 15);

    // === FIGHT STATS (bottom of screen) ===
    if (gameState === 'fighting' || gameState === 'victory') {
        const statsY = canvas.height - 90;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(leftX - 5, statsY - 5, 130, 50);
        ctx.fillRect(rightX + barWidth - 125, statsY - 5, 130, 50);

        ctx.font = '10px monospace';
        ctx.textAlign = 'left';

        // Left fighter stats
        ctx.fillStyle = '#8af';
        ctx.fillText(`Hits: ${f1.stats.hitsLanded}`, leftX, statsY + 8);
        ctx.fillStyle = '#fa8';
        ctx.fillText(`Dmg: ${f1.stats.damageDealt}`, leftX, statsY + 20);
        ctx.fillStyle = '#ff0';
        ctx.fillText(`Crits: ${f1.stats.criticalHits}`, leftX, statsY + 32);

        // Right fighter stats
        ctx.textAlign = 'right';
        ctx.fillStyle = '#8af';
        ctx.fillText(`Hits: ${f2.stats.hitsLanded}`, rightX + barWidth, statsY + 8);
        ctx.fillStyle = '#fa8';
        ctx.fillText(`Dmg: ${f2.stats.damageDealt}`, rightX + barWidth, statsY + 20);
        ctx.fillStyle = '#ff0';
        ctx.fillText(`Crits: ${f2.stats.criticalHits}`, rightX + barWidth, statsY + 32);
    }

    // === COMBO DISPLAY ===
    if (f1.comboCount >= 3) {
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${f1.comboCount} COMBO!`, leftX, hudY + 70);
    }
    if (f2.comboCount >= 3) {
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${f2.comboCount} COMBO!`, rightX + barWidth, hudY + 70);
    }
}

// ============================================
// DYNAMIC CAMERA SYSTEM
// ============================================

function updateCamera() {
    // Calculate center of action
    if (fighters.length === 2) {
        const [f1, f2] = fighters;
        const centerX = (f1.x + f2.x) / 2;
        const centerY = (f1.y + f2.y) / 2;

        // Calculate distance between fighters
        const dx = Math.abs(f2.x - f1.x);
        const dy = Math.abs(f2.y - f1.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Base zoom based on fighter distance - closer = more zoom
        let baseZoom = 1.0;
        if (distance < 100) {
            baseZoom = 1.3;  // Close combat zoom
        } else if (distance < 200) {
            baseZoom = 1.15;
        } else if (distance > 400) {
            baseZoom = 0.95; // Zoom out when far apart
        }

        // If focusing on a specific target (attacking, using ability, low HP)
        if (camera.focusTarget && camera.focusIntensity > 0) {
            const focusMix = camera.focusIntensity;
            camera.targetX = centerX * (1 - focusMix) + camera.focusTarget.x * focusMix;
            camera.targetY = centerY * (1 - focusMix) + camera.focusTarget.y * focusMix;
            camera.targetZoom = baseZoom * (1 + focusMix * 0.3);
            camera.focusIntensity *= 0.95; // Decay focus
        } else {
            camera.targetX = centerX;
            camera.targetY = centerY;
            camera.targetZoom = baseZoom;
        }

        // Dramatic zoom for critical moments
        if (camera.dramaticZoom) {
            camera.targetZoom = 1.5;
            camera.dramaticTimer--;
            if (camera.dramaticTimer <= 0) {
                camera.dramaticZoom = false;
            }
        }
    }

    // Smooth camera movement
    camera.x += (camera.targetX - camera.x) * 0.08;
    camera.y += (camera.targetY - camera.y) * 0.08;
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;

    // Clamp zoom
    camera.zoom = Math.max(0.8, Math.min(1.6, camera.zoom));

    // Update camera shake
    if (camera.shakeIntensity > 0) {
        camera.shakeX = (Math.random() - 0.5) * camera.shakeIntensity * 2;
        camera.shakeY = (Math.random() - 0.5) * camera.shakeIntensity * 2;
        camera.shakeIntensity *= 0.9;
        if (camera.shakeIntensity < 0.5) {
            camera.shakeIntensity = 0;
            camera.shakeX = 0;
            camera.shakeY = 0;
        }
    }
}

function cameraShake(intensity) {
    camera.shakeIntensity = Math.max(camera.shakeIntensity, intensity);
}

function cameraFocusOn(fighter, intensity = 0.5) {
    camera.focusTarget = fighter;
    camera.focusIntensity = intensity;
}

function cameraDramaticZoom(duration = 30) {
    camera.dramaticZoom = true;
    camera.dramaticTimer = duration;
}

function resetCamera() {
    camera.x = ARENA.width / 2;
    camera.y = ARENA.height / 2;
    camera.targetX = ARENA.width / 2;
    camera.targetY = ARENA.height / 2;
    camera.zoom = 1.0;
    camera.targetZoom = 1.0;
    camera.focusTarget = null;
    camera.focusIntensity = 0;
    camera.shakeX = 0;
    camera.shakeY = 0;
    camera.shakeIntensity = 0;
    camera.dramaticZoom = false;
    camera.dramaticTimer = 0;
}

function applyCameraTransform(ctx) {
    const offsetX = ARENA.width / 2 - camera.x;
    const offsetY = ARENA.height / 2 - camera.y;

    ctx.save();
    ctx.translate(ARENA.width / 2, ARENA.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-ARENA.width / 2 + offsetX + camera.shakeX, -ARENA.height / 2 + offsetY + camera.shakeY);
}

function restoreCameraTransform(ctx) {
    ctx.restore();
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
            spawnParticles(f.x, f.y, 'poison', 1);
            spawnFloatingNumber(f.x, f.y, poisonDmg, '#0f0', false);
            if (f.hp <= 0) {
                f.hp = 0;
                f.setState('death');
                hitPause = 20;
                addCommentary(`${f.bug.name} succumbs to poison!`, '#0f0');
            }
        }
    });

    // Hazard effects
    if (terrarium.hazards && terrarium.hazards.length > 0) {
        fighters.forEach(f => {
            if (!f.isAlive) return;

            terrarium.hazards.forEach(hazard => {
                const dx = f.x - hazard.x;
                const dy = (f.y - hazard.y) * 2; // Flatten for ellipse check
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < hazard.radius) {
                    // In hazard zone
                    f.inHazard = hazard.type;

                    // Apply slow effect
                    if (hazard.slowFactor < 1) {
                        f.vx *= hazard.slowFactor;
                        f.vy *= hazard.slowFactor;
                    }

                    // Apply damage over time
                    if (hazard.damagePerTick > 0 && combatTick % 30 === 0) {
                        f.hp -= hazard.damagePerTick;
                        f.flashTimer = 3;

                        if (hazard.type === 'thornPatch') {
                            spawnFloatingNumber(f.x, f.y, hazard.damagePerTick, '#4a8a4a', false);
                        } else if (hazard.type === 'hotSpot') {
                            spawnFloatingNumber(f.x, f.y, hazard.damagePerTick, '#f80', false);
                            spawnParticles(f.x, f.y - 10, 'spark', 2);
                        }

                        if (f.hp <= 0) {
                            f.hp = 0;
                            f.setState('death');
                            hitPause = 20;
                            addCommentary(`${f.bug.name} falls to the ${hazard.type}!`, '#f80');
                        }
                    }
                } else {
                    if (f.inHazard === hazard.type) {
                        f.inHazard = null;
                    }
                }
            });
        });
    }

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

    // Update abilities, combos, and drives
    fighters.forEach(f => {
        f.updateAbility();
        f.updateCombo();
        f.updateDrives();
    });

    // Attack timing and ability usage
    fighters.forEach((f, i) => {
        if (!f.isAlive || f.state !== 'idle') return;

        const opponent = fighters[1 - i];
        const dx = opponent.x - f.x;
        const dy = opponent.y - f.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // AI decides to use special ability
        if (f.canUseAbility()) {
            // Use ability based on situation
            const hpPercent = f.hp / f.maxHp;
            const oppHpPercent = opponent.hp / opponent.maxHp;

            // Higher chance to use ability when:
            // - Low HP (desperation)
            // - Opponent low HP (finish them)
            // - Random chance based on instinct
            let useChance = 0.02; // Base chance per tick
            if (hpPercent < 0.3) useChance += 0.15; // Desperation
            if (oppHpPercent < 0.3) useChance += 0.1; // Go for the kill
            useChance += f.genome.instinct / 500; // Smart bugs use abilities more

            if (Math.random() < useChance) {
                f.activateAbility(opponent);
                return; // Skip normal attack this tick
            }
        }

        f.attackCooldown -= slowMotion;
        if (f.attackCooldown <= 0) {
            // Attack range based on actual sprite bounds + weapon-specific range
            const bounds = f.getScaledBounds();
            const oppBounds = opponent.getScaledBounds();
            const weaponRange = getWeaponRange(f.genome.weapon);
            const attackRange = bounds.right + oppBounds.left + weaponRange;
            if (dist < attackRange) {
                f.startAttack(opponent);
                const baseCooldown = getWeaponCooldown(f.genome.weapon, f.genome.speed);
                f.attackCooldown = baseCooldown + rollDice(20);
            }
        }
    });
}

// Weapon-specific attack ranges
function getWeaponRange(weapon) {
    switch (weapon) {
        case 'horns': return 45;    // Charging range
        case 'stinger': return 40;  // Extended reach
        case 'mandibles': return 25; // Close grappling
        case 'claws': return 35;    // Slashing range
        case 'fangs': return 30;    // Bite range
        default: return 30;
    }
}

// Weapon-specific attack cooldowns
function getWeaponCooldown(weapon, speed) {
    const speedMod = speed / 2;
    switch (weapon) {
        case 'claws':
            // Fast multi-hit weapon
            return Math.max(20, 55 - speedMod);
        case 'stinger':
            // Precise but slower
            return Math.max(30, 75 - speedMod);
        case 'mandibles':
            // Slow crushing attacks
            return Math.max(35, 90 - speedMod);
        case 'fangs':
            // Medium speed bites
            return Math.max(25, 65 - speedMod);
        case 'horns':
            // Charging takes time
            return Math.max(40, 100 - speedMod);
        default:
            return Math.max(25, 80 - speedMod);
    }
}

// ============================================
// COMMENTARY
// ============================================

// Enhanced contextual commentary system
const COMMENTARY = {
    miss: [
        "{name} whiffs completely!",
        "{name} swings at nothing!",
        "A clean miss by {name}!",
        "{name}'s attack goes wide!",
        "{name} misses the mark!",
        "{name} can't connect!",
        "Evasive maneuver dodges {name}!",
        "{name} strikes the air!"
    ],
    damage: [
        "{name} lands a solid hit!",
        "{name} connects for {dmg} damage!",
        "Ouch! {name} deals {dmg}!",
        "{name} strikes true! {dmg} damage!",
        "{name} delivers {dmg} damage!",
        "That's gonna leave a mark! {dmg}!",
        "{name} with a clean hit! {dmg}!"
    ],
    criticalHit: [
        "DEVASTATING CRITICAL!",
        "MASSIVE CRIT!",
        "BRUTAL CRITICAL HIT!",
        "CRITICAL! WHAT A HIT!",
        "CRUSHING BLOW!",
        "BONE-CRUSHING CRITICAL!"
    ],
    defeat: [
        "{name} goes down HARD!",
        "{name} is FINISHED!",
        "IT'S OVER for {name}!",
        "{name} has been DESTROYED!",
        "{name} is OUT COLD!",
        "That's it! {name} is DONE!",
        "{name} has fallen!",
        "DOWN GOES {name}!"
    ],
    heightAdvantage: [
        "Attack from above!",
        "Height advantage!",
        "Diving strike!",
        "Aerial assault!"
    ],
    backstab: [
        "Backstab!",
        "Attacked from behind!",
        "Caught off guard!",
        "Sneak attack!"
    ],
    poison: [
        "{name} is poisoned!",
        "Venom courses through {name}!",
        "The poison takes hold of {name}!",
        "{name} feels the toxin!"
    ],
    toxic: [
        "{name} takes {dmg} toxic recoil!",
        "Toxic defense! {name} takes {dmg}!",
        "{name} hurt by toxic skin! {dmg}!"
    ],
    doubleslash: [
        "Double slash!",
        "Two quick strikes!",
        "Rapid claw combo!",
        "Flurry of claws!"
    ],
    lowHp: [
        "{name} is on the ropes!",
        "{name} is barely hanging on!",
        "{name} looks wounded!",
        "{name} is in trouble!"
    ],
    comeback: [
        "What a comeback by {name}!",
        "{name} turning it around!",
        "The momentum shifts to {name}!"
    ],
    dominating: [
        "{name} is dominating!",
        "{name} is in complete control!",
        "One-sided beatdown by {name}!"
    ],
    closeMatch: [
        "This fight is neck and neck!",
        "Anyone's match to win!",
        "An even contest so far!"
    ],
    weaponAttack: {
        mandibles: [
            "{name}'s mandibles clamp down!",
            "Crushing bite from {name}!",
            "{name} tears with mandibles!"
        ],
        claws: [
            "{name} slashes with claws!",
            "Razor claws from {name}!",
            "{name} swipes viciously!"
        ],
        stinger: [
            "{name}'s stinger strikes!",
            "Deadly sting from {name}!",
            "{name} jabs with the stinger!"
        ],
        fangs: [
            "{name} bites deep with fangs!",
            "Venomous bite from {name}!",
            "{name}'s fangs find their mark!"
        ],
        horns: [
            "{name} gores with horns!",
            "Horn charge from {name}!",
            "{name} rams with brutal horns!"
        ]
    },
    fightStart: [
        "Let's get ready to rumble!",
        "The battle begins!",
        "They're off! Let's go!",
        "Here we go! Fight!"
    ],
    victory: [
        "{name} is VICTORIOUS!",
        "{name} WINS!",
        "WINNER: {name}!",
        "{name} stands triumphant!",
        "Victory goes to {name}!"
    ]
};

function getRandomPhrase(category, replacements = {}) {
    const phrases = COMMENTARY[category];
    if (!phrases) return '';
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    let result = phrase;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(`{${key}}`, value);
    }
    return result;
}

function getWeaponPhrase(weapon, name) {
    const weaponPhrases = COMMENTARY.weaponAttack[weapon];
    if (weaponPhrases) {
        const phrase = weaponPhrases[Math.floor(Math.random() * weaponPhrases.length)];
        return phrase.replace('{name}', name);
    }
    return '';
}

// Track fight momentum for contextual commentary
let fightMomentum = {
    lastCommentTime: 0,
    lastHpCheck: { f1: 100, f2: 100 },
    dominatingAnnounced: false,
    lowHpAnnounced: { f1: false, f2: false }
};

function checkFightContext() {
    if (gameState !== 'fighting' || fighters.length !== 2) return;

    const now = Date.now();
    if (now - fightMomentum.lastCommentTime < 3000) return; // Rate limit

    const f1 = fighters[0];
    const f2 = fighters[1];
    const hp1Pct = f1.hp / f1.maxHp;
    const hp2Pct = f2.hp / f2.maxHp;

    // Low HP warning
    if (hp1Pct < 0.25 && !fightMomentum.lowHpAnnounced.f1) {
        addCommentary(getRandomPhrase('lowHp', { name: f1.bug.name }), '#f80');
        fightMomentum.lowHpAnnounced.f1 = true;
        fightMomentum.lastCommentTime = now;
        return;
    }
    if (hp2Pct < 0.25 && !fightMomentum.lowHpAnnounced.f2) {
        addCommentary(getRandomPhrase('lowHp', { name: f2.bug.name }), '#f80');
        fightMomentum.lowHpAnnounced.f2 = true;
        fightMomentum.lastCommentTime = now;
        return;
    }

    // Domination check (one fighter has 80%+ HP while other has less than 40%)
    if (!fightMomentum.dominatingAnnounced) {
        if (hp1Pct > 0.8 && hp2Pct < 0.4) {
            addCommentary(getRandomPhrase('dominating', { name: f1.bug.name }), '#ff0');
            fightMomentum.dominatingAnnounced = true;
            fightMomentum.lastCommentTime = now;
        } else if (hp2Pct > 0.8 && hp1Pct < 0.4) {
            addCommentary(getRandomPhrase('dominating', { name: f2.bug.name }), '#ff0');
            fightMomentum.dominatingAnnounced = true;
            fightMomentum.lastCommentTime = now;
        }
    }

    // Close match check (both between 30-60% HP)
    if (hp1Pct > 0.3 && hp1Pct < 0.6 && hp2Pct > 0.3 && hp2Pct < 0.6) {
        if (Math.random() < 0.02) { // Rare
            addCommentary(getRandomPhrase('closeMatch'), '#8af');
            fightMomentum.lastCommentTime = now;
        }
    }
}

function resetFightMomentum() {
    fightMomentum = {
        lastCommentTime: 0,
        lastHpCheck: { f1: 100, f2: 100 },
        dominatingAnnounced: false,
        lowHpAnnounced: { f1: false, f2: false }
    };
}

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

    // If switching fighters, refund old bet first
    if (currentBet.amount > 0 && currentBet.on !== which) {
        player.money += currentBet.amount;
        const oldBugName = currentBet.on === 1 ? nextBugs.bug1.name : nextBugs.bug2.name;
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
    updateUI();

    const bugName = which === 1 ? nextBugs.bug1.name : nextBugs.bug2.name;
    addCommentary(`Bet $${amount} on ${bugName}! (Total: $${currentBet.amount})`, '#0f0');

    // Update button states to show which is selected
    document.getElementById('bet-fighter1').classList.toggle('selected', which === 1);
    document.getElementById('bet-fighter2').classList.toggle('selected', which === 2);

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

    // Clear bet selection styling from previous round
    document.getElementById('bet-fighter1').classList.remove('selected');
    document.getElementById('bet-fighter2').classList.remove('selected');
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
    floatingNumbers = [];
    combatTick = 0;
    hitPause = 0;
    slowMotion = 1;

    // Reset camera for new fight
    resetCamera();

    // Start with intro phase
    gameState = 'intro';

    // Initialize intro animations with staggered timing
    fighters[0].startIntro(10);  // Left fighter enters first
    fighters[1].startIntro(40);  // Right fighter enters slightly later

    // Reset fight momentum tracking
    resetFightMomentum();

    // Generate new terrarium decorations for this fight
    generateTerrariumDecorations();

    // Initialize ambient particles
    initAmbientParticles();

    document.getElementById('countdown-display').classList.add('hidden');
    document.getElementById('bet-buttons').classList.add('disabled');

    addCommentary(`${fighters[0].bug.name} vs ${fighters[1].bug.name}!`, '#ff0');
}

function updateIntroPhase() {
    if (gameState !== 'intro') return;

    // Update intro animations for both fighters
    fighters.forEach(f => {
        f.updateIntro();
        f.updateAnimation(); // Keep animation running during intro
    });

    // Check if both intros are complete
    if (fighters.every(f => f.isIntroComplete())) {
        // Transition to fighting
        gameState = 'fighting';
        addCommentary(getRandomPhrase('fightStart'), '#f00');

        // Camouflage first strike
        fighters.forEach(f => {
            if (f.genome.defense === 'camouflage') {
                f.attackCooldown = 5;
                addCommentary(`${f.bug.name} strikes from the shadows!`, '#595');
            }
        });
    }
}

function endFight() {
    gameState = 'victory';
    const winner = fighters.find(f => f.isAlive);
    const winnerSide = winner === fighters[0] ? 1 : 2;

    if (winner) {
        winner.setState('victory');
        addCommentary(getRandomPhrase('victory', { name: winner.bug.name }), '#ff0');
        resolveBet(winnerSide);

        // Simple victory effect
        spawnParticles(winner.x, winner.y - 20, 'spark', 4);
    }

    setTimeout(startCountdown, 4000);
}

// ============================================
// RENDERING
// ============================================

function renderPreFightPresentation(ctx) {
    const b1 = nextBugs.bug1;
    const b2 = nextBugs.bug2;
    const centerX = canvas.width / 2;
    const panelY = 100;
    const panelHeight = 380;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, panelY - 20, canvas.width, panelHeight + 40);

    // Top border glow
    const topGlow = ctx.createLinearGradient(0, panelY - 20, 0, panelY + 10);
    topGlow.addColorStop(0, 'rgba(255, 200, 0, 0.5)');
    topGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, panelY - 20, canvas.width, 30);

    // "VS" central emblem
    const vsGlow = ctx.createRadialGradient(centerX, panelY + 80, 0, centerX, panelY + 80, 60);
    vsGlow.addColorStop(0, 'rgba(255, 0, 0, 0.3)');
    vsGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = vsGlow;
    ctx.beginPath();
    ctx.arc(centerX, panelY + 80, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f00';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VS', centerX, panelY + 95);

    // Fighter name banners
    const bannerWidth = 320;
    const bannerHeight = 40;

    // Left fighter banner (blue theme)
    const leftGrad = ctx.createLinearGradient(30, 0, 30 + bannerWidth, 0);
    leftGrad.addColorStop(0, '#1a4a7a');
    leftGrad.addColorStop(1, '#0a2a4a');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(30, panelY + 10, bannerWidth, bannerHeight);
    ctx.strokeStyle = '#4a8aff';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, panelY + 10, bannerWidth, bannerHeight);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(b1.name.toUpperCase(), 45, panelY + 38);

    // Right fighter banner (red theme)
    const rightGrad = ctx.createLinearGradient(canvas.width - 30 - bannerWidth, 0, canvas.width - 30, 0);
    rightGrad.addColorStop(0, '#4a1a1a');
    rightGrad.addColorStop(1, '#7a2a2a');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(canvas.width - 30 - bannerWidth, panelY + 10, bannerWidth, bannerHeight);
    ctx.strokeStyle = '#ff4a4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvas.width - 30 - bannerWidth, panelY + 10, bannerWidth, bannerHeight);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(b2.name.toUpperCase(), canvas.width - 45, panelY + 38);

    // Stat comparison bars
    const stats = [
        { name: 'BULK', key: 'bulk', color1: '#4a8aff', color2: '#ff4a4a' },
        { name: 'SPEED', key: 'speed', color1: '#4aff4a', color2: '#ff4aff' },
        { name: 'FURY', key: 'fury', color1: '#ff8a4a', color2: '#ffff4a' },
        { name: 'INSTINCT', key: 'instinct', color1: '#8a4aff', color2: '#4affff' }
    ];

    const barStartY = panelY + 130;
    const barHeight = 18;
    const barGap = 28;
    const maxBarWidth = 280;

    stats.forEach((stat, i) => {
        const y = barStartY + i * barGap;
        const val1 = b1.genome[stat.key];
        const val2 = b2.genome[stat.key];

        // Stat label (center)
        ctx.fillStyle = '#888';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(stat.name, centerX, y + 13);

        // Left bar (grows from center to left)
        const width1 = (val1 / 100) * maxBarWidth;
        const leftBarGrad = ctx.createLinearGradient(centerX - width1 - 40, 0, centerX - 40, 0);
        leftBarGrad.addColorStop(0, stat.color1);
        leftBarGrad.addColorStop(1, 'rgba(255,255,255,0.2)');
        ctx.fillStyle = leftBarGrad;
        ctx.fillRect(centerX - width1 - 40, y, width1, barHeight);

        // Left bar border
        ctx.strokeStyle = stat.color1;
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - maxBarWidth - 40, y, maxBarWidth, barHeight);

        // Left value
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val1, centerX - maxBarWidth - 50, y + 14);

        // Right bar (grows from center to right)
        const width2 = (val2 / 100) * maxBarWidth;
        const rightBarGrad = ctx.createLinearGradient(centerX + 40, 0, centerX + width2 + 40, 0);
        rightBarGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
        rightBarGrad.addColorStop(1, stat.color2);
        ctx.fillStyle = rightBarGrad;
        ctx.fillRect(centerX + 40, y, width2, barHeight);

        // Right bar border
        ctx.strokeStyle = stat.color2;
        ctx.strokeRect(centerX + 40, y, maxBarWidth, barHeight);

        // Right value
        ctx.textAlign = 'left';
        ctx.fillText(val2, centerX + maxBarWidth + 50, y + 14);

        // Highlight advantage
        if (val1 > val2) {
            ctx.fillStyle = 'rgba(74, 138, 255, 0.3)';
            ctx.fillRect(centerX - maxBarWidth - 40, y, maxBarWidth, barHeight);
        } else if (val2 > val1) {
            ctx.fillStyle = 'rgba(255, 74, 74, 0.3)';
            ctx.fillRect(centerX + 40, y, maxBarWidth, barHeight);
        }
    });

    // Attributes section
    const attrY = barStartY + stats.length * barGap + 20;

    // Left fighter attributes
    ctx.textAlign = 'left';
    renderAttributeTag(ctx, 50, attrY, b1.genome.weapon, '#ff6600', 'WEAPON');
    renderAttributeTag(ctx, 50, attrY + 28, b1.genome.defense, '#00aa66', 'DEFENSE');
    renderAttributeTag(ctx, 50, attrY + 56, b1.genome.mobility, '#6688ff', 'MOBILITY');

    // Right fighter attributes
    ctx.textAlign = 'right';
    renderAttributeTag(ctx, canvas.width - 50, attrY, b2.genome.weapon, '#ff6600', 'WEAPON', true);
    renderAttributeTag(ctx, canvas.width - 50, attrY + 28, b2.genome.defense, '#00aa66', 'DEFENSE', true);
    renderAttributeTag(ctx, canvas.width - 50, attrY + 56, b2.genome.mobility, '#6688ff', 'MOBILITY', true);

    // Countdown display
    const countdownY = panelY + panelHeight - 60;

    // Countdown circle
    const countdownRadius = 45;
    ctx.beginPath();
    ctx.arc(centerX, countdownY, countdownRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fill();

    // Countdown progress ring
    const progress = countdownTimer / COUNTDOWN_SECONDS;
    ctx.beginPath();
    ctx.arc(centerX, countdownY, countdownRadius, -Math.PI / 2, -Math.PI / 2 + (1 - progress) * Math.PI * 2);
    ctx.strokeStyle = countdownTimer <= 3 ? '#ff0000' : '#ffcc00';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Countdown number
    ctx.fillStyle = countdownTimer <= 3 ? '#ff0000' : '#ffcc00';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(countdownTimer, centerX, countdownY + 12);

    // "Place your bets" text
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('PLACE YOUR BETS', centerX, countdownY + 55);

    // Pulsing effect when low time
    if (countdownTimer <= 3) {
        const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.3;
        ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
        ctx.beginPath();
        ctx.arc(centerX, countdownY, countdownRadius + 10, 0, Math.PI * 2);
        ctx.fill();
    }
}

function renderAttributeTag(ctx, x, y, value, color, label, rightAlign = false) {
    const tagWidth = 140;
    const tagHeight = 22;

    const drawX = rightAlign ? x - tagWidth : x;

    // Tag background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(drawX, y, tagWidth, tagHeight);

    // Tag border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX, y, tagWidth, tagHeight);

    // Label
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.textAlign = rightAlign ? 'right' : 'left';
    const labelX = rightAlign ? drawX + tagWidth - 5 : drawX + 5;
    ctx.fillText(label, labelX, y + 9);

    // Value
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    const valueX = rightAlign ? drawX + tagWidth - 5 : drawX + 5;
    ctx.fillText(value.toUpperCase(), valueX, y + 19);
}

function renderArena() {
    if (hitPause > 0) hitPause--;

    // Update dynamic camera
    updateCamera();

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

    // Apply camera transform for dynamic zoom and pan
    applyCameraTransform(ctx);

    // === BACKGROUND ===
    // Dark gradient backdrop
    const bgGradient = ctx.createLinearGradient(0, 0, 0, ARENA.height);
    bgGradient.addColorStop(0, '#0d1117');
    bgGradient.addColorStop(0.5, '#161b22');
    bgGradient.addColorStop(1, '#0d1117');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // === ENCLOSURE BACK WALL ===
    // Interior gradient (subtle depth)
    const interiorGradient = ctx.createLinearGradient(0, ARENA.ceilingY, 0, ARENA.floorY);
    interiorGradient.addColorStop(0, '#1a1f25');
    interiorGradient.addColorStop(0.3, '#12161a');
    interiorGradient.addColorStop(1, '#0a0d10');
    ctx.fillStyle = interiorGradient;
    ctx.fillRect(ARENA.leftWall, ARENA.ceilingY, ARENA.rightWall - ARENA.leftWall, ARENA.floorY - ARENA.ceilingY + 20);

    // === SUBSTRATE/FLOOR ===
    // Base dirt color
    const floorGradient = ctx.createLinearGradient(0, ARENA.floorY - 5, 0, ARENA.floorY + 20);
    floorGradient.addColorStop(0, '#4a3a28');
    floorGradient.addColorStop(0.3, '#3d3020');
    floorGradient.addColorStop(1, '#2a2018');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(ARENA.leftWall, ARENA.floorY - 3, ARENA.rightWall - ARENA.leftWall, 25);

    // Render terrarium decorations (plants, rocks, substrate texture)
    if (terrarium.initialized) {
        renderTerrarium(ctx);
    }

    // === BLOOD STAINS ===
    bloodStains.forEach(s => {
        ctx.globalAlpha = s.alpha * 0.7;
        const bloodGradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
        bloodGradient.addColorStop(0, '#600');
        bloodGradient.addColorStop(0.7, '#400');
        bloodGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = bloodGradient;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // === GLASS ENCLOSURE ===
    // Left wall glass
    ctx.fillStyle = 'rgba(100, 120, 140, 0.1)';
    ctx.fillRect(ARENA.leftWall - 8, ARENA.ceilingY - 5, 12, ARENA.floorY - ARENA.ceilingY + 28);

    // Right wall glass
    ctx.fillRect(ARENA.rightWall - 4, ARENA.ceilingY - 5, 12, ARENA.floorY - ARENA.ceilingY + 28);

    // Top glass
    ctx.fillRect(ARENA.leftWall - 5, ARENA.ceilingY - 8, ARENA.rightWall - ARENA.leftWall + 10, 10);

    // Glass reflections (subtle shine)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    // Left wall reflection
    ctx.beginPath();
    ctx.moveTo(ARENA.leftWall + 5, ARENA.ceilingY + 20);
    ctx.lineTo(ARENA.leftWall + 5, ARENA.floorY - 20);
    ctx.stroke();
    // Right wall reflection
    ctx.beginPath();
    ctx.moveTo(ARENA.rightWall - 5, ARENA.ceilingY + 20);
    ctx.lineTo(ARENA.rightWall - 5, ARENA.floorY - 20);
    ctx.stroke();
    // Top reflection
    ctx.beginPath();
    ctx.moveTo(ARENA.leftWall + 50, ARENA.ceilingY + 3);
    ctx.lineTo(ARENA.rightWall - 50, ARENA.ceilingY + 3);
    ctx.stroke();

    // Frame (dark metal look)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 8;
    ctx.strokeRect(ARENA.leftWall - 4, ARENA.ceilingY - 4, ARENA.rightWall - ARENA.leftWall + 8, ARENA.floorY - ARENA.ceilingY + 26);

    // Inner frame edge
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(ARENA.leftWall, ARENA.ceilingY, ARENA.rightWall - ARENA.leftWall, ARENA.floorY - ARENA.ceilingY + 18);

    // === IMPACT FLASH ===
    if (impactFlash.active) {
        ctx.globalAlpha = impactFlash.alpha;
        const fg = ctx.createRadialGradient(impactFlash.x, impactFlash.y, 0, impactFlash.x, impactFlash.y, impactFlash.radius);
        fg.addColorStop(0, '#fff');
        fg.addColorStop(0.3, '#ffa');
        fg.addColorStop(0.6, '#f80');
        fg.addColorStop(1, 'transparent');
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    }

    // === FIGHTERS ===
    // Draw shadows first
    fighters.forEach(f => {
        if (f.isAlive || f.state === 'death') {
            const bounds = f.getScaledBounds();
            const shadowY = ARENA.floorY + 2;
            const shadowScale = Math.max(0.3, 1 - (shadowY - f.y) / 300);
            ctx.globalAlpha = 0.3 * shadowScale;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(f.x + f.lungeX, shadowY, bounds.width * 0.4 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1;

    // === AMBIENT PARTICLES (floating dust motes) ===
    if (gameState === 'intro' || gameState === 'fighting' || gameState === 'victory') {
        updateAmbientParticles();
        renderAmbientParticles(ctx);
    }

    // Draw fighters
    fighters.forEach(f => f.render(ctx));

    // === PARTICLES ===
    particles.forEach(p => { p.update(); p.render(ctx); });
    particles = particles.filter(p => p.life > 0);

    // === FLOATING DAMAGE NUMBERS ===
    floatingNumbers.forEach(fn => { fn.update(); fn.render(ctx); });
    floatingNumbers = floatingNumbers.filter(fn => fn.life > 0);

    // Restore camera transform before vignette and UI
    restoreCameraTransform(ctx);

    // === VIGNETTE EFFECT ===
    if (gameState === 'intro' || gameState === 'fighting' || gameState === 'victory') {
        renderVignette(ctx);
    }

    ctx.restore();

    // Title
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUG FIGHTS', canvas.width / 2, 35);

    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText(`FIGHT #${fightNumber}`, canvas.width / 2, 55);

    // Fight HUD during combat
    if (fighters.length === 2 && (gameState === 'fighting' || gameState === 'intro' || gameState === 'victory')) {
        renderFightHUD(ctx);
    }

    // Enhanced pre-fight presentation during countdown
    if (gameState === 'countdown' && nextBugs.bug1 && nextBugs.bug2) {
        renderPreFightPresentation(ctx);
    }

    // Commentary - 90s terminal style
    ctx.textAlign = 'left';
    ctx.font = '16px "VT323", monospace';
    commentary.forEach((c, i) => {
        c.age++;
        ctx.globalAlpha = Math.max(0, 1 - c.age / 180);
        // Add text shadow for glow effect
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = c.color;
        ctx.fillText('> ' + c.text, 55, canvas.height - 70 + i * 20);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    commentary = commentary.filter(c => c.age < 180);

    // CRT scanline overlay effect
    renderCRTEffect(ctx);
}

function renderCRTEffect(ctx) {
    // Subtle scanlines
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#000';
    for (let y = 0; y < canvas.height; y += 3) {
        ctx.fillRect(0, y, canvas.width, 1);
    }

    // Subtle vignette
    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.8
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function gameLoopFn() {
    updateCountdown();

    // Handle intro phase
    if (gameState === 'intro') {
        updateIntroPhase();
    } else {
        fighters.forEach(f => {
            f.updateAnimation();
            if (gameState === 'fighting') {
                f.updatePhysics();
                f.updateAI(fighters.find(o => o !== f));
            }
        });
    }

    if (gameState === 'fighting') {
        processCombatTick();
        checkFightContext(); // Contextual commentary based on fight state
    }
    renderArena();
    gameLoop = requestAnimationFrame(gameLoopFn);
}

// ============================================
// UI
// ============================================

function updateUI() {
    document.getElementById('money').textContent = player.money;
    // Persist money to localStorage
    localStorage.setItem('bugfights_money', player.money.toString());

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

    // 90s visitor counter - stored in localStorage
    initVisitorCounter();

    fighters = [];
    updateUI();
    startCountdown();
    gameLoopFn();
}

function initVisitorCounter() {
    let visits = parseInt(localStorage.getItem('bugfights_visits') || '0');
    visits++;
    localStorage.setItem('bugfights_visits', visits.toString());

    // Format with leading zeros for that classic hit counter look
    const formatted = String(visits).padStart(6, '0');
    const counter = document.getElementById('visitor-count');
    if (counter) {
        counter.textContent = formatted;
    }
}

document.addEventListener('DOMContentLoaded', initGame);
