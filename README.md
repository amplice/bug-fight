# Bug Fights

A 24/7 streaming prediction market where genetically-evolving virtual bugs fight each other.

## Vision

Bugs have hidden genetic stats that determine combat ability. Their visual appearance contains learnable patterns that correlate with those stats. Expert viewers who watch many fights develop an "eye" for reading bugs - like horse racing, but with procedurally generated insects.

**Two levels of emergence:**
1. **Micro:** Individual fights are tense, visually compelling spectacles
2. **Macro:** Breeding creates generational drift - dominant traits emerge, lineages become recognizable, the meta evolves

## Current State

Prototype with:
- 12 hand-crafted 16x16 pixel bug sprites
- Combat system with 6 stats (PWR, SPD, ARM, VIT, FER, INS)
- 10 attributes (venomous, armored, winged, etc.)
- Particle effects, screen shake, blood stains
- Betting system with odds
- 24/7 continuous fights with countdown

## Roadmap

### Phase 1: Visual Excellence (Current)
- Procedural bug generation from modular parts
- Animation juice (hit pause, anticipation, squash/stretch)
- Arena atmosphere
- Fight choreography

### Phase 2: Genetics System
- Genome structure mapping genes to traits
- Inheritance and mutation
- Visual tells that correlate with hidden stats

### Phase 3: Synchronized Server
- WebSocket server for shared state
- All viewers see same fights
- Provably fair RNG

### Phase 4: Persistence
- User accounts and balances
- Bug lineage tracking
- Leaderboards

### Phase 5: Crypto
- Token for real wagering
- Wallet integration
- zkproofs for provably fair hidden stats

## Running Locally

```bash
cd bugfights
python3 -m http.server 8080
# Open http://localhost:8080
```

## Tech Stack

- Vanilla JS + Canvas (no frameworks)
- Future: Node.js + Socket.io for server
- Future: Solidity/Cairo for on-chain components
