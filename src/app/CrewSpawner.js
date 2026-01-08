/**
 * CrewSpawner - Handles spawning crew units on the map
 * Extracted from renderer.js for maintainability
 */
import GameManager from '../game/GameManager.js';
import { Unit } from '../game/grid/index.js';
import { debugLog } from '../game/DebugConfig.js';
import { setupPhaseUI } from '../ui/SetupPhaseUI.js';

/**
 * Find a walkable tile near the target position
 * @param {number} startX - Target X position
 * @param {number} startY - Target Y position
 * @returns {{x: number, y: number}} - Walkable position
 */
function findWalkableSpawn(startX, startY) {
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
}

/**
 * Spawn all active crew members on the map
 */
export function spawnActiveCrew() {
    const activeCrew = GameManager.gameState.crew.activeStack;
    console.log('Spawning/Updating Roster:', activeCrew);

    // Clear existing units
    if (GameManager.units.length > 0) {
        GameManager.units.forEach(u => window.gridRenderer.removeUnit(u.id));
        GameManager.units.length = 0;  // Clear without breaking window.allUnits reference
    }

    // Entry Point - Find a walkable tile near intended spawn
    let entryX = 15;
    let entryY = 26;

    const spawn = findWalkableSpawn(entryX, entryY);
    debugLog('spawn', `Found walkable entry at (${spawn.x}, ${spawn.y})`);

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

    // Defaults
    if (window.allUnits.length > 0) {
        window.selectedUnit = window.allUnits[0];
        window.planningUnitId = window.selectedUnit.id; // Sync planner selection
        setupPhaseUI.refresh();
    }
}

/**
 * Initialize crew spawner event listeners
 */
export function initCrewSpawner() {
    // Listen for Roster Changes during Planning
    GameManager.events.on('crew-updated', () => {
        console.log('[CrewSpawner] Crew Updated Event received. Phase:', window.heistPhase);
        if (window.heistPhase === 'PLANNING') {
            spawnActiveCrew();
        }
    });
}
