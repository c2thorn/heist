import './styles/core.css';
import './styles/map.css';
import './styles/hud.css';
import './styles/command-deck.css';
import './styles/shop.css';
import './styles/aar.css';
import './styles/job-board.css';
import { MapRenderer } from './ui/map/MapRenderer';
import { commandCenterUI } from './ui/CommandCenterUI';
import { shopManager } from './ui/ShopManager';
import GameManager from './game/GameManager';
import { MapGenerator } from './game/MapGenerator';
import { SimulationEngine } from './game/SimulationEngine';
import { JobBoardUI } from './ui/JobBoardUI';
import { GridRenderer, TestMapGenerator, Pathfinder, Unit, VisionCone, GridConfig, Task, signalBus, threatClock, radioController, SectorManager, arrangementEngine } from './game/grid/index.js';

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

  // Generate a test building for now
  tileMap = TestMapGenerator.generateSimpleBuilding();

  // Open some doors for pathfinding
  const door1 = tileMap.getTile(15, 22);
  const door2 = tileMap.getTile(16, 22);
  if (door1) door1.openDoor();
  if (door2) door2.openDoor();

  // Create renderer with viewport matching the map area
  gridRenderer = new GridRenderer(canvas, tileMap, {
    viewportWidth: rect.width,
    viewportHeight: rect.height
  });

  // Initialize pathfinder
  pathfinder = new Pathfinder(tileMap);

  // Create two test units for collision testing
  testUnit = new Unit('crew_1', 15, 25, tileMap);
  testUnit.color = '#00ff88';  // Green
  gridRenderer.addUnit(testUnit);

  const testUnit2 = new Unit('crew_2', 16, 25, tileMap);
  testUnit2.color = '#ff8800';  // Orange
  gridRenderer.addUnit(testUnit2);

  // Create a test guard with vision cone
  const guard = new Unit('guard_1', 15, 18, tileMap);
  guard.color = '#ff4444';  // Red
  guard.radius = 10;
  gridRenderer.addUnit(guard);

  // Create vision cone for the guard (facing down, 90 degree FOV, 6 tile range)
  guardVision = new VisionCone({
    range: 6,
    fov: 90,
    detectionRate: 0.8
  });
  guardVision.setPosition(
    guard.gridPos.x * GridConfig.TILE_SIZE + GridConfig.TILE_SIZE / 2,
    guard.gridPos.y * GridConfig.TILE_SIZE + GridConfig.TILE_SIZE / 2,
    90  // Facing down
  );
  gridRenderer.addVisionCone(guardVision);

  // Store guard reference for animation
  window.testGuard = guard;

  // Setup reroute callbacks for crew units
  const setupReroute = (unit) => {
    unit.onNeedReroute = async (blockedUnit) => {
      console.log(blockedUnit.id, 'needs reroute - blocked too long');
      // Just stop for now - in full game would find alternate path
      blockedUnit.stop();
    };
  };
  setupReroute(testUnit);
  setupReroute(testUnit2);

  // Set pathfinder reference for TaskController
  testUnit.setPathfinder(pathfinder);
  testUnit2.setPathfinder(pathfinder);

  // Track selected unit for movement commands
  window.selectedUnit = testUnit;
  window.allUnits = [testUnit, testUnit2];

  // Expose Task and signalBus for console testing
  window.Task = Task;
  window.signalBus = signalBus;

  // Initialize Radio Controller with units and exit point
  radioController.registerUnits([testUnit, testUnit2]);
  radioController.setExitTile({ x: 15, y: 28 });  // Near map entrance
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
  // Reveal lobby by default for testing
  sectorManager.purchaseIntel('lobby');
  sectorManager.purchaseIntel('hallway');
  window.sectorManager = sectorManager;

  // Initialize Arrangement Engine with sample assets
  arrangementEngine.loadSampleArrangements();
  window.arrangementEngine = arrangementEngine;

  // Initialize heist phase state (PLANNING until player clicks EXECUTE HEIST)
  window.heistPhase = 'PLANNING';  // PLANNING | EXECUTING
  threatClock.pause();  // Clock paused during planning

  // Listen for heist start
  window.addEventListener('startHeist', () => {
    window.heistPhase = 'EXECUTING';
    threatClock.resume();
    console.log('[Heist] EXECUTION PHASE STARTED!');
  });

  // Start render loop
  gridRenderer.startRenderLoop();

  // Start vision/detection update loop
  setInterval(() => {
    if (!guardVision || !window.allUnits) return;

    const now = performance.now();
    const deltaTime = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;

    // Update TaskController for each crew unit
    for (const unit of window.allUnits) {
      unit.taskController.update(deltaTime);
    }

    // Update ThreatClock (only during execution phase)
    if (window.heistPhase === 'EXECUTING') {
      threatClock.update(deltaTime);
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

// Handle click-to-move
window.addEventListener('tileClicked', async (e) => {
  const unit = window.selectedUnit;
  if (!unit || !pathfinder) return;

  const tile = e.detail;

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

// Ensure HUD reappears when map is loaded
window.addEventListener('mapLoaded', () => {
  switchView('map');
  document.getElementById('hud-center').style.display = 'flex';
  document.getElementById('action-panel').style.display = 'flex';
});

window.addEventListener('startHeist', () => {
  // Lock View Tabs during heist
  views.map.btn.disabled = true;
  views.shop.btn.disabled = true;
});

window.addEventListener('heistEventLog', () => {
  // Optional: Auto-switch to map if urgent?
});

window.addEventListener('heistFinished', () => {
  // Unlock View Tabs
  views.map.btn.disabled = false;
  views.shop.btn.disabled = false;
  updateGlobalHeat();
});

window.addEventListener('heatLaundered', () => updateGlobalHeat());
window.addEventListener('heistEventLog', () => updateGlobalHeat()); // Live updates during heist

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
