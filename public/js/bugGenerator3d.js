// Bug Fights - 3D Voxel Bug Generator
// Generates procedural 3D voxel bugs from genome

// ============================================
// BUG GENERATOR CLASS
// ============================================

class BugGenerator3D {
    constructor(genome) {
        this.genome = genome;
        this.voxels = []; // Array of {x, y, z, colorIndex}
        this.colors = this.generateColors();
        this.size = 16; // Base size ~16 voxels
        this.sizeMultiplier = genome.getSizeMultiplier ? genome.getSizeMultiplier() : 1;
    }

    generateColors() {
        const g = this.genome;

        // Use genome's color generation if available
        const primary = g.primaryColor || this.hslToHex(g.hue || Math.random() * 360, 70, 45);
        const secondary = g.secondaryColor || this.hslToHex((g.hue || 0) + 30, 60, 55);
        const accent = g.accentColor || this.hslToHex((g.hue || 0) + 180, 80, 50);

        return {
            0: null, // Transparent
            1: primary,           // Primary body
            2: secondary,         // Secondary/markings
            3: accent,            // Accent (eyes, weapon)
            4: this.darken(primary, 0.3),   // Shadow
            5: this.lighten(primary, 0.3),  // Highlight
            6: '#111111',         // Black (eyes, details)
            7: '#ffffff',         // White (eye shine)
        };
    }

    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    darken(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (num >> 16) * (1 - amount));
        const g = Math.max(0, ((num >> 8) & 0x00FF) * (1 - amount));
        const b = Math.max(0, (num & 0x0000FF) * (1 - amount));
        return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    }

    lighten(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.min(255, (num >> 16) + (255 - (num >> 16)) * amount);
        const g = Math.min(255, ((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * amount);
        const b = Math.min(255, (num & 0x0000FF) + (255 - (num & 0x0000FF)) * amount);
        return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    }

    addVoxels(voxelPositions, colorIndex) {
        voxelPositions.forEach(v => {
            this.voxels.push({ ...v, colorIndex });
        });
    }

    generate() {
        const g = this.genome;
        const scale = this.sizeMultiplier;

        // Clear previous
        this.voxels = [];

        // Body proportions based on genome
        const bulkFactor = 0.8 + (g.bulk / 100) * 0.6;
        const speedFactor = 0.8 + (g.speed / 100) * 0.4;

        // Generate body parts
        this.generateAbdomen(bulkFactor, scale);
        this.generateThorax(bulkFactor, speedFactor, scale);
        this.generateHead(speedFactor, scale);
        this.generateLegs(g.legStyle, scale);
        this.generateAntennae(scale);
        this.generateWeapon(g.weapon, scale);

        if (g.mobility === 'winged') {
            this.generateWings(scale);
        }

        // Add markings/patterns
        this.generateMarkings(scale);

        // Deduplicate
        this.voxels = this.dedupeVoxels(this.voxels);

        return {
            voxels: this.voxels,
            colors: this.colors,
            size: Math.ceil(this.size * scale),
        };
    }

    generateAbdomen(bulkFactor, scale) {
        // Abdomen - largest body segment, at rear
        const rx = Math.round(3 * bulkFactor * scale);
        const ry = Math.round(2.5 * bulkFactor * scale);
        const rz = Math.round(4 * bulkFactor * scale);

        const abdomenVoxels = VoxelUtils.createVoxelEllipsoid(0, 0, -4 * scale, rx, ry, rz);
        this.addVoxels(abdomenVoxels, 1); // Primary color

        // Stripes on abdomen
        for (let i = 0; i < 3; i++) {
            const stripeZ = -2 * scale - i * 2 * scale;
            const stripeVoxels = VoxelUtils.createVoxelEllipsoid(0, 0, stripeZ, rx * 0.9, ry * 0.9, 0.5);
            this.addVoxels(stripeVoxels, 2); // Secondary color
        }
    }

    generateThorax(bulkFactor, speedFactor, scale) {
        // Thorax - middle segment, legs attach here
        const rx = Math.round(2.5 * bulkFactor * scale);
        const ry = Math.round(2 * bulkFactor * scale);
        const rz = Math.round(2 * scale);

        const thoraxVoxels = VoxelUtils.createVoxelEllipsoid(0, 0.5 * scale, 0, rx, ry, rz);
        this.addVoxels(thoraxVoxels, 1); // Primary color
    }

    generateHead(speedFactor, scale) {
        // Head - front segment
        const headSize = Math.round(2 * scale);

        const headVoxels = VoxelUtils.createVoxelSphere(0, 1 * scale, 3 * scale, headSize);
        this.addVoxels(headVoxels, 1); // Primary color

        // Eyes
        const eyeSize = Math.max(1, Math.round(0.7 * scale));
        const eyeY = 1.5 * scale;
        const eyeZ = 4 * scale;

        // Left eye
        const leftEyeVoxels = VoxelUtils.createVoxelSphere(-1.2 * scale, eyeY, eyeZ, eyeSize);
        this.addVoxels(leftEyeVoxels, 6); // Black

        // Right eye
        const rightEyeVoxels = VoxelUtils.createVoxelSphere(1.2 * scale, eyeY, eyeZ, eyeSize);
        this.addVoxels(rightEyeVoxels, 6); // Black

        // Eye shine
        this.addVoxels([{ x: Math.round(-1.2 * scale), y: Math.round(eyeY + 0.5), z: Math.round(eyeZ + 0.5) }], 7);
        this.addVoxels([{ x: Math.round(1.2 * scale), y: Math.round(eyeY + 0.5), z: Math.round(eyeZ + 0.5) }], 7);
    }

    generateLegs(legStyle, scale) {
        const g = this.genome;

        // 6 legs, 3 per side, attached to thorax
        const legLength = Math.round(4 * scale);
        const legThickness = 1;

        // Leg attachment points on thorax
        const attachments = [
            { x: 2.5, y: -0.5, z: 1 },   // Front
            { x: 2.5, y: -0.5, z: 0 },   // Middle
            { x: 2.5, y: -0.5, z: -1 },  // Back
        ];

        attachments.forEach((attach, i) => {
            // Determine leg angles based on style
            let midAngle, endAngle;

            switch (legStyle) {
                case 'curved-back':
                    midAngle = -0.3 - i * 0.1;
                    endAngle = -0.6;
                    break;
                case 'curved-forward':
                    midAngle = 0.3 + i * 0.1;
                    endAngle = 0.6;
                    break;
                case 'short':
                    midAngle = -0.1;
                    endAngle = -0.4;
                    break;
                default: // straight
                    midAngle = 0;
                    endAngle = -0.3;
            }

            // Right leg
            const rightStart = {
                x: Math.round(attach.x * scale),
                y: Math.round(attach.y * scale),
                z: Math.round(attach.z * scale)
            };
            const rightMid = {
                x: Math.round((attach.x + 2) * scale),
                y: Math.round((attach.y - 1 + midAngle) * scale),
                z: Math.round((attach.z + midAngle * 2) * scale)
            };
            const rightEnd = {
                x: Math.round((attach.x + 3) * scale),
                y: Math.round((attach.y - 3 + endAngle) * scale),
                z: Math.round((attach.z + endAngle * 2) * scale)
            };

            // Upper leg segment
            this.addVoxels(VoxelUtils.createVoxelLine(rightStart, rightMid, legThickness), 4);
            // Lower leg segment
            this.addVoxels(VoxelUtils.createVoxelLine(rightMid, rightEnd, legThickness), 4);

            // Left leg (mirrored)
            const leftStart = { x: -rightStart.x, y: rightStart.y, z: rightStart.z };
            const leftMid = { x: -rightMid.x, y: rightMid.y, z: rightMid.z };
            const leftEnd = { x: -rightEnd.x, y: rightEnd.y, z: rightEnd.z };

            this.addVoxels(VoxelUtils.createVoxelLine(leftStart, leftMid, legThickness), 4);
            this.addVoxels(VoxelUtils.createVoxelLine(leftMid, leftEnd, legThickness), 4);
        });
    }

    generateAntennae(scale) {
        const length = Math.round(3 * scale);

        // Right antenna
        const rightBase = { x: Math.round(0.8 * scale), y: Math.round(2 * scale), z: Math.round(4 * scale) };
        const rightTip = { x: Math.round(2 * scale), y: Math.round(4 * scale), z: Math.round(5 * scale) };
        this.addVoxels(VoxelUtils.createVoxelLine(rightBase, rightTip, 1), 4);

        // Left antenna
        const leftBase = { x: -rightBase.x, y: rightBase.y, z: rightBase.z };
        const leftTip = { x: -rightTip.x, y: rightTip.y, z: rightTip.z };
        this.addVoxels(VoxelUtils.createVoxelLine(leftBase, leftTip, 1), 4);
    }

    generateWeapon(weaponType, scale) {
        const headZ = 3 * scale;
        const headY = 1 * scale;

        switch (weaponType) {
            case 'mandibles':
                // Two pincers
                const mandibleLength = Math.round(2 * scale);

                // Right mandible
                const rmBase = { x: Math.round(1 * scale), y: Math.round(headY - 0.5 * scale), z: Math.round(headZ + 1 * scale) };
                const rmMid = { x: Math.round(1.5 * scale), y: Math.round(headY - 0.5 * scale), z: Math.round(headZ + 2 * scale) };
                const rmTip = { x: Math.round(0.5 * scale), y: Math.round(headY - 0.5 * scale), z: Math.round(headZ + 3 * scale) };
                this.addVoxels(VoxelUtils.createVoxelLine(rmBase, rmMid, 1), 3);
                this.addVoxels(VoxelUtils.createVoxelLine(rmMid, rmTip, 1), 3);

                // Left mandible (mirrored)
                this.addVoxels(VoxelUtils.createVoxelLine(
                    { x: -rmBase.x, y: rmBase.y, z: rmBase.z },
                    { x: -rmMid.x, y: rmMid.y, z: rmMid.z },
                    1), 3);
                this.addVoxels(VoxelUtils.createVoxelLine(
                    { x: -rmMid.x, y: rmMid.y, z: rmMid.z },
                    { x: -rmTip.x, y: rmTip.y, z: rmTip.z },
                    1), 3);
                break;

            case 'stinger':
                // Single pointed stinger at rear
                const stingerBase = { x: 0, y: Math.round(-0.5 * scale), z: Math.round(-7 * scale) };
                const stingerTip = { x: 0, y: Math.round(-1 * scale), z: Math.round(-10 * scale) };
                this.addVoxels(VoxelUtils.createVoxelCylinder(stingerBase, stingerTip, 1.5, 0.3), 3);
                break;

            case 'fangs':
                // Two downward-pointing fangs
                const fangLength = Math.round(2 * scale);

                // Right fang
                const rfBase = { x: Math.round(0.8 * scale), y: Math.round(headY - 0.5 * scale), z: Math.round(headZ + 1.5 * scale) };
                const rfTip = { x: Math.round(0.8 * scale), y: Math.round(headY - 2 * scale), z: Math.round(headZ + 2 * scale) };
                this.addVoxels(VoxelUtils.createVoxelLine(rfBase, rfTip, 1), 3);

                // Left fang
                this.addVoxels(VoxelUtils.createVoxelLine(
                    { x: -rfBase.x, y: rfBase.y, z: rfBase.z },
                    { x: -rfTip.x, y: rfTip.y, z: rfTip.z },
                    1), 3);
                break;

            case 'claws':
                // Two claws at front
                const clawSize = Math.round(1.5 * scale);

                // Right claw
                const rcBase = { x: Math.round(1.5 * scale), y: Math.round(headY), z: Math.round(headZ + 1 * scale) };
                const rcTip1 = { x: Math.round(2 * scale), y: Math.round(headY + 0.5 * scale), z: Math.round(headZ + 2.5 * scale) };
                const rcTip2 = { x: Math.round(2.5 * scale), y: Math.round(headY - 0.5 * scale), z: Math.round(headZ + 2 * scale) };
                this.addVoxels(VoxelUtils.createVoxelLine(rcBase, rcTip1, 1), 3);
                this.addVoxels(VoxelUtils.createVoxelLine(rcBase, rcTip2, 1), 3);

                // Left claw (mirrored)
                this.addVoxels(VoxelUtils.createVoxelLine(
                    { x: -rcBase.x, y: rcBase.y, z: rcBase.z },
                    { x: -rcTip1.x, y: rcTip1.y, z: rcTip1.z },
                    1), 3);
                this.addVoxels(VoxelUtils.createVoxelLine(
                    { x: -rcBase.x, y: rcBase.y, z: rcBase.z },
                    { x: -rcTip2.x, y: rcTip2.y, z: rcTip2.z },
                    1), 3);
                break;
        }
    }

    generateWings(scale) {
        const wingLength = Math.round(5 * scale);
        const wingWidth = Math.round(3 * scale);

        // Right wing
        const rightWing = VoxelUtils.createVoxelWing(
            { x: Math.round(1.5 * scale), y: Math.round(1.5 * scale), z: 0 },
            wingLength,
            wingWidth,
            1,
            0.2
        );
        this.addVoxels(rightWing, 5); // Light/transparent color

        // Left wing
        const leftWing = VoxelUtils.createVoxelWing(
            { x: Math.round(-1.5 * scale), y: Math.round(1.5 * scale), z: 0 },
            wingLength,
            wingWidth,
            -1,
            0.2
        );
        this.addVoxels(leftWing, 5);
    }

    generateMarkings(scale) {
        // Add some variety with spots or stripes based on genome
        const markingType = this.genome.bodyPattern || 'none';

        if (markingType === 'spots' || Math.random() < 0.3) {
            // Add a few spots
            const numSpots = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numSpots; i++) {
                const spotX = Math.round((Math.random() - 0.5) * 3 * scale);
                const spotZ = Math.round(-4 * scale + Math.random() * 2 * scale);
                const spotVoxels = VoxelUtils.createVoxelSphere(spotX, Math.round(1.5 * scale), spotZ, 1);
                this.addVoxels(spotVoxels, 2);
            }
        }
    }

    dedupeVoxels(voxels) {
        const seen = new Map();
        voxels.forEach(v => {
            const key = `${v.x},${v.y},${v.z}`;
            // Keep the last color assigned (allows overwriting)
            seen.set(key, v);
        });
        return Array.from(seen.values());
    }

    // Generate all animation frames
    generateAllFrames() {
        const frames = {
            idle: [],
            attack: [],
            hit: [],
            death: [],
            victory: [],
        };

        // Idle frames (4 frames with subtle movement)
        for (let i = 0; i < 4; i++) {
            const frame = this.generateIdleFrame(i);
            frames.idle.push(frame);
        }

        // Attack frames (4 frames)
        for (let i = 0; i < 4; i++) {
            const frame = this.generateAttackFrame(i);
            frames.attack.push(frame);
        }

        // Hit frames (2 frames)
        for (let i = 0; i < 2; i++) {
            const frame = this.generateHitFrame(i);
            frames.hit.push(frame);
        }

        // Death frames (4 frames)
        for (let i = 0; i < 4; i++) {
            const frame = this.generateDeathFrame(i);
            frames.death.push(frame);
        }

        // Victory frames (4 frames)
        for (let i = 0; i < 4; i++) {
            const frame = this.generateVictoryFrame(i);
            frames.victory.push(frame);
        }

        return {
            frames,
            colors: this.colors,
            size: Math.ceil(this.size * this.sizeMultiplier),
        };
    }

    generateIdleFrame(frameIndex) {
        // Generate fresh base for each frame
        this.voxels = [];
        const g = this.genome;
        const scale = this.sizeMultiplier;
        const bulkFactor = 0.8 + (g.bulk / 100) * 0.6;
        const speedFactor = 0.8 + (g.speed / 100) * 0.4;

        // Breathing motion - subtle body compression/expansion
        const breathPhase = frameIndex * Math.PI / 2;
        const breathScale = 1 + Math.sin(breathPhase) * 0.05;

        // Generate body parts with breathing
        this.generateAbdomen(bulkFactor * breathScale, scale);
        this.generateThorax(bulkFactor * breathScale, speedFactor, scale);
        this.generateHead(speedFactor, scale);

        // Legs with subtle movement
        this.generateAnimatedLegs(g.legStyle, scale, frameIndex, 'idle');

        // Antennae with wave
        this.generateAnimatedAntennae(scale, frameIndex);

        this.generateWeapon(g.weapon, scale);

        if (g.mobility === 'winged') {
            this.generateAnimatedWings(scale, frameIndex, 'idle');
        }

        this.generateMarkings(scale);
        this.voxels = this.dedupeVoxels(this.voxels);

        return {
            voxels: this.voxels,
            colors: this.colors,
            size: Math.ceil(this.size * scale),
        };
    }

    generateAttackFrame(frameIndex) {
        this.voxels = [];
        const g = this.genome;
        const scale = this.sizeMultiplier;
        const bulkFactor = 0.8 + (g.bulk / 100) * 0.6;
        const speedFactor = 0.8 + (g.speed / 100) * 0.4;

        // Lunge amounts: windup, extend, strike, recover
        const lungeZ = [0, 1, 3, 1][frameIndex];
        const squashFactor = [1, 0.95, 0.85, 0.95][frameIndex];

        this.generateAbdomen(bulkFactor * squashFactor, scale);
        this.generateThorax(bulkFactor * squashFactor, speedFactor, scale);
        this.generateHead(speedFactor, scale);
        this.generateAnimatedLegs(g.legStyle, scale, frameIndex, 'attack');
        this.generateAntennae(scale);
        this.generateWeapon(g.weapon, scale);

        if (g.mobility === 'winged') {
            this.generateWings(scale);
        }

        this.generateMarkings(scale);
        this.voxels = this.dedupeVoxels(this.voxels);

        // Apply lunge translation
        this.voxels = VoxelUtils.translateVoxels(this.voxels, 0, 0, lungeZ);

        return {
            voxels: this.voxels,
            colors: this.colors,
            size: Math.ceil(this.size * scale),
        };
    }

    generateHitFrame(frameIndex) {
        this.voxels = [];
        const g = this.genome;
        const scale = this.sizeMultiplier;
        const bulkFactor = 0.8 + (g.bulk / 100) * 0.6;
        const speedFactor = 0.8 + (g.speed / 100) * 0.4;

        // Recoil: hit, recovery
        const recoilZ = [-2, -1][frameIndex];
        const squashFactor = [1.15, 1.05][frameIndex]; // Expand on hit

        this.generateAbdomen(bulkFactor * squashFactor, scale);
        this.generateThorax(bulkFactor * squashFactor, speedFactor, scale);
        this.generateHead(speedFactor, scale);
        this.generateLegs(g.legStyle, scale);
        this.generateAntennae(scale);
        this.generateWeapon(g.weapon, scale);

        if (g.mobility === 'winged') {
            this.generateWings(scale);
        }

        this.generateMarkings(scale);
        this.voxels = this.dedupeVoxels(this.voxels);

        // Apply recoil translation
        this.voxels = VoxelUtils.translateVoxels(this.voxels, 0, 0, recoilZ);

        return {
            voxels: this.voxels,
            colors: this.colors,
            size: Math.ceil(this.size * scale),
        };
    }

    generateDeathFrame(frameIndex) {
        this.voxels = [];
        const g = this.genome;
        const scale = this.sizeMultiplier;
        const bulkFactor = 0.8 + (g.bulk / 100) * 0.6;
        const speedFactor = 0.8 + (g.speed / 100) * 0.4;

        this.generateAbdomen(bulkFactor, scale);
        this.generateThorax(bulkFactor, speedFactor, scale);
        this.generateHead(speedFactor, scale);
        this.generateLegs(g.legStyle, scale);
        this.generateAntennae(scale);
        this.generateWeapon(g.weapon, scale);

        if (g.mobility === 'winged') {
            this.generateWings(scale);
        }

        this.generateMarkings(scale);
        this.voxels = this.dedupeVoxels(this.voxels);

        // Progressive rotation and sinking
        const rotationAmount = (frameIndex / 3) * (Math.PI / 2);
        const sinkAmount = frameIndex * 1.5;

        this.voxels = VoxelUtils.rotateVoxelsX(this.voxels, rotationAmount);
        this.voxels = VoxelUtils.translateVoxels(this.voxels, 0, -sinkAmount, 0);

        return {
            voxels: this.voxels,
            colors: this.colors,
            size: Math.ceil(this.size * scale),
        };
    }

    generateVictoryFrame(frameIndex) {
        this.voxels = [];
        const g = this.genome;
        const scale = this.sizeMultiplier;
        const bulkFactor = 0.8 + (g.bulk / 100) * 0.6;
        const speedFactor = 0.8 + (g.speed / 100) * 0.4;

        this.generateAbdomen(bulkFactor, scale);
        this.generateThorax(bulkFactor, speedFactor, scale);
        this.generateHead(speedFactor, scale);
        this.generateAnimatedLegs(g.legStyle, scale, frameIndex, 'victory');
        this.generateAntennae(scale);
        this.generateWeapon(g.weapon, scale);

        if (g.mobility === 'winged') {
            this.generateAnimatedWings(scale, frameIndex, 'victory');
        }

        this.generateMarkings(scale);
        this.voxels = this.dedupeVoxels(this.voxels);

        // Bounce animation
        const bounceHeight = Math.abs(Math.sin(frameIndex * Math.PI / 2)) * 3;
        this.voxels = VoxelUtils.translateVoxels(this.voxels, 0, bounceHeight, 0);

        return {
            voxels: this.voxels,
            colors: this.colors,
            size: Math.ceil(this.size * scale),
        };
    }

    // Animated legs with movement
    generateAnimatedLegs(legStyle, scale, frameIndex, animType) {
        const legLength = Math.round(4 * scale);
        const legThickness = 1;

        const attachments = [
            { x: 2.5, y: -0.5, z: 1, phase: 0 },     // Front
            { x: 2.5, y: -0.5, z: 0, phase: 0.33 },  // Middle
            { x: 2.5, y: -0.5, z: -1, phase: 0.66 }, // Back
        ];

        attachments.forEach((attach, i) => {
            let midAngle, endAngle;

            switch (legStyle) {
                case 'curved-back':
                    midAngle = -0.3 - i * 0.1;
                    endAngle = -0.6;
                    break;
                case 'curved-forward':
                    midAngle = 0.3 + i * 0.1;
                    endAngle = 0.6;
                    break;
                case 'short':
                    midAngle = -0.1;
                    endAngle = -0.4;
                    break;
                default:
                    midAngle = 0;
                    endAngle = -0.3;
            }

            // Animation offset based on leg and frame
            let legOffset = 0;
            if (animType === 'idle') {
                legOffset = Math.sin((frameIndex + attach.phase * 4) * Math.PI / 2) * 0.3;
            } else if (animType === 'attack') {
                legOffset = frameIndex === 2 ? 0.5 : 0; // Brace on strike
            } else if (animType === 'victory') {
                legOffset = Math.abs(Math.sin((frameIndex + i) * Math.PI / 2)) * 0.4;
            }

            // Right leg
            const rightStart = {
                x: Math.round(attach.x * scale),
                y: Math.round(attach.y * scale),
                z: Math.round(attach.z * scale)
            };
            const rightMid = {
                x: Math.round((attach.x + 2) * scale),
                y: Math.round((attach.y - 1 + midAngle + legOffset) * scale),
                z: Math.round((attach.z + midAngle * 2) * scale)
            };
            const rightEnd = {
                x: Math.round((attach.x + 3) * scale),
                y: Math.round((attach.y - 3 + endAngle) * scale),
                z: Math.round((attach.z + endAngle * 2) * scale)
            };

            this.addVoxels(VoxelUtils.createVoxelLine(rightStart, rightMid, legThickness), 4);
            this.addVoxels(VoxelUtils.createVoxelLine(rightMid, rightEnd, legThickness), 4);

            // Left leg (mirrored)
            const leftStart = { x: -rightStart.x, y: rightStart.y, z: rightStart.z };
            const leftMid = { x: -rightMid.x, y: rightMid.y, z: rightMid.z };
            const leftEnd = { x: -rightEnd.x, y: rightEnd.y, z: rightEnd.z };

            this.addVoxels(VoxelUtils.createVoxelLine(leftStart, leftMid, legThickness), 4);
            this.addVoxels(VoxelUtils.createVoxelLine(leftMid, leftEnd, legThickness), 4);
        });
    }

    // Animated antennae
    generateAnimatedAntennae(scale, frameIndex) {
        const waveOffset = Math.sin(frameIndex * Math.PI / 2) * 0.5;

        // Right antenna
        const rightBase = { x: Math.round(0.8 * scale), y: Math.round(2 * scale), z: Math.round(4 * scale) };
        const rightTip = {
            x: Math.round((2 + waveOffset) * scale),
            y: Math.round(4 * scale),
            z: Math.round(5 * scale)
        };
        this.addVoxels(VoxelUtils.createVoxelLine(rightBase, rightTip, 1), 4);

        // Left antenna
        const leftBase = { x: -rightBase.x, y: rightBase.y, z: rightBase.z };
        const leftTip = { x: -rightTip.x, y: rightTip.y, z: rightTip.z };
        this.addVoxels(VoxelUtils.createVoxelLine(leftBase, leftTip, 1), 4);
    }

    // Animated wings
    generateAnimatedWings(scale, frameIndex, animType) {
        let wingAngle = 0.2;

        if (animType === 'idle') {
            // Gentle flutter
            wingAngle = 0.1 + Math.sin(frameIndex * Math.PI / 2) * 0.3;
        } else if (animType === 'victory') {
            // Rapid flutter
            wingAngle = 0.2 + Math.sin(frameIndex * Math.PI) * 0.5;
        }

        const wingLength = Math.round(5 * scale);
        const wingWidth = Math.round(3 * scale);

        // Right wing
        const rightWing = VoxelUtils.createVoxelWing(
            { x: Math.round(1.5 * scale), y: Math.round(1.5 * scale), z: 0 },
            wingLength,
            wingWidth,
            1,
            wingAngle
        );
        this.addVoxels(rightWing, 5);

        // Left wing
        const leftWing = VoxelUtils.createVoxelWing(
            { x: Math.round(-1.5 * scale), y: Math.round(1.5 * scale), z: 0 },
            wingLength,
            wingWidth,
            -1,
            wingAngle
        );
        this.addVoxels(leftWing, 5);
    }
}

// Export
window.BugGenerator3D = BugGenerator3D;
