// Bug Fights - Procedural Bug Generator
// Generates bug sprites based on genetic traits

// ============================================
// BUG GENOME STRUCTURE
// ============================================

class BugGenome {
    constructor(data = null) {
        if (data) {
            // Clone existing genome
            this.bulk = data.bulk;
            this.speed = data.speed;
            this.fury = data.fury;
            this.instinct = data.instinct;
            this.weapon = data.weapon;
            this.defense = data.defense;
            this.mobility = data.mobility;
            this.color = { ...data.color };
        } else {
            // Generate random genome
            this.randomize();
        }
    }

    randomize() {
        // Distribute exactly 350 points across 4 stats
        // Each stat: min 10, max 100
        const TOTAL_POINTS = 350;
        const MIN_STAT = 10;
        const MAX_STAT = 100;
        const NUM_STATS = 4;

        // Start all stats at minimum
        const stats = [MIN_STAT, MIN_STAT, MIN_STAT, MIN_STAT];
        let remaining = TOTAL_POINTS - (MIN_STAT * NUM_STATS); // 310 points to distribute

        // Distribute remaining points randomly
        while (remaining > 0) {
            // Pick a random stat that hasn't hit max
            const available = [];
            for (let i = 0; i < NUM_STATS; i++) {
                if (stats[i] < MAX_STAT) available.push(i);
            }

            if (available.length === 0) break;

            const idx = available[Math.floor(Math.random() * available.length)];
            const maxAdd = Math.min(remaining, MAX_STAT - stats[idx]);
            // Add random amount (weighted toward smaller increments for variety)
            const add = Math.min(maxAdd, Math.floor(Math.random() * 30) + 1);
            stats[idx] += add;
            remaining -= add;
        }

        // If any points remain, distribute to non-maxed stats
        while (remaining > 0) {
            for (let i = 0; i < NUM_STATS && remaining > 0; i++) {
                if (stats[i] < MAX_STAT) {
                    const add = Math.min(remaining, MAX_STAT - stats[i]);
                    stats[i] += add;
                    remaining -= add;
                }
            }
        }

        // Shuffle the stats array to randomize which stat gets what
        for (let i = stats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [stats[i], stats[j]] = [stats[j], stats[i]];
        }

        this.bulk = stats[0];
        this.speed = stats[1];
        this.fury = stats[2];
        this.instinct = stats[3];

        // Random types
        this.weapon = ['mandibles', 'stinger', 'fangs', 'claws'][Math.floor(Math.random() * 4)];
        this.defense = ['shell', 'agility', 'toxic', 'camouflage'][Math.floor(Math.random() * 4)];
        this.mobility = ['ground', 'winged', 'wallcrawler'][Math.floor(Math.random() * 3)];

        // Random color
        this.color = {
            hue: Math.random() * 360,
            saturation: 0.5 + Math.random() * 0.4,
            lightness: 0.3 + Math.random() * 0.3
        };
    }

    breed(other) {
        const child = new BugGenome();

        // Stats: weighted average with mutation
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

        // Types: inherit from one parent (80% chance) or other (20%)
        child.weapon = Math.random() < 0.8 ? this.weapon : other.weapon;
        child.defense = Math.random() < 0.8 ? this.defense : other.defense;
        child.mobility = Math.random() < 0.8 ? this.mobility : other.mobility;

        // Small chance of type mutation
        if (Math.random() < 0.05) {
            child.weapon = ['mandibles', 'stinger', 'fangs', 'claws'][Math.floor(Math.random() * 4)];
        }
        if (Math.random() < 0.05) {
            child.defense = ['shell', 'agility', 'toxic', 'camouflage'][Math.floor(Math.random() * 4)];
        }
        if (Math.random() < 0.02) {
            child.mobility = ['ground', 'winged', 'wallcrawler'][Math.floor(Math.random() * 3)];
        }

        // Color: blend with small mutation
        child.color = {
            hue: this.blendHue(this.color.hue, other.color.hue) + (Math.random() - 0.5) * 20,
            saturation: (this.color.saturation + other.color.saturation) / 2 + (Math.random() - 0.5) * 0.1,
            lightness: (this.color.lightness + other.color.lightness) / 2 + (Math.random() - 0.5) * 0.1
        };
        child.color.hue = (child.color.hue + 360) % 360;
        child.color.saturation = Math.max(0.3, Math.min(0.9, child.color.saturation));
        child.color.lightness = Math.max(0.25, Math.min(0.55, child.color.lightness));

        return child;
    }

    inheritStat(a, b) {
        // Weighted average with mutation
        const avg = (a + b) / 2;
        const mutation = (Math.random() - 0.5) * 20; // ±10 points
        return Math.max(10, Math.min(100, Math.round(avg + mutation)));
    }

    blendHue(h1, h2) {
        // Blend hues correctly around the color wheel
        const diff = h2 - h1;
        if (Math.abs(diff) > 180) {
            if (diff > 0) {
                return (h1 + (diff - 360) / 2 + 360) % 360;
            } else {
                return (h1 + (diff + 360) / 2) % 360;
            }
        }
        return h1 + diff / 2;
    }

    getName() {
        // Generate a procedural name based on traits
        const prefixes = {
            mandibles: ['Crusher', 'Gnasher', 'Chomper', 'Breaker'],
            stinger: ['Piercer', 'Stabber', 'Lancer', 'Spike'],
            fangs: ['Venom', 'Toxic', 'Poison', 'Blight'],
            claws: ['Slasher', 'Ripper', 'Shredder', 'Razor']
        };

        const suffixes = {
            shell: ['Shell', 'Carapace', 'Plate', 'Guard'],
            agility: ['Dancer', 'Blur', 'Flash', 'Swift'],
            toxic: ['Bane', 'Plague', 'Miasma', 'Rot'],
            camouflage: ['Shadow', 'Ghost', 'Phantom', 'Shade']
        };

        const prefix = prefixes[this.weapon][Math.floor(Math.random() * 4)];
        const suffix = suffixes[this.defense][Math.floor(Math.random() * 4)];

        return `${prefix} ${suffix}`;
    }
}

// ============================================
// PROCEDURAL SPRITE GENERATOR
// ============================================

class BugSpriteGenerator {
    constructor(genome) {
        this.genome = genome;
        this.size = 16;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.ctx = this.canvas.getContext('2d');

        // Generate color palette from genome
        this.colors = this.generatePalette();
    }

    generatePalette() {
        const h = this.genome.color.hue;
        const s = this.genome.color.saturation;
        const l = this.genome.color.lightness;

        return [
            'transparent',
            this.hslToHex(h, s, l * 0.6),      // Dark
            this.hslToHex(h, s, l),             // Base
            this.hslToHex(h, s * 0.8, l * 1.4)  // Highlight
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

        const toHex = v => {
            const hex = Math.round((v + m) * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Generate a single frame as a 2D array of color indices
    generateFrame(state = 'idle', frameNum = 0) {
        const grid = Array(this.size).fill(null).map(() => Array(this.size).fill(0));

        // Calculate dimensions based on stats
        const bulkFactor = this.genome.bulk / 100;
        const speedFactor = this.genome.speed / 100;
        const furyFactor = this.genome.fury / 100;
        const instinctFactor = this.genome.instinct / 100;

        // Body dimensions
        const bodyWidth = Math.floor(4 + bulkFactor * 5);  // 4-9
        const bodyHeight = Math.floor(3 + bulkFactor * 3); // 3-6
        const bodyLength = Math.floor(5 + speedFactor * 3); // elongation for speed

        // Center of bug
        const cx = 8;
        const cy = 8;

        // Animation offsets
        const animBob = Math.sin(frameNum * Math.PI / 2) * (state === 'idle' ? 0.5 : 0);
        const animSquash = state === 'attack' ? (frameNum < 2 ? 0.8 : 1.2) : 1;
        const animHit = state === 'hit' ? 1.3 : 1;

        // Draw body
        this.drawBody(grid, cx, cy + animBob, bodyWidth * animSquash * animHit, bodyHeight, state, frameNum);

        // Draw legs based on mobility and speed
        this.drawLegs(grid, cx, cy + animBob, bodyWidth, speedFactor, state, frameNum);

        // Draw head with sensory organs based on instinct
        this.drawHead(grid, cx, cy + animBob, instinctFactor, state, frameNum);

        // Draw weapon based on type and fury
        this.drawWeapon(grid, cx, cy + animBob, furyFactor, state, frameNum);

        // Draw wings if winged
        if (this.genome.mobility === 'winged') {
            this.drawWings(grid, cx, cy + animBob, state, frameNum);
        }

        // Draw defense features
        this.drawDefense(grid, cx, cy + animBob, state, frameNum);

        // Death animation - fall over
        if (state === 'death') {
            this.applyDeathTransform(grid, frameNum);
        }

        return grid;
    }

    drawBody(grid, cx, cy, width, height, state, frameNum) {
        const hw = Math.floor(width / 2);
        const hh = Math.floor(height / 2);

        // Main body ellipse
        for (let y = -hh; y <= hh; y++) {
            for (let x = -hw - 1; x <= hw + 1; x++) {
                const px = Math.floor(cx + x);
                const py = Math.floor(cy + y);

                if (px < 0 || px >= 16 || py < 0 || py >= 16) continue;

                // Ellipse check with some noise for organic feel
                const ex = x / (hw + 1);
                const ey = y / (hh + 0.5);
                const dist = ex * ex + ey * ey;

                if (dist < 0.6) {
                    grid[py][px] = 3; // Highlight center
                } else if (dist < 0.85) {
                    grid[py][px] = 2; // Base color
                } else if (dist < 1.1) {
                    grid[py][px] = 1; // Dark edge
                }
            }
        }

        // Shell segments for high bulk or shell defense
        if (this.genome.bulk > 60 || this.genome.defense === 'shell') {
            const segments = Math.floor(2 + this.genome.bulk / 40);
            for (let i = 1; i < segments; i++) {
                const sx = Math.floor(cx - hw + (i * width / segments));
                for (let y = -hh; y <= hh; y++) {
                    const py = Math.floor(cy + y);
                    if (py >= 0 && py < 16 && sx >= 0 && sx < 16 && grid[py][sx] !== 0) {
                        grid[py][sx] = 1;
                    }
                }
            }
        }
    }

    drawLegs(grid, cx, cy, bodyWidth, speedFactor, state, frameNum) {
        const legLength = Math.floor(2 + speedFactor * 4); // 2-6 pixels
        const legCount = this.genome.mobility === 'wallcrawler' ? 4 : 3; // pairs per side
        const hw = Math.floor(bodyWidth / 2);

        const isWallcrawler = this.genome.mobility === 'wallcrawler';

        for (let i = 0; i < legCount; i++) {
            const legOffset = (i - (legCount - 1) / 2) * 2;

            // Leg animation
            const phase = (frameNum + i) * Math.PI / 2;
            const animOffset = state === 'idle' ? Math.sin(phase) * 0.5 : 0;

            // Left and right legs
            for (let side of [-1, 1]) {
                const startX = Math.floor(cx + side * hw);
                const startY = Math.floor(cy + legOffset);

                if (startY < 0 || startY >= 16) continue;

                // Draw leg segments
                for (let l = 1; l <= legLength; l++) {
                    let lx, ly;

                    if (isWallcrawler) {
                        // Splayed out legs with hooks
                        lx = Math.floor(startX + side * l * 1.2);
                        ly = Math.floor(startY + l * 0.3 + animOffset);
                    } else {
                        // Normal downward legs
                        lx = Math.floor(startX + side * l * 0.4);
                        ly = Math.floor(startY + l * 0.8 + animOffset);
                    }

                    if (lx >= 0 && lx < 16 && ly >= 0 && ly < 16) {
                        grid[ly][lx] = l === legLength ? 1 : 2;
                    }
                }
            }
        }
    }

    drawHead(grid, cx, cy, instinctFactor, state, frameNum) {
        // Head at front of bug
        const headX = cx + 4;
        const headY = Math.floor(cy);
        const headSize = Math.floor(1 + this.genome.bulk / 50);

        // Draw head
        for (let y = -headSize; y <= headSize; y++) {
            for (let x = 0; x <= headSize + 1; x++) {
                const px = headX + x;
                const py = headY + y;
                if (px >= 0 && px < 16 && py >= 0 && py < 16) {
                    const dist = Math.sqrt(x * x + y * y);
                    if (dist < headSize + 0.5) {
                        grid[py][px] = dist < headSize * 0.5 ? 3 : 2;
                    }
                }
            }
        }

        // Antennae based on instinct
        const antennaLength = Math.floor(1 + instinctFactor * 3);
        for (let side of [-1, 1]) {
            for (let i = 1; i <= antennaLength; i++) {
                const ax = headX + i;
                const ay = Math.floor(headY + side * i * 0.7);
                if (ax >= 0 && ax < 16 && ay >= 0 && ay < 16) {
                    grid[ay][ax] = 1;
                }
            }
        }

        // Eyes - larger for high instinct
        if (instinctFactor > 0.4) {
            const eyeY1 = Math.floor(headY - 1);
            const eyeY2 = Math.floor(headY + 1);
            const eyeX = headX + 1;
            if (eyeX < 16 && eyeY1 >= 0 && eyeY2 < 16) {
                grid[eyeY1][eyeX] = 3;
                grid[eyeY2][eyeX] = 3;
            }
        }
    }

    drawWeapon(grid, cx, cy, furyFactor, state, frameNum) {
        const weaponSize = Math.floor(1 + furyFactor * 2);
        const headX = cx + 5;
        const headY = Math.floor(cy);

        // Attack animation extends weapon
        const attackExtend = state === 'attack' && frameNum >= 2 ? 2 : 0;

        switch (this.genome.weapon) {
            case 'mandibles':
                // Two large pincer jaws
                for (let i = 0; i < weaponSize + 1; i++) {
                    const mx = headX + i + attackExtend;
                    if (mx < 16) {
                        // Upper mandible
                        const my1 = Math.floor(headY - 1 - i * 0.3);
                        if (my1 >= 0) grid[my1][mx] = 1;
                        // Lower mandible
                        const my2 = Math.floor(headY + 1 + i * 0.3);
                        if (my2 < 16) grid[my2][mx] = 1;
                    }
                }
                break;

            case 'stinger':
                // Pointed tail at back
                const tailX = cx - 5;
                for (let i = 0; i < weaponSize + 2; i++) {
                    const tx = tailX - i - (state === 'attack' ? attackExtend : 0);
                    if (tx >= 0 && tx < 16) {
                        grid[headY][tx] = i === weaponSize + 1 ? 3 : 1;
                    }
                }
                break;

            case 'fangs':
                // Two curved fangs
                for (let i = 0; i < weaponSize; i++) {
                    const fx = headX + 1 + i + attackExtend;
                    if (fx < 16) {
                        grid[Math.floor(headY - 1)][fx] = 1;
                        grid[Math.floor(headY + 1)][fx] = 1;
                    }
                }
                // Dripping venom effect
                if (this.genome.defense === 'toxic' || furyFactor > 0.6) {
                    const vx = headX + weaponSize + attackExtend;
                    if (vx < 16 && headY + 2 < 16) {
                        grid[headY + 2][vx] = 2;
                    }
                }
                break;

            case 'claws':
                // Sharp front claws
                for (let side of [-1, 1]) {
                    for (let i = 0; i < weaponSize + 1; i++) {
                        const clx = headX + i + attackExtend;
                        const cly = Math.floor(headY + side * (1 + i * 0.5));
                        if (clx >= 0 && clx < 16 && cly >= 0 && cly < 16) {
                            grid[cly][clx] = i === weaponSize ? 3 : 1;
                        }
                    }
                }
                break;
        }
    }

    drawWings(grid, cx, cy, state, frameNum) {
        // Wing animation - flapping
        const flapPhase = (state === 'idle' || state === 'attack') ?
            Math.sin(frameNum * Math.PI) * 0.5 : 0;

        const wingSpan = Math.floor(3 + this.genome.speed / 30);

        for (let side of [-1, 1]) {
            for (let i = 0; i < wingSpan; i++) {
                const wy = Math.floor(cy + side * (2 + i) + flapPhase * side);
                const wx1 = cx - 1 + i;
                const wx2 = cx + i;

                if (wy >= 0 && wy < 16) {
                    if (wx1 >= 0 && wx1 < 16 && grid[wy][wx1] === 0) {
                        grid[wy][wx1] = 2;
                    }
                    if (wx2 >= 0 && wx2 < 16 && grid[wy][wx2] === 0) {
                        grid[wy][wx2] = 3;
                    }
                }
            }
        }
    }

    drawDefense(grid, cx, cy, state, frameNum) {
        switch (this.genome.defense) {
            case 'shell':
                // Already handled in body - adds segments
                break;

            case 'agility':
                // Streamlined - no additions
                break;

            case 'toxic':
                // Add warning pattern spots
                const spotPositions = [
                    [cx - 2, cy - 1],
                    [cx + 1, cy],
                    [cx - 1, cy + 1]
                ];
                for (const [sx, sy] of spotPositions) {
                    if (sx >= 0 && sx < 16 && sy >= 0 && sy < 16) {
                        if (grid[Math.floor(sy)][Math.floor(sx)] === 2) {
                            grid[Math.floor(sy)][Math.floor(sx)] = 3;
                        }
                    }
                }
                break;

            case 'camouflage':
                // Mottled pattern - add dark spots
                for (let y = 0; y < 16; y++) {
                    for (let x = 0; x < 16; x++) {
                        if (grid[y][x] === 2 && Math.random() < 0.3) {
                            grid[y][x] = 1;
                        }
                    }
                }
                break;
        }
    }

    applyDeathTransform(grid, frameNum) {
        // Rotate/collapse the sprite
        if (frameNum >= 2) {
            // Shift everything down-right to simulate falling
            const newGrid = Array(16).fill(null).map(() => Array(16).fill(0));
            const shift = Math.min(frameNum - 1, 3);

            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < 16; x++) {
                    const newY = Math.min(15, y + shift);
                    const newX = Math.min(15, x + Math.floor(shift / 2));
                    if (grid[y][x] !== 0) {
                        newGrid[newY][newX] = grid[y][x];
                    }
                }
            }

            // Copy back
            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < 16; x++) {
                    grid[y][x] = newGrid[y][x];
                }
            }
        }
    }

    // Generate all animation frames
    generateAllFrames() {
        const frames = {
            idle: [],
            attack: [],
            hit: [],
            death: []
        };

        // Generate 4 idle frames
        for (let i = 0; i < 4; i++) {
            frames.idle.push(this.frameToStrings(this.generateFrame('idle', i)));
        }

        // Generate 4 attack frames
        for (let i = 0; i < 4; i++) {
            frames.attack.push(this.frameToStrings(this.generateFrame('attack', i)));
        }

        // Generate 2 hit frames
        for (let i = 0; i < 2; i++) {
            frames.hit.push(this.frameToStrings(this.generateFrame('hit', i)));
        }

        // Generate 4 death frames
        for (let i = 0; i < 4; i++) {
            frames.death.push(this.frameToStrings(this.generateFrame('death', i)));
        }

        return {
            colors: this.colors,
            ...frames
        };
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
            data: {
                name: genome.getName(),
                stats: {
                    BULK: genome.bulk,
                    SPEED: genome.speed,
                    FURY: genome.fury,
                    INSTINCT: genome.instinct
                },
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

// Export for use in game
if (typeof window !== 'undefined') {
    window.BugGenome = BugGenome;
    window.BugSpriteGenerator = BugSpriteGenerator;
    window.BugFactory = BugFactory;
}
