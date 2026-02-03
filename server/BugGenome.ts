// Bug Fights - Bug Genome (Server Module)
// Handles bug stats, traits, colors, and breeding

const BUG_COLORS: ReadonlyArray<{ hue: number; sat: number; light: number }> = [
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
] as const;

const WEAPONS = ['mandibles', 'stinger', 'fangs', 'pincers', 'horn'] as const;
const DEFENSES = ['shell', 'none', 'toxic', 'camouflage'] as const;
const MOBILITIES = ['ground', 'winged', 'wallcrawler'] as const;
const WING_TYPES = ['fly', 'beetle', 'dragonfly'] as const;
const TEXTURES = ['smooth', 'plated', 'rough', 'spotted', 'striped'] as const;
const ABDOMEN_TYPES = ['round', 'oval', 'pointed', 'bulbous', 'segmented', 'sac', 'plated', 'tailed'] as const;
const THORAX_TYPES = ['compact', 'elongated', 'wide', 'humped', 'segmented'] as const;
const HEAD_TYPES = ['round', 'triangular', 'square', 'elongated', 'shield'] as const;
const LEG_COUNTS = [4, 6, 8] as const;
const LEG_STYLES = ['insect', 'spider', 'mantis', 'grasshopper', 'beetle', 'stick', 'centipede'] as const;
const EYE_STYLES = ['compound', 'simple', 'stalked', 'multiple', 'sunken'] as const;
const ANTENNA_STYLES = ['segmented', 'clubbed', 'whip', 'horned', 'none', 'nubs'] as const;

const STAT_CAP = 350;
const STAT_MIN = 10;
const STAT_MAX = 100;

function pickRandom<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

class BugGenome {
    bulk!: number;
    speed!: number;
    fury!: number;
    instinct!: number;
    abdomenType!: AbdomenType;
    thoraxType!: ThoraxType;
    headType!: HeadType;
    legCount!: LegCount;
    legStyle!: LegStyle;
    weapon!: WeaponType;
    defense!: DefenseType;
    mobility!: MobilityType;
    textureType!: TextureType;
    eyeStyle!: EyeStyle;
    antennaStyle!: AntennaStyle;
    wingType!: WingType;
    color!: BugColor;
    accentHue!: number;

    constructor(data: GenomeData | null = null) {
        if (data) {
            this.bulk = data.bulk;
            this.speed = data.speed;
            this.fury = data.fury;
            this.instinct = data.instinct;
            this.abdomenType = data.abdomenType;
            this.thoraxType = data.thoraxType;
            this.headType = data.headType;
            this.legCount = data.legCount;
            this.legStyle = data.legStyle;
            this.weapon = data.weapon;
            this.defense = data.defense;
            this.mobility = data.mobility;
            this.textureType = data.textureType;
            this.eyeStyle = data.eyeStyle;
            this.antennaStyle = data.antennaStyle;
            this.wingType = data.wingType;
            this.color = { ...data.color };
            this.accentHue = data.accentHue;
        } else {
            this.randomize();
        }
    }

    randomize(): void {
        const normalRandom = (): number => {
            const u1 = Math.random();
            const u2 = Math.random();
            return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        };

        const generateStat = (): number => {
            const mean = 55;
            const stdDev = 20;
            const value = Math.round(mean + normalRandom() * stdDev);
            return Math.max(STAT_MIN, Math.min(STAT_MAX, value));
        };

        let stats = [generateStat(), generateStat(), generateStat(), generateStat()];

        const total = stats.reduce((a, b) => a + b, 0);
        if (total > STAT_CAP) {
            const scale = STAT_CAP / total;
            stats = stats.map(s => Math.max(STAT_MIN, Math.round(s * scale)));

            let newTotal = stats.reduce((a, b) => a + b, 0);
            while (newTotal > STAT_CAP) {
                const maxIdx = stats.indexOf(Math.max(...stats));
                stats[maxIdx]!--;
                newTotal--;
            }
        }

        [this.bulk, this.speed, this.fury, this.instinct] = stats as [number, number, number, number];

        this.abdomenType = pickRandom(ABDOMEN_TYPES);
        this.thoraxType = pickRandom(THORAX_TYPES);
        this.headType = pickRandom(HEAD_TYPES);
        this.legCount = pickRandom(LEG_COUNTS);
        this.legStyle = pickRandom(LEG_STYLES);
        this.weapon = pickRandom(WEAPONS);
        this.defense = pickRandom(DEFENSES);
        this.mobility = pickRandom(MOBILITIES);
        this.textureType = pickRandom(TEXTURES);
        this.eyeStyle = pickRandom(EYE_STYLES);
        this.antennaStyle = pickRandom(ANTENNA_STYLES);

        // Winged bugs always get a wing type; non-winged bugs are always 'none'
        if (this.mobility === 'winged') {
            this.wingType = pickRandom(WING_TYPES);
        } else {
            this.wingType = 'none';
        }

        // Pick from realistic color palette
        const colorChoice = pickRandom(BUG_COLORS);
        this.color = {
            hue: colorChoice.hue,
            saturation: colorChoice.sat / 100,
            lightness: colorChoice.light / 100
        };
        this.accentHue = (this.color.hue + 30 + Math.random() * 60) % 360;
    }

    breed(other: BugGenome): BugGenome {
        const child = new BugGenome();

        child.bulk = this.inheritStat(this.bulk, other.bulk);
        child.speed = this.inheritStat(this.speed, other.speed);
        child.fury = this.inheritStat(this.fury, other.fury);
        child.instinct = this.inheritStat(this.instinct, other.instinct);

        // Scale stats to target total, clamped to [10, 100]
        const total = child.bulk + child.speed + child.fury + child.instinct;
        const scale = STAT_CAP / total;
        let stats = [
            Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(child.bulk * scale))),
            Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(child.speed * scale))),
            Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(child.fury * scale))),
            Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(child.instinct * scale))),
        ];
        // Adjust for rounding errors - trim from highest stats
        let newTotal = stats.reduce((a, b) => a + b, 0);
        while (newTotal > STAT_CAP) {
            const maxIdx = stats.indexOf(Math.max(...stats));
            stats[maxIdx]!--;
            newTotal--;
        }
        while (newTotal < STAT_CAP) {
            const minIdx = stats.indexOf(Math.min(...stats));
            stats[minIdx]!++;
            newTotal++;
        }
        [child.bulk, child.speed, child.fury, child.instinct] = stats as [number, number, number, number];

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
            const parentWings = [this.wingType, other.wingType].filter(w => w !== 'none') as WingType[];
            if (parentWings.length > 0) {
                child.wingType = pickRandom(parentWings);
            } else {
                child.wingType = pickRandom(WING_TYPES);
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

    inheritStat(a: number, b: number): number {
        const avg = (a + b) / 2;
        const mutation = (Math.random() - 0.5) * 20;
        return Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(avg + mutation)));
    }

    blendHue(h1: number, h2: number): number {
        const diff = h2 - h1;
        if (Math.abs(diff) > 180) {
            return diff > 0 ? (h1 + (diff - 360) / 2 + 360) % 360 : (h1 + (diff + 360) / 2) % 360;
        }
        return (h1 + diff / 2 + 360) % 360;
    }

    getName(): string {
        const prefixes: Record<WeaponType, string[]> = {
            mandibles: ['Crusher', 'Gnasher', 'Chomper', 'Breaker'],
            stinger: ['Piercer', 'Stabber', 'Lancer', 'Spike'],
            fangs: ['Venom', 'Toxic', 'Biter', 'Fang'],
            pincers: ['Gripper', 'Clamper', 'Pincher', 'Snapper'],
            horn: ['Charger', 'Ramhorn', 'Gorer', 'Impaler']
        };
        const suffixes: Record<AbdomenType, string[]> = {
            round: ['Blob', 'Orb', 'Ball', 'Dome'],
            oval: ['Runner', 'Swift', 'Dash', 'Scout'],
            pointed: ['Spike', 'Lance', 'Arrow', 'Dart'],
            bulbous: ['Bulk', 'Mass', 'Tank', 'Heavy'],
            segmented: ['Crawler', 'Creep', 'Chain', 'Link'],
            sac: ['Sack', 'Brood', 'Pouch', 'Vessel'],
            plated: ['Shell', 'Armor', 'Plank', 'Guard'],
            tailed: ['Tail', 'Whip', 'Sting', 'Lash']
        };

        return prefixes[this.weapon][Math.floor(Math.random() * 4)]! + ' ' +
               suffixes[this.abdomenType][Math.floor(Math.random() * 4)]!;
    }

    getSizeMultiplier(): number {
        return 0.6 + (this.bulk / 100) * 0.9;
    }

    toJSON(): GenomeData {
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

export default BugGenome;
