// Bug Fights - Procedural Bug Generator v2
// Modular sprite system with distinct body types, heads, and legs

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
        // Distribute exactly 350 points across 4 stats (min 10, max 100 each)
        const TOTAL = 350, MIN = 10, MAX = 100;
        const stats = [MIN, MIN, MIN, MIN];
        let remaining = TOTAL - MIN * 4;

        while (remaining > 0) {
            const available = stats.map((s, i) => s < MAX ? i : -1).filter(i => i >= 0);
            if (!available.length) break;
            const idx = available[Math.floor(Math.random() * available.length)];
            const add = Math.min(remaining, MAX - stats[idx], Math.floor(Math.random() * 25) + 1);
            stats[idx] += add;
            remaining -= add;
        }

        // Shuffle and assign
        for (let i = stats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [stats[i], stats[j]] = [stats[j], stats[i]];
        }

        [this.bulk, this.speed, this.fury, this.instinct] = stats;

        // Body type determines base silhouette
        this.bodyType = ['beetle', 'ant', 'spider', 'mantis', 'roach'][Math.floor(Math.random() * 5)];

        // Head type
        this.headType = ['round', 'triangular', 'flat', 'elongated'][Math.floor(Math.random() * 4)];

        // Leg style
        this.legStyle = ['thin', 'thick', 'bent', 'stubby'][Math.floor(Math.random() * 4)];

        // Pattern type
        this.pattern = ['solid', 'striped', 'spotted', 'segmented'][Math.floor(Math.random() * 4)];

        // Combat types
        this.weapon = ['mandibles', 'stinger', 'fangs', 'claws'][Math.floor(Math.random() * 4)];
        this.defense = ['shell', 'agility', 'toxic', 'camouflage'][Math.floor(Math.random() * 4)];
        this.mobility = ['ground', 'winged', 'wallcrawler'][Math.floor(Math.random() * 3)];

        // Color - primary and accent
        this.color = {
            hue: Math.random() * 360,
            saturation: 0.5 + Math.random() * 0.4,
            lightness: 0.35 + Math.random() * 0.25
        };

        // Accent color for patterns
        this.accentHue = (this.color.hue + 30 + Math.random() * 60) % 360;
    }

    breed(other) {
        const child = new BugGenome();

        // Inherit stats with mutation
        child.bulk = this.inheritStat(this.bulk, other.bulk);
        child.speed = this.inheritStat(this.speed, other.speed);
        child.fury = this.inheritStat(this.fury, other.fury);
        child.instinct = this.inheritStat(this.instinct, other.instinct);

        // Normalize to 350
        const total = child.bulk + child.speed + child.fury + child.instinct;
        const scale = 350 / total;
        child.bulk = Math.round(child.bulk * scale);
        child.speed = Math.round(child.speed * scale);
        child.fury = Math.round(child.fury * scale);
        child.instinct = 350 - child.bulk - child.speed - child.fury;

        // Inherit types (dominant parent)
        child.bodyType = Math.random() < 0.5 ? this.bodyType : other.bodyType;
        child.headType = Math.random() < 0.5 ? this.headType : other.headType;
        child.legStyle = Math.random() < 0.5 ? this.legStyle : other.legStyle;
        child.pattern = Math.random() < 0.5 ? this.pattern : other.pattern;
        child.weapon = Math.random() < 0.5 ? this.weapon : other.weapon;
        child.defense = Math.random() < 0.5 ? this.defense : other.defense;
        child.mobility = Math.random() < 0.5 ? this.mobility : other.mobility;

        // Blend colors
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
            claws: ['Slasher', 'Ripper', 'Shredder', 'Razor']
        };
        const suffixes = {
            beetle: ['Back', 'Shell', 'Dome', 'Beetle'],
            ant: ['March', 'Worker', 'Scout', 'Runner'],
            spider: ['Web', 'Crawler', 'Hunter', 'Lurker'],
            mantis: ['Blade', 'Stalker', 'Reaper', 'Scythe'],
            roach: ['Roach', 'Scuttle', 'Creep', 'Skitter']
        };
        return prefixes[this.weapon][Math.floor(Math.random() * 4)] + ' ' +
               suffixes[this.bodyType][Math.floor(Math.random() * 4)];
    }

    // Size multiplier based on bulk and body type
    getSizeMultiplier() {
        const baseSize = {
            beetle: 1.0,
            ant: 0.6,
            spider: 0.85,
            mantis: 1.3,
            roach: 0.9
        };
        // Bulk affects size: low bulk = smaller, high bulk = bigger
        const bulkMod = 0.5 + (this.bulk / 100) * 1.0; // 0.5x to 1.5x
        return baseSize[this.bodyType] * bulkMod;
    }
}

// ============================================
// SPRITE GENERATOR - Modular Body Parts
// ============================================

class BugSpriteGenerator {
    constructor(genome) {
        this.genome = genome;
        this.sizeMult = genome.getSizeMultiplier();
        // Base size 24x24, scaled by size multiplier (range ~14 to ~38 pixels)
        this.size = Math.round(24 * this.sizeMult);
        this.size = Math.max(12, Math.min(48, this.size)); // Clamp

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
            this.hslToHex(h, s, l * 0.5),       // Dark outline
            this.hslToHex(h, s, l),              // Base color
            this.hslToHex(h, s * 0.8, l * 1.3),  // Highlight
            this.hslToHex(ah, s, l),             // Accent (for patterns)
            this.hslToHex(ah, s, l * 1.3)        // Accent highlight
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
        const cx = Math.floor(this.size / 2);
        const cy = Math.floor(this.size / 2);

        // Animation parameters
        const animPhase = frameNum * Math.PI / 2;
        const isAttacking = state === 'attack';
        const isHit = state === 'hit';
        const isDead = state === 'death';

        // Draw in order: legs, body, head, features
        this.drawLegs(grid, cx, cy, state, frameNum);
        this.drawBody(grid, cx, cy, state, frameNum);
        this.drawHead(grid, cx, cy, state, frameNum);

        // Wings if flying
        if (this.genome.mobility === 'winged') {
            this.drawWings(grid, cx, cy, state, frameNum);
        }

        // Weapon features
        this.drawWeapon(grid, cx, cy, state, frameNum);

        // Antennae based on instinct
        this.drawAntennae(grid, cx, cy, state, frameNum);

        // Apply death transform
        if (isDead && frameNum >= 2) {
            this.applyDeathTransform(grid, frameNum);
        }

        return grid;
    }

    // BODY SHAPES - Core silhouette
    drawBody(grid, cx, cy, state, frameNum) {
        const g = this.genome;
        const scale = this.size / 24; // Scale factor

        // Squash/stretch for hit/attack
        let squashX = 1, squashY = 1;
        if (state === 'hit') { squashX = 1.3; squashY = 0.7; }
        if (state === 'attack' && frameNum >= 2) { squashX = 0.8; squashY = 1.2; }

        switch (g.bodyType) {
            case 'beetle':
                this.drawBeetleBody(grid, cx, cy, scale, squashX, squashY);
                break;
            case 'ant':
                this.drawAntBody(grid, cx, cy, scale, squashX, squashY);
                break;
            case 'spider':
                this.drawSpiderBody(grid, cx, cy, scale, squashX, squashY);
                break;
            case 'mantis':
                this.drawMantisBody(grid, cx, cy, scale, squashX, squashY);
                break;
            case 'roach':
                this.drawRoachBody(grid, cx, cy, scale, squashX, squashY);
                break;
        }

        // Apply pattern
        this.applyPattern(grid, cx, cy);
    }

    drawBeetleBody(grid, cx, cy, scale, sx, sy) {
        // Round dome shape - like a ladybug
        const w = Math.floor(6 * scale * sx);
        const h = Math.floor(5 * scale * sy);

        for (let y = -h; y <= h; y++) {
            for (let x = -w; x <= w; x++) {
                const px = cx + x;
                const py = cy + y;
                if (px < 0 || px >= this.size || py < 0 || py >= this.size) continue;

                const ex = x / w;
                const ey = y / h;
                const dist = ex * ex + ey * ey;

                if (dist < 0.5) grid[py][px] = 3;
                else if (dist < 0.8) grid[py][px] = 2;
                else if (dist < 1.0) grid[py][px] = 1;
            }
        }

        // Shell line down middle
        for (let y = -h + 1; y < h; y++) {
            const py = cy + y;
            if (py >= 0 && py < this.size && cx >= 0 && cx < this.size) {
                if (grid[py][cx] !== 0) grid[py][cx] = 1;
            }
        }
    }

    drawAntBody(grid, cx, cy, scale, sx, sy) {
        // Three segments: head, thorax, abdomen (side view shows elongated shape)
        const segSize = Math.floor(2.5 * scale);

        // Thorax (middle, smaller)
        this.fillEllipse(grid, cx, cy, Math.floor(segSize * 0.8 * sx), Math.floor(segSize * 0.7 * sy), 2, 1);

        // Abdomen (back, larger, oval)
        const abdX = cx - Math.floor(3 * scale);
        this.fillEllipse(grid, abdX, cy, Math.floor(segSize * 1.2 * sx), Math.floor(segSize * sy), 2, 1);

        // Petiole (thin waist)
        const waistX = cx - Math.floor(1 * scale);
        if (waistX >= 0 && waistX < this.size) {
            grid[cy][waistX] = 2;
        }
    }

    drawSpiderBody(grid, cx, cy, scale, sx, sy) {
        // Two round segments: cephalothorax and abdomen
        const size1 = Math.floor(3 * scale);
        const size2 = Math.floor(4 * scale);

        // Cephalothorax (front)
        this.fillEllipse(grid, cx + Math.floor(2 * scale), cy, size1 * sx, size1 * sy, 2, 1);

        // Abdomen (back, larger)
        this.fillEllipse(grid, cx - Math.floor(2 * scale), cy, size2 * sx, size2 * sy, 2, 1);
    }

    drawMantisBody(grid, cx, cy, scale, sx, sy) {
        // Long, thin body - elongated thorax
        const thoraxLen = Math.floor(7 * scale);
        const thoraxH = Math.floor(2 * scale);

        // Long thorax
        for (let x = -thoraxLen / 2; x <= thoraxLen / 2; x++) {
            for (let y = -thoraxH; y <= thoraxH; y++) {
                const px = cx + Math.floor(x);
                const py = cy + Math.floor(y);
                if (px < 0 || px >= this.size || py < 0 || py >= this.size) continue;

                const ey = Math.abs(y) / thoraxH;
                if (ey < 0.7) grid[py][px] = 2;
                else if (ey < 1.0) grid[py][px] = 1;
            }
        }

        // Abdomen (back)
        this.fillEllipse(grid, cx - Math.floor(5 * scale), cy, Math.floor(3 * scale * sx), Math.floor(2.5 * scale * sy), 2, 1);
    }

    drawRoachBody(grid, cx, cy, scale, sx, sy) {
        // Oval, flat body
        const w = Math.floor(5 * scale * sx);
        const h = Math.floor(3 * scale * sy);

        this.fillEllipse(grid, cx, cy, w, h, 2, 1);

        // Pronotum (shield over head area)
        const shieldX = cx + Math.floor(3 * scale);
        this.fillEllipse(grid, shieldX, cy, Math.floor(2.5 * scale), Math.floor(2 * scale), 3, 1);
    }

    // HEAD SHAPES
    drawHead(grid, cx, cy, state, frameNum) {
        const g = this.genome;
        const scale = this.size / 24;

        // Head position depends on body type
        let headX = cx + Math.floor(5 * scale);
        let headY = cy;

        if (g.bodyType === 'ant') headX = cx + Math.floor(3 * scale);
        if (g.bodyType === 'mantis') headX = cx + Math.floor(6 * scale);
        if (g.bodyType === 'spider') headX = cx + Math.floor(4 * scale);

        const headSize = Math.floor((1.5 + g.instinct / 150) * scale);

        switch (g.headType) {
            case 'round':
                this.fillEllipse(grid, headX, headY, headSize, headSize, 2, 1);
                break;
            case 'triangular':
                this.drawTriangleHead(grid, headX, headY, headSize);
                break;
            case 'flat':
                this.fillEllipse(grid, headX, headY, headSize * 1.3, headSize * 0.6, 2, 1);
                break;
            case 'elongated':
                this.fillEllipse(grid, headX, headY, headSize * 1.5, headSize * 0.8, 2, 1);
                break;
        }

        // Eyes
        this.drawEyes(grid, headX, headY, headSize, scale);
    }

    drawTriangleHead(grid, hx, hy, size) {
        for (let x = 0; x <= size; x++) {
            const h = Math.floor(size * (1 - x / size));
            for (let y = -h; y <= h; y++) {
                const px = hx + x;
                const py = hy + y;
                if (px >= 0 && px < this.size && py >= 0 && py < this.size) {
                    grid[py][px] = Math.abs(y) < h * 0.6 ? 2 : 1;
                }
            }
        }
    }

    drawEyes(grid, hx, hy, headSize, scale) {
        // Compound eyes on sides of head
        const eyeOffset = Math.max(1, Math.floor(headSize * 0.5));
        const eyeX = hx + Math.floor(scale * 0.5);

        const positions = [[eyeX, hy - eyeOffset], [eyeX, hy + eyeOffset]];
        for (const [ex, ey] of positions) {
            if (ex >= 0 && ex < this.size && ey >= 0 && ey < this.size) {
                grid[ey][ex] = 3;
            }
        }
    }

    // LEG STYLES
    drawLegs(grid, cx, cy, state, frameNum) {
        const g = this.genome;
        const scale = this.size / 24;

        const legCount = g.bodyType === 'spider' ? 4 : 3; // Pairs
        const legLen = Math.floor((3 + g.speed / 40) * scale);

        // Animation
        const animPhase = frameNum * Math.PI / 2;

        for (let i = 0; i < legCount; i++) {
            const offset = (i - (legCount - 1) / 2) * Math.floor(2.5 * scale);
            const legPhase = animPhase + i * Math.PI / legCount;
            const anim = state === 'idle' ? Math.sin(legPhase) * scale : 0;

            for (let side of [-1, 1]) {
                switch (g.legStyle) {
                    case 'thin':
                        this.drawThinLeg(grid, cx + offset, cy, side, legLen, anim, scale);
                        break;
                    case 'thick':
                        this.drawThickLeg(grid, cx + offset, cy, side, legLen, anim, scale);
                        break;
                    case 'bent':
                        this.drawBentLeg(grid, cx + offset, cy, side, legLen, anim, scale);
                        break;
                    case 'stubby':
                        this.drawStubbyLeg(grid, cx + offset, cy, side, legLen * 0.5, anim, scale);
                        break;
                }
            }
        }
    }

    drawThinLeg(grid, x, y, side, len, anim, scale) {
        // Thin spider-like legs
        for (let i = 1; i <= len; i++) {
            const lx = Math.floor(x + side * i * 0.3);
            const ly = Math.floor(y + i + anim * (i / len));
            if (lx >= 0 && lx < this.size && ly >= 0 && ly < this.size) {
                grid[ly][lx] = 1;
            }
        }
    }

    drawThickLeg(grid, x, y, side, len, anim, scale) {
        // Thick beetle legs
        for (let i = 1; i <= len; i++) {
            const lx = Math.floor(x + side * i * 0.4);
            const ly = Math.floor(y + i + anim * (i / len));
            if (lx >= 0 && lx < this.size && ly >= 0 && ly < this.size) {
                grid[ly][lx] = 1;
                // Thicker
                if (lx + side >= 0 && lx + side < this.size) {
                    grid[ly][lx + side] = 1;
                }
            }
        }
    }

    drawBentLeg(grid, x, y, side, len, anim, scale) {
        // Grasshopper-style bent legs
        const knee = Math.floor(len * 0.4);

        // Upper leg (goes up and out)
        for (let i = 1; i <= knee; i++) {
            const lx = Math.floor(x + side * i * 0.5);
            const ly = Math.floor(y - i * 0.3 + anim * 0.3);
            if (lx >= 0 && lx < this.size && ly >= 0 && ly < this.size) {
                grid[ly][lx] = 1;
            }
        }

        // Lower leg (goes down sharply)
        const kneeX = x + side * Math.floor(knee * 0.5);
        const kneeY = y - Math.floor(knee * 0.3);
        for (let i = 1; i <= len - knee; i++) {
            const lx = Math.floor(kneeX + side * i * 0.2);
            const ly = Math.floor(kneeY + i + anim);
            if (lx >= 0 && lx < this.size && ly >= 0 && ly < this.size) {
                grid[ly][lx] = 1;
            }
        }
    }

    drawStubbyLeg(grid, x, y, side, len, anim, scale) {
        // Short stubby legs (ladybug style)
        for (let i = 1; i <= len; i++) {
            const lx = Math.floor(x + side * i * 0.6);
            const ly = Math.floor(y + i * 0.8 + anim * 0.5);
            if (lx >= 0 && lx < this.size && ly >= 0 && ly < this.size) {
                grid[ly][lx] = 1;
            }
        }
    }

    // WINGS
    drawWings(grid, cx, cy, state, frameNum) {
        const scale = this.size / 24;
        const wingSpan = Math.floor(4 * scale);
        const flapPhase = Math.sin(frameNum * Math.PI);

        for (let side of [-1, 1]) {
            for (let i = 0; i < wingSpan; i++) {
                const wx = cx - Math.floor(scale) + i;
                const wy = cy + side * (Math.floor(2 * scale) + i + Math.floor(flapPhase * 2 * side));

                if (wx >= 0 && wx < this.size && wy >= 0 && wy < this.size) {
                    if (grid[wy][wx] === 0) {
                        grid[wy][wx] = 3; // Translucent wing color
                    }
                }
                // Wing edge
                if (wx + 1 < this.size && wy >= 0 && wy < this.size) {
                    if (grid[wy][wx + 1] === 0) {
                        grid[wy][wx + 1] = 1;
                    }
                }
            }
        }
    }

    // WEAPONS
    drawWeapon(grid, cx, cy, state, frameNum) {
        const g = this.genome;
        const scale = this.size / 24;
        const headX = cx + Math.floor(5 * scale);
        const weaponSize = Math.floor((1 + g.fury / 60) * scale);

        const extend = (state === 'attack' && frameNum >= 2) ? Math.floor(2 * scale) : 0;

        switch (g.weapon) {
            case 'mandibles':
                // Large pincers
                for (let i = 0; i < weaponSize + 1; i++) {
                    const mx = headX + i + extend;
                    if (mx < this.size) {
                        const spread = Math.floor(1 + i * 0.5);
                        if (cy - spread >= 0) grid[cy - spread][mx] = 1;
                        if (cy + spread < this.size) grid[cy + spread][mx] = 1;
                    }
                }
                break;

            case 'stinger':
                // Tail stinger
                const tailX = cx - Math.floor(6 * scale);
                for (let i = 0; i < weaponSize + 2; i++) {
                    const sx = tailX - i;
                    if (sx >= 0 && sx < this.size) {
                        grid[cy][sx] = i === weaponSize + 1 ? 3 : 1;
                    }
                }
                break;

            case 'fangs':
                // Two fangs pointing down
                for (let i = 0; i < weaponSize; i++) {
                    const fx = headX + 1;
                    const fy1 = cy - 1 + i + extend;
                    const fy2 = cy + 1 - i - extend;
                    if (fx < this.size) {
                        if (fy1 < this.size) grid[fy1][fx] = 1;
                        if (fy2 >= 0) grid[fy2][fx] = 1;
                    }
                }
                break;

            case 'claws':
                // Raptorial front legs (mantis style)
                for (let side of [-1, 1]) {
                    for (let i = 0; i < weaponSize + 1; i++) {
                        const clx = headX + Math.floor(i * 0.5) + extend;
                        const cly = cy + side * (1 + i);
                        if (clx >= 0 && clx < this.size && cly >= 0 && cly < this.size) {
                            grid[cly][clx] = 1;
                        }
                    }
                }
                break;
        }
    }

    // ANTENNAE
    drawAntennae(grid, cx, cy, state, frameNum) {
        const g = this.genome;
        const scale = this.size / 24;
        const headX = cx + Math.floor(5 * scale);
        const antennaLen = Math.floor((1 + g.instinct / 50) * scale);

        for (let side of [-1, 1]) {
            for (let i = 1; i <= antennaLen; i++) {
                const ax = headX + i;
                const ay = cy + side * Math.floor(i * 0.6);
                if (ax >= 0 && ax < this.size && ay >= 0 && ay < this.size) {
                    grid[ay][ax] = 1;
                }
            }
        }
    }

    // PATTERNS
    applyPattern(grid, cx, cy) {
        const g = this.genome;

        switch (g.pattern) {
            case 'striped':
                this.applyStripes(grid);
                break;
            case 'spotted':
                this.applySpots(grid, cx, cy);
                break;
            case 'segmented':
                this.applySegments(grid);
                break;
            // 'solid' - no pattern
        }
    }

    applyStripes(grid) {
        // Horizontal stripes
        for (let y = 0; y < this.size; y++) {
            if (y % 3 === 0) {
                for (let x = 0; x < this.size; x++) {
                    if (grid[y][x] === 2) {
                        grid[y][x] = 4; // Accent color
                    }
                }
            }
        }
    }

    applySpots(grid, cx, cy) {
        // Random spots
        const spotCount = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < spotCount; i++) {
            const sx = cx + Math.floor((Math.random() - 0.5) * this.size * 0.6);
            const sy = cy + Math.floor((Math.random() - 0.5) * this.size * 0.4);
            if (sx >= 0 && sx < this.size && sy >= 0 && sy < this.size) {
                if (grid[sy][sx] === 2 || grid[sy][sx] === 3) {
                    grid[sy][sx] = 4;
                }
            }
        }
    }

    applySegments(grid) {
        // Vertical segment lines
        for (let x = 0; x < this.size; x++) {
            if (x % 4 === 0) {
                for (let y = 0; y < this.size; y++) {
                    if (grid[y][x] === 2) {
                        grid[y][x] = 1; // Dark line
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

    // Utility: fill ellipse
    fillEllipse(grid, cx, cy, rx, ry, fillColor, outlineColor) {
        rx = Math.max(1, Math.floor(rx));
        ry = Math.max(1, Math.floor(ry));

        for (let y = -ry; y <= ry; y++) {
            for (let x = -rx; x <= rx; x++) {
                const px = Math.floor(cx + x);
                const py = Math.floor(cy + y);
                if (px < 0 || px >= this.size || py < 0 || py >= this.size) continue;

                const dist = (x * x) / (rx * rx) + (y * y) / (ry * ry);
                if (dist < 0.7) grid[py][px] = fillColor;
                else if (dist < 1.0) grid[py][px] = outlineColor;
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
                bodyType: genome.bodyType,
                headType: genome.headType,
                legStyle: genome.legStyle,
                pattern: genome.pattern,
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
