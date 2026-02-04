// Seeded PRNG (mulberry32) + drand beacon fetcher
// Provides deterministic, verifiable randomness for fight simulation.

export class SeededRNG {
    private state: number;

    constructor(seed: number) {
        this.state = seed | 0;
    }

    /** Returns a float in [0, 1), drop-in replacement for Math.random() */
    random(): number {
        this.state = (this.state + 0x6D2B79F5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** Create from drand's 64-char hex randomness string (hashed to 32-bit seed) */
    static fromHex(hex: string): SeededRNG {
        // Simple hash: take first 8 hex chars as a 32-bit integer
        // This is sufficient — mulberry32 distributes well from any seed
        let seed = 0;
        for (let i = 0; i < Math.min(hex.length, 8); i++) {
            seed = (seed << 4) | parseInt(hex[i]!, 16);
        }
        return new SeededRNG(seed);
    }
}

export interface DrandBeacon {
    round: number;
    randomness: string;
}

export async function fetchDrandBeacon(): Promise<DrandBeacon | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch('https://api.drand.sh/public/latest', {
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return null;

        const data = await res.json() as { round?: number; randomness?: string };
        if (typeof data.round !== 'number' || typeof data.randomness !== 'string') {
            return null;
        }

        return { round: data.round, randomness: data.randomness };
    } catch {
        return null;
    }
}
