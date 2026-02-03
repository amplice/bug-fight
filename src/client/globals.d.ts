// Bug Fights - Client Global Declarations
// Window augmentation for global functions called via onclick in HTML

// Global functions exposed by main.ts for HTML onclick handlers
interface Window {
    setCamera(preset: string): void;
    toggleSound(): void;
    toggleDebugOverlay(): void;
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
