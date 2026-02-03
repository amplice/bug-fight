// Bug Fights - Server Simulation
// Handles all game logic, runs 24/7

import BugGenome = require('./BugGenome');
import RosterManager = require('./roster');

// ============================================
// CONSTANTS
// ============================================

const ARENA: ArenaConfig = {
    width: 900,
    height: 400,
    depth: 600,
    minX: -450,
    maxX: 450,
    minY: 0,      // floor
    maxY: 400,    // ceiling
    minZ: -300,   // back wall
    maxZ: 300,    // front wall
};

const COUNTDOWN_SECONDS: number = 10;
const TICK_RATE: number = 30; // ticks per second
const TICK_MS: number = 1000 / TICK_RATE;

// ============================================
// HELPER FUNCTIONS
// ============================================

function rollDice(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// ============================================
// FIGHT LOGGER - Comprehensive diagnostics
// ============================================

class FightLogger {
    fightStart: number;
    lastSummaryTime: number;
    summaryInterval: number;
    stats: FightLoggerStats;
    lastAiStates: [AIState | null, AIState | null];
    lastPositions: [{ x: number; y: number; z: number } | null, { x: number; y: number; z: number } | null];
    enabled: boolean;
    bug1Name: string | undefined;
    bug2Name: string | undefined;

    constructor() {
        this.fightStart = Date.now();
        this.lastSummaryTime = Date.now();
        this.summaryInterval = 10000;  // Summary every 10 seconds

        // Per-fight stats
        this.stats = {
            attacks: [0, 0],
            hits: [0, 0],
            dodges: [0, 0],
            damage: [0, 0],
            feints: [0, 0],
            feintsRead: [0, 0],
            feintBaits: [0, 0],
            timeInState: [{}, {}],
            stateTransitions: [],
            engagementHistory: [],  // Track distance over time
            lastEngagement: 0,      // Ticks since last attack attempt
            stalemateTicks: 0,      // Consecutive ticks at distance
        };

        this.lastAiStates = [null, null];
        this.lastPositions = [null, null];
        this.enabled = true;
    }

    reset(bug1Name: string, bug2Name: string): void {
        this.fightStart = Date.now();
        this.lastSummaryTime = Date.now();
        this.bug1Name = bug1Name;
        this.bug2Name = bug2Name;
        this.stats = {
            attacks: [0, 0],
            hits: [0, 0],
            dodges: [0, 0],
            damage: [0, 0],
            feints: [0, 0],
            feintsRead: [0, 0],
            feintBaits: [0, 0],
            timeInState: [{}, {}],
            stateTransitions: [],
            engagementHistory: [],
            lastEngagement: 0,
            stalemateTicks: 0,
        };
        this.lastAiStates = [null, null];
        this.lastPositions = [null, null];
        console.log(`\n${'='.repeat(60)}`);
        console.log(`FIGHT START: ${bug1Name} vs ${bug2Name}`);
        console.log(`${'='.repeat(60)}`);
    }

    logAttack(attackerIdx: number, attackerName: string, targetName: string, hit: boolean, damage: number, dodged: boolean, details: { crit?: boolean; momentum?: number; dodgeType?: string } = {}): void {
        this.stats.attacks[attackerIdx]!++;
        this.stats.lastEngagement = 0;
        this.stats.stalemateTicks = 0;

        if (hit) {
            this.stats.hits[attackerIdx]!++;
            this.stats.damage[attackerIdx]! += damage;
            console.log(`  ⚔️  ${attackerName} HITS ${targetName} for ${damage} damage${details.crit ? ' (CRIT!)' : ''}${details.momentum ? ` [momentum: ${details.momentum.toFixed(2)}]` : ''}`);
        } else if (dodged) {
            this.stats.dodges[1 - attackerIdx]!++;
            console.log(`  💨 ${targetName} DODGES ${attackerName}'s attack${details.dodgeType ? ` (${details.dodgeType})` : ''}`);
        } else {
            console.log(`  ❌ ${attackerName} MISSES ${targetName}`);
        }
    }

    logFeint(attackerIdx: number, attackerName: string, targetName: string, result: string): void {
        this.stats.feints[attackerIdx]!++;
        if (result === 'read') {
            this.stats.feintsRead[attackerIdx]!++;
            console.log(`  🎭 ${attackerName} FEINTS at ${targetName} — read!`);
        } else if (result === 'dodge-bait') {
            this.stats.feintBaits[attackerIdx]!++;
            console.log(`  🎭 ${attackerName} FEINTS → ${targetName} baited into dodge!`);
        } else if (result === 'flinch') {
            this.stats.feintBaits[attackerIdx]!++;
            console.log(`  🎭 ${attackerName} FEINTS → ${targetName} flinches!`);
        }
    }

    logAiStateChange(fighterIdx: number, fighterName: string, oldState: AIState | null, newState: AIState, reason: string = ''): void {
        if (oldState === newState) return;

        const transition: StateTransition = {
            time: Date.now() - this.fightStart,
            fighter: fighterIdx,
            from: oldState,
            to: newState,
            reason
        };
        this.stats.stateTransitions.push(transition);

        const emojiMap: Record<AIState, string> = {
            'aggressive': '🔥',
            'retreating': '🏃',
            'circling': '🔄',
            'stunned': '💫',
        };
        const emoji = emojiMap[newState] || '❓';

        console.log(`  ${emoji} ${fighterName}: ${oldState} → ${newState}${reason ? ` (${reason})` : ''}`);
    }

    logMobilityChange(fighterName: string, change: string, details: string = ''): void {
        const emojiMap: Record<string, string> = {
            'takeoff': '🦋',
            'landing': '🛬',
            'wallMount': '🧗',
            'wallDismount': '⬇️',
            'jump': '⬆️',
            'grounded': '🦶',
            'exhausted': '😮‍💨',
        };
        const emoji = emojiMap[change] || '•';

        console.log(`  ${emoji} ${fighterName} ${change}${details ? `: ${details}` : ''}`);
    }

    trackTick(fighters: Fighter[], tick: number): void {
        if (!this.enabled) return;

        const f1 = fighters[0]!;
        const f2 = fighters[1]!;

        // Track time in AI states
        fighters.forEach((f, idx) => {
            const stateRecord = this.stats.timeInState[idx]!;
            if (!stateRecord[f.aiState]) {
                stateRecord[f.aiState] = 0;
            }
            stateRecord[f.aiState]!++;

            // Detect AI state changes
            const lastState = this.lastAiStates[idx] as AIState | null;
            if (lastState !== null && lastState !== f.aiState) {
                this.logAiStateChange(idx, f.name, lastState, f.aiState);
            }
            this.lastAiStates[idx] = f.aiState;
        });

        // Track engagement distance
        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const dz = f2.z - f1.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        this.stats.lastEngagement++;

        // Stalemate detection - far apart and no engagement
        const attackRange = (f1.spriteSize + f2.spriteSize) / 2 + 35;
        if (dist > attackRange * 2.5) {
            this.stats.stalemateTicks++;
        } else {
            this.stats.stalemateTicks = Math.max(0, this.stats.stalemateTicks - 2);
        }

        // Log stalemate warning
        if (this.stats.stalemateTicks === 300) {  // 10 seconds at distance
            console.log(`  ⚠️  STALEMATE WARNING: Bugs distant for 10s (dist: ${dist.toFixed(0)}, range: ${attackRange.toFixed(0)})`);
            this.logFighterStates(fighters);
        }
        if (this.stats.stalemateTicks === 600) {  // 20 seconds
            console.log(`  🚨 EXTENDED STALEMATE: 20s without engagement`);
            this.logDetailedDiagnosis(fighters);
        }
        if (this.stats.stalemateTicks > 0 && this.stats.stalemateTicks % 900 === 0) {  // Every 30s
            console.log(`  🚨 STALEMATE CONTINUES: ${(this.stats.stalemateTicks / 30).toFixed(0)}s`);
            this.logDetailedDiagnosis(fighters);
        }

        // Periodic summary
        const now = Date.now();
        if (now - this.lastSummaryTime > this.summaryInterval) {
            this.logPeriodicSummary(fighters, dist);
            this.lastSummaryTime = now;
        }
    }

    logFighterStates(fighters: Fighter[]): void {
        fighters.forEach((f, _idx) => {
            const staminaPct = (f.stamina / f.maxStamina * 100).toFixed(0);
            const hpPct = (f.hp / f.maxHp * 100).toFixed(0);
            const pos = `(${f.x.toFixed(0)}, ${f.y.toFixed(0)}, ${f.z.toFixed(0)})`;
            const mobility = f.isFlying ? (f.grounded ? 'landed' : 'flying') :
                            f.onWall ? `wall:${f.wallSide}` :
                            f.grounded ? 'ground' : 'air';
            console.log(`     ${f.name}: HP ${hpPct}% | Stam ${staminaPct}% | ${f.aiState} | ${mobility} @ ${pos}`);
        });
    }

    logDetailedDiagnosis(fighters: Fighter[]): void {
        console.log(`\n  📊 STALEMATE DIAGNOSIS:`);
        fighters.forEach((f, idx) => {
            const staminaPct = (f.stamina / f.maxStamina * 100).toFixed(0);
            const hpPct = (f.hp / f.maxHp * 100).toFixed(0);
            const aggression = (f.drives.aggression * 100).toFixed(0);
            const caution = (f.drives.caution * 100).toFixed(0);
            const vel = Math.sqrt(f.vx*f.vx + f.vy*f.vy + f.vz*f.vz).toFixed(1);

            console.log(`     ${f.name}:`);
            console.log(`       HP: ${f.hp}/${f.maxHp} (${hpPct}%) | Stamina: ${f.stamina.toFixed(0)}/${f.maxStamina} (${staminaPct}%)`);
            console.log(`       AI: ${f.aiState} | Drives: agg=${aggression}% caut=${caution}%`);
            console.log(`       Mobility: ${f.isFlying ? 'flyer' : f.isWallcrawler ? 'crawler' : 'ground'} | Grounded: ${f.grounded} | OnWall: ${f.onWall}`);
            console.log(`       Pos: (${f.x.toFixed(0)}, ${f.y.toFixed(0)}, ${f.z.toFixed(0)}) | Vel: ${vel} | Stunned: ${f.stunTimer}`);

            // Time in states
            const stateTime = this.stats.timeInState[idx]!;
            const totalTicks = Object.values(stateTime).reduce((a: number, b: number) => a + b, 0);
            const stateStr = Object.entries(stateTime)
                .map(([state, ticks]) => `${state}:${(ticks/totalTicks*100).toFixed(0)}%`)
                .join(' ');
            console.log(`       State time: ${stateStr}`);
        });

        // Why aren't they engaging?
        const f1 = fighters[0]!, f2 = fighters[1]!;
        const dx = f2.x - f1.x, dy = f2.y - f1.y, dz = f2.z - f1.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const attackRange = (f1.spriteSize + f2.spriteSize) / 2 + 35;

        console.log(`     Distance: ${dist.toFixed(0)} (attack range: ${attackRange.toFixed(0)})`);

        // Check for common stalemate causes
        const issues: string[] = [];
        if (f1.aiState === 'retreating' && f2.aiState === 'retreating') {
            issues.push('Both bugs retreating');
        }
        if (f1.aiState === 'circling' && f2.aiState === 'circling') {
            issues.push('Both bugs circling');
        }
        if (f1.stamina < f1.maxStamina * 0.2 || f2.stamina < f2.maxStamina * 0.2) {
            issues.push('Low stamina causing passive play');
        }
        if (f1.drives.caution > 0.7 && f2.drives.caution > 0.7) {
            issues.push('Both bugs very cautious');
        }
        if ((f1.isFlying && !f1.grounded) && (f2.isWallcrawler || f2.isGround)) {
            issues.push('Flyer staying airborne vs grounded opponent');
        }
        if ((f2.isFlying && !f2.grounded) && (f1.isWallcrawler || f1.isGround)) {
            issues.push('Flyer staying airborne vs grounded opponent');
        }

        if (issues.length > 0) {
            console.log(`     ⚡ Likely causes: ${issues.join('; ')}`);
        }
        console.log('');
    }

    logPeriodicSummary(fighters: Fighter[], dist: number): void {
        const elapsed = ((Date.now() - this.fightStart) / 1000).toFixed(0);
        const f1 = fighters[0]!, f2 = fighters[1]!;

        console.log(`\n  📈 [${elapsed}s] ${f1.name} vs ${f2.name} | Dist: ${dist.toFixed(0)}`);
        console.log(`     ${f1.name}: HP ${f1.hp}/${f1.maxHp} | Atk ${this.stats.attacks[0]} (${this.stats.hits[0]} hits, ${this.stats.damage[0]} dmg)`);
        console.log(`     ${f2.name}: HP ${f2.hp}/${f2.maxHp} | Atk ${this.stats.attacks[1]} (${this.stats.hits[1]} hits, ${this.stats.damage[1]} dmg)`);
    }

    logFightEnd(winner: number | null, fighters: Fighter[]): void {
        const elapsed = ((Date.now() - this.fightStart) / 1000).toFixed(1);
        const f1 = fighters[0]!, f2 = fighters[1]!;

        console.log(`\n${'='.repeat(60)}`);
        if (winner === 0) {
            console.log(`DRAW after ${elapsed}s`);
        } else {
            const winnerName = winner === 1 ? f1.name : f2.name;
            const loserName = winner === 1 ? f2.name : f1.name;
            console.log(`WINNER: ${winnerName} defeats ${loserName} in ${elapsed}s`);
        }

        console.log(`\nFinal Stats:`);
        console.log(`  ${f1.name}: ${this.stats.attacks[0]} attacks, ${this.stats.hits[0]} hits (${this.stats.attacks[0]! > 0 ? (this.stats.hits[0]!/this.stats.attacks[0]!*100).toFixed(0) : 0}%), ${this.stats.damage[0]} total damage, ${this.stats.feints[0]} feints (${this.stats.feintBaits[0]} baited)`);
        console.log(`  ${f2.name}: ${this.stats.attacks[1]} attacks, ${this.stats.hits[1]} hits (${this.stats.attacks[1]! > 0 ? (this.stats.hits[1]!/this.stats.attacks[1]!*100).toFixed(0) : 0}%), ${this.stats.damage[1]} total damage, ${this.stats.feints[1]} feints (${this.stats.feintBaits[1]} baited)`);
        console.log(`${'='.repeat(60)}\n`);
    }
}

// Global logger instance
const fightLogger: FightLogger = new FightLogger();

// ============================================
// FIGHTER CLASS (Server - No Rendering)
// ============================================

class Fighter {
    genome: BugGenome;
    name: string;
    side: FighterSide;
    isFlying: boolean;
    isWallcrawler: boolean;
    isGround: boolean;
    x!: number;
    y!: number;
    z!: number;
    facingRight: boolean;
    facingAngle: number;
    maxHp: number;
    hp: number;
    poisoned: number;
    attackCooldown: number;
    state: AnimationState;
    animFrame: number;
    animTick: number;
    stateTimer: number;
    victoryBounce: number;
    deathRotation: number;
    deathAlpha: number;
    vx: number;
    vy: number;
    vz: number;
    mass: number;
    grounded: boolean;
    gravity: number;
    friction: number;
    airFriction: number;
    jumpPower: number;
    jumpCooldown: number;
    aiState: AIState;
    aiStateTimer: number;
    stunTimer: number;
    moveTimer: number;
    circleAngle: number;
    stuckTimer: number;
    noEngagementTimer: number;
    onWall: boolean;
    wallSide: WallSide | null;
    wallExhausted: boolean;
    isDiving: boolean;
    feintCooldown: number;
    feintSuccess: boolean;
    drives: FullDriveState;
    maxStamina: number;
    stamina: number;
    staminaRegen: number;
    squash: number;
    stretch: number;
    lungeX: number;
    lungeY: number;
    flashTimer: number;
    isKnockedBack: boolean;
    knockbackVelocity: number;
    wallStunTimer: number;
    sizeMultiplier: number;
    spriteSize: number;
    lastWallImpact: { velocity: number; wallSide: WallSide; stunApplied: number } | null;

    constructor(genome: BugGenome, side: FighterSide, name: string) {
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
        this.facingAngle = side === 'left' ? Math.PI / 2 : -Math.PI / 2;

        // Combat stats
        this.maxHp = 150 + Math.floor(genome.bulk * 5);
        this.hp = this.maxHp;
        this.poisoned = 0;
        this.attackCooldown = 35 + Math.random() * 25;

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
        this.vz = 0;
        this.mass = 0.5 + (genome.bulk / 100) * 1.5;
        this.grounded = !this.isFlying;
        this.gravity = this.isFlying ? 0.05 : 0.6;
        this.friction = 0.75;
        this.airFriction = 0.88;

        // Jump
        this.jumpPower = this.calculateJumpPower();
        this.jumpCooldown = 0;

        // AI
        this.aiState = 'aggressive';
        this.aiStateTimer = 0;
        this.stunTimer = 0;
        this.moveTimer = 0;
        this.circleAngle = side === 'left' ? 0 : Math.PI;
        this.stuckTimer = 0;
        this.noEngagementTimer = 0;

        // Wall climbing
        this.onWall = false;
        this.wallSide = null;
        this.wallExhausted = false;
        this.isDiving = false;

        // Feint system
        this.feintCooldown = 0;
        this.feintSuccess = false;

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

        // Visual state
        this.squash = 1;
        this.stretch = 1;
        this.lungeX = 0;
        this.lungeY = 0;
        this.flashTimer = 0;

        // Knockback tracking
        this.isKnockedBack = false;
        this.knockbackVelocity = 0;
        this.wallStunTimer = 0;

        // Size multiplier for bounds
        this.sizeMultiplier = genome.getSizeMultiplier();
        this.spriteSize = Math.round(32 * this.sizeMultiplier);
        this.spriteSize = Math.max(20, Math.min(48, this.spriteSize));

        // Wall impact (assigned later by applyWallStun)
        this.lastWallImpact = null;
    }

    calculateJumpPower(): number {
        const legStyle = this.genome.legStyle;
        const baseJump = 8 + (this.genome.speed / 20);
        switch (legStyle) {
            case 'grasshopper':
                return baseJump * 1.5;
            case 'mantis':
                return baseJump * 1.2;
            case 'centipede':
                return baseJump * 0.7;
            case 'beetle':
                return baseJump * 0.85;
            default:
                return baseJump;
        }
    }

    initializePosition(): void {
        this.z = 0;

        if (this.isGround) {
            this.x = this.side === 'left' ? -250 : 250;
            this.y = ARENA.minY + 20;
        } else if (this.isFlying) {
            this.x = this.side === 'left' ? -250 : 250;
            this.y = 220 + Math.random() * 150;
            this.z = (Math.random() - 0.5) * 50;
        } else if (this.isWallcrawler) {
            this.x = this.side === 'left' ? -300 : 300;
            this.y = ARENA.minY + 20;
        }
    }

    get isAlive(): boolean {
        return this.hp > 0;
    }

    getPowerRating(): number {
        const g = this.genome;
        let rating = g.bulk + g.speed + g.fury + g.instinct;
        if (g.weapon === 'horn') rating += 10;
        if (g.weapon === 'stinger') rating += 8;
        if (g.defense === 'shell') rating += 10;
        if (g.mobility === 'winged') rating += 15;
        if (g.mobility === 'wallcrawler') rating += 10;
        return rating;
    }

    setState(newState: AnimationState): void {
        if (this.state !== newState) {
            this.state = newState;
            this.animFrame = 0;
            this.stateTimer = 0;
        }
    }

    getAttackStaminaCost(): number {
        switch (this.genome.weapon) {
            case 'mandibles': return 15;
            case 'stinger': return 10;
            case 'fangs': return 10;
            case 'pincers': return 12;
            case 'horn': return 8;
            default: return 10;
        }
    }

    spendStamina(amount: number): boolean {
        if (this.stamina >= amount) {
            this.stamina -= amount;
            return true;
        }
        return false;
    }

    hasStamina(amount: number): boolean {
        return this.stamina >= amount;
    }

    onHitLanded(damage: number): void {
        this.drives.aggression = Math.min(1, this.drives.aggression + this.drives.adaptRate * 2);
        this.drives.caution = Math.max(0, this.drives.caution - this.drives.adaptRate);
        this.noEngagementTimer = 0;
    }

    onDamageTaken(damage: number): void {
        const furyNorm = this.genome.fury / 100;
        if (furyNorm > 0.5) {
            this.drives.aggression = Math.min(1, this.drives.aggression + this.drives.adaptRate * furyNorm * 3);
        } else {
            this.drives.caution = Math.min(1, this.drives.caution + this.drives.adaptRate * (1 - furyNorm) * 3);
            this.drives.aggression = Math.max(0, this.drives.aggression - this.drives.adaptRate);
        }
        this.noEngagementTimer = 0;
    }

    onAttackAttempted(): void {
        this.noEngagementTimer = 0;
    }

    updateDrives(): void {
        const furyNorm = this.genome.fury / 100;
        const baseAggression = 0.3 + furyNorm * 0.4;
        const baseCaution = 0.3 + (1 - furyNorm) * 0.4;

        this.drives.aggression += (baseAggression - this.drives.aggression) * 0.001;
        this.drives.caution += (baseCaution - this.drives.caution) * 0.001;

        const staminaPercent = this.stamina / this.maxStamina;
        if (staminaPercent < 0.3) {
            const exhaustionFactor = (0.3 - staminaPercent) * 2;
            this.drives.caution = Math.min(1, this.drives.caution + exhaustionFactor * 0.02);
            this.drives.aggression = Math.max(0.15, this.drives.aggression - exhaustionFactor * 0.02);
        }

        this.drives.aggression = Math.max(0.15, this.drives.aggression);
        this.drives.caution = Math.min(0.85, this.drives.caution);

        this.noEngagementTimer++;
        if (this.noEngagementTimer > 240) {
            const stalematePressure = (this.noEngagementTimer - 240) / 240;
            this.drives.aggression = Math.min(1, this.drives.aggression + stalematePressure * 0.012);
            this.drives.caution = Math.max(0, this.drives.caution - stalematePressure * 0.012);

            if (this.noEngagementTimer > 450 && this.aiState !== 'aggressive' && this.aiState !== 'stunned') {
                this.aiState = 'aggressive';
                this.aiStateTimer = 0;
            }
        }

        if (this.isFlying && !this.grounded) {
            const flightCost = 0.25;
            this.stamina = Math.max(0, this.stamina - flightCost);

            if (this.stamina < this.maxStamina * 0.1) {
                this.grounded = true;
                this.gravity = 0.4;
            }
        }

        if (this.isFlying && this.grounded && this.stamina > this.maxStamina * 0.5) {
            this.grounded = false;
            this.gravity = 0.05;
        }

        if (this.isWallcrawler && this.onWall) {
            const climbCost = 0.25;
            this.stamina = Math.max(0, this.stamina - climbCost);

            if (this.stamina < this.maxStamina * 0.1) {
                this.onWall = false;
                this.wallExhausted = true;
            }
        }

        if (this.isWallcrawler && this.wallExhausted && this.stamina > this.maxStamina * 0.5) {
            this.wallExhausted = false;
        }

        let regenMultiplier = this.aiState === 'circling' || this.aiState === 'retreating' ? 1.5 : 1.0;
        if (this.isFlying && this.grounded) {
            regenMultiplier = 2.0;
        }
        if (this.isFlying && !this.grounded) {
            regenMultiplier = 0;
        }
        if (this.isWallcrawler && this.onWall) {
            regenMultiplier = 0;
        }
        if (this.isWallcrawler && !this.onWall && this.grounded) {
            regenMultiplier = 1.8;
        }
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * regenMultiplier);
    }

    updateState(): void {
        this.stateTimer++;
        this.animTick++;

        const frameCount: Record<string, number> = { idle: 4, attack: 4, feint: 2, hit: 2, death: 4, victory: 4 };
        const frameDelay = this.state === 'feint' ? 4 : this.state === 'idle' ? 8 : 5;

        if (this.animTick >= frameDelay) {
            this.animTick = 0;
            this.animFrame++;
            const maxFrames = frameCount[this.state] || 4;
            if (this.animFrame >= maxFrames) {
                if (this.state === 'death') {
                    this.animFrame = maxFrames - 1;
                } else if (this.state === 'attack' || this.state === 'feint') {
                    this.setState('idle');
                } else if (this.state === 'hit') {
                    this.isAlive ? this.setState('idle') : this.setState('death');
                } else {
                    this.animFrame = 0;
                }
            }
        }

        if (this.state === 'victory') {
            this.victoryBounce = Math.sin(this.stateTimer / 8) * 10;
        } else {
            this.victoryBounce = 0;
        }

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

    updatePhysics(): void {
        const isDead = this.state === 'death';
        if (!this.isAlive && !isDead) return;

        const halfSize = this.spriteSize / 2;
        const floorLevel = ARENA.minY + halfSize;

        if (isDead && this.y <= floorLevel + 1) {
            this.y = floorLevel;
            this.grounded = true;
            return;
        }

        if (isDead && this.onWall) {
            const side = this.wallSide;
            this.onWall = false;
            this.wallSide = null;
            this.grounded = false;
            this.gravity = 0.6;
            if (side === 'left') this.vx = 2;
            else if (side === 'right') this.vx = -2;
            else if (side === 'front') this.vz = -2;
            else if (side === 'back') this.vz = 2;
        }

        if (isDead && this.isFlying) {
            this.gravity = 0.6;
            this.grounded = false;
        }

        if (isDead && this.isWallcrawler && !this.onWall && !this.grounded) {
            this.gravity = 0.6;
        }

        const bounceFactor = isDead ? 0.15 : 0.3;

        if (!this.onWall) {
            this.vy -= this.gravity;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;

        // Floor
        if (this.y <= floorLevel) {
            this.y = floorLevel;
            if (this.isFlying && !isDead) {
                this.vy = Math.abs(this.vy) * bounceFactor;
            } else {
                if (isDead && Math.abs(this.vy) > 2) {
                    this.vy = Math.abs(this.vy) * bounceFactor;
                } else {
                    this.vy = 0;
                    this.grounded = true;
                }
                if (this.onWall) this.onWall = false;
            }
        } else if (!this.onWall && !this.isFlying) {
            this.grounded = false;
        }

        // Ceiling
        const ceilingLevel = ARENA.maxY - halfSize;
        if (this.y > ceilingLevel) {
            this.y = ceilingLevel;
            this.vy = -Math.abs(this.vy) * bounceFactor;
        }

        // Left wall
        const leftLimit = ARENA.minX + halfSize;
        if (this.x < leftLimit) {
            const impactVelocity = Math.abs(this.vx);
            this.x = leftLimit;

            if (this.isWallcrawler && !this.onWall && this.grounded && !this.wallExhausted) {
                this.onWall = true;
                this.wallSide = 'left';
                this.vx = 0;
            } else {
                if (this.isKnockedBack && impactVelocity > 4) {
                    this.applyWallStun(impactVelocity, 'left');
                }
                this.vx = Math.abs(this.vx) * bounceFactor;
            }
        }

        // Right wall
        const rightLimit = ARENA.maxX - halfSize;
        if (this.x > rightLimit) {
            const impactVelocity = Math.abs(this.vx);
            this.x = rightLimit;

            if (this.isWallcrawler && !this.onWall && this.grounded && !this.wallExhausted) {
                this.onWall = true;
                this.wallSide = 'right';
                this.vx = 0;
            } else {
                if (this.isKnockedBack && impactVelocity > 4) {
                    this.applyWallStun(impactVelocity, 'right');
                }
                this.vx = -Math.abs(this.vx) * bounceFactor;
            }
        }

        // Front wall
        const frontLimit = ARENA.maxZ - halfSize;
        if (this.z > frontLimit) {
            const impactVelocity = Math.abs(this.vz);
            this.z = frontLimit;

            if (this.isWallcrawler && !this.onWall && this.grounded && !this.wallExhausted) {
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

        // Back wall
        const backLimit = ARENA.minZ + halfSize;
        if (this.z < backLimit) {
            const impactVelocity = Math.abs(this.vz);
            this.z = backLimit;

            if (this.isWallcrawler && !this.onWall && this.grounded && !this.wallExhausted) {
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
        this.vz *= frictionFactor;
        if (this.isFlying) {
            this.vy *= this.airFriction;
        }

        if (this.jumpCooldown > 0) this.jumpCooldown--;
        if (this.stunTimer > 0) this.stunTimer--;
        if (this.wallStunTimer > 0) this.wallStunTimer--;
        if (this.feintCooldown > 0) this.feintCooldown--;

        // Knockback decay
        if (this.isKnockedBack) {
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
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

    jump(power: number = 1.0): boolean {
        if (this.jumpCooldown > 0) return false;
        if (!this.grounded && !this.onWall && !this.isFlying) return false;

        const jumpStaminaCost = Math.floor(5 * power);
        if (!this.spendStamina(jumpStaminaCost)) return false;

        const jumpForce = this.jumpPower * power;

        if (this.onWall) {
            this.vy = jumpForce * 0.8;
            if (this.wallSide === 'left') this.vx = 6;
            else if (this.wallSide === 'right') this.vx = -6;
            else if (this.wallSide === 'front') this.vz = -6;
            else if (this.wallSide === 'back') this.vz = 6;
            this.onWall = false;
            this.grounded = false;
        } else {
            this.vy = jumpForce;
            this.grounded = false;
        }

        this.jumpCooldown = 20;
        this.squash = 0.7;
        this.stretch = 1.3;
        return true;
    }

    applyWallStun(impactVelocity: number, wallSide: WallSide): void {
        let wallStun = Math.floor(impactVelocity * 3);

        if (this.isWallcrawler) {
            wallStun = Math.floor(wallStun * 0.3);
        }

        if (this.genome.defense === 'shell') {
            wallStun = Math.floor(wallStun * 0.7);
        }

        if (this.isFlying) {
            wallStun = Math.floor(wallStun * 1.3);
        }

        this.wallStunTimer = wallStun;
        this.stunTimer = Math.max(this.stunTimer, wallStun);

        this.squash = 1.4;
        this.stretch = 0.6;
        this.flashTimer = 3;

        this.lastWallImpact = {
            velocity: impactVelocity,
            wallSide: wallSide,
            stunApplied: wallStun,
        };
    }

    getWallProximity(): number {
        const arenaCenter = (ARENA.minX + ARENA.maxX) / 2;
        const arenaHalfWidth = (ARENA.maxX - ARENA.minX) / 2;
        const distFromCenter = Math.abs(this.x - arenaCenter);
        return distFromCenter / arenaHalfWidth;
    }

    getNearestWallSide(): 'left' | 'right' {
        const arenaCenter = (ARENA.minX + ARENA.maxX) / 2;
        return this.x < arenaCenter ? 'left' : 'right';
    }

    getDistanceToWall(side: 'left' | 'right'): number {
        if (side === 'left') {
            return this.x - ARENA.minX;
        } else {
            return ARENA.maxX - this.x;
        }
    }

    isCornered(threshold: number = 100): boolean {
        const leftDist = this.x - ARENA.minX;
        const rightDist = ARENA.maxX - this.x;
        return Math.min(leftDist, rightDist) < threshold;
    }

    getEscapeDirection(): number {
        const arenaCenter = (ARENA.minX + ARENA.maxX) / 2;
        return this.x < arenaCenter ? 1 : -1;
    }

    updateAI(opponent: Fighter): void {
        if (!this.isAlive || this.state === 'death') return;
        if (this.state === 'windup' || this.state === 'attack' || this.state === 'feint') return;

        this.moveTimer++;
        this.aiStateTimer++;

        const dx = opponent.x - this.x;
        const dy = opponent.y - this.y;
        const dz = opponent.z - this.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const _distXZ = Math.sqrt(dx * dx + dz * dz);
        const attackRange = (this.spriteSize + opponent.spriteSize) / 2 + 35;

        if (this.state === 'idle' && !this.onWall) {
            this.facingRight = dx > 0;
        }

        const targetFacingAngle = Math.atan2(dx, dz);

        const instinctFactor = this.genome.instinct / 100;
        const turnSpeed = 0.1 + instinctFactor * 0.15;

        let angleDiff = targetFacingAngle - this.facingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (this.state !== 'hit' && this.stunTimer <= 0) {
            this.facingAngle += angleDiff * turnSpeed;
        }

        this.facingRight = Math.sin(this.facingAngle) > 0;

        if (instinctFactor > 0.5 && (this.state as AnimationState) !== 'attack' && this.state !== 'hit') {
            const shouldFaceRight = dx > 0;
            if (this.facingRight !== shouldFaceRight) {
                if (Math.random() < instinctFactor * 0.3) {
                    this.facingRight = shouldFaceRight;
                }
            }
        }

        if (instinctFactor > 0.6 && this.grounded && !this.onWall) {
            const myFacing = this.facingRight ? 1 : -1;
            const opponentDir = Math.sign(opponent.x - this.x);
            const beingFlanked = opponentDir !== 0 && opponentDir !== myFacing;
            const beingFlankedZ = Math.abs(dz) > Math.abs(dx) * 1.5;

            if (beingFlanked || beingFlankedZ) {
                const adjustStrength = instinctFactor * 0.08;
                if (beingFlankedZ) {
                    this.vz -= Math.sign(dz) * adjustStrength;
                }
                if (beingFlanked) {
                    this.vx -= opponentDir * adjustStrength * 0.5;
                }
            }
        }

        if (this.stunTimer > 0) {
            this.aiState = 'stunned';
            return;
        }

        if (this.aiState === 'stunned') {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }

        this.updateAIStateTransitions(opponent, dist, attackRange);

        switch (this.aiState as AIState) {
            case 'aggressive':
                this.executeAggressiveAI(opponent, dx, dy, dz, dist, attackRange);
                break;
            case 'circling':
                this.executeCirclingAI(opponent, dx, dy, dz, dist, attackRange);
                break;
            case 'retreating':
                this.executeRetreatingAI(opponent, dx, dy, dz, dist);
                break;
            case 'stunned':
                break;
        }

        if (this.isWallcrawler) {
            this.updateWallClimbing(opponent, dist);
        }

        // STUCK DETECTION
        const speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
        if (speed < 0.5 && this.grounded && !this.onWall) {
            this.stuckTimer++;

            if (this.stuckTimer > 45) {
                this.aiState = 'aggressive';
                this.aiStateTimer = 0;

                const forwardX = Math.sin(this.facingAngle);
                const forwardZ = Math.cos(this.facingAngle);
                const unstuckForce = 0.8;
                this.vx += forwardX * unstuckForce;
                this.vz += forwardZ * unstuckForce;

                this.stuckTimer = 30;
            }
        } else {
            this.stuckTimer = Math.max(0, this.stuckTimer - 2);
        }
    }

    updateAIStateTransitions(opponent: Fighter, dist: number, attackRange: number): void {
        const hpPercent = this.hp / this.maxHp;
        const { aggression, caution } = this.drives;
        const instinctFactor = this.genome.instinct / 100;

        const iAmCornered = this.isCornered(100);
        const wallProximity = this.getWallProximity();

        if (iAmCornered && instinctFactor > 0.4) {
            const escapeUrgency = wallProximity * instinctFactor;

            const pressured = dist < attackRange * 1.5;
            const desperate = hpPercent < 0.5;

            if ((pressured || desperate) && Math.random() < escapeUrgency * 0.15) {
                this.aiState = 'retreating';
                this.aiStateTimer = 0;
                return;
            }
        }

        const minStateTime = 12;
        const canTransition = this.aiStateTimer > minStateTime;

        if (hpPercent < 0.4 && caution > 0.5 && (this.isFlying || this.isWallcrawler) && Math.random() < caution * 0.08) {
            this.aiState = 'retreating';
            this.aiStateTimer = 0;
        } else if (canTransition && this.aiState !== 'aggressive' && dist < attackRange * 1.5 && Math.random() < aggression * 0.10) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        } else if (canTransition && this.aiState !== 'circling' && dist < attackRange * 2 && this.aiStateTimer > 40 && Math.random() < caution * 0.05) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
            this.circleAngle = Math.atan2(this.y - opponent.y, this.x - opponent.x);
        } else if (canTransition && dist > attackRange * 2 && this.aiStateTimer > Math.floor(60 - aggression * 40)) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeAggressiveAI(opponent: Fighter, dx: number, dy: number, dz: number, dist: number, attackRange: number): void {
        const baseSpeed = 0.30 + (this.genome.speed / 160);
        const staminaPercent = this.stamina / this.maxStamina;
        const staminaFactor = 0.7 + staminaPercent * 0.3;
        const speed = baseSpeed * (0.7 + this.drives.aggression * 0.5) * staminaFactor;
        const instinctFactor = this.genome.instinct / 100;

        const horizDist = Math.sqrt(dx * dx + dz * dz);
        const heightDiff = opponent.y - this.y;

        if (this.isFlying) {
            const hasHeightAdvantage = this.y > opponent.y + 40;
            const canDive = hasHeightAdvantage && horizDist < 200 && staminaPercent > 0.4;

            if (opponent.isFlying) {
                const targetHeight = opponent.y + 60 + (instinctFactor * 40);

                this.vx += Math.sign(dx) * speed * 0.8;
                this.vz += Math.sign(dz) * speed * 0.8;

                if (this.y < targetHeight) {
                    this.vy += 0.3;
                } else if (this.y > targetHeight + 50) {
                    this.vy -= 0.2;
                }

                if (dist < attackRange * 2 && instinctFactor > 0.3) {
                    const strafeDir = Math.sin(this.moveTimer / 15) * instinctFactor;
                    const perpX = -dz / (horizDist || 1);
                    const perpZ = dx / (horizDist || 1);
                    this.vx += perpX * strafeDir * speed * 1.0;
                    this.vz += perpZ * strafeDir * speed * 1.0;
                }

                this.vy += Math.sin(this.moveTimer / 8) * 0.08;
                this.vz += Math.cos(this.moveTimer / 10) * 0.05;

            } else if (canDive) {
                const diveAngle = Math.atan2(heightDiff, horizDist);
                const diveSpeed = speed * 2;

                this.vx += Math.sign(dx) * diveSpeed * Math.cos(diveAngle);
                this.vy -= 0.6;
                this.vz += Math.sign(dz) * diveSpeed * 0.5;

                this.isDiving = true;

            } else if (this.grounded) {
                this.vx += Math.sign(dx) * speed * 0.5;
                this.vz += Math.sign(dz) * speed * 0.4;
                this.isDiving = false;

                if (dist < attackRange * 1.2) {
                    this.vx -= Math.sign(dx) * speed * 0.3;
                    this.vz -= Math.sign(dz) * speed * 0.2;
                }

            } else if (staminaPercent < 0.25) {
                this.vx += Math.sign(dx) * speed * 0.3;
                this.vy -= 0.2;
                this.vz += Math.sign(dz) * speed * 0.3;
                this.isDiving = false;

            } else {
                const idealHeight = opponent.y + 100 + (instinctFactor * 50);
                const idealDist = 120 + (1 - this.drives.aggression) * 80;

                if (this.y < idealHeight) {
                    this.vy += 0.25;
                } else if (this.y > idealHeight + 30) {
                    this.vy -= 0.15;
                }

                const circlePhase = this.moveTimer / 40;
                const circleRadius = idealDist;
                const targetX = opponent.x + Math.cos(circlePhase) * circleRadius;
                const targetZ = opponent.z + Math.sin(circlePhase * 2) * circleRadius * 0.6;

                this.vx += (targetX - this.x) * 0.015;
                this.vz += (targetZ - this.z) * 0.015;

                this.vy += Math.sin(this.moveTimer / 20) * 0.1;

                this.isDiving = false;
            }

        } else if (this.onWall) {
            this.vy = Math.sign(dy) * speed * 2;

            if (horizDist < 150 && Math.abs(dy) < 60 && Math.random() < 0.02 + this.drives.aggression * 0.03) {
                this.jump(1.0);
                if (this.wallSide === 'left' || this.wallSide === 'right') {
                    this.vx = (this.wallSide === 'left' ? 1 : -1) * 6;
                    this.vz = Math.sign(dz) * 4;
                } else {
                    this.vz = (this.wallSide === 'back' ? 1 : -1) * 6;
                    this.vx = Math.sign(dx) * 4;
                }
            }

        } else {
            const forwardX = Math.sin(this.facingAngle);
            const forwardZ = Math.cos(this.facingAngle);

            this.vx += forwardX * speed * 0.9;
            this.vz += forwardZ * speed * 0.9;

            if (opponent.isFlying || opponent.onWall || opponent.y > this.y + 50) {
                if (this.grounded && horizDist < attackRange * 2.5 && Math.random() < 0.02 + this.drives.aggression * 0.04) {
                    this.jump(0.8);
                    this.vx += forwardX * 3;
                    this.vz += forwardZ * 2;
                }
            }
        }
    }

    executeCirclingAI(opponent: Fighter, dx: number, dy: number, dz: number, dist: number, attackRange: number): void {
        const speed = 0.22 + (this.genome.speed / 180);
        const circleRadius = 80 + this.drives.caution * 80;
        const instinctFactor = this.genome.instinct / 100;

        const circleSpeed = (this.side === 'left' ? 0.05 : -0.05) * (this.genome.speed / 50);
        this.circleAngle += circleSpeed;

        const verticalAngle = this.moveTimer / 20;

        const iAmCornered = this.isCornered(100);
        const wallAvoidance = iAmCornered ? this.getEscapeDirection() * instinctFactor * 0.8 : 0;

        if (this.isFlying && !this.grounded) {
            const orbitTilt = 0.4;
            const zRadius = circleRadius * 0.8;

            let targetX = opponent.x + Math.cos(this.circleAngle) * circleRadius;
            let targetZ = opponent.z + Math.sin(this.circleAngle) * zRadius;
            let targetY = opponent.y + 80 + Math.sin(this.circleAngle) * circleRadius * orbitTilt;

            targetY += Math.sin(verticalAngle) * 30;

            if (instinctFactor > 0.3) {
                const arenaCenter = (ARENA.minX + ARENA.maxX) / 2;
                const wallBias = (arenaCenter - targetX) * instinctFactor * 0.2;
                targetX += wallBias;
                targetZ = clamp(targetZ, ARENA.minZ + 80, ARENA.maxZ - 80);
            }

            targetY = clamp(targetY, ARENA.minY + 60, ARENA.maxY - 60);

            this.vx += (targetX - this.x) * 0.035;
            this.vy += (targetY - this.y) * 0.035;
            this.vz += (targetZ - this.z) * 0.035;

            if (!opponent.isFlying && this.y < opponent.y + 50) {
                this.vy += 0.4;
            }

            this.vz += Math.sin(this.moveTimer / 8) * 0.15;

        } else if (this.isFlying && this.grounded) {
            const effectiveRadius = circleRadius * (1 + Math.sin(verticalAngle) * 0.2);
            let targetX = opponent.x + Math.cos(this.circleAngle) * effectiveRadius;
            let targetZ = opponent.z + Math.sin(this.circleAngle) * effectiveRadius * 0.8;

            if (iAmCornered && instinctFactor > 0.3) {
                targetX += wallAvoidance * 50;
            }
            targetZ = clamp(targetZ, ARENA.minZ + 60, ARENA.maxZ - 60);

            this.vx += (targetX - this.x) * 0.04;
            this.vz += (targetZ - this.z) * 0.04;

        } else if (this.isWallcrawler && this.onWall) {
            const targetY = opponent.y + Math.sin(this.circleAngle * 2) * 50;
            this.vy = clamp((targetY - this.y) * 0.1, -speed * 3, speed * 3);

        } else {
            const forwardX = Math.sin(this.facingAngle);
            const forwardZ = Math.cos(this.facingAngle);
            const strafeX = Math.cos(this.facingAngle);
            const strafeZ = -Math.sin(this.facingAngle);

            const strafeDir = this.side === 'left' ? 1 : -1;
            this.vx += strafeX * strafeDir * speed * 0.5;
            this.vz += strafeZ * strafeDir * speed * 0.5;

            if (dist < circleRadius * 0.8) {
                this.vx -= forwardX * speed * 0.3;
                this.vz -= forwardZ * speed * 0.3;
            } else if (dist > circleRadius * 1.2) {
                this.vx += forwardX * speed * 0.3;
                this.vz += forwardZ * speed * 0.3;
            }

            if (iAmCornered && instinctFactor > 0.3) {
                this.vx += wallAvoidance * 0.3;
            }
        }

        const breakoutTime = Math.floor(45 - this.drives.aggression * 35);
        const minCircleTime = 15;
        const veryClose = dist < attackRange * 0.9 && this.drives.aggression > 0.5;
        if (this.aiStateTimer > minCircleTime && (this.aiStateTimer > breakoutTime || veryClose)) {
            this.aiState = 'aggressive';
            this.aiStateTimer = 0;
        }
    }

    executeRetreatingAI(opponent: Fighter, dx: number, dy: number, dz: number, dist: number): void {
        const speed = 0.24 + (this.genome.speed / 180);
        const instinctFactor = this.genome.instinct / 100;

        const iAmCornered = this.isCornered(100);
        const iAmCorneredZ = this.z > ARENA.maxZ - 80 || this.z < ARENA.minZ + 80;
        const escapeDir = this.getEscapeDirection();
        const escapeDirZ = this.z > 0 ? -1 : 1;

        const retreatDir = -Math.sign(dx) || (Math.random() > 0.5 ? 1 : -1);
        const retreatDirZ = -Math.sign(dz) || (Math.random() > 0.5 ? 1 : -1);

        if (this.isFlying) {
            const staminaPercent = this.stamina / this.maxStamina;

            if (this.grounded) {
                let retreatX = retreatDir;
                let retreatZ = retreatDirZ;

                if (iAmCornered) {
                    retreatX = escapeDir * 0.8 + retreatDir * 0.2;
                }
                if (iAmCorneredZ) {
                    retreatZ = escapeDirZ * 0.8 + retreatDirZ * 0.2;
                }

                this.vx += retreatX * speed * 1.2;
                this.vz += retreatZ * speed * 1.0;

            } else if (staminaPercent < 0.25) {
                this.vy -= 0.4;

                let retreatX = retreatDir;
                let retreatZ = retreatDirZ;

                if (iAmCornered) {
                    retreatX = escapeDir * 0.8 + retreatDir * 0.2;
                }
                if (iAmCorneredZ) {
                    retreatZ = escapeDirZ * 0.8 + retreatDirZ * 0.2;
                }

                this.vx += retreatX * speed * 1.2;
                this.vz += retreatZ * speed * 1.0;

            } else {
                this.vy += 0.7;

                let retreatX = retreatDir;
                let retreatZ = retreatDirZ;

                if (iAmCornered) {
                    retreatX = escapeDir * 0.8 + retreatDir * 0.2;
                }
                if (iAmCorneredZ) {
                    retreatZ = escapeDirZ * 0.8 + retreatDirZ * 0.2;
                }

                if (instinctFactor > 0.4) {
                    const evadePhase = this.moveTimer / 6;
                    retreatX += Math.sin(evadePhase) * instinctFactor * 0.5;
                    retreatZ += Math.cos(evadePhase) * instinctFactor * 0.5;
                }

                this.vx += retreatX * speed * 1.8;
                this.vz += retreatZ * speed * 1.5;

                if (this.y > ARENA.maxY - 80) {
                    this.vy -= 0.5;
                }

                if (opponent.isFlying && dist < 150 && Math.random() < 0.03) {
                    this.vy -= 1.5;
                    this.vz += (Math.random() > 0.5 ? 1 : -1) * speed * 3;
                }
            }

        } else if (this.isWallcrawler) {
            if (this.onWall) {
                this.vy = speed * 4;
            } else {
                const nearestWall = this.x < (ARENA.minX + ARENA.maxX) / 2 ? 'left' : 'right';
                this.vx += nearestWall === 'left' ? -speed * 3 : speed * 3;
                this.vz += retreatDirZ * speed * 0.5;
            }

        } else {
            const forwardX = Math.sin(this.facingAngle);
            const forwardZ = Math.cos(this.facingAngle);

            this.vx -= forwardX * speed * 1.0;
            this.vz -= forwardZ * speed * 1.0;

            const iAmCorneredLocal = this.isCornered(100);
            if (iAmCorneredLocal && instinctFactor > 0.3) {
                const escapeDirLocal = this.getEscapeDirection();
                this.vx += escapeDirLocal * speed * 0.8;
            }

            if (instinctFactor > 0.3) {
                const strafeX = Math.cos(this.facingAngle);
                const strafeZ = -Math.sin(this.facingAngle);
                const dodgeDir = Math.sin(this.moveTimer / 8) * instinctFactor;
                this.vx += strafeX * dodgeDir * speed * 0.5;
                this.vz += strafeZ * dodgeDir * speed * 0.5;
            }

            if (this.grounded && Math.random() < 0.03) {
                this.jump(0.4);
            }
        }

        const retreatDuration = Math.floor(40 + this.drives.caution * 40 - this.drives.aggression * 25);
        if (this.aiStateTimer > retreatDuration || dist > 260) {
            this.aiState = 'circling';
            this.aiStateTimer = 0;
        }
    }

    updateWallClimbing(opponent: Fighter, dist: number): void {
        const halfSize = this.spriteSize / 2;
        const staminaPercent = this.stamina / this.maxStamina;
        const arenaCenter = (ARENA.minX + ARENA.maxX) / 2;

        if (this.onWall) {
            if (this.wallSide === 'left') {
                this.x = ARENA.minX + halfSize;
                this.vx = 0;
            } else if (this.wallSide === 'right') {
                this.x = ARENA.maxX - halfSize;
                this.vx = 0;
            } else if (this.wallSide === 'front') {
                this.z = ARENA.maxZ - halfSize;
                this.vz = 0;
            } else if (this.wallSide === 'back') {
                this.z = ARENA.minZ + halfSize;
                this.vz = 0;
            }

            const minY = ARENA.minY + halfSize + 10;
            const maxY = ARENA.maxY - halfSize - 10;
            this.y = Math.max(minY, Math.min(maxY, this.y));

            this.grounded = true;

            const targetY = opponent.y + 30;
            const heightDiff = this.y - targetY;

            if (staminaPercent < 0.2) {
                this.vy = -4;
            } else if (staminaPercent < 0.35) {
                this.vy = -2;
            } else if (this.aiState === 'aggressive') {
                if (Math.abs(heightDiff) > 20) {
                    const climbSpeed = 4 + (this.genome.speed / 30);
                    this.vy = Math.sign(targetY - this.y) * climbSpeed;
                } else {
                    this.vy = Math.sin(this.moveTimer / 10) * 1;
                }
            } else if (this.aiState === 'retreating') {
                this.vy = 3.5;
            } else if (this.aiState === 'circling') {
                this.vy = Math.sin(this.moveTimer / 15) * 2.5;
            } else {
                this.vy = Math.sin(this.moveTimer / 20) * 2;
            }

            // Wall pounce
            const horizDist = Math.abs(opponent.x - this.x);
            const vertDist = Math.abs(opponent.y - this.y);
            const hasLineOfSight = vertDist < 80;

            if (horizDist < 250 && hasLineOfSight && staminaPercent > 0.3) {
                const heightAdvantage = this.y > opponent.y + 10;
                const pounceChance = 0.03 +
                    (this.drives.aggression * 0.1) +
                    (heightAdvantage ? 0.05 : 0) +
                    (horizDist < 150 ? 0.03 : 0);

                if (Math.random() < pounceChance) {
                    this.onWall = false;
                    this.grounded = false;

                    const jumpPower = 12 + (this.genome.speed / 8);
                    const dy = opponent.y - this.y;
                    const angle = Math.atan2(dy, Math.abs(this.wallSide === 'front' || this.wallSide === 'back' ? (opponent.z - this.z) : (opponent.x - this.x)));

                    if (this.wallSide === 'left' || this.wallSide === 'right') {
                        const pounceDir = this.wallSide === 'left' ? 1 : -1;
                        this.vx = pounceDir * jumpPower * Math.cos(angle);
                        this.vz = Math.sign(opponent.z - this.z) * 4;
                    } else {
                        const pounceDir = this.wallSide === 'back' ? 1 : -1;
                        this.vz = pounceDir * jumpPower * Math.cos(angle);
                        this.vx = Math.sign(opponent.x - this.x) * 4;
                    }
                    this.vy = 6 + Math.max(-4, dy / 40);

                    this.spendStamina(5);
                }
            }

            if (dist > 450 || (staminaPercent > 0.85 && this.aiState !== 'retreating' && this.drives.aggression > 0.5)) {
                this.onWall = false;
                this.grounded = false;
                if (this.wallSide === 'left') this.vx = 3;
                else if (this.wallSide === 'right') this.vx = -3;
                else if (this.wallSide === 'front') this.vz = -3;
                else if (this.wallSide === 'back') this.vz = 3;
            }
        } else {
            const nearLeftWall = this.x < ARENA.minX + 80;
            const nearRightWall = this.x > ARENA.maxX - 80;
            const nearFrontWall = this.z > ARENA.maxZ - 80;
            const nearBackWall = this.z < ARENA.minZ + 80;
            const nearAnyWall = nearLeftWall || nearRightWall || nearFrontWall || nearBackWall;

            const canClimb = !this.wallExhausted && staminaPercent > 0.5;

            if (nearAnyWall && this.grounded && canClimb) {
                const wantToClimb =
                    opponent.isFlying ||
                    opponent.y > this.y + 40 ||
                    (this.drives.caution > 0.6 && Math.random() < 0.15) ||
                    (dist < 120 && Math.random() < 0.12) ||
                    (this.aiState === 'retreating' && staminaPercent > 0.7);

                if (wantToClimb) {
                    this.onWall = true;
                    if (nearLeftWall) this.wallSide = 'left';
                    else if (nearRightWall) this.wallSide = 'right';
                    else if (nearFrontWall) this.wallSide = 'front';
                    else this.wallSide = 'back';
                    this.vy = 3;
                }
            }

            const shouldSeekWall = canClimb && (
                (opponent.isFlying && !this.onWall) ||
                (dist > 200 && opponent.y > this.y + 50)
            );

            if (shouldSeekWall) {
                const nearestWall = this.x < arenaCenter ? 'left' : 'right';
                const wallForce = 1.2 + (this.genome.speed / 80);
                this.vx += nearestWall === 'left' ? -wallForce : wallForce;
            }
        }
    }

    toState(): FighterState {
        return {
            x: Math.round(this.x * 10) / 10,
            y: Math.round(this.y * 10) / 10,
            z: Math.round(this.z * 10) / 10,
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
            facingAngle: Math.round(this.facingAngle * 100) / 100,
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
            spriteSize: this.spriteSize,
            victoryBounce: Math.round(this.victoryBounce * 10) / 10,
            deathRotation: Math.round(this.deathRotation * 100) / 100,
            deathAlpha: Math.round(this.deathAlpha * 100) / 100,
            isKnockedBack: this.isKnockedBack,
            wallStunTimer: this.wallStunTimer,
            isFlying: this.isFlying,
            isWallcrawler: this.isWallcrawler,
            isDiving: this.isDiving || false,
            stunTimer: this.stunTimer,
            stuckTimer: this.stuckTimer,
        };
    }
}

// ============================================
// GAME SIMULATION
// ============================================

class Simulation {
    phase: GamePhase;
    countdown: number;
    tick: number;
    fightNumber: number;
    roster: InstanceType<typeof RosterManager>;
    fighters: Fighter[];
    bugs: GenomeData[];
    bugNames: string[];
    bugIds: string[];
    bugRecords: BugRecord[];
    events: GameEvent[];
    winner: number | null;
    attackCooldowns: [number, number];
    victoryTimer: number;

    constructor() {
        this.phase = 'countdown';
        this.countdown = COUNTDOWN_SECONDS;
        this.tick = 0;
        this.fightNumber = 0;

        this.roster = new RosterManager();

        this.fighters = [];
        this.bugs = [];
        this.bugNames = [];
        this.bugIds = [];
        this.bugRecords = [];

        this.events = [];
        this.winner = null;

        this.attackCooldowns = [0, 0];
        this.victoryTimer = 0;

        this.setupNextFight();
    }

    setupNextFight(): void {
        this.fightNumber++;
        this.phase = 'countdown';
        this.countdown = COUNTDOWN_SECONDS;
        this.winner = null;

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

        this.attackCooldowns = [25 + Math.random() * 20, 25 + Math.random() * 20];

        fightLogger.reset(bug1.name, bug2.name);

        this.addEvent('commentary', `FIGHT #${this.fightNumber} - Place your bets!`, '#ff0');
    }

    calculateOdds(): Odds {
        const f0 = this.fighters[0]!;
        const f1 = this.fighters[1]!;
        const p1 = f0.getPowerRating();
        const p2 = f1.getPowerRating();
        const total = p1 + p2;

        const prob1 = p1 / total;
        const prob2 = p2 / total;

        const houseEdge = 0.05;
        const adjustedProb1 = prob1 + (houseEdge / 2);
        const adjustedProb2 = prob2 + (houseEdge / 2);

        const decimal1 = (1 / adjustedProb1).toFixed(2);
        const decimal2 = (1 / adjustedProb2).toFixed(2);

        const toAmerican = (prob: number): string | number => {
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

    addEvent(type: 'commentary', data: string, color: string): void;
    addEvent(type: 'hit', data: HitEventData, color?: null): void;
    addEvent(type: 'feint', data: FeintEventData, color?: null): void;
    addEvent(type: 'wallImpact', data: WallImpactEventData, color?: null): void;
    addEvent(type: 'fightEnd', data: FightEndEventData, color?: null): void;
    addEvent(type: string, data: unknown, color: string | null = null): void {
        this.events.push({ type, data, color, tick: this.tick } as GameEvent);
    }

    update(): void {
        this.tick++;
        this.events = [];

        if (this.phase === 'countdown') {
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
            this.victoryTimer--;
            if (this.victoryTimer <= 0) {
                this.setupNextFight();
            }
        }
    }

    startFight(): void {
        this.phase = 'fighting';
        this.addEvent('commentary', 'FIGHT!', '#f00');
    }

    resolveFighterCollision(f1: Fighter, f2: Fighter): void {
        if (!f1.isAlive || !f2.isAlive) return;

        const dx = f2.x - f1.x;
        const dy = f2.y - f1.y;
        const dz = f2.z - f1.z;

        const distXZ = Math.sqrt(dx * dx + dz * dz);

        const minDist = (f1.spriteSize + f2.spriteSize) / 2 * 1.0;

        if (distXZ < minDist) {
            if (distXZ < 1) {
                f1.x -= 10;
                f2.x += 10;
                return;
            }

            const overlap = minDist - distXZ;

            const nx = dx / distXZ;
            const nz = dz / distXZ;

            const totalMass = f1.mass + f2.mass;
            const f1Ratio = f2.mass / totalMass;
            const f2Ratio = f1.mass / totalMass;

            const separationForce = overlap * 0.5;
            f1.x -= nx * separationForce * f1Ratio;
            f1.z -= nz * separationForce * f1Ratio;
            f2.x += nx * separationForce * f2Ratio;
            f2.z += nz * separationForce * f2Ratio;

            const bounce = 0.4;
            f1.vx -= nx * bounce;
            f1.vz -= nz * bounce;
            f2.vx += nx * bounce;
            f2.vz += nz * bounce;
        }
    }

    checkWallImpact(fighter: Fighter): void {
        if (fighter.lastWallImpact) {
            const impact = fighter.lastWallImpact;

            this.addEvent('wallImpact', {
                x: fighter.x,
                y: fighter.y,
                name: fighter.name,
                velocity: impact.velocity,
                wallSide: impact.wallSide,
                stunApplied: impact.stunApplied,
            });

            if (impact.stunApplied >= 20) {
                this.addEvent('commentary', `${fighter.name} SLAMMED into the wall!`, '#f80');
            } else if (impact.stunApplied >= 10) {
                this.addEvent('commentary', `${fighter.name} crashes into the wall!`, '#fa0');
            }

            fighter.lastWallImpact = null;
        }
    }

    updateFight(): void {
        const f1 = this.fighters[0]!;
        const f2 = this.fighters[1]!;

        f1.updateState();
        f2.updateState();

        f1.updatePhysics();
        f2.updatePhysics();

        this.checkWallImpact(f1);
        this.checkWallImpact(f2);

        this.resolveFighterCollision(f1, f2);

        f1.updateDrives();
        f2.updateDrives();

        f1.updateAI(f2);
        f2.updateAI(f1);

        this.processCombat(f1, f2, 0);
        this.processCombat(f2, f1, 1);

        this.processPoison(f1);
        this.processPoison(f2);

        fightLogger.trackTick(this.fighters, this.tick);

        if (!f1.isAlive || !f2.isAlive) {
            this.endFight();
        }
    }

    executeFeint(attacker: Fighter, target: Fighter, attackerIndex: number, dx: number, dy: number, dz: number, dist: number): void {
        attacker.spendStamina(3);
        attacker.feintCooldown = 90 + Math.floor(Math.random() * 60);
        attacker.onAttackAttempted();

        attacker.setState('feint');
        const safeDist = dist || 1;
        const dirX = dx / safeDist;
        const dirY = dy / safeDist;
        attacker.lungeX = dirX * 15;
        attacker.lungeY = dirY * 8;
        attacker.squash = 0.85;
        attacker.stretch = 1.15;

        const baseCD = 48 - attacker.genome.speed / 5;

        if (target.stunTimer > 0 || target.state === 'hit' || target.state === 'death') {
            this.attackCooldowns[attackerIndex as 0 | 1] = baseCD * 0.7;
            fightLogger.logFeint(attackerIndex, attacker.name, target.name, 'wasted');
            return;
        }

        const targetInstinct = target.genome.instinct / 100;
        const readChance = 0.15 + targetInstinct * 0.55;

        if (Math.random() < readChance) {
            this.attackCooldowns[attackerIndex as 0 | 1] = baseCD + Math.random() * 15;
            attacker.feintSuccess = false;

            this.addEvent('commentary', `${target.name} reads the feint!`, '#0ff');
            this.addEvent('feint', {
                x: attacker.x, y: attacker.y,
                attacker: attacker.name, target: target.name,
                result: 'read',
            });
            fightLogger.logFeint(attackerIndex, attacker.name, target.name, 'read');

        } else {
            const dodgeReaction = Math.random() < 0.4 + targetInstinct * 0.2;

            if (dodgeReaction) {
                const dodgeStrength = 3 + targetInstinct * 3;
                const dirZ = dz / safeDist;
                const perpX = -dirZ;
                const perpZ = dirX;
                const side = Math.random() > 0.5 ? 1 : -1;
                target.vx += perpX * dodgeStrength * side;
                target.vz += perpZ * dodgeStrength * side;

                this.attackCooldowns[attackerIndex as 0 | 1] = Math.floor(baseCD * 0.3);
                attacker.feintSuccess = true;

                this.addEvent('commentary', `${target.name} baited into dodging!`, '#ff0');
                this.addEvent('feint', {
                    x: attacker.x, y: attacker.y,
                    attacker: attacker.name, target: target.name,
                    result: 'dodge-bait',
                });
                fightLogger.logFeint(attackerIndex, attacker.name, target.name, 'dodge-bait');

            } else {
                target.stunTimer = Math.max(target.stunTimer, 8);
                target.squash = 1.1;
                target.stretch = 0.9;

                this.attackCooldowns[attackerIndex as 0 | 1] = Math.floor(baseCD * 0.4);
                attacker.feintSuccess = true;

                this.addEvent('commentary', `${target.name} flinches!`, '#fa0');
                this.addEvent('feint', {
                    x: attacker.x, y: attacker.y,
                    attacker: attacker.name, target: target.name,
                    result: 'flinch',
                });
                fightLogger.logFeint(attackerIndex, attacker.name, target.name, 'flinch');
            }
        }
    }

    processCombat(attacker: Fighter, target: Fighter, attackerIndex: number): void {
        if (!attacker.isAlive || attacker.state !== 'idle') return;
        if (attacker.stunTimer > 0) return;

        this.attackCooldowns[attackerIndex as 0 | 1]--;

        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const dz = target.z - attacker.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const attackRange = (attacker.spriteSize + target.spriteSize) / 2 + 35;

        if (this.attackCooldowns[attackerIndex as 0 | 1]! <= 0 && dist < attackRange) {
            if (attacker.feintCooldown <= 0 && attacker.stamina > 5) {
                const instinct = attacker.genome.instinct / 100;
                const fury = attacker.genome.fury / 100;
                const caution = attacker.drives.caution;
                const feintChance = (instinct * 0.12 + caution * 0.06) * (1 - fury * 0.5) + 0.04;

                if (Math.random() < feintChance) {
                    this.executeFeint(attacker, target, attackerIndex, dx, dy, dz, dist);
                    return;
                }
            }

            const attackCost = attacker.getAttackStaminaCost();
            if (!attacker.spendStamina(attackCost)) {
                return;
            }

            attacker.setState('attack');
            attacker.onAttackAttempted();
            attacker.facingRight = dx > 0;

            const attackerSpeed = Math.sqrt(attacker.vx * attacker.vx + attacker.vy * attacker.vy + attacker.vz * attacker.vz);
            const attackerMomentum = Math.min(attackerSpeed / 8, 1);

            const safeDist = dist || 1;
            const dirX = dx / safeDist;
            const dirY = dy / safeDist;
            const dirZ = dz / safeDist;
            const lungeMult = 1 + attackerMomentum * 0.5;
            attacker.lungeX = dirX * 25 * lungeMult;
            attacker.lungeY = dirY * 15 * lungeMult;
            attacker.squash = 0.7;
            attacker.stretch = 1.3;

            const targetInstinct = target.genome.instinct / 100;
            let dodged = false;
            const dodgeDir = { x: 0, y: 0, z: 0 };

            if (target.stunTimer <= 0 && target.state !== 'hit') {
                const baseDodgeChance = targetInstinct * 0.6;
                const speedPenalty = attackerMomentum * 0.3;
                const camoBonus = target.genome.defense === 'camouflage' ? 0.12 : 0;
                const dodgeChance = Math.max(0.05, baseDodgeChance - speedPenalty + (target.isFlying ? 0.15 : 0) + camoBonus);

                if (Math.random() < dodgeChance) {
                    dodged = true;

                    const dodgeStrength = 4 + targetInstinct * 4;

                    if (targetInstinct > 0.5) {
                        dodgeDir.x = -dirZ * dodgeStrength;
                        dodgeDir.z = dirX * dodgeStrength;
                        if (Math.random() < 0.5) {
                            dodgeDir.x *= -1;
                            dodgeDir.z *= -1;
                        }
                    } else {
                        dodgeDir.x = -dirX * dodgeStrength * 0.7 + (Math.random() - 0.5) * 3;
                        dodgeDir.z = -dirZ * dodgeStrength * 0.7 + (Math.random() - 0.5) * 3;
                    }

                    if (target.isFlying && !target.grounded) {
                        dodgeDir.y = 2 + Math.random() * 3;
                    }

                    target.vx += dodgeDir.x;
                    target.vy += dodgeDir.y;
                    target.vz += dodgeDir.z;

                    if (targetInstinct > 0.4) {
                        target.facingRight = dx > 0;
                    }
                }
            }

            if (dodged) {
                const overcommitPenalty = attackerMomentum * 0.8;

                const overshootStrength = 3 + attackerMomentum * 6;
                attacker.vx += dirX * overshootStrength;
                attacker.vz += dirZ * overshootStrength * 0.7;

                const recoveryPenalty = Math.floor(attackerMomentum * 20);
                attacker.stunTimer = Math.max(attacker.stunTimer, 5 + recoveryPenalty);

                const attackerInstinct = attacker.genome.instinct / 100;
                attacker.stunTimer = Math.floor(attacker.stunTimer * (1 - attackerInstinct * 0.4));

                this.addEvent('commentary', `${target.name} dodges!`, '#0ff');

                fightLogger.logAttack(attackerIndex, attacker.name, target.name, false, 0, true, {
                    dodgeType: targetInstinct > 0.5 ? 'smart-flank' : 'backward',
                    momentum: attackerMomentum
                });

                const baseCD = 48 - attacker.genome.speed / 5;
                const missPenalty = 8 + attackerMomentum * 12;
                this.attackCooldowns[attackerIndex as 0 | 1] = baseCD + missPenalty + Math.random() * 10;
                return;
            }

            let hitRoll = rollDice(100) + attacker.genome.speed;
            let dodgeRoll = rollDice(100) + target.genome.instinct * 0.5;

            if (target.isFlying) dodgeRoll += 10;
            if (target.stunTimer > 0) dodgeRoll -= 30;

            if (hitRoll > dodgeRoll) {
                let damage = Math.floor((attacker.genome.bulk + attacker.genome.fury) / 10) + rollDice(6);

                const momentumBonus = 1 + attackerMomentum * 0.35;
                damage = Math.floor(damage * momentumBonus);
                if (attackerMomentum > 0.6) {
                    this.addEvent('commentary', 'CHARGING STRIKE!', '#fa0');
                }

                const isDiveAttack = attacker.isFlying && attacker.isDiving && attacker.y > target.y;
                if (isDiveAttack) {
                    const heightBonus = Math.min(1.5, 1 + Math.abs(target.y - attacker.y) / 200);
                    damage = Math.floor(damage * heightBonus);
                    this.addEvent('commentary', 'DIVE ATTACK!', '#f80');
                }

                const heightAdvantage = attacker.y - target.y;
                if (heightAdvantage > 40 && !isDiveAttack) {
                    damage = Math.floor(damage * 1.15);
                }

                const targetFacingDir = target.facingRight ? 1 : -1;
                const attackFromDir = Math.sign(attacker.x - target.x);
                const isFlanking = (attackFromDir !== 0) && (attackFromDir !== targetFacingDir);

                const zFlanking = Math.abs(dz) > Math.abs(dx) * 1.5;

                if (isFlanking || zFlanking) {
                    damage = Math.floor(damage * 1.25);
                    if (isFlanking && zFlanking) {
                        damage = Math.floor(damage * 1.15);
                        this.addEvent('commentary', 'BACKSTAB!', '#f0f');
                    }
                }

                if (target.genome.defense === 'shell') {
                    damage = Math.max(1, damage - Math.floor(target.genome.bulk / 20));
                }

                const isCrit = rollDice(100) <= attacker.genome.fury / 2;
                if (isCrit) {
                    damage = Math.floor(damage * 1.5);
                    this.addEvent('commentary', 'CRITICAL HIT!', '#ff0');
                }

                damage = Math.max(1, damage);

                target.hp -= damage;
                target.setState('hit');
                target.stunTimer = isCrit ? 25 : 15;
                target.flashTimer = 4;
                target.squash = 1.2;
                target.stretch = 0.8;

                const massRatio = attacker.mass / target.mass;
                const damageRatio = damage / 10;

                let weaponKnockback = 1.0;
                switch (attacker.genome.weapon) {
                    case 'mandibles': weaponKnockback = 0.8; break;
                    case 'stinger': weaponKnockback = 1.4; break;
                    case 'fangs': weaponKnockback = 1.0; break;
                    case 'pincers': weaponKnockback = 0.7; break;
                    case 'horn': weaponKnockback = 1.5; break;
                }

                let defenseResist = 1.0;
                if (target.genome.defense === 'shell') {
                    defenseResist = 0.7;
                } else if (target.genome.defense === 'camouflage') {
                    defenseResist = 1.0;
                }

                const targetSpeed = Math.sqrt(target.vx * target.vx + target.vy * target.vy + target.vz * target.vz);
                const targetMomentum = Math.min(targetSpeed / 8, 1);
                const momentumVulnerability = 1 + targetMomentum * 0.5;
                if (targetMomentum > 0.5) {
                    this.addEvent('commentary', 'CAUGHT OFF-BALANCE!', '#f80');
                }

                const baseKnockback = isCrit ? 8 : 5;
                const knockbackForce = baseKnockback * Math.sqrt(massRatio) * weaponKnockback * defenseResist * momentumVulnerability * (0.8 + damageRatio * 0.3);

                const kbDirZ = dist > 0 ? dz / dist : 0;
                target.vx += dirX * knockbackForce;
                target.vy += dirY * knockbackForce * 0.3 + 2;
                target.vz += kbDirZ * knockbackForce * 0.6;

                target.isKnockedBack = true;
                target.knockbackVelocity = knockbackForce;

                attacker.onHitLanded(damage);
                target.onDamageTaken(damage);

                this.addEvent('hit', {
                    x: target.x,
                    y: target.y,
                    damage,
                    isCrit,
                    attacker: attacker.name,
                    target: target.name,
                });

                fightLogger.logAttack(attackerIndex, attacker.name, target.name, true, damage, false, {
                    crit: isCrit,
                    momentum: attackerMomentum
                });

                if (attacker.genome.weapon === 'fangs' && rollDice(3) === 3) {
                    target.poisoned = 4;
                    this.addEvent('commentary', `${target.name} is poisoned!`, '#0f0');
                }

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
                if (attackerMomentum > 0.3) {
                    const overshootStrength = 2 + attackerMomentum * 4;
                    attacker.vx += dirX * overshootStrength;
                    attacker.vz += dirZ * overshootStrength * 0.5;
                    attacker.stunTimer = Math.max(attacker.stunTimer, Math.floor(3 + attackerMomentum * 10));
                }
                this.addEvent('commentary', `${attacker.name} misses!`, '#888');

                fightLogger.logAttack(attackerIndex, attacker.name, target.name, false, 0, false, {
                    momentum: attackerMomentum
                });
            }

            const baseCD = 48 - attacker.genome.speed / 5;
            this.attackCooldowns[attackerIndex as 0 | 1] = baseCD + Math.random() * 15;
        }
    }

    processPoison(fighter: Fighter): void {
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

    endFight(): void {
        this.phase = 'victory';
        this.victoryTimer = TICK_RATE * 5;

        const f1 = this.fighters[0]!;
        const f2 = this.fighters[1]!;
        if (f1.isAlive && !f2.isAlive) {
            this.winner = 1;
            f1.setState('victory');
            this.addEvent('commentary', `${f1.name} WINS!`, '#ff0');
            this.roster.recordWin(this.bugIds[0]!);
            this.roster.recordLoss(this.bugIds[1]!);
        } else if (f2.isAlive && !f1.isAlive) {
            this.winner = 2;
            f2.setState('victory');
            this.addEvent('commentary', `${f2.name} WINS!`, '#ff0');
            this.roster.recordWin(this.bugIds[1]!);
            this.roster.recordLoss(this.bugIds[0]!);
        } else {
            this.winner = 0;
            this.addEvent('commentary', 'DRAW!', '#888');
        }

        fightLogger.logFightEnd(this.winner, this.fighters);

        this.addEvent('fightEnd', { winner: this.winner });
    }

    getState(): GameState {
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

    getRoster(): RosterClientBug[] {
        return this.roster.getRosterForClient();
    }
}

export { Simulation, Fighter, ARENA, TICK_RATE, TICK_MS };
