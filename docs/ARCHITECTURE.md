# Heist Game Architecture

> **For Future Developers/Agents:** Read this FIRST before making changes.

## Golden Rules

1. **Don't create new renderers** - Use `EntityLayer` for all entities
2. **Don't create new state containers** - Use `GameManager.gameState`
3. **Don't hardcode entities** - Load from JSON via `BuildingLoader`
4. **Don't create window.* globals** - Use `GameManager.*` accessors

---

## System Map

| "I need to..." | Use this file |
|----------------|---------------|
| Add a new entity type | `game/grid/MapEntity.js` (extend it) |
| Render entities | `game/grid/EntityLayer.js` |
| Store game state | `game/GameManager.js` → `gameState.grid.*` |
| Add map tiles/rooms | `data/buildings/bank_heist.json` |
| Add purchasable assets | `data/arrangements/bank_heist_arrangements.json` |
| Handle pathfinding | `game/grid/Pathfinder.js` |
| Drive crew AI/behavior | `game/grid/TaskProcessor.js` |
| Add interactables | `game/grid/Interactable.js` (extend Safe/Computer/SecurityPanel) |

---

## File Purposes

### Core Game (`game/`)
| File | Purpose |
|------|---------|
| `GameManager.js` | **Central state container** - holds all game state |
| `GameConfig.js` | Constants: economy, heat, timing |
| `MapGenerator.js` | Legacy node-graph maps (for job board preview) |
| `SimulationEngine.js` | Legacy turn-based simulation |

### Grid System (`game/grid/`)
| File | Purpose |
|------|---------|
| `TileMap.js` | 2D tile grid data structure |
| `Tile.js` | Single tile: type, walkability, door state |
| `GridRenderer.js` | Canvas rendering of tiles, fog, overlays |
| `GridConfig.js` | Tile types, sizes, colors |
| `Pathfinder.js` | A* pathfinding via EasyStar |
| `BuildingLoader.js` | **Loads JSON → TileMap + entities** |

### Entities (`game/grid/`)
| File | Purpose |
|------|---------|
| `EntityLayer.js` | **Unified entity rendering/hit-testing** |
| `MapEntity.js` | Base class for all map entities |
| `Unit.js` | Movable units (crew, guards) |
| `UnitEntity.js` | Wrapper for Unit → EntityLayer |
| `Interactable.js` | Base for Safe, Computer, etc. |
| `InteractableEntity.js` | Wrapper for interactables → EntityLayer |

### AI/Behavior (`game/grid/`)
| File | Purpose |
|------|---------|
| `TaskProcessor.js` | **Crew brain** - executes objectives |
| `Task.js` | Task definitions (MOVE, INTERACT, etc.) |
| `VisionCone.js` | Guard vision detection |

### Planning Phase (`game/grid/`)
| File | Purpose |
|------|---------|
| `SectorManager.js` | Intel purchase, zone visibility |
| `ArrangementEngine.js` | Asset purchase system |
| `ThreatClock.js` | Heist timer |

### UI (`ui/`)
| File | Purpose |
|------|---------|
| `SetupPhaseUI.js` | Planning phase sidebar |
| `CommandCenterUI.js` | Crew roster management |
| `UnitContextMenu.js` | Right-click objective queue editor |

---

## Data Files

```
src/data/
├── buildings/
│   └── bank_heist.json      # Building layout, guards, interactables
├── arrangements/
│   └── bank_heist_arrangements.json  # Purchasable assets
└── CrewLibrary.js           # Crew member definitions
```

---

## State Location

```javascript
GameManager.gameState = {
  grid: {
    tileMap,        // TileMap instance
    pathfinder,     // Pathfinder instance  
    units,          // Array of Unit instances
    selectedUnit,   // Currently selected Unit
    phase,          // 'PLANNING' | 'EXECUTING'
    sectorManager,  // SectorManager instance
    crewSpawns,     // Spawn point coordinates
    gridRenderer    // GridRenderer instance
  },
  // ... other state (crew, shop, flags, etc.)
}
```

---

## Patterns

### Adding a New Entity Type
```javascript
// 1. Extend MapEntity
class MyEntity extends MapEntity { ... }

// 2. Add to EntityLayer
entityLayer.add(new MyEntity(...));

// 3. EntityLayer handles rendering automatically
```

### Loading from JSON
```javascript
// Building data
import buildingData from './data/buildings/my_building.json';
const result = BuildingLoader.load(buildingData);

// Arrangements
import arrangements from './data/arrangements/my_arrangements.json';
arrangementEngine.loadFromData(arrangements);
```

### Accessing State
```javascript
// Preferred (through GameManager)
const units = GameManager.units;
const phase = GameManager.heistPhase;

// Legacy (window.* - works but deprecated)
const units = window.allUnits;
```
