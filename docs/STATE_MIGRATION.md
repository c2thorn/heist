# State Management Migration Guide

## Current Status (After Phase 3)

GameManager now holds primary state in `gameState.grid`:
- `tileMap`, `pathfinder`, `units`, `selectedUnit`
- `heistPhase`, `sectorManager`, `crewSpawns`, `gridRenderer`

**Mirrors exist:** `window.*` references point to the same objects for backward compatibility.

## Remaining `window.*` Usages

| File | References | Priority |
|------|------------|----------|
| TaskProcessor.js | `heistPhase`, `tileMap`, `pathfinder`, `arrangementEngine` | Low |
| UnitEntity.js | `selectedUnit` | Low |
| SetupPhaseUI.js | `sectorManager`, `crewSpawns` | Low |
| GridRenderer.js | `heistPhase`, `sectorManager` | Low |
| RadioController.js | `allUnits` | Low |
| GoalDiscoveryService.js | `tileMap` | Low |

## Why Not Migrate Now

1. **Mirrors work correctly** - All reads via `window.*` return the correct values
2. **Risk vs reward** - Many file changes for marginal benefit
3. **Feature priority** - Time better spent on gameplay

## When to Migrate

Consider migrating when:
- Adding TypeScript (need explicit imports)
- Implementing unit tests (need to mock state)
- Debugging confusion from dual references
- Major refactor touching these files anyway

## Migration Pattern

When you do migrate a file:

```javascript
// Before
if (window.heistPhase === 'PLANNING') { ... }
const tile = window.tileMap.getTile(x, y);

// After
import GameManager from '../GameManager.js';

if (GameManager.heistPhase === 'PLANNING') { ... }
const tile = GameManager.tileMap.getTile(x, y);
```

## Keep as Window Globals

These should stay on `window` (UI concerns):
- `window.gridRenderer` - Used by canvas event handlers
- `window.arrangementEngine` - Already a singleton export
- `window.Task`, `window.signalBus` - Console debugging
