// Bug Fights - Roster Manager
// Manages persistent bug roster with fight records via SQLite/Prisma

import BugGenome from './BugGenome';
import prisma from './db';

const ROSTER_SIZE = 20;
const ROSTER_FILE = import.meta.dir + '/../roster.json';

class RosterManager {
    bugs: RosterBug[];

    constructor() {
        this.bugs = [];
    }

    static async create(): Promise<RosterManager> {
        const manager = new RosterManager();
        await manager.load();
        return manager;
    }

    async load(): Promise<void> {
        // Try migrating from roster.json if DB is empty
        const count = await prisma.bug.count();
        if (count === 0) {
            await this.migrateFromJson();
        }

        // Load all active bugs from DB
        const dbBugs = await prisma.bug.findMany({
            where: { active: true },
            orderBy: { createdAt: 'asc' },
        });

        this.bugs = dbBugs.map((b: { id: string; genome: string; name: string; wins: number; losses: number; createdAt: Date }) => ({
            id: b.id,
            genome: JSON.parse(b.genome) as GenomeData,
            name: b.name,
            wins: b.wins,
            losses: b.losses,
            createdAt: b.createdAt.toISOString(),
        }));

        console.log(`Loaded roster with ${this.bugs.length} bugs from database`);

        // Ensure roster has enough bugs
        while (this.bugs.length < ROSTER_SIZE) {
            await this.addNewBug();
        }
    }

    private async migrateFromJson(): Promise<void> {
        try {
            const file = Bun.file(ROSTER_FILE);
            if (!(await file.exists())) {
                console.log('No roster.json found, generating fresh roster');
                return;
            }

            const data: RosterFile = await file.json();
            if (!data.bugs || data.bugs.length === 0) return;

            console.log(`Migrating ${data.bugs.length} bugs from roster.json to SQLite...`);

            for (const bug of data.bugs) {
                await prisma.bug.create({
                    data: {
                        id: bug.id,
                        name: bug.name,
                        genome: JSON.stringify(bug.genome),
                        wins: bug.wins,
                        losses: bug.losses,
                        active: true,
                        createdAt: new Date(bug.createdAt),
                    },
                });
            }

            console.log(`Migration complete: ${data.bugs.length} bugs imported`);
        } catch (err) {
            console.error('Error migrating from roster.json:', err);
        }
    }

    generateRoster(): void {
        console.log('Generating new roster...');
        this.bugs = [];

        // Ensure variety by tracking what we've generated
        const usedWeapons = new Set<WeaponType>();
        const usedDefenses = new Set<DefenseType>();
        const usedMobilities = new Set<MobilityType>();

        for (let i = 0; i < ROSTER_SIZE; i++) {
            let genome: InstanceType<typeof BugGenome>;
            let attempts = 0;

            // Try to get variety in first few bugs
            do {
                genome = new BugGenome();
                attempts++;
            } while (
                attempts < 20 &&
                i < 6 && // Only enforce variety for first 6 bugs
                (usedWeapons.has(genome.weapon) && usedWeapons.size < 4) ||
                (usedMobilities.has(genome.mobility) && usedMobilities.size < 3)
            );

            usedWeapons.add(genome.weapon);
            usedDefenses.add(genome.defense);
            usedMobilities.add(genome.mobility);

            const bug: RosterBug = {
                id: this.generateId(),
                genome: genome.toJSON(),
                name: genome.getName(),
                wins: 0,
                losses: 0,
                createdAt: new Date().toISOString(),
            };

            this.bugs.push(bug);

            // Fire-and-forget DB insert
            prisma.bug.create({
                data: {
                    id: bug.id,
                    name: bug.name,
                    genome: JSON.stringify(bug.genome),
                    wins: 0,
                    losses: 0,
                    active: true,
                },
            }).catch((err: unknown) => console.error('Error saving bug to DB:', err));
        }

        console.log(`Generated roster with ${this.bugs.length} bugs`);
    }

    generateId(): string {
        return Math.random().toString(36).substring(2, 11);
    }

    async addNewBug(): Promise<RosterBug> {
        const genome = new BugGenome();
        const bug: RosterBug = {
            id: this.generateId(),
            genome: genome.toJSON(),
            name: genome.getName(),
            wins: 0,
            losses: 0,
            createdAt: new Date().toISOString(),
        };
        this.bugs.push(bug);

        await prisma.bug.create({
            data: {
                id: bug.id,
                name: bug.name,
                genome: JSON.stringify(bug.genome),
                wins: 0,
                losses: 0,
                active: true,
            },
        });

        return bug;
    }

    getBug(id: string): RosterBug | undefined {
        return this.bugs.find(b => b.id === id);
    }

    // Select two different bugs for a fight
    selectFighters(): [RosterBug, RosterBug] {
        if (this.bugs.length < 2) {
            throw new Error('Not enough bugs in roster');
        }

        // Weighted random selection - bugs with fewer fights get slightly higher chance
        const weights = this.bugs.map(bug => {
            const totalFights = bug.wins + bug.losses;
            // Give newer bugs (fewer fights) slightly higher weight
            return Math.max(1, 10 - totalFights * 0.5);
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);

        // Select first fighter
        let r = Math.random() * totalWeight;
        let fighter1Index = 0;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i]!;
            if (r <= 0) {
                fighter1Index = i;
                break;
            }
        }

        // Select second fighter (different from first)
        const remainingWeight = totalWeight - weights[fighter1Index]!;
        r = Math.random() * remainingWeight;
        let fighter2Index = fighter1Index === 0 ? 1 : 0; // Default to first non-fighter1 index
        for (let i = 0; i < weights.length; i++) {
            if (i === fighter1Index) continue;
            r -= weights[i]!;
            if (r <= 0) {
                fighter2Index = i;
                break;
            }
        }

        return [this.bugs[fighter1Index]!, this.bugs[fighter2Index]!];
    }

    recordWin(bugId: string): void {
        const bug = this.getBug(bugId);
        if (bug) {
            bug.wins++;
            // Fire-and-forget DB update
            prisma.bug.update({
                where: { id: bugId },
                data: { wins: { increment: 1 } },
            }).catch((err: unknown) => console.error('Error recording win:', err));
        }
    }

    recordLoss(bugId: string): void {
        const bug = this.getBug(bugId);
        if (bug) {
            bug.losses++;
            // Fire-and-forget DB update
            prisma.bug.update({
                where: { id: bugId },
                data: { losses: { increment: 1 } },
            }).catch((err: unknown) => console.error('Error recording loss:', err));
        }
    }

    getRosterForClient(): RosterClientBug[] {
        return this.bugs.map(bug => ({
            id: bug.id,
            name: bug.name,
            stats: {
                bulk: bug.genome.bulk,
                speed: bug.genome.speed,
                fury: bug.genome.fury,
                instinct: bug.genome.instinct
            },
            weapon: bug.genome.weapon,
            defense: bug.genome.defense,
            mobility: bug.genome.mobility,
            wins: bug.wins,
            losses: bug.losses,
            genome: bug.genome
        }));
    }
}

export default RosterManager;
