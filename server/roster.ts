// Bug Fights - Roster Manager
// Manages persistent bug roster with fight records via SQLite/Prisma
// Includes autonomous evolution: breeding, retirement, and lineage tracking

import BugGenome from './BugGenome';
import prisma from './db';

const ROSTER_SIZE = 25;
const ROSTER_FILE = import.meta.dir + '/../roster.json';
const RETIREMENT_ELIGIBILITY = 30; // Total fights before a bug can be retired
const BREEDING_INTERVAL = 8;       // Fights between breeding checks

class RosterManager {
    bugs: RosterBug[];
    private fightsSinceBreeding: number;

    constructor() {
        this.bugs = [];
        this.fightsSinceBreeding = 0;
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

        // Load all active bugs from DB with parent names
        const dbBugs = await prisma.bug.findMany({
            where: { active: true },
            orderBy: { createdAt: 'asc' },
            include: {
                parent1: { select: { name: true } },
                parent2: { select: { name: true } },
            },
        });

        this.bugs = dbBugs.map((b) => ({
            id: b.id,
            genome: JSON.parse(b.genome) as GenomeData,
            name: b.name,
            wins: b.wins,
            losses: b.losses,
            createdAt: b.createdAt.toISOString(),
            generation: b.generation,
            parent1Id: b.parent1Id,
            parent2Id: b.parent2Id,
            parent1Name: b.parent1?.name ?? null,
            parent2Name: b.parent2?.name ?? null,
        }));

        console.log(`Loaded roster with ${this.bugs.length} bugs from database`);

        // Auto-detect pre-evolution roster: active bugs with fight history but no breeding history
        if (this.bugs.length > 0) {
            const hasFightHistory = this.bugs.some(b => b.wins + b.losses > 0);
            const hasBreedingHistory = this.bugs.some(b => b.parent1Id !== null);
            if (hasFightHistory && !hasBreedingHistory) {
                console.log('Pre-evolution roster detected — regenerating with new founders');
                await this.regenerateRoster();
                return;
            }
        }

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

    async regenerateRoster(): Promise<void> {
        console.log('Regenerating roster — retiring all existing bugs...');

        // Retire all current active bugs in DB
        await prisma.bug.updateMany({
            where: { active: true },
            data: { active: false, retiredAt: new Date() },
        });

        this.bugs = [];

        // Generate 20 fresh generation-0 founders
        const usedWeapons = new Set<WeaponType>();
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
                i < 6 &&
                (usedWeapons.has(genome.weapon) && usedWeapons.size < 4) ||
                (usedMobilities.has(genome.mobility) && usedMobilities.size < 3)
            );

            usedWeapons.add(genome.weapon);
            usedMobilities.add(genome.mobility);

            const bug: RosterBug = {
                id: this.generateId(),
                genome: genome.toJSON(),
                name: genome.getName(),
                wins: 0,
                losses: 0,
                createdAt: new Date().toISOString(),
                generation: 0,
                parent1Id: null,
                parent2Id: null,
                parent1Name: null,
                parent2Name: null,
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
                    generation: 0,
                },
            });
        }

        console.log(`Regenerated roster with ${this.bugs.length} generation-0 founders`);
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
            generation: 0,
            parent1Id: null,
            parent2Id: null,
            parent1Name: null,
            parent2Name: null,
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
                generation: 0,
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

    // ========================================
    // BREEDING & RETIREMENT
    // ========================================

    async retireBug(id: string): Promise<RosterBug | null> {
        const idx = this.bugs.findIndex(b => b.id === id);
        if (idx === -1) return null;

        const bug = this.bugs[idx]!;
        this.bugs.splice(idx, 1);

        await prisma.bug.update({
            where: { id },
            data: { active: false, retiredAt: new Date() },
        });

        return bug;
    }

    async breedNewBug(parent1: RosterBug, parent2: RosterBug): Promise<RosterBug> {
        const genome1 = new BugGenome(parent1.genome);
        const genome2 = new BugGenome(parent2.genome);
        const childGenome = genome1.breed(genome2);
        const generation = Math.max(parent1.generation, parent2.generation) + 1;

        const bug: RosterBug = {
            id: this.generateId(),
            genome: childGenome.toJSON(),
            name: childGenome.getName(),
            wins: 0,
            losses: 0,
            createdAt: new Date().toISOString(),
            generation,
            parent1Id: parent1.id,
            parent2Id: parent2.id,
            parent1Name: parent1.name,
            parent2Name: parent2.name,
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
                generation,
                parent1Id: parent1.id,
                parent2Id: parent2.id,
            },
        });

        return bug;
    }

    selectParents(excludeIds: string[] = []): [RosterBug, RosterBug] | null {
        const eligible = this.bugs.filter(b => !excludeIds.includes(b.id));
        if (eligible.length < 2) return null;

        // Pick two random parents
        const p1Idx = Math.floor(Math.random() * eligible.length);
        let p2Idx = Math.floor(Math.random() * (eligible.length - 1));
        if (p2Idx >= p1Idx) p2Idx++;

        return [eligible[p1Idx]!, eligible[p2Idx]!];
    }

    async checkBreedingCycle(excludeIds: string[] = []): Promise<{ retired: RosterBug | null; offspring: RosterBug | null }> {
        this.fightsSinceBreeding++;

        if (this.fightsSinceBreeding < BREEDING_INTERVAL) {
            return { retired: null, offspring: null };
        }

        this.fightsSinceBreeding = 0;

        // Find eligible bugs (40+ fights), excluding those that just fought
        const eligible = this.bugs.filter(b =>
            !excludeIds.includes(b.id) &&
            (b.wins + b.losses) >= RETIREMENT_ELIGIBILITY
        );

        if (eligible.length === 0) {
            return { retired: null, offspring: null };
        }

        // Retire the one with worst win rate
        let worstBug = eligible[0]!;
        let worstRate = worstBug.wins / (worstBug.wins + worstBug.losses);
        for (const bug of eligible) {
            const rate = bug.wins / (bug.wins + bug.losses);
            if (rate < worstRate) {
                worstRate = rate;
                worstBug = bug;
            }
        }

        const retired = await this.retireBug(worstBug.id);

        // Breed a replacement
        let offspring: RosterBug | null = null;
        try {
            const parents = this.selectParents(excludeIds);
            if (parents) {
                offspring = await this.breedNewBug(parents[0], parents[1]);
                console.log(
                    `[Evolution] Retired ${retired?.name} (${retired?.wins}W-${retired?.losses}L, Gen ${retired?.generation}). ` +
                    `Bred ${offspring.name} (Gen ${offspring.generation}) from ${parents[0].name} × ${parents[1].name}`
                );
            } else {
                // Fallback: random founder if no parents available
                offspring = await this.addNewBug();
                console.log(
                    `[Evolution] Retired ${retired?.name}. No parents available — added random founder ${offspring.name}`
                );
            }
        } catch (err) {
            console.error('Breeding failed, adding random founder:', err);
            offspring = await this.addNewBug();
        }

        return { retired, offspring };
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
            genome: bug.genome,
            generation: bug.generation,
            parentNames: bug.parent1Name && bug.parent2Name
                ? [bug.parent1Name, bug.parent2Name] as [string, string]
                : null,
        }));
    }
}

export default RosterManager;
