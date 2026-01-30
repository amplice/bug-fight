# Breeding System Design

## Core Concept

Winners pass on genomes. Simple selection rules create complex dynamics over time. No scripted drama — just natural selection producing emergent meta shifts, dynasty narratives, and viewer knowledge asymmetry.

Stats are NOT publicly visible. Viewers infer stats from appearance and behavior. Knowledge = betting edge.

---

## Seasons

A **season** = 50 fights (~2-3 hours). During a season, all 20 bugs fight and accumulate W-L records. At season end: breeding happens.

```
Season N: 50 fights → Breeding Event → Season N+1: 50 fights → ...
```

### End of Season: Natural Selection

Rank all 20 bugs by win rate (minimum 3 fights to qualify).

- **Top 4** = "champions" — they breed AND survive to next season
- **Middle 12** = survivors — carry over unchanged (records reset)
- **Bottom 4** = retired — removed from active roster, archived for lineage history

### Breeding Pairs

- #1 × #3 → 1 offspring
- #2 × #4 → 1 offspring
- #1 × #4 → 1 offspring (cross-pollination)

Top bugs get two breeding opportunities. Cross-pairing (not #1×#2) prevents convergence from breeding the two most similar winners.

### Roster Replacement

Of the 4 freed slots:
- **3 bred offspring** (from the pairings above)
- **1 wild card** (completely random new genome)

The wild card injects genetic diversity every season. If the meta needs something the current gene pool doesn't have, wild cards can supply it.

---

## Genetics

### Stat Inheritance
- Average of parents + random mutation (±10)
- Total clamped to 350 stat cap
- Offspring are near parents but not clones

### Trait Inheritance
- 50/50 coin flip per trait from either parent
- **5% trait mutation chance** per trait — offspring gets a random trait instead of either parent's
- Prevents trait lock-in (entire roster converging on mandibles+shell+winged)

### Color Inheritance
- Hue: averaged with circular interpolation
- Saturation/lightness: simple average
- Creates visual family resemblance

### Wing Type
- Inherits from whichever parent has wings
- If neither parent has wings, no wings (or random if mobility mutates to winged)

---

## Lineage Tracking

### Bug Data Model Additions

```
{
  generation: 0,          // 0 = original/wild, 1+ = bred
  parents: null,          // [parentId1, parentId2] or null
  dynasty: "Toxic Scout", // family surname
  season: null,           // which season they were bred in
  seasonWins: 0,          // reset each season
  seasonLosses: 0,        // reset each season
  retiredAt: null,        // ISO timestamp if retired
  retiredSeason: null     // which season retired
}
```

### Dynasty Names
- First-time breeder's name becomes a dynasty
- Offspring: "Toxic Scout II", "Toxic Scout III", etc.
- If both parents have dynasties, higher-ranked parent's dynasty wins
- Wild cards start new dynasties

### Retired Bug Archive
- Retired bugs move to a separate archive (not deleted)
- Lineage history preserved permanently
- Viewers can trace family trees back through seasons

---

## Visual Stat Literacy

Stats are hidden. Viewers infer stats from three tiers of visual information, each requiring more investment to read.

### Tier 1: Direct Scaling (Strong Tells)

Continuous visual properties that scale directly with stat values. Always present, always honest, but require calibration across many bugs.

**BULK → Body Mass**
- Overall size (amplify current 0.6x-1.5x range to be unmistakable)
- Leg thickness (thicker on bulky bugs, spindly on light ones)
- Thorax/abdomen volume (fatter, not just uniformly scaled)
- Exoskeleton thickness (visible armor ridges)

**SPEED → Limb Proportions**
- Leg length relative to body (longer = faster)
- Leg thinness (wiry, athletic limbs)
- Body elongation (streamlined thorax)
- Wing beat speed for flyers (more pronounced)

**FURY → Weapon & Aggression Markers**
- Weapon size (strengthen existing scaling)
- Color saturation and warmth (higher fury = more vivid, warmer within base palette)
- Body geometry angularity (sharper points, jagged edges)
- Subtle permanent warm emissive tint at rest

**INSTINCT → Sensory Organs**
- Eye size and prominence (larger, more complex)
- Antenna length and complexity (longer, more elaborate)
- Head size relative to body (subtle)
- Slight iridescent sheen on high-instinct bugs

### Tier 2: Trait Probability Weighting (Soft Tells)

Stats **bias** which traits get selected during genome generation. Not deterministic — a 30-50% chance vs 20% baseline. Creates learnable patterns with built-in noise.

**High Bulk biases toward:**
- Thorax: wide, humped
- Abdomen: bulbous, plated
- Texture: plated, rough
- Leg style: beetle, centipede

**High Speed biases toward:**
- Thorax: elongated, compact
- Abdomen: pointed, oval
- Texture: smooth
- Leg style: grasshopper, stick, mantis
- Head: elongated

**High Fury biases toward:**
- Head: triangular, square
- Abdomen: pointed, segmented
- Antenna: horned, none
- Texture: rough, spotted
- Eye: simple, sunken

**High Instinct biases toward:**
- Head: shield, triangular
- Eye: compound, stalked, multiple
- Antenna: whip, segmented
- Texture: smooth
- Leg style: spider, mantis

### Tier 3: Behavioral Tells (Combat-Only, Ground Truth)

100% reliable because they're direct stat expressions. Require watching fights.

- **Bulk**: takes hits without flinching, heavier knockback on opponents, slow movement
- **Speed**: closes distance fast, stamina recovers quickly, high jumps, quick state switches
- **Fury**: attacks frequently, high damage per hit, frequent crits, gets MORE aggressive when hurt, rarely feints
- **Instinct**: high dodge rate, reads feints, smart positioning, flanks, adapts mid-fight

### Cosmetic Noise (Non-Predictive)

These DON'T predict stats — they prevent the visual language from becoming a lookup table:
- Leg count (4, 6, 8)
- Base color hue
- Accent hue
- Wing type (fly, beetle, dragonfly) within winged class

### How Breeding Creates Misleading Appearances

Offspring inherit traits 50/50 from parents and stats independently (averaged + mutation). This means a bug can inherit parent A's body shape but parent B's stat distribution.

Example: Parent A is high-bulk (big, plated). Parent B is high-speed (lean, smooth). Offspring inherits A's plated texture and wide thorax but B's speed stats. It LOOKS like a tank but fights like a speedster.

The viewer who tracked the breeding pair predicts this. The casual viewer gets fooled. This is the core betting asymmetry.

---

## UI Changes

### Remove
- Pentagon stat charts (pre-fight)
- Numeric stat displays
- Any explicit stat readout

### Show Instead
- Bug name
- Fight record (W-L, career and season)
- Dynasty/generation badge
- Visual appearance (the bug itself IS the information)

### Optional Future: Scouting Report

Vague natural-language descriptors instead of numbers:

| Range | Bulk | Speed | Fury | Instinct |
|-------|------|-------|------|----------|
| 10-25 | frail | sluggish | docile | dull |
| 26-45 | lean | steady | firm | alert |
| 46-65 | solid | quick | fierce | sharp |
| 66-85 | powerful | fast | savage | keen |
| 86-100 | massive | blazing | berserker | prescient |

These are intentionally imprecise — "solid" could be 46 or 65.

---

## Integration with Betting

- Odds still calculated server-side from actual stats (house always knows truth)
- Displayed odds become the ONLY numeric strength hint
- Information hierarchy: odds + appearance + fight history + lineage knowledge
- Casual viewer: bets on size/vibes
- Regular viewer: reads Tier 1-2 visual tells
- Dedicated viewer: combines all tiers + breeding knowledge for edge

---

## Season Breeding Event (Viewer Experience)

After fight 50, instead of immediately starting fight 51:
- **30-60 second breeding phase** between seasons
- UI shows: who retired, who bred, offspring reveal
- The "halftime show" — anticipation before the new meta

---

## Balance Knobs

| Knob | Starting Value | Controls |
|------|---------------|---------|
| Fights per season | 50 | Time before roster changes |
| Breed count | 3 | Offspring per season |
| Wild card count | 1 | Random new bugs per season |
| Stat mutation range | ±10 | How different offspring are |
| Trait mutation chance | 5% | Trait deviation from parents |
| Min fights to qualify | 3 | Prevents ranking under-tested bugs |
| Retire count | 4 | Turnover rate |
| Tier 2 bias strength | 30-50% | How reliably traits predict stats |

---

## What Emerges

- **Dynasties rise and fall** — dominant lineages get countered by builds that exploit their weaknesses
- **Meta cycles** — fury era → instinct counter-era → speed era → bulk era
- **Upsets** — wild card with weird stats beats a bred champion
- **Misleading offspring** — looks like one parent, fights like the other
- **Knowledge asymmetry** — dedicated viewers read bugs like a language, casuals bet on vibes
- **Convergence vs diversity** — breeding pulls toward optimal, wild cards and mutation push toward diverse

---

## Future Phases

### Phase 2: User Accounts
- Users vote on breeding pairs during breeding phase
- Majority determines pairings
- User agency without breaking emergence

### Phase 3: Bug Ownership
- Users buy/claim roster bugs
- Owners of winners earn house edge cut
- Owners choose breeding partners
- Offspring tradeable
- "Stud fees" for champion breeding rights

### Phase 4: On-Chain
- Genomes as NFTs
- Breeding costs token
- Provably fair via drand + TEE
- Smart contract determines offspring ownership

---

## Provable Fairness

When drand integration happens:
- Breeding pair selection: deterministic from season rankings (no RNG needed)
- Stat inheritance mutation: seeded from drand beacon
- Trait inheritance flips: seeded from drand beacon
- Wild card genome: fully seeded
- Anyone can verify: given season results + drand beacon → only one possible set of offspring
