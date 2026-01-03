# Project CLOCKWORK - Design Document v4.0

**Status:** Living Document  
**Last Updated:** 2026-01-02  
**Goal:** Transition from prototype to shareable demo, then to full roguelike experience.

---

## 1. Vision Statement

**Project CLOCKWORK** is a tactical heist roguelike where the player acts as the Mastermind—assembling crews, managing resources, and plotting routes through procedurally generated facilities. 

**Core Fantasy:** *Ocean's Eleven* meets *Slay the Spire* meets *Darkest Dungeon*.

**Design Pillars:**
1. **Meaningful Choices** - Every decision (crew, gear, path) should have trade-offs
2. **Watchable Heists** - Simulation should be engaging to observe, not instant
3. **Run Variety** - Each run should feel different through pool randomness
4. **No Power Creep Meta** - Meta-progression expands options, not raw power

---

## 2. Current State Summary

### What Works:
- Core loop: Contract → Plan → Execute → Result → Next Day
- Crew management with role-based passives
- Equipment slot system (Stash → Crew)
- Heat as tension mechanic
- Multi-layout map generation

### What Feels Incomplete:
| Problem | Symptom |
|---------|---------|
| Loop is too short | 5 days feels like a flash game, not a run |
| Pre-planning lacks depth | Pick crew → draw path → done |
| Heist isn't engaging to watch | Crew walks, dice roll, repeat |
| No crew investment | All crew feel interchangeable |
| No real resource tension | Cash/Intel don't create hard choices |
| Win condition is trivial | $5000 feels arbitrary |

---

## 3. Core Game Loop

```
┌─────────────────────────────────────────────────────────────┐
│                        THE RUN                              │
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │  DAY 1  │───▶│  DAY 2  │───▶│  DAY N  │───▶│ FINALE? │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                             │
│  Each Day:                                                  │
│  1. SHOP (Optional) - Hire crew, buy gear                   │
│  2. JOB BOARD - Select contract                             │
│  3. PLANNING - Scout, equip, path                           │
│  4. EXECUTION - Auto-resolve heist                          │
│  5. DEBRIEF - Loot, heat, crew status                       │
│                                                             │
│  Run Ends When:                                             │
│  - Heat ≥ 100% (FAIL - BUSTED)                              │
│  - Victory condition met (TBD)                              │
│  - Player chooses to retire (EARLY WIN?)                    │
└─────────────────────────────────────────────────────────────┘
```

### Minimum Viable Enforcement:
- **At least 1 crew** must be in Active Stack to Execute
- No upper limit enforced (design allows flexibility)

---

## 4. Crew System

### Current Implementation:
- 6 starting crew with fixed stats
- Role determined by highest stat
- 4 role-based passives
- 2 equipment slots per crew

### Crew Upgrade System [🔶 NEEDS DESIGN]

**Design Intent:**  
Crew should be upgradeable within a run, creating tension between:
- Keeping an early crew and investing in upgrades
- Using a new hire with better base stats

**Open Questions:**
- [ ] What is the upgrade currency? (XP? Cash? Intel? New resource?)
- [ ] What gets upgraded? (Stats? New abilities? Passive power?)
- [ ] How many upgrade tiers?
- [ ] Can upgrades be lost? (Injury system?)
- [ ] UI: Where does upgrade happen? (Shop? Post-heist?)

**Possible Directions:**
1. **XP-on-success model**: Crew gains XP when they "hero" a node, unlocks stat bumps
2. **Cash investment model**: Pay to train crew at Safehouse, permanent stat increase
3. **Gear fusion model**: Combine items into permanent crew upgrades
4. **Loyalty system**: Crew that survive many heists gain bonuses

---

## 5. Item & Gear System

### Current Implementation:
- PASSIVE items: Stat modifiers (+1 TECH, etc.)
- CONSUMABLE items: Tactical effects (EMP, Smoke Bomb)
- Global Stash with equip/unequip to crew slots

### Known Issues:
⚠️ **PASSIVE stat bonuses are NOT applied during simulation** (bug/incomplete)
⚠️ **CONSUMABLE effects are scaffolded but not triggered**

### Gear Depth [🔶 NEEDS DESIGN]

**Open Questions:**
- [ ] Should gear have rarity tiers?
- [ ] Can gear be upgraded or is it static?
- [ ] Should some gear be crew-locked (role requirements)?
- [ ] Are there "set bonuses" or synergies?

---

## 6. The Heist Simulation [🔴 MAJOR REDESIGN NEEDED]

**Current State:**  
Crew walks node-to-node, dice roll against stat, heat or success, repeat. Functional but not engaging.

**Design Goal:**  
Make the heist *interesting to watch*. Not instant, not player-controlled, but dramatic and surprising.

### What Makes Heists Fun to Watch?

**Brainstorm Directions:**
1. **Complications**: Random mid-heist events (guard patrol shift, alarm glitch)
2. **Crew banter**: Text/audio commentary during resolution
3. **Near-misses**: Visual feedback for close rolls
4. **Branching outcomes**: Partial successes, side opportunities
5. **Pacing variation**: Some nodes fast, some tense with buildup
6. **Dynamic camera**: Zooms, focus shifts, dramatic reveals

**Open Questions:**
- [ ] What makes a roll feel tense vs. flat?
- [ ] Should there be "critical" successes/failures with special effects?
- [ ] How do passives/items trigger visually?
- [ ] What's the role of sound/music in tension?
- [ ] Should the path ever change mid-heist? (Escape routes?)

---

## 7. Pre-Planning Depth [🔴 MAJOR REDESIGN NEEDED]

**Current State:**  
Player picks crew → draws path → Execute. Takes ~30 seconds.

**Design Goal:**  
Pre-planning should feel like solving a puzzle with imperfect information.

### Possible Depth Levers:

| Lever | Description |
|-------|-------------|
| **Intel economy** | Revealing nodes costs real resources, forces gambling |
| **Crew synergies** | Certain crew combos unlock bonuses |
| **Gear load-out puzzles** | Limited slots, right tool for right job |
| **Contract modifiers** | "No TECH crew allowed", "Heat starts at 20%" |
| **Path constraints** | Must visit objective X, avoid node Y |
| **Risk/reward nodes** | Optional side loot with high danger |
| **Time pressure** | Simulated clock affecting heat? |

**Open Questions:**
- [ ] How much intel is too much? Too little?
- [ ] Should some paths be "locked" until conditions met?
- [ ] Are there mutually exclusive objectives?
- [ ] What information is hidden vs. revealed?

---

## 8. Economy & Resources

### Current Resources:
| Resource | Starting | Usage |
|----------|----------|-------|
| Cash | $1500 | Hire crew, buy gear |
| Intel | 10 | Reveal hidden nodes |
| Heat | 0% | Accumulates on failures, 100% = bust |

### Resource Tension [🔶 NEEDS DESIGN]

**Problem:** Currently no hard choices. Cash is plentiful, Intel is rarely needed.

**Possible Fixes:**
1. **Tighter economy**: Lower payouts, higher costs
2. **Resource conversion**: Cash ↔ Intel ↔ Heat reduction
3. **Crew wages**: Daily upkeep costs
4. **Repair costs**: Fix injured crew
5. **Opportunity costs**: Better contracts cost entry fee

**Open Questions:**
- [ ] What should the core tension loop be?
- [ ] Is there a third resource we're missing?
- [ ] How does Heat interact with economy?

---

## 9. Victory & Run Length

### Current:
- Win: Cash ≥ $5000 (arbitrary, easy)
- Lose: Heat ≥ 100%
- Run length: ~5 days (too short)

### Target Run Feel:
- **20-40 minute runs** (satisfying session)
- **10-15 heists per run** (meaningful progression arc)
- **Clear escalation** (early heists easy, late heists hard)
- **Finale moment** (Grand Heist? Boss contract?)

**Open Questions:**
- [ ] What's the real victory condition? (Total loot? Specific objective?)
- [ ] Is there a point of no return / "go for the big score" moment?
- [ ] Should runs have fixed length or player-controlled retirement?
- [ ] How does difficulty scale? (Day-based? Loot-based? Heat history?)

---

## 10. Meta-Progression

### Design Philosophy:
> Meta-progression should expand the **pool of options**, not make the player **stronger by default**. Each run resets completely.

### Meta Unlocks [🔶 NEEDS DESIGN]

**Pool Expansion Ideas:**
- New crew archetypes in hire pool
- New gear types in shop pool
- New contract layouts
- New node types / hazards
- Cosmetic variations

**Permanent Feature Unlocks (Maybe):**
- Tutorial skip
- Starting loadout presets
- Run history / stats tracking
- Challenge modifiers (hard mode variants)

**Open Questions:**
- [ ] What triggers unlocks? (Total runs? Achievements? Loot milestones?)
- [ ] How many unlockable items per category?
- [ ] Is there a "completion percentage" visible?

---

## 11. Immediate Technical Priorities

These should be fixed before adding new features:

| Priority | Task |
|----------|------|
| 🔴 High | Apply equipped PASSIVE item stat bonuses in simulation |
| 🔴 High | Implement CONSUMABLE item effects (EMP, Breach, Smoke) |
| 🔴 High | Enforce at least 1 crew in Active Stack to Execute |
| 🟡 Medium | Complete Intel scouting UI (reveal hidden nodes) |
| 🟡 Medium | Apply Heat decay between days |
| 🟡 Medium | Balance economy (tighter cash flow) |
| 🟢 Low | Add speed toggle for simulation (1x/2x) |
| 🟢 Low | Scaffold audio system |

---

## 12. Future Deep-Dive Sessions Needed

These topics require dedicated design sessions before implementation:

1. **🔴 Heist Simulation Redesign**  
   How to make watching the heist engaging and dramatic

2. **🔴 Pre-Planning Depth**  
   Adding meaningful decisions before Execute

3. **🔶 Crew Upgrade System**  
   Progression within a run, investment vs. new hires

4. **🔶 Economy Rebalance**  
   Creating real resource tension and trade-offs

5. **🔶 Run Structure**  
   Length, victory conditions, difficulty curve

6. **🟡 Meta-Progression System**  
   Pool expansion, unlockables, persistence

---

## Appendix A: Reference Games

| Game | What to Learn |
|------|---------------|
| *Slay the Spire* | Run structure, map pathing, deck/pool management |
| *Darkest Dungeon* | Party management, stress/risk, expedition pacing |
| *Into the Breach* | Telegraph-based strategy, puzzle-like planning |
| *Heat Signature* | Heist feel, pause-plan-execute, gear variety |
| *Monaco* | Heist chaos, role synergies, real-time tension |
| *Invisible Inc.* | Turn-based heist, information management, alarm escalation |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **The Stack** | The group of active crew moving as one unit |
| **Heat** | Global tension meter, 100% = run failure |
| **Node** | A room/obstacle on the heist map |
| **Path** | Player-defined route through nodes |
| **Passive** | Always-on crew ability based on role |
| **Pool** | The randomized set of options (crew, gear, contracts) |
| **Meta** | Persistent progression across runs |

---

*This document will be updated as design sessions resolve open questions.*
