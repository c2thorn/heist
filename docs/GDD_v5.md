# Project CLOCKWORK - Game Design Document v5.0

**Status:** Living Document  
**Last Updated:** 2026-01-07  
**Goal:** Tactical heist roguelike - *Ocean's Eleven* meets *Slay the Spire* meets *Darkest Dungeon*

---

## 1. Vision & Design Pillars

**Core Fantasy:** You are the Mastermind—assembling crews, managing resources, and executing heists in real-time.

| Pillar | Description |
|--------|-------------|
| **Meaningful Choices** | Every decision (crew, gear, path) has trade-offs |
| **Watchable Heists** | Execution should be engaging to observe |
| **Run Variety** | Each run feels different through randomness |
| **No Power Creep** | Meta-progression expands options, not raw power |

---

## 2. Core Game Loop

```
THE RUN
┌─────────────────────────────────────────────────────────────┐
│  DAY 1 ──▶ DAY 2 ──▶ DAY N ──▶ FINALE?                     │
│                                                             │
│  Each Day:                                                  │
│  1. SHOP - Hire crew, buy gear                              │
│  2. JOB BOARD - Select contract                             │
│  3. PLANNING - Scout intel, place arrangements, equip       │
│  4. EXECUTION - Real-time heist with crew AI                │
│  5. DEBRIEF - Loot, heat, crew status                       │
│                                                             │
│  Run Ends When:                                             │
│  - Heat ≥ 100% (BUSTED)                                     │
│  - Victory condition met                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Heist Map (Implemented ✅)

### 3.1 Tile Grid System
- **Resolution:** 2D grid, 1 tile ≈ 24 pixels
- **Tile Types:** FLOOR, WALL, DOOR, WINDOW, VENT
- **Tile Properties:** walkable, cover, transparent, zone assignment

### 3.2 Fog of War (Tri-State Visibility)
| State | Visual | Logic |
|-------|--------|-------|
| **HIDDEN** | Dark fog | Cannot see anything, cannot plan routes |
| **REVEALED** | Greyed architecture | See walls/doors, can plan routes |
| **VISIBLE** | Full color | See everything including guards |

### 3.3 Pathfinding
- A* via EasyStar.js
- Diagonal movement enabled
- Terrain weights for natural movement
- Dynamic recalculation when doors open

---

## 4. Units & Movement (Implemented ✅)

### 4.1 Unit Types
- **Crew:** Player-controlled, colored by role (Stealth=green, Tech=blue, Force=red)
- **Guards:** Enemy units with vision cones

### 4.2 Movement
- Smooth interpolation between tiles
- Tile reservation (no overlapping units)
- Auto-navigate to clicked destination

### 4.3 Vision Cones
- Raycasted field of view
- Detection meter (0-100%)
- Guards react when detection hits threshold

---

## 5. Command & AI System (Implemented ✅)

### 5.1 Task Types
| Task | Description |
|------|-------------|
| MOVE | Navigate to target tile |
| INTERACT | Use interactable (safe, computer, door) |
| WAIT | Hold position for duration |
| SIGNAL | Emit named signal for coordination |

### 5.2 Objective Queue
- Units have queued objectives (set in planning phase)
- TaskProcessor executes objectives in order
- Supports WAIT_FOR_TRIGGER dependencies

### 5.3 Radio Controller
| Stance | Effect |
|--------|--------|
| SILENT_RUNNING | Slower movement, harder to detect |
| GO_LOUD | Faster, but guards alerted |
| SCRAM | All units flee to exit |

---

## 6. Interactables (Implemented ✅)

### 6.1 Types
| Type | Effect |
|------|--------|
| **Safe** | Contains loot, requires time to crack |
| **Computer** | Hack for intel/access |
| **SecurityPanel** | Disable cameras/alarms |
| **Door (Locked)** | Requires unlock time (1.5s with codes, 10s without) |

### 6.2 Skill Checks
- 2d6 + stat modifier vs DC
- Displays progress bar during interaction

---

## 7. Planning Phase (Implemented ✅)

### 7.1 Intel System (SectorManager)
- Map divided into sectors (lobby, vault, security, etc.)
- Purchase intel with Intel resource to reveal sectors
- Some sectors revealed by default

### 7.2 Arrangements (ArrangementEngine)
| Type | Example |
|------|---------|
| **STATIC_MODIFIER** | Bribe guard, vault codes |
| **TRIGGERED_ABILITY** | Phone distraction, power cut |

Arrangements loaded from JSON, purchasable with Cash.

---

## 8. Economy & Resources

| Resource | Starting | Usage |
|----------|----------|-------|
| **Cash** | $1500 | Hire crew, buy gear, arrangements |
| **Intel** | 10 | Reveal map sectors |
| **Heat** | 0% | Accumulates on failures, 100% = bust |

### ThreatClock
- 4-zone escalation: CASUAL → ALERT → LOCKDOWN → SWAT
- Guards get modifiers per zone
- Timer advances based on events

---

## 9. Crew System

### 9.1 Current (Implemented ✅)
- 6 starting crew with fixed stats (Stealth, Tech, Force)
- Role determined by highest stat
- Role-based passive abilities
- 2 equipment slots per crew

### 9.2 Crew Roster
- Hire from daily shop pool
- Assign to Active Stack for heist
- Crew persist across days

---

## 10. Win/Lose Conditions

| Condition | Status |
|-----------|--------|
| **Win:** Cash ≥ Target | Current: $5000 (needs rebalancing) |
| **Win:** Extract crew + loot | HeistOutcomeEngine calculates tiers |
| **Lose:** Heat ≥ 100% | Implemented |
| **Lose:** All crew captured | HeistOutcomeEngine DISASTER tier |

---

## Technical Architecture

See `docs/ARCHITECTURE.md` for:
- File structure and purposes
- State management (GameManager)
- Entity rendering (EntityLayer)
- Data file locations

---

## Appendix: Reference Games

| Game | Inspiration |
|------|-------------|
| *Slay the Spire* | Run structure, map pathing |
| *Darkest Dungeon* | Party management, expedition pacing |
| *Into the Breach* | Puzzle-like planning |
| *Heat Signature* | Heist feel, gear variety |
| *Invisible Inc.* | Turn-based heist, alarm escalation |

---

*For unimplemented features and future work, see `docs/ROADMAP.md`*
