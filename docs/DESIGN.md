# Bug Fights - Design Document

## Core Philosophy

**What you see is what you get.** No hidden stats. A bug's appearance directly communicates its capabilities. Viewers who pay attention can learn to read bugs and make better predictions.

---

## Trait System

### Core Stats (1-100 each, 350 point budget out of 400 max)

| Stat | Visual Representation | Combat Effect |
|------|----------------------|---------------|
| **BULK** | Body size, mass, thickness | HP pool, base damage |
| **SPEED** | Leg length, streamlined body | Attack rate, base evasion |
| **FURY** | Weapon prominence, spiky features, aggressive posture | Crit chance, aggression level |
| **INSTINCT** | Antennae size, eye prominence, sensory hairs | Dodge timing, counter-attack chance, positioning AI |

The 350-point budget (out of 400 max) forces meaningful tradeoffs. A bug cannot excel at everything.

**Archetype Examples:**
- **Bruiser** (90/50/90/50): Big, slow, hits hard, predictable
- **Assassin** (40/95/70/75): Small, fast, deadly, reactive
- **Tank** (85/40/35/90): Large, slow, defensive, smart positioning
- **Berserker** (60/70/95/25): Medium, aggressive, crits often, reckless

---

### Weapon Type (1 of 4)

Visible as the primary attack appendage.

| Weapon | Visual | Effect |
|--------|--------|--------|
| **Mandibles** | Large crushing jaws | Bonus damage vs shelled enemies |
| **Stinger** | Pointed tail/abdomen spike | Piercing - ignores portion of damage reduction |
| **Fangs** | Prominent mouth fangs | Venom - deals damage over time |
| **Claws** | Sharp front leg hooks | Multistrike - chance for double hits |

---

### Defense Type (1 of 4)

Visible as body modification.

| Defense | Visual | Effect |
|---------|--------|--------|
| **Shell** | Hard plated exoskeleton | Flat damage reduction per hit |
| **Agility** | Sleek, minimal body | Evasion multiplier (synergizes with SPEED) |
| **Toxic** | Warning colors, glands | Damages attackers on contact |
| **Camouflage** | Muted colors, textured surface | First-strike advantage, ambush bonus |

---

### Mobility Type (1 of 3)

Visible as body structure and movement pattern.

| Mobility | Visual | Effect |
|----------|--------|--------|
| **Ground** | Standard legs | Normal movement |
| **Winged** | Wings on back | Flight - evasion bonus, quick repositioning |
| **Wallcrawler** | Splayed legs, grip-hooks | Uses arena walls, flanking attacks |

---

## Visual Design Principles

### 1. Silhouette Readability
Each bug should be identifiable by silhouette alone. Core stats affect overall shape:
- High BULK = wide, chunky silhouette
- High SPEED = elongated, streamlined silhouette
- High FURY = spiky, aggressive silhouette
- High INSTINCT = prominent sensory organs

### 2. Modular Construction
Bugs are assembled from parts:
- **Body** (shape determined by BULK/SPEED ratio)
- **Head** (size affected by INSTINCT)
- **Legs** (length determined by SPEED, style by Mobility)
- **Weapon** (type and size determined by Weapon Type + FURY)
- **Defense features** (determined by Defense Type)
- **Sensory organs** (size determined by INSTINCT)
- **Wings** (if Winged mobility)

### 3. Color as Lineage
Color is inherited and mutates slowly:
- **Hue** = Primary genetic line
- **Saturation** = Genetic diversity (inbred = desaturated, diverse = vibrant)
- **Value/Brightness** = Can indicate age or generation
- **Patterns** = Inherited markings that identify family lines

### 4. Animation Tells
Movement patterns reflect stats:
- High SPEED = quick, twitchy idle animation
- High FURY = aggressive posturing, weapon brandishing
- High INSTINCT = alert, scanning movements
- High BULK = slower, more deliberate movement

---

## Breeding System (Future)

### Inheritance
- Each stat inherited as weighted average of parents ± mutation
- Weapon/Defense/Mobility inherited from one parent (dominant) or rare hybrid
- Color blended with small hue drift

### Mutation
- Small random adjustments to stats (±1-5 points)
- Rare larger mutations (±10-20 points)
- Very rare type mutations (weapon/defense/mobility changes)

### Lineage Tracking
- Each bug has a family tree
- Successful fighters breed more often
- Popular lineages become visually recognizable

---

## Combat System

### Turn Order
Based on SPEED stat with randomness factor.

### Attack Resolution
1. Attacker initiates (based on FURY-influenced aggression)
2. Defender evasion check (SPEED + INSTINCT + Defense bonuses)
3. If hit: Calculate damage (BULK + FURY + Weapon effects)
4. Apply Defense reduction
5. Check for Weapon special effects (venom, multistrike, etc.)

### Win Condition
Reduce opponent HP to 0.

---

## Combination Count

- 4 stats with 350-point distribution = thousands of combinations
- 4 Weapon types × 4 Defense types × 3 Mobility types = 48 type combinations
- Color variations = infinite

**Total unique bugs: Effectively unlimited, but with recognizable patterns**

---

## Visual Style

**Target aesthetic:** Clean pixel art, high contrast, readable at small sizes.

Each bug rendered at 16×16 or 24×24 base resolution, scaled up 4× for display.

Prioritize:
1. Silhouette clarity
2. Color distinction
3. Animation fluidity
4. Consistent visual language
