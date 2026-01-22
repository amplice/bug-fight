# Bug Fights 3D Conversion Roadmap

## Overview

Convert Bug Fights from 2D Canvas to 3D voxel-based rendering using Three.js while preserving all gameplay mechanics, adding Z-axis movement, and maintaining the emergent complexity philosophy.

## Technical Decisions

| Aspect | Decision |
|--------|----------|
| Renderer | Three.js (web-based) |
| Voxel Resolution | ~16 voxels per bug dimension |
| Camera | Orbit controls (user-controlled), presets as fallback |
| Arena | Cuboid (rectangular box) |
| Lighting | Bright terrarium aesthetic |
| Platform | Desktop-first |

## Movement Rules

| Bug Type | Movement |
|----------|----------|
| Ground | Floor only (X, Z axes) |
| Flying | Full 3D (X, Y, Z) |
| Wallcrawler | All 6 surfaces (floor, ceiling, 4 walls) |

---

## Phase 1: Three.js Foundation & Basic Arena

**Goal:** Replace Canvas renderer with Three.js, render empty arena, verify setup works.

### Tasks

1. **Create Three.js Scene Setup**
   - Create `public/js/renderer3d.js`
   - Initialize scene, camera, renderer
   - Set up OrbitControls for camera movement
   - Add camera position presets (front, side, top-down, isometric)
   - Handle window resize

2. **Build 3D Arena**
   - Cuboid arena with transparent/wireframe walls
   - Solid floor with terrain texture (voxel substrate)
   - Ceiling (transparent or wireframe)
   - Arena dimensions: 900 x 400 x 600 (W x H x D) - height for flying
   - Wall boundaries matching ARENA constants

3. **Lighting Setup**
   - Ambient light for base visibility
   - Directional light (sun) for shadows
   - Optional: point lights for atmosphere

4. **Camera Presets**
   - Key 1: Front view (current 2D-like)
   - Key 2: Side view
   - Key 3: Top-down
   - Key 4: Isometric
   - Mouse drag: Free orbit

5. **Integration**
   - Create `index3d.html` (keep original as fallback)
   - Wire up to existing client.js WebSocket
   - Verify state updates reach renderer

### Deliverables
- Empty 3D arena renders
- Camera controls work
- WebSocket connection intact

---

## Phase 2: Procedural 3D Voxel Bug Generation

**Goal:** Generate 3D voxel bugs from genome, matching current variety.

### Tasks

1. **Voxel Primitives**
   - Create voxel helper functions
   - `createVoxelSphere(cx, cy, cz, radius)` - returns voxel positions
   - `createVoxelEllipsoid(cx, cy, cz, rx, ry, rz)` - body segments
   - `createVoxelLine(start, end, thickness)` - legs, antennae
   - `createVoxelPlane(points, thickness)` - wings

2. **3D Bug Generator Class**
   - Create `public/js/bugGenerator3d.js`
   - Port `BugSpriteGenerator` logic to 3D
   - Input: BugGenome
   - Output: 3D voxel positions + colors

3. **Body Part Generation**
   ```
   Head:     Ellipsoid, size from genome
   Thorax:   Ellipsoid, connects head to abdomen
   Abdomen:  Larger ellipsoid, size from bulk
   Legs:     6 legs, style from genome (straight, curved, short)
   Wings:    If winged, thin planes on thorax (optional transparency)
   Antennae: Two voxel lines from head
   Weapon:   Mandibles/stinger/fangs/claws at head front
   ```

4. **Color System**
   - Port existing color palette logic
   - Primary color: body
   - Secondary color: accents (legs, markings)
   - Weapon color: mandibles/stinger
   - Eye color: small bright voxels

5. **Size Variation**
   - Use genome.getSizeMultiplier()
   - Scale all voxel positions
   - Maintain ~16 voxel base dimension

6. **Mesh Generation**
   - Convert voxel positions to Three.js InstancedMesh
   - One material per color (optimize draw calls)
   - Cache generated meshes by genome hash

### Deliverables
- Any genome produces a 3D voxel bug
- Same visual variety as 2D
- Bugs render in arena (static, no animation yet)

---

## Phase 3: Animation System

**Goal:** Animate bugs with idle, attack, hit, death, victory states.

### Tasks

1. **Animation Frame Structure**
   - Generate multiple voxel configurations per bug
   - Store as array of voxel position sets
   - `frames.idle[0-3]`, `frames.attack[0-3]`, etc.

2. **Idle Animation**
   - Subtle body bob (thorax moves slightly)
   - Antenna sway
   - Wing flutter (if winged)
   - Leg micro-movements

3. **Movement Animation**
   - Walking cycle for ground bugs (leg positions cycle)
   - Flying animation (wing flap, body tilt)
   - Wall climbing (legs grip surface)

4. **Attack Animation**
   - Lunge forward (whole body shifts)
   - Weapon-specific motion:
     - Mandibles: open/close snap
     - Stinger: thrust forward
     - Claws: swipe
     - Fangs: bite motion

5. **Hit Animation**
   - Recoil (shift backward)
   - Flash white (material swap)
   - Squash/stretch (scale distortion)

6. **Death Animation**
   - Fall over (rotation)
   - Fade out (opacity)
   - Legs curl (if time permits)

7. **Victory Animation**
   - Bounce up and down
   - Optional: wing spread for flyers

8. **Animation Blending**
   - Smooth transitions between states
   - Lerp voxel positions between frames
   - Match current animFrame/animTick system

### Deliverables
- Bugs animate through all states
- Smooth transitions
- Visual feedback matches 2D quality

---

## Phase 4: 3D Physics & Movement

**Goal:** Convert 2D physics to 3D, add Z-axis movement.

### Tasks

1. **Extend Physics Properties**
   ```javascript
   // Add to Fighter class
   this.z = initialZ;      // Depth position
   this.vz = 0;            // Depth velocity
   ```

2. **Update ARENA Constants**
   ```javascript
   const ARENA = {
       width: 900,
       height: 400,      // Vertical (Y in 3D)
       depth: 600,       // New Z dimension
       floorY: 0,
       ceilingY: 400,
       leftWall: 0,      // X min
       rightWall: 900,   // X max
       frontWall: 0,     // Z min
       backWall: 600,    // Z max
   };
   ```

3. **Ground Bug Movement**
   - Move on X-Z plane (floor)
   - Y only for jumping
   - Update AI to use X-Z for approach/circle/retreat

4. **Flying Bug Movement**
   - Full X, Y, Z movement
   - Gravity still applies (reduced)
   - Height advantage now includes depth positioning

5. **Wallcrawler Movement**
   - Can attach to any of 6 surfaces
   - Track which surface: floor, ceiling, wall-left, wall-right, wall-front, wall-back
   - Movement relative to surface normal
   - Transition between surfaces at edges

6. **3D Collision Detection**
   - Sphere-sphere collision (simpler than voxel-perfect)
   - Collision radius from spriteSize
   - Wall collisions on all 6 faces
   - Knockback now has Z component

7. **3D Distance Calculations**
   ```javascript
   const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
   ```

8. **Update AI for 3D**
   - Approach considers Z distance
   - Circling happens in 3D (orbit around opponent)
   - Flanking uses depth
   - Wall awareness includes front/back walls

### Deliverables
- Bugs move in 3D space
- Physics respects all boundaries
- AI navigates 3D arena

---

## Phase 5: Combat & Effects in 3D

**Goal:** Port all combat mechanics to 3D, add 3D visual effects.

### Tasks

1. **Attack Range in 3D**
   - Range is spherical, not circular
   - Calculate 3D distance for hit detection

2. **Knockback in 3D**
   - Direction vector includes Z
   - Bugs can be knocked toward/away from camera
   - Wall stuns on all 6 walls

3. **3D Particle System**
   - Blood particles (red cubes)
   - Dust particles
   - Spark particles (hits)
   - Wall impact particles
   - Poison clouds (green)

4. **Floating Damage Numbers**
   - Billboard sprites (always face camera)
   - Rise from impact point
   - Fade out

5. **Screen Shake**
   - Camera shake instead of canvas shake
   - Subtle camera offset on hits

6. **Health/Stamina Bars**
   - Option A: Billboard above each bug
   - Option B: Fixed HUD overlay (easier)
   - Start with Option B

7. **Blood Stains**
   - Decals on floor/walls
   - Persist during fight

### Deliverables
- Combat feels impactful in 3D
- Visual feedback is clear
- Effects don't tank performance

---

## Phase 6: UI & Polish

**Goal:** Port all UI elements, add 3D-specific polish.

### Tasks

1. **Pre-Fight Stats Screen**
   - Render as HTML overlay (keep current)
   - Or: 3D floating panels in arena
   - Pentagon charts stay 2D (overlay)

2. **Commentary**
   - HTML overlay (keep current approach)
   - Position at bottom of screen

3. **Betting Panel**
   - Keep as HTML
   - No changes needed

4. **Camera Controls UI**
   - Preset buttons (1-4)
   - Reset camera button
   - Optional: mouse sensitivity slider

5. **Minimap (Optional)**
   - Top-down view in corner
   - Shows bug positions
   - Helps when camera is zoomed in

6. **Terrarium Decorations**
   - 3D rocks (voxel clusters)
   - 3D plants (voxel stalks)
   - Substrate on floor (textured plane or scattered voxels)

7. **Performance Optimization**
   - Frustum culling (automatic in Three.js)
   - LOD for distant voxels (if needed)
   - Monitor FPS, adjust voxel count if needed

8. **Visual Polish**
   - Shadows (bugs cast shadows on floor)
   - Ambient occlusion (subtle)
   - Post-processing: subtle bloom for hits

### Deliverables
- Full feature parity with 2D
- Smooth 60fps
- Polished look

---

## Phase 7: Testing & Deployment

**Goal:** Ensure stability, deploy alongside 2D version.

### Tasks

1. **Testing**
   - Test all bug type combinations
   - Test all mobility types in 3D
   - Test camera controls
   - Test on different browsers
   - Performance profiling

2. **Fallback**
   - Keep 2D version accessible (`/classic` or toggle)
   - Detect WebGL support, fallback if missing

3. **Configuration**
   - Toggle between 2D and 3D in settings
   - Quality presets (low/medium/high voxel count)

4. **Documentation**
   - Update CLAUDE.md with 3D architecture
   - Document camera controls
   - Note performance characteristics

### Deliverables
- Stable 3D version
- 2D fallback works
- Documentation updated

---

## File Structure (New/Modified)

```
public/
  index3d.html              # New 3D entry point
  js/
    renderer3d.js           # New Three.js renderer
    bugGenerator3d.js       # New 3D voxel bug generator
    voxelUtils.js           # New voxel primitive helpers
    client.js               # Minor updates for 3D state
  css/
    style3d.css             # 3D-specific styles (overlay positioning)

server/
  simulation.js             # Add Z axis to physics
  BugGenome.js              # No changes (genome is abstract)
```

---

## Implementation Prompt

Use this prompt to have Claude implement all phases:

```
Implement the Bug Fights 3D conversion as specified in ROADMAP-3D.md. Work through each phase sequentially:

Phase 1: Three.js foundation and arena
Phase 2: Procedural 3D voxel bug generation
Phase 3: Animation system
Phase 4: 3D physics and movement
Phase 5: Combat and effects
Phase 6: UI and polish
Phase 7: Testing

For each phase:
1. Implement all tasks listed
2. Test that it works (restart server, verify in browser)
3. Commit the phase with a descriptive message
4. Move to the next phase

Do not stop or ask questions unless you encounter a blocking issue that requires my input. Work autonomously through all phases until complete. If you run into a problem, try to solve it yourself first. Only ask me if you've exhausted reasonable options.

Keep the 2D version working as a fallback throughout.

Start with Phase 1 now.
```

---

## Estimated Timeline

| Phase | Effort |
|-------|--------|
| Phase 1: Foundation | 1-2 hours |
| Phase 2: Bug Generation | 2-3 hours |
| Phase 3: Animation | 2-3 hours |
| Phase 4: 3D Physics | 2-3 hours |
| Phase 5: Combat/Effects | 1-2 hours |
| Phase 6: UI/Polish | 1-2 hours |
| Phase 7: Testing | 1 hour |
| **Total** | **10-16 hours** |

---

## Success Criteria

- [ ] 3D arena renders with proper boundaries
- [ ] Bugs generate procedurally with same variety as 2D
- [ ] All animation states work
- [ ] Ground, flying, and wallcrawler movement works in 3D
- [ ] Combat mechanics function correctly
- [ ] Visual effects are clear and performant
- [ ] UI is fully functional
- [ ] 60fps on reasonable hardware
- [ ] 2D fallback still works
