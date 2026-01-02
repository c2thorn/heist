# MVP Development Roadmap: Project CLOCKWORK (v5.0)

## Phase 1: Foundation & Boilerplate
**Goal:** Establish the Electron environment with a running Phaser instance.

* **Step 1.1:** Initialize project with Electron Forge + Vite template.
* **Step 1.2:** Install dependencies: `phaser`, `uuid`.
* **Step 1.3:** Create directory structure:
    * `/src/game/` (Phaser Logic)
    * `/src/ui/` (HTML/CSS Overlay)
    * `/src/data/` (JSON Schemas)
* **Step 1.4:** Initialize `GameManager.js` (Singleton pattern) to hold the `gameState` object defined in `project_clockwork_schema.json`.

## Phase 2: The Map System (Visuals & Data)
**Goal:** Generate a playable graph on the screen.

* **Step 2.1:** Create `MapGenerator.js`. Write a function `generateStaticLevel()` that returns a hardcoded JSON object matching the Schema (Entry -> Hallway -> Vault).
* **Step 2.2:** Create Phaser Scene: `BlueprintScene.js`.
* **Step 2.3:** Implement `NodeSprite` class.
    * Draw a circle graphics object.
    * Color based on `node.type` (Green for Entry, Red for Vault).
* **Step 2.4:** Implement `EdgeGraphics` class. Draw lines between connected nodes based on the JSON `edges` array.

## Phase 3: The Interaction Layer (Planning)
**Goal:** Allow the user to click nodes and build a path array.

* **Step 3.1:** Add interactivity to `NodeSprite`. On 'pointerdown', emit event `NODE_SELECTED`.
* **Step 3.2:** Update `GameManager` to listen for selection.
    * Validation Logic: Check if clicked node ID is in `connectedTo` array of the *last* node in `currentPath`.
* **Step 3.3:** Visual Feedback. Draw a thick yellow line over the edges that are part of the active path.
* **Step 3.4:** Add DOM Button: `<button id="execute-btn">EXECUTE</button>`. Only enabled if the last node in path is `EXIT`.

## Phase 4: The Simulation Loop (Logic)
**Goal:** Run the "Heist" without visuals first (Console Logs).

* **Step 4.1:** Create `SimulationEngine.js`.
* **Step 4.2:** Implement `resolveEncounter(node, crewStack)`:
    * Find max stat in crew.
    * Compare vs Node Difficulty.
    * Update `gameState.resources.heat`.
* **Step 4.3:** Implement the loop: `async runHeist()`. Iterate through `currentPath`, awaiting resolution of each node.

## Phase 5: The Presentation (The Movie)
**Goal:** Connect the Logic to the Sprite movement.

* **Step 5.1:** Create `StackSprite`. A simple square token representing the crew.
* **Step 5.2:** Implement `moveStackTo(node)` using Phaser Tweens.
* **Step 5.3:** Hook logic: Tween finishes -> Run Resolution -> Wait 1s -> Start next Tween.
* **Step 5.4:** Create DOM overlay for "HEAT BAR". Bind it to `gameState.resources.heat`.

## Phase 6: Polish & Crew Draft (Completing the Loop)
**Goal:** Add the "Management" front-end.

* **Step 6.1:** Create HTML Screen: `CrewSelect.html`.
* **Step 6.2:** Render 4 Cards based on `crew` data.
* **Step 6.3:** Connect "Start" button on Crew Select to load the `BlueprintScene`.