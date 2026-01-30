// Bug Fights - Procedural Bug Generator v6
// Reverting to pre-side-on visuals, keeping new wings

// ============================================
// BUG GENOME STRUCTURE
// ============================================

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
        // Stats are normally distributed (mean ~55, stddev ~20)
        // If total exceeds cap, scale down proportionally
        const STAT_CAP = 350, MIN = 10, MAX = 100;

        // Generate normally distributed stats
        const normalRandom = () => {
            // Box-Muller transform for normal distribution
            const u1 = Math.random();
            const u2 = Math.random();
            return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        };

        const generateStat = () => {
            const mean = 55;
            const stdDev = 20;
            let value = Math.round(mean + normalRandom() * stdDev);
            return Math.max(MIN, Math.min(MAX, value)); // Clamp to valid range
        };

        let stats = [generateStat(), generateStat(), generateStat(), generateStat()];

        // If total exceeds cap, scale down proportionally
        const total = stats.reduce((a, b) => a + b, 0);
        if (total > STAT_CAP) {
            const scale = STAT_CAP / total;
            stats = stats.map(s => Math.max(MIN, Math.round(s * scale)));

            // Adjust for rounding errors - remove from highest stat
            let newTotal = stats.reduce((a, b) => a + b, 0);
            while (newTotal > STAT_CAP) {
                const maxIdx = stats.indexOf(Math.max(...stats));
                stats[maxIdx]--;
                newTotal--;
            }
        }

        [this.bulk, this.speed, this.fury, this.instinct] = stats;

        // Three body segments
        this.abdomenType = ['round', 'oval', 'pointed', 'bulbous', 'segmented', 'sac', 'plated', 'tailed'][Math.floor(Math.random() * 8)];
        this.thoraxType = ['compact', 'elongated', 'wide', 'humped', 'segmented'][Math.floor(Math.random() * 5)];
        this.headType = ['round', 'triangular', 'square', 'elongated', 'shield'][Math.floor(Math.random() * 5)];

        // Leg count and style
        this.legCount = [4, 6, 8][Math.floor(Math.random() * 3)];
        this.legStyle = ['insect', 'spider', 'mantis', 'grasshopper', 'beetle', 'stick', 'centipede'][Math.floor(Math.random() * 7)];

        // Combat types
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

        // Color
        this.color = {
            hue: Math.random() * 360,
            saturation: 0.5 + Math.random() * 0.4,
            lightness: 0.35 + Math.random() * 0.25
        };
        this.accentHue = (this.color.hue + 30 + Math.random() * 60) % 360;
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
        child.legCount = Math.random() < 0.5 ? this.legCount : other.legCount;
        child.legStyle = Math.random() < 0.5 ? this.legStyle : other.legStyle;
        child.weapon = Math.random() < 0.5 ? this.weapon : other.weapon;
        child.defense = Math.random() < 0.5 ? this.defense : other.defense;
        child.mobility = Math.random() < 0.5 ? this.mobility : other.mobility;
        child.textureType = Math.random() < 0.5 ? this.textureType : other.textureType;
        child.eyeStyle = Math.random() < 0.5 ? this.eyeStyle : other.eyeStyle;
        child.antennaStyle = Math.random() < 0.5 ? this.antennaStyle : other.antennaStyle;
        if (child.mobility === 'winged') {
            const parentWings = [this.wingType, other.wingType].filter(w => w !== 'none');
            child.wingType = parentWings.length > 0
                ? parentWings[Math.floor(Math.random() * parentWings.length)]
                : ['fly', 'beetle', 'dragonfly'][Math.floor(Math.random() * 3)];
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
}

// ============================================
// SPRITE GENERATOR
// ============================================

class BugSpriteGenerator {
    constructor(genome) {
        this.genome = genome;
        this.sizeMult = genome.getSizeMultiplier();
        this.size = Math.round(32 * this.sizeMult);
        this.size = Math.max(20, Math.min(48, this.size));

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.ctx = this.canvas.getContext('2d');

        this.colors = this.generatePalette();
    }

    generatePalette() {
        const h = this.genome.color.hue;
        const s = this.genome.color.saturation;
        const l = this.genome.color.lightness;
        const ah = this.genome.accentHue;

        return [
            'transparent',
            this.hslToHex(h, s, l * 0.4),       // 1: Dark outline
            this.hslToHex(h, s, l * 0.7),       // 2: Shadow
            this.hslToHex(h, s, l),              // 3: Base color
            this.hslToHex(h, s * 0.8, l * 1.3),  // 4: Highlight
            this.hslToHex(0, 0, 0.15),           // 5: Dark pattern
            this.hslToHex(0, 0, 0.9),            // 6: Light pattern
            this.hslToHex(120, 0.9, 0.45)        // 7: Toxic green
        ];
    }

    hslToHex(h, s, l) {
        l = Math.max(0, Math.min(1, l));
        s = Math.max(0, Math.min(1, s));
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    generateFrame(state = 'idle', frameNum = 0) {
        const grid = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
        const scale = this.size / 32;

        // Bug faces RIGHT, centered in canvas
        const centerY = Math.floor(this.size / 2);

        // Segment positions - shifted right to give abdomen room
        const gap = Math.ceil(scale);
        const thoraxX = Math.floor(16 * scale);
        const abdomenX = Math.floor(10 * scale);

        // Adjust head position based on thorax/head combo to reduce gaps
        let headOffset = 0;
        const g = this.genome;
        const smallerThoraxes = ['compact', 'humped', 'wide'];
        if (smallerThoraxes.includes(g.thoraxType)) {
            if (g.headType === 'round' || g.headType === 'square') {
                headOffset = -Math.floor(2 * scale);
            } else if (g.headType === 'triangular') {
                headOffset = g.thoraxType === 'compact' ? -Math.floor(2 * scale) : -Math.floor(1 * scale);
            }
        }
        const headX = Math.floor(24 * scale) + headOffset;

        // Animation offsets
        const breathe = Math.sin(frameNum * Math.PI / 2) * scale * 0.5;
        const isAttacking = state === 'attack' && frameNum >= 2;

        // Draw legs first (behind body)
        this.drawLegs(grid, thoraxX, centerY, scale, state, frameNum);

        // Draw the three body segments
        this.drawAbdomen(grid, abdomenX, centerY, scale, state, frameNum);
        this.drawThorax(grid, thoraxX, centerY, scale, state, frameNum);
        this.drawHead(grid, headX, centerY, scale, state, frameNum);

        // Draw features
        if (this.genome.mobility === 'winged') {
            this.drawWings(grid, thoraxX, centerY, scale, state, frameNum);
        }

        this.drawWeapon(grid, headX, centerY, scale, state, frameNum);
        this.drawAntennae(grid, headX, centerY, scale, state, frameNum);

        if (this.genome.weapon === 'stinger') {
            this.drawStinger(grid, abdomenX, centerY, scale, state, frameNum);
        }

        // Toxic defense: add dripping venom
        if (this.genome.defense === 'toxic') {
            this.drawToxicDrip(grid, headX, centerY, scale, frameNum);
        }

        // Apply pattern
        this.applyPattern(grid);

        // Death transform
        if (state === 'death' && frameNum >= 2) {
            this.applyDeathTransform(grid, frameNum);
        }

        return grid;
    }

    // ==================== ABDOMEN TYPES ====================
    drawAbdomen(grid, cx, cy, scale, state, frameNum) {
        const g = this.genome;
        const squash = state === 'hit' ? 1.3 : 1;

        switch (g.abdomenType) {
            case 'round':
                this.drawRoundAbdomen(grid, cx, cy, scale, squash);
                break;
            case 'oval':
                this.drawOvalAbdomen(grid, cx, cy, scale, squash);
                break;
            case 'pointed':
                this.drawPointedAbdomen(grid, cx, cy, scale, squash);
                break;
            case 'bulbous':
                this.drawBulbousAbdomen(grid, cx, cy, scale, squash);
                break;
            case 'segmented':
                this.drawSegmentedAbdomen(grid, cx, cy, scale, squash);
                break;
            case 'sac':
                // Spider-like translucent sac - render as bigger round
                this.drawRoundAbdomen(grid, cx, cy, scale * 1.2, squash);
                break;
            case 'plated':
                // Pillbug-style overlapping plates - render as round with lines
                this.drawRoundAbdomen(grid, cx, cy, scale, squash);
                break;
            case 'tailed':
                // Wasp-style with tail - render as pointed
                this.drawPointedAbdomen(grid, cx, cy, scale, squash);
                break;
        }
    }

    drawRoundAbdomen(grid, cx, cy, scale, squash) {
        const r = Math.floor(5 * scale * squash);
        this.fillOval(grid, cx, cy, r, r, 3, 2, 1);
    }

    drawOvalAbdomen(grid, cx, cy, scale, squash) {
        const rx = Math.floor(6 * scale * squash);
        const ry = Math.floor(4 * scale);
        this.fillOval(grid, cx, cy, rx, ry, 3, 2, 1);
    }

    drawPointedAbdomen(grid, cx, cy, scale, squash) {
        const len = Math.floor(7 * scale);
        const maxH = Math.floor(4 * scale);
        // Draw the pointed part extending backward (left)
        for (let x = 0; x < len; x++) {
            const progress = x / len;
            const h = Math.floor(maxH * (1 - progress * 0.7));
            for (let y = -h; y <= h; y++) {
                const px = cx - x;
                const py = cy + y;
                if (this.inBounds(px, py)) {
                    grid[py][px] = Math.abs(y) < h * 0.6 ? 3 : (Math.abs(y) < h ? 2 : 1);
                }
            }
        }
        // Extend toward thorax (right) with a rounded connection
        const extendLen = Math.floor(4 * scale);
        for (let x = 1; x <= extendLen; x++) {
            const progress = x / extendLen;
            const h = Math.floor(maxH * (1 - progress * 0.3));
            for (let y = -h; y <= h; y++) {
                const px = cx + x;
                const py = cy + y;
                if (this.inBounds(px, py)) {
                    grid[py][px] = Math.abs(y) < h * 0.6 ? 3 : (Math.abs(y) < h ? 2 : 1);
                }
            }
        }
    }

    drawBulbousAbdomen(grid, cx, cy, scale, squash) {
        const rx = Math.floor(7 * scale * squash);
        const ry = Math.floor(6 * scale);
        this.fillOval(grid, cx - Math.floor(scale), cy, rx, ry, 3, 2, 1);
        this.fillOval(grid, cx - Math.floor(2 * scale), cy - Math.floor(scale),
                      Math.floor(2 * scale), Math.floor(2 * scale), 4, 4, 4);
    }

    drawSegmentedAbdomen(grid, cx, cy, scale, squash) {
        const segments = 3;
        const segR = Math.floor(3 * scale);
        for (let i = 0; i < segments; i++) {
            const sx = cx - i * Math.floor(3.5 * scale);
            this.fillOval(grid, sx, cy, segR, Math.floor(segR * 0.9), 3, 2, 1);
        }
    }

    // ==================== THORAX TYPES ====================
    drawThorax(grid, cx, cy, scale, state, frameNum) {
        const g = this.genome;

        switch (g.thoraxType) {
            case 'compact':
                this.drawCompactThorax(grid, cx, cy, scale);
                break;
            case 'elongated':
                this.drawElongatedThorax(grid, cx, cy, scale);
                break;
            case 'wide':
                this.drawWideThorax(grid, cx, cy, scale);
                break;
            case 'humped':
                this.drawHumpedThorax(grid, cx, cy, scale);
                break;
            case 'segmented':
                // Segmented thorax - like elongated with bands
                this.drawElongatedThorax(grid, cx, cy, scale);
                break;
        }

        // Shell defense: add armor plates
        if (g.defense === 'shell') {
            this.drawShellArmor(grid, cx, cy, scale);
        }
    }

    drawShellArmor(grid, cx, cy, scale) {
        // Shell defense: add extra dark pixel layer around thorax/abdomen
        // Only apply to body area (above center + a bit), not legs
        const centerY = Math.floor(this.size / 2);
        const maxY = centerY + Math.floor(3 * scale); // Don't go too far below center

        // First pass: find all empty pixels adjacent to body pixels
        const shellPixels = [];
        for (let y = 1; y < this.size - 1; y++) {
            // Skip leg area (below body)
            if (y > maxY) continue;

            for (let x = 1; x < this.size - 1; x++) {
                if (grid[y][x] === 0) {
                    // Check if adjacent to any body pixel
                    const hasBodyNeighbor =
                        (grid[y-1][x] !== 0 && grid[y-1][x] !== 4) ||
                        (grid[y+1][x] !== 0 && grid[y+1][x] !== 4) ||
                        (grid[y][x-1] !== 0 && grid[y][x-1] !== 4) ||
                        (grid[y][x+1] !== 0 && grid[y][x+1] !== 4);
                    if (hasBodyNeighbor) {
                        shellPixels.push({x, y});
                    }
                }
            }
        }
        // Second pass: fill in shell pixels
        for (const p of shellPixels) {
            grid[p.y][p.x] = 1; // Dark shell color
        }
    }

    drawCompactThorax(grid, cx, cy, scale) {
        const r = Math.floor(3 * scale);
        this.fillOval(grid, cx, cy, r, r, 3, 2, 1);
    }

    drawElongatedThorax(grid, cx, cy, scale) {
        const rx = Math.floor(5 * scale);
        const ry = Math.floor(2.5 * scale);
        this.fillOval(grid, cx, cy, rx, ry, 3, 2, 1);
    }

    drawWideThorax(grid, cx, cy, scale) {
        const rx = Math.floor(3.5 * scale);
        const ry = Math.floor(4 * scale);
        this.fillOval(grid, cx, cy, rx, ry, 3, 2, 1);
    }

    drawHumpedThorax(grid, cx, cy, scale) {
        const rx = Math.floor(3.5 * scale);
        const ry = Math.floor(3 * scale);
        this.fillOval(grid, cx, cy, rx, ry, 3, 2, 1);
        this.fillOval(grid, cx, cy - Math.floor(2 * scale),
                      Math.floor(2 * scale), Math.floor(2 * scale), 4, 3, 2);
    }

    // ==================== HEAD TYPES ====================
    drawHead(grid, cx, cy, scale, state, frameNum) {
        const g = this.genome;
        const extend = (state === 'attack' && frameNum >= 2) ? Math.floor(2 * scale) : 0;
        const headX = cx + extend;

        switch (g.headType) {
            case 'round':
                this.drawRoundHead(grid, headX, cy, scale);
                break;
            case 'triangular':
                this.drawTriangularHead(grid, headX, cy, scale);
                break;
            case 'square':
                this.drawSquareHead(grid, headX, cy, scale);
                break;
            case 'elongated':
                this.drawElongatedHead(grid, headX, cy, scale);
                break;
            case 'shield':
                this.drawShieldHead(grid, headX, cy, scale);
                break;
        }

        this.drawEyes(grid, headX, cy, scale);
    }

    drawRoundHead(grid, cx, cy, scale) {
        const r = Math.floor(3 * scale);
        this.fillOval(grid, cx, cy, r, r, 3, 2, 1);
    }

    drawTriangularHead(grid, cx, cy, scale) {
        const w = Math.floor(4 * scale);
        const h = Math.floor(3 * scale);
        // Draw the pointed part extending forward (right)
        for (let x = 0; x <= w; x++) {
            const progress = x / w;
            const halfH = Math.floor(h * (1 - progress));
            for (let y = -halfH; y <= halfH; y++) {
                const px = cx + x;
                const py = cy + y;
                if (this.inBounds(px, py)) {
                    grid[py][px] = Math.abs(y) < halfH * 0.5 ? 3 : 2;
                }
            }
        }
        // Extend backward toward thorax (left) with rounded connection
        const extendLen = Math.floor(3 * scale);
        for (let x = 1; x <= extendLen; x++) {
            const progress = x / extendLen;
            const halfH = Math.floor(h * (1 - progress * 0.4));
            for (let y = -halfH; y <= halfH; y++) {
                const px = cx - x;
                const py = cy + y;
                if (this.inBounds(px, py)) {
                    grid[py][px] = Math.abs(y) < halfH * 0.5 ? 3 : 2;
                }
            }
        }
        // Outline at the base
        for (let y = -h; y <= h; y++) {
            if (this.inBounds(cx, cy + y)) grid[cy + y][cx] = 1;
        }
    }

    drawSquareHead(grid, cx, cy, scale) {
        const s = Math.floor(3 * scale);
        for (let x = -s; x <= s; x++) {
            for (let y = -s; y <= s; y++) {
                const px = cx + x;
                const py = cy + y;
                if (this.inBounds(px, py)) {
                    const edge = Math.abs(x) === s || Math.abs(y) === s;
                    const nearEdge = Math.abs(x) >= s - 1 || Math.abs(y) >= s - 1;
                    grid[py][px] = edge ? 1 : (nearEdge ? 2 : 3);
                }
            }
        }
    }

    drawElongatedHead(grid, cx, cy, scale) {
        const rx = Math.floor(5 * scale);
        const ry = Math.floor(2.5 * scale);
        this.fillOval(grid, cx + Math.floor(scale), cy, rx, ry, 3, 2, 1);
    }

    drawShieldHead(grid, cx, cy, scale) {
        // Broad, flat, protective shield-bug head
        const rx = Math.floor(4 * scale);
        const ry = Math.floor(4 * scale);
        this.fillOval(grid, cx, cy, rx, ry, 3, 2, 1);
        // Flat front edge
        for (let y = -ry + 1; y < ry; y++) {
            const px = cx + Math.floor(2.5 * scale);
            if (this.inBounds(px, cy + y)) grid[cy + y][px] = 1;
        }
    }

    drawEyes(grid, cx, cy, scale) {
        const eyeR = Math.max(1, Math.floor(scale * 0.8));
        const eyeOffset = Math.floor(2 * scale);
        for (const yOff of [-eyeOffset, eyeOffset]) {
            const ex = cx + Math.floor(scale);
            const ey = cy + Math.floor(yOff * 0.6);
            if (this.inBounds(ex, ey)) {
                grid[ey][ex] = 4;
                if (this.inBounds(ex + 1, ey)) grid[ey][ex + 1] = 1;
            }
        }
    }

    // ==================== LEG STYLES ====================
    drawLegs(grid, cx, cy, scale, state, frameNum) {
        const g = this.genome;
        let legCount = g.legCount || 6;
        const legLen = Math.floor((5 + g.speed / 40) * scale);

        const animPhase = frameNum * Math.PI / 2;

        // Span legs across the whole body (from abdomen to head area)
        const totalSpan = Math.floor(16 * scale);

        // Reduce leg count at small scales to prevent cramping
        const minSpacing = 2;
        const maxLegs = Math.floor(totalSpan / minSpacing) + 1;
        if (legCount > maxLegs) {
            legCount = Math.max(2, maxLegs);
        }

        const spacing = legCount > 1 ? totalSpan / (legCount - 1) : 0;
        const startOffset = -totalSpan / 2;

        for (let i = 0; i < legCount; i++) {
            const xOffset = legCount > 1 ? startOffset + i * spacing : 0;
            const legPhase = animPhase + i * Math.PI / legCount;
            const anim = state === 'idle' ? Math.sin(legPhase) * scale * 0.5 : 0;

            const startX = cx + xOffset;
            const startY = cy + Math.floor(1 * scale); // Start legs lower, below body center

            const isWallcrawler = g.mobility === 'wallcrawler';

            // Map leg styles to 2D rendering
            const style = g.legStyle || 'insect';
            if (style === 'insect' || style === 'beetle') {
                this.drawStraightLeg(grid, startX, startY, legLen, anim, scale, isWallcrawler);
            } else if (style === 'spider') {
                this.drawCurvedLeg(grid, startX, startY, legLen, anim, scale, -1, isWallcrawler);
            } else if (style === 'mantis' || style === 'grasshopper') {
                this.drawCurvedLeg(grid, startX, startY, legLen, anim, scale, 1, isWallcrawler);
            } else if (style === 'stick') {
                this.drawStraightLeg(grid, startX, startY, Math.floor(legLen * 1.3), anim, scale, isWallcrawler);
            } else if (style === 'centipede') {
                this.drawStraightLeg(grid, startX, startY, Math.floor(legLen * 0.7), anim, scale, isWallcrawler);
            } else {
                this.drawStraightLeg(grid, startX, startY, legLen, anim, scale, isWallcrawler);
            }
        }
    }

    drawStraightLeg(grid, x, y, len, anim, scale, isWallcrawler) {
        // Simple straight leg going down
        for (let i = 1; i <= len; i++) {
            const lx = Math.floor(x);
            const ly = Math.floor(y + i + anim * (i / len));
            // Wallcrawler: foot tip is lighter color
            const color = (isWallcrawler && i === len) ? 4 : 1;
            if (this.inBounds(lx, ly)) grid[ly][lx] = color;
        }
    }

    drawCurvedLeg(grid, x, y, len, anim, scale, dir, isWallcrawler) {
        // Curved leg like ( or )
        let prevLx = Math.round(x);
        let prevLy = Math.floor(y + 1);

        for (let i = 1; i <= len; i++) {
            const t = i / len;
            // Curve peaks in middle, returns to straight at end
            const curve = Math.sin(t * Math.PI) * 3 * dir;
            const lx = Math.round(x + curve);
            const ly = Math.floor(y + i + anim * (i / len));

            // Wallcrawler: foot tip is lighter color
            const color = (isWallcrawler && i === len) ? 4 : 1;

            // Draw pixel at current position
            if (this.inBounds(lx, ly)) grid[ly][lx] = color;

            // Fill any gaps between previous and current position
            const dx = lx - prevLx;
            if (Math.abs(dx) > 1) {
                // Fill horizontal gap
                const stepX = dx > 0 ? 1 : -1;
                for (let fx = prevLx + stepX; fx !== lx; fx += stepX) {
                    if (this.inBounds(fx, ly)) grid[ly][fx] = 1;
                    if (this.inBounds(fx, prevLy)) grid[prevLy][fx] = 1;
                }
            }

            prevLx = lx;
            prevLy = ly;
        }
    }

    // ==================== WINGS (NEW STYLE - FROM TOP) ====================
    drawWings(grid, cx, cy, scale, state, frameNum) {
        const wingLen = Math.floor(10 * scale);
        const wingH = Math.floor(6 * scale);
        const flapPhase = Math.sin(frameNum * Math.PI * 0.5);
        const flapAngle = flapPhase * 0.4;

        // Start wings higher up, above the body
        const wingBaseY = cy - Math.floor(5 * scale);

        for (let i = 0; i < wingLen; i++) {
            const progress = i / wingLen;
            const wx = cx - Math.floor(i * 0.5);
            const heightAtPoint = Math.floor(wingH * (1 - progress * 0.4));

            for (let h = 0; h < heightAtPoint; h++) {
                const wy = wingBaseY - h - Math.floor(i * flapAngle);
                if (this.inBounds(wx, wy) && grid[wy][wx] === 0) {
                    grid[wy][wx] = (h === 0 || i === 0) ? 1 : 4;
                }
            }
        }

        // Wing vein
        for (let i = 2; i < wingLen - 2; i++) {
            const vx = cx - Math.floor(i * 0.5);
            const vy = wingBaseY - Math.floor(3 * scale) - Math.floor(i * flapAngle);
            if (this.inBounds(vx, vy)) grid[vy][vx] = 1;
        }
    }

    // ==================== WEAPONS ====================
    drawWeapon(grid, headX, cy, scale, state, frameNum) {
        const g = this.genome;
        if (g.weapon === 'stinger') return;

        const attacking = (state === 'attack' && frameNum >= 2);
        const weaponSize = Math.floor((2 + g.fury / 40) * scale);

        switch (g.weapon) {
            case 'mandibles':
                const extend = attacking ? Math.floor(3 * scale) : 0;
                this.drawMandibles(grid, headX, cy, scale, weaponSize, extend);
                break;
            case 'fangs':
                this.drawFangs(grid, headX, cy, scale, weaponSize, attacking);
                break;
            case 'pincers':
                // Pincers render as wider mandibles
                const pExtend = attacking ? Math.floor(3 * scale) : 0;
                this.drawMandibles(grid, headX, cy, scale, Math.floor(weaponSize * 1.3), pExtend);
                break;
            case 'horn':
                // Horn renders as a forward spike
                const hornLen = weaponSize + Math.floor(3 * scale);
                const hornExtend = attacking ? Math.floor(2 * scale) : 0;
                for (let i = 0; i <= hornLen + hornExtend; i++) {
                    const hx = headX + Math.floor(2 * scale) + i;
                    if (this.inBounds(hx, cy)) grid[cy][hx] = 1;
                    if (i < hornLen * 0.6 && this.inBounds(hx, cy - 1)) grid[cy - 1][hx] = 1;
                }
                break;
        }
    }

    drawMandibles(grid, hx, cy, scale, size, extend) {
        for (const side of [-1, 1]) {
            for (let i = 0; i <= size; i++) {
                const progress = i / size;
                const spread = Math.floor(side * (1 + i * 0.6) * scale);
                const mx = hx + Math.floor(2 * scale) + i + extend;
                const my = cy + spread;

                if (this.inBounds(mx, my)) grid[my][mx] = 1;
                if (this.inBounds(mx, my - side)) grid[my - side][mx] = 1;
            }
            const tipX = hx + Math.floor(2 * scale) + size + extend;
            const tipY = cy + Math.floor(side * (1 + size * 0.6) * scale);
            if (this.inBounds(tipX + 1, tipY)) grid[tipY][tipX + 1] = 1;
        }
    }

    drawFangs(grid, hx, cy, scale, size, attacking) {
        const fangLen = size + Math.floor(2 * scale);

        // During attack: fangs thrust forward and close together in a bite
        const biteExtend = attacking ? Math.floor(2 * scale) : 0;
        const biteClose = attacking ? 0.3 : 1.0; // Multiplier for how spread apart fangs are

        for (const side of [-1, 1]) {
            const baseX = hx + Math.floor(2 * scale) + biteExtend;
            const baseY = cy + side * Math.floor(scale * 0.5 * biteClose);

            // Draw thicker, longer fangs - during attack they curve inward
            for (let i = 0; i <= fangLen; i++) {
                const progress = i / fangLen;
                // Fangs close together during attack (reduce spread at tip)
                const spreadMult = attacking ? (1 - progress * 0.7) : 1;
                const fx = baseX + Math.floor(i * 0.4) + (attacking ? Math.floor(i * 0.2) : 0);
                const fy = baseY + side * Math.floor(i * spreadMult);
                if (this.inBounds(fx, fy)) grid[fy][fx] = 1;
                if (this.inBounds(fx + 1, fy)) grid[fy][fx + 1] = 1;
            }

            // Sharp tip - comes closer together during attack
            const tipSpread = attacking ? 0.3 : 1;
            const tipX = baseX + Math.floor(fangLen * 0.4) + 1 + (attacking ? Math.floor(fangLen * 0.2) : 0);
            const tipY = baseY + side * Math.floor((fangLen + 1) * tipSpread);
            if (this.inBounds(tipX, tipY)) grid[tipY][tipX] = 1;
        }

        // Venom drip - only when not attacking
        if (this.genome.fury > 50 && !attacking) {
            const dripX = hx + Math.floor(3 * scale);
            const dripY = cy + Math.floor(fangLen + 3);
            if (this.inBounds(dripX, dripY)) grid[dripY][dripX] = 6;
            if (this.inBounds(dripX, dripY + 1)) grid[dripY + 1][dripX] = 6;
        }
    }

    drawStinger(grid, abdX, cy, scale, state, frameNum) {
        // Scorpion-style tail that curves high up and over the body
        const tailLen = Math.floor((9 + this.genome.fury / 25) * scale);
        const tailHeight = Math.floor(7 * scale);

        // Attack state - tail strikes forward and down
        const attacking = (state === 'attack' && frameNum >= 2);

        // Start position - higher up and further back on abdomen
        const startX = abdX - Math.floor(6 * scale);
        const startY = cy - Math.floor(3 * scale); // Start above centerline

        // Head position for reference - stinger needs to reach PAST this during attack
        const headX = Math.floor(24 * scale);
        const forwardReach = headX - startX + Math.floor(8 * scale); // How far past the head

        // Draw tail curving up and then forward over the body
        // Use more iterations for smoother curve, track previous position to fill gaps
        const iterations = tailLen * 3; // More iterations = smoother
        let prevX = null, prevY = null;

        for (let i = 0; i <= iterations; i++) {
            const t = i / iterations;

            let xCurve, yCurve;

            if (attacking) {
                // Attack pose: tail straightens and THRUSTS forward past the head
                // Then the tip strikes DOWN at the enemy
                xCurve = t * forwardReach; // Extend all the way forward past head

                // Y: slight rise at start, then curves down to strike level
                if (t < 0.3) {
                    // Initial rise
                    yCurve = Math.sin(t / 0.3 * Math.PI * 0.5) * tailHeight * 0.5;
                } else {
                    // Descend to strike - ends at or below center line
                    const descendProgress = (t - 0.3) / 0.7;
                    const peakHeight = tailHeight * 0.5;
                    yCurve = peakHeight * (1 - descendProgress * 1.5); // Goes below center
                }
            } else {
                // Normal pose: curved scorpion tail
                xCurve = t < 0.3
                    ? -t * 2 * Math.floor(2 * scale)  // go back slightly
                    : -Math.floor(2 * scale) + (t - 0.3) * 1.5 * Math.floor(10 * scale); // come forward

                // Y: curves up high, stays high (less dip at end)
                yCurve = Math.sin(t * Math.PI * 0.7) * tailHeight;
            }

            const sx = Math.floor(startX + xCurve);
            const sy = Math.floor(startY - yCurve);

            // Fill gaps between previous and current position
            if (prevX !== null && prevY !== null) {
                const dx = sx - prevX;
                const dy = sy - prevY;
                const steps = Math.max(Math.abs(dx), Math.abs(dy));
                for (let s = 0; s <= steps; s++) {
                    const fx = Math.floor(prevX + (dx * s / Math.max(steps, 1)));
                    const fy = Math.floor(prevY + (dy * s / Math.max(steps, 1)));
                    if (this.inBounds(fx, fy)) grid[fy][fx] = 1;
                    if (this.inBounds(fx, fy + 1)) grid[fy + 1][fx] = 1;
                }
            }

            // Draw tail segment (2px thick)
            if (this.inBounds(sx, sy)) grid[sy][sx] = 1;
            if (this.inBounds(sx, sy + 1)) grid[sy + 1][sx] = 1;

            prevX = sx;
            prevY = sy;
        }

        // Stinger tip position
        let tipX, tipY;
        if (attacking) {
            // Tip ends past the head, at strike level (slightly below center)
            tipX = Math.floor(startX + forwardReach) + Math.floor(2 * scale);
            tipY = Math.floor(startY - tailHeight * 0.5 * (1 - 1.5)) + Math.floor(1 * scale);
        } else {
            const tipXCurve = -Math.floor(2 * scale) + 0.7 * 1.5 * Math.floor(10 * scale);
            const tipYCurve = Math.sin(0.7 * Math.PI) * tailHeight;
            tipX = Math.floor(startX + tipXCurve) + Math.floor(2 * scale);
            tipY = Math.floor(startY - tipYCurve);
        }

        // Draw sharp stinger point - use highlight color during attack
        const tipColor = attacking ? 6 : 4; // brighter during strike
        if (this.inBounds(tipX, tipY)) grid[tipY][tipX] = tipColor;
        if (this.inBounds(tipX + 1, tipY)) grid[tipY][tipX + 1] = tipColor;
        if (this.inBounds(tipX + 1, tipY + 1)) grid[tipY + 1][tipX + 1] = 1;

        // Add venom splash during attack - spray forward
        if (attacking) {
            for (let v = 0; v < 3; v++) {
                const vx = tipX + 2 + v;
                const vy = tipY + (v % 2);
                if (this.inBounds(vx, vy)) grid[vy][vx] = 6;
            }
        }
    }

    drawToxicDrip(grid, headX, cy, scale, frameNum) {
        // Toxic bugs have green venom dripping from mouth area
        const dripX = headX + Math.floor(2 * scale);
        const dripStartY = cy + Math.floor(1 * scale);

        // Animated drip that moves down over frames
        const dripOffset = frameNum % 4;
        const dripLen = 2 + Math.floor(scale);

        for (let i = 0; i < dripLen; i++) {
            const dy = dripStartY + i + dripOffset;
            if (this.inBounds(dripX, dy)) {
                grid[dy][dripX] = 7; // Toxic green
            }
        }

        // Second smaller drip offset
        const drip2X = dripX - Math.floor(1 * scale);
        const drip2Offset = (frameNum + 2) % 4;
        for (let i = 0; i < Math.floor(dripLen * 0.6); i++) {
            const dy = dripStartY + i + drip2Offset;
            if (this.inBounds(drip2X, dy)) {
                grid[dy][drip2X] = 7; // Toxic green
            }
        }
    }

    drawAntennae(grid, hx, cy, scale, state, frameNum) {
        const antennaLen = Math.floor((2 + this.genome.instinct / 40) * scale);
        const wave = Math.sin(frameNum * Math.PI / 2) * scale * 0.5;

        for (const side of [-1, 1]) {
            for (let i = 1; i <= antennaLen; i++) {
                const ax = hx + Math.floor(2 * scale) + i;
                const ay = cy + side * Math.floor(i * 0.8 + wave);
                if (this.inBounds(ax, ay)) grid[ay][ax] = 1;
            }
            const tipX = hx + Math.floor(2 * scale) + antennaLen + 1;
            const tipY = cy + side * Math.floor(antennaLen * 0.8 + wave);
            if (this.inBounds(tipX, tipY)) grid[tipY][tipX] = 4;
        }
    }

    // ==================== PATTERNS ====================
    applyPattern(grid) {
        const g = this.genome;

        // Spotted and striped are texture types
        if (g.textureType === 'spotted') {
            this.applySpots(grid);
        } else if (g.textureType === 'striped') {
            this.applyStripes(grid);
        }
    }

    applyStripes(grid) {
        const stripeWidth = 3;
        const stripeColor = this.genome.color.lightness > 0.45 ? 5 : 6;

        for (let y = 0; y < this.size; y++) {
            // Horizontal stripes
            const inStripe = Math.floor(y / stripeWidth) % 2 === 0;
            if (!inStripe) continue;

            for (let x = 0; x < this.size; x++) {
                if (grid[y][x] === 3) { // Only on body color
                    grid[y][x] = stripeColor;
                }
            }
        }
    }

    applySpots(grid) {
        const seed = Math.floor(Math.random() * 10000);
        const spotCount = 5 + (seed % 4);

        const seededRandom = (n) => {
            const x = Math.sin(seed + n * 127.1) * 43758.5453;
            return x - Math.floor(x);
        };

        for (let i = 0; i < spotCount; i++) {
            const sx = Math.floor(seededRandom(i * 2) * this.size);
            const sy = Math.floor(seededRandom(i * 2 + 1) * this.size);
            const spotColor = this.genome.color.lightness > 0.45 ? 5 : 6;

            if (this.inBounds(sx, sy) && grid[sy][sx] === 3) {
                grid[sy][sx] = spotColor;
                for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                    if (this.inBounds(sx+dx, sy+dy) && grid[sy+dy][sx+dx] === 3) {
                        grid[sy+dy][sx+dx] = spotColor;
                    }
                }
            }
        }
    }

    applyDeathTransform(grid, frameNum) {
        const shift = Math.min(frameNum - 1, 4);
        const newGrid = Array(this.size).fill(null).map(() => Array(this.size).fill(0));

        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const newY = Math.min(this.size - 1, y + shift);
                if (grid[y][x] !== 0) {
                    newGrid[newY][x] = grid[y][x];
                }
            }
        }

        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                grid[y][x] = newGrid[y][x];
            }
        }
    }

    // ==================== UTILITIES ====================
    inBounds(x, y) {
        return x >= 0 && x < this.size && y >= 0 && y < this.size;
    }

    fillOval(grid, cx, cy, rx, ry, fillColor, midColor, outlineColor) {
        rx = Math.max(1, Math.floor(rx));
        ry = Math.max(1, Math.floor(ry));

        for (let y = -ry - 1; y <= ry + 1; y++) {
            for (let x = -rx - 1; x <= rx + 1; x++) {
                const px = Math.floor(cx + x);
                const py = Math.floor(cy + y);
                if (!this.inBounds(px, py)) continue;

                const dist = (x * x) / (rx * rx) + (y * y) / (ry * ry);
                if (dist < 0.5) grid[py][px] = fillColor;
                else if (dist < 0.85) grid[py][px] = midColor;
                else if (dist < 1.1) grid[py][px] = outlineColor;
            }
        }
    }

    generateAllFrames() {
        const frames = { idle: [], attack: [], hit: [], death: [] };

        for (let i = 0; i < 4; i++) frames.idle.push(this.frameToStrings(this.generateFrame('idle', i)));
        for (let i = 0; i < 4; i++) frames.attack.push(this.frameToStrings(this.generateFrame('attack', i)));
        for (let i = 0; i < 2; i++) frames.hit.push(this.frameToStrings(this.generateFrame('hit', i)));
        for (let i = 0; i < 4; i++) frames.death.push(this.frameToStrings(this.generateFrame('death', i)));

        return { colors: this.colors, size: this.size, ...frames };
    }

    frameToStrings(grid) {
        return grid.map(row => row.join(''));
    }
}

// ============================================
// BUG FACTORY
// ============================================

class BugFactory {
    static createRandom() {
        const genome = new BugGenome();
        return BugFactory.createFromGenome(genome);
    }

    static createFromGenome(genome) {
        const generator = new BugSpriteGenerator(genome);
        const sprite = generator.generateAllFrames();

        return {
            genome: genome,
            name: genome.getName(),
            sprite: sprite,
            size: sprite.size,
            data: {
                name: genome.getName(),
                stats: {
                    BULK: genome.bulk,
                    SPEED: genome.speed,
                    FURY: genome.fury,
                    INSTINCT: genome.instinct
                },
                abdomenType: genome.abdomenType,
                thoraxType: genome.thoraxType,
                headType: genome.headType,
                legStyle: genome.legStyle,
                textureType: genome.textureType,
                weapon: genome.weapon,
                defense: genome.defense,
                mobility: genome.mobility
            }
        };
    }

    static breed(bug1, bug2) {
        const childGenome = bug1.genome.breed(bug2.genome);
        return BugFactory.createFromGenome(childGenome);
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.BugGenome = BugGenome;
    window.BugSpriteGenerator = BugSpriteGenerator;
    window.BugFactory = BugFactory;
}
