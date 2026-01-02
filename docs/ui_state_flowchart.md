# UI & State Flowchart Specification (v5.0)

## 1. Technical Architecture: The "Sandwich" Model
To avoid spaghetti code, the application uses a strict 3-layer rendering model.

* **Layer 1 (Bottom): Background Layer (CSS/HTML)**
    * Dark grey background, vignetting, grid patterns (blueprint aesthetic).
* **Layer 2 (Middle): Phaser Canvas (WebGL)**
    * Renders the interactive Graph (Nodes/Edges) and the Simulation Sprites.
    * Handles high-performance rendering (lines, particles, sprite movement).
* **Layer 3 (Top): UI Overlay (HTML/DOM)**
    * Renders all menus, buttons, text panels, and tooltips.
    * Interacts with the Game State directly.

---

## 2. Global State Machine (Flowchart)

[START APP] 
    |
    v
[STATE: MENU] --> (User clicks "New Contract")
    |
    v
[STATE: BRIEFING] --> (User drafts Crew & buys Gear) --> (User clicks "View Blueprint")
    |
    v
[STATE: PLANNING] 
    |   <-- (User toggles "Intel Mode" to reveal nodes)
    |   <-- (User clicks Nodes to build "Path Array")
    |
    +---> (User clicks "Execute Plan")
            |
            v
        [STATE: SIMULATION]
            |   (Auto-play: Stack moves along Path)
            |   (Phaser emits events to UI for text logs)
            |
            +---> (Heat >= 100%) --> [STATE: DEBRIEF (FAIL)]
            |
            +---> (Path Complete) --> [STATE: DEBRIEF (SUCCESS)]
                    |
                    v
            (User clicks "Return to Hideout") --> [STATE: MENU]

---

## 3. Screen-by-Screen Definitions

### Screen A: The Briefing (Drafting Phase)
* **Engine:** Pure HTML/DOM (No Phaser required here).
* **Layout:**
    * **Left Panel:** "Available Roster" (List of crew cards).
    * **Center Panel:** "Active Stack" (4 Slots). Drag-and-drop target.
    * **Right Panel:** "Gear Shop" (List of items with costs).
    * **Footer:** "Mission Info" (Bank Level 1, Threat Level: Low).
* **Transition Trigger:** Button "TO BLUEPRINT" (only active if 4/4 slots filled).

### Screen B: The Blueprint (Pathing Phase)
* **Engine:** Phaser (Map) + DOM (HUD).
* **Phaser Scene (Interactive):**
    * **Nodes:** Sprites. Gray = Hidden, White = Revealed, Green = Selected.
    * **Edges:** Graphics objects (Lines). Drawn dynamically between nodes.
    * **Input:** * Click Node: Call 'addToPath(nodeID)'.
        * Right-Click Node: Call 'revealNode(nodeID)' (deducts Intel).
* **DOM HUD:**
    * **Top Bar:** Resources (Cash, Intel).
    * **Bottom Bar:** Current Path List (e.g., "Entry -> Hallway -> Vault").
    * **Action Button:** "EXECUTE" (starts Simulation).

### Screen C: The Heist (Simulation Phase)
* **Engine:** Phaser (Cinematic) + DOM (Logs).
* **Phaser Scene (Passive):**
    * **The Stack:** A single Sprite/Group representing the crew.
    * **Movement:** Tweens from Node to Node along the defined Path.
    * **Feedback:** * Pop-up icons over nodes (Keypad Icon, Fist Icon).
        * Color tints (Red flash on damage/heat).
* **DOM HUD:**
    * **Heat Bar:** Large progress bar (0-100%).
    * **Event Log:** Scrolling text box ("Brick smashed the door", "Zero failed the hack").
    * **Controls:** Speed Toggle (1x, 2x).

### Screen D: The Debrief (Result Phase)
* **Engine:** Pure HTML/DOM.
* **Components:**
    * **Header:** "MISSION SUCCESS" or "BUSTED".
    * **Loot Tally:** Total Cash stolen.
    * **Crew Status:** List injuries or XP gained.
* **Transition:** Button "CLOSE FILE".

---

## 4. Key Logic & Event Listeners
The AI Agent must implement these listeners to bridge Electron and Phaser.

**1. The Path Builder (Planning State)**
* **Listener:** 'PHASER_NODE_CLICK'
* **Logic:**
    * Get 'clickedNode'.
    * Check 'validMoves' (is clickedNode connected to last node in path?).
    * If valid: Push to 'gameState.simulation.plannedPath'. Draw Line.
    * If invalid: Play error sound.

**2. The Resolution Step (Simulation State)**
* **Listener:** 'STACK_ARRIVED_AT_NODE'
* **Logic:**
    * Pause Movement.
    * Run 'ResolveEncounter(node, crew)' function.
    * Update 'gameState.resources.heat'.
    * Emit 'UI_UPDATE_HEAT'.
    * Wait 1000ms (for dramatic effect).
    * Resume Movement.