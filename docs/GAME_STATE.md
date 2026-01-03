# Project CLOCKWORK - Game State Document

**Generated:** 2026-01-02  
**Purpose:** Capture the current implementation state for session handoff.

---

## 1. Project Overview

**Genre:** Heist Planning & Simulation  
**Tech Stack:** Vite + Vanilla JavaScript, HTML, CSS  
**Rendering:** HTML/CSS for UI, Phaser 3 scaffolded (deprecated in favor of HTML-based MapRenderer)

### Directory Structure
```
heist/
├── index.html          # Main HTML shell
├── src/
│   ├── main.js         # Electron entry (unused in browser dev)
│   ├── renderer.js     # Primary UI orchestration
│   ├── data/
│   │   └── CrewLibrary.js    # Starting roster definitions
│   ├── game/
│   │   ├── GameConfig.js     # Global constants
│   │   ├── GameManager.js    # State singleton
│   │   ├── MapGenerator.js   # Level generation
│   │   ├── ContractGenerator.js  # Daily contracts
│   │   ├── CrewGenerator.js  # Recruit generation
│   │   ├── ItemSystem.js     # Item definitions & effects
│   │   └── SimulationEngine.js   # Heist execution
│   ├── ui/
│   │   ├── CommandCenterUI.js    # Bottom crew panel
│   │   ├── ShopManager.js        # Safehouse UI
│   │   ├── JobBoardUI.js         # Contract selection
│   │   └── map/
│   │       └── MapRenderer.js    # HTML-based node map
│   └── styles/
│       ├── core.css, hud.css, command-deck.css
│       ├── shop.css, map.css, job-board.css, aar.css
```

---

## 2. Core Game Loop

### Phases
1. **CONTRACT SELECTION** - Pick from 3 daily contracts on Job Board
2. **PLANNING** - Scout nodes, build path, equip crew
3. **EXECUTION** - Automated simulation resolves path
4. **DEBRIEF** - View results, proceed to next day or shop

### Day Progression
- Game starts at Day 1 with no map (forces Job Board)
- After heist, `startNextDay()` increments day and refreshes shop
- Shop generates 3 recruits + 3 items daily

### Win/Loss Conditions
| Condition | Trigger | Result |
|-----------|---------|--------|
| Victory | Cash ≥ $5,000 | Win screen |
| Failure | Heat ≥ 100% | Bust/Game Over |

---

## 3. Game State Schema

All state lives in `GameManager.gameState`:

```javascript
{
  meta: {
    runId: string,          // UUID per run
    currentDay: number,     // 1-indexed
    cash: number,           // Starting: 1500
    intel: number,          // Starting: 10
    difficultyModifier: number,  // Increases each day
    activeContract: object | null
  },
  resources: {
    heat: number,           // 0-100, Initial: 0
    maxHeat: number,        // 100
    heatDecay: number       // 10 (unused currently)
  },
  flags: {
    vaultCracked: boolean,
    alarmTriggered: boolean,
    isGameOver: boolean,
    isVictory: boolean
  },
  simulation: {
    status: string,         // "SELECTING_CONTRACT" | "PLANNING" | "RUNNING"
    plannedPath: string[],  // Node IDs in order
    currentNodeIndex: number,
    log: array,
    runHistory: array       // For AAR
  },
  crew: {
    activeStack: array,     // Up to 4 selected for heist
    roster: array,          // All crew (starts with 6, capped at 12)
    limit: 12
  },
  inventory: array,         // Purchased items (instanceId unique)
  shop: {
    hires: array,           // 3 daily recruits
    items: array            // 3 daily items
  },
  map: object | null        // Current level data
}
```

---

## 4. Crew System

### Starting Roster (6 Members)
| ID | Name | Role | Force | Tech | Stealth | Face |
|----|------|------|-------|------|---------|------|
| char_brick | The Brick | MUSCLE | 9 | 1 | 2 | 3 |
| char_zero | Zero | HACKER | 1 | 9 | 4 | 2 |
| char_ghost | Ghost | INFILTRATOR | 2 | 3 | 9 | 1 |
| char_face | The Face | DRIP | 1 | 2 | 3 | 9 |
| char_jack | Jack-of-all | GENERALIST | 5 | 5 | 5 | 5 |
| char_shadow | Shadow | SCOUT | 3 | 6 | 6 | 3 |

### Crew Data Schema
```javascript
{
  id: string,
  name: string,
  role: string,                   // Display label (MUSCLE, HACKER, etc.)
  stats: { force, tech, stealth, face },
  equipment: [null, null]         // 2 slots for items
}
```

### Role Determination (Runtime)
Role is dynamically calculated from highest stat:
- Force → MUSCLE
- Tech → HACKER  
- Stealth → STEALTH
- Face → FACE

### Passive Abilities
| Role | Ability | Effect |
|------|---------|--------|
| MUSCLE | Second Wind | 50% re-roll on Force failures |
| HACKER | Patch | -2 Heat on Tech successes |
| STEALTH | Shadow | 50% dodge Heat on Stealth failures |
| FACE | Skimming | +50% loot from successful nodes |

### Equipment Slots
- Each crew member has 2 equipment slots
- **Equip Flow:** Click item in Stash → Click empty slot on crew card
- **Unequip Flow:** Click occupied slot → Item returns to Stash
- Slots highlight when an item is selected

---

## 5. Item System

### Item Definitions
| ID | Name | Type | Cost | Effect |
|----|------|------|------|--------|
| EMP | EMP Charge | CONSUMABLE | $500 | Force success on next Tech node |
| BREACH_CHARGE | Breach Charge | CONSUMABLE | $600 | Force success on next Force node |
| SMOKE_BOMB | Smoke Bomb | CONSUMABLE | $400 | Prevent Heat for one node |
| MEDKIT | Medkit | CONSUMABLE | $300 | (No effect implemented) |
| LOCKPICK | Lockpick Set | PASSIVE | $800 | +1 TECH when equipped |
| KEVLAR | Kevlar Vest | PASSIVE | $800 | +1 FORCE when equipped |

### Item Schema
```javascript
{
  id: string,
  instanceId: string,   // Unique per purchase
  name: string,
  type: "PASSIVE" | "CONSUMABLE",
  cost: number,
  stats: { tech?, force? },    // For PASSIVE only
  description: string
}
```

### Item Effects (Scaffolded)
`ITEM_EFFECTS` defines tactical effects but **auto-application from equipped items is NOT implemented**. The `activeModifier` system in SimulationEngine is for manual item priming (deprecated UI).

---

## 6. Contract System

### Layout Types
| Type | Description | Reward Mult |
|------|-------------|-------------|
| STANDARD | 2 entries, 3 mid-nodes, 2 exits | 1.0x |
| LINEAR | Single-path chain (1-1-1-1) | 0.8x |
| COMPOUND | 1 entry, 3 mid-nodes, converge to vault, 2 exits | 1.5x |

### Contract Schema
```javascript
{
  id: string,
  name: string,              // Generated name (e.g., "Metro Reserve")
  difficulty: number,
  rewardMult: number,
  layoutType: "STANDARD" | "LINEAR" | "COMPOUND",
  description: string
}
```

---

## 7. Map System

### Node Types
| Type | Function |
|------|----------|
| ENTRY | Starting points (revealed) |
| TRANSIT | Mid-level nodes with stat checks |
| VAULT | Primary loot objective |
| EXIT | Escape points |

### Node Schema
```javascript
{
  id: string,
  x: number, y: number,     // Screen coordinates
  type: string,
  name: string,             // Flavor text (e.g., "Laser Grid")
  status: "HIDDEN" | "REVEALED",
  connectedTo: string[],    // Adjacent node IDs
  properties: {
    statCheck: "FORCE" | "TECH" | "STEALTH" | "FACE" | "NONE",
    difficulty: number,
    riskValue: number,      // Heat on failure
    lootValue?: number,
    hasLoot?: boolean
  }
}
```

### Loot Scaling
```javascript
BASE_LOOT_VAULT: 2000 + (difficulty * 500)
BASE_LOOT_SIDE: 300 + (difficulty * 50)
LOOT_CHANCE: 30% for transit nodes
```

---

## 8. Simulation Engine

### Execution Flow
1. Path is validated (entry → connected nodes → exit)
2. For each node in path:
   - Move crew visual to node
   - Reveal if HIDDEN (blind jump)
   - Resolve stat check
   - Apply heat/loot
   - Check end conditions
3. Dispatch `heistFinished` event

### Stat Check Resolution
```
Roll = HighestCrewStat + RNG(-2 to +2)
Success = Roll >= NodeDifficulty
Failure Heat = node.properties.riskValue
```

### Active Modifier System
```javascript
SimulationEngine.activeModifier = null;  // Holds primed tactical item
SimulationEngine.applyItem(item);        // Primes item for next node
```
> **Note:** This system was designed for a "Tactical Belt" UI that was **deprecated**. Items are now equipped to crew but their effects are **not auto-applied** during simulation.

---

## 9. UI Components

### HUD Top Bar
- Day counter
- Cash display (`#cash-display`)
- Intel display (`#intel-display`)
- View toggle buttons (Map / Shop)

### Heat Bar
- Visual: 0-100% fill with color gradient (blue → purple → red)
- Label updates with percentage
- Pulsing animation at high heat

### Command Deck (Bottom 35vh)
| Section | Content |
|---------|---------|
| Active Stack | Up to 4 selected crew cards |
| Reserves | Remaining roster |
| Stash | Purchased inventory items |

### Crew Card Elements
- Header: Name + Role badge
- Stats: 2x2 grid (Force, Tech, Stealth, Face)
- Footer: Equipment slots (2) + Ability badge
- Ability badge shows icon + name; hover for description

### Shop/Safehouse
- **Specialists:** 3 recruits with stats and hire price
- **Black Market:** 3 items with costs and effects

### Job Board
- 3 contract cards per day
- Click to load contract and switch to map view

---

## 10. Event System

### Global Events (window)
| Event | Trigger | Purpose |
|-------|---------|---------|
| `gameReset` | `resetGame()` | Full state reset |
| `mapLoaded` | Contract selected | Show map view |
| `startHeist` | Execute button | Lock UI, start sim |
| `heistFinished` | Sim complete | Unlock UI |
| `heistEventLog` | Each node resolved | Log updates |
| `shopRefreshed` | Day start | Update shop UI |
| `nextDayStarted` | After heist | Day transition |
| `intelPurchased` | Buy intel | Update display |
| `heatLaundered` | Launder action | Update heat bar |

### Internal EventEmitter (GameManager.events)
| Event | Data |
|-------|------|
| `crew-updated` | Updated crew object |
| `inventory-updated` | Updated inventory array |

---

## 11. Configuration Values

```javascript
GameConfig = {
  SIMULATION: { ACTION_DELAY_MS: 1000, LOOT_CHANCE: 0.3 },
  PASSIVES: {
    FORCE_REROLL_CHANCE: 0.50,
    TECH_HEAT_REDUCTION: 2,
    STEALTH_DODGE_CHANCE: 0.50,
    FACE_LOOT_MULTIPLIER: 1.50
  },
  ECONOMY: {
    STARTING_CASH: 1500,
    STARTING_INTEL: 10,
    VICTORY_CASH: 5000,
    SCOUT_COST: 5,
    BUY_INTEL_COST: 200,
    LAUNDER_COST: 500
  },
  HEAT: { MAX_HEAT: 100, DECAY_RATE: 10, INITIAL_HEAT: 0 }
}
```

---

## 12. Known Gaps / Incomplete Features

| Feature | Status |
|---------|--------|
| **Equipped item stat bonuses** | NOT applied during simulation |
| **Consumable auto-use** | Scaffolded but no UI trigger |
| **Crew limit for heist** | No enforcement of exactly 4 |
| **Save/Load system** | Not implemented |
| **Audio/SFX** | Not implemented |
| **Grand Heist mode** | Generator exists, no UI trigger |
| **Heat decay between days** | Value exists, not applied |
| **Intel scouting** | Logic exists, UI incomplete |

---

## 13. CSS Theming

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#ffcc00` | Selected states, highlights |
| Success | `#00ffaa` | Abilities, positive feedback |
| Danger | `#ff4444` | High heat, warnings |
| Background | `rgba(10, 10, 15, 0.95)` | Panels |
| Border | `#333` / `#444` | Dividers, card edges |

### Key Animations
- `itemPulse`: 1.5s breathing glow for selected stash items
- Heat bar color interpolation (blue → purple → red)

---

*End of Game State Document*
