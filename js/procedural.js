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

        for (let i = stats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [stats[i], stats[j]] = [stats[j], stats[i]];
        }

        [this.bulk, this.speed, this.fury, this.instinct] = stats;

        // Three body segments
        this.abdomenType = ['round', 'oval', 'pointed', 'bulbous', 'segmented'][Math.floor(Math.random() * 5)];
        this.thoraxType = ['compact', 'elongated', 'wide', 'humped'][Math.floor(Math.random() * 4)];
        this.headType = ['round', 'triangular', 'square', 'elongated', 'pincer'][Math.floor(Math.random() * 5)];

        // Leg count and style
        this.legCount = [4, 6, 8][Math.floor(Math.random() * 3)];
        this.legStyle = ['straight', 'curved-back', 'curved-forward', 'short'][Math.floor(Math.random() * 4)];

        // Pattern type
        this.pattern = ['solid', 'striped', 'spotted'][Math.floor(Math.random() * 3)];

        // Combat types
        this.weapon = ['mandibles', 'stinger', 'fangs', 'claws'][Math.floor(Math.random() * 4)];
        this.defense = ['shell', 'agility', 'toxic', 'camouflage'][Math.floor(Math.random() * 4)];
        this.mobility = ['ground', 'winged', 'wallcrawler'][Math.floor(Math.random() * 3)];

        // Color
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
            this.hslToHex(0, 0, 0.9)             // 6: Light pattern
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

        // Segment positions with small gap for visual flair
        const gap = Math.ceil(scale);
        const thoraxX = Math.floor(14 * scale);
        const abdomenX = Math.floor(6 * scale);
        const headX = Math.floor(22 * scale);

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
            case 'pincer':
                this.drawPincerHead(grid, headX, cy, scale);
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

    drawPincerHead(grid, cx, cy, scale) {
        const r = Math.floor(2.5 * scale);
        // Main head - slightly extended toward thorax
        this.fillOval(grid, cx - Math.floor(scale), cy, Math.floor(3.5 * scale), r, 3, 2, 1);
        // Pincers on top and bottom
        this.fillOval(grid, cx - Math.floor(scale), cy - Math.floor(2.5 * scale),
                      Math.floor(2 * scale), Math.floor(1.5 * scale), 2, 2, 1);
        this.fillOval(grid, cx - Math.floor(scale), cy + Math.floor(2.5 * scale),
                      Math.floor(2 * scale), Math.floor(1.5 * scale), 2, 2, 1);
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
        const legCount = g.legCount || 6;
        const legLen = Math.floor((5 + g.speed / 40) * scale);

        const animPhase = frameNum * Math.PI / 2;

        // Span legs across the whole body (from abdomen to head area)
        const totalSpan = Math.floor(16 * scale);
        const spacing = legCount > 1 ? totalSpan / (legCount - 1) : 0;
        const startOffset = -totalSpan / 2;

        for (let i = 0; i < legCount; i++) {
            const xOffset = legCount > 1 ? startOffset + i * spacing : 0;
            const legPhase = animPhase + i * Math.PI / legCount;
            const anim = state === 'idle' ? Math.sin(legPhase) * scale * 0.5 : 0;

            const startX = cx + xOffset;
            const startY = cy + Math.floor(1 * scale); // Start legs lower, below body center

            if (g.legStyle === 'straight') {
                this.drawStraightLeg(grid, startX, startY, legLen, anim, scale);
            } else if (g.legStyle === 'curved-back') {
                this.drawCurvedLeg(grid, startX, startY, legLen, anim, scale, -1);
            } else if (g.legStyle === 'curved-forward') {
                this.drawCurvedLeg(grid, startX, startY, legLen, anim, scale, 1);
            } else if (g.legStyle === 'short') {
                this.drawStraightLeg(grid, startX, startY, Math.floor(legLen * 0.7), anim, scale);
            } else {
                // Default fallback
                this.drawStraightLeg(grid, startX, startY, legLen, anim, scale);
            }
        }
    }

    drawStraightLeg(grid, x, y, len, anim, scale) {
        // Simple straight leg going down
        for (let i = 1; i <= len; i++) {
            const lx = Math.floor(x);
            const ly = Math.floor(y + i + anim * (i / len));
            if (this.inBounds(lx, ly)) grid[ly][lx] = 1;
        }
    }

    drawCurvedLeg(grid, x, y, len, anim, scale, dir) {
        // Curved leg like ( or )
        for (let i = 1; i <= len; i++) {
            const t = i / len;
            // Curve peaks in middle, returns to straight at end
            const curve = Math.round(Math.sin(t * Math.PI) * 3) * dir;
            const lx = Math.round(x + curve);
            const ly = Math.floor(y + i + anim * (i / len));
            if (this.inBounds(lx, ly)) grid[ly][lx] = 1;
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

        const extend = (state === 'attack' && frameNum >= 2) ? Math.floor(3 * scale) : 0;
        const weaponSize = Math.floor((2 + g.fury / 40) * scale);

        switch (g.weapon) {
            case 'mandibles':
                this.drawMandibles(grid, headX, cy, scale, weaponSize, extend);
                break;
            case 'fangs':
                this.drawFangs(grid, headX, cy, scale, weaponSize, extend);
                break;
            case 'claws':
                this.drawClaws(grid, headX, cy, scale, weaponSize, extend);
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

    drawFangs(grid, hx, cy, scale, size, extend) {
        for (const side of [-1, 1]) {
            const baseX = hx + Math.floor(2 * scale) + extend;
            const baseY = cy + side * Math.floor(scale);
            for (let i = 0; i <= size; i++) {
                const fx = baseX + Math.floor(i * 0.3);
                const fy = baseY + side * i;
                if (this.inBounds(fx, fy)) grid[fy][fx] = 1;
            }
        }
        if (this.genome.fury > 60) {
            const dripX = hx + Math.floor(3 * scale) + extend;
            const dripY = cy + Math.floor(size + 2);
            if (this.inBounds(dripX, dripY)) grid[dripY][dripX] = 6;
        }
    }

    drawClaws(grid, hx, cy, scale, size, extend) {
        for (const side of [-1, 1]) {
            for (let i = 0; i < size; i++) {
                const ax = hx + Math.floor(scale) + Math.floor(i * 0.5);
                const ay = cy + side * (Math.floor(2 * scale) + i);
                if (this.inBounds(ax, ay)) grid[ay][ax] = 1;
                if (this.inBounds(ax + 1, ay)) grid[ay][ax + 1] = 1;
            }
            const elbowX = hx + Math.floor(scale) + Math.floor(size * 0.5);
            const elbowY = cy + side * (Math.floor(2 * scale) + size);
            for (let i = 0; i < Math.floor(size * 0.7); i++) {
                const clawX = elbowX + extend + i;
                const clawY = elbowY - side * Math.floor(i * 0.3);
                if (this.inBounds(clawX, clawY)) grid[clawY][clawX] = 1;
            }
        }
    }

    drawStinger(grid, abdX, cy, scale, state, frameNum) {
        const extend = (state === 'attack' && frameNum >= 2) ? Math.floor(3 * scale) : 0;
        const stingerLen = Math.floor((3 + this.genome.fury / 30) * scale);

        for (let i = 0; i < stingerLen; i++) {
            const progress = i / stingerLen;
            const curve = Math.sin(progress * Math.PI * 0.5) * scale;
            const sx = abdX - Math.floor(5 * scale) - i - extend;
            const sy = cy - Math.floor(curve);

            if (this.inBounds(sx, sy)) {
                grid[sy][sx] = i === stingerLen - 1 ? 4 : 1;
            }
            if (i < stingerLen - 1 && this.inBounds(sx, sy + 1)) {
                grid[sy + 1][sx] = 1;
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

        switch (g.pattern) {
            case 'striped':
                this.applyStripes(grid);
                break;
            case 'spotted':
                this.applySpots(grid);
                break;
        }
    }

    applyStripes(grid) {
        for (let x = 0; x < this.size; x++) {
            if (x % 4 < 2) {
                for (let y = 0; y < this.size; y++) {
                    if (grid[y][x] === 3) grid[y][x] = 5;
                }
            }
        }
    }

    applySpots(grid) {
        const seed = this.genome.patternSeed || 0;
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
