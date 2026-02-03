// Bug Fights - Shared Type Definitions
// Single source of truth for all data shapes flowing between server and client.
// No imports/exports — this file is a script, so all declarations are global.

// ============================================
// TRAIT ENUMS (String Literal Unions)
// ============================================

type WeaponType = 'mandibles' | 'stinger' | 'fangs' | 'pincers' | 'horn';
type DefenseType = 'shell' | 'none' | 'toxic' | 'camouflage';
type MobilityType = 'ground' | 'winged' | 'wallcrawler';
type WingType = 'fly' | 'beetle' | 'dragonfly' | 'none';
type TextureType = 'smooth' | 'plated' | 'rough' | 'spotted' | 'striped';
type AbdomenType = 'round' | 'oval' | 'pointed' | 'bulbous' | 'segmented' | 'sac' | 'plated' | 'tailed';
type ThoraxType = 'compact' | 'elongated' | 'wide' | 'humped' | 'segmented';
type HeadType = 'round' | 'triangular' | 'square' | 'elongated' | 'shield';
type LegStyle = 'insect' | 'spider' | 'mantis' | 'grasshopper' | 'beetle' | 'stick' | 'centipede';
type LegCount = 4 | 6 | 8;
type EyeStyle = 'compound' | 'simple' | 'stalked' | 'multiple' | 'sunken';
type AntennaStyle = 'segmented' | 'clubbed' | 'whip' | 'horned' | 'none' | 'nubs';

// ============================================
// STATE ENUMS
// ============================================

type AIState = 'aggressive' | 'circling' | 'retreating' | 'stunned';
type AnimationState = 'idle' | 'attack' | 'feint' | 'hit' | 'windup' | 'death' | 'victory';
type GamePhase = 'countdown' | 'fighting' | 'victory';
type FighterSide = 'left' | 'right';
type WallSide = 'left' | 'right' | 'front' | 'back';

// ============================================
// CORE DATA
// ============================================

interface BugColor {
    hue: number;
    saturation: number;
    lightness: number;
}

/** The serialized genome shape — transmitted over WebSocket, stored in roster.json */
interface GenomeData {
    bulk: number;
    speed: number;
    fury: number;
    instinct: number;
    abdomenType: AbdomenType;
    thoraxType: ThoraxType;
    headType: HeadType;
    legCount: LegCount;
    legStyle: LegStyle;
    weapon: WeaponType;
    defense: DefenseType;
    mobility: MobilityType;
    textureType: TextureType;
    eyeStyle: EyeStyle;
    antennaStyle: AntennaStyle;
    wingType: WingType;
    color: BugColor;
    accentHue: number;
}

interface ArenaConfig {
    width: number;
    height: number;
    depth: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}

// ============================================
// FIGHTER STATE (toState() return shape)
// ============================================

interface DriveState {
    aggression: number;
    caution: number;
}

/** Internal drives including adaptRate — used by Fighter class on the server */
interface FullDriveState extends DriveState {
    adaptRate: number;
}

/** Serialized fighter state broadcast to clients each tick */
interface FighterState {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    hp: number;
    maxHp: number;
    stamina: number;
    maxStamina: number;
    state: AnimationState;
    animFrame: number;
    aiState: AIState;
    facingRight: boolean;
    facingAngle: number;
    onWall: boolean;
    wallSide: WallSide | null;
    grounded: boolean;
    squash: number;
    stretch: number;
    lungeX: number;
    lungeY: number;
    flashTimer: number;
    poisoned: number;
    drives: DriveState;
    spriteSize: number;
    victoryBounce: number;
    deathRotation: number;
    deathAlpha: number;
    isKnockedBack: boolean;
    wallStunTimer: number;
    isFlying: boolean;
    isWallcrawler: boolean;
    isDiving: boolean;
    stunTimer: number;
    stuckTimer: number;
}

// ============================================
// EVENTS (Discriminated Union)
// ============================================

interface CommentaryEvent {
    type: 'commentary';
    data: string;
    color: string;
    tick: number;
}

interface HitEventData {
    x: number;
    y: number;
    damage: number;
    isCrit?: boolean;
    isPoison?: boolean;
    attacker?: string;
    target?: string;
}

interface HitEvent {
    type: 'hit';
    data: HitEventData;
    color: null;
    tick: number;
}

interface FeintEventData {
    x: number;
    y: number;
    attacker: string;
    target: string;
    result: 'read' | 'dodge-bait' | 'flinch';
}

interface FeintEvent {
    type: 'feint';
    data: FeintEventData;
    color: null;
    tick: number;
}

interface WallImpactEventData {
    x: number;
    y: number;
    name: string;
    velocity: number;
    wallSide: WallSide;
    stunApplied: number;
}

interface WallImpactEvent {
    type: 'wallImpact';
    data: WallImpactEventData;
    color: null;
    tick: number;
}

interface FightEndEventData {
    winner: number | null;
}

interface FightEndEvent {
    type: 'fightEnd';
    data: FightEndEventData;
    color: null;
    tick: number;
}

type GameEvent = CommentaryEvent | HitEvent | FeintEvent | WallImpactEvent | FightEndEvent;

// ============================================
// GAME STATE (getState() return shape)
// ============================================

interface Odds {
    fighter1: string;
    fighter2: string;
    american1: string | number;
    american2: string | number;
    prob1: number;
    prob2: number;
}

interface BugRecord {
    wins: number;
    losses: number;
}

/** Full game state broadcast to clients each tick */
interface GameState {
    phase: GamePhase;
    countdown: number;
    tick: number;
    fightNumber: number;
    fighters: FighterState[];
    bugs: GenomeData[];
    bugNames: string[];
    bugRecords: BugRecord[];
    odds: Odds;
    events: GameEvent[];
    winner: number | null;
}

// ============================================
// WEBSOCKET PROTOCOL
// ============================================

interface WSInitMessage {
    type: 'init';
    state: GameState;
}

interface WSStateMessage {
    type: 'state';
    state: GameState;
}

type WSServerMessage = WSInitMessage | WSStateMessage;

// ============================================
// ROSTER
// ============================================

/** Bug as stored in roster.json */
interface RosterBug {
    id: string;
    genome: GenomeData;
    name: string;
    wins: number;
    losses: number;
    createdAt: string;
}

/** Bug record sent to client via getRosterForClient() */
interface RosterClientBug {
    id: string;
    name: string;
    stats: {
        bulk: number;
        speed: number;
        fury: number;
        instinct: number;
    };
    weapon: WeaponType;
    defense: DefenseType;
    mobility: MobilityType;
    wins: number;
    losses: number;
    genome: GenomeData;
}

/** Roster data as stored in roster.json on disk */
interface RosterFile {
    bugs: RosterBug[];
    savedAt: string;
}

// ============================================
// FIGHT LOGGER STATS
// ============================================

interface FightLoggerStats {
    attacks: [number, number];
    hits: [number, number];
    dodges: [number, number];
    damage: [number, number];
    feints: [number, number];
    feintsRead: [number, number];
    feintBaits: [number, number];
    timeInState: [Record<string, number>, Record<string, number>];
    stateTransitions: StateTransition[];
    engagementHistory: number[];
    lastEngagement: number;
    stalemateTicks: number;
}

interface StateTransition {
    time: number;
    fighter: number;
    from: AIState | null;
    to: AIState;
    reason: string;
}
