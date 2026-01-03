# Project CLOCKWORK - Implementation Handoff

> **Last Updated**: 2026-01-03 | **Status**: Core Complete, Polish Remaining

---

## Completed Features

### Phase 1-5: Foundation ✅
- 2D tile grid with zones and visibility states
- A* pathfinding with collision avoidance
- Smooth unit movement with tile reservation
- Vision cones with raycasting and detection meters

### Phase 6: Command Queue ✅
- `Task.js` - MOVE, WAIT, SIGNAL task types
- `TaskController.js` - Per-unit queue processing
- `SignalBus.js` - Task dependency system

### Phase 7: Economy & Radio ✅
- `ThreatClock.js` - 4-zone escalation (CASUAL→ALERT→LOCKDOWN→SWAT)
- `RadioController.js` - SILENT_RUNNING, GO_LOUD, SCRAM stances
- Guard modifiers applied based on threat zone

### Phase 8: Intel & Arrangements ✅
- `SectorManager.js` - Zone-based intel reveal
- `ArrangementEngine.js` - STATIC_MODIFIER, TRIGGERED_ABILITY types

### Phase 9: UI Integration ✅
- Radio Panel with stance buttons
- Threat Bar with zone indicators
- Planning vs Execution phase state

---

## Deferred Items

### 1. INTERACT Task Type
**SPEC**: 003 | **Priority**: High | **Effort**: 2-3 days

Currently defined but not implemented. Needs interactable object system.

**Implementation Plan**:
```
1. Create Interactable base class
   - Properties: position, interactionTime, requiredTool, skillCheckDC
   - Methods: canInteract(unit), startInteraction(), completeInteraction()

2. Create subclasses:
   - Door (locked/unlocked, can be lockpicked)
   - Computer (hack for intel)
   - Safe (open for loot)
   - SecurityPanel (disable cameras)

3. Extend TaskController to handle INTERACT:
   - Move to adjacent tile
   - Show interaction progress bar
   - Apply skill check (see item 3)
   - Trigger effect on success

4. Add interactables to TestMapGenerator
```

**Files to modify**:
- `src/game/grid/TaskController.js` - Add INTERACT handling
- `src/game/grid/Interactable.js` - NEW
- `src/game/grid/TestMapGenerator.js` - Place interactables

---

### 2. Skill Check System
**SPEC**: 004 | **Priority**: Medium | **Effort**: 1 day

Per SPEC_004, interactions require 2d6 + modifier vs DC.

**Implementation Plan**:
```javascript
// src/game/grid/SkillCheck.js
class SkillCheck {
  static roll(modifier, dc) {
    const roll = Math.floor(Math.random() * 6) + 1 + 
                 Math.floor(Math.random() * 6) + 1;
    const total = roll + modifier;
    return {
      success: total >= dc,
      roll,
      total,
      margin: total - dc
    };
  }
}
```

Integrate with INTERACT task and display result in event log.

---

### 3. SOP Profiles (Autonomous Reactions)
**SPEC**: 003 | **Priority**: Medium | **Effort**: 2 days

Units should auto-react when detected without player input.

**Implementation Plan**:
```javascript
// Unit state machine extension
const SOP = {
  AGGRESSIVE: 'Fight back, don\'t flee',
  CAUTIOUS: 'Take cover, wait for orders',
  COWARD: 'Flee immediately when spotted'
};

// In Unit.js, when detection reaches 100%:
onDetected() {
  switch (this.sopProfile) {
    case SOP.COWARD:
      this.assignTask(Task.move(exitTile.x, exitTile.y));
      break;
    case SOP.CAUTIOUS:
      this.assignTask(Task.move(nearestCover.x, nearestCover.y));
      break;
  }
}
```

---

### 4. Setup Phase UI
**SPEC**: 005 | **Priority**: Medium | **Effort**: 2-3 days

Pre-heist screen for spending Intel and Cash.

**Implementation Plan**:
```
1. Create SetupPhaseUI.js
   - Left panel: Map with fog, click sectors to reveal
   - Right panel: Available arrangements (filtered by revealed sectors)
   - Bottom: Intel/Cash counters, PROCEED button

2. Flow integration:
   Contract accepted → Setup Phase → Planning Phase → Execution

3. Wire to existing SectorManager and ArrangementEngine
```

**Mockup**:
```
┌─────────────────────────────────────────────┐
│  INTEL: 10        SETUP PHASE       CASH: $2000  │
├─────────────────────┬───────────────────────┤
│                     │  ARRANGEMENTS         │
│   [MAP WITH FOG]    │  ○ Bribe Guard ($500) │
│                     │  ○ Phone Distraction  │
│   Click to reveal   │  ○ Power Cut ($800)   │
│   sectors           │                       │
├─────────────────────┴───────────────────────┤
│              [ PROCEED TO HEIST ]           │
└─────────────────────────────────────────────┘
```

---

### 5. PLACED_ITEM Arrangement Type
**SPEC**: 005 | **Priority**: Low | **Effort**: 1 day

Items placed on map during setup (e.g., distraction device).

**Implementation Plan**:
```javascript
// In ArrangementEngine, add handling for PLACED_ITEM
case ArrangementType.PLACED_ITEM:
  // During setup, show placement UI
  // Player clicks tile to place
  // During heist, item appears on map as interactable
  break;
```

Requires Setup Phase UI first.

---

### 6. Command Deck UI
**SPEC**: 003 | **Priority**: Low | **Effort**: 3-4 days

Visual drag-and-drop interface for task queues.

**Implementation Plan**:
```
1. CommandDeckUI.js
   - Show each crew member as a column
   - Display queued tasks as cards
   - Drag to reorder, X to remove
   - Buttons to add MOVE/WAIT/SIGNAL

2. Wire to TaskController per unit

3. Real-time update as tasks complete
```

This is the most complex UI piece. Consider using a library for drag-and-drop.

---

## Architecture Notes

### File Structure
```
src/game/grid/
├── GridConfig.js      # Constants
├── Tile.js            # Tile data
├── TileMap.js         # Map container
├── TestMapGenerator.js
├── GridRenderer.js    # Canvas drawing
├── Pathfinder.js      # A* algorithm
├── Unit.js            # Movable entities
├── VisionCone.js      # Guard FOV
├── Task.js            # Task data
├── TaskController.js  # Queue processor
├── SignalBus.js       # Dependencies
├── ThreatClock.js     # Time escalation
├── RadioController.js # Global commands
├── SectorManager.js   # Intel system
├── ArrangementEngine.js # Pre-heist assets
└── index.js           # Exports
```

### Global State (available on `window`)
- `window.heistPhase` - 'PLANNING' | 'EXECUTING'
- `window.selectedUnit` - Currently selected unit
- `window.allUnits` - All crew units
- `window.threatClock` - ThreatClock singleton
- `window.radioController` - RadioController singleton
- `window.sectorManager` - SectorManager instance
- `window.arrangementEngine` - ArrangementEngine singleton

### Event System
- `startHeist` - Fired when EXECUTE HEIST clicked
- `heistEventLog` - For event log entries
- `gameStateUpdated` - For HUD updates

---

## Testing Notes

All systems can be tested via browser console:
```javascript
// Task queue
testUnit.assignTask(Task.move(10, 15));
testUnit.assignTasks([Task.move(5,5), Task.wait(2), Task.move(10,10)]);

// Radio
radioController.goLoud();
radioController.scram();

// Intel
sectorManager.purchaseIntel('vault');

// Arrangements
arrangementEngine.purchase('phone_distraction');
arrangementEngine.trigger('phone_distraction');

// Threat
threatClock.addPenalty(30);  // Add 30 seconds
```

---

## Recommended Next Steps

1. **INTERACT system** - Opens up actual heist objectives
2. **Setup Phase UI** - Makes intel/arrangements accessible to players
3. **SOP profiles** - Adds tactical depth
4. **Command Deck** - Full task queue visualization

The game is playable for movement and radio commands. These additions would complete the full SPEC vision.
