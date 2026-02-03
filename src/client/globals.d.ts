// Bug Fights - Client Global Declarations
// Augments the Window interface with our global objects and declares THREE.

// THREE.js is loaded via CDN script tag — declare it as a global
declare const THREE: typeof import('three');

// Global functions attached to window by app.ts (called via onclick in HTML)
declare function setCamera(preset: string): void;
declare function toggleSound(): void;
declare function toggleDebugOverlay(): void;

// Client modules attached to window
interface Window {
    BugGenome: typeof BugGenome;
    BugFightsClient: BugFightsClientAPI;
    BugFightsSound: BugFightsSoundAPI;
    BugGenerator3D: typeof BugGenerator3D;
    BugAnimator: typeof BugAnimator;
    BugFightsRenderer3D: Renderer3DAPI;
    Roster3DViewer: typeof Roster3DViewer;
}

// ============================================
// CLIENT MODULE APIS
// ============================================

interface BugFightsClientAPI {
    init(): void;
    getState(): GameState;
    getCommentary(): CommentaryEntry[];
    setOnStateUpdate(cb: ((state: GameState) => void) | null): void;
    setOnEvent(cb: ((event: GameEvent) => void) | null): void;
    addCommentary(text: string, color?: string): void;
}

interface CommentaryEntry {
    text: string;
    color: string;
    age: number;
}

interface BugFightsSoundAPI {
    init(): void;
    handleEvent(event: GameEvent): void;
    update(fighters: FighterState[]): void;
    setMuted(muted: boolean): void;
    setVolume(volume: number): void;
    toggleMute(): boolean;
    isMuted(): boolean;
    playHit(data: HitEventData): void;
    playDodge(): void;
    playFeint(result: string): void;
    playWallImpact(data: WallImpactEventData): void;
    playMiss(): void;
    playFightStart(): void;
    playVictory(): void;
    playCountdown(count: number): void;
}

interface Renderer3DAPI {
    init(): void;
    setCameraPreset(preset: string): void;
    createBugForRoster(genome: GenomeData): import('three').Group;
}

// BugGenerator3D and BugAnimator are now defined in bugGenerator3d.ts
