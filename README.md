# Project CLOCKWORK

A tactical heist roguelike where you play as the Mastermind—assembling crews, managing resources, and executing heists in real-time.

---

## 🤖 For AI Agents

**Read these docs first:**
1. [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) - How to run, test commands, known issues
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - Code structure, what files do what
3. [`docs/ROADMAP.md`](docs/ROADMAP.md) - What needs to be built
4. [`docs/GDD_v5.md`](docs/GDD_v5.md) - Game design document

---

## Quick Start

```bash
npm install
npm run dev
```

---

## File Structure

```
heist/
├── docs/
│   ├── ARCHITECTURE.md      # Code structure guide
│   ├── DEVELOPMENT.md       # Dev setup & testing
│   ├── GDD_v5.md            # Game design doc
│   └── ROADMAP.md           # Feature roadmap
│
├── src/
│   ├── renderer.js          # Main entry point
│   │
│   ├── game/
│   │   ├── GameManager.js   # Central state container
│   │   ├── GameConfig.js    # Constants
│   │   │
│   │   └── grid/            # Core heist systems
│   │       ├── TileMap.js           # Map data structure
│   │       ├── GridRenderer.js      # Canvas rendering
│   │       ├── BuildingLoader.js    # Loads JSON → TileMap
│   │       ├── Pathfinder.js        # A* navigation
│   │       ├── Unit.js              # Crew/guard entities
│   │       ├── TaskProcessor.js     # Crew AI brain
│   │       ├── EntityLayer.js       # Unified entity rendering
│   │       ├── Interactable.js      # Safe, Computer, etc.
│   │       ├── SectorManager.js     # Intel system
│   │       ├── ArrangementEngine.js # Asset purchases
│   │       └── ...                  # (25 files total)
│   │
│   ├── ui/
│   │   ├── SetupPhaseUI.js      # Planning phase sidebar
│   │   ├── CommandCenterUI.js   # Crew roster
│   │   └── ...
│   │
│   └── data/
│       ├── buildings/
│       │   └── bank_heist.json      # Map definition
│       └── arrangements/
│           └── bank_heist_arrangements.json
│
└── index.html
```

---

## Tech Stack

- **Vite** - Build/dev server
- **Vanilla JS** - No framework
- **Canvas 2D** - Rendering
- **EasyStar.js** - A* pathfinding