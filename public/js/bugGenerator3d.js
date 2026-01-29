// Bug Fights - 3D Shape-Based Bug Generator
// Generates procedural 3D bugs from genome using primitive shapes

// ============================================
// CHITIN TEXTURE GENERATOR CLASS
// Creates realistic insect exoskeleton textures
// ============================================

class ChitinTextureGenerator {
    constructor(size = 512) {
        this.size = size;
        // Noise helpers
        this.noiseGrid = null;
        this.initNoise();
    }

    initNoise() {
        // Pre-generate noise grid for consistent patterns
        const gridSize = 32;
        this.noiseGrid = [];
        for (let i = 0; i < gridSize * gridSize; i++) {
            this.noiseGrid.push(Math.random());
        }
    }

    // Seeded random for reproducible results
    seededRandom(seed) {
        const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    }

    // Value noise with smooth interpolation
    noise2D(x, y, scale = 1) {
        const gridSize = 32;
        x = x * scale;
        y = y * scale;

        const x0 = Math.floor(x) & 31;
        const y0 = Math.floor(y) & 31;
        const x1 = (x0 + 1) & 31;
        const y1 = (y0 + 1) & 31;

        const sx = x - Math.floor(x);
        const sy = y - Math.floor(y);

        // Smoothstep
        const tx = sx * sx * (3 - 2 * sx);
        const ty = sy * sy * (3 - 2 * sy);

        const n00 = this.noiseGrid[y0 * gridSize + x0];
        const n10 = this.noiseGrid[y0 * gridSize + x1];
        const n01 = this.noiseGrid[y1 * gridSize + x0];
        const n11 = this.noiseGrid[y1 * gridSize + x1];

        const nx0 = n00 + tx * (n10 - n00);
        const nx1 = n01 + tx * (n11 - n01);

        return nx0 + ty * (nx1 - nx0);
    }

    // Fractal Brownian Motion - layered noise for organic look
    fbm(x, y, octaves = 4) {
        let value = 0;
        let amplitude = 0.5;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * this.noise2D(x * frequency, y * frequency, 0.1);
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return value / maxValue;
    }

    /**
     * Generate complete texture set for a texture type
     * Returns { diffuse, normal, roughness } textures
     */
    generate(textureType, primaryColor, secondaryColor, seed = 0) {
        switch (textureType) {
            case 'plated':
                return this.generatePlated(primaryColor, secondaryColor, seed);
            case 'rough':
                return this.generateRough(primaryColor, secondaryColor, seed);
            case 'spotted':
                return this.generateSpotted(primaryColor, secondaryColor, seed);
            case 'striped':
                return this.generateStriped(primaryColor, secondaryColor, seed);
            case 'smooth':
            default:
                return this.generateSmooth(primaryColor, secondaryColor, seed);
        }
    }

    // Parse hex color to RGB object
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
    }

    // Blend two colors
    blendColors(c1, c2, t) {
        return {
            r: Math.round(c1.r + (c2.r - c1.r) * t),
            g: Math.round(c1.g + (c2.g - c1.g) * t),
            b: Math.round(c1.b + (c2.b - c1.b) * t)
        };
    }

    /**
     * SMOOTH CHITIN - Sleek wasp/ant exoskeleton
     * Satin finish - not glossy plastic, more natural matte-ish
     */
    generateSmooth(primaryColor, secondaryColor, seed) {
        const size = this.size;
        const primary = this.hexToRgb(primaryColor);

        const diffuseCanvas = document.createElement('canvas');
        const normalCanvas = document.createElement('canvas');
        const roughnessCanvas = document.createElement('canvas');

        [diffuseCanvas, normalCanvas, roughnessCanvas].forEach(c => {
            c.width = size;
            c.height = size;
        });

        const diffuseCtx = diffuseCanvas.getContext('2d');
        const normalCtx = normalCanvas.getContext('2d');
        const roughnessCtx = roughnessCanvas.getContext('2d');

        const diffuseData = diffuseCtx.createImageData(size, size);
        const normalData = normalCtx.createImageData(size, size);
        const roughnessData = roughnessCtx.createImageData(size, size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const nx = x / size;
                const ny = y / size;

                // Very subtle color variation to break up uniformity
                const variation = this.fbm(nx * 2 + seed * 0.1, ny * 2 + seed * 0.1, 1) * 0.05;
                const r = Math.max(0, Math.min(255, primary.r + (variation * 30)));
                const g = Math.max(0, Math.min(255, primary.g + (variation * 30)));
                const b = Math.max(0, Math.min(255, primary.b + (variation * 30)));

                diffuseData.data[idx] = r;
                diffuseData.data[idx + 1] = g;
                diffuseData.data[idx + 2] = b;
                diffuseData.data[idx + 3] = 255;

                // Normal - flat, no bumps
                normalData.data[idx] = 128;
                normalData.data[idx + 1] = 128;
                normalData.data[idx + 2] = 255;
                normalData.data[idx + 3] = 255;

                // Roughness - satin finish (higher = more matte, less plastic)
                roughnessData.data[idx] = 160;
                roughnessData.data[idx + 1] = 160;
                roughnessData.data[idx + 2] = 160;
                roughnessData.data[idx + 3] = 255;
            }
        }

        diffuseCtx.putImageData(diffuseData, 0, 0);
        normalCtx.putImageData(normalData, 0, 0);
        roughnessCtx.putImageData(roughnessData, 0, 0);

        return this.createTextures(diffuseCanvas, normalCanvas, roughnessCanvas);
    }

    /**
     * PLATED CHITIN - Beetle armor with overlapping segments
     * Visible plate edges, highlights on ridges, darker in crevices
     */
    generatePlated(primaryColor, secondaryColor, seed) {
        const size = this.size;
        const primary = this.hexToRgb(primaryColor);
        const secondary = this.hexToRgb(secondaryColor);
        const dark = { r: primary.r * 0.3, g: primary.g * 0.3, b: primary.b * 0.3 };
        const highlight = {
            r: Math.min(255, primary.r * 1.4),
            g: Math.min(255, primary.g * 1.4),
            b: Math.min(255, primary.b * 1.4)
        };

        const diffuseCanvas = document.createElement('canvas');
        const normalCanvas = document.createElement('canvas');
        const roughnessCanvas = document.createElement('canvas');

        [diffuseCanvas, normalCanvas, roughnessCanvas].forEach(c => {
            c.width = size;
            c.height = size;
        });

        const diffuseCtx = diffuseCanvas.getContext('2d');
        const normalCtx = normalCanvas.getContext('2d');
        const roughnessCtx = roughnessCanvas.getContext('2d');

        const diffuseData = diffuseCtx.createImageData(size, size);
        const normalData = normalCtx.createImageData(size, size);
        const roughnessData = roughnessCtx.createImageData(size, size);

        // Horizontal armor bands - like beetle segments
        const plateCount = 5 + Math.floor(this.seededRandom(seed) * 3); // 5-7 plates
        const plateHeight = size / plateCount;
        const grooveWidth = 6; // pixels for groove between plates

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;

                // Which plate are we on?
                const plateIndex = Math.floor(y / plateHeight);
                const posInPlate = y % plateHeight;

                // Groove at top of each plate
                const isGroove = posInPlate < grooveWidth;
                const grooveDepth = isGroove ? 1 - (posInPlate / grooveWidth) : 0;

                // Ridge/highlight just below groove
                const isRidge = posInPlate >= grooveWidth && posInPlate < grooveWidth + 8;
                const ridgeStrength = isRidge ? 1 - ((posInPlate - grooveWidth) / 8) : 0;

                // Subtle per-plate color variation
                const plateVariation = this.seededRandom(plateIndex + seed) * 0.08 - 0.04;
                let color = {
                    r: Math.max(0, Math.min(255, primary.r * (1 + plateVariation))),
                    g: Math.max(0, Math.min(255, primary.g * (1 + plateVariation))),
                    b: Math.max(0, Math.min(255, primary.b * (1 + plateVariation)))
                };

                // Darken grooves
                if (isGroove) {
                    color = this.blendColors(color, dark, grooveDepth * 0.7);
                }

                // Highlight ridges
                if (isRidge) {
                    color = this.blendColors(color, highlight, ridgeStrength * 0.3);
                }

                diffuseData.data[idx] = color.r;
                diffuseData.data[idx + 1] = color.g;
                diffuseData.data[idx + 2] = color.b;
                diffuseData.data[idx + 3] = 255;

                // Normal map - grooves indent, ridges protrude
                let normalY = 128;
                if (isGroove) {
                    normalY = 128 + grooveDepth * 60; // pointing down into groove
                } else if (isRidge) {
                    normalY = 128 - ridgeStrength * 40; // pointing up from ridge
                }

                normalData.data[idx] = 128;
                normalData.data[idx + 1] = normalY;
                normalData.data[idx + 2] = 255;
                normalData.data[idx + 3] = 255;

                // Roughness - glossy plates, matte grooves
                let roughness = 50; // glossy armor
                if (isGroove) {
                    roughness = 50 + grooveDepth * 130;
                }

                roughnessData.data[idx] = roughness;
                roughnessData.data[idx + 1] = roughness;
                roughnessData.data[idx + 2] = roughness;
                roughnessData.data[idx + 3] = 255;
            }
        }

        diffuseCtx.putImageData(diffuseData, 0, 0);
        normalCtx.putImageData(normalData, 0, 0);
        roughnessCtx.putImageData(roughnessData, 0, 0);

        return this.createTextures(diffuseCanvas, normalCanvas, roughnessCanvas);
    }

    /**
     * ROUGH CHITIN - Bumpy, weathered surface with pits and protrusions
     * Like old beetles, crickets - worn, textured exoskeleton
     */
    generateRough(primaryColor, secondaryColor, seed) {
        const size = this.size;
        const primary = this.hexToRgb(primaryColor);
        const secondary = this.hexToRgb(secondaryColor);

        const diffuseCanvas = document.createElement('canvas');
        const normalCanvas = document.createElement('canvas');
        const roughnessCanvas = document.createElement('canvas');

        [diffuseCanvas, normalCanvas, roughnessCanvas].forEach(c => {
            c.width = size;
            c.height = size;
        });

        const diffuseCtx = diffuseCanvas.getContext('2d');
        const normalCtx = normalCanvas.getContext('2d');
        const roughnessCtx = roughnessCanvas.getContext('2d');

        const diffuseData = diffuseCtx.createImageData(size, size);
        const normalData = normalCtx.createImageData(size, size);
        const roughnessData = roughnessCtx.createImageData(size, size);

        // Seeded random for consistent bumps
        const seededRand = (n) => {
            const x = Math.sin(seed + n * 127.1) * 43758.5453;
            return x - Math.floor(x);
        };

        // Initialize normal map with base noise
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const nx = x / size;
                const ny = y / size;

                // Color variation
                const variation = this.fbm(nx + seed * 0.1, ny + seed * 0.1, 2) * 0.2;
                const color = this.blendColors(primary, secondary, Math.abs(variation));

                diffuseData.data[idx] = color.r;
                diffuseData.data[idx + 1] = color.g;
                diffuseData.data[idx + 2] = color.b;
                diffuseData.data[idx + 3] = 255;

                // Base normal with subtle noise
                const baseNoise = this.fbm(nx * 4, ny * 4, 2) * 30;
                normalData.data[idx] = 128 + baseNoise;
                normalData.data[idx + 1] = 128 + baseNoise;
                normalData.data[idx + 2] = 255;
                normalData.data[idx + 3] = 255;

                // Matte roughness
                roughnessData.data[idx] = 180 + seededRand(x + y * size) * 40;
                roughnessData.data[idx + 1] = roughnessData.data[idx];
                roughnessData.data[idx + 2] = roughnessData.data[idx];
                roughnessData.data[idx + 3] = 255;
            }
        }

        // Add random bumps and pits
        const numBumps = 60 + Math.floor(seededRand(seed) * 40);
        for (let i = 0; i < numBumps; i++) {
            const bx = seededRand(i * 2) * size;
            const by = seededRand(i * 2 + 1) * size;
            const radius = 4 + seededRand(i * 3) * 14;
            const isRaised = seededRand(i * 4) > 0.35; // 65% raised, 35% pits

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > radius) continue;

                    const px = (Math.floor(bx + dx) + size) % size;
                    const py = (Math.floor(by + dy) + size) % size;
                    const idx = (py * size + px) * 4;

                    // Calculate normal direction based on position on bump
                    const normalStrength = (1 - dist / radius) * 45;
                    const bnx = (dx / radius) * normalStrength * (isRaised ? 1 : -1);
                    const bny = (dy / radius) * normalStrength * (isRaised ? 1 : -1);

                    normalData.data[idx] = Math.max(0, Math.min(255, normalData.data[idx] + bnx));
                    normalData.data[idx + 1] = Math.max(0, Math.min(255, normalData.data[idx + 1] + bny));

                    // Darken pits slightly in diffuse
                    if (!isRaised) {
                        const darkening = (1 - dist / radius) * 0.15;
                        diffuseData.data[idx] *= (1 - darkening);
                        diffuseData.data[idx + 1] *= (1 - darkening);
                        diffuseData.data[idx + 2] *= (1 - darkening);
                    }
                }
            }
        }

        diffuseCtx.putImageData(diffuseData, 0, 0);
        normalCtx.putImageData(normalData, 0, 0);
        roughnessCtx.putImageData(roughnessData, 0, 0);

        return this.createTextures(diffuseCanvas, normalCanvas, roughnessCanvas);
    }

    /**
     * SPOTTED CHITIN - Bold spots like ladybugs or leopard beetles
     * Large, clearly visible spots with slight depth
     */
    generateSpotted(primaryColor, secondaryColor, seed) {
        const size = this.size;
        const primary = this.hexToRgb(primaryColor);
        const secondary = this.hexToRgb(secondaryColor);

        // Make spots darker/contrasting version of secondary color
        const spotColor = {
            r: Math.max(0, secondary.r * 0.3),
            g: Math.max(0, secondary.g * 0.3),
            b: Math.max(0, secondary.b * 0.3)
        };

        const diffuseCanvas = document.createElement('canvas');
        const normalCanvas = document.createElement('canvas');
        const roughnessCanvas = document.createElement('canvas');

        [diffuseCanvas, normalCanvas, roughnessCanvas].forEach(c => {
            c.width = size;
            c.height = size;
        });

        const diffuseCtx = diffuseCanvas.getContext('2d');
        const normalCtx = normalCanvas.getContext('2d');
        const roughnessCtx = roughnessCanvas.getContext('2d');

        const diffuseData = diffuseCtx.createImageData(size, size);
        const normalData = normalCtx.createImageData(size, size);
        const roughnessData = roughnessCtx.createImageData(size, size);

        // Seeded random
        const seededRand = (n) => {
            const x = Math.sin(seed + n * 127.1) * 43758.5453;
            return x - Math.floor(x);
        };

        // Create spot map
        const spotMap = new Float32Array(size * size);

        // Generate spots - fewer but larger and more prominent
        const spotCount = 12 + Math.floor(seededRand(seed * 7) * 10); // 12-22 spots
        const spots = [];

        for (let i = 0; i < spotCount; i++) {
            spots.push({
                x: seededRand(i * 2) * size,
                y: seededRand(i * 2 + 1) * size,
                radius: 15 + seededRand(i * 3) * 30, // Larger spots (15-45 px)
                irregularity: 0.15 + seededRand(i * 4) * 0.2 // How wobbly the edge is
            });
        }

        // Fill base color and calculate spot coverage
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                let inSpot = 0;

                // Check each spot
                for (let s = 0; s < spots.length; s++) {
                    const spot = spots[s];
                    // Handle wrapping for seamless texture
                    let dx = x - spot.x;
                    let dy = y - spot.y;
                    if (dx > size / 2) dx -= size;
                    if (dx < -size / 2) dx += size;
                    if (dy > size / 2) dy -= size;
                    if (dy < -size / 2) dy += size;

                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Irregular edge using angle-based noise
                    const angle = Math.atan2(dy, dx);
                    const edgeNoise = seededRand(s * 100 + Math.floor(angle * 10)) * spot.irregularity;
                    const effectiveRadius = spot.radius * (1 + edgeNoise);

                    if (dist < effectiveRadius) {
                        // Soft edge falloff
                        const edge = effectiveRadius * 0.85;
                        if (dist < edge) {
                            inSpot = 1;
                        } else {
                            inSpot = Math.max(inSpot, 1 - (dist - edge) / (effectiveRadius - edge));
                        }
                    }
                }

                spotMap[y * size + x] = inSpot;

                // Blend colors based on spot coverage
                const color = this.blendColors(primary, spotColor, inSpot);

                diffuseData.data[idx] = color.r;
                diffuseData.data[idx + 1] = color.g;
                diffuseData.data[idx + 2] = color.b;
                diffuseData.data[idx + 3] = 255;

                // Normal - spots are slightly recessed
                const recess = inSpot * 15;
                normalData.data[idx] = 128;
                normalData.data[idx + 1] = 128 - recess;
                normalData.data[idx + 2] = 255;
                normalData.data[idx + 3] = 255;

                // Roughness - spots slightly more matte
                const roughness = 130 + inSpot * 40;
                roughnessData.data[idx] = roughness;
                roughnessData.data[idx + 1] = roughness;
                roughnessData.data[idx + 2] = roughness;
                roughnessData.data[idx + 3] = 255;
            }
        }

        diffuseCtx.putImageData(diffuseData, 0, 0);
        normalCtx.putImageData(normalData, 0, 0);
        roughnessCtx.putImageData(roughnessData, 0, 0);

        return this.createTextures(diffuseCanvas, normalCanvas, roughnessCanvas);
    }

    /**
     * STRIPED CHITIN - Horizontal bands like a sailor shirt
     * Stripes wrap around body segments like rings
     */
    generateStriped(primaryColor, secondaryColor, seed) {
        const size = this.size;
        const primary = this.hexToRgb(primaryColor);
        const secondary = this.hexToRgb(secondaryColor);

        // Make stripes a darker/contrasting color
        const stripeColor = {
            r: Math.max(0, secondary.r * 0.35),
            g: Math.max(0, secondary.g * 0.35),
            b: Math.max(0, secondary.b * 0.35)
        };

        const diffuseCanvas = document.createElement('canvas');
        const normalCanvas = document.createElement('canvas');
        const roughnessCanvas = document.createElement('canvas');

        [diffuseCanvas, normalCanvas, roughnessCanvas].forEach(c => {
            c.width = size;
            c.height = size;
        });

        const diffuseCtx = diffuseCanvas.getContext('2d');
        const normalCtx = normalCanvas.getContext('2d');
        const roughnessCtx = roughnessCanvas.getContext('2d');

        const diffuseData = diffuseCtx.createImageData(size, size);
        const normalData = normalCtx.createImageData(size, size);
        const roughnessData = roughnessCtx.createImageData(size, size);

        // Seeded random
        const seededRand = (n) => {
            const x = Math.sin(seed + n * 127.1) * 43758.5453;
            return x - Math.floor(x);
        };

        // Stripe parameters - horizontal bands in texture space
        // These will wrap around when applied to spheres
        const stripeCount = 3 + Math.floor(seededRand(seed) * 3); // 3-5 stripes
        const stripeWidth = size / (stripeCount * 2); // Width of each stripe

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;

                // Calculate stripe based on Y position (horizontal bands)
                // This creates rings when texture wraps around sphere
                const stripePhase = (y / size) * stripeCount * 2;
                const inStripe = (stripePhase % 2) < 1;

                // Soft edge transition
                const stripeT = stripePhase % 1;
                const edgeSoftness = 0.15;
                let stripeFactor = 0;

                if (inStripe) {
                    if (stripeT < edgeSoftness) {
                        stripeFactor = stripeT / edgeSoftness;
                    } else if (stripeT > 1 - edgeSoftness) {
                        stripeFactor = (1 - stripeT) / edgeSoftness;
                    } else {
                        stripeFactor = 1;
                    }
                }

                // Blend colors
                const color = this.blendColors(primary, stripeColor, stripeFactor);

                diffuseData.data[idx] = color.r;
                diffuseData.data[idx + 1] = color.g;
                diffuseData.data[idx + 2] = color.b;
                diffuseData.data[idx + 3] = 255;

                // Normal - flat
                normalData.data[idx] = 128;
                normalData.data[idx + 1] = 128;
                normalData.data[idx + 2] = 255;
                normalData.data[idx + 3] = 255;

                // Roughness - satin finish
                roughnessData.data[idx] = 140;
                roughnessData.data[idx + 1] = 140;
                roughnessData.data[idx + 2] = 140;
                roughnessData.data[idx + 3] = 255;
            }
        }

        diffuseCtx.putImageData(diffuseData, 0, 0);
        normalCtx.putImageData(normalData, 0, 0);
        roughnessCtx.putImageData(roughnessData, 0, 0);

        return this.createTextures(diffuseCanvas, normalCanvas, roughnessCanvas);
    }

    createTextures(diffuseCanvas, normalCanvas, roughnessCanvas) {
        const createTex = (canvas) => {
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.anisotropy = 4;
            return tex;
        };

        return {
            diffuse: createTex(diffuseCanvas),
            normal: createTex(normalCanvas),
            roughness: createTex(roughnessCanvas)
        };
    }
}

// Legacy TextureGenerator for backwards compatibility
class TextureGenerator {
    constructor(size = 256) {
        this.chitinGen = new ChitinTextureGenerator(size);
    }

    generate(textureType) {
        // Return just the normal map for backwards compatibility
        const textures = this.chitinGen.generate(textureType, '#888888', '#666666', 0);
        return textures.normal;
    }
}
// ============================================
// BUG GENERATOR CLASS
// ============================================

class BugGenerator3D {
    constructor(genome) {
        this.genome = genome;
        this.colors = this.generateColors();
        this.sizeMultiplier = genome.getSizeMultiplier ? genome.getSizeMultiplier() : 1;
        // Cached chitin textures (diffuse, normal, roughness)
        this.chitinTextures = null;
    }


    generateColors() {
        const g = this.genome;

        // Get color from genome's color object (hue, saturation, lightness)
        const hue = g.color ? g.color.hue : (Math.random() * 360);
        const sat = g.color ? g.color.saturation * 100 : 70;
        const light = g.color ? g.color.lightness * 100 : 45;
        const accentHue = g.accentHue || ((hue + 180) % 360);

        const primary = this.hslToHex(hue, sat, light);
        const secondary = this.hslToHex(hue, sat * 0.8, light * 1.2);
        const accent = this.hslToHex(accentHue, 80, 50);

        return {
            primary: primary,
            secondary: secondary,
            accent: accent,
            dark: this.darken(primary, 0.3),
            light: this.lighten(primary, 0.3),
            black: '#111111',
            white: '#ffffff',
            eye: '#ff0000',  // Menacing red eyes
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

    /**
     * Remap UVs for cylindrical mapping around Z axis
     * Makes stripes wrap around the body like rings
     */
    remapUVsForStripes(geometry) {
        const pos = geometry.attributes.position;
        const uv = geometry.attributes.uv;

        // Find Z bounds for normalization
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }
        const zRange = maxZ - minZ || 1;

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);

            // U wraps around the XY plane (around Z axis)
            const u = (Math.atan2(y, x) / Math.PI + 1) / 2;

            // V maps along the Z axis (normalized to actual geometry bounds)
            const v = (z - minZ) / zRange;

            uv.setXY(i, u, v);
        }

        uv.needsUpdate = true;
        return geometry;
    }

    /**
     * Check if texture needs UV remapping for horizontal bands
     * (striped and plated both need bands to wrap around body)
     */
    needsStripeUVs() {
        const t = this.genome.textureType;
        return t === 'striped' || t === 'plated';
    }

    /**
     * Create sphere geometry, with UV remapping if striped
     */
    createBodySphere(radius, widthSegments, heightSegments) {
        const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
        return geo;
    }

    /**
     * Apply UV remapping after scaling if needed
     */
    finalizeBodyGeometry(geometry) {
        if (this.needsStripeUVs()) {
            this.remapUVsForStripes(geometry);
        }
        return geometry;
    }

    /**
     * Create material with realistic chitin texture
     * Set options.skipTexture = true to skip texture (for eyes, etc.)
     */
    createMaterial(colorKey, options = {}) {
        const color = this.colors[colorKey] || colorKey;
        const textureType = this.genome.textureType || 'smooth';
        // Generate and cache chitin textures if not already created
        if (!this.chitinTextures && !options.skipTexture) {
            const chitinGen = new ChitinTextureGenerator(512);
            this.chitinTextures = chitinGen.generate(
                textureType,
                this.colors.primary,
                this.colors.dark,
                Math.random() * 10000
            );
        }

        // Normal intensity varies by texture type
        let normalIntensity;
        switch (textureType) {
            case 'smooth':
                normalIntensity = 0.4;
                break;
            case 'plated':
                normalIntensity = 0.7;
                break;
            case 'rough':
                normalIntensity = 0.8;
                break;
            case 'spotted':
                normalIntensity = 0.5;
                break;
            case 'striped':
                normalIntensity = 0.4;
                break;
            default:
                normalIntensity = 0.5;
        }

        const materialOptions = {
            metalness: options.metalness || 0.15,
            transparent: options.transparent || false,
            opacity: options.opacity || 1,
            side: options.side || THREE.FrontSide,
        };

        // Add emissive properties if specified
        if (options.emissive !== undefined) {
            materialOptions.emissive = options.emissive;
            materialOptions.emissiveIntensity = options.emissiveIntensity || 0.2;
        }

        // Use chitin textures for realistic appearance
        if (!options.skipTexture && this.chitinTextures) {
            if (colorKey === 'primary') {
                // Use chitin diffuse map for primary color parts
                materialOptions.map = this.chitinTextures.diffuse;
                materialOptions.color = '#ffffff'; // Let texture color show through
            } else {
                // For non-primary parts, tint with color but still use texture detail
                materialOptions.color = color;
            }

            // Always use chitin normal and roughness maps
            materialOptions.normalMap = this.chitinTextures.normal;
            materialOptions.normalScale = new THREE.Vector2(normalIntensity, normalIntensity);
            materialOptions.roughnessMap = this.chitinTextures.roughness;
            materialOptions.roughness = options.roughness || 1.0; // Roughness map will modulate this
        } else {
            // Fallback for parts without texture
            materialOptions.color = color;
            materialOptions.roughness = options.roughness || 0.5;
        }

        return new THREE.MeshStandardMaterial(materialOptions);
    }

    /**
     * Generate the complete bug mesh group
     */
    generate() {
        const g = this.genome;
        const scale = this.sizeMultiplier;

        // Body proportions based on genome
        const bulkFactor = 0.8 + (g.bulk / 100) * 0.6;
        const speedFactor = 0.8 + (g.speed / 100) * 0.4;

        // Create main group
        const bugGroup = new THREE.Group();
        bugGroup.userData.genome = g;
        bugGroup.userData.colors = this.colors;

        // Generate body parts
        const abdomen = this.createAbdomen(bulkFactor, scale);
        const thorax = this.createThorax(bulkFactor, speedFactor, scale);
        const head = this.createHead(speedFactor, scale);
        const legs = this.createLegs(g.legStyle, scale);
        const antennae = this.createAntennae(scale);
        const weapon = this.createWeapon(g.weapon, scale);

        // Adjust abdomen position for longer thorax types
        const thoraxType = g.thoraxType || 'compact';
        if (thoraxType === 'elongated') {
            abdomen.position.z -= 2 * scale;
        } else if (thoraxType === 'segmented') {
            abdomen.position.z -= 1.5 * scale;
        }

        bugGroup.add(abdomen);
        bugGroup.add(thorax);
        bugGroup.add(head);
        bugGroup.add(legs);
        bugGroup.add(antennae);

        // Fangs attach to head so they move with it
        if (weapon) {
            if (g.weapon === 'fangs') {
                head.add(weapon);  // Fangs are child of head
            } else {
                bugGroup.add(weapon);
            }
        }

        if (g.mobility === 'winged') {
            const wings = this.createWings(scale);
            bugGroup.add(wings);
            bugGroup.userData.wings = wings;
        }

        // Store references for animation
        bugGroup.userData.abdomen = abdomen;
        bugGroup.userData.thorax = thorax;
        bugGroup.userData.head = head;
        bugGroup.userData.legs = legs;
        bugGroup.userData.antennae = antennae;
        bugGroup.userData.weapon = weapon;
        bugGroup.userData.weaponType = g.weapon || 'mandibles';

        // Store base positions for attack animations
        if (head) head.userData.baseZ = head.position.z;
        if (head) head.userData.baseRotX = head.rotation.x;
        if (thorax) thorax.userData.baseZ = thorax.position.z;

        return bugGroup;
    }

    createAbdomen(bulkFactor, scale) {
        const group = new THREE.Group();
        group.name = 'abdomen';
        const defense = this.genome.defense || 'none';
        const abdomenType = this.genome.abdomenType || 'round';

        // Choose material based on defense
        let abdomenMat;
        if (defense === 'toxic') {
            abdomenMat = this.createMaterial('primary', {
                roughness: 0.4,
                metalness: 0.2,
                emissive: 0x003300,
                emissiveIntensity: 0.2,
            });
        } else if (defense === 'shell') {
            abdomenMat = this.createMaterial('primary', {
                roughness: 0.3,
                metalness: 0.5,
            });
        } else {
            abdomenMat = this.createMaterial('primary');
        }

        // Base dimensions
        let rx = 4 * bulkFactor * scale;
        let ry = 3 * bulkFactor * scale;
        let rz = 5 * bulkFactor * scale;

        // Agility defense = slimmer body
        if (defense === 'agility') {
            rx *= 0.8;
            ry *= 0.85;
        }

        switch (abdomenType) {
            case 'round':
            default:
                // Round abdomen - spherical
                const roundGeo = new THREE.SphereGeometry(1, 16, 12);
                roundGeo.scale(rx, ry, rx); // Equal x and z for round shape
                this.finalizeBodyGeometry(roundGeo);
                const roundMesh = new THREE.Mesh(roundGeo, abdomenMat);
                roundMesh.position.set(0, 0, -4 * scale);
                roundMesh.castShadow = true;
                group.add(roundMesh);
                break;

            case 'oval':
                // Oval abdomen - elongated ellipsoid
                const ovalGeo = new THREE.SphereGeometry(1, 16, 12);
                ovalGeo.scale(rx * 0.85, ry * 0.9, rz * 1.2); // Longer, narrower
                this.finalizeBodyGeometry(ovalGeo);
                const ovalMesh = new THREE.Mesh(ovalGeo, abdomenMat);
                ovalMesh.position.set(0, 0, -5 * scale);
                ovalMesh.castShadow = true;
                group.add(ovalMesh);
                break;

            case 'pointed':
                // Pointed abdomen - tapers to a point at the back (wasp-like)
                const pointedGroup = new THREE.Group();

                // Front bulb - just big enough to cover cone base
                const coneRadius = rx * 0.65;
                const coneHeight = rz * 1.4;
                const sphereZ = -2.5 * scale;

                const frontBulbGeo = new THREE.SphereGeometry(coneRadius * 1.1, 12, 10);
                frontBulbGeo.scale(1, 0.9, 0.8);
                this.finalizeBodyGeometry(frontBulbGeo);
                const frontBulb = new THREE.Mesh(frontBulbGeo, abdomenMat);
                frontBulb.position.set(0, 0, sphereZ);
                pointedGroup.add(frontBulb);

                // Tapered section - base aligned with sphere's widest point
                const taperGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 12);
                const taper = new THREE.Mesh(taperGeo, abdomenMat);
                taper.rotation.x = -Math.PI / 2;
                // Cone center is at position, base is at position + height/2, so position cone so base aligns with sphere center
                taper.position.set(0, 0, sphereZ - coneHeight / 2);
                taper.castShadow = true;
                pointedGroup.add(taper);

                group.add(pointedGroup);
                break;

            case 'bulbous': {
                // Bulbous abdomen - extra wide and round (beetle-like)
                const bulbousGeo = new THREE.SphereGeometry(1, 16, 12);
                bulbousGeo.scale(rx * 1.3, ry * 1.1, rz * 0.9); // Wide and rotund
                this.finalizeBodyGeometry(bulbousGeo);
                const bulbousMesh = new THREE.Mesh(bulbousGeo, abdomenMat);
                bulbousMesh.position.set(0, -0.3 * scale, -4 * scale);
                bulbousMesh.castShadow = true;
                group.add(bulbousMesh);

                // Add a slight ridge on top
                const bulbousRidgeGeo = new THREE.CapsuleGeometry(rx * 0.3, rz * 0.6, 4, 8);
                const bulbousRidge = new THREE.Mesh(bulbousRidgeGeo, this.createMaterial('dark'));
                bulbousRidge.rotation.x = Math.PI / 2;
                bulbousRidge.position.set(0, ry * 0.8, -4 * scale);
                group.add(bulbousRidge);
                break;
            }

            case 'segmented':
                // Segmented abdomen - multiple connected segments (caterpillar/ant-like)
                const numSegments = 4;
                const segmentSpacing = rz * 0.55;

                for (let i = 0; i < numSegments; i++) {
                    const segSize = 1 - i * 0.12; // Each segment slightly smaller
                    const segGeo = new THREE.SphereGeometry(rx * 0.7 * segSize, 10, 8);
                    segGeo.scale(1, 0.85, 0.9);
                    this.finalizeBodyGeometry(segGeo);
                    const segment = new THREE.Mesh(segGeo, abdomenMat);
                    segment.position.set(0, -i * 0.15 * scale, -2 * scale - i * segmentSpacing);
                    segment.castShadow = true;
                    group.add(segment);

                    // Add segment divider rings
                    if (i < numSegments - 1) {
                        const ringGeo = new THREE.TorusGeometry(rx * 0.5 * segSize, 0.15 * scale, 6, 12);
                        const ring = new THREE.Mesh(ringGeo, this.createMaterial('dark'));
                        ring.rotation.y = Math.PI / 2;
                        ring.position.set(0, -i * 0.15 * scale, -2.3 * scale - i * segmentSpacing);
                        group.add(ring);
                    }
                }
                break;

            case 'sac':
                // Sac abdomen - spider-like translucent sac
                const sacMat = this.createMaterial('primary', {
                    roughness: 0.3,
                    metalness: 0.1,
                    transparent: true,
                    opacity: 0.85,
                });

                // Main sac body
                const sacGeo = new THREE.SphereGeometry(1, 16, 12);
                sacGeo.scale(rx * 1.1, ry * 1.2, rz * 1.1);
                this.finalizeBodyGeometry(sacGeo);
                const sacMesh = new THREE.Mesh(sacGeo, sacMat);
                sacMesh.position.set(0, 0.2 * scale, -4.5 * scale);
                sacMesh.castShadow = true;
                group.add(sacMesh);

                // Internal structure showing through
                const internalMat = new THREE.MeshStandardMaterial({
                    color: this.darken(this.colors.primary, 0.4),
                    roughness: 0.6,
                });
                const internalGeo = new THREE.SphereGeometry(1, 10, 8);
                internalGeo.scale(rx * 0.7, ry * 0.8, rz * 0.7);
                this.finalizeBodyGeometry(internalGeo);
                const internal = new THREE.Mesh(internalGeo, internalMat);
                internal.position.set(0, 0.1 * scale, -4.3 * scale);
                group.add(internal);

                // Silk spinnerets at rear
                for (let i = 0; i < 3; i++) {
                    const spinGeo = new THREE.ConeGeometry(0.2 * scale, 0.8 * scale, 6);
                    const spin = new THREE.Mesh(spinGeo, this.createMaterial('dark'));
                    spin.rotation.x = Math.PI * 0.7;
                    spin.position.set((i - 1) * 0.5 * scale, -0.3 * scale, -7 * scale);
                    group.add(spin);
                }
                break;

            case 'plated': {
                // Plated abdomen - pillbug/armadillo-like overlapping dome plates
                const numPlates = 5;

                for (let i = 0; i < numPlates; i++) {
                    const t = i / (numPlates - 1); // 0 to 1
                    // Size tapers toward the back
                    const plateScale = 1 - t * 0.35;

                    // Each plate is a flattened sphere (squashed to be wide and flat)
                    const plateGeo = new THREE.SphereGeometry(1, 12, 10);
                    plateGeo.scale(rx * plateScale, ry * 0.35 * plateScale, rz * 0.3);
                    this.finalizeBodyGeometry(plateGeo);

                    const plate = new THREE.Mesh(plateGeo, abdomenMat);
                    // Position each plate, overlapping slightly
                    const zPos = -2.5 * scale - i * rz * 0.28;
                    plate.position.set(0, 0.2 * scale, zPos);
                    plate.castShadow = true;
                    group.add(plate);
                }
                break;
            }

            case 'tailed': {
                // Tailed abdomen - with prominent tail section (wasp/scorpion style)
                // Main body
                const stingerBodyGeo = new THREE.SphereGeometry(1, 14, 10);
                stingerBodyGeo.scale(rx * 0.9, ry * 0.85, rz * 0.8);
                this.finalizeBodyGeometry(stingerBodyGeo);
                const stingerBody = new THREE.Mesh(stingerBodyGeo, abdomenMat);
                stingerBody.position.set(0, 0, -3.5 * scale);
                stingerBody.castShadow = true;
                group.add(stingerBody);

                // Narrow tail section
                const tailGeo = new THREE.CylinderGeometry(rx * 0.35, rx * 0.5, rz * 0.8, 10);
                tailGeo.rotateX(Math.PI / 2);
                this.finalizeBodyGeometry(tailGeo);
                const tail = new THREE.Mesh(tailGeo, abdomenMat);
                tail.position.set(0, -0.3 * scale, -6 * scale);
                group.add(tail);

                // Tail bulb
                const bulbGeo = new THREE.SphereGeometry(rx * 0.45, 10, 8);
                this.finalizeBodyGeometry(bulbGeo);
                const bulb = new THREE.Mesh(bulbGeo, abdomenMat);
                bulb.position.set(0, -0.4 * scale, -7.5 * scale);
                group.add(bulb);

                // Tail spike
                const tailSpikeMat = this.createMaterial('dark');
                const tailSpikeGeo = new THREE.ConeGeometry(0.25 * scale, 2 * scale, 6);
                const tailSpike = new THREE.Mesh(tailSpikeGeo, tailSpikeMat);
                tailSpike.rotation.x = Math.PI * 0.6;
                tailSpike.position.set(0, -0.8 * scale, -8.5 * scale);
                group.add(tailSpike);

                // Side barbs
                for (const side of [-1, 1]) {
                    const barbGeo = new THREE.ConeGeometry(0.12 * scale, 0.6 * scale, 4);
                    const barb = new THREE.Mesh(barbGeo, tailSpikeMat);
                    barb.position.set(side * 0.3 * scale, -0.6 * scale, -8 * scale);
                    barb.rotation.z = side * 0.5;
                    barb.rotation.x = 0.3;
                    group.add(barb);
                }
                break;
            }
        }

        // Shell defense - add armored plates
        if (defense === 'shell') {
            const plateMat = new THREE.MeshStandardMaterial({
                color: this.darken(this.colors.primary, 0.2),
                roughness: 0.2,
                metalness: 0.6,
            });

            for (let i = 0; i < 3; i++) {
                const plateGeo = new THREE.BoxGeometry(rx * 1.4, 0.25 * scale, rz * 0.35);
                const plate = new THREE.Mesh(plateGeo, plateMat);
                plate.position.set(0, ry * 0.6 - i * 0.3 * scale, -3 * scale - i * 1.0 * scale);
                plate.rotation.x = 0.1;
                group.add(plate);
            }
        }

        // Toxic defense - add warning patterns/pustules
        if (defense === 'toxic') {
            const toxicMat = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
                emissive: 0x00ff00,
                emissiveIntensity: 0.5,
                roughness: 0.4,
            });

            for (let i = 0; i < 5; i++) {
                const pustuleGeo = new THREE.SphereGeometry(0.25 * scale, 6, 4);
                const pustule = new THREE.Mesh(pustuleGeo, toxicMat);
                const angle = (i / 5) * Math.PI * 2;
                pustule.position.set(
                    Math.cos(angle) * rx * 0.6,
                    Math.sin(angle) * ry * 0.4,
                    -4.5 * scale
                );
                group.add(pustule);
            }
        }

        return group;
    }

    createThorax(bulkFactor, speedFactor, scale) {
        const group = new THREE.Group();
        group.name = 'thorax';
        const defense = this.genome.defense || 'none';
        const thoraxType = this.genome.thoraxType || 'compact';

        // Choose material based on defense
        let thoraxMat;
        if (defense === 'toxic') {
            thoraxMat = this.createMaterial('primary', {
                roughness: 0.4,
                metalness: 0.2,
                emissive: 0x003300,
                emissiveIntensity: 0.2,
            });
        } else if (defense === 'shell') {
            thoraxMat = this.createMaterial('primary', {
                roughness: 0.3,
                metalness: 0.5,
            });
        } else {
            thoraxMat = this.createMaterial('primary');
        }

        // Base dimensions
        let rx = 3 * bulkFactor * scale;
        let ry = 2.5 * bulkFactor * scale;
        let rz = 2.5 * scale;

        // Agility defense = slimmer body
        if (defense === 'agility') {
            rx *= 0.85;
            ry *= 0.9;
        }

        switch (thoraxType) {
            case 'compact':
            default:
                // Compact thorax - tight, muscular, slightly boxy
                const compactGeo = new THREE.SphereGeometry(1, 16, 12);
                compactGeo.scale(rx * 0.9, ry, rz * 0.85);
                this.finalizeBodyGeometry(compactGeo);
                const compactMesh = new THREE.Mesh(compactGeo, thoraxMat);
                compactMesh.position.set(0, 0.5 * scale, 0);
                compactMesh.castShadow = true;
                group.add(compactMesh);
                break;

            case 'elongated': {
                // Elongated thorax - stretched lengthwise (ant/wasp-like)
                const elongThoraxGeo = new THREE.SphereGeometry(1, 16, 12);
                elongThoraxGeo.scale(rx * 0.75, ry * 0.85, rz * 1.4); // Longer, narrower
                this.finalizeBodyGeometry(elongThoraxGeo);
                const elongThoraxMesh = new THREE.Mesh(elongThoraxGeo, thoraxMat);
                elongThoraxMesh.position.set(0, 0.5 * scale, 0.5 * scale);
                elongThoraxMesh.castShadow = true;
                group.add(elongThoraxMesh);

                // Add segment lines for elongated look
                for (let i = 0; i < 2; i++) {
                    const lineGeo = new THREE.TorusGeometry(rx * 0.65, 0.1 * scale, 6, 12);
                    const line = new THREE.Mesh(lineGeo, this.createMaterial('dark'));
                    line.rotation.y = Math.PI / 2;
                    line.position.set(0, 0.5 * scale, -0.5 * scale + i * 1.2 * scale);
                    group.add(line);
                }
                break;
            }

            case 'wide':
                // Wide thorax - broad and flat (beetle-like)
                const wideGeo = new THREE.SphereGeometry(1, 16, 12);
                wideGeo.scale(rx * 1.4, ry * 0.75, rz * 0.9);
                this.finalizeBodyGeometry(wideGeo);
                const wideMesh = new THREE.Mesh(wideGeo, thoraxMat);
                wideMesh.position.set(0, 0.3 * scale, 0);
                wideMesh.castShadow = true;
                group.add(wideMesh);
                break;

            case 'humped': {
                // Humped thorax - prominent raised hump on top (camel cricket-like)
                // Base thorax
                const humpBaseGeo = new THREE.SphereGeometry(1, 16, 12);
                humpBaseGeo.scale(rx * 0.95, ry * 0.8, rz);
                this.finalizeBodyGeometry(humpBaseGeo);
                const humpBaseMesh = new THREE.Mesh(humpBaseGeo, thoraxMat);
                humpBaseMesh.position.set(0, 0.3 * scale, 0);
                humpBaseMesh.castShadow = true;
                group.add(humpBaseMesh);

                // Hump positioned forward to avoid stinger overlap
                const humpGeo = new THREE.SphereGeometry(rx * 0.6, 12, 10);
                humpGeo.scale(1, 1.2, 1.0);
                this.finalizeBodyGeometry(humpGeo);
                const hump = new THREE.Mesh(humpGeo, thoraxMat);
                hump.position.set(0, ry * 0.85, 0.4 * scale);
                hump.castShadow = true;
                group.add(hump);

                // Ridge along the hump
                const humpRidgeGeo = new THREE.CapsuleGeometry(0.18 * scale, rx * 0.7, 4, 8);
                const humpRidge = new THREE.Mesh(humpRidgeGeo, this.createMaterial('dark'));
                humpRidge.rotation.z = Math.PI / 2;
                humpRidge.position.set(0, ry * 1.15, 0.4 * scale);
                group.add(humpRidge);
                break;
            }

            case 'segmented':
                // Segmented thorax - multiple distinct segments (caterpillar-like)
                const segCount = 4;
                const segWidth = rx * 0.85;
                const segGap = rz * 0.55;
                for (let i = 0; i < segCount; i++) {
                    const segGeo = new THREE.SphereGeometry(1, 12, 10);
                    const segScale = 1 - (i * 0.08); // Slightly smaller toward rear
                    segGeo.scale(segWidth * segScale, ry * 0.7 * segScale, rz * 0.5);
                    this.finalizeBodyGeometry(segGeo);
                    const segMesh = new THREE.Mesh(segGeo, thoraxMat);
                    segMesh.position.set(0, 0.3 * scale, -segGap * 1.5 + i * segGap);
                    segMesh.castShadow = true;
                    group.add(segMesh);

                    // Connection between segments
                    if (i < segCount - 1) {
                        const connGeo = new THREE.CylinderGeometry(rx * 0.3 * segScale, rx * 0.35 * segScale, segGap * 0.3, 8);
                        connGeo.rotateX(Math.PI / 2);
                        const conn = new THREE.Mesh(connGeo, this.createMaterial('dark'));
                        conn.position.set(0, 0.2 * scale, -segGap * 1.2 + i * segGap);
                        group.add(conn);
                    }
                }
                break;

        }

        return group;
    }

    createHead(speedFactor, scale) {
        const group = new THREE.Group();
        group.name = 'head';
        const eyeStyle = this.genome.eyeStyle || 'compound';
        const headType = this.genome.headType || 'round';

        const headMat = this.createMaterial('primary');

        // Create head based on type
        let headBaseZ = 4 * scale;
        let eyeOffsetZ = 1.2 * scale; // How far forward eyes are from head center
        let eyeOffsetY = 0.5 * scale;

        switch (headType) {
            case 'round':
            default: {
                // Round head - simple globular shape
                const rndMainGeo = new THREE.SphereGeometry(1, 14, 12);
                rndMainGeo.scale(2.5 * scale, 2.3 * scale, 2.4 * scale);
                this.finalizeBodyGeometry(rndMainGeo);
                const rndMain = new THREE.Mesh(rndMainGeo, headMat);
                rndMain.position.set(0, 1 * scale, headBaseZ);
                rndMain.castShadow = true;
                group.add(rndMain);

                eyeOffsetZ = 1.5 * scale;
                eyeOffsetY = 0.3 * scale;
                break;
            }

            case 'triangular': {
                // Triangular head - mantis-like, triangular from FRONT view
                // Wide at top (eye level), tapers to narrow chin

                // Main cranium - wide upper portion
                const triCraniumGeo = new THREE.SphereGeometry(1, 14, 10);
                triCraniumGeo.scale(2.8 * scale, 1.6 * scale, 2.2 * scale);
                this.finalizeBodyGeometry(triCraniumGeo);
                const triCranium = new THREE.Mesh(triCraniumGeo, headMat);
                triCranium.position.set(0, 1.8 * scale, headBaseZ);
                triCranium.castShadow = true;
                group.add(triCranium);

                // Tapered lower face/chin - narrower, creates the triangle point
                const triChinGeo = new THREE.SphereGeometry(1, 10, 8);
                triChinGeo.scale(1.0 * scale, 1.4 * scale, 1.8 * scale);
                this.finalizeBodyGeometry(triChinGeo);
                const triChin = new THREE.Mesh(triChinGeo, headMat);
                triChin.position.set(0, 0.2 * scale, headBaseZ + 0.8 * scale);
                group.add(triChin);

                eyeOffsetZ = 1.0 * scale;
                eyeOffsetY = 1.2 * scale;
                break;
            }

            case 'square': {
                // Square head - organic beetle-like, broad and blocky but with curves
                // Main head mass - wide, flattened sphere
                const sqMainGeo = new THREE.SphereGeometry(1, 14, 10);
                sqMainGeo.scale(2.6 * scale, 1.8 * scale, 2.2 * scale);
                this.finalizeBodyGeometry(sqMainGeo);
                const sqMain = new THREE.Mesh(sqMainGeo, headMat);
                sqMain.position.set(0, 1 * scale, headBaseZ);
                sqMain.castShadow = true;
                group.add(sqMain);

                // Side bulges - give the "square corners" feel organically
                for (const side of [-1, 1]) {
                    const sideBulgeGeo = new THREE.SphereGeometry(1, 10, 8);
                    sideBulgeGeo.scale(1.2 * scale, 1.4 * scale, 1.8 * scale);
                    this.finalizeBodyGeometry(sideBulgeGeo);
                    const sideBulge = new THREE.Mesh(sideBulgeGeo, headMat);
                    sideBulge.position.set(side * 1.8 * scale, 0.8 * scale, headBaseZ + 0.3 * scale);
                    group.add(sideBulge);
                }

                // Brow ridge - emphasizes the squarish top
                const browGeo = new THREE.CapsuleGeometry(0.5 * scale, 3.5 * scale, 6, 8);
                const brow = new THREE.Mesh(browGeo, headMat);
                brow.rotation.z = Math.PI / 2;
                brow.position.set(0, 2.2 * scale, headBaseZ + 0.8 * scale);
                group.add(brow);

                // Front plate - flat face area
                const frontGeo = new THREE.SphereGeometry(1, 10, 8);
                frontGeo.scale(1.8 * scale, 1.2 * scale, 0.8 * scale);
                const front = new THREE.Mesh(frontGeo, headMat);
                front.position.set(0, 0.6 * scale, headBaseZ + 1.8 * scale);
                group.add(front);

                // Chin/mandible area
                const chinGeo = new THREE.SphereGeometry(0.8 * scale, 8, 6);
                chinGeo.scale(1.5, 0.8, 1.2);
                const chin = new THREE.Mesh(chinGeo, headMat);
                chin.position.set(0, -0.3 * scale, headBaseZ + 1.2 * scale);
                group.add(chin);

                eyeOffsetZ = 1.0 * scale;
                eyeOffsetY = 0.6 * scale;
                break;
            }

            case 'elongated': {
                // Elongated head - stretched forward (ant-like)
                const elongHeadGeo = new THREE.SphereGeometry(1, 16, 12);
                elongHeadGeo.scale(2 * scale, 1.8 * scale, 3.5 * scale);
                this.finalizeBodyGeometry(elongHeadGeo);
                const elongHeadMesh = new THREE.Mesh(elongHeadGeo, headMat);
                elongHeadMesh.position.set(0, 1 * scale, headBaseZ + 1 * scale);
                elongHeadMesh.castShadow = true;
                group.add(elongHeadMesh);

                headBaseZ += 1.5 * scale;
                eyeOffsetZ = 1.8 * scale;
                eyeOffsetY = 0.6 * scale;
                break;
            }

            case 'shield': {
                // Shield head - broad, flat, protective (shield bug-like) with organic curves
                // Main carapace - wide, flattened dome
                const shMainGeo = new THREE.SphereGeometry(1, 16, 12);
                shMainGeo.scale(3.2 * scale, 1.2 * scale, 2.5 * scale);
                this.finalizeBodyGeometry(shMainGeo);
                const shMain = new THREE.Mesh(shMainGeo, headMat);
                shMain.position.set(0, 1.5 * scale, headBaseZ);
                shMain.castShadow = true;
                group.add(shMain);

                // Side shoulder plates - protective extensions
                for (const side of [-1, 1]) {
                    const shoulderGeo = new THREE.SphereGeometry(1, 10, 8);
                    shoulderGeo.scale(1.4 * scale, 0.9 * scale, 1.6 * scale);
                    this.finalizeBodyGeometry(shoulderGeo);
                    const shoulder = new THREE.Mesh(shoulderGeo, headMat);
                    shoulder.position.set(side * 2.4 * scale, 1.3 * scale, headBaseZ - 0.5 * scale);
                    shoulder.rotation.z = side * 0.3;
                    group.add(shoulder);
                }

                // Front face section - slightly projecting
                const frontFaceGeo = new THREE.SphereGeometry(1, 12, 10);
                frontFaceGeo.scale(2 * scale, 1 * scale, 1.2 * scale);
                const frontFace = new THREE.Mesh(frontFaceGeo, headMat);
                frontFace.position.set(0, 1 * scale, headBaseZ + 1.8 * scale);
                group.add(frontFace);

                // Under-head area - chin region
                const underGeo = new THREE.SphereGeometry(1, 10, 8);
                underGeo.scale(1.8 * scale, 0.7 * scale, 1.5 * scale);
                const under = new THREE.Mesh(underGeo, headMat);
                under.position.set(0, 0.3 * scale, headBaseZ + 0.8 * scale);
                group.add(under);

                // Central ridge
                const shieldRidgeGeo = new THREE.CapsuleGeometry(0.25 * scale, 2.5 * scale, 4, 8);
                const shieldRidge = new THREE.Mesh(shieldRidgeGeo, this.createMaterial('dark'));
                shieldRidge.position.set(0, 2.2 * scale, headBaseZ + 0.2 * scale);
                shieldRidge.rotation.x = Math.PI / 2;
                group.add(shieldRidge);

                // Small bumps on carapace for texture
                for (const side of [-1, 1]) {
                    const bumpGeo = new THREE.SphereGeometry(0.4 * scale, 6, 4);
                    const bump = new THREE.Mesh(bumpGeo, headMat);
                    bump.position.set(side * 1.5 * scale, 2.3 * scale, headBaseZ - 0.3 * scale);
                    group.add(bump);
                }

                eyeOffsetZ = 1.5 * scale;
                eyeOffsetY = 0.2 * scale;
                break;
            }
        }

        // Eye material - menacing red with glow
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.4,
            roughness: 0.3,
            metalness: 0.2,
        });

        // Eye shine material (no texture)
        const shineMat = this.createMaterial('white', { skipTexture: true });

        // Eye positions adjusted based on head type
        const eyeBaseZ = headBaseZ + eyeOffsetZ;
        const eyeBaseY = 1 * scale + eyeOffsetY;
        const eyeSpread = headType === 'triangular' ? 1.5 : (headType === 'shield' ? 2.0 : 1.8);

        // Create eyes based on style
        switch (eyeStyle) {
            case 'compound':
            default:
                // Compound eyes - bulging outward
                const compoundSize = headType === 'triangular' ? 0.8 * scale : 1.0 * scale;
                const compoundGeo = new THREE.SphereGeometry(compoundSize, 12, 8);

                const leftCompound = new THREE.Mesh(compoundGeo, eyeMat);
                leftCompound.position.set(-eyeSpread * scale, eyeBaseY + 0.5 * scale, eyeBaseZ);
                leftCompound.scale.set(1, 1.2, 0.8);
                leftCompound.userData.isEye = true;
                group.add(leftCompound);

                const rightCompound = new THREE.Mesh(compoundGeo.clone(), eyeMat);
                rightCompound.position.set(eyeSpread * scale, eyeBaseY + 0.5 * scale, eyeBaseZ);
                rightCompound.scale.set(1, 1.2, 0.8);
                rightCompound.userData.isEye = true;
                group.add(rightCompound);

                // Eye shine
                const shineGeo = new THREE.SphereGeometry(0.2 * scale, 8, 6);
                const leftShine = new THREE.Mesh(shineGeo, shineMat);
                leftShine.position.set((-eyeSpread + 0.3) * scale, eyeBaseY + 1 * scale, eyeBaseZ + 0.6 * scale);
                group.add(leftShine);

                const rightShine = new THREE.Mesh(shineGeo.clone(), shineMat);
                rightShine.position.set((eyeSpread + 0.3) * scale, eyeBaseY + 1 * scale, eyeBaseZ + 0.6 * scale);
                group.add(rightShine);
                break;

            case 'simple':
                // Small, beady eyes - just one pair
                const simpleSize = 0.6 * scale;
                const simpleGeo = new THREE.SphereGeometry(simpleSize, 8, 6);

                for (const side of [-1, 1]) {
                    const simpleEye = new THREE.Mesh(simpleGeo, eyeMat);
                    simpleEye.position.set(side * eyeSpread * 0.8 * scale, eyeBaseY + 0.3 * scale, eyeBaseZ + 0.3 * scale);
                    simpleEye.userData.isEye = true;
                    group.add(simpleEye);
                }
                break;

            case 'stalked':
                // Eyes on stalks - angular, insectoid
                const stalkMat = this.createMaterial('primary');
                const eyeballSize = 0.55 * scale;
                const eyeballGeo = new THREE.SphereGeometry(eyeballSize, 10, 8);
                eyeballGeo.scale(1.2, 0.8, 1.0);  // Flattened, less round

                for (const side of [-1, 1]) {
                    // Eye stalk - thinner, more segmented look
                    const stalkGeo = new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, 2.5 * scale, 6);
                    const stalk = new THREE.Mesh(stalkGeo, stalkMat);
                    stalk.position.set(side * eyeSpread * 0.6 * scale, eyeBaseY + 1.8 * scale, headBaseZ);
                    stalk.rotation.x = 0.4;
                    stalk.rotation.z = side * -0.5;
                    group.add(stalk);

                    // Eyeball at end of stalk - smaller, flattened
                    const eyeball = new THREE.Mesh(eyeballGeo, eyeMat);
                    eyeball.position.set(side * eyeSpread * 0.95 * scale, eyeBaseY + 2.9 * scale, headBaseZ + 1.2 * scale);
                    eyeball.userData.isEye = true;
                    group.add(eyeball);

                    // Vertical slit pupil - reptilian/menacing
                    const slitGeo = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.5 * scale, 6);
                    const slitMat = this.createMaterial('black', { skipTexture: true });
                    const slit = new THREE.Mesh(slitGeo, slitMat);
                    slit.position.set(side * eyeSpread * 0.95 * scale, eyeBaseY + 2.9 * scale, headBaseZ + 1.7 * scale);
                    slit.rotation.x = Math.PI / 2;  // Point forward
                    slit.rotation.z = Math.PI / 2;  // Vertical slit
                    group.add(slit);
                }
                break;

            case 'multiple':
                // Many small eyes in a cluster (jumping spider pattern)
                const multiGeo = new THREE.SphereGeometry(0.6 * scale, 8, 6);
                const smallMultiGeo = new THREE.SphereGeometry(0.35 * scale, 6, 4);
                const tinyMultiGeo = new THREE.SphereGeometry(0.2 * scale, 5, 4);

                // Large front-facing pair
                for (const side of [-1, 1]) {
                    const bigEye = new THREE.Mesh(multiGeo, eyeMat);
                    bigEye.position.set(side * 0.8 * scale, eyeBaseY + 0.5 * scale, eyeBaseZ + 0.5 * scale);
                    bigEye.userData.isEye = true;
                    group.add(bigEye);

                    // Medium side eyes
                    const medEye = new THREE.Mesh(smallMultiGeo, eyeMat);
                    medEye.position.set(side * eyeSpread * scale, eyeBaseY + 0.3 * scale, eyeBaseZ);
                    medEye.userData.isEye = true;
                    group.add(medEye);

                    // Small upper eyes
                    const smallEye1 = new THREE.Mesh(tinyMultiGeo, eyeMat);
                    smallEye1.position.set(side * 0.5 * scale, eyeBaseY + 1 * scale, eyeBaseZ + 0.2 * scale);
                    smallEye1.userData.isEye = true;
                    group.add(smallEye1);

                    // Tiny rear eyes
                    const tinyEye = new THREE.Mesh(tinyMultiGeo.clone(), eyeMat);
                    tinyEye.position.set(side * eyeSpread * 0.8 * scale, eyeBaseY + 0.6 * scale, eyeBaseZ - 0.5 * scale);
                    tinyEye.userData.isEye = true;
                    group.add(tinyEye);
                }
                break;

            case 'sunken': {
                // Deep-set eyes in socket recesses
                const socketMat = this.createMaterial('dark');

                for (const side of [-1, 1]) {
                    // Eye socket (dark recess)
                    const socketGeo = new THREE.SphereGeometry(0.9 * scale, 10, 8);
                    socketGeo.scale(1, 1.1, 0.6);
                    const socket = new THREE.Mesh(socketGeo, socketMat);
                    socket.position.set(side * eyeSpread * 0.9 * scale, eyeBaseY + 0.3 * scale, eyeBaseZ - 0.2 * scale);
                    group.add(socket);

                    // Deep-set eye
                    const sunkenEyeGeo = new THREE.SphereGeometry(0.5 * scale, 8, 6);
                    const sunkenEye = new THREE.Mesh(sunkenEyeGeo, eyeMat);
                    sunkenEye.position.set(side * eyeSpread * 0.9 * scale, eyeBaseY + 0.3 * scale, eyeBaseZ);
                    sunkenEye.userData.isEye = true;
                    group.add(sunkenEye);

                    // Ridge above socket
                    const sunkenRidgeGeo = new THREE.CapsuleGeometry(0.15 * scale, 0.8 * scale, 4, 6);
                    const sunkenRidge = new THREE.Mesh(sunkenRidgeGeo, this.createMaterial('primary'));
                    sunkenRidge.position.set(side * eyeSpread * 0.9 * scale, eyeBaseY + 0.9 * scale, eyeBaseZ - 0.1 * scale);
                    sunkenRidge.rotation.z = Math.PI / 2;
                    group.add(sunkenRidge);
                }
                break;
            }

        }

        // Store head base position for animation
        group.userData.baseZ = headBaseZ;

        return group;
    }

    createLegs(legStyle, scale) {
        const group = new THREE.Group();
        group.name = 'legs';
        const style = legStyle || 'insect';

        // Leg configurations per style
        const legConfigs = this.getLegConfig(style, scale);

        legConfigs.attachments.forEach((attach, i) => {
            // Create right leg (positive X side)
            const rightLeg = this.createArticulatedLeg(style, attach, scale, 1, i, legConfigs);
            rightLeg.userData.phase = attach.phase;
            rightLeg.userData.side = 'right';
            rightLeg.userData.index = i;
            group.add(rightLeg);

            // Create left leg (negative X side, mirrored)
            const leftLeg = this.createArticulatedLeg(style, attach, scale, -1, i, legConfigs);
            leftLeg.userData.phase = attach.phase + 0.5; // Alternating gait
            leftLeg.userData.side = 'left';
            leftLeg.userData.index = i;
            group.add(leftLeg);
        });

        return group;
    }

    getLegConfig(style, scale) {
        const configs = {
            insect: {
                attachments: [
                    { x: 2.2, y: 0, z: 1.5, phase: 0 },
                    { x: 2.5, y: 0, z: 0, phase: 0.33 },
                    { x: 2.2, y: 0, z: -1.5, phase: 0.66 },
                ],
                segments: [
                    { length: 1.5, radiusTop: 0.35, radiusBot: 0.3, angle: -0.3 },  // Coxa
                    { length: 2.5, radiusTop: 0.3, radiusBot: 0.22, angle: 0.8 },   // Femur
                    { length: 3.0, radiusTop: 0.22, radiusBot: 0.12, angle: -1.2 }, // Tibia
                    { length: 1.2, radiusTop: 0.12, radiusBot: 0.06, angle: 0.4 },  // Tarsus
                ],
                jointBulge: 1.3,
            },
            spider: {
                attachments: [
                    { x: 2.0, y: 0.3, z: 1.8, phase: 0 },
                    { x: 2.3, y: 0.2, z: 0.6, phase: 0.25 },
                    { x: 2.3, y: 0.2, z: -0.6, phase: 0.5 },
                    { x: 2.0, y: 0.3, z: -1.8, phase: 0.75 },
                ],
                segments: [
                    { length: 1.0, radiusTop: 0.25, radiusBot: 0.2, angle: -0.2 },
                    { length: 3.5, radiusTop: 0.2, radiusBot: 0.12, angle: 1.2 },
                    { length: 4.0, radiusTop: 0.12, radiusBot: 0.08, angle: -1.8 },
                    { length: 2.0, radiusTop: 0.08, radiusBot: 0.04, angle: 0.3 },
                ],
                jointBulge: 1.2,
            },
            mantis: {
                attachments: [
                    { x: 2.0, y: 0.5, z: 2.5, phase: 0, raptorial: true },
                    { x: 2.3, y: 0, z: 0, phase: 0.33 },
                    { x: 2.2, y: 0, z: -1.5, phase: 0.66 },
                ],
                segments: [
                    { length: 1.8, radiusTop: 0.35, radiusBot: 0.28, angle: -0.4 },
                    { length: 3.0, radiusTop: 0.28, radiusBot: 0.2, angle: 0.6 },
                    { length: 3.5, radiusTop: 0.2, radiusBot: 0.1, angle: -1.0 },
                    { length: 1.0, radiusTop: 0.1, radiusBot: 0.05, angle: 0.3 },
                ],
                jointBulge: 1.25,
            },
            grasshopper: {
                attachments: [
                    { x: 2.0, y: 0, z: 1.5, phase: 0 },
                    { x: 2.2, y: 0, z: 0, phase: 0.33 },
                    { x: 2.0, y: 0.3, z: -1.8, phase: 0.66, jumping: true },
                ],
                segments: [
                    { length: 1.2, radiusTop: 0.3, radiusBot: 0.25, angle: -0.3 },
                    { length: 2.5, radiusTop: 0.25, radiusBot: 0.18, angle: 0.7 },
                    { length: 3.0, radiusTop: 0.18, radiusBot: 0.1, angle: -1.1 },
                    { length: 1.5, radiusTop: 0.1, radiusBot: 0.05, angle: 0.4 },
                ],
                jointBulge: 1.3,
            },
            beetle: {
                attachments: [
                    { x: 2.5, y: -0.2, z: 1.3, phase: 0 },
                    { x: 2.8, y: -0.2, z: 0, phase: 0.33 },
                    { x: 2.5, y: -0.2, z: -1.3, phase: 0.66 },
                ],
                segments: [
                    { length: 1.0, radiusTop: 0.45, radiusBot: 0.4, angle: -0.4 },
                    { length: 2.2, radiusTop: 0.4, radiusBot: 0.32, angle: 0.5 },
                    { length: 2.8, radiusTop: 0.32, radiusBot: 0.2, angle: -0.9 },
                    { length: 1.0, radiusTop: 0.2, radiusBot: 0.15, angle: 0.3 },
                ],
                jointBulge: 1.4,
            },
            stick: {
                attachments: [
                    { x: 1.8, y: 0.2, z: 1.5, phase: 0 },
                    { x: 2.0, y: 0.2, z: 0, phase: 0.33 },
                    { x: 1.8, y: 0.2, z: -1.5, phase: 0.66 },
                ],
                segments: [
                    { length: 2.0, radiusTop: 0.12, radiusBot: 0.1, angle: -0.2 },
                    { length: 4.0, radiusTop: 0.1, radiusBot: 0.08, angle: 0.9 },
                    { length: 4.5, radiusTop: 0.08, radiusBot: 0.05, angle: -1.3 },
                    { length: 2.5, radiusTop: 0.05, radiusBot: 0.03, angle: 0.5 },
                ],
                jointBulge: 1.15,
            },
            centipede: {
                attachments: [
                    { x: 2.0, y: -0.1, z: 1.5, phase: 0 },
                    { x: 2.0, y: -0.1, z: 0.5, phase: 0.2 },
                    { x: 2.0, y: -0.1, z: -0.5, phase: 0.4 },
                    { x: 2.0, y: -0.1, z: -1.5, phase: 0.6 },
                ],
                segments: [
                    { length: 0.8, radiusTop: 0.2, radiusBot: 0.18, angle: -0.4 },
                    { length: 1.8, radiusTop: 0.18, radiusBot: 0.12, angle: 0.5 },
                    { length: 2.0, radiusTop: 0.12, radiusBot: 0.08, angle: -0.8 },
                    { length: 0.8, radiusTop: 0.08, radiusBot: 0.04, angle: 0.3 },
                ],
                jointBulge: 1.2,
            },
        };

        return configs[style] || configs.insect;
    }

    createArticulatedLeg(style, attach, scale, side, legIndex, config) {
        // Root group positioned at attachment point
        const legRoot = new THREE.Group();
        legRoot.position.set(-side * attach.x * scale, attach.y * scale, attach.z * scale);

        const legMat = this.createChitinMaterial('dark');
        const jointMat = this.createChitinMaterial('primary', { roughness: 0.4 });

        // Build hierarchical leg segments
        let parentGroup = legRoot;
        let currentAngle = side * -0.7; // Base outward angle
        const segments = config.segments;
        const storedSegments = [];

        // Special handling for grasshopper jumping legs
        const isJumpingLeg = attach.jumping && legIndex === config.attachments.length - 1;
        const isRaptorialLeg = attach.raptorial && legIndex === 0;

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            let length = seg.length * scale;
            let rTop = seg.radiusTop * scale;
            let rBot = seg.radiusBot * scale;

            // Grasshopper: enlarged femur on back legs
            if (isJumpingLeg && i === 1) {
                length *= 1.4;
                rTop *= 1.8;
                rBot *= 1.3;
            }

            // Mantis: enlarged femur/tibia on front legs
            if (isRaptorialLeg && (i === 1 || i === 2)) {
                rTop *= 1.3;
                rBot *= 1.2;
            }

            // Joint pivot point
            const jointPivot = new THREE.Group();
            jointPivot.rotation.z = i === 0 ? currentAngle : 0;
            jointPivot.rotation.x = seg.angle;

            // Joint bulge (ball joint visual)
            if (i > 0) {
                const jointSize = rTop * config.jointBulge;
                const jointGeo = new THREE.SphereGeometry(jointSize, 8, 6);
                const joint = new THREE.Mesh(jointGeo, jointMat);
                joint.scale.set(1, 0.8, 1);
                jointPivot.add(joint);
            }

            // Segment geometry - offset so pivot is at top
            const segGeo = new THREE.CylinderGeometry(rTop, rBot, length, 8);
            segGeo.translate(0, -length / 2, 0);

            const segment = new THREE.Mesh(segGeo, legMat);
            segment.castShadow = true;
            jointPivot.add(segment);

            // Add spikes for bladed style
            if (config.bladed && i === 2) {
                this.addLegBlades(jointPivot, length, rTop, scale, side);
            }

            // Add armor plates for armored style
            if (config.armored && i < 3) {
                this.addLegArmor(jointPivot, length, rTop, scale);
            }

            // Add spines for mantis raptorial legs
            if (isRaptorialLeg && i === 2) {
                this.addRaptorialSpines(jointPivot, length, rTop, scale, side);
            }

            // Store segment data for animation
            storedSegments.push({
                pivot: jointPivot,
                mesh: segment,
                baseRotation: jointPivot.rotation.clone(),
                length: length,
            });

            parentGroup.add(jointPivot);

            // Create connection point for next segment
            const nextAttach = new THREE.Group();
            nextAttach.position.y = -length;
            jointPivot.add(nextAttach);
            parentGroup = nextAttach;
        }

        // Add foot/tarsus detail
        this.addFoot(parentGroup, segments[segments.length - 1].radiusBot * scale, scale, style);

        // Store for animation
        legRoot.userData.segments = storedSegments;
        legRoot.userData.style = style;

        return legRoot;
    }

    addLegBlades(pivot, length, radius, scale, side) {
        const bladeMat = this.createChitinMaterial('dark');

        for (let i = 0; i < 3; i++) {
            const bladeGeo = new THREE.ConeGeometry(radius * 0.3, length * 0.25, 4);
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            blade.position.set(side * radius * 0.8, -length * 0.25 - i * length * 0.25, 0);
            blade.rotation.z = side * Math.PI / 2;
            pivot.add(blade);
        }
    }

    addLegArmor(pivot, length, radius, scale) {
        const armorMat = new THREE.MeshStandardMaterial({
            color: this.colors.dark,
            roughness: 0.25,
            metalness: 0.5,
        });

        const plateGeo = new THREE.BoxGeometry(radius * 2.2, length * 0.3, radius * 1.5);
        for (let i = 0; i < 2; i++) {
            const plate = new THREE.Mesh(plateGeo, armorMat);
            plate.position.set(0, -length * 0.3 - i * length * 0.35, radius * 0.3);
            pivot.add(plate);
        }
    }

    addRaptorialSpines(pivot, length, radius, scale, side) {
        const spineMat = this.createChitinMaterial('dark');

        for (let i = 0; i < 5; i++) {
            const spineGeo = new THREE.ConeGeometry(radius * 0.2, length * 0.15, 5);
            const spine = new THREE.Mesh(spineGeo, spineMat);
            spine.position.set(side * radius * 0.6, -length * 0.15 - i * length * 0.17, radius * 0.3);
            spine.rotation.z = side * 0.5;
            pivot.add(spine);
        }
    }

    addFoot(parent, radius, scale, style) {
        const footMat = this.createChitinMaterial('dark');

        switch (style) {
            case 'spider':
                // Two curved claws
                for (const s of [-1, 1]) {
                    const clawGeo = new THREE.ConeGeometry(radius * 0.8, radius * 4, 6);
                    const claw = new THREE.Mesh(clawGeo, footMat);
                    claw.position.set(s * radius * 0.5, -radius * 2, 0);
                    claw.rotation.z = s * 0.3;
                    parent.add(claw);
                }
                break;

            case 'crab':
                // Pointed tip
                const tipGeo = new THREE.ConeGeometry(radius * 1.2, radius * 3, 6);
                const tip = new THREE.Mesh(tipGeo, footMat);
                tip.position.y = -radius * 1.5;
                parent.add(tip);
                break;

            case 'beetle':
            case 'armored':
                // Pad with small hooks
                const padGeo = new THREE.SphereGeometry(radius * 1.5, 8, 6);
                padGeo.scale(1, 0.5, 1);
                const pad = new THREE.Mesh(padGeo, footMat);
                pad.position.y = -radius * 0.5;
                parent.add(pad);

                for (let i = 0; i < 3; i++) {
                    const hookGeo = new THREE.ConeGeometry(radius * 0.3, radius * 1.5, 4);
                    const hook = new THREE.Mesh(hookGeo, footMat);
                    const angle = (i - 1) * 0.4;
                    hook.position.set(Math.sin(angle) * radius, -radius * 1.2, Math.cos(angle) * radius * 0.5);
                    hook.rotation.x = 0.3;
                    parent.add(hook);
                }
                break;

            case 'stick':
                // Simple tiny tip
                const stickTipGeo = new THREE.SphereGeometry(radius * 0.8, 6, 4);
                const stickTip = new THREE.Mesh(stickTipGeo, footMat);
                stickTip.position.y = -radius * 0.4;
                parent.add(stickTip);
                break;

            default:
                // Standard insect foot with tarsal segments
                const tarsalMat = footMat;
                for (let i = 0; i < 2; i++) {
                    const tarGeo = new THREE.SphereGeometry(radius * (1 - i * 0.3), 6, 4);
                    const tar = new THREE.Mesh(tarGeo, tarsalMat);
                    tar.position.y = -radius * 0.8 * (i + 1);
                    parent.add(tar);
                }

                // Tiny claws
                for (const s of [-1, 1]) {
                    const microClawGeo = new THREE.ConeGeometry(radius * 0.3, radius * 1.5, 4);
                    const microClaw = new THREE.Mesh(microClawGeo, tarsalMat);
                    microClaw.position.set(s * radius * 0.4, -radius * 2.5, 0);
                    microClaw.rotation.z = s * 0.4;
                    parent.add(microClaw);
                }
                break;
        }
    }

    createChitinMaterial(colorKey, options = {}) {
        const color = this.colors[colorKey] || colorKey;
        const textureType = this.genome.textureType || 'smooth';

        // Generate and cache normal map if not already created
        if (!this.normalMap) {
            const texGen = new TextureGenerator(256);
            this.normalMap = texGen.generate(textureType);
        }

        // Roughness and normal intensity vary by texture type
        let baseRoughness, normalIntensity;
        switch (textureType) {
            case 'smooth':
                baseRoughness = 0.25;
                normalIntensity = 0.3;
                break;
            case 'plated':
                baseRoughness = 0.4;
                normalIntensity = 0.6;
                break;
            case 'rough':
                baseRoughness = 0.55;
                normalIntensity = 0.7;
                break;
            case 'spotted':
                baseRoughness = 0.35;
                normalIntensity = 0.5;
                break;
            case 'striped':
                baseRoughness = 0.3;
                normalIntensity = 0.3;
                break;
            default:
                baseRoughness = 0.35;
                normalIntensity = 0.5;
        }

        const materialOptions = {
            color: color,
            roughness: options.roughness ?? baseRoughness,
            metalness: options.metalness ?? 0.15,
            normalMap: this.normalMap,
            normalScale: new THREE.Vector2(normalIntensity, normalIntensity),
        };

        return new THREE.MeshStandardMaterial({
            ...materialOptions,
            ...options,
        });
    }

    createAntennae(scale) {
        const group = new THREE.Group();
        group.name = 'antennae';
        const style = this.genome.antennaStyle || 'segmented';

        if (style === 'none') {
            return group; // Return empty group
        }

        const antennaMat = this.createMaterial('dark');
        const antennaLength = 5 * scale;

        for (const side of [-1, 1]) {
            const antennaGroup = new THREE.Group();

            switch (style) {
                case 'segmented':
                default:
                    // Segmented, spiky antennae
                    const segGeo = new THREE.CylinderGeometry(0.1 * scale, 0.3 * scale, antennaLength, 6);
                    const segAntenna = new THREE.Mesh(segGeo, antennaMat);
                    segAntenna.position.set(0, antennaLength / 2, 0);
                    antennaGroup.add(segAntenna);

                    // Segmentation rings
                    for (let i = 0; i < 3; i++) {
                        const ringGeo = new THREE.TorusGeometry(0.25 * scale, 0.08 * scale, 6, 8);
                        const ring = new THREE.Mesh(ringGeo, antennaMat);
                        ring.position.set(0, 1 * scale + i * 1.2 * scale, 0);
                        ring.rotation.x = Math.PI / 2;
                        antennaGroup.add(ring);
                    }

                    // Sharp tip
                    const tipGeo = new THREE.ConeGeometry(0.15 * scale, 0.8 * scale, 6);
                    const tip = new THREE.Mesh(tipGeo, antennaMat);
                    tip.position.set(0, antennaLength + 0.4 * scale, 0);
                    antennaGroup.add(tip);
                    break;

                case 'clubbed':
                    // Club-ended antennae (like a butterfly)
                    const clubShaftGeo = new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, antennaLength * 0.85, 6);
                    const clubShaft = new THREE.Mesh(clubShaftGeo, antennaMat);
                    clubShaft.position.set(0, antennaLength * 0.4, 0);
                    antennaGroup.add(clubShaft);

                    // Club at the end - bulbous
                    const clubGeo = new THREE.SphereGeometry(0.4 * scale, 8, 6);
                    clubGeo.scale(0.6, 1.2, 0.6);
                    const club = new THREE.Mesh(clubGeo, antennaMat);
                    club.position.set(0, antennaLength * 0.9, 0);
                    antennaGroup.add(club);

                    // Smaller ball at tip
                    const tipBallGeo = new THREE.SphereGeometry(0.2 * scale, 6, 4);
                    const tipBall = new THREE.Mesh(tipBallGeo, antennaMat);
                    tipBall.position.set(0, antennaLength * 1.05, 0);
                    antennaGroup.add(tipBall);
                    break;

                case 'whip':
                    // Long, thin whip-like antennae (cockroach/cricket style)
                    const whipLength = antennaLength * 1.8;
                    const whipPoints = [];
                    for (let i = 0; i <= 10; i++) {
                        const t = i / 10;
                        const wave = Math.sin(t * Math.PI * 1.5) * 0.3 * scale * t;
                        whipPoints.push(new THREE.Vector3(wave, t * whipLength, 0));
                    }
                    const whipCurve = new THREE.CatmullRomCurve3(whipPoints);
                    const whipGeo = new THREE.TubeGeometry(whipCurve, 15, 0.08 * scale * (1), 6, false);
                    const whipAntenna = new THREE.Mesh(whipGeo, antennaMat);
                    antennaGroup.add(whipAntenna);

                    // Tapered tip
                    const whipTipGeo = new THREE.ConeGeometry(0.05 * scale, 0.5 * scale, 4);
                    const whipTip = new THREE.Mesh(whipTipGeo, antennaMat);
                    whipTip.position.set(0.3 * scale, whipLength, 0);
                    antennaGroup.add(whipTip);
                    break;

                case 'horned':
                    // Short, thick horn-like antennae
                    const hornBaseGeo = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, antennaLength * 0.4, 8);
                    const hornBase = new THREE.Mesh(hornBaseGeo, antennaMat);
                    hornBase.position.set(0, antennaLength * 0.2, 0);
                    antennaGroup.add(hornBase);

                    // Curved horn tip
                    const hornCurve = new THREE.QuadraticBezierCurve3(
                        new THREE.Vector3(0, antennaLength * 0.4, 0),
                        new THREE.Vector3(side * 0.5 * scale, antennaLength * 0.7, 0.2 * scale),
                        new THREE.Vector3(side * 0.3 * scale, antennaLength * 0.9, 0)
                    );
                    const hornTipGeo = new THREE.TubeGeometry(hornCurve, 8, 0.15 * scale, 6, false);
                    const hornTip = new THREE.Mesh(hornTipGeo, antennaMat);
                    antennaGroup.add(hornTip);

                    // Sharp point
                    const pointGeo = new THREE.ConeGeometry(0.1 * scale, 0.4 * scale, 5);
                    const point = new THREE.Mesh(pointGeo, antennaMat);
                    point.position.set(side * 0.3 * scale, antennaLength * 0.95, 0);
                    point.rotation.z = side * 0.3;
                    antennaGroup.add(point);
                    break;

                case 'nubs':
                    // Small horn nubs - simple cone protrusions
                    const nubLength = antennaLength * 0.4;
                    const nubGeo = new THREE.ConeGeometry(0.35 * scale, nubLength, 6);
                    const nub = new THREE.Mesh(nubGeo, antennaMat);
                    nub.position.set(0, nubLength / 2, 0);
                    antennaGroup.add(nub);
                    break;

            }

            // Position and angle antennae based on style
            // Base position on top of head
            antennaGroup.position.set(-side * 1.2 * scale, 2.8 * scale, 4.2 * scale);

            // Different angles per style
            switch (style) {
                case 'segmented':
                    // Ant-like: mostly upright, slight forward lean
                    antennaGroup.rotation.x = 0.3;
                    antennaGroup.rotation.z = side * 0.3;
                    break;
                case 'clubbed':
                    // Butterfly-like: angled forward and out
                    antennaGroup.rotation.x = 0.5;
                    antennaGroup.rotation.z = side * 0.4;
                    break;
                case 'whip':
                    // Cockroach-like: swept back
                    antennaGroup.rotation.x = -0.4;
                    antennaGroup.rotation.z = side * 0.3;
                    break;
                case 'horned':
                    // Beetle-like: upright, slight outward
                    antennaGroup.rotation.x = 0.1;
                    antennaGroup.rotation.z = side * 0.5;
                    break;
                case 'nubs':
                    // Small horns: angled back and outward
                    antennaGroup.rotation.x = -0.3;
                    antennaGroup.rotation.z = side * 0.5;
                    break;
                default:
                    antennaGroup.rotation.x = 0.2;
                    antennaGroup.rotation.z = side * 0.3;
            }

            group.add(antennaGroup);

            if (side === 1) group.userData.right = antennaGroup;
            else group.userData.left = antennaGroup;
        }

        return group;
    }

    createWeapon(weaponType, scale) {
        const group = new THREE.Group();
        group.name = 'weapon';

        // Weapon materials - use bug's colors
        const chitinMat = this.createChitinMaterial('primary');
        const darkChitin = this.createChitinMaterial('dark');
        // Weapons use darker variant of bug's color
        const weaponMat = darkChitin;

        // Only venom parts get different color
        const venomMat = new THREE.MeshStandardMaterial({
            color: 0x00ff44,
            emissive: 0x00ff22,
            emissiveIntensity: 0.6,
            roughness: 0.2,
        });

        switch (weaponType) {
            case 'mandibles':
            default: {
                // STAG BEETLE STYLE - massive curved pincers
                for (const side of [-1, 1]) {
                    const mandGroup = new THREE.Group();

                    // Muscular base joint
                    const baseGeo = new THREE.SphereGeometry(1.0 * scale, 10, 8);
                    baseGeo.scale(1.2, 0.9, 1.4);
                    const base = new THREE.Mesh(baseGeo, darkChitin);
                    mandGroup.add(base);

                    // Main mandible - thick curved pincer
                    const mandCurve = new THREE.CubicBezierCurve3(
                        new THREE.Vector3(0, 0, 0.5 * scale),
                        new THREE.Vector3(side * 3.5 * scale, 0.5 * scale, 2 * scale),
                        new THREE.Vector3(side * 4 * scale, 0.3 * scale, 4.5 * scale),
                        new THREE.Vector3(side * 1.5 * scale, 0, 6.5 * scale)
                    );

                    // Tapered mandible blade
                    const mandGeo = new THREE.TubeGeometry(mandCurve, 20, 0.5 * scale, 8, false);
                    const mand = new THREE.Mesh(mandGeo, weaponMat);
                    mandGroup.add(mand);

                    // Inner ridge for crushing
                    const ridgeCurve = new THREE.CubicBezierCurve3(
                        new THREE.Vector3(side * -0.2 * scale, -0.3 * scale, 0.8 * scale),
                        new THREE.Vector3(side * 2.8 * scale, -0.1 * scale, 2.2 * scale),
                        new THREE.Vector3(side * 3.2 * scale, -0.1 * scale, 4.2 * scale),
                        new THREE.Vector3(side * 1.2 * scale, -0.2 * scale, 6 * scale)
                    );
                    const ridgeGeo = new THREE.TubeGeometry(ridgeCurve, 16, 0.25 * scale, 6, false);
                    const ridge = new THREE.Mesh(ridgeGeo, darkChitin);
                    mandGroup.add(ridge);

                    // Vicious serrated teeth along inner edge
                    for (let i = 0; i < 6; i++) {
                        const t = 0.15 + i * 0.14;
                        const pos = mandCurve.getPoint(t);
                        const toothSize = (0.4 - i * 0.03) * scale;

                        // Main tooth
                        const toothGeo = new THREE.ConeGeometry(toothSize * 0.4, toothSize * 1.8, 4);
                        const tooth = new THREE.Mesh(toothGeo, weaponMat);
                        tooth.position.copy(pos);
                        tooth.position.x += side * -0.4 * scale;
                        tooth.position.y -= 0.2 * scale;
                        tooth.rotation.z = side * 1.2;
                        tooth.rotation.x = 0.3;
                        mandGroup.add(tooth);
                    }

                    // Sharp tip
                    const tipGeo = new THREE.ConeGeometry(0.3 * scale, 1.2 * scale, 5);
                    const tip = new THREE.Mesh(tipGeo, weaponMat);
                    const tipPos = mandCurve.getPoint(0.95);
                    tip.position.copy(tipPos);
                    tip.position.z += 0.5 * scale;
                    tip.rotation.x = Math.PI / 2;
                    mandGroup.add(tip);

                    mandGroup.position.set(side * 1.0 * scale, 0.5 * scale, 4.5 * scale);
                    group.add(mandGroup);

                    if (side === 1) group.userData.right = mandGroup;
                    else group.userData.left = mandGroup;
                }
                break;
            }

            case 'fangs': {
                // SPIDER CHELICERAE - compact fangs under the head
                // Real spider fangs are short and stay near the mouth
                for (const side of [-1, 1]) {
                    const fangGroup = new THREE.Group();

                    // Chelicera base - where fang attaches to head
                    const chelBaseGeo = new THREE.SphereGeometry(0.7 * scale, 10, 8);
                    chelBaseGeo.scale(0.9, 1.0, 1.1);
                    const chelBase = new THREE.Mesh(chelBaseGeo, darkChitin);
                    fangGroup.add(chelBase);

                    // Venom gland - visible bulge
                    const glandGeo = new THREE.SphereGeometry(0.4 * scale, 8, 6);
                    const gland = new THREE.Mesh(glandGeo, venomMat);
                    gland.position.set(side * 0.15 * scale, 0.3 * scale, 0.2 * scale);
                    fangGroup.add(gland);

                    // Main fang - SHORT curved hook, stays under head
                    const fangCurve = new THREE.CubicBezierCurve3(
                        new THREE.Vector3(0, -0.3 * scale, 0.4 * scale),
                        new THREE.Vector3(0, -1.2 * scale, 1.0 * scale),
                        new THREE.Vector3(0, -2.0 * scale, 0.8 * scale),
                        new THREE.Vector3(0, -2.5 * scale, 0.2 * scale)
                    );
                    const fangGeo = new THREE.TubeGeometry(fangCurve, 12, 0.28 * scale, 8, false);
                    const fang = new THREE.Mesh(fangGeo, weaponMat);
                    fangGroup.add(fang);

                    // Fang tip - needle sharp
                    const fangTipGeo = new THREE.ConeGeometry(0.12 * scale, 0.8 * scale, 5);
                    const fangTip = new THREE.Mesh(fangTipGeo, weaponMat);
                    fangTip.position.set(0, -3.0 * scale, 0);
                    fangTip.rotation.x = 0.2;
                    fangGroup.add(fangTip);

                    // Venom groove on fang
                    const grooveCurve = new THREE.CubicBezierCurve3(
                        new THREE.Vector3(side * 0.1 * scale, -0.3 * scale, 0.5 * scale),
                        new THREE.Vector3(side * 0.08 * scale, -1.2 * scale, 0.95 * scale),
                        new THREE.Vector3(side * 0.05 * scale, -2.0 * scale, 0.75 * scale),
                        new THREE.Vector3(0, -2.4 * scale, 0.25 * scale)
                    );
                    const grooveGeo = new THREE.TubeGeometry(grooveCurve, 10, 0.06 * scale, 4, false);
                    const groove = new THREE.Mesh(grooveGeo, venomMat);
                    fangGroup.add(groove);

                    // Small venom drip
                    const dripGeo = new THREE.SphereGeometry(0.12 * scale, 6, 4);
                    dripGeo.scale(0.8, 1.3, 0.8);
                    const drip = new THREE.Mesh(dripGeo, venomMat);
                    drip.position.set(0, -3.3 * scale, -0.1 * scale);
                    fangGroup.add(drip);

                    // Position under the head, close together
                    fangGroup.position.set(side * 0.8 * scale, -0.5 * scale, 5.5 * scale);
                    fangGroup.userData.baseX = fangGroup.position.x;
                    fangGroup.userData.baseY = fangGroup.position.y;
                    fangGroup.userData.baseZ = fangGroup.position.z;
                    group.add(fangGroup);

                    if (side === 1) group.userData.right = fangGroup;
                    else group.userData.left = fangGroup;
                }
                break;
            }

            case 'stinger': {
                // SCORPION TAIL - curls UP and FORWARD over body
                // Using continuous tube geometry for connected look
                const tailGroup = new THREE.Group();

                // Main tail curve - arcs up and forward over the body
                const tailCurve = new THREE.CubicBezierCurve3(
                    new THREE.Vector3(0, 0, -3 * scale),          // Base at abdomen
                    new THREE.Vector3(0, 3 * scale, -4 * scale),  // Curves up and back
                    new THREE.Vector3(0, 6 * scale, -1 * scale),  // High point
                    new THREE.Vector3(0, 5 * scale, 3 * scale)    // Curves forward over body
                );

                // Custom radius function for tapering
                const radiusFunc = (t) => (1.0 - t * 0.5) * scale;

                // Main tail tube - continuous and connected (thinner)
                const tailGeo = new THREE.TubeGeometry(tailCurve, 24, 0.5 * scale, 8, false);
                const tail = new THREE.Mesh(tailGeo, darkChitin);
                tailGroup.add(tail);

                // Segment rings along the tail for articulated look
                const numRings = 6;
                for (let i = 1; i < numRings; i++) {
                    const t = i / numRings;
                    const pos = tailCurve.getPoint(t);
                    const tangent = tailCurve.getTangent(t);
                    const ringRadius = (0.6 - t * 0.25) * scale;

                    // Ring indent to show segmentation
                    const ringGeo = new THREE.TorusGeometry(ringRadius * 0.9, 0.08 * scale, 6, 12);
                    const ring = new THREE.Mesh(ringGeo, weaponMat);
                    ring.position.copy(pos);
                    // Orient ring perpendicular to curve
                    ring.quaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 0, 1),
                        tangent.normalize()
                    );
                    tailGroup.add(ring);

                    // Dorsal ridge spike on each segment
                    if (i < numRings - 1) {
                        const ridgeGeo = new THREE.ConeGeometry(0.15 * scale, 0.5 * scale, 4);
                        const ridge = new THREE.Mesh(ridgeGeo, weaponMat);
                        ridge.position.copy(pos);
                        ridge.position.y += ringRadius * 0.8;
                        // Point ridge outward from curve
                        ridge.rotation.x = -Math.atan2(tangent.z, tangent.y);
                        tailGroup.add(ridge);
                    }
                }

                // Telson (venom bulb) at the end
                const telsonPos = tailCurve.getPoint(1.0);
                const telsonGeo = new THREE.SphereGeometry(0.6 * scale, 10, 8);
                telsonGeo.scale(0.8, 1.0, 1.1);
                const telson = new THREE.Mesh(telsonGeo, venomMat);
                telson.position.copy(telsonPos);
                telson.position.z += 0.3 * scale;
                tailGroup.add(telson);

                // Aculeus (stinger spike) - curves forward to strike
                const stingerCurve = new THREE.QuadraticBezierCurve3(
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0, 0.5 * scale, 1.5 * scale),
                    new THREE.Vector3(0, -0.5 * scale, 3 * scale)
                );
                const stingerGeo = new THREE.TubeGeometry(stingerCurve, 12, 0.2 * scale, 6, false);
                const stinger = new THREE.Mesh(stingerGeo, weaponMat);
                stinger.position.copy(telsonPos);
                stinger.position.z += 0.8 * scale;
                tailGroup.add(stinger);

                // Needle-sharp tip
                const needleGeo = new THREE.ConeGeometry(0.1 * scale, 1.2 * scale, 5);
                const needle = new THREE.Mesh(needleGeo, weaponMat);
                needle.position.copy(telsonPos);
                needle.position.z += 3.8 * scale;
                needle.position.y -= 0.5 * scale;
                needle.rotation.x = Math.PI / 2 + 0.2;
                tailGroup.add(needle);

                // Venom droplet
                const venomDrop = new THREE.SphereGeometry(0.12 * scale, 6, 4);
                const drop = new THREE.Mesh(venomDrop, venomMat);
                drop.position.copy(telsonPos);
                drop.position.z += 4.8 * scale;
                drop.position.y -= 0.6 * scale;
                tailGroup.add(drop);

                // Store base positions for animation
                tailGroup.userData.baseY = 0;
                tailGroup.userData.baseZ = 0;

                group.add(tailGroup);
                group.userData.stinger = tailGroup;
                group.userData.telson = telson;
                break;
            }

            case 'pincers': {
                // SCORPION PINCERS - both claws move
                for (const side of [-1, 1]) {
                    const pincerGroup = new THREE.Group();

                    // Arm joint
                    const jointGeo = new THREE.SphereGeometry(0.55 * scale, 8, 6);
                    const joint = new THREE.Mesh(jointGeo, darkChitin);
                    joint.position.set(side * 0.8 * scale, 0, 3 * scale);
                    pincerGroup.add(joint);

                    // BULBOUS HAND (chela)
                    const handGeo = new THREE.SphereGeometry(0.9 * scale, 10, 8);
                    handGeo.scale(1.3, 0.8, 1.1);
                    const hand = new THREE.Mesh(handGeo, darkChitin);
                    hand.position.set(side * 1.3 * scale, 0, 4.5 * scale);
                    pincerGroup.add(hand);

                    // LOWER CLAW - curved, vicious, in a group to animate
                    const lowerClawGroup = new THREE.Group();
                    lowerClawGroup.position.set(side * 1.3 * scale, -0.15 * scale, 4.5 * scale);

                    // More dramatic curve - sweeps out then hooks inward
                    const lowerClawCurve = new THREE.CubicBezierCurve3(
                        new THREE.Vector3(0, 0, 0),
                        new THREE.Vector3(side * 0.8 * scale, -0.4 * scale, 1.2 * scale),
                        new THREE.Vector3(side * 0.6 * scale, -0.3 * scale, 2.8 * scale),
                        new THREE.Vector3(side * 0.15 * scale, 0.1 * scale, 4 * scale)  // Hooks inward at tip
                    );
                    const lowerClawGeo = new THREE.TubeGeometry(lowerClawCurve, 16, 0.38 * scale, 8, false);
                    const lowerClaw = new THREE.Mesh(lowerClawGeo, weaponMat);
                    lowerClawGroup.add(lowerClaw);

                    // Lower tip - sharp, points forward
                    const lowerTipGeo = new THREE.ConeGeometry(0.2 * scale, 1.2 * scale, 6);
                    const lowerTip = new THREE.Mesh(lowerTipGeo, weaponMat);
                    lowerTip.position.set(side * 0.2 * scale, 0.15 * scale, 4.3 * scale);
                    lowerTip.rotation.x = Math.PI / 2;  // Point straight forward
                    lowerClawGroup.add(lowerTip);

                    lowerClawGroup.userData.baseRotX = 0;
                    pincerGroup.add(lowerClawGroup);
                    pincerGroup.userData.lowerClaw = lowerClawGroup;

                    // UPPER CLAW - curved, vicious, in a group to animate
                    const upperClawGroup = new THREE.Group();
                    upperClawGroup.position.set(side * 1.3 * scale, 0.15 * scale, 4.5 * scale);

                    // More dramatic curve - sweeps out then hooks inward
                    const upperClawCurve = new THREE.CubicBezierCurve3(
                        new THREE.Vector3(0, 0, 0),
                        new THREE.Vector3(side * 0.8 * scale, 0.4 * scale, 1.2 * scale),
                        new THREE.Vector3(side * 0.6 * scale, 0.3 * scale, 2.8 * scale),
                        new THREE.Vector3(side * 0.15 * scale, -0.1 * scale, 4 * scale)  // Hooks inward at tip
                    );
                    const upperClawGeo = new THREE.TubeGeometry(upperClawCurve, 16, 0.35 * scale, 8, false);
                    const upperClaw = new THREE.Mesh(upperClawGeo, weaponMat);
                    upperClawGroup.add(upperClaw);

                    // Upper tip - sharp, points forward
                    const upperTipGeo = new THREE.ConeGeometry(0.18 * scale, 1.1 * scale, 6);
                    const upperTip = new THREE.Mesh(upperTipGeo, weaponMat);
                    upperTip.position.set(side * 0.2 * scale, -0.15 * scale, 4.3 * scale);
                    upperTip.rotation.x = Math.PI / 2;  // Point straight forward
                    upperClawGroup.add(upperTip);

                    upperClawGroup.userData.baseRotX = 0;
                    pincerGroup.add(upperClawGroup);
                    pincerGroup.userData.upperClaw = upperClawGroup;

                    // Position whole pincer
                    pincerGroup.position.set(side * 1.2 * scale, 0.5 * scale, 3 * scale);
                    pincerGroup.userData.baseRotY = 0;
                    pincerGroup.userData.baseRotZ = 0;
                    group.add(pincerGroup);

                    if (side === 1) group.userData.right = pincerGroup;
                    else group.userData.left = pincerGroup;
                }
                break;
            }

            case 'horn': {
                // RHINOCEROS BEETLE - single horn from head (smaller, more proportionate)
                const hornGroup = new THREE.Group();

                // Main horn - curves up and forward from head (reduced size)
                const hornCurve = new THREE.CubicBezierCurve3(
                    new THREE.Vector3(0, 0, 0),                      // Base at head
                    new THREE.Vector3(0, 1.5 * scale, 1.2 * scale), // Curves up
                    new THREE.Vector3(0, 2.5 * scale, 3 * scale),   // Continues forward
                    new THREE.Vector3(0, 2 * scale, 5 * scale)      // Tips forward
                );

                // Main horn tube
                const hornGeo = new THREE.TubeGeometry(hornCurve, 16, 0.35 * scale, 8, false);
                const horn = new THREE.Mesh(hornGeo, weaponMat);
                hornGroup.add(horn);

                // Ridge along top for texture
                const ridgeCurve = new THREE.CubicBezierCurve3(
                    new THREE.Vector3(0, 0.3 * scale, 0.1 * scale),
                    new THREE.Vector3(0, 1.8 * scale, 1.3 * scale),
                    new THREE.Vector3(0, 2.8 * scale, 3 * scale),
                    new THREE.Vector3(0, 2.2 * scale, 4.5 * scale)
                );
                const ridgeGeo = new THREE.TubeGeometry(ridgeCurve, 12, 0.1 * scale, 4, false);
                const ridge = new THREE.Mesh(ridgeGeo, darkChitin);
                hornGroup.add(ridge);

                // Sharp tip
                const tipGeo = new THREE.ConeGeometry(0.15 * scale, 1.2 * scale, 6);
                const tip = new THREE.Mesh(tipGeo, weaponMat);
                tip.position.set(0, 1.8 * scale, 5.5 * scale);
                tip.rotation.x = Math.PI / 2 + 0.2;  // Point forward
                hornGroup.add(tip);

                // Small side prongs
                for (const side of [-1, 1]) {
                    const prongGeo = new THREE.ConeGeometry(0.12 * scale, 0.8 * scale, 4);
                    const prong = new THREE.Mesh(prongGeo, weaponMat);
                    prong.position.set(side * 0.4 * scale, 1 * scale, 1 * scale);
                    prong.rotation.z = side * -0.5;
                    prong.rotation.x = -0.4;
                    hornGroup.add(prong);
                }

                // Position horn at top/front of head
                hornGroup.position.set(0, 1.5 * scale, 4.5 * scale);
                hornGroup.userData.baseY = hornGroup.position.y;
                hornGroup.userData.baseZ = hornGroup.position.z;
                hornGroup.userData.baseRotX = 0;

                group.add(hornGroup);
                group.userData.horn = hornGroup;
                break;
            }
        }

        return group;
    }

    createWings(scale) {
        const group = new THREE.Group();
        group.name = 'wings';
        const wingType = this.genome.wingType || 'fly';

        if (wingType === 'none') {
            return group;
        }

        // Wing materials
        const clearMat = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            roughness: 0.2,
            metalness: 0.1,
        });

        const veinMat = new THREE.MeshStandardMaterial({
            color: this.colors.dark,
            roughness: 0.4,
        });

        const elytraMat = new THREE.MeshStandardMaterial({
            color: this.colors.primary,
            roughness: 0.3,
            metalness: 0.2,
        });

        for (const side of [-1, 1]) {
            const wingGroup = new THREE.Group();

            switch (wingType) {
                case 'fly':
                default:
                    // Housefly-style clear wings with prominent veins
                    this.createFlyWing(wingGroup, scale, side, clearMat, veinMat);
                    break;

                case 'beetle':
                    // Elytra (hardened wing covers) + membranous hindwings
                    this.createBeetleWing(wingGroup, scale, side, elytraMat, clearMat, veinMat);
                    break;

                case 'dragonfly':
                    // Four long, narrow dragonfly wings
                    this.createDragonflyWing(wingGroup, scale, side, clearMat, veinMat);
                    break;
            }

            wingGroup.position.set(side * 2 * scale, 2.5 * scale, -1 * scale);
            wingGroup.scale.x = side;
            group.add(wingGroup);

            if (side === 1) group.userData.right = wingGroup;
            else group.userData.left = wingGroup;
        }

        group.userData.baseRotation = {
            right: group.userData.right.rotation.clone(),
            left: group.userData.left.rotation.clone(),
        };

        return group;
    }

    createFlyWing(wingGroup, scale, side, clearMat, veinMat) {
        // Rounded fly wing shape
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(1 * scale, 2 * scale, 3 * scale, 2.5 * scale);
        shape.quadraticCurveTo(6 * scale, 2.5 * scale, 8 * scale, 1 * scale);
        shape.quadraticCurveTo(7 * scale, -0.5 * scale, 4 * scale, -0.5 * scale);
        shape.quadraticCurveTo(1 * scale, -0.3 * scale, 0, 0);

        const geo = new THREE.ShapeGeometry(shape);
        const wing = new THREE.Mesh(geo, clearMat);
        wingGroup.add(wing);

        // Main vein
        const mainVeinGeo = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(0, 0, 0.05),
                new THREE.Vector3(3 * scale, 1.5 * scale, 0.05),
                new THREE.Vector3(7 * scale, 0.8 * scale, 0.05),
            ]), 10, 0.06 * scale, 4, false
        );
        wingGroup.add(new THREE.Mesh(mainVeinGeo, veinMat));

        // Cross veins
        for (let i = 0; i < 4; i++) {
            const crossGeo = new THREE.CylinderGeometry(0.03 * scale, 0.03 * scale, 2 * scale, 4);
            const cross = new THREE.Mesh(crossGeo, veinMat);
            cross.position.set(1.5 * scale + i * 1.5 * scale, 1 * scale, 0.05);
            cross.rotation.z = 0.5 + i * 0.15;
            wingGroup.add(cross);
        }

        wingGroup.rotation.x = -0.15;
        wingGroup.rotation.y = side * 0.3;
    }

    createBeetleWing(wingGroup, scale, side, elytraMat, clearMat, veinMat) {
        // Hardened elytra (wing cover)
        const elytraShape = new THREE.Shape();
        elytraShape.moveTo(0, 0);
        elytraShape.quadraticCurveTo(0.5 * scale, 1.5 * scale, 1 * scale, 2.5 * scale);
        elytraShape.lineTo(3.5 * scale, 2.5 * scale);
        elytraShape.quadraticCurveTo(4 * scale, 1 * scale, 3.5 * scale, -1 * scale);
        elytraShape.lineTo(0.5 * scale, -1 * scale);
        elytraShape.quadraticCurveTo(0, -0.5 * scale, 0, 0);

        const elytraGeo = new THREE.ExtrudeGeometry(elytraShape, {
            depth: 0.3 * scale,
            bevelEnabled: true,
            bevelThickness: 0.1 * scale,
            bevelSize: 0.1 * scale,
        });
        const elytra = new THREE.Mesh(elytraGeo, elytraMat);
        elytra.rotation.x = -0.1;
        wingGroup.add(elytra);

        // Hindwing (folded underneath, partially visible)
        const hindShape = new THREE.Shape();
        hindShape.moveTo(0.5 * scale, 0);
        hindShape.lineTo(5 * scale, 1 * scale);
        hindShape.lineTo(7 * scale, 0);
        hindShape.lineTo(5 * scale, -1 * scale);
        hindShape.lineTo(0.5 * scale, 0);

        const hindGeo = new THREE.ShapeGeometry(hindShape);
        const hind = new THREE.Mesh(hindGeo, clearMat);
        hind.position.set(0, 0.5 * scale, -0.2 * scale);
        hind.rotation.x = -0.3;
        wingGroup.add(hind);

        wingGroup.rotation.y = side * 0.2;
    }

    createMothWing(wingGroup, scale, side, mothMat) {
        // Broad, rounded moth forewing
        const foreShape = new THREE.Shape();
        foreShape.moveTo(0, 0);
        foreShape.quadraticCurveTo(2 * scale, 4 * scale, 6 * scale, 4 * scale);
        foreShape.quadraticCurveTo(9 * scale, 3 * scale, 9 * scale, 0);
        foreShape.quadraticCurveTo(7 * scale, -2 * scale, 3 * scale, -1.5 * scale);
        foreShape.quadraticCurveTo(0, -0.5 * scale, 0, 0);

        const foreGeo = new THREE.ShapeGeometry(foreShape);
        const fore = new THREE.Mesh(foreGeo, mothMat);
        wingGroup.add(fore);

        // Pattern spots
        const spotMat = new THREE.MeshStandardMaterial({
            color: this.colors.accent,
            roughness: 0.7,
        });
        const spotGeo = new THREE.CircleGeometry(0.8 * scale, 12);
        const spot = new THREE.Mesh(spotGeo, spotMat);
        spot.position.set(5 * scale, 1.5 * scale, 0.05);
        wingGroup.add(spot);

        // Hindwing
        const hindShape = new THREE.Shape();
        hindShape.moveTo(0, -0.5 * scale);
        hindShape.quadraticCurveTo(3 * scale, 1 * scale, 5 * scale, 0);
        hindShape.quadraticCurveTo(5 * scale, -3 * scale, 2 * scale, -3 * scale);
        hindShape.quadraticCurveTo(0, -2 * scale, 0, -0.5 * scale);

        const hindGeo = new THREE.ShapeGeometry(hindShape);
        const hind = new THREE.Mesh(hindGeo, mothMat);
        hind.position.z = -0.1 * scale;
        wingGroup.add(hind);

        wingGroup.rotation.x = -0.2;
        wingGroup.rotation.y = side * 0.4;
    }

    createDragonflyWing(wingGroup, scale, side, clearMat, veinMat) {
        // Long, narrow forewing
        const foreShape = new THREE.Shape();
        foreShape.moveTo(0, 0);
        foreShape.lineTo(2 * scale, 1 * scale);
        foreShape.lineTo(10 * scale, 0.8 * scale);
        foreShape.lineTo(11 * scale, 0);
        foreShape.lineTo(10 * scale, -0.6 * scale);
        foreShape.lineTo(2 * scale, -0.8 * scale);
        foreShape.lineTo(0, 0);

        const foreGeo = new THREE.ShapeGeometry(foreShape);
        const fore = new THREE.Mesh(foreGeo, clearMat);
        wingGroup.add(fore);

        // Hindwing (slightly wider at base)
        const hindShape = new THREE.Shape();
        hindShape.moveTo(0, -0.5 * scale);
        hindShape.lineTo(2 * scale, 0.8 * scale);
        hindShape.lineTo(9 * scale, 0.5 * scale);
        hindShape.lineTo(10 * scale, -0.2 * scale);
        hindShape.lineTo(9 * scale, -1.2 * scale);
        hindShape.lineTo(2 * scale, -1.5 * scale);
        hindShape.lineTo(0, -0.5 * scale);

        const hindGeo = new THREE.ShapeGeometry(hindShape);
        const hind = new THREE.Mesh(hindGeo, clearMat);
        hind.position.set(0, -0.3 * scale, -0.1 * scale);
        wingGroup.add(hind);

        // Dense vein network
        for (let i = 0; i < 8; i++) {
            const vGeo = new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 1.2 * scale, 4);
            const v = new THREE.Mesh(vGeo, veinMat);
            v.position.set(1.2 * scale + i * 1.1 * scale, 0.1 * scale, 0.02);
            v.rotation.z = Math.PI / 2 + 0.1;
            wingGroup.add(v);
        }

        // Pterostigma (dark spot near tip)
        const pGeo = new THREE.PlaneGeometry(0.5 * scale, 0.3 * scale);
        const pMat = new THREE.MeshStandardMaterial({ color: this.colors.dark, side: THREE.DoubleSide });
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.set(9 * scale, 0.3 * scale, 0.03);
        wingGroup.add(p);

        wingGroup.rotation.x = -0.1;
        wingGroup.rotation.y = side * 0.25;
    }

    createWaspWing(wingGroup, scale, side, clearMat, veinMat) {
        // Narrow, elongated wasp forewing
        const foreShape = new THREE.Shape();
        foreShape.moveTo(0, 0);
        foreShape.quadraticCurveTo(1 * scale, 1.2 * scale, 3 * scale, 1.5 * scale);
        foreShape.lineTo(8 * scale, 0.8 * scale);
        foreShape.quadraticCurveTo(9 * scale, 0, 8 * scale, -0.6 * scale);
        foreShape.lineTo(3 * scale, -0.8 * scale);
        foreShape.quadraticCurveTo(1 * scale, -0.5 * scale, 0, 0);

        const foreGeo = new THREE.ShapeGeometry(foreShape);
        const fore = new THREE.Mesh(foreGeo, clearMat);
        wingGroup.add(fore);

        // Smaller hindwing
        const hindShape = new THREE.Shape();
        hindShape.moveTo(0.5 * scale, 0);
        hindShape.lineTo(5 * scale, 0.5 * scale);
        hindShape.lineTo(5.5 * scale, 0);
        hindShape.lineTo(5 * scale, -0.5 * scale);
        hindShape.lineTo(0.5 * scale, 0);

        const hindGeo = new THREE.ShapeGeometry(hindShape);
        const hind = new THREE.Mesh(hindGeo, clearMat);
        hind.position.set(0, -0.3 * scale, -0.05 * scale);
        wingGroup.add(hind);

        // Simple veins
        const mainGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 7 * scale, 4);
        const main = new THREE.Mesh(mainGeo, veinMat);
        main.position.set(4 * scale, 0.4 * scale, 0.02);
        main.rotation.z = 0.1;
        wingGroup.add(main);

        wingGroup.rotation.x = -0.15;
        wingGroup.rotation.y = side * 0.35;
    }

    createButterflyWing(wingGroup, scale, side, mothMat) {
        // Large, ornate forewing
        const foreShape = new THREE.Shape();
        foreShape.moveTo(0, 0);
        foreShape.bezierCurveTo(1 * scale, 5 * scale, 5 * scale, 6 * scale, 8 * scale, 4 * scale);
        foreShape.bezierCurveTo(10 * scale, 2 * scale, 9 * scale, -1 * scale, 6 * scale, -2 * scale);
        foreShape.bezierCurveTo(3 * scale, -2 * scale, 0, -1 * scale, 0, 0);

        const foreGeo = new THREE.ShapeGeometry(foreShape);
        const fore = new THREE.Mesh(foreGeo, mothMat);
        wingGroup.add(fore);

        // Wing patterns - circles
        const patternMat = new THREE.MeshStandardMaterial({
            color: this.colors.accent,
            roughness: 0.6,
        });
        const darkMat = new THREE.MeshStandardMaterial({
            color: this.colors.dark,
            roughness: 0.6,
        });

        // Eye spot
        const eyeOuter = new THREE.CircleGeometry(1 * scale, 16);
        const eyeO = new THREE.Mesh(eyeOuter, darkMat);
        eyeO.position.set(5 * scale, 2 * scale, 0.03);
        wingGroup.add(eyeO);

        const eyeInner = new THREE.CircleGeometry(0.5 * scale, 12);
        const eyeI = new THREE.Mesh(eyeInner, patternMat);
        eyeI.position.set(5 * scale, 2 * scale, 0.06);
        wingGroup.add(eyeI);

        // Hindwing with tail
        const hindShape = new THREE.Shape();
        hindShape.moveTo(0, -1 * scale);
        hindShape.bezierCurveTo(2 * scale, 1 * scale, 5 * scale, 1 * scale, 6 * scale, -1 * scale);
        hindShape.bezierCurveTo(6 * scale, -3 * scale, 4 * scale, -5 * scale, 3 * scale, -5 * scale);
        hindShape.bezierCurveTo(1 * scale, -4 * scale, 0, -2 * scale, 0, -1 * scale);

        const hindGeo = new THREE.ShapeGeometry(hindShape);
        const hind = new THREE.Mesh(hindGeo, mothMat);
        hind.position.z = -0.1 * scale;
        wingGroup.add(hind);

        wingGroup.rotation.x = -0.25;
        wingGroup.rotation.y = side * 0.4;
    }

    createTatteredWing(wingGroup, scale, side, clearMat, veinMat) {
        // Damaged wing with holes and tears
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(1.5 * scale, 2 * scale);
        shape.lineTo(3 * scale, 2.2 * scale);
        // Tear
        shape.lineTo(3.5 * scale, 1.5 * scale);
        shape.lineTo(4 * scale, 2 * scale);
        shape.lineTo(6 * scale, 1.8 * scale);
        // Another tear
        shape.lineTo(6.5 * scale, 0.8 * scale);
        shape.lineTo(7 * scale, 1.2 * scale);
        shape.lineTo(7.5 * scale, 0.5 * scale);
        shape.lineTo(6 * scale, -0.5 * scale);
        // Jagged bottom
        shape.lineTo(5 * scale, 0);
        shape.lineTo(4 * scale, -0.8 * scale);
        shape.lineTo(3 * scale, -0.3 * scale);
        shape.lineTo(2 * scale, -0.6 * scale);
        shape.lineTo(0, 0);

        const geo = new THREE.ShapeGeometry(shape);
        const wing = new THREE.Mesh(geo, clearMat);
        wingGroup.add(wing);

        // Broken veins
        for (let i = 0; i < 3; i++) {
            const vGeo = new THREE.CylinderGeometry(0.04 * scale, 0.02 * scale, (2 + i) * scale, 4);
            const v = new THREE.Mesh(vGeo, veinMat);
            v.position.set(1 * scale + i * 2 * scale, 0.8 * scale, 0.02);
            v.rotation.z = 0.4 + i * 0.2;
            wingGroup.add(v);
        }

        wingGroup.rotation.x = -0.2;
        wingGroup.rotation.y = side * 0.3;
    }

    createMembraneWing(wingGroup, scale, side, clearMat, veinMat) {
        // Bat-like membrane wing with finger bones
        const membraneShape = new THREE.Shape();
        membraneShape.moveTo(0, 0);
        membraneShape.lineTo(1 * scale, 2 * scale);
        membraneShape.lineTo(4 * scale, 3.5 * scale);
        membraneShape.lineTo(7 * scale, 3 * scale);
        membraneShape.lineTo(9 * scale, 1.5 * scale);
        membraneShape.lineTo(8 * scale, -0.5 * scale);
        membraneShape.lineTo(5 * scale, -1.5 * scale);
        membraneShape.lineTo(2 * scale, -1 * scale);
        membraneShape.lineTo(0, 0);

        const geo = new THREE.ShapeGeometry(membraneShape);
        const membrane = new THREE.Mesh(geo, clearMat);
        wingGroup.add(membrane);

        // Finger bones
        const bonePositions = [
            [[0, 0], [1, 2], [4, 3.5]],
            [[0, 0], [3, 1.5], [7, 3]],
            [[0, 0], [4, 0.5], [9, 1.5]],
            [[0, 0], [3, -0.5], [8, -0.5]],
            [[0, 0], [2, -1], [5, -1.5]],
        ];

        bonePositions.forEach(positions => {
            const points = positions.map(p => new THREE.Vector3(p[0] * scale, p[1] * scale, 0.1));
            const curve = new THREE.CatmullRomCurve3(points);
            const boneGeo = new THREE.TubeGeometry(curve, 8, 0.08 * scale, 4, false);
            wingGroup.add(new THREE.Mesh(boneGeo, veinMat));
        });

        wingGroup.rotation.x = -0.15;
        wingGroup.rotation.y = side * 0.35;
    }

    createArmoredWing(wingGroup, scale, side, elytraMat) {
        // Heavy armored wing covers (like a heavily armored beetle)
        const armorMat = new THREE.MeshStandardMaterial({
            color: this.darken(this.colors.primary, 0.2),
            roughness: 0.25,
            metalness: 0.5,
        });

        // Main armor plate
        const plateShape = new THREE.Shape();
        plateShape.moveTo(0, 0);
        plateShape.lineTo(0.5 * scale, 2 * scale);
        plateShape.lineTo(2 * scale, 3 * scale);
        plateShape.lineTo(4 * scale, 2.5 * scale);
        plateShape.lineTo(4 * scale, -1.5 * scale);
        plateShape.lineTo(2 * scale, -2 * scale);
        plateShape.lineTo(0, -0.5 * scale);
        plateShape.lineTo(0, 0);

        const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
            depth: 0.5 * scale,
            bevelEnabled: true,
            bevelThickness: 0.15 * scale,
            bevelSize: 0.1 * scale,
        });
        const plate = new THREE.Mesh(plateGeo, armorMat);
        wingGroup.add(plate);

        // Ridge details
        for (let i = 0; i < 3; i++) {
            const ridgeGeo = new THREE.BoxGeometry(0.15 * scale, 3 * scale, 0.2 * scale);
            const ridge = new THREE.Mesh(ridgeGeo, elytraMat);
            ridge.position.set(1 * scale + i * 1 * scale, 0.5 * scale, 0.4 * scale);
            ridge.rotation.z = 0.1;
            wingGroup.add(ridge);
        }

        // Spikes on edge
        for (let i = 0; i < 2; i++) {
            const spikeGeo = new THREE.ConeGeometry(0.2 * scale, 0.8 * scale, 5);
            const spike = new THREE.Mesh(spikeGeo, armorMat);
            spike.position.set(3.5 * scale, 1 * scale - i * 2 * scale, 0.3 * scale);
            spike.rotation.z = -Math.PI / 2;
            wingGroup.add(spike);
        }

        wingGroup.rotation.x = -0.1;
        wingGroup.rotation.y = side * 0.15;
    }

    createLocustWing(wingGroup, scale, side, clearMat, veinMat, elytraMat) {
        // Leathery forewing (tegmen)
        const tegShape = new THREE.Shape();
        tegShape.moveTo(0, 0);
        tegShape.lineTo(1 * scale, 1 * scale);
        tegShape.lineTo(8 * scale, 0.8 * scale);
        tegShape.lineTo(9 * scale, 0);
        tegShape.lineTo(8 * scale, -0.5 * scale);
        tegShape.lineTo(1 * scale, -0.5 * scale);
        tegShape.lineTo(0, 0);

        const tegGeo = new THREE.ShapeGeometry(tegShape);
        const teg = new THREE.Mesh(tegGeo, elytraMat);
        wingGroup.add(teg);

        // Large fan-like hindwing
        const hindShape = new THREE.Shape();
        hindShape.moveTo(0.5 * scale, 0);
        hindShape.bezierCurveTo(2 * scale, 3 * scale, 6 * scale, 4 * scale, 10 * scale, 2 * scale);
        hindShape.bezierCurveTo(11 * scale, 0, 10 * scale, -2 * scale, 8 * scale, -3 * scale);
        hindShape.bezierCurveTo(5 * scale, -3 * scale, 2 * scale, -2 * scale, 0.5 * scale, 0);

        const hindGeo = new THREE.ShapeGeometry(hindShape);
        const hind = new THREE.Mesh(hindGeo, clearMat);
        hind.position.set(0, -0.2 * scale, -0.15 * scale);
        wingGroup.add(hind);

        // Radial veins on hindwing
        for (let i = 0; i < 6; i++) {
            const angle = -0.5 + i * 0.25;
            const vGeo = new THREE.CylinderGeometry(0.03 * scale, 0.02 * scale, 8 * scale, 4);
            const v = new THREE.Mesh(vGeo, veinMat);
            v.position.set(5 * scale, -0.5 * scale, -0.12 * scale);
            v.rotation.z = angle;
            wingGroup.add(v);
        }

        wingGroup.rotation.x = -0.15;
        wingGroup.rotation.y = side * 0.3;
    }
}

// ============================================
// BUG ANIMATOR CLASS
// ============================================

class BugAnimator {
    constructor(bugGroup) {
        this.bug = bugGroup;
        this.time = 0;
        this.state = 'idle';
        this.stateTime = 0;
        this.speed = 0;
        this.isFlying = false;
        this.isDiving = false;
        this.grounded = true;
        this.onWall = false;
        this.isJumping = false;
        this.jumpPhase = 0;  // 0-1 for jump animation progress
        this.vy = 0;  // Vertical velocity for jump direction
        this.weaponType = bugGroup.userData.weaponType || 'mandibles';
        // Death animation state
        this.deathPhase = 'falling';  // 'falling', 'landing', 'flipping', 'done'
        this.deathFallY = 0;
        this.deathRotation = 0;
        this.deathLanded = false;
        this.groundedDeathTime = 0;
    }

    update(deltaTime, state = 'idle', fighter = null) {
        this.time += deltaTime;

        if (state !== this.state) {
            this.state = state;
            this.stateTime = 0;
            // Reset death animation when entering death state
            if (state === 'death') {
                this.deathPhase = 'falling';
                this.deathFallY = 0;
                this.deathRotation = 0;
                this.deathLanded = false;
                this.groundedDeathTime = 0;
            }
        }
        this.stateTime += deltaTime;

        // Extract movement info from fighter state
        if (fighter) {
            const vx = fighter.vx || 0;
            const vy = fighter.vy || 0;
            const vz = fighter.vz || 0;
            this.speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            this.isFlying = fighter.isFlying || false;
            this.isDiving = fighter.isDiving || false;
            this.grounded = fighter.grounded !== false;
            this.onWall = fighter.onWall || false;
            this.vy = vy;
            // Jumping = not grounded, not flying, not on wall
            this.isJumping = !this.grounded && !this.isFlying && !this.onWall;
            // Track jump phase based on vertical velocity
            if (this.isJumping) {
                // vy < 0 means going up, vy > 0 means falling
                this.jumpPhase = vy < 0 ? Math.min(1, -vy / 15) : 0.5 + Math.min(0.5, vy / 15);
            } else {
                this.jumpPhase = 0;
            }
        }

        switch (this.state) {
            case 'idle':
                this.animateIdle();
                break;
            case 'attack':
            case 'attacking':
                this.animateAttack();
                break;
            case 'hit':
                this.animateHit();
                break;
            case 'death':
                this.animateDeath();
                break;
            case 'victory':
                this.animateVictory();
                break;
            case 'jump':
                this.animateJump();
                break;
        }
    }

    animateIdle() {
        const t = this.time * 2;
        const speedFactor = Math.min(this.speed / 10, 1);  // 0-1 based on speed

        // Breathing - faster when moving
        const breatheSpeed = 1 + speedFactor * 2;
        const breatheAmount = 0.02 + speedFactor * 0.03;
        const breathe = 1 + Math.sin(t * breatheSpeed) * breatheAmount;
        if (this.bug.userData.abdomen) {
            this.bug.userData.abdomen.scale.y = breathe;
        }
        if (this.bug.userData.thorax) {
            this.bug.userData.thorax.scale.y = breathe;
        }

        // Leg movement - varies based on state: flying airborne, jumping, or grounded/walking
        if (this.bug.userData.legs) {
            // Flying bugs in the air: legs hang down
            const flyingAirborne = this.isFlying && !this.grounded;

            if (flyingAirborne) {
                // Flying in air: legs hang down with slight dangle
                const dangle = Math.sin(this.time * 3) * 0.05;
                this.bug.userData.legs.children.forEach((leg) => {
                    if (leg.userData.segments && leg.userData.segments.length > 0) {
                        const coxa = leg.userData.segments[0];
                        if (coxa && coxa.baseRotation) {
                            coxa.pivot.rotation.x = coxa.baseRotation.x + 0.2 + dangle;
                            coxa.pivot.rotation.z = coxa.baseRotation.z;
                        }
                        const femur = leg.userData.segments[1];
                        if (femur && femur.baseRotation) {
                            femur.pivot.rotation.x = femur.baseRotation.x + 0.3;
                        }
                        const tibia = leg.userData.segments[2];
                        if (tibia && tibia.baseRotation) {
                            tibia.pivot.rotation.x = tibia.baseRotation.x + 0.15;
                        }
                        const tarsus = leg.userData.segments[3];
                        if (tarsus && tarsus.baseRotation) {
                            tarsus.pivot.rotation.x = tarsus.baseRotation.x;
                        }
                    }
                });
            } else if (this.isJumping) {
                // JUMPING: Legs extend dramatically when going up, tuck when falling
                const ascending = this.vy < 0;
                const jumpIntensity = Math.min(1.5, Math.abs(this.vy) / 8);  // Higher max, more sensitive

                this.bug.userData.legs.children.forEach((leg) => {
                    if (leg.userData.segments && leg.userData.segments.length > 0) {
                        const side = leg.userData.side === 'left' ? -1 : 1;

                        const coxa = leg.userData.segments[0];
                        const femur = leg.userData.segments[1];
                        const tibia = leg.userData.segments[2];
                        const tarsus = leg.userData.segments[3];

                        if (ascending) {
                            // Going UP: legs push back hard and extend fully (explosive push off)
                            if (coxa && coxa.baseRotation) {
                                coxa.pivot.rotation.x = coxa.baseRotation.x + 0.8 * jumpIntensity;  // Push back hard
                                coxa.pivot.rotation.z = coxa.baseRotation.z - side * 0.5 * jumpIntensity;  // Spread wide
                            }
                            if (femur && femur.baseRotation) {
                                femur.pivot.rotation.x = femur.baseRotation.x - 1.0 * jumpIntensity;  // Extend fully
                            }
                            if (tibia && tibia.baseRotation) {
                                tibia.pivot.rotation.x = tibia.baseRotation.x - 1.2 * jumpIntensity;  // Straighten out
                            }
                            if (tarsus && tarsus.baseRotation) {
                                tarsus.pivot.rotation.x = tarsus.baseRotation.x + 0.6 * jumpIntensity;  // Point down
                            }
                        } else {
                            // Falling DOWN: legs tuck in tight, prepare for landing
                            if (coxa && coxa.baseRotation) {
                                coxa.pivot.rotation.x = coxa.baseRotation.x - 0.5 * jumpIntensity;  // Forward
                                coxa.pivot.rotation.z = coxa.baseRotation.z + side * 0.4 * jumpIntensity;  // Tuck in
                            }
                            if (femur && femur.baseRotation) {
                                femur.pivot.rotation.x = femur.baseRotation.x + 0.8 * jumpIntensity;  // Bend tight
                            }
                            if (tibia && tibia.baseRotation) {
                                tibia.pivot.rotation.x = tibia.baseRotation.x + 1.0 * jumpIntensity;  // Bend more
                            }
                            if (tarsus && tarsus.baseRotation) {
                                tarsus.pivot.rotation.x = tarsus.baseRotation.x - 0.5 * jumpIntensity;  // Ready for ground
                            }
                        }
                    }
                });
            } else {
                // Grounded: walking animation (faster speed, bigger movements)
                const legSpeed = 6 + speedFactor * 18;  // Much faster (was 3 + 12)
                const legAmplitude = 0.15 + speedFactor * 0.7;  // Much bigger (was 0.05 + 0.4)

                this.bug.userData.legs.children.forEach((leg) => {
                    if (leg.userData.segments && leg.userData.segments.length > 0) {
                        const phase = leg.userData.phase || 0;
                        const side = leg.userData.side === 'left' ? -1 : 1;
                        const walkCycle = Math.sin(t * legSpeed + phase * Math.PI * 2);
                        const liftCycle = Math.max(0, walkCycle);

                        const coxa = leg.userData.segments[0];
                        if (coxa && coxa.baseRotation) {
                            coxa.pivot.rotation.x = coxa.baseRotation.x + walkCycle * legAmplitude * 1.0;  // Bigger swing
                            coxa.pivot.rotation.z = coxa.baseRotation.z + side * liftCycle * legAmplitude * 0.5;  // More lift
                        }

                        const femur = leg.userData.segments[1];
                        if (femur && femur.baseRotation) {
                            femur.pivot.rotation.x = femur.baseRotation.x - liftCycle * legAmplitude * 0.9;  // Higher step
                        }

                        const tibia = leg.userData.segments[2];
                        if (tibia && tibia.baseRotation) {
                            tibia.pivot.rotation.x = tibia.baseRotation.x + walkCycle * legAmplitude * 0.7;  // More bend
                        }

                        const tarsus = leg.userData.segments[3];
                        if (tarsus && tarsus.baseRotation) {
                            tarsus.pivot.rotation.x = tarsus.baseRotation.x - liftCycle * legAmplitude * 0.6;  // More curl
                        }
                    }
                });
            }
        }

        // Antenna - more alert when fast
        if (this.bug.userData.antennae) {
            const antennae = this.bug.userData.antennae;
            const antennaSpeed = 1.5 + speedFactor * 2;
            const antennaAmount = 0.1 + speedFactor * 0.2;
            if (antennae.userData.right) {
                antennae.userData.right.rotation.z = 0.3 + Math.sin(t * antennaSpeed) * antennaAmount;
            }
            if (antennae.userData.left) {
                antennae.userData.left.rotation.z = -0.3 + Math.sin(t * antennaSpeed + 0.5) * antennaAmount;
            }
        }

        // Wing animation - only when airborne
        if (this.bug.userData.wings) {
            const wings = this.bug.userData.wings;

            // Only animate wings when not grounded (flying or jumping)
            if (this.grounded) {
                // Grounded: wings folded still (at base position)
                if (wings.userData.right && wings.userData.baseRotation) {
                    wings.userData.right.rotation.z = wings.userData.baseRotation.right.z;
                }
                if (wings.userData.left && wings.userData.baseRotation) {
                    wings.userData.left.rotation.z = wings.userData.baseRotation.left.z;
                }
            } else {
                // Airborne: wings flapping
                let wingSpeed = 8;
                let wingAmplitude = 0.3;

                if (this.isFlying) {
                    // Flying: much faster wing beat
                    wingSpeed = 20 + speedFactor * 15;  // 20-35 hz
                    wingAmplitude = 0.4 + speedFactor * 0.3;  // Bigger strokes when fast

                    // Diving: wings pulled back
                    if (this.isDiving) {
                        wingAmplitude *= 0.5;
                        wingSpeed *= 0.7;
                    }
                } else {
                    // Jumping/falling: emergency flapping
                    wingSpeed = 15;
                    wingAmplitude = 0.5;
                }

                const flutter = Math.sin(t * wingSpeed) * wingAmplitude;
                if (wings.userData.right && wings.userData.baseRotation) {
                    wings.userData.right.rotation.z = wings.userData.baseRotation.right.z + flutter;
                }
                if (wings.userData.left && wings.userData.baseRotation) {
                    wings.userData.left.rotation.z = wings.userData.baseRotation.left.z - flutter;
                }
            }
        }
    }

    animateAttack() {
        const t = this.stateTime * 8;  // Attack animation speed
        const phase = Math.min(t, Math.PI);
        const weapon = this.bug.userData.weapon;

        switch (this.weaponType) {
            case 'mandibles': {
                // STAG BEETLE BITE - spread wide, lunge, CRUSH, return to neutral
                const t = phase / Math.PI;

                // Mandibles open (0-40%), lunge+snap (40-70%), return (70-100%)
                let spread = 0;
                let headZ = 0;
                if (t < 0.4) {
                    // Open mandibles wide
                    spread = Math.sin(t / 0.4 * Math.PI / 2) * 0.8;
                    headZ = -spread * 0.5;  // Slight rear back
                } else if (t < 0.7) {
                    // Lunge forward and snap shut
                    const snapT = (t - 0.4) / 0.3;
                    spread = 0.8 - snapT * 1.0;  // Close past neutral
                    headZ = -0.4 + snapT * 3;  // Lunge forward
                } else {
                    // Return to neutral
                    const returnT = (t - 0.7) / 0.3;
                    spread = -0.2 + returnT * 0.2;  // Return from -0.2 to 0
                    headZ = 2.6 - returnT * 2.6;  // Return from 2.6 to 0
                }

                // Head movement
                if (this.bug.userData.head) {
                    this.bug.userData.head.position.z = (this.bug.userData.head.userData.baseZ || 0) + headZ;
                }

                // Mandibles spread/close
                if (weapon && weapon.userData.right && weapon.userData.left) {
                    weapon.userData.right.rotation.y = spread;
                    weapon.userData.left.rotation.y = -spread;
                }

                // Thorax follows head
                if (this.bug.userData.thorax) {
                    this.bug.userData.thorax.position.z = (this.bug.userData.thorax.userData.baseZ || 0) + headZ * 0.3;
                }
                break;
            }

            case 'fangs': {
                // SPIDER STRIKE - head tilts up then strikes down
                // Fangs are children of head, so they move automatically
                const t = phase / Math.PI;

                // Slow tilt up (0-50%), fast strike down (50-75%), return (75-100%)
                let tiltAmount = 0;
                if (t < 0.5) {
                    // Slow tilt up
                    tiltAmount = Math.sin(t / 0.5 * Math.PI / 2) * 1.0;
                } else if (t < 0.75) {
                    // Fast strike down
                    const strikeT = (t - 0.5) / 0.25;
                    tiltAmount = 1.0 - strikeT * 1.4;
                } else {
                    // Return to neutral
                    const returnT = (t - 0.75) / 0.25;
                    tiltAmount = -0.4 + returnT * 0.4;
                }

                // Rotate head - fangs follow automatically since they're attached
                const rotX = -tiltAmount * 0.5;

                if (this.bug.userData.head) {
                    this.bug.userData.head.rotation.x = (this.bug.userData.head.userData.baseRotX || 0) + rotX;
                }

                // Thorax tilts slightly with head
                if (this.bug.userData.thorax) {
                    this.bug.userData.thorax.rotation.x = (this.bug.userData.thorax.userData.baseRotX || 0) + rotX * 0.3;
                }
                break;
            }

            case 'stinger': {
                // SCORPION STRIKE - tail whips forward over body
                // Real scorpions: tail arches higher, then whips forward in a stabbing motion
                // Phase 1 (0-40%): Tail coils back/up (loading)
                // Phase 2 (40-70%): Explosive forward strike
                // Phase 3 (70-100%): Stab and pump venom

                const coilPhase = Math.min(phase / (Math.PI * 0.4), 1);
                const strikePhase = phase > Math.PI * 0.4 ? Math.min((phase - Math.PI * 0.4) / (Math.PI * 0.3), 1) : 0;
                const pumpPhase = phase > Math.PI * 0.7 ? (phase - Math.PI * 0.7) / (Math.PI * 0.3) : 0;

                if (weapon && weapon.userData.stinger) {
                    // Coil back (negative rotation = curls backward/up more)
                    const coil = Math.sin(coilPhase * Math.PI / 2) * 0.4;
                    // Strike forward (positive = drives forward)
                    const strike = Math.sin(strikePhase * Math.PI) * 0.7;
                    // Pumping motion during venom injection
                    const pump = Math.sin(pumpPhase * Math.PI * 6) * 0.08;

                    weapon.userData.stinger.rotation.x = -coil + strike + pump;
                    // Whole tail drives forward
                    weapon.userData.stinger.position.z = (weapon.userData.stinger.userData.baseZ || 0) + strike * 5;
                    weapon.userData.stinger.position.y = (weapon.userData.stinger.userData.baseY || 0) - coil * 2 + strikePhase * 1;
                }

                // Body braces - abdomen lifts to support tail strike
                if (this.bug.userData.abdomen) {
                    const lift = coilPhase * 0.2 - strikePhase * 0.1;
                    this.bug.userData.abdomen.rotation.x = lift;
                }

                // Pedipalps (if any) spread during strike for stability
                if (this.bug.userData.thorax) {
                    const brace = strikePhase * 0.1;
                    this.bug.userData.thorax.scale.set(1 + brace, 1, 1 - brace * 0.5);
                }
                break;
            }

            case 'pincers': {
                // SCORPION PINCER STRIKE - slow menacing open, FAST violent snap

                // Phase 0-60%: Slow, menacing open
                // Phase 60-75%: FAST violent snap shut
                // Phase 75-100%: Return to neutral

                const openPhase = Math.min(1, phase / (Math.PI * 0.6));
                const snapPhase = phase > Math.PI * 0.6 ? Math.min(1, (phase - Math.PI * 0.6) / (Math.PI * 0.15)) : 0;
                const returnPhase = phase > Math.PI * 0.75 ? (phase - Math.PI * 0.75) / (Math.PI * 0.25) : 0;

                // Slow open, holds at peak
                const openAmount = Math.sin(openPhase * Math.PI / 2) * 0.6;
                // Fast snap - goes slightly past closed then returns
                const snapAmount = snapPhase * 0.7;
                // Smooth return to neutral
                const returnAmount = returnPhase;

                // Final claw position: open - snap + return to neutral
                const clawPos = openAmount * (1 - snapPhase) - snapAmount * 0.1 * (1 - returnAmount);

                // Lunge happens with the snap
                const lunge = Math.sin(phase) * 2 + snapPhase * (1 - returnPhase) * 2;

                // Body lunges aggressively with snap
                if (this.bug.userData.thorax) {
                    this.bug.userData.thorax.position.z = (this.bug.userData.thorax.userData.baseZ || 0) + lunge;
                }

                if (this.bug.userData.head) {
                    this.bug.userData.head.position.z = (this.bug.userData.head.userData.baseZ || 0) + lunge * 0.6;
                }

                if (weapon && weapon.userData.right && weapon.userData.left) {
                    // Both pincers animate
                    for (const pincer of [weapon.userData.right, weapon.userData.left]) {
                        if (!pincer) continue;

                        // Upper claw rotates UP to open (negative X), snaps down
                        const upperClaw = pincer.userData.upperClaw;
                        if (upperClaw) {
                            upperClaw.rotation.x = (upperClaw.userData.baseRotX || 0) - clawPos;
                        }

                        // Lower claw rotates DOWN to open (positive X), snaps up
                        const lowerClaw = pincer.userData.lowerClaw;
                        if (lowerClaw) {
                            lowerClaw.rotation.x = (lowerClaw.userData.baseRotX || 0) + clawPos;
                        }
                    }
                }
                break;
            }

            case 'horn': {
                // RHINOCEROS BEETLE - slow rear up, fast thrust down, return to neutral
                // Horn attached to head - move together

                // t goes from 0 to 1 over the animation
                const t = phase / Math.PI;

                // Slow rear up (0-50%), fast thrust (50-75%), return (75-100%)
                let headMove = 0;
                let forwardDrive = 0;
                if (t < 0.5) {
                    // Slow rear up
                    headMove = Math.sin(t / 0.5 * Math.PI / 2) * 1.0;
                    forwardDrive = 0;
                } else if (t < 0.75) {
                    // Fast thrust down and forward
                    const thrustT = (t - 0.5) / 0.25;
                    headMove = 1.0 - thrustT * 1.5;  // Goes from 1 to -0.5
                    forwardDrive = thrustT * 4;  // Drive forward
                } else {
                    // Return to neutral
                    const returnT = (t - 0.75) / 0.25;
                    headMove = -0.5 + returnT * 0.5;  // Goes from -0.5 to 0
                    forwardDrive = 4 - returnT * 4;  // Return from 4 to 0
                }

                // Apply to head - negative rotation = look up
                const headRotX = -headMove * 0.4;
                const headPosY = headMove * 1.5;
                const headPosZ = forwardDrive;

                if (this.bug.userData.head) {
                    this.bug.userData.head.rotation.x = (this.bug.userData.head.userData.baseRotX || 0) + headRotX;
                    this.bug.userData.head.position.y = (this.bug.userData.head.userData.baseY || 0) + headPosY;
                    this.bug.userData.head.position.z = (this.bug.userData.head.userData.baseZ || 0) + headPosZ;
                }

                // Horn moves WITH head - same offsets
                if (weapon && weapon.userData.horn) {
                    const horn = weapon.userData.horn;
                    horn.rotation.x = (horn.userData.baseRotX || 0) + headRotX;
                    horn.position.y = (horn.userData.baseY || 0) + headPosY;
                    horn.position.z = (horn.userData.baseZ || 0) + headPosZ;
                }

                // Thorax drives forward
                if (this.bug.userData.thorax) {
                    this.bug.userData.thorax.position.z = (this.bug.userData.thorax.userData.baseZ || 0) + forwardDrive * 0.5;
                    this.bug.userData.thorax.rotation.x = (this.bug.userData.thorax.userData.baseRotX || 0) + headRotX * 0.3;
                }

                // Abdomen follows
                if (this.bug.userData.abdomen) {
                    this.bug.userData.abdomen.rotation.x = headRotX * 0.15;
                }
                break;
            }

            default: {
                // Generic attack
                const lunge = Math.sin(phase) * 3;
                if (this.bug.userData.head) {
                    this.bug.userData.head.position.z = (this.bug.userData.head.userData.baseZ || 0) + lunge * 0.5;
                }
            }
        }

        // Wings flare during attack if flying
        if (this.bug.userData.wings && this.isFlying) {
            const wings = this.bug.userData.wings;
            const flare = Math.sin(phase) * 0.4;
            if (wings.userData.right && wings.userData.baseRotation) {
                wings.userData.right.rotation.z = wings.userData.baseRotation.right.z + flare + 0.3;
            }
            if (wings.userData.left && wings.userData.baseRotation) {
                wings.userData.left.rotation.z = wings.userData.baseRotation.left.z - flare - 0.3;
            }
        }
    }

    animateHit() {
        const t = this.stateTime * 10;

        // Dramatic recoil with shake
        const recoil = Math.sin(t) * Math.exp(-t * 0.4) * 3;
        const shake = Math.sin(t * 20) * Math.exp(-t * 0.5) * 0.5;

        // Apply to body parts
        if (this.bug.userData.head) {
            this.bug.userData.head.rotation.z = shake;
        }

        // Squash on impact - more dramatic
        const impact = 1 + Math.sin(t) * Math.exp(-t * 0.4) * 0.3;
        if (this.bug.userData.thorax) {
            this.bug.userData.thorax.scale.set(impact, 1 / impact, 1);
        }
        if (this.bug.userData.abdomen) {
            this.bug.userData.abdomen.scale.set(1 / impact, impact * 0.9, 1);
        }

        // Wings droop when hit
        if (this.bug.userData.wings) {
            const wings = this.bug.userData.wings;
            const droop = Math.exp(-t * 0.3) * 0.3;
            if (wings.userData.right && wings.userData.baseRotation) {
                wings.userData.right.rotation.z = wings.userData.baseRotation.right.z - droop;
            }
            if (wings.userData.left && wings.userData.baseRotation) {
                wings.userData.left.rotation.z = wings.userData.baseRotation.left.z + droop;
            }
        }

        // Legs buckle
        if (this.bug.userData.legs) {
            const buckle = Math.exp(-t * 0.3) * 0.3;
            this.bug.userData.legs.children.forEach(leg => {
                if (leg.userData.segments && leg.userData.segments.length > 1) {
                    // Femur buckles inward
                    const femur = leg.userData.segments[1];
                    if (femur && femur.baseRotation) {
                        femur.pivot.rotation.x = femur.baseRotation.x + buckle;
                    }
                    // Tibia flexes
                    const tibia = leg.userData.segments[2];
                    if (tibia && tibia.baseRotation) {
                        tibia.pivot.rotation.x = tibia.baseRotation.x - buckle * 0.5;
                    }
                }
            });
        }
    }

    animateJump() {
        // For bug builder preview - simulate a jump cycle
        const cycleTime = 2.0;  // seconds for full jump cycle
        const phase = (this.stateTime % cycleTime) / cycleTime;

        // Simulate vertical velocity based on phase
        // 0-0.15: crouch (preparation)
        // 0.15-0.5: ascending
        // 0.5-0.85: descending
        // 0.85-1.0: landing recovery

        let simulatedVy = 0;
        let bodySquash = 1;
        let bodyY = 0;

        if (phase < 0.15) {
            // Crouch preparation - legs bend, body squashes
            const crouchT = phase / 0.15;
            bodySquash = 1 - crouchT * 0.2;
            simulatedVy = 0;  // No vertical movement yet
            // Legs coil for jump
            this.animateJumpLegs(crouchT, 'crouch');
        } else if (phase < 0.5) {
            // Ascending - legs extend, body stretches, moves up
            const ascendT = (phase - 0.15) / 0.35;
            bodySquash = 0.8 + ascendT * 0.3;
            bodyY = Math.sin(ascendT * Math.PI / 2) * 20;
            simulatedVy = -12 * (1 - ascendT);  // Negative = going up
            this.animateJumpLegs(ascendT, 'ascend');
        } else if (phase < 0.85) {
            // Descending - legs tuck, body normal, moves down
            const descendT = (phase - 0.5) / 0.35;
            bodySquash = 1.1 - descendT * 0.1;
            bodyY = 20 * Math.cos(descendT * Math.PI / 2);
            simulatedVy = 12 * descendT;  // Positive = falling
            this.animateJumpLegs(descendT, 'descend');
        } else {
            // Landing recovery - slight squash, back to normal
            const landT = (phase - 0.85) / 0.15;
            bodySquash = 1 - (1 - landT) * 0.15;
            bodyY = 0;
            simulatedVy = 0;
            this.animateJumpLegs(landT, 'land');
        }

        // Apply body position and scale
        this.bug.position.y = bodyY;
        if (this.bug.userData.thorax) {
            this.bug.userData.thorax.scale.y = bodySquash;
        }
        if (this.bug.userData.abdomen) {
            this.bug.userData.abdomen.scale.y = bodySquash;
        }
    }

    animateJumpLegs(t, phase) {
        if (!this.bug.userData.legs) return;

        this.bug.userData.legs.children.forEach((leg) => {
            if (leg.userData.segments && leg.userData.segments.length > 0) {
                const side = leg.userData.side === 'left' ? -1 : 1;
                const coxa = leg.userData.segments[0];
                const femur = leg.userData.segments[1];
                const tibia = leg.userData.segments[2];
                const tarsus = leg.userData.segments[3];

                switch (phase) {
                    case 'crouch':
                        // Coil up - bend all joints
                        if (coxa && coxa.baseRotation) {
                            coxa.pivot.rotation.x = coxa.baseRotation.x - t * 0.3;
                            coxa.pivot.rotation.z = coxa.baseRotation.z + side * t * 0.2;
                        }
                        if (femur && femur.baseRotation) {
                            femur.pivot.rotation.x = femur.baseRotation.x + t * 0.6;
                        }
                        if (tibia && tibia.baseRotation) {
                            tibia.pivot.rotation.x = tibia.baseRotation.x + t * 0.7;
                        }
                        if (tarsus && tarsus.baseRotation) {
                            tarsus.pivot.rotation.x = tarsus.baseRotation.x - t * 0.3;
                        }
                        break;

                    case 'ascend':
                        // Extend - push off and straighten
                        if (coxa && coxa.baseRotation) {
                            coxa.pivot.rotation.x = coxa.baseRotation.x - 0.3 + t * 0.7;  // Swing back
                            coxa.pivot.rotation.z = coxa.baseRotation.z + side * (0.2 - t * 0.4);  // Spread out
                        }
                        if (femur && femur.baseRotation) {
                            femur.pivot.rotation.x = femur.baseRotation.x + 0.6 - t * 1.0;  // Extend
                        }
                        if (tibia && tibia.baseRotation) {
                            tibia.pivot.rotation.x = tibia.baseRotation.x + 0.7 - t * 1.2;  // Extend
                        }
                        if (tarsus && tarsus.baseRotation) {
                            tarsus.pivot.rotation.x = tarsus.baseRotation.x - 0.3 + t * 0.5;  // Point down
                        }
                        break;

                    case 'descend':
                        // Tuck - prepare for landing
                        if (coxa && coxa.baseRotation) {
                            coxa.pivot.rotation.x = coxa.baseRotation.x + 0.4 - t * 0.5;
                            coxa.pivot.rotation.z = coxa.baseRotation.z - side * 0.2 + side * t * 0.3;
                        }
                        if (femur && femur.baseRotation) {
                            femur.pivot.rotation.x = femur.baseRotation.x - 0.4 + t * 0.5;
                        }
                        if (tibia && tibia.baseRotation) {
                            tibia.pivot.rotation.x = tibia.baseRotation.x - 0.5 + t * 0.6;
                        }
                        if (tarsus && tarsus.baseRotation) {
                            tarsus.pivot.rotation.x = tarsus.baseRotation.x + 0.2 - t * 0.4;
                        }
                        break;

                    case 'land':
                        // Return to base position
                        if (coxa && coxa.baseRotation) {
                            coxa.pivot.rotation.x = coxa.baseRotation.x - 0.1 * (1 - t);
                            coxa.pivot.rotation.z = coxa.baseRotation.z + side * 0.1 * (1 - t);
                        }
                        if (femur && femur.baseRotation) {
                            femur.pivot.rotation.x = femur.baseRotation.x + 0.1 * (1 - t);
                        }
                        if (tibia && tibia.baseRotation) {
                            tibia.pivot.rotation.x = tibia.baseRotation.x + 0.1 * (1 - t);
                        }
                        if (tarsus && tarsus.baseRotation) {
                            tarsus.pivot.rotation.x = tarsus.baseRotation.x - 0.2 * (1 - t);
                        }
                        break;
                }
            }
        });
    }

    animateDeath() {
        // Death animation phases:
        // Phase 0: FALLING - bug falls through air (if was airborne/on wall)
        // Phase 1: Stagger/wobble on ground
        // Phase 2: Fall to side
        // Phase 3: Roll onto back (upside down)
        // Phase 4: Settle with leg twitches

        // If bug is still falling (not grounded), just do falling animation
        // Don't override position - let simulation handle the fall
        if (!this.grounded) {
            // Reset to normal orientation (not wall-climbing) using quaternion
            // Smoothly transition from wall orientation to falling orientation
            const targetQuat = new THREE.Quaternion();  // Identity = normal orientation
            this.bug.quaternion.slerp(targetQuat, 0.1);

            // Legs tuck in while falling
            this.animateDeathLegs(0.2);

            // Slight tumble while falling
            const tumble = Math.sin(this.stateTime * 8) * 0.1;
            this.bug.rotation.x = tumble;
            this.bug.rotation.z = tumble * 0.5;

            // Track that we haven't landed yet - reset stateTime when we land
            this.deathLanded = false;
            return;
        }

        // Just landed - reset state time to start ground animation
        if (!this.deathLanded) {
            this.deathLanded = true;
            this.groundedDeathTime = 0;
        }
        this.groundedDeathTime += 0.016;  // Approximate deltaTime
        const time = this.groundedDeathTime;

        // Reset quaternion to use Euler rotations for ground animation
        this.bug.quaternion.set(0, 0, 0, 1);

        // Single smooth motion from upright to upside down over 0.6 seconds
        const deathDuration = 0.6;

        if (time < deathDuration) {
            // Smooth ease-out curve for the full rotation
            const t = time / deathDuration;
            const easeOut = 1 - Math.pow(1 - t, 3);  // Cubic ease-out for smooth deceleration

            // Rotate from 0 to PI (upside down) in one smooth motion
            this.bug.rotation.z = easeOut * Math.PI;

            // Slight wobble that fades out during the fall
            const wobble = Math.sin(time * 30) * (1 - t) * 0.08;
            this.bug.rotation.x = wobble;

            // Legs curl progressively
            this.animateDeathLegs(easeOut * 0.9);

        } else {
            // Settled upside down with occasional twitches
            this.bug.rotation.z = Math.PI;

            const twitch = Math.sin(time * 8) * Math.exp(-(time - deathDuration) * 3) * 0.08;
            this.animateDeathLegs(0.9, twitch);
        }

        // Wings droop throughout
        if (this.bug.userData.wings) {
            const wingDroop = Math.min(1, this.stateTime * 2);
            const wings = this.bug.userData.wings;
            if (wings.userData.right && wings.userData.baseRotation) {
                wings.userData.right.rotation.z = wings.userData.baseRotation.right.z - wingDroop * 0.6;
            }
            if (wings.userData.left && wings.userData.baseRotation) {
                wings.userData.left.rotation.z = wings.userData.baseRotation.left.z + wingDroop * 0.6;
            }
        }

        // Antenna droop
        if (this.bug.userData.antennae) {
            const droopT = Math.min(1, this.stateTime * 1.5);
            const antennae = this.bug.userData.antennae;
            if (antennae.userData.right) {
                antennae.userData.right.rotation.x = droopT * 0.6;
                antennae.userData.right.rotation.z = 0.3 - droopT * 0.5;
            }
            if (antennae.userData.left) {
                antennae.userData.left.rotation.x = droopT * 0.6;
                antennae.userData.left.rotation.z = -0.3 + droopT * 0.5;
            }
        }
    }

    animateDeathLegs(progress, twitch = 0) {
        if (!this.bug.userData.legs) return;

        this.bug.userData.legs.children.forEach(leg => {
            if (leg.userData.segments && leg.userData.segments.length > 0) {
                const side = leg.userData.side === 'left' ? -1 : 1;
                const legIndex = leg.userData.index || 0;

                // Stagger the curling per leg
                const legDelay = legIndex * 0.1;
                const legProgress = Math.max(0, Math.min(1, (progress - legDelay) / (1 - legDelay)));

                leg.userData.segments.forEach((seg, i) => {
                    if (seg && seg.baseRotation) {
                        // Curl inward and up (since bug will be upside down)
                        const curlAmount = legProgress * (0.4 + i * 0.15);
                        const spreadAmount = legProgress * 0.25;

                        seg.pivot.rotation.x = seg.baseRotation.x + curlAmount + twitch;
                        seg.pivot.rotation.z = seg.baseRotation.z + side * spreadAmount;
                    }
                });
            }
        });
    }

    animateVictory() {
        const t = this.time * 4;

        // Store base Y position on first frame of victory
        if (this.bug.userData.victoryBaseY === undefined) {
            this.bug.userData.victoryBaseY = this.bug.position.y;
        }

        // Bounce with energy - ADD to base position, don't replace it
        const bounce = Math.abs(Math.sin(t)) * 5;
        this.bug.position.y = this.bug.userData.victoryBaseY + bounce;

        // Body puff up with pride
        if (this.bug.userData.thorax) {
            this.bug.userData.thorax.scale.y = 1.1 + Math.sin(t * 2) * 0.05;
        }
        if (this.bug.userData.abdomen) {
            this.bug.userData.abdomen.scale.y = 1.1 + Math.sin(t * 2 + 1) * 0.05;
        }

        // Wing celebration flutter - fast and proud
        if (this.bug.userData.wings) {
            const wings = this.bug.userData.wings;
            const flutter = Math.sin(t * 15) * 0.6;
            if (wings.userData.right && wings.userData.baseRotation) {
                wings.userData.right.rotation.z = wings.userData.baseRotation.right.z + flutter + 0.3;
            }
            if (wings.userData.left && wings.userData.baseRotation) {
                wings.userData.left.rotation.z = wings.userData.baseRotation.left.z - flutter - 0.3;
            }
        }

        // Antenna celebration - waving proudly
        if (this.bug.userData.antennae) {
            const antennae = this.bug.userData.antennae;
            if (antennae.userData.right) {
                antennae.userData.right.rotation.z = 0.5 + Math.sin(t * 3) * 0.4;
                antennae.userData.right.rotation.x = Math.sin(t * 2) * 0.2;
            }
            if (antennae.userData.left) {
                antennae.userData.left.rotation.z = -0.5 + Math.sin(t * 3 + 1) * 0.4;
                antennae.userData.left.rotation.x = Math.sin(t * 2 + 0.5) * 0.2;
            }
        }

        // Legs do a little victory dance
        if (this.bug.userData.legs) {
            this.bug.userData.legs.children.forEach((leg, index) => {
                if (leg.userData.segments && leg.userData.segments.length > 0) {
                    const phase = leg.userData.phase || (index * 0.3);
                    const side = leg.userData.side === 'left' ? -1 : 1;

                    // All segments do a celebratory wave
                    leg.userData.segments.forEach((seg, i) => {
                        if (seg && seg.baseRotation) {
                            const segPhase = phase + i * 0.2;
                            seg.pivot.rotation.x = seg.baseRotation.x + Math.sin(t * 4 + segPhase) * 0.15;
                            seg.pivot.rotation.z = seg.baseRotation.z + side * Math.sin(t * 3 + segPhase) * 0.1;
                        }
                    });
                }
            });
        }
    }

    reset() {
        this.bug.position.set(0, 0, 0);
        this.bug.rotation.set(0, 0, 0);

        if (this.bug.userData.thorax) {
            this.bug.userData.thorax.scale.set(1, 1, 1);
        }
        if (this.bug.userData.abdomen) {
            this.bug.userData.abdomen.scale.set(1, 1, 1);
        }
    }
}

// Export
window.BugGenerator3D = BugGenerator3D;
window.BugAnimator = BugAnimator;
