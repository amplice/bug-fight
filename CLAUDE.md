# Bug Fights

## Vision
A 24/7 streaming prediction market featuring procedurally generated insects fighting in a terrarium arena. Think "Fish Fight" meets gambling stream - endless autonomous entertainment where viewers bet on bug battles.

## Project Status: Playable Alpha
Core gameplay loop complete. Bugs fight, die, new bugs spawn. Rich visual effects and combat mechanics.

## Architecture

### Files
- `index.html` - Main page with canvas and betting UI
- `js/game.js` - Game engine (~4000 lines)
  - `Fighter` class - Bug instance with AI, physics, combat, abilities
  - `Particle` class - Visual effects system
  - Combat system with hits, crits, combos, finishing moves
  - Dynamic camera with zoom/shake/focus
  - Arena rendering (terrarium with plants, rocks, hazards)
- `js/procedural.js` - Bug generation (~1200 lines)
  - `BugGenome` class - Stats, body parts, colors, rarity
  - `BugSpriteGenerator` - Pixel art sprite creation
  - `BugFactory` - Creates bugs from genomes

### Key Systems
- **Stats**: Bulk (HP), Speed, Fury (damage), Instinct (dodge/crit)
- **Weapons**: Mandibles, Stinger, Fangs, Claws (each has unique behaviors)
- **Defense**: Shell, Toxic, Camouflage, Spikes
- **Mobility**: Ground, Winged, Wallcrawler
- **Special Abilities**: 12 unique charged moves based on loadout
- **Rarity System**: Common/Uncommon/Rare/Epic/Legendary variants
- **Combo System**: Chain hits for bonus damage
- **Finishing Moves**: Dramatic kill animations per weapon type

## Recently Completed
- Rare bug variants with visual effects (particles, glows, 14 variant types)
- Dynamic camera (zoom on action, shake on impacts, dramatic moments)
- Finishing moves (weapon-specific fatality animations)
- Special abilities system (charged moves per bug)
- Combo attack system with chain bonuses
- Arena hazards (puddles, thorns, hot spots, spore clouds)
- Fight statistics HUD
- Terrarium visual overhaul

## Next Priorities (Suggested)
1. **Sound System** - Combat sounds, ambient, music
2. **Breeding/Evolution** - Winners breed, create lineages
3. **Tournament Mode** - Bracket-style competitions
4. **Betting Improvements** - Odds calculation, streak bonuses
5. **Bug Persistence** - Save/load champion bugs
6. **Stream Overlay Mode** - OBS-friendly layout
7. **Chat Integration** - Twitch/YouTube chat commands for betting

## Design Principles
- **Autonomous**: Should run forever without intervention
- **Visually Exciting**: Every fight should have dramatic moments
- **Fair Randomness**: Skill matters but upsets happen
- **Readable**: Viewers should understand what's happening

## Running the Game
Just open `index.html` in a browser. No build step needed.

## Git Workflow
Commit frequently with descriptive messages. Push after completing features.
