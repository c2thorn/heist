import './styles/core.css';
import './styles/map.css';
import './styles/hud.css';
import './styles/command-deck.css';
import './styles/shop.css';
import './styles/aar.css';
import './styles/job-board.css';
import './styles/setup-phase.css';
import './styles/heist-summary.css';
import { MapRenderer } from './ui/map/MapRenderer';
import { heistSummaryUI } from './ui/HeistSummaryUI';
import { commandCenterUI } from './ui/CommandCenterUI';
import { shopManager } from './ui/ShopManager';
import { setupPhaseUI } from './ui/SetupPhaseUI';
import GameManager from './game/GameManager';
import { MapGenerator } from './game/MapGenerator';
import { SimulationEngine } from './game/SimulationEngine';
import { JobBoardUI } from './ui/JobBoardUI';
import { UnitContextMenu } from './ui/UnitContextMenu';
import './styles/context-menu.css';
import { GridRenderer, BuildingLoader, Pathfinder, Unit, VisionCone, GridConfig, Task, signalBus, threatClock, radioController, SectorManager, arrangementEngine, Safe, Computer, SecurityPanel, outcomeEngine } from './game/grid/index.js';
import bankHeistData from './data/buildings/bank_heist.json';
import bankHeistArrangements from './data/arrangements/bank_heist_arrangements.json';

let unitContextMenu = null;

// Expose GameManager globally for inline scripts
window.GameManager = GameManager;

console.log('Renderer process started. Initializing Command Center...');

// 1. Initial State Preparation
// Start with NO map -> Force Job Board on Day 1
GameManager.gameState.map = null;
GameManager.gameState.simulation.status = "SELECTING_CONTRACT";

// 2. Initialize UI Managers
commandCenterUI.init();
shopManager.init();
GameManager.refreshShop(); // Initial shop generation
const jobBoardUI = new JobBoardUI('game-map'); // Overlay on game map

// Force initial render of Job Board if status matches
if (GameManager.gameState.simulation.status === 'SELECTING_CONTRACT') {
  jobBoardUI.render();
  // Hide default HUD elements initially
  const hudCenter = document.getElementById('hud-center');
  const actionPanel = document.getElementById('action-panel');
  if (hudCenter) hudCenter.style.display = 'none';
  if (actionPanel) actionPanel.style.display = 'none';
}

// 3. Initialize HTML Map Renderer (legacy node-based)
const mapRenderer = new MapRenderer();
mapRenderer.init();

// 4. Initialize Tile Grid Renderer
let gridRenderer = null;
let tileMap = null;
let pathfinder = null;
let testUnit = null;
let guardVision = null;
let lastUpdateTime = performance.now();

function initTileGrid() {
  const canvas = document.getElementById('tile-grid-canvas');
  const gameMap = document.getElementById('game-map');

  if (!canvas || !gameMap) return;

  // Calculate viewport size from the game-map container
  const rect = gameMap.getBoundingClientRect();

  // Load building from JSON data
  const buildingResult = BuildingLoader.load(bankHeistData);
  tileMap = buildingResult.tileMap;

  // Store in GameManager (primary state)
  GameManager.tileMap = tileMap;
  window.tileMap = tileMap; // Mirror for transition

  // Create renderer with viewport matching the map area
  gridRenderer = new GridRenderer(canvas, tileMap, {
    viewportWidth: rect.width,
    viewportHeight: rect.height
  });

  // Initialize pathfinder
  pathfinder = new Pathfinder(tileMap);
  GameManager.pathfinder = pathfinder;
  window.pathfinder = pathfinder; // Mirror

  // Add guards from building data
  for (const guard of buildingResult.guards) {
    gridRenderer.addUnit(guard);
  }

  // Add vision cones from building data
  for (const cone of buildingResult.visionCones) {
    gridRenderer.addVisionCone(cone);
    guardVision = cone; // Store for animation loop
  }

  // Store guard reference for animation (first guard or null)
  window.testGuard = buildingResult.guards[0] || null;

  // Initialize empty units list for Heist Start
  GameManager.units = [];
  GameManager.selectedUnit = null;
  window.allUnits = GameManager.units; // Mirror
  window.selectedUnit = null; // Mirror

  // Expose Task and signalBus for console testing
  window.Task = Task;
  window.signalBus = signalBus;

  // Add interactables from building data
  for (const interactable of buildingResult.interactables) {
    gridRenderer.addInteractable(interactable);
  }

  // Store crew spawn points
  GameManager.crewSpawns = buildingResult.crewSpawns;
  window.crewSpawns = GameManager.crewSpawns; // Mirror

  // Add extraction points from building data
  GameManager.extractionPoints = buildingResult.extractionPoints || [];
  window.extractionPoints = GameManager.extractionPoints;
  for (const exitPoint of GameManager.extractionPoints) {
    gridRenderer.addEntity(exitPoint);
  }

  // Initialize Heist Outcome Engine
  window.outcomeEngine = outcomeEngine;
  GameManager.outcomeEngine = outcomeEngine;

  GameManager.gridRenderer = gridRenderer;
  window.gridRenderer = gridRenderer; // Mirror

  // Initialize Radio Controller with units and exit point
  radioController.registerUnits([]);
  // Use default extraction point if available
  const defaultExit = buildingResult.extractionPoints?.find(p => p.isDefault)
    || buildingResult.extractionPoints?.[0]
    || { x: 15, y: 28 };
  radioController.setExitTile({ x: defaultExit.gridX || defaultExit.x, y: defaultExit.gridY || defaultExit.y });
  window.radioController = radioController;
  window.threatClock = threatClock;

  // Initialize Sector Manager with intel costs per zone
  const sectorManager = new SectorManager(tileMap);
  sectorManager.defineSector('lobby', { intelCost: 1, difficulty: 1 });
  sectorManager.defineSector('hallway', { intelCost: 1, difficulty: 1 });
  sectorManager.defineSector('office', { intelCost: 2, difficulty: 2 });
  sectorManager.defineSector('security', { intelCost: 3, difficulty: 3 });
  sectorManager.defineSector('server', { intelCost: 3, difficulty: 3 });
  sectorManager.defineSector('vault', { intelCost: 4, difficulty: 4 });
  sectorManager.defineSector('exterior', { intelCost: 1, difficulty: 0 });

  // Reveal initial sectors from building data
  if (bankHeistData.initiallyRevealed) {
    for (const zoneId of bankHeistData.initiallyRevealed) {
      sectorManager.purchaseIntel(zoneId);
    }
  }
  GameManager.sectorManager = sectorManager;
  window.sectorManager = sectorManager; // Mirror

  // Initialize Arrangement Engine with sample assets
  // Load arrangements from JSON data file
  arrangementEngine.loadFromData(bankHeistArrangements);
  window.arrangementEngine = arrangementEngine;

  // Initialize heist phase state (PLANNING until player clicks EXECUTE HEIST)
  GameManager.heistPhase = 'PLANNING';
  window.heistPhase = GameManager.heistPhase; // Mirror
  threatClock.pause();  // Clock paused during planning

  // Listen for map load (from Job Board)
  window.addEventListener('mapLoaded', () => {
    console.log('[Heist] MAP LOADED - ENTERING SETUP PHASE');
    GameManager.heistPhase = 'PLANNING';
    window.heistPhase = GameManager.heistPhase;

    // Reset ThreatClock for fresh heist (reset starts paused)
    threatClock.reset();

    // Reset/Setup Managers
    sectorManager.reset();
    sectorManager.setIntel(GameManager.gameState.meta.intel || 10);
    arrangementEngine.reset();
    arrangementEngine.setCash(GameManager.gameState.meta.cash || 1000);

    // Reveal lobby and exterior for context
    sectorManager.purchaseIntel('lobby');
    sectorManager.purchaseIntel('exterior');

    // Center camera on the lobby/entry (approx 16, 25)
    if (window.gridRenderer) {
      const ts = GridConfig.TILE_SIZE;
      window.gridRenderer.camera.x = 16 * ts - window.gridRenderer.camera.width / 2;
      window.gridRenderer.camera.y = 25 * ts - window.gridRenderer.camera.height / 2;
    }

    // Show Setup UI
    setupPhaseUI.show();
  });

  // Listen for heist start
  window.addEventListener('startHeist', () => {
    GameManager.heistPhase = 'EXECUTING';
    window.heistPhase = GameManager.heistPhase;
    threatClock.resume();
    console.log('[Heist] EXECUTION PHASE STARTED!');
  });

  // Start render loop
  gridRenderer.startRenderLoop();

  // Start vision/detection update loop (for guard AI, NOT unit movement)
  setInterval(() => {
    if (!guardVision || !window.allUnits) return;

    // Always track time to prevent deltaTime jumps
    const now = performance.now();
    const deltaTime = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;

    // PAUSE AI DURING PLANNING
    if (window.heistPhase === 'PLANNING') return;

    // NOTE: Unit movement is handled by gameLoop, NOT here!
    // The taskProcessor.update() was causing double-updates and teleporting.

    // Update ThreatClock (only during execution phase)
    if (window.heistPhase === 'EXECUTING') {
      // Cap deltaTime to prevent huge jumps (e.g., from tab being backgrounded)
      const safeDelta = Math.min(deltaTime, 0.1);
      threatClock.update(safeDelta);
    }

    // Apply threat modifiers to guard vision
    const modifiers = threatClock.getModifiers();
    if (guardVision) {
      guardVision.fov = modifiers.fov;
      guardVision.detectionRate = modifiers.detectionRate;
    }

    // Rotate guard vision slowly (for demo)
    const angle = (Date.now() / 50) % 360;
    const guard = window.testGuard;
    if (guard) {
      guardVision.setPosition(
        guard.worldPos.x,
        guard.worldPos.y,
        90 + Math.sin(Date.now() / 2000) * 45  // Sweep back and forth
      );
    }

    // Check each crew unit against the vision cone
    for (const unit of window.allUnits) {
      const visibility = guardVision.checkVisibility(
        tileMap,
        unit.worldPos.x,
        unit.worldPos.y,
        unit.stance
      );

      const detection = guardVision.updateDetection(
        unit.id,
        visibility.visible,
        visibility.distance,
        unit.stance,
        deltaTime
      );

      // Log detection events
      if (detection.state === 'DETECTED') {
        if (!unit._wasDetected) {
          console.log('🚨 DETECTED:', unit.id);
          unit._wasDetected = true;
        }
      } else if (detection.state === 'SUSPICIOUS') {
        if (!unit._wasSuspicious) {
          console.log('❓ Suspicious of:', unit.id, `(${Math.round(detection.value * 100)}%)`);
          unit._wasSuspicious = true;
          unit._wasDetected = false;
        }
      } else {
        unit._wasSuspicious = false;
        unit._wasDetected = false;
      }
    }
  }, 50);  // 20 times per second

  // Enable tile grid mode (hides legacy map elements)
  gameMap.classList.add('tile-grid-mode');

  console.log('Tile grid initialized:', rect.width, 'x', rect.height);
  console.log('Two units + guard with vision cone. Watch for detection!');
}

// Handle unit selection via keyboard
window.addEventListener('keydown', (e) => {
  if (e.key === '1' && window.allUnits?.[0]) {
    window.selectedUnit = window.allUnits[0];
    console.log('Selected:', window.selectedUnit.id, '(green)');
  } else if (e.key === '2' && window.allUnits?.[1]) {
    window.selectedUnit = window.allUnits[1];
    console.log('Selected:', window.selectedUnit.id, '(orange)');
  }
});

// Handle click-to-move or click-to-interact
window.addEventListener('tileClicked', async (e) => {
  // --- SETUP PHASE INTERACTION ---
  if (window.heistPhase === 'PLANNING') {
    const tile = e.detail;
    const ts = window.GridConfig?.TILE_SIZE || 32;

    // 1. Check for Asset Icons
    const assets = window.arrangementEngine?.available || [];
    const clickedAsset = assets.find(a =>
      a.payload && a.payload.x === tile.x && a.payload.y === tile.y
    );

    if (clickedAsset) {
      // Check requirement visibility
      if (clickedAsset.reqSector && !window.sectorManager.isSectorRevealed(clickedAsset.reqSector)) return;

      if (!clickedAsset.purchased) {
        if (window.arrangementEngine.getCash() >= clickedAsset.cost) {
          window.arrangementEngine.purchase(clickedAsset.id);
          console.log(`Purchased asset: ${clickedAsset.name}`);
        } else {
          console.log('Not enough cash!');
        }
      }
      return; // Stop processing
    }

    // 2. Check for Hidden Sector (Blueprint)
    const clickedTile = tileMap.getTile(tile.x, tile.y);
    if (clickedTile && clickedTile.zoneId) {
      const sector = window.sectorManager?.getSector(clickedTile.zoneId);
      // Only interact if hidden
      if (sector && sector.state === 'HIDDEN') {
        // Buy intel
        if (window.sectorManager.getIntel() >= sector.intelCost) {
          window.sectorManager.purchaseIntel(sector.id);
          console.log(`Revealed sector: ${sector.name}`);
        } else {
          console.log('Not enough intel!');
        }
        return; // Stop processing
      }
    }

    // 3. LEGACY TILE CLICK → GOAL CREATION REMOVED
    // Goals are now added via the UnitContextMenu objective palette only.
    // Clicking the map no longer adds MOVE/INTERACT goals directly.

    return; // In planning mode, don't move units directly
  }

  // --- EXECUTION PHASE INTERACTION ---

  // 0. CHECK FOR UNIT SELECTION
  // If we clicked on a friendly unit, select it!
  const clickedUnit = window.allUnits?.find(u =>
    Math.round(u.gridPos.x) === tile.x &&
    Math.round(u.gridPos.y) === tile.y
  );

  if (clickedUnit) {
    window.selectedUnit = clickedUnit;
    console.log('Selected Unit:', clickedUnit.id);
    // TODO: Add visual selection ring update here if needed (GridRenderer usually highlights selectedUnit if we passed it down)
    return;
  }

  const unit = window.selectedUnit;
  if (!unit || !pathfinder) return;

  const tile = e.detail;

  // Check if there's an interactable at this tile
  const interactable = window.gridRenderer?.getInteractableAt(tile.x, tile.y);
  if (interactable && interactable.state !== 'COMPLETED') {
    // Assign INTERACT task instead of MOVE
    console.log(`Interacting with ${interactable.label}...`);
    unit.assignTask(Task.interact(interactable));
    return;
  }

  // Check if tile is walkable
  const targetTile = tileMap.getTile(tile.x, tile.y);
  if (!targetTile || !targetTile.isWalkable) {
    console.log('Cannot move there - tile is not walkable');
    return;
  }

  // Check if tile is occupied by another unit
  if (targetTile.occupantId && targetTile.occupantId !== unit.id) {
    console.log('Tile occupied by', targetTile.occupantId);
    return;
  }

  // Find path, avoiding tiles occupied by other units
  window.allUnits?.forEach(u => {
    if (u.id !== unit.id) {
      pathfinder.avoidTile(u.gridPos.x, u.gridPos.y);
    }
  });

  const path = await pathfinder.findPath(
    unit.gridPos.x, unit.gridPos.y,
    tile.x, tile.y
  );

  // Clear avoids
  pathfinder.clearAllAvoidTiles();

  if (path) {
    console.log('Path found:', path.length, 'steps');
    unit.setPath(path);
  } else {
    console.log('No path found to destination');
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  if (gridRenderer) {
    const gameMap = document.getElementById('game-map');
    if (gameMap) {
      const rect = gameMap.getBoundingClientRect();
      gridRenderer.setViewport(rect.width, rect.height);
    }
  }
});

// Initialize grid after DOM is ready
setTimeout(initTileGrid, 100);

// 4. View Management Logic
const views = {
  map: {
    btn: document.getElementById('btn-view-map'),
    elements: ['hud-center', 'action-panel'] // Removed hud-top
  },
  shop: {
    btn: document.getElementById('btn-view-shop'),
    elements: ['shop-screen']
  }
};

function switchView(viewKey) {
  // Prevent switching during simulation
  if (SimulationEngine.isRunning) return;

  // Update Buttons
  Object.keys(views).forEach(key => {
    if (key === viewKey) views[key].btn.classList.add('active');
    else views[key].btn.classList.remove('active');

    // Toggle Elements
    views[key].elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (key === viewKey) {
          // Special handling for MAP view vs JOB BOARD
          if (key === 'map' && !GameManager.gameState.map) {
            // If checking map but no map exists -> Show Job Board
            jobBoardUI.render();
            // We might want to hide the HUD center/action panel if Job Board is full screen?
            // For now let's keep them but ensure Job Board is on top.
            el.style.display = (id === 'hud-center' || id === 'action-panel') ? 'none' : 'flex'; // Hide usual HUD in job board
          } else {
            el.style.display = (id === 'hud-center' || id === 'action-panel') ? 'flex' : 'block';
            if (key === 'map') jobBoardUI.hide();
          }
        } else {
          el.style.display = 'none';
        }
      }
    });
  });

  if (viewKey === 'shop') {
    shopManager.updateUI();
    jobBoardUI.hide();
  }
}

views.map.btn.addEventListener('click', () => switchView('map'));
views.shop.btn.addEventListener('click', () => switchView('shop'));

// ...

window.addEventListener('nextDayStarted', () => {
  // Switch to Map view default interaction when day starts
  // But since map is null, it will show Job Board.
  switchView('map');
});

// --- SPAWN LOGIC ---
function spawnActiveCrew() {
  const activeCrew = GameManager.gameState.crew.activeStack;
  console.log('Spawning/Updating Roster:', activeCrew);

  // Clear existing units
  if (GameManager.units.length > 0) {
    GameManager.units.forEach(u => window.gridRenderer.removeUnit(u.id));
    GameManager.units.length = 0;  // Clear without breaking window.allUnits reference
  }

  // Entry Point - Find a walkable tile near intended spawn
  let entryX = 15;
  let entryY = 26; // Try a bit higher up

  // Search for a walkable tile if the default isn't walkable
  const findWalkableSpawn = (startX, startY) => {
    // Check in a small spiral around the target
    const offsets = [
      [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [2, 0], [-2, 0], [0, 2], [0, -2]
    ];
    for (const [dx, dy] of offsets) {
      const tile = GameManager.tileMap.getTile(startX + dx, startY + dy);
      if (tile && tile.isWalkable) {
        return { x: startX + dx, y: startY + dy };
      }
    }
    return { x: startX, y: startY }; // Fallback
  };

  const spawn = findWalkableSpawn(entryX, entryY);
  console.log(`[Spawn] Found walkable entry at (${spawn.x}, ${spawn.y})`);

  activeCrew.forEach((member, index) => {
    // Stagger spawn positions
    const x = spawn.x + (index % 2);
    const y = spawn.y + Math.floor(index / 2);

    const unit = new Unit(member.id, x, y, GameManager.tileMap);
    unit.color = '#00ff88'; // Default crew color

    // Assign Role Colors
    const s = member.stats;
    if (s.force >= s.tech && s.force >= s.stealth) unit.color = '#ff4444';
    else if (s.tech >= s.force && s.tech >= s.stealth) unit.color = '#0088ff';
    else unit.color = '#00ff88';

    GameManager.gridRenderer.addUnit(unit);
    unit.setPathfinder(GameManager.pathfinder);
    unit.isFriendly = true;

    GameManager.units.push(unit);
  });

  // Defaults & Camera Focus
  if (window.allUnits.length > 0) {
    window.selectedUnit = window.allUnits[0];
    window.planningUnitId = window.selectedUnit.id; // Sync planner selection

    // Force Camera Center on Squad
    if (window.gridRenderer) {
      const firstUnit = window.allUnits[0];
      window.gridRenderer.camera.x = firstUnit.worldPos.x - window.gridRenderer.camera.width / 2;
      window.gridRenderer.camera.y = firstUnit.worldPos.y - window.gridRenderer.camera.height / 2;
      window.gridRenderer._clampCamera(); // Ensure we don't show void
    }

    setupPhaseUI.refresh();
  }
}

// Listen for Roster Changes during Planning
GameManager.events.on('crew-updated', () => {
  console.log('[Renderer] Crew Updated Event received. Phase:', window.heistPhase);
  if (window.heistPhase === 'PLANNING') {
    spawnActiveCrew();
  }
});

window.addEventListener('startHeist', () => {
  console.log('--- EXECUTION STARTED ---');
  GameManager.heistPhase = 'EXECUTING';
  window.heistPhase = GameManager.heistPhase;
  threatClock.resume();

  // Initialize Heist Outcome Engine with current heist data
  if (window.outcomeEngine) {
    const scoreData = GameManager.scoreData || bankHeistData.score;
    const sideScoreData = GameManager.sideScoreData || bankHeistData.sideScores || [];
    const extractionPoints = GameManager.extractionPoints || [];
    const crewCount = window.allUnits?.filter(u => u.isFriendly).length || 0;

    window.outcomeEngine.initialize(scoreData, sideScoreData, extractionPoints, crewCount);
  }

  // Auto-switch back to Roster Tab
  switchDeckTab('roster');
  setupPhaseUI.hide();

  // TaskProcessor now reads objectives directly from GameManager.gameState.simulation.plan
  // No legacy hydration needed - just log for debugging
  window.allUnits.forEach(unit => {
    // DEBUG: Log unit position at execution start
    console.log(`[EXEC START] ${unit.id} gridPos: (${unit.gridPos.x},${unit.gridPos.y}) worldPos: (${Math.round(unit.worldPos.x)},${Math.round(unit.worldPos.y)})`);

    const plan = GameManager.gameState.simulation.plan[unit.id];
    if (plan && plan.length > 0) {
      console.log(`[${unit.id}] has ${plan.length} objectives queued`);
    }
  });

  // Register Radio
  if (window.radioController) {
    window.radioController.registerUnits(window.allUnits);
    window.radioController.renderAbilities('ability-buttons');
  }

  // Lock View Tabs during heist
  views.map.btn.disabled = true;
  views.shop.btn.disabled = true;
});

// Update mapLoaded to spawn crew immediately
window.addEventListener('mapLoaded', () => {
  // ... items from previous mapLoaded ...
  console.log('[Heist] MAP LOADED - ENTERING SETUP PHASE');
  GameManager.heistPhase = 'PLANNING';
  window.heistPhase = GameManager.heistPhase;

  sectorManager.reset();
  sectorManager.setIntel(GameManager.gameState.meta.intel || 10);
  arrangementEngine.reset();
  arrangementEngine.setCash(GameManager.gameState.meta.cash || 1000);

  sectorManager.purchaseIntel('lobby');
  sectorManager.purchaseIntel('exterior');

  // Initialize specific UI components
  if (!unitContextMenu) {
    unitContextMenu = new UnitContextMenu();
  }

  // Restore HUD Visibility
  switchView('map');
  const hudCenter = document.getElementById('hud-center');
  const actionPanel = document.getElementById('action-panel');
  if (hudCenter) hudCenter.style.display = 'flex';
  if (actionPanel) actionPanel.style.display = 'flex';

  if (window.gridRenderer) {
    const ts = GridConfig.TILE_SIZE;
    window.gridRenderer.camera.x = 16 * ts - window.gridRenderer.camera.width / 2;
    window.gridRenderer.camera.y = 25 * ts - window.gridRenderer.camera.height / 2;
  }

  setupPhaseUI.show();
  switchDeckTab('roster');

  const threatLabel = document.getElementById('threat-label');
  if (threatLabel) threatLabel.textContent = '⏸ PLANNING — Click EXECUTE to start';

  const execBtn = document.getElementById('execute-btn');
  if (execBtn) {
    execBtn.style.display = 'block';
    execBtn.onclick = () => {
      console.log('--- EXECUTION STARTED ---');
      GameManager.heistPhase = 'EXECUTING';
      window.heistPhase = GameManager.heistPhase;

      // Hide Planning UI
      setupPhaseUI.hide();
      if (unitContextMenu) unitContextMenu.hide(); // Hide queue editor

      // Update HUD
      if (threatLabel) threatLabel.textContent = '▶ EXECUTING';
      execBtn.style.display = 'none';
    };
  }

  // Spawn Crew Immediately
  spawnActiveCrew();

  // Selection Logic: Tile Click -> Select Unit
  window.addEventListener('tileClicked', (e) => {
    if (window.heistPhase !== 'PLANNING') return; // Only in planning for now

    const tile = e.detail;
    // Find unit on this tile
    const clickedUnit = window.allUnits.find(u => u.isAt(tile.x, tile.y));

    if (clickedUnit) {
      console.log('Selected Unit:', clickedUnit.id);
      window.selectedUnit = clickedUnit;
      window.planningUnitId = clickedUnit.id;

      if (unitContextMenu) {
        unitContextMenu.setUnit(clickedUnit);
      }
      setupPhaseUI.refresh(); // Sync sidebar if needed
    } else {
      // Deselect if clicked empty space? Or keep selected?
      // Keeping selected is better for workflow usually, unless clicking void.
      // For now, allow clicking empty tile to just move camera or do nothing.
    }
  });

  // Start a loop to update menu position
  // Start Main Game Loop
  let lastTime = 0;
  const gameLoop = (timestamp) => {
    const dt = (timestamp - lastTime) / 1000; // Delta time in seconds
    lastTime = timestamp;

    // 1. Update Menu (AR UI)
    if (unitContextMenu && unitContextMenu.isVisible) {
      unitContextMenu.updatePosition();
    }

    // 2. Update Units (AI Brains)
    // Limit dt to prevent huge jumps if tab was backgrounded
    const safeDt = Math.min(dt, 0.1);

    if (window.heistPhase === 'EXECUTING' && window.allUnits) {
      window.allUnits.forEach(unit => unit.update(safeDt));

      // DEBUG: Log positions every 5 frames (toggle with window.DEBUG_MOVEMENT = true)
      if (window.DEBUG_MOVEMENT) {
        window._debugFrame = (window._debugFrame || 0) + 1;
        if (window._debugFrame % 5 === 0) {
          window.allUnits.forEach(unit => {
            console.log(`[TICK ${window._debugFrame}] ${unit.id} world:(${Math.round(unit.worldPos.x)},${Math.round(unit.worldPos.y)}) grid:(${unit.gridPos.x},${unit.gridPos.y})`);
          });
        }
      }
    }

    requestAnimationFrame(gameLoop);
  };
  requestAnimationFrame(gameLoop);

});


// --- DECK TAB MANAGEMENT ---
function switchDeckTab(tabName) {
  // 1. Update Tabs
  document.querySelectorAll('.deck-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.getElementById(`tab-${tabName}`);
  if (activeTab) activeTab.classList.add('active');

  // 2. Update Pages
  document.querySelectorAll('.deck-page').forEach(p => p.classList.remove('active'));
  const activePage = document.getElementById(`deck-page-${tabName}`);
  if (activePage) activePage.classList.add('active');
}

// Bind Tab Clicks
document.getElementById('tab-roster')?.addEventListener('click', () => switchDeckTab('roster'));
document.getElementById('tab-planning')?.addEventListener('click', () => switchDeckTab('planning'));


window.addEventListener('heistEventLog', () => {
  // Optional: Auto-switch to map if urgent?
});

// --- AAR SCREEN LOGIC ---
window.addEventListener('heistFinished', (e) => {
  // Unlock View Tabs
  views.map.btn.disabled = false;
  views.shop.btn.disabled = false;
  updateGlobalHeat();

  const result = e.detail;
  if (!result) return; // Legacy fallback

  const screen = document.getElementById('game-results-screen');
  const title = document.getElementById('results-title');
  const msg = document.getElementById('results-msg');
  const btn = document.getElementById('results-btn');

  if (screen && title && msg) {
    screen.style.display = 'flex';

    // Set Title
    title.innerText = result.success ? "HEIST SUCCESSFUL" : "HEIST FAILED";
    title.style.color = result.success ? "#00ff88" : "#ff4444";

    // Build Breakdown HTML
    let html = `<div class="aar-breakdown">`;

    // Loot
    html += `<div class="aar-row"><span class="label">GROSS LOOT</span><span class="value success">+$${result.loot || 0}</span></div>`;

    // Expenses
    if (result.expenses) {
      if (result.expenses.wages > 0) {
        html += `<div class="aar-row"><span class="label">CREW WAGES</span><span class="value danger">-$${result.expenses.wages}</span></div>`;
      }
      if (result.expenses.assets > 0) {
        html += `<div class="aar-row"><span class="label">ASSETS/INTEL</span><span class="value danger">-$${result.expenses.assets}</span></div>`;
      }
    }

    html += `<div class="aar-divider"></div>`;

    // Net
    const netClass = (result.netProfit >= 0) ? 'success' : 'danger';
    const sign = (result.netProfit >= 0) ? '+' : '';
    html += `<div class="aar-row total"><span class="label">NET PROFIT</span><span class="value ${netClass}">${sign}$${result.netProfit}</span></div>`;

    html += `</div>`; // Close breakdown

    // Heat Warning
    if (result.heat >= 100) {
      html += `<div class="aar-alert">⚠️ MAX HEAT REACHED - CREW BURNED</div>`;
    }

    msg.innerHTML = html;

    // Button Handler (One-time binding cleanup needed?)
    // Simplest: Clone button to strip listeners, or use onclick
    btn.onclick = () => {
      screen.style.display = 'none';

      // Return to Safehouse / Next Day
      GameManager.startNextDay();

      // StartNextDay sets status to SELECTING_CONTRACT
      // Renderer logic (initTileGrid/switchView) needs to handle this transition
      // Dispatch event manually if needed, but startNextDay does internal state update.
      // We need to tell the view to switch.
      window.dispatchEvent(new CustomEvent('nextDayStarted'));

      // Hide overlay elements
      jobBoardUI.render(); // Force job board?
    };
  }
});

window.addEventListener('heatLaundered', () => updateGlobalHeat());
window.addEventListener('heistEventLog', () => updateGlobalHeat()); // Live updates during heist
window.addEventListener('heatChanged', () => updateGlobalHeat());   // Heat from zones, captures, alarms

// Handle new heist summary flow (HeistOutcomeEngine → HeistSummaryUI)
window.addEventListener('heistSummaryClosed', () => {
  console.log('[Renderer] Heist summary closed, transitioning to next day...');

  // Apply payout to player's cash
  const outcome = window.outcomeEngine?.outcome;
  if (outcome?.payout > 0) {
    GameManager.addCash(outcome.payout);
    console.log(`  Added $${outcome.payout} to cash`);
  }

  // Unlock navigation
  views.map.btn.disabled = false;
  views.shop.btn.disabled = false;

  // Reset heist phase
  GameManager.heistPhase = 'PLANNING';
  window.heistPhase = 'PLANNING';

  // Transition to next day
  GameManager.startNextDay();
  window.dispatchEvent(new CustomEvent('nextDayStarted'));

  // Show job board
  jobBoardUI.render();
});

function updateGlobalHeat() {
  const heat = Math.min(100, Math.max(0, GameManager.gameState.resources.heat));
  const fill = document.getElementById('heat-bar-fill');
  const label = document.getElementById('heat-label');

  if (fill) {
    fill.style.width = `${heat}%`;

    // Dynamic Color Interpolation: Blue (0, 0, 255) -> Red (255, 0, 0)
    // We can use HSL for cleaner transition: Blue(240) -> Red(0)
    // But direct RGB interpolation might feel more "heat" like (purple middle state)
    // Let's go with a custom gradient: Blue -> Purple -> Red -> Fire

    let color = '';

    if (heat < 50) {
      // Cool Blue to Purple
      // 0% -> rgb(0, 100, 255)
      // 50% -> rgb(200, 0, 200)
      const ratio = heat / 50;
      const r = Math.floor(0 + 200 * ratio);
      const g = Math.floor(100 * (1 - ratio));
      const b = Math.floor(255 * (1 - ratio * 0.2));
      color = `rgb(${r}, ${g}, ${b})`;
    } else {
      // Purple to Hot Red
      // 50% -> rgb(200, 0, 200)
      // 100% -> rgb(255, 50, 0)
      const ratio = (heat - 50) / 50;
      const r = Math.floor(200 + 55 * ratio);
      const g = Math.floor(50 * ratio);
      const b = Math.floor(200 * (1 - ratio));
      color = `rgb(${r}, ${g}, ${b})`;
    }

    fill.style.backgroundColor = color;

    // Use CSS classes for the pulsing/glow animation effects
    fill.className = '';
    if (heat >= 80) fill.classList.add('high-heat');
    else if (heat >= 50) fill.classList.add('med-heat');
  }

  if (label) {
    label.innerText = `SYSTEM HEAT: ${Math.round(heat)}%`;
    if (heat >= 80) label.style.color = '#ff4444';
    else if (heat >= 50) label.style.color = '#ffcc00';
    else label.style.color = '#888';
  }
}

function updateGlobalResources() {
  const intel = GameManager.gameState.meta.intel;
  const cash = GameManager.gameState.meta.cash;

  const intelLabel = document.getElementById('intel-display');
  if (intelLabel) intelLabel.innerText = `INTEL: ${intel}`;

  const cashLabel = document.getElementById('cash-display');
  if (cashLabel) cashLabel.innerText = `CASH: $${cash}`;
}



window.addEventListener('intelPurchased', updateGlobalResources);
window.addEventListener('nextDayStarted', updateGlobalResources);

updateGlobalHeat();
updateGlobalResources();
