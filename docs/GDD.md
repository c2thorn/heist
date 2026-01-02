# Game Design Document: Project CLOCKWORK (v3.0 - "The Stack Heist")

## 1. High Concept & Core Loop
**Concept:** A tactical heist management game. The player acts as the "Mastermind," assembling a crew and plotting a route through a secured facility. The gameplay is **deterministic strategy** (Drafting & Pathing) followed by **probabilistic simulation** (Auto-Resolution).

**Reference:** *Darkest Dungeon* (Party Management) meets *Slay the Spire* (Pathing) meets *Ocean's Eleven* (Theme).

**The Core Loop:**
1.  **Draft:** Select 4 Crew Members and equipping Gear.
2.  **Survey & Path:** View the Map (Nodes), spend Intel to reveal hidden nodes, and draw a linear path from Entry to Exit.
3.  **Simulate:** The crew moves as a single unit ("The Stack") along the path. Hazards are auto-resolved against Crew Stats.
4.  **Result:** Success (Loot acquired, Heat < 100%) or Fail (Heat hits 100% -> Abort).

---

## 2. Game Entities & Data Structures

### A. The Crew ("The Stack")
The player does not control individual units during the heist. The Crew is a single entity containing 4 characters.
* **Stats:** Every challenge checks against the *highest* stat in the Stack.
    * **FORCE:** For Guards, physical barriers, breaking doors. (Archetype: *Muscle*)
    * **TECH:** For Cameras, Keypads, Laser Grids. (Archetype: *Hacker*)
    * **STEALTH:** For Vents, sleeping guards, motion sensors. (Archetype: *Ghost*)
    * **FACE:** For Lobbies, Desk Clerks, Social Engineering. (Archetype: *Face*)
* **Gear:** Items that boost specific stats (e.g., "Crowbar: +2 Force") or provide a one-time pass (e.g., "EMP: Bypass 1 Tech Node").

### B. The Map (The Graph)
The Map is a collection of **Nodes** (Rooms) and **Edges** (Connections).
* **Node Types:**
    * **Entry Points:** Roof, Sewer, Front Door, Loading Dock.
    * **Transit:** Hallway, Stairwell, Vent.
    * **Room:** Lobby, Server Room, Kitchen, Guard Post.
    * **Target:** The Vault (Main Loot).
    * **Exit Points:** Van in Alley, Helicopter, Sewer.
* **Node Properties:**
    * `difficulty`: Integer (1-10).
    * `statType`: Enum (FORCE, TECH, STEALTH, FACE).
    * `risk`: Integer (Amount of Heat generated on failure).
    * `status`: Enum (HIDDEN, REVEALED).
* **Fog of War:** All nodes except Entry Points start as `HIDDEN`. Player spends "Intel" currency to flip them to `REVEALED` to see their `statType` and `difficulty`.

---

## 3. Gameplay Phases (Logic Flow)

### Phase 1: The Setup (Manager UI)
* **UI Layer:** HTML/DOM Overlay.
* **Action:** Player drags 4 Characters into the "Active Crew" slots.
* **Action:** Player buys Gear with Starting Cash.

### Phase 2: The Blueprint (Pathfinding UI)
* **UI Layer:** HTML/DOM Overlay on top of Phaser Canvas.
* **Visuals:** The Map is displayed as a Blueprint.
* **The Pathing Logic:**
    1.  Player clicks an **Entry Point** (Node A). *State: Path = [Node A]*
    2.  Valid Moves: Only nodes connected to the *last selected node* are clickable.
    3.  Player clicks Node B -> Node C -> Node D. *State: Path = [A, B, C, D]*
    4.  Mandatory Check: The Path *must* include the **Vault** node.
    5.  Endpoint Check: The Path *must* end at an **Exit Point**.
* **Commit:** Player clicks "EXECUTE" to lock the Path and start Phase 3.

### Phase 3: The Simulation (Phaser Render)
* **UI Layer:** Minimal. "CCTV" Overlay.
* **Input:** None. Passive observation.
* **The Loop:**
    ```javascript
    for (let node of Path) {
        moveStackTo(node); // Tween sprite to node position
        resolveEncounter(node, currentCrew);
        if (Heat >= 100) return triggerGameOver();
        if (node.type === "EXIT") return triggerVictory();
    }
    ```

---

## 4. Mechanics & Rules

### Resolution Logic (The Math)
When The Stack enters a Node, the game runs a check:

1.  **Identify Threat:** Node requires **TECH (Difficulty 5)**.
2.  **Identify Hero:** Find Crew Member with highest **TECH**. (e.g., Hacker has 7).
3.  **Calculate Delta:** `Delta = CrewStat - NodeDifficulty`. (7 - 5 = +2).
4.  **RNG Roll:** `Result = Delta + Random(-2 to +2)`. (Simulating variable luck).
    * *Design Note:* This keeps stats important but allows for minor upsets.
5.  **Outcome:**
    * **Critical Success (Result >= 3):** Heat +0%.
    * **Success (Result >= 0):** Heat +0%.
    * **Struggle (Result < 0):** **Heat + (RiskValue * abs(Result))**.
        * *Example:* Failed by 2. Risk is 10%. Heat increases by 20%.

### Heat (The Global Timer)
* Starts at 0%.
* Max is 100%.
* If Heat reaches 100% *during* the run, the Alarm triggers.
* **Fail State:** The Crew automatically flees to the nearest Exit. Loot is lost. Run fails.

---

## 5. Technical Implementation Specs (Phaser + Electron)

### Architecture
* **Electron (Main Process):** Handles window management and file I/O (saving runs).
* **Phaser (Renderer):**
    * **Scene 1 (Blueprint):** Renders the Node Graph. Handles "Clicking" nodes to draw lines.
    * **Scene 2 (Simulation):** Renders the "CCTV" view. Moves a single sprite (The Stack) along the path. Displays "Floating Text" for success/fail.
* **DOM (UI Overlay):**
    * Use absolute positioned `<div>` elements for the Crew Selection, Gear Shop, and Stats Panels.
    * Do not implement complex UI (dropdowns, scrollbars) inside Phaser. Use HTML.

### Data Model (JSON Schema)
```json
{
  "gameState": {
    "cash": 1000,
    "heat": 0,
    "intel": 5
  },
  "map": {
    "nodes": [
      { "id": "n1", "x": 100, "y": 200, "type": "ENTRY", "tags": ["roof"] },
      { "id": "n2", "x": 300, "y": 200, "type": "ROOM", "stat": "TECH", "diff": 4 }
    ],
    "edges": [
      { "from": "n1", "to": "n2" }
    ]
  },
  "crew": [
    { "name": "Dallas", "stats": { "force": 8, "tech": 2, "stealth": 3, "face": 4 } }
  ],
  "currentPath": ["n1", "n2"]
}
```


## 6. MVP Roadmap (Step-by-Step for Agent)

Project Skeleton: Init Electron app with Phaser canvas.

Map Gen: Create a script to generate a static set of Nodes/Edges (Hardcoded Level 1).

Pathing System: Implement logic to click nodes and store them in currentPath array. Visual feedback (draw line).

Simulation Loop: Implement the resolveEncounter() math function and iterating through currentPath. Log results to console.

Visuals: Add Sprites for Map Nodes and The Stack. Add "Heat Bar" UI.