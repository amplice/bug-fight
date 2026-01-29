// Bug Fights - Roster Manager
// Manages persistent bug roster with fight records

const fs = require('fs');
const path = require('path');
const BugGenome = require('./BugGenome');

const ROSTER_FILE = path.join(__dirname, '..', 'roster.json');
const ROSTER_SIZE = 20;

class RosterManager {
    constructor() {
        this.bugs = [];
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(ROSTER_FILE)) {
                const data = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
                this.bugs = data.bugs || [];
                console.log(`Loaded roster with ${this.bugs.length} bugs`);
            } else {
                this.generateRoster();
            }
        } catch (err) {
            console.error('Error loading roster:', err);
            this.generateRoster();
        }

        // Ensure roster has enough bugs
        while (this.bugs.length < ROSTER_SIZE) {
            this.addNewBug();
        }
    }

    save() {
        try {
            const data = { bugs: this.bugs, savedAt: new Date().toISOString() };
            fs.writeFileSync(ROSTER_FILE, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('Error saving roster:', err);
        }
    }

    generateRoster() {
        console.log('Generating new roster...');
        this.bugs = [];

        // Ensure variety by tracking what we've generated
        const usedWeapons = new Set();
        const usedDefenses = new Set();
        const usedMobilities = new Set();

        for (let i = 0; i < ROSTER_SIZE; i++) {
            let genome;
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

            this.bugs.push({
                id: this.generateId(),
                genome: genome.toJSON(),
                name: genome.getName(),
                wins: 0,
                losses: 0,
                createdAt: new Date().toISOString()
            });
        }

        this.save();
        console.log(`Generated roster with ${this.bugs.length} bugs`);
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    addNewBug() {
        const genome = new BugGenome();
        const bug = {
            id: this.generateId(),
            genome: genome.toJSON(),
            name: genome.getName(),
            wins: 0,
            losses: 0,
            createdAt: new Date().toISOString()
        };
        this.bugs.push(bug);
        this.save();
        return bug;
    }

    getBug(id) {
        return this.bugs.find(b => b.id === id);
    }

    // Select two different bugs for a fight
    selectFighters() {
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
            r -= weights[i];
            if (r <= 0) {
                fighter1Index = i;
                break;
            }
        }

        // Select second fighter (different from first)
        let fighter2Index;
        do {
            r = Math.random() * (totalWeight - weights[fighter1Index]);
            fighter2Index = 0;
            for (let i = 0; i < weights.length; i++) {
                if (i === fighter1Index) continue;
                r -= weights[i];
                if (r <= 0) {
                    fighter2Index = i;
                    break;
                }
            }
        } while (fighter2Index === fighter1Index);

        return [this.bugs[fighter1Index], this.bugs[fighter2Index]];
    }

    recordWin(bugId) {
        const bug = this.getBug(bugId);
        if (bug) {
            bug.wins++;
            this.save();
        }
    }

    recordLoss(bugId) {
        const bug = this.getBug(bugId);
        if (bug) {
            bug.losses++;
            this.save();
        }
    }

    getRoster() {
        return this.bugs.map(bug => ({
            id: bug.id,
            name: bug.name,
            genome: bug.genome,
            wins: bug.wins,
            losses: bug.losses
        }));
    }

    getRosterForClient() {
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

module.exports = RosterManager;
