# Bug Body Texture Implementation Plan

## Overview

Add 3 distinct body texture types as a new genome trait. Textures apply to main body parts (thorax, abdomen, head, legs, weapons) but NOT eyes, wings, or venom parts. Textures combine with existing color system and will be inheritable through breeding.

## Texture Types

| Texture | Inspiration | Visual Effect |
|---------|-------------|---------------|
| **smooth** | Ants, wasps | Clean, minimal surface detail - sleek and streamlined |
| **plated** | Beetles, roaches | Overlapping chitin segments - armored, layered look |
| **rough** | Weevils, bark beetles | Bumpy, tuberculate surface - rugged, weathered |

## Technical Approach

Use procedural normal maps generated via Canvas2D at runtime. Normal maps create the illusion of surface detail without adding geometry - high visual impact, low performance cost.

```javascript
// Normal map colors encode surface direction
// RGB(128, 128, 255) = flat surface pointing up
// Variations from this create bumps/indentations
```

## Implementation Steps

### Step 1: Add textureType to Genome

**server/BugGenome.js**
```javascript
// In generateRandomGenome() or constructor
this.textureType = ['smooth', 'plated', 'rough'][Math.floor(Math.random() * 3)];
```

**public/js/procedural.js**
```javascript
// Mirror the same property for client-side genome
this.textureType = data.textureType || 'smooth';
```

### Step 2: Create TextureGenerator Class

**public/js/bugGenerator3d.js** (add to top of file)

```javascript
class TextureGenerator {
    constructor(size = 256) {
        this.size = size;
    }

    generateSmooth() {
        // Very subtle noise, almost flat
        // Base normal color with minimal variation
    }

    generatePlated() {
        // Overlapping curved segments
        // Horizontal bands with slight overlap shadows
    }

    generateRough() {
        // Random bumps and pits
        // Noise-based displacement
    }

    generate(textureType) {
        switch (textureType) {
            case 'plated': return this.generatePlated();
            case 'rough': return this.generateRough();
            default: return this.generateSmooth();
        }
    }
}
```

### Step 3: Modify Material Creation

**public/js/bugGenerator3d.js**

Update `createChitinMaterial()` to accept and apply normal map:

```javascript
createChitinMaterial(colorKey, options = {}) {
    const color = this.colors[colorKey] || this.colors.primary;

    // Generate or retrieve cached normal map
    if (!this.normalMap) {
        const texGen = new TextureGenerator();
        this.normalMap = texGen.generate(this.genome.textureType);
    }

    return new THREE.MeshStandardMaterial({
        color: color,
        roughness: options.roughness || 0.5,
        metalness: options.metalness || 0.2,
        normalMap: this.normalMap,
        normalScale: new THREE.Vector2(0.5, 0.5),
    });
}
```

Parts that use chitin material (will get texture):
- Thorax
- Abdomen
- Head
- Legs
- Weapons (mandibles, horn, pincers, stinger tail, fangs base)

Parts that DON'T get texture (keep current materials):
- Eyes (eyeMat - red emissive)
- Wings (clearMat, veinMat, elytraMat)
- Venom parts (venomMat - green emissive)

### Step 4: Update Bug Builder UI

**public/bug-builder.html**

Add texture dropdown:
```html
<div class="part-category">
    <h3>Texture</h3>
    <div class="part-options" id="texture-options">
        <div class="part-option selected" data-value="smooth">Smooth</div>
        <div class="part-option" data-value="plated">Plated</div>
        <div class="part-option" data-value="rough">Rough</div>
    </div>
</div>
```

Update config and randomize function to include textureType.

## Files Changed

| File | Changes |
|------|---------|
| `server/BugGenome.js` | Add `textureType` property |
| `public/js/procedural.js` | Add `textureType` property |
| `public/js/bugGenerator3d.js` | Add `TextureGenerator` class, modify `createChitinMaterial()` |
| `public/bug-builder.html` | Add texture UI option |

## Normal Map Generation Details

### Smooth Texture
- Base: RGB(128, 128, 255) - flat
- Add very subtle Perlin noise (amplitude ~5)
- Result: Clean but not perfectly flat, organic feel

### Plated Texture
- Horizontal bands every ~32px
- Each band has curved top edge (lighter = raised)
- Slight shadow at bottom of each band (darker = indented)
- Creates overlapping armor plate effect

### Rough Texture
- Random circular bumps of varying sizes
- Perlin noise base layer
- Some pits (inverted bumps)
- Creates weathered, textured carapace

## Breeding Integration

When two bugs breed, `textureType` follows same inheritance rules as other traits:
- Random selection from parents, or
- Mutation chance to different texture

## Performance Notes

- Normal maps generated once per bug instance
- Texture size 256x256 is sufficient (small on screen)
- CanvasTexture is lightweight
- No shader changes needed - Three.js MeshStandardMaterial handles normal maps natively
