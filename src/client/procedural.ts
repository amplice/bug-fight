// Bug Fights - Client-side BugGenome
// Lightweight: reconstructs genome from server data for 3D rendering.
// Source of truth for genome logic (randomize, breed, naming): server/BugGenome.ts

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

    constructor(data: GenomeData) {
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
        if (data.color) this.color = { ...data.color };
        this.accentHue = data.accentHue;
    }

    getSizeMultiplier(): number {
        return 0.6 + (this.bulk / 100) * 0.9;
    }
}

if (typeof window !== 'undefined') {
    window.BugGenome = BugGenome;
}
