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
- **Frontend**: Vanilla JS, Canvas API, static HTML/CSS
- **Backend**: Node.js + `ws` library
- **Database**: JSON files (roster.json)
- **Hosting**: Single VPS

### Target Stack (Near-term)
- **Frontend**: Vite (bundling/dev), vanilla JS, Canvas API
- **Backend**: Bun (native WebSocket, faster runtime)
- **Database**: SQLite + Prisma ORM
- **Hosting**: Single VPS

### Target Stack (Endgame)
- **Frontend**: Vite, vanilla JS (or minimal framework if breeding UI demands it)
- **Backend**: Bun
- **Database**: PostgreSQL or Turso (SQLite at edge) + Prisma
- **Hosting**: TBD based on scale needs

### Architecture Decisions
- **TypeScript**: Yes. Migrate sooner rather than later. Type safety helps with breeding/genetics complexity.
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
- `server/index.js` - HTTP server, WebSocket handling
- `server/simulation.js` - Game engine, Fighter class, 3D combat AI
- `server/roster.js` - Persistent bug roster management
- `server/BugGenome.js` - Bug genetics and genome generation
- `public/index.html` - 3D arena and betting UI
- `public/js/client.js` - WebSocket client, betting logic, UI updates
- `public/js/renderer3d.js` - Three.js 3D rendering, camera controls, effects
- `public/js/bugGenerator3d.js` - 3D bug mesh generation, BugAnimator class
- `public/js/soundEngine.js` - Procedural Web Audio API sound engine
- `public/js/procedural.js` - Client-side BugGenome for stats display

### Key Stats
- **Bulk** - HP, stamina pool
- **Speed** - Movement, stamina regen
- **Fury** - Damage, crit chance, aggression response curve
- **Instinct** - Dodge, tactical positioning, adaptation rate

### Weapons/Defense/Mobility
Keep these simple. They affect range and damage type, not complex behaviors.

### System Sync Rule
**The three bug systems MUST stay in sync at all times:**
1. `server/BugGenome.js` — defines what traits exist and can be generated/bred
2. `public/bug-builder.html` — UI dropdowns for manually building bugs
3. `public/js/bugGenerator3d.js` — 3D renderer that visually represents traits

When adding, removing, or renaming any trait option (weapon, defense, mobility, wing type, leg style, leg count, head/thorax/abdomen type, eye style, antenna style, texture), **update all three files**. The genome is the source of truth — the builder and renderer must match it exactly. No trait should exist in one system but not the others.

## Implemented Features
- Persistent roster of 20 bugs with fight records (W-L)
- Pre-fight stats screen with pentagon charts
- Accurate odds calculation with 5% house edge
- American/European odds toggle
- Enhanced wallcrawler AI (wall seeking, wall jumps)
- Roster viewer modal

## Next Steps
1. Add breeding system (winners pass on genomes)
2. Revisit variants as genetic traits, not cosmetic rarity
3. Migrate to Bun + Vite + SQLite/Prisma + TypeScript stack
4. Integrate drand for provable randomness (replace Math.random with seeded RNG)
5. User accounts with persistent balances and leaderboards

## Running

The server runs in a **tmux session** called `bugfights` for persistence across Claude sessions.

**Common commands:**
- **Start/Restart server**: `tmux kill-session -t bugfights 2>/dev/null; tmux new-session -d -s bugfights "cd /home/play/bugfights && node server/index.js"`
- **View logs**: `tmux attach -t bugfights` (detach with `Ctrl+B` then `D`)
- **Check status**: `tmux list-sessions`
- **Kill server**: `tmux kill-session -t bugfights`

**Debug fight action (see what's happening in fights):**
```bash
tmux capture-pane -t bugfights -p -S -100
```
This captures the last 100 lines of fight logs showing:
- Combat events (⚔️ hits, 💨 dodges, ❌ misses) with damage and momentum
- AI state transitions (🔥 aggressive, 🔄 circling, 🏃 retreating, 💫 stunned)
- Periodic summaries (📈) every 10s with HP, attacks, hit rates
- Stalemate warnings (⚠️ at 10s, 🚨 at 20s) with detailed diagnosis
- Fight results with final stats

Use `-S -200` or higher for more history. Useful for diagnosing why bugs are behaving certain ways (both retreating, low stamina, flyer vs grounder mismatches, etc.)

When user says "restart the server", "kill the server", "start the server", etc. - they mean the tmux session.

**Manual run (without tmux):**
```bash
npm install
npm start
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
