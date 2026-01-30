// Bug Fights - Bug Genome (Server Module)
// Handles bug stats, traits, colors, and breeding

// Realistic bug color palette
const BUG_COLORS = [
    { hue: 0,   sat: 0,   light: 10 },  // jet black
    { hue: 0,   sat: 0,   light: 18 },  // charcoal
    { hue: 0,   sat: 0,   light: 29 },  // slate
    { hue: 0,   sat: 0,   light: 42 },  // ash
    { hue: 60,  sat: 8,   light: 51 },  // stone
    { hue: 20,  sat: 40,  light: 12 },  // dark brown
    { hue: 25,  sat: 45,  light: 17 },  // chocolate
    { hue: 25,  sat: 50,  light: 28 },  // chestnut
    { hue: 28,  sat: 35,  light: 49 },  // tan
    { hue: 40,  sat: 30,  light: 74 },  // cream
    { hue: 25,  sat: 75,  light: 31 },  // rust
    { hue: 0,   sat: 60,  light: 27 },  // mahogany
    { hue: 45,  sat: 85,  light: 38 },  // amber
    { hue: 20,  sat: 60,  light: 40 },  // copper
    { hue: 35,  sat: 75,  light: 47 },  // ochre
    { hue: 120, sat: 30,  light: 24 },  // forest
    { hue: 95,  sat: 25,  light: 30 },  // moss
    { hue: 60,  sat: 20,  light: 30 },  // olive
    { hue: 180, sat: 25,  light: 25 },  // teal
    { hue: 215, sat: 55,  light: 25 },  // navy
];

class BugGenome {
    constructor(data = null) {
        if (data) {
            Object.assign(this, data);
            this.color = { ...data.color };
        } else {
            this.randomize();
        }
    }

    randomize() {
        const STAT_CAP = 350, MIN = 10, MAX = 100;

        const normalRandom = () => {
            const u1 = Math.random();
            const u2 = Math.random();
            return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        };

        const generateStat = () => {
            const mean = 55;
            const stdDev = 20;
            let value = Math.round(mean + normalRandom() * stdDev);
            return Math.max(MIN, Math.min(MAX, value));
        };

        let stats = [generateStat(), generateStat(), generateStat(), generateStat()];

        const total = stats.reduce((a, b) => a + b, 0);
        if (total > STAT_CAP) {
            const scale = STAT_CAP / total;
            stats = stats.map(s => Math.max(MIN, Math.round(s * scale)));

            let newTotal = stats.reduce((a, b) => a + b, 0);
            while (newTotal > STAT_CAP) {
                const maxIdx = stats.indexOf(Math.max(...stats));
                stats[maxIdx]--;
                newTotal--;
            }
        }

        [this.bulk, this.speed, this.fury, this.instinct] = stats;

        this.abdomenType = ['round', 'oval', 'pointed', 'bulbous', 'segmented', 'sac', 'plated', 'tailed'][Math.floor(Math.random() * 8)];
        this.thoraxType = ['compact', 'elongated', 'wide', 'humped', 'segmented'][Math.floor(Math.random() * 5)];
        this.headType = ['round', 'triangular', 'square', 'elongated', 'shield'][Math.floor(Math.random() * 5)];

        this.legCount = [4, 6, 8][Math.floor(Math.random() * 3)];
        this.legStyle = ['insect', 'spider', 'mantis', 'grasshopper', 'beetle', 'stick', 'centipede'][Math.floor(Math.random() * 7)];

        this.weapon = ['mandibles', 'stinger', 'fangs', 'pincers', 'horn'][Math.floor(Math.random() * 5)];
        this.defense = ['shell', 'none', 'toxic', 'camouflage'][Math.floor(Math.random() * 4)];
        this.mobility = ['ground', 'winged', 'wallcrawler'][Math.floor(Math.random() * 3)];
        this.textureType = ['smooth', 'plated', 'rough', 'spotted', 'striped'][Math.floor(Math.random() * 5)];
        this.eyeStyle = ['compound', 'simple', 'stalked', 'multiple', 'sunken'][Math.floor(Math.random() * 5)];
        this.antennaStyle = ['segmented', 'clubbed', 'whip', 'horned', 'none', 'nubs'][Math.floor(Math.random() * 6)];
        // Winged bugs always get a wing type; non-winged bugs are always 'none'
        if (this.mobility === 'winged') {
            this.wingType = ['fly', 'beetle', 'dragonfly'][Math.floor(Math.random() * 3)];
        } else {
            this.wingType = 'none';
        }

        // Pick from realistic color palette
        const colorChoice = BUG_COLORS[Math.floor(Math.random() * BUG_COLORS.length)];
        this.color = {
            hue: colorChoice.hue,
            saturation: colorChoice.sat / 100,
            lightness: colorChoice.light / 100
        };
        this.accentHue = (this.color.hue + 30 + Math.random() * 60) % 360;
    }

    breed(other) {
        const child = new BugGenome();

        child.bulk = this.inheritStat(this.bulk, other.bulk);
        child.speed = this.inheritStat(this.speed, other.speed);
        child.fury = this.inheritStat(this.fury, other.fury);
        child.instinct = this.inheritStat(this.instinct, other.instinct);

        // Scale stats to target total, clamped to [10, 100]
        const STAT_CAP = 350, MIN = 10, MAX = 100;
        const total = child.bulk + child.speed + child.fury + child.instinct;
        const scale = STAT_CAP / total;
        let stats = [
            Math.max(MIN, Math.min(MAX, Math.round(child.bulk * scale))),
            Math.max(MIN, Math.min(MAX, Math.round(child.speed * scale))),
            Math.max(MIN, Math.min(MAX, Math.round(child.fury * scale))),
            Math.max(MIN, Math.min(MAX, Math.round(child.instinct * scale))),
        ];
        // Adjust for rounding errors - trim from highest stats
        let newTotal = stats.reduce((a, b) => a + b, 0);
        while (newTotal > STAT_CAP) {
            const maxIdx = stats.indexOf(Math.max(...stats));
            stats[maxIdx]--;
            newTotal--;
        }
        while (newTotal < STAT_CAP) {
            const minIdx = stats.indexOf(Math.min(...stats));
            stats[minIdx]++;
            newTotal++;
        }
        [child.bulk, child.speed, child.fury, child.instinct] = stats;

        child.abdomenType = Math.random() < 0.5 ? this.abdomenType : other.abdomenType;
        child.thoraxType = Math.random() < 0.5 ? this.thoraxType : other.thoraxType;
        child.headType = Math.random() < 0.5 ? this.headType : other.headType;
        child.legCount = Math.random() < 0.5 ? this.legCount : other.legCount;
        child.legStyle = Math.random() < 0.5 ? this.legStyle : other.legStyle;
        child.weapon = Math.random() < 0.5 ? this.weapon : other.weapon;
        child.defense = Math.random() < 0.5 ? this.defense : other.defense;
        child.mobility = Math.random() < 0.5 ? this.mobility : other.mobility;
        child.textureType = Math.random() < 0.5 ? this.textureType : other.textureType;
        child.eyeStyle = Math.random() < 0.5 ? this.eyeStyle : other.eyeStyle;
        child.antennaStyle = Math.random() < 0.5 ? this.antennaStyle : other.antennaStyle;
        // Winged bugs always get a wing type; non-winged are always 'none'
        if (child.mobility === 'winged') {
            // Inherit wing type from a parent that has wings, or random
            const parentWings = [this.wingType, other.wingType].filter(w => w !== 'none');
            if (parentWings.length > 0) {
                child.wingType = parentWings[Math.floor(Math.random() * parentWings.length)];
            } else {
                child.wingType = ['fly', 'beetle', 'dragonfly'][Math.floor(Math.random() * 3)];
            }
        } else {
            child.wingType = 'none';
        }

        child.color = {
            hue: this.blendHue(this.color.hue, other.color.hue),
            saturation: (this.color.saturation + other.color.saturation) / 2,
            lightness: (this.color.lightness + other.color.lightness) / 2
        };
        child.accentHue = this.blendHue(this.accentHue, other.accentHue);

        return child;
    }

    inheritStat(a, b) {
        const avg = (a + b) / 2;
        const mutation = (Math.random() - 0.5) * 20;
        return Math.max(10, Math.min(100, Math.round(avg + mutation)));
    }

    blendHue(h1, h2) {
        const diff = h2 - h1;
        if (Math.abs(diff) > 180) {
            return diff > 0 ? (h1 + (diff - 360) / 2 + 360) % 360 : (h1 + (diff + 360) / 2) % 360;
        }
        return (h1 + diff / 2 + 360) % 360;
    }

    getName() {
        const prefixes = {
            mandibles: ['Crusher', 'Gnasher', 'Chomper', 'Breaker'],
            stinger: ['Piercer', 'Stabber', 'Lancer', 'Spike'],
            fangs: ['Venom', 'Toxic', 'Biter', 'Fang'],
            pincers: ['Gripper', 'Clamper', 'Pincher', 'Snapper'],
            horn: ['Charger', 'Ramhorn', 'Gorer', 'Impaler']
        };
        const suffixes = {
            round: ['Blob', 'Orb', 'Ball', 'Dome'],
            oval: ['Runner', 'Swift', 'Dash', 'Scout'],
            pointed: ['Spike', 'Lance', 'Arrow', 'Dart'],
            bulbous: ['Bulk', 'Mass', 'Tank', 'Heavy'],
            segmented: ['Crawler', 'Creep', 'Chain', 'Link'],
            sac: ['Sack', 'Brood', 'Pouch', 'Vessel'],
            plated: ['Shell', 'Armor', 'Plank', 'Guard'],
            tailed: ['Tail', 'Whip', 'Sting', 'Lash']
        };

        return prefixes[this.weapon][Math.floor(Math.random() * 4)] + ' ' +
               suffixes[this.abdomenType][Math.floor(Math.random() * 4)];
    }

    getSizeMultiplier() {
        return 0.6 + (this.bulk / 100) * 0.9;
    }

    // Serialize genome for transmission to client
    toJSON() {
        return {
            bulk: this.bulk,
            speed: this.speed,
            fury: this.fury,
            instinct: this.instinct,
            abdomenType: this.abdomenType,
            thoraxType: this.thoraxType,
            headType: this.headType,
            legCount: this.legCount,
            legStyle: this.legStyle,
            weapon: this.weapon,
            defense: this.defense,
            mobility: this.mobility,
            textureType: this.textureType,
            eyeStyle: this.eyeStyle,
            antennaStyle: this.antennaStyle,
            wingType: this.wingType,
            color: this.color,
            accentHue: this.accentHue
        };
    }
}

module.exports = BugGenome;
