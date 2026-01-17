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
Core fighting works but is too flashy and not deep enough. Combat is effects-driven rather than behavior-driven.

### Needs Removal/Simplification
- Finishing moves (scripted, forced drama)
- Excessive particles (noise, not signal)
- Rare variants system (complexity without depth, revisit after breeding)
- Screen shake spam
- Dramatic zoom overuse

### Needs Implementation
**Emergent Combat System:**
- **Drives** - Simple 0-1 values (aggression, caution) that shift based on fight outcomes
- **Stamina** - Actions cost energy. Low stamina forces disengagement. Natural fight rhythm emerges.
- **Adaptation** - Weights shift based on what works. Bug "learns" during fight.
- **Genome influence** - Stats affect response curves, not scripted behaviors
  - Fury: get more aggressive when hurt vs more cautious
  - Instinct: how fast drives adapt
  - Bulk: stamina pool size
  - Speed: stamina regen rate

**What should emerge:**
- Aggressive vs aggressive = bloody brawl, first to gas loses
- Cautious vs cautious = tense spacing, explosive exchanges
- Aggressive vs cautious = cat and mouse
- Momentum shifts when drives flip
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
1. Strip finishing moves, excess particles, rare variants
2. Implement drive system (aggression/caution)
3. Add stamina with natural regen
4. Make drives shift based on combat outcomes
5. Tune until fights are legible and dramatic through emergence

## Running
Open `index.html` in browser. No build step.
