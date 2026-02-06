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

/** Pick from array using weighted probabilities. weights must match arr length. */
function pickWeighted<T>(arr: readonly T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) {
        r -= weights[i]!;
        if (r <= 0) return arr[i]!;
    }
    return arr[arr.length - 1]!;
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

        // Combat traits (not stat-weighted)
        this.weapon = pickRandom(WEAPONS);
        this.defense = pickRandom(DEFENSES);
        this.mobility = pickRandom(MOBILITIES);

        // Visual traits — stat-weighted: form follows function
        const b = this.bulk;
        const s = this.speed;
        const f = this.fury;
        const n = this.instinct; // "n" for iNstinct, avoiding "i" for index

        // Head: fury → triangular, bulk → shield/square
        // [round, triangular, square, elongated, shield]
        this.headType = pickWeighted(HEAD_TYPES, [50, 30 + f, 30 + b * 0.5, 30 + s * 0.5, 20 + b * 0.7]);

        // Thorax: speed → compact, bulk → wide, fury → humped
        // [compact, elongated, wide, humped, segmented]
        this.thoraxType = pickWeighted(THORAX_TYPES, [30 + s * 0.8, 30 + n * 0.5, 30 + b * 0.8, 25 + f * 0.6, 40]);

        // Abdomen: bulk → bulbous/plated, speed → pointed, fury+toxic → sac
        // [round, oval, pointed, bulbous, segmented, sac, plated, tailed]
        const sacWeight = (this.defense === 'toxic') ? 25 + f * 0.6 : 15;
        const platedAbWeight = (this.defense === 'shell') ? 25 + b * 0.5 : 15;
        this.abdomenType = pickWeighted(ABDOMEN_TYPES, [
            40, 40, 30 + s * 0.4, 25 + b * 0.7, 30 + n * 0.4, sacWeight, platedAbWeight, 30,
        ]);

        // Leg count: cosmetic but stat-correlated for coherence
        // [4, 6, 8]
        this.legCount = pickWeighted(LEG_COUNTS, [30 + s * 0.4, 60, 30 + b * 0.4]);

        // Leg style: fury → mantis, speed+ground → grasshopper, wallcrawler → spider
        // [insect, spider, mantis, grasshopper, beetle, stick, centipede]
        const spiderWeight = (this.mobility === 'wallcrawler') ? 40 + n * 0.5 : 20;
        const hopperWeight = (this.mobility === 'ground') ? 20 + s * 0.5 : 15;
        this.legStyle = pickWeighted(LEG_STYLES, [
            40, spiderWeight, 20 + f * 0.5, hopperWeight, 25 + b * 0.3, 25 + s * 0.3, 25,
        ]);

        // Eyes: instinct → compound/stalked
        // [compound, simple, stalked, multiple, sunken]
        this.eyeStyle = pickWeighted(EYE_STYLES, [25 + n * 0.7, 40 - n * 0.2, 20 + n * 0.5, 25 + f * 0.3, 25 + b * 0.3]);

        // Antennae: instinct+speed → whip, instinct → segmented, fury → horned
        // [segmented, clubbed, whip, horned, none, nubs]
        this.antennaStyle = pickWeighted(ANTENNA_STYLES, [
            25 + n * 0.5, 35, 20 + s * 0.3 + n * 0.3, 20 + f * 0.5, 25 + b * 0.3, 30 - n * 0.2,
        ]);

        // Texture: bulk+shell → plated, fury → rough
        // [smooth, plated, rough, spotted, striped]
        const platedTexWeight = (this.defense === 'shell') ? 25 + b * 0.7 : 20 + b * 0.3;
        this.textureType = pickWeighted(TEXTURES, [30 + s * 0.4, platedTexWeight, 25 + f * 0.4, 35, 35]);

        // Wings: only for winged bugs. speed → fly, bulk → beetle, instinct → dragonfly
        if (this.mobility === 'winged') {
            // [fly, beetle, dragonfly]
            this.wingType = pickWeighted(WING_TYPES, [30 + s * 0.6, 25 + b * 0.5, 25 + n * 0.6]);
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

        // 5% per-trait mutation: pick a random value from the pool instead of inheriting
        const inheritTrait = <T>(a: T, b: T, pool: readonly T[]): T => {
            if (Math.random() < 0.05) return pickRandom(pool);
            return Math.random() < 0.5 ? a : b;
        };

        child.bulk = this.inheritStat(this.bulk, other.bulk);
        child.speed = this.inheritStat(this.speed, other.speed);
        child.fury = this.inheritStat(this.fury, other.fury);
        child.instinct = this.inheritStat(this.instinct, other.instinct);

        // Only scale DOWN if over cap (don't inflate weak parents to max stats)
        const total = child.bulk + child.speed + child.fury + child.instinct;
        if (total > STAT_CAP) {
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
            [child.bulk, child.speed, child.fury, child.instinct] = stats as [number, number, number, number];
        }

        child.abdomenType = inheritTrait(this.abdomenType, other.abdomenType, ABDOMEN_TYPES);
        child.thoraxType = inheritTrait(this.thoraxType, other.thoraxType, THORAX_TYPES);
        child.headType = inheritTrait(this.headType, other.headType, HEAD_TYPES);
        child.legCount = inheritTrait(this.legCount, other.legCount, LEG_COUNTS);
        child.legStyle = inheritTrait(this.legStyle, other.legStyle, LEG_STYLES);
        child.weapon = inheritTrait(this.weapon, other.weapon, WEAPONS);
        child.defense = inheritTrait(this.defense, other.defense, DEFENSES);
        child.mobility = inheritTrait(this.mobility, other.mobility, MOBILITIES);
        child.textureType = inheritTrait(this.textureType, other.textureType, TEXTURES);
        child.eyeStyle = inheritTrait(this.eyeStyle, other.eyeStyle, EYE_STYLES);
        child.antennaStyle = inheritTrait(this.antennaStyle, other.antennaStyle, ANTENNA_STYLES);

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
        return 1.0 + ((this.bulk - this.speed) / 100) * 0.55;
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
