# Project CLOCKWORK - Implementation Progress & Handoff Notes

**Last Updated:** 2026-01-03T12:05:00  
**Session Status:** Phases 1-5 Complete

---

## Overview

This document tracks the implementation of the heist game redesign from a node-based system to a tile-grid architecture. The work is based on specs SPEC_001 through SPEC_005 in this folder.

---

## Implementation Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1: Core Grid Architecture** | ✅ Complete | Tile grid foundation |
| **Phase 2: Rendering & Input** | ✅ Complete | Canvas renderer with camera/pan |
| **Phase 3: Pathfinding & Movement** | ✅ Complete | A* pathfinding, smooth movement |
| **Phase 4: Collision & Reservation** | ✅ Complete | Tile reservations, wait states |
| **Phase 5: Vision & Stealth** | ✅ Complete | Vision cones, raycasting, detection |
| **Phase 6: Command Queue & AI** | ⏳ Next | Task queue, crew autonomy |
| **Phase 7: Economy, Time & Radio** | ⬜ Pending | Time pressure, radio commands |
| **Phase 8: Intel & Arrangements** | ⬜ Pending | Pre-heist setup, entry points |
| **Phase 9: Integration & Polish** | ⬜ Pending | Wire up to full game flow |

---

## Files Created (src/game/grid/)

| File | Purpose |
|------|---------|
| `GridConfig.js` | Constants: TILE_SIZE (32px), TILE_TYPE, VISIBILITY states, TERRAIN, MOVEMENT_COST |
| `Tile.js` | Tile schema: type, terrain, walkability, cover, transparency, visibility, occupancy, reservations |
| `TileMap.js` | 2D grid management: coordinate conversion, zone management, visibility control |
| `TestMapGenerator.js` | Sample building generator for testing (lobby, hallways, offices, vault) |
| `GridRenderer.js` | Canvas renderer: camera/viewport, panning (WASD/drag/scroll), units, vision cones |
| `Pathfinder.js` | EasyStar.js A* wrapper with tile costs and avoid points |
| `Unit.js` | Movable entity: dual position (grid/world), movement interpolation, corner cutting, reservation states |
| `VisionCone.js` | Vision detection: cone geometry, Supercover raycasting, detection meter, cover mechanics |
| `index.js` | Exports all modules |

---

## Current Test Scaffolding

The main game (`src/renderer.js`) has temporary test controls:

| Control | Purpose | Final Product |
|---------|---------|---------------|
| Press `1` / `2` | Select green/orange unit | Will be crew portraits in command deck |
| Click tile | Move selected unit there | Will be "assign MOVE_TO task" |
| WASD | Pan camera | Probably mouse drag / edge scroll only |

These are **scaffolding for testing** the low-level systems. The final game uses a **Task Queue** system where players assign tasks to crew, and crew execute autonomously.

---

## User Preferences & Decisions

1. **Rendering:** Canvas (not SVG or Phaser) for tile grid
2. **Testing:** User performs all verification manually; I do not auto-launch browser tests
3. **Building Visuals:** Blueprint aesthetic with distinct room colors
4. **Phases 4 & 5:** Can be developed in parallel (no dependency between them)
5. **Entry Point Assignment:** Noted for Phase 8 implementation
6. **Server Command:** Use `npm run dev` (Vite only) instead of `npm start` (Electron window)

---

## What Each Phase Implemented

### Phase 1: Core Grid Architecture
- `GridConfig.js` with tile constants (32px tiles, types, terrains)
- `Tile.js` with full schema per SPEC_001
- `TileMap.js` with coordinate conversion (gridToWorld/worldToGrid)
- `TestMapGenerator.js` producing 32×32 test building
- Tri-state visibility (HIDDEN/REVEALED/VISIBLE)

### Phase 2: Rendering & Input
- Canvas-based `GridRenderer.js`
- Camera/viewport system with panning
- WASD keyboard, right-click drag, scroll wheel pan
- Tile hover highlighting, click events
- Zone-based floor coloring

### Phase 3: Pathfinding & Movement
- Installed `easystarjs` npm package
- `Pathfinder.js` wrapping EasyStar with grid configuration
- `Unit.js` with dual position tracking
- Smooth movement interpolation (vector-based)
- Corner cutting and waypoint tolerance
- Tile occupancy registration

### Phase 4: Collision & Reservation
- Look-ahead tile reservation before moving
- WAITING state when tile is blocked
- Wait timeout → reroute callback
- Visual pulsing ring for waiting units
- Pathfinding avoids occupied tiles
- Two test units for collision testing

### Phase 5: Vision & Stealth
- `VisionCone.js` with origin, facing, FOV, range
- Supercover line algorithm for raycasting
- Cover mechanics (sneaking behind cover = hidden)
- Detection meter with accumulation formula
- UNAWARE → SUSPICIOUS → DETECTED states
- Visual cone rendering (changes color on detection)
- Test guard with sweeping vision cone

---

## Next Steps: Phase 6 (Command Queue & AI)

Per SPEC_003, implement:

1. **Task Queue Data Structure**
   - Task types: MOVE_TO, INTERACT, WAIT, LOOT, SIGNAL
   - Queue per crew member
   - Priority/interrupt system

2. **Task Execution Loop**
   - Pop task, execute, advance
   - Handle task failure/retry

3. **Dependency System (Logic Gates)**
   - WAIT_FOR_SIGNAL, WAIT_FOR_CONDITION
   - Synchronization between crew

4. **Standard Operating Procedures (SOPs)**
   - IF_SPOTTED → FLEE/FIGHT behavior
   - Autonomous reactions

---

## Architecture Notes

### Coordinate Systems
```
Logic Grid: tile coordinates (x, y) integers
World Space: pixel coordinates (x * 32, y * 32) floats
Screen Space: world - camera offset
```

### Unit State Machine
```
IDLE → MOVING → WAITING → REROUTING
         ↓          ↓
       arrive    timeout
```

### Detection Flow
```
Every frame:
  1. Guard updates VisionCone position/angle
  2. For each crew:
     - checkConeArc (distance + angle)
     - checkLineOfSight (Supercover raycast)
     - checkCover (sneaking behind cover)
     - updateDetection (accumulate meter)
  3. Log state changes
```

---

## File Locations

- **Specs:** `docs/heist_redesign/SPEC_001` through `SPEC_005`
- **Grid System:** `src/game/grid/`
- **Main Integration:** `src/renderer.js`
- **Test Page:** `grid-test.html` (standalone, for debugging)
- **Package:** Added `easystarjs` dependency, added `npm run dev` script

---

## How to Run

```bash
cd c:\Users\Cameron\Documents\projects\heist
npm run dev
# Opens Vite at http://localhost:5173/
# Accept a contract to see the tile grid
```

---

## Summary for Next Agent

You're implementing a heist game redesign. The **first 5 phases are done** with working:
- Tile-based map rendering
- A* pathfinding with smooth movement
- Collision avoidance and tile reservations
- Vision cones with detection system

**Current test setup:**
- 2 crew units (green, orange) controllable via keyboard selection
- 1 guard (red) with sweeping vision cone
- Click-to-move with pathfinding

**Next:** Phase 6 - Command Queue & AI (Task queues, autonomous crew, SOPs)

The temporary keyboard/click controls will be replaced by the Task Queue UI in Phase 6.
