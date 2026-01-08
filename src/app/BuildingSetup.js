/**
 * BuildingSetup - Handles loading buildings and their entities
 * Extracted from renderer.js for maintainability
 */
import GameManager from '../game/GameManager.js';
import { BuildingLoader, Pathfinder, Task, signalBus, radioController, arrangementEngine } from '../game/grid/index.js';
import { getMapById } from '../data/buildings/index.js';

// Module state - these get set during loadBuilding
let gridRenderer = null;
let guardVision = null;

/**
 * Initialize BuildingSetup with grid renderer reference
 * @param {Object} deps - { gridRenderer }
 */
export function initBuildingSetup(deps) {
    gridRenderer = deps.gridRenderer;
}

/**
 * Get the guard vision cone for animation loop
 */
export function getGuardVision() {
    return guardVision;
}

/**
 * Load building entities into the grid renderer (guards, interactables, extraction points)
 * @param {Object} buildingResult - Result from BuildingLoader.load()
 */
export function loadBuildingEntities(buildingResult) {
    // Clear existing entities from renderer
    if (gridRenderer) {
        gridRenderer.clearAllEntities();
    }

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

    // Store score data for HeistOutcomeEngine
    GameManager.scoreData = buildingResult.scoreData;
    GameManager.sideScoreData = buildingResult.sideScoreData;

    // Add cameras (stub entities)
    if (buildingResult.cameras) {
        for (const camera of buildingResult.cameras) {
            gridRenderer.addEntity(camera);
        }
    }
    GameManager.cameras = buildingResult.cameras || [];

    // Add alarms (stub entities)
    if (buildingResult.alarms) {
        for (const alarm of buildingResult.alarms) {
            gridRenderer.addEntity(alarm);
        }
    }
    GameManager.alarms = buildingResult.alarms || [];
}

/**
 * Load a fresh building from the map pool or from generated data
 * Called when a contract is accepted to reset all map state
 * @param {string} buildingId - ID of building in MAP_POOL
 * @param {Object} generatedMapData - Optional: pre-generated map data from contract
 */
export function loadBuilding(buildingId, generatedMapData = null) {
    console.log(`[BuildingSetup] Loading building: ${buildingId}`);

    // Use provided mapData (for generated maps) or look up static map
    let mapData = generatedMapData;
    if (!mapData) {
        mapData = getMapById(buildingId);
    }

    if (!mapData) {
        console.error(`[BuildingSetup] Building not found: ${buildingId}`);
        return;
    }

    // Load fresh building data
    const buildingResult = BuildingLoader.load(mapData.building);
    const tileMap = buildingResult.tileMap;

    // Update GameManager state
    GameManager.tileMap = tileMap;
    window.tileMap = tileMap;

    // Update pathfinder with new tileMap
    const pathfinder = new Pathfinder(tileMap);
    GameManager.pathfinder = pathfinder;
    window.pathfinder = pathfinder;

    // Update grid renderer's tileMap
    if (gridRenderer) {
        gridRenderer.setTileMap(tileMap);
    }

    // Update SectorManager's tileMap reference and initialize hidden zones
    if (window.sectorManager) {
        window.sectorManager.tileMap = tileMap;
        // Initialize sectors from hiddenZones (only secure rooms need intel)
        const hiddenZones = mapData.building.hiddenZones || [];
        window.sectorManager.initFromHiddenZones(hiddenZones);
    }

    // Load fresh entities
    loadBuildingEntities(buildingResult);

    // Load arrangements for this building (if present)
    arrangementEngine.reset();
    if (mapData.arrangements) {
        arrangementEngine.loadFromData(mapData.arrangements);
    }

    // Update radio controller exit point
    const defaultExit = buildingResult.extractionPoints?.find(p => p.isDefault)
        || buildingResult.extractionPoints?.[0]
        || { x: 15, y: 28 };
    radioController.setExitTile({ x: defaultExit.gridX || defaultExit.x, y: defaultExit.gridY || defaultExit.y });

    console.log(`[BuildingSetup] Building loaded: ${mapData.name} (${mapData.isStatic ? 'static' : 'generated'})`);
}
