// Bug Fights - Bug Genome (Server Module)
// Handles bug stats, traits, colors, and breeding

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

        this.abdomenType = ['round', 'oval', 'pointed', 'bulbous', 'segmented'][Math.floor(Math.random() * 5)];
        this.thoraxType = ['compact', 'elongated', 'wide', 'humped'][Math.floor(Math.random() * 4)];
        this.headType = ['round', 'triangular', 'square', 'elongated', 'pincer'][Math.floor(Math.random() * 5)];

        this.legCount = [4, 6, 8][Math.floor(Math.random() * 3)];
        this.legStyle = ['straight', 'curved-back', 'curved-forward', 'short'][Math.floor(Math.random() * 4)];

        this.pattern = ['solid', 'striped', 'spotted'][Math.floor(Math.random() * 3)];

        this.weapon = ['mandibles', 'stinger', 'fangs', 'claws'][Math.floor(Math.random() * 4)];
        this.defense = ['shell', 'none', 'toxic', 'camouflage'][Math.floor(Math.random() * 4)];
        this.mobility = ['ground', 'winged', 'wallcrawler'][Math.floor(Math.random() * 3)];
        this.textureType = ['smooth', 'plated', 'rough'][Math.floor(Math.random() * 3)];

        this.color = {
            hue: Math.random() * 360,
            saturation: 0.5 + Math.random() * 0.4,
            lightness: 0.35 + Math.random() * 0.25
        };
        this.accentHue = (this.color.hue + 30 + Math.random() * 60) % 360;
        this.patternSeed = Math.floor(Math.random() * 10000);
    }

    breed(other) {
        const child = new BugGenome();

        child.bulk = this.inheritStat(this.bulk, other.bulk);
        child.speed = this.inheritStat(this.speed, other.speed);
        child.fury = this.inheritStat(this.fury, other.fury);
        child.instinct = this.inheritStat(this.instinct, other.instinct);

        const total = child.bulk + child.speed + child.fury + child.instinct;
        const scale = 350 / total;
        child.bulk = Math.round(child.bulk * scale);
        child.speed = Math.round(child.speed * scale);
        child.fury = Math.round(child.fury * scale);
        child.instinct = 350 - child.bulk - child.speed - child.fury;

        child.abdomenType = Math.random() < 0.5 ? this.abdomenType : other.abdomenType;
        child.thoraxType = Math.random() < 0.5 ? this.thoraxType : other.thoraxType;
        child.headType = Math.random() < 0.5 ? this.headType : other.headType;
        child.legStyle = Math.random() < 0.5 ? this.legStyle : other.legStyle;
        child.pattern = Math.random() < 0.5 ? this.pattern : other.pattern;
        child.weapon = Math.random() < 0.5 ? this.weapon : other.weapon;
        child.defense = Math.random() < 0.5 ? this.defense : other.defense;
        child.mobility = Math.random() < 0.5 ? this.mobility : other.mobility;
        child.textureType = Math.random() < 0.5 ? this.textureType : other.textureType;

        child.color = {
            hue: this.blendHue(this.color.hue, other.color.hue),
            saturation: (this.color.saturation + other.color.saturation) / 2,
            lightness: (this.color.lightness + other.color.lightness) / 2
        };
        child.accentHue = this.blendHue(this.accentHue, other.accentHue);
        child.patternSeed = Math.floor(Math.random() * 10000);

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
            claws: ['Slasher', 'Ripper', 'Shredder', 'Razor']
        };
        const suffixes = {
            round: ['Blob', 'Orb', 'Ball', 'Dome'],
            oval: ['Runner', 'Swift', 'Dash', 'Scout'],
            pointed: ['Spike', 'Lance', 'Arrow', 'Dart'],
            bulbous: ['Bulk', 'Mass', 'Tank', 'Heavy'],
            segmented: ['Crawler', 'Creep', 'Chain', 'Link']
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
            pattern: this.pattern,
            weapon: this.weapon,
            defense: this.defense,
            mobility: this.mobility,
            textureType: this.textureType,
            color: this.color,
            accentHue: this.accentHue,
            patternSeed: this.patternSeed
        };
    }
}

module.exports = BugGenome;
