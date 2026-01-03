# Design Deviation Report

**Purpose:** Compare original design documents to current implementation and identify deviations.

---

## Summary of Changes

| Area | Original Design | Current Implementation | Status |
|------|-----------------|------------------------|--------|
| **Rendering** | Phaser 3 WebGL | HTML/CSS/SVG | 🔄 Changed |
| **Crew Size** | Exactly 4 required | 0-4 recommended (not enforced) | ⚠️ Partial |
| **Item System** | Inventory per crew | Global Stash + Equipment slots | 🔄 Changed |
| **State Machine** | MENU→BRIEFING→PLANNING→SIM→DEBRIEF | CONTRACT_SELECT→PLANNING→SIM→AAR | 🔄 Changed |
| **Difficulty** | Fixed per level | Day-based scaling | 🔄 Changed |
| **Contract System** | Not in original | Added: Job Board with 3 layouts | ✅ New |
| **Passive Abilities** | Not in original | Role-based passives implemented | ✅ New |
| **Shop/Safehouse** | "Gear Shop" in Briefing | Separate Shop view with daily refresh | 🔄 Changed |

---

## 1. Rendering Architecture

### Original (GDD / UI Flowchart)
> "Layer 2 (Middle): Phaser Canvas (WebGL) - Renders the interactive Graph"
> "Phaser Scene: Renders the Node Graph. Handles clicking nodes to draw lines."

### Current Implementation
- **MapRenderer.js** uses pure HTML/CSS/SVG
- Phaser 3 was scaffolded but deprecated
- Nodes rendered as positioned `<div>` elements
- Connections drawn as SVG `<line>` elements

### Reason for Deviation
HTML-based rendering provides better CSS styling control, easier debugging, and eliminates canvas/DOM synchronization issues for the overlay-heavy UI design.

---

## 2. Game States / Flow

### Original (UI State Flowchart)
```
MENU → BRIEFING (Crew Draft) → PLANNING → SIMULATION → DEBRIEF
```
- Required 4/4 crew slots filled before proceeding
- "TO BLUEPRINT" button transition

### Current Implementation
```
SELECTING_CONTRACT → PLANNING → (Execute) → RUNNING → heistFinished → Next Day
```
- Game starts at Day 1 with Job Board (no MENU state)
- No enforced 4-crew requirement
- "BRIEFING" is replaced by persistent Command Deck
- Crew selection happens in parallel with path planning

### Reason for Deviation
Merged the drafting and planning phases for faster iteration. The persistent Command Deck eliminates screen transitions.

---

## 3. Crew & Party System

### Original (GDD / Schema)
```json
"crew": {
  "activeStack": [
    { "id": "c_muscle_01", "inventory": ["i_crowbar"] }
  ]
}
```
- Each crew member has their own `inventory` array
- Exactly 4 crew required for heist

### Current Implementation
```javascript
crew: {
  activeStack: [],      // Selected for active heist
  roster: [...],        // All hired crew (up to 12)
  limit: 12
}
member.equipment: [null, null]  // 2 slots per crew
```
- Global `inventory` array (Stash) for purchased items
- Items equipped FROM Stash TO crew equipment slots
- No hard enforcement of 4-crew limit

### Reason for Deviation
Equipment slot system provides clearer item management UI. Global stash allows flexible item swapping between runs.

---

## 4. Item System

### Original (Schema)
```json
"itemLibrary": {
  "i_crowbar": { "type": "GEAR", "effect": { "stat": "FORCE", "value": 2 } }
}
```
- Items directly modify stats when in inventory
- Type: GEAR vs CONSUMABLE

### Current Implementation
```javascript
ITEM_DEFINITIONS = {
  "LOCKPICK": { type: "PASSIVE", stats: { tech: 1 } },
  "EMP": { type: "CONSUMABLE", effect: "FORCE_SUCCESS" }
}
```
- PASSIVE items have stat bonuses (NOT auto-applied yet)
- CONSUMABLE items have tactical effects (scaffolded, not triggered)
- Items stored with unique `instanceId`

### Known Gap
⚠️ **Equipped item stat bonuses are NOT applied during simulation.** This is documented as incomplete.

---

## 5. Map & Node System

### Original (Schema)
```json
{
  "type": "ROOM",
  "name": "Basement Hallway",
  "status": "HIDDEN",
  "properties": { "statCheck": "STEALTH", "difficulty": 5 }
}
```
- Node types: ENTRY, TRANSIT, ROOM, VAULT, EXIT
- `ROOM` type was planned

### Current Implementation
- Node types: ENTRY, TRANSIT, VAULT, EXIT
- `ROOM` type removed (merged into TRANSIT)
- Added flavor names from `NODE_FLAVOR_TABLE` (e.g., "Laser Grid", "Armed Sentry")
- Added `connectedTo[]` directly on nodes (not just edges array)
- Added `lootValue` and `hasLoot` properties

### New Feature: Layout Types
Contracts specify layout:
- **STANDARD**: 2-2-1-2 (original-ish)
- **LINEAR**: 1-1-1-1 chain
- **COMPOUND**: 1-3-1-2 funnel
- **GRAND_HEIST**: 5-layer boss map (generator exists, no UI)

---

## 6. Resolution & Passives

### Original (GDD)
```
Delta = CrewStat - NodeDifficulty
Result = Delta + Random(-2 to +2)
Heat = RiskValue * abs(Result) on failure
```

### Current Implementation
```javascript
Roll = HighestCrewStat + RNG(-2 to +2)
Success = Roll >= NodeDifficulty
Heat = node.properties.riskValue (flat value on failure)
```
- Heat penalty is flat riskValue, not scaled by failure margin

### New: Passive Abilities
Role-based passives trigger during resolution:
| Role | Passive | Effect |
|------|---------|--------|
| MUSCLE | Second Wind | 50% re-roll on Force fail |
| HACKER | Patch | -2 Heat on Tech success |
| STEALTH | Shadow | 50% dodge Heat on Stealth fail |
| FACE | Skimming | +50% loot on success |

*Not in original design.*

---

## 7. Economy & Progression

### Original (GDD)
- Starting cash: $1000
- Intel: 5
- Victory: "Loot acquired"

### Current Implementation
- Starting cash: **$1500**
- Starting intel: **10**
- Victory: Cash ≥ **$5000**
- Added: Day progression with difficulty scaling
- Added: Daily shop refresh (3 recruits + 3 items)
- Added: Intel purchase ($200 → 5 intel)
- Added: Launder money ($500 → -20 Heat)

---

## 8. UI Structure

### Original (UI Flowchart)
- Left/Center/Right panel layout for Briefing
- Separate screens for each phase
- "4 Slots" for crew draft
- Speed toggle (1x, 2x) for simulation

### Current Implementation
- **Persistent Command Deck** (bottom 35vh)
  - Active Stack + Reserves + Stash in 3-column layout
- **View Tabs** (Map / Shop) toggle between views
- No speed toggle
- No separate Briefing screen

### New UI Elements
- **Job Board**: Contract selection overlay
- **Ability Badges**: Compact passive display on crew cards
- **Equipment Slots**: 2 slots per crew with click-to-equip

---

## 9. Features NOT Implemented

| Original Feature | Status |
|-----------------|--------|
| Drag-and-drop crew selection | ❌ Click-based instead |
| "Intel Mode" toggle | ⚠️ Scout logic exists, UI incomplete |
| Speed toggle (1x/2x) | ❌ Not implemented |
| XP/Progression for crew | ❌ Not implemented |
| Save/Load game | ❌ Not implemented |
| Sound/Music | ❌ Not implemented |
| "CLOSE FILE" debrief button | ❌ Replaced with "Next Day" |

---

## 10. New Features (Not in Original)

| Feature | Description |
|---------|-------------|
| **Contract System** | 3 daily contracts with layout types |
| **Passive Abilities** | Role-based combat modifiers |
| **Equipment Slots** | 2 slots per crew member |
| **Global Stash** | Shared inventory for purchased items |
| **Day/Shop Cycle** | Daily refresh of recruits and items |
| **Heat Color Gradient** | Blue→Purple→Red dynamic bar |
| **Grand Heist Generator** | 5-layer boss map (code exists, no UI) |

---

*End of Deviation Report*
