---
description: Plan to migrate the node map from Phaser to HTML/CSS/SVG for better visual fidelity.
---

# Plan: Migration to HTML Map

The objective is to replace the `BlueprintScene.js` (Phaser) with a pure DOM-based renderer (`MapRenderer.js`). This allows for richer text styling, CSS animations, and simpler state management for the UI-heavy map interface.

## 1. Architecture Changes

### A. New DOM Structure
We will repurpose the `#game-container` in `index.html` to hold the Map DOM instead of the Phaser Canvas.
Structure:
```html
<div id="game-map">
    <svg id="map-connections" width="100%" height="100%"></svg> <!-- Edges -->
    <div id="map-nodes"></div> <!-- Node Elements -->
    <div id="crew-token"></div> <!-- The Player Stack -->
</div>
```

### B. New `MapRenderer.js`
A class responsible for:
1.  **Rendering**: Taking `GameManager.gameState.map` and generating HTML nodes and SVG lines.
2.  **Updates**: Listening for `scoutNode`, `pathAdded` events to update classes (`.hidden`, `.active`, `.scouted`).
3.  **Interaction**: Binding click events to `GameManager.addToPath()`.
4.  **Animation**: Using CSS transitions for the Crew Token movement instead of Phaser Tweens.

## 2. Implementation Steps

### Step 1: Prepare HTML & CSS
1.  Update `index.html` to include the `#game-map` structure inside `#game-container`.
2.  Add CSS to `index.css`:
    - `#game-map`: Full screen relative container.
    - `.node-hex`: Absolute positioned div using `clip-path` or background image for hexagon shape.
    - `.node-hex:hover`: Glow effects.
    - `.map-edge`: SVG line styling.
    - `#crew-token`: Absolute div with `transition: all 0.5s ease`.

### Step 2: Implement `src/ui/MapRenderer.js`
Create the renderer logic to:
- Iterate `mapData.nodes` -> Create `<div class="node-hex" style="left:x; top:y">`.
- Iterate `mapData.edges` -> Create `<line x1, y1, x2, y2>` in the SVG.
- Handle `onNodeClick`.

### Step 3: Refactor `renderer.js`
- Remove Phaser initialization.
- Initialize `MapRenderer` instead.
- Ensure `MapRenderer` subscribes to the same events `BlueprintScene` did (`startHeist`, `nextDayStarted`).

### Step 4: Visual Polish
- Tune the CSS for the "Cyberpunk" aesthetic.
- Use the generated `node_hex.png` as the background for the nodes.
- Add CSS animations for the "Pulse" effect on active nodes.

## 3. Handling Complexity
- **Coordinates**: `MapGenerator` produces Window-relative coordinates (0 to `window.innerHeight`). This maps 1:1 to absolute pixels.
- **Z-Indexing**: SVG Bundle (Edges) at Z:0. Nodes at Z:10. Token at Z:20. HTML HUD overlay at Z:100.

## 4. Verification
- Confirm map generates with correct layout.
- Confirm clicking nodes builds a path (highlight edges).
- Confirm "Execute" moves the token visually.
