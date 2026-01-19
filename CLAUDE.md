# Bug Fights

## Core Philosophy
**Emergent complexity from simple rules.** Like Conway's Game of Life - depth arises from interaction of simple mechanics, not from designed complexity. No scripted drama. No forced spectacle. The system creates the drama organically.

Every feature must pass this test: "Does this add a simple rule that creates emergent behavior, or does it add complexity directly?"

## Vision
24/7 streaming bug fights. Procedurally generated insects with simple drives and behaviors that create legible, dramatic fights through emergence - not through particle effects or scripted finishing moves.

## Design Principles
1. **Simple rules, complex behavior** - Few mechanics, deep interactions
2. **Legibility** - Viewers should read the fight: see intentions, understand decisions
3. **Organic drama** - Momentum shifts emerge from the system, not from code
4. **No spectacle for spectacle's sake** - Effects serve clarity, not flash

## Current State
Core emergent combat system implemented. Stripped scripted spectacle in favor of behavior-driven fights.

### Implemented Systems

**Drive System:**
- Aggression (0-1) and caution (0-1) values that shift during combat
- Landing hits increases aggression (what works continues)
- Taking damage triggers response based on fury genome:
  - High fury bugs get MORE aggressive when hurt
  - Low fury bugs get MORE cautious when hurt
- Drives slowly drift back toward genome baseline
- Drives influence AI state transitions and movement speed

**Stamina System:**
- Pool size based on bulk (50-150)
- Regen rate based on speed (0.3-0.8 per tick)
- Actions cost stamina: attacks (8-18), jumps (5), abilities (25)
- Low stamina (<30%) forces caution, slows movement
- Faster regen when circling/retreating
- Visible as yellow/orange bar in HUD

**AI Behavior:**
- State machine: aggressive, circling, retreating, stunned
- Transitions driven by drives, not hardcoded probabilities
- High aggression = faster approach, quicker engagement
- High caution = wider circling, longer retreat

**Mobility Tactics:**
- **Flyers**: Maintain height advantage, dive attacks from above, retreat upward when hurt, circle above ground opponents
- **Wallcrawlers**: Actively seek walls when exhausted/retreating, climb to match opponent height, pounce attacks from wall, use walls for stamina recovery
- **Ground bugs**: Use tactical positioning based on instinct

**Positioning (Instinct-based):**
- High instinct bugs think tactically about space
- Cut off opponent's escape routes toward arena center
- Avoid being trapped against walls
- Flank during circling instead of head-on approach
- Maintain optimal weapon range (back off if too close)

**Visual Legibility (Body Language):**
- **Posture tilt**: Aggressive bugs lean forward, cautious bugs lean back
- **Exhaustion droop**: Low stamina bugs droop forward
- **Color tint**: High aggression = red tint, high caution = blue tint
- **State indicator**: Small symbol below health bar shows AI state
  - → = aggressive (red)
  - ◯ = circling (yellow)
  - ← = retreating (blue)
  - ✕ = stunned (red)

### Removed (Scripted/Forced Drama)
- Finishing moves system
- Rare variants system (revisit after breeding)
- Excessive particles (reduced to minimal)
- Screen shake spam (subtle only)
- Dramatic zoom/slow-motion on abilities

**What emerges:**
- Aggressive vs aggressive = bloody brawl, first to gas loses
- Cautious vs cautious = tense spacing, explosive exchanges
- Aggressive vs cautious = cat and mouse
- Momentum shifts when drives flip from damage
- Natural rhythm: engage → exhaust → circle → recover → re-engage

## Architecture

### Files
- `index.html` - Canvas and betting UI
- `js/game.js` - Game engine, Fighter class, combat
- `js/procedural.js` - BugGenome, sprite generation

### Key Stats
- **Bulk** - HP, stamina pool
- **Speed** - Movement, stamina regen
- **Fury** - Damage, aggression response curve
- **Instinct** - Dodge, crit, adaptation rate

### Weapons/Defense/Mobility
Keep these simple. They affect range and damage type, not complex behaviors.

## Next Steps
1. Tune drive/stamina/positioning values for optimal fight pacing
2. Add breeding system (winners pass on genomes)
3. Revisit variants as genetic traits, not cosmetic rarity
4. Add feints/baits (fake attacks to draw reactions)

## Running

**Server-Authoritative Mode (Production):**
```bash
npm install
npm start
```
Then open http://localhost:8080 (or http://142.93.44.112:8080)

All viewers see the same fights in real-time via WebSocket.

**Legacy Client-Only Mode:**
Open `index.html` directly in browser (each viewer sees different fights).

## Git Workflow
Commit and push after every significant change (new features, bug fixes, architecture changes). Don't let work pile up uncommitted.
