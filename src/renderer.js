import './styles/core.css';
import './styles/map.css';
import './styles/hud.css';
import './styles/command-deck.css';
import './styles/shop.css';
import './styles/job-board.css';
import './styles/setup-phase.css';
import './styles/heist-summary.css';
import { heistSummaryUI } from './ui/HeistSummaryUI';
import { commandCenterUI } from './ui/CommandCenterUI';
import { shopManager } from './ui/ShopManager';
import { setupPhaseUI } from './ui/SetupPhaseUI';
import GameManager from './game/GameManager';
import { JobBoardUI } from './ui/JobBoardUI';
import { UnitContextMenu } from './ui/UnitContextMenu';
import './styles/context-menu.css';
import { GridRenderer, BuildingLoader, Pathfinder, Unit, VisionCone, GridConfig, Task, signalBus, threatClock, radioController, SectorManager, arrangementEngine, Safe, Computer, SecurityPanel, outcomeEngine } from './game/grid/index.js';
import { getMapById, MAP_POOL } from './data/buildings/index.js';
import { debugLog } from './game/DebugConfig.js';
import { initViewManager, switchView, switchDeckTab, getViews } from './app/ViewManager.js';
import { initHUDController, updateGlobalHeat } from './app/HUDController.js';
import { initCrewSpawner, spawnActiveCrew } from './app/CrewSpawner.js';
import { initBuildingSetup, loadBuilding, loadBuildingEntities, getGuardVision } from './app/BuildingSetup.js';

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

// Initialize ViewManager with dependencies
initViewManager({ jobBoardUI });

// Initialize HUD displays
initHUDController();

// Initialize crew spawner
initCrewSpawner();
// Force initial render of Job Board if status matches
if (GameManager.gameState.simulation.status === 'SELECTING_CONTRACT') {
  jobBoardUI.render();
  // Hide default HUD elements initially
  const hudCenter = document.getElementById('hud-center');
  const actionPanel = document.getElementById('action-panel');
  if (hudCenter) hudCenter.style.display = 'none';
  if (actionPanel) actionPanel.style.display = 'none';
}


// 3. Initialize Tile Grid Renderer
let gridRenderer = null;
let tileMap = null;
let pathfinder = null;
let testUnit = null;
let lastUpdateTime = performance.now();

// Building loading moved to src/app/BuildingSetup.js
// Uses: loadBuilding(), loadBuildingEntities(), initBuildingSetup(), getGuardVision()

function initTileGrid() {
  const canvas = document.getElementById('tile-grid-canvas');
  const gameMap = document.getElementById('game-map');

  if (!canvas || !gameMap) return;

  // Calculate viewport size from the game-map container
  const rect = gameMap.getBoundingClientRect();

  // Load initial building from pool (default to bank_heist)
  const defaultMap = MAP_POOL.bank_heist;
  const buildingResult = BuildingLoader.load(defaultMap.building);
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

  // Initialize BuildingSetup with gridRenderer reference
  initBuildingSetup({ gridRenderer });

  // Load initial building entities
  loadBuildingEntities(buildingResult);

  // Initialize Heist Outcome Engine
  window.outcomeEngine = outcomeEngine;
  GameManager.outcomeEngine = outcomeEngine;

  GameManager.gridRenderer = gridRenderer;
  window.gridRenderer = gridRenderer; // Mirror

  // Initialize Radio Controller with units and exit point
  radioController.registerUnits([]);
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
  GameManager.sectorManager = sectorManager;
  window.sectorManager = sectorManager; // Mirror

  // Initialize Arrangement Engine (will be loaded per-building)
  window.arrangementEngine = arrangementEngine;

  // Initialize heist phase state (PLANNING until player clicks EXECUTE HEIST)
  GameManager.heistPhase = 'PLANNING';
  window.heistPhase = GameManager.heistPhase; // Mirror
  threatClock.pause();  // Clock paused during planning

  // NOTE: mapLoaded event is handled later in the file (consolidating handlers)

  // Listen for heist start
  window.addEventListener('startHeist', () => {
    GameManager.heistPhase = 'EXECUTING';
    window.heistPhase = GameManager.heistPhase;
    threatClock.resume();
    console.log('[Heist] EXECUTION PHASE STARTED!');
  });

  // Listen for sector icon (magnifying glass) clicks - purchase intel
  window.addEventListener('sectorIconClicked', (e) => {
    const { sectorId } = e.detail;
    console.log(`[Renderer] Sector icon clicked: ${sectorId}`);

    if (!window.sectorManager) {
      console.error('[Renderer] SectorManager not available');
      return;
    }

    const sector = window.sectorManager.getSector(sectorId);
    if (!sector) {
      console.warn(`[Renderer] Sector not found: ${sectorId}`);
      return;
    }

    if (sector.state === 'HIDDEN') {
      if (window.sectorManager.getIntel() >= sector.intelCost) {
        window.sectorManager.purchaseIntel(sectorId);
        console.log(`[Renderer] Revealed sector: ${sector.name}`);
      } else {
        console.log(`[Renderer] Not enough intel! Need ${sector.intelCost}, have ${window.sectorManager.getIntel()}`);
      }
    }
  });

  // Listen for unit clicks (crew member selection)
  window.addEventListener('unitClicked', (e) => {
    const { unit } = e.detail;
    console.log(`[Renderer] Unit clicked: ${unit.id}`);

    // Select the unit
    window.selectedUnit = unit;

    // Show task queue via UnitContextMenu (uses setUnit which handles show + positioning)
    if (unitContextMenu) {
      unitContextMenu.setUnit(unit);
    }
  });

  // Listen for interactable clicks (show related info if needed)
  window.addEventListener('interactableClicked', (e) => {
    const { interactable } = e.detail;
    console.log(`[Renderer] Interactable clicked: ${interactable.id}`);
    // Currently just logs - could expand to show info panel
  });

  // Start render loop
  gridRenderer.startRenderLoop();

  // Start vision/detection update loop (for guard AI, NOT unit movement)
  setInterval(() => {
    const guardVision = getGuardVision();
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

    // 2. Hidden sectors are revealed ONLY via magnifying glass overlay
    // (handled by GridRenderer overlay click, not tile click)
    // Clicking on hidden tiles does nothing - must use the magnifying glass

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

// View Management moved to src/app/ViewManager.js
// Uses: switchView(), switchDeckTab(), getViews()

// Crew Spawner moved to src/app/CrewSpawner.js
// Uses: spawnActiveCrew(), initCrewSpawner()

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
  const views = getViews();
  views.map.btn.disabled = true;
  views.shop.btn.disabled = true;
});

// Update mapLoaded to spawn crew immediately
window.addEventListener('mapLoaded', (e) => {
  console.log('[Heist] MAP LOADED - ENTERING SETUP PHASE');

  // Load fresh building from contract (may be static or generated)
  const contract = e.detail?.contract || GameManager.gameState.meta.activeContract;
  if (contract?.buildingId) {
    // Pass mapData if this was a generated map (stored in contract)
    loadBuilding(contract.buildingId, contract.mapData || null);
  }

  GameManager.heistPhase = 'PLANNING';
  window.heistPhase = GameManager.heistPhase;

  // Reset ThreatClock for fresh heist
  threatClock.reset();

  sectorManager.reset();
  sectorManager.setIntel(GameManager.gameState.meta.intel || 10);
  arrangementEngine.setCash(GameManager.gameState.meta.cash || 1000);

  // Note: lobby/exterior are now revealed by default in new intel system
  // SectorManager.initFromHiddenZones is called in loadBuilding()

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

// Deck Tab Management moved to src/app/ViewManager.js

window.addEventListener('heistEventLog', () => {
  // Optional: Auto-switch to map if urgent?
});

// Old AAR screen logic removed - heistFinished event was never dispatched
// New flow uses HeistSummaryUI and heistSummaryClosed event

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
  const views = getViews();
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

// HUD Controller (heat, resources) moved to src/app/HUDController.js
