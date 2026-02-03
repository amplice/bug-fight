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
**3D-only mode.** Core emergent combat system with full 3D rendering. Bugs fight in a true 3D arena with height, depth, and tactical positioning.

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

**Feint System:**
- Bugs sometimes telegraph a fake attack instead of committing
- High instinct + cautious = more feints; high fury = fewer feints
- Target reactions: dodge (wasted - creates opening), flinch (brief stun), or read (no reaction)
- High instinct targets read feints better (15-70% read chance based on instinct)
- Successful feints give the attacker a fast follow-up window
- Feint cooldown: 3-5 seconds between feints
- Creates emergent mind-games: feint → bait dodge → punish

**True 3D Combat:**
- Bugs fight in full 3D space with height (Y), width (X), and depth (Z)
- AI uses all three dimensions for tactical positioning
- Distance calculations and collision use full 3D vectors

**Mobility Tactics (3D-Enhanced):**
- **Flyers**:
  - Air-to-air dogfights with full 3D pursuit
  - Gain altitude advantage before diving
  - Dive attacks from above deal bonus damage (up to 50% based on height)
  - Banking/strafing maneuvers while pursuing
  - Figure-8 circling patterns in 3D space
  - Retreat upward and laterally when hurt
- **Wallcrawlers**:
  - Actively seek walls when exhausted/retreating
  - Climb to match opponent height
  - Wall-to-wall pounce attacks with Z-axis targeting
  - Use walls for stamina recovery
  - Visual wall-climbing rotation
- **Ground bugs**:
  - 3D flanking maneuvers (approach from side/behind in Z-axis)
  - Use full arena depth for tactical positioning
  - Jump attacks target opponents in all 3 dimensions

**Positioning (Instinct-based):**
- High instinct bugs think tactically about space
- Cut off opponent's escape routes toward arena center
- Avoid being trapped against walls
- Flank during circling instead of head-on approach
- Maintain optimal weapon range (back off if too close)

**Visual Legibility (3D Body Language):**
- **Velocity-based tilt**: Bugs bank into turns and pitch when climbing/diving
- **Wing speed**: Flying bugs' wing beat increases with speed
- **Motion trails**: Fast-moving bugs leave colored trails (orange=diving, blue=flying, red=aggressive)
- **Dive animation**: Nose-down pitch during dive attacks
- **Wall-climbing pose**: Bugs rotate to face wall when climbing
- **State indicator**: Small symbol below health bar shows AI state
  - → = aggressive (red)
  - ◯ = circling (yellow)
  - ← = retreating (blue)
  - ✕ = stunned (red)
- **Color tint**: Subtle aggression (red) / caution (blue) emissive tint

**Procedural Sound (Web Audio API):**
- All sounds generated procedurally - no audio files
- Hit impacts scale with damage (heavier hits = lower pitch, louder)
- Critical hits add sub-bass thump
- Dodge whooshes (bandpass sweep)
- Feint snap + descending tone on successful bait
- Wall impact thuds scale with velocity
- Fight start bell, victory chord, countdown beeps
- Continuous wing buzz for flying bugs (frequency tracks speed)
- Ambient low drone for atmosphere
- Mute toggle: M key or SOUND button

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
- **3D-specific emergent behaviors:**
  - Flyer vs flyer = aerial dogfights with altitude advantage battles
  - Flyer vs ground = dive bombing and evasive retreats
  - Ground vs ground = 3D flanking and cornering maneuvers
  - Wallcrawler ambushes = climb high, wait, pounce from above

## Architecture

### Current Stack
- **Language**: TypeScript (strict mode, zero-error build)
- **Frontend**: TypeScript (module: "none", script-tag loading), Three.js (3D), static HTML/CSS
- **Backend**: Bun (native HTTP + WebSocket via Bun.serve()), runs .ts directly
- **Database**: JSON files (roster.json)
- **Hosting**: Single VPS

### Target Stack (Near-term)
- **Frontend**: Vite (bundling/dev), TypeScript, Three.js
- **Backend**: Bun (native WebSocket, faster runtime)
- **Database**: SQLite + Prisma ORM
- **Hosting**: Single VPS

### Target Stack (Endgame)
- **Frontend**: Vite, vanilla JS (or minimal framework if breeding UI demands it)
- **Backend**: Bun
- **Database**: PostgreSQL or Turso (SQLite at edge) + Prisma
- **Hosting**: TBD based on scale needs

### Architecture Decisions
- **TypeScript**: Fully migrated. Strict mode with `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. Shared types in `shared/types.d.ts`.
- **User accounts**: Yes. Persistent balances, leaderboards. Potentially on-chain/crypto in future.
- **Frontend state**: Vanilla JS (just objects). No framework unless UI complexity demands it.
- **Scaling**: Single VPS until performance requires otherwise.
- **Testing**: Unit tests for critical simulation/genetics math. Ship fast otherwise.

### Provable Fairness

**Goal**: Prove fights aren't rigged. Users can verify the exact code from GitHub is running, and randomness can't be manipulated.

**Phase 1 - drand Integration (Near-term)**:
- Replace `Math.random()` with seeded PRNG
- Seed each fight with [drand](https://drand.love) randomness beacon
- Store `drandRound` with each fight result
- Anyone can replay fight: clone repo + same seed = same outcome
- Combat mechanics unchanged - just swap randomness source

```javascript
// Fetch drand beacon at fight start
const beacon = await fetch('https://api.drand.sh/public/latest').json();
const seed = beacon.randomness;  // Publicly verifiable
const round = beacon.round;      // Stored with fight result

// Seeded RNG replaces Math.random() throughout simulation
const rng = createSeededRNG(seed);
```

**Phase 2 - TEE Attestation (With real money)**:
- Run simulation in AWS Nitro Enclave (or Intel SGX)
- Enclave generates cryptographic attestation of exact code running
- Users verify attestation matches GitHub release hash
- Even server operator can't modify code or peek inside enclave
- RNG generated inside enclave - physically can't be manipulated

**Trust Model**:
- Phase 1: "If I cheated, you could catch me by replaying"
- Phase 2: "I physically cannot cheat - hardware enforces it"

**Why not ZK proofs?**
- Full ZK (zkSNARKs) would require rewriting simulation in circuit language
- Complex physics/AI simulation = massive circuit, minutes to prove
- Overkill when TEE achieves same trust with standard code
- Maybe revisit for on-chain betting pools where verification must happen in smart contract

### Files

**TypeScript Source:**
- `server/index.ts` - HTTP server, WebSocket handling → compiles to `server/dist/index.js`
- `server/simulation.ts` - Game engine, Fighter class, 3D combat AI
- `server/roster.ts` - Persistent bug roster management
- `server/BugGenome.ts` - Bug genetics and genome generation
- `src/client/client.ts` - WebSocket client, betting logic, UI updates → compiles to `public/js/client.js`
- `src/client/renderer3d.ts` - Three.js 3D rendering, camera controls, effects
- `src/client/bugGenerator3d.ts` - 3D bug mesh generation, BugAnimator class
- `src/client/soundEngine.ts` - Procedural Web Audio API sound engine
- `src/client/procedural.ts` - Client-side BugGenome class
- `src/client/rosterViewer.ts` - 3D roster viewer modal (Three.js)
- `src/client/app.ts` - Camera controls, sound toggle, debug overlay, init
- `src/client/globals.d.ts` - Client global type declarations (THREE, window APIs)
- `shared/types.d.ts` - Shared type definitions (GenomeData, FighterState, GameEvent, etc.)

**Config:**
- `tsconfig.json` - Base strict TypeScript config
- `tsconfig.server.json` - Server config (CommonJS, outDir: server/dist)
- `tsconfig.client.json` - Client config (module: "none", outDir: public/js)

**Other:**
- `public/index.html` - 3D arena and betting UI
- `public/js/*.js` - Compiled client output (gitignored, built from src/client/*.ts)
- `server/dist/*.js` - Compiled server output (gitignored, built from server/*.ts)

### Key Stats
- **Bulk** - HP, stamina pool
- **Speed** - Movement, stamina regen
- **Fury** - Damage, crit chance, aggression response curve
- **Instinct** - Dodge, tactical positioning, adaptation rate

### Weapons/Defense/Mobility
Keep these simple. They affect range and damage type, not complex behaviors.

### System Sync Rule
**The bug systems MUST stay in sync at all times:**
1. `server/BugGenome.ts` — server-side genome (source of truth for traits, randomization, breeding, naming)
2. `src/client/bugGenerator3d.ts` — 3D renderer that visually represents traits
3. `shared/types.d.ts` — Type definitions for all traits (WeaponType, DefenseType, etc.)

When adding, removing, or renaming any trait option (weapon, defense, mobility, wing type, leg style, leg count, head/thorax/abdomen type, eye style, antenna style, texture), **update all three files**. The server genome is the source of truth — the types and 3D renderer must match it exactly.

Note: `src/client/procedural.ts` is a thin constructor-only client-side BugGenome that receives genome data from the server. It has no trait lists or logic to sync.

## Implemented Features
- Persistent roster of 20 bugs with fight records (W-L)
- Pre-fight stats screen with pentagon charts
- Accurate odds calculation with 5% house edge
- American/European odds toggle
- Enhanced wallcrawler AI (wall seeking, wall jumps)
- Roster viewer modal

## Next Steps
1. Migrate to Bun (native WebSocket, faster runtime)
2. Migrate to SQLite + Prisma ORM (replace roster.json)
3. Migrate to Vite (bundling, dev server, HMR)
4. Add breeding system (winners pass on genomes)
5. Revisit variants as genetic traits, not cosmetic rarity
6. Integrate drand for provable randomness (replace Math.random with seeded RNG)
7. User accounts with persistent balances and leaderboards

## Running

The server runs in a **tmux session** called `bugfights` for persistence across Claude sessions.

**Build commands:**
- **Client build**: `npx tsc -p tsconfig.client.json` (compiles client TS to public/js/)
- **Typecheck**: `npx tsc -p tsconfig.server.json --noEmit && npx tsc -p tsconfig.client.json --noEmit`
- **Run server**: `npx bun run server/index.ts` (Bun runs .ts directly, no build step)

**Common commands:**
- **Start/Restart server**: `tmux kill-session -t bugfights 2>/dev/null; tmux new-session -d -s bugfights -c /home/play/bugfights "npx bun run server/index.ts"`
- **View logs**: `tmux attach -t bugfights` (detach with `Ctrl+B` then `D`)
- **Check status**: `tmux list-sessions`
- **Kill server**: `tmux kill-session -t bugfights`

**Debug fight action (see what's happening in fights):**
```bash
tmux capture-pane -t bugfights -p -S -100
```
This captures the last 100 lines of fight logs showing:
- Combat events (hits, dodges, misses) with damage and momentum
- AI state transitions (aggressive, circling, retreating, stunned)
- Periodic summaries every 10s with HP, attacks, hit rates
- Stalemate warnings at 10s/20s with detailed diagnosis
- Fight results with final stats

Use `-S -200` or higher for more history. Useful for diagnosing why bugs are behaving certain ways (both retreating, low stamina, flyer vs grounder mismatches, etc.)

When user says "restart the server", "kill the server", "start the server", etc. - they mean the tmux session.

**Manual run (without tmux):**
```bash
npm install
npx bun run server/index.ts
```

Then open http://localhost:8080

All viewers see the same 3D fights in real-time via WebSocket.

## Git Workflow
Commit and push after every significant change (new features, bug fixes, architecture changes). Don't let work pile up uncommitted.

## Version History

**Last 2D-only commit:** `bcd6826` - "Add knockback, wall stuns, and wall-aware AI"
- To restore 2D version: `git checkout bcd6826`
- This was the final stable 2D version before 3D conversion began

**Current version:** `v0.3.0-alpha` - Full 3D with shape-based bugs

### Coordinate System
Server and client use the same native 3D coordinate system (no mapping layer):
- **X**: -450 to 450 (left to right)
- **Y**: 0 to 400 (floor to ceiling, y-up)
- **Z**: -300 to 300 (back to front)
- **Gravity**: `vy -= gravity` (pulls Y down toward 0)
- **Jump**: positive `vy` (pushes Y up)
- **Floor**: `y <= floorLevel`, **Ceiling**: `y > ceilingLevel`
