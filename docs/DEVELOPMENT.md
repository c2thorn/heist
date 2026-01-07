# Development Guide

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open in browser (usually http://localhost:5173)
```

## Game Flow

1. **Job Board** - Select a contract (click any card)
2. **Planning Phase** - Purchase intel, set crew objectives
3. **Execute Heist** - Watch crew execute in real-time
4. **Debrief** - HeistSummaryUI shows outcome, loot, crew status

## Console Testing

### Select Units
```javascript
window.selectedUnit = window.allUnits[0];
```

### Assign Movement
```javascript
window.selectedUnit.assignObjective({ type: 'MOVE', x: 10, y: 15 });
```

### Test Radio Commands
```javascript
radioController.goLoud();
radioController.scram();
```

### Test Intel/Arrangements
```javascript
sectorManager.purchaseIntel('vault');
arrangementEngine.purchase('vault_codes');
```

### Force Phase Change
```javascript
GameManager.heistPhase = 'EXECUTING';
window.heistPhase = 'EXECUTING';
```

## Key Debug Flags

```javascript
window.DEBUG_MOVEMENT = true;  // Log pathfinding
```

## Known Issues

| Issue | Status |
|-------|--------|
| PASSIVE item bonuses not applied | Bug - needs fix |
| CONSUMABLE items don't trigger | Not implemented |
| Guards don't patrol | Not implemented |
| No win/lose conditions | Not implemented |

## File Structure

```
src/
├── renderer.js          # Main entry, wires everything
├── game/
│   ├── GameManager.js   # Central state
│   └── grid/            # Core heist systems (25 files)
├── ui/                  # UI components
└── data/
    ├── buildings/       # Map JSON files
    └── arrangements/    # Asset JSON files
```

## Documentation

| Doc | Purpose |
|-----|---------|
| `GDD_v5.md` | Game design (what it should be) |
| `ARCHITECTURE.md` | Code structure (for agents) |
| `ROADMAP.md` | What needs building |
| `STATE_MIGRATION.md` | Future cleanup notes |
