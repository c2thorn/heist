/**
 * Map Pool Registry
 * Central registry of available heist maps that contracts can draw from.
 * Supports both static JSON maps and procedural generation.
 */

import bankHeistData from './bank_heist.json';
import bankHeistArrangements from '../arrangements/bank_heist_arrangements.json';
import { generateBuilding } from '../mapgen/MapGenerator.js';

/**
 * Pool of available static maps, keyed by buildingId
 * 
 * Each map entry contains:
 * - id: Unique identifier
 * - name: Display name
 * - building: Building JSON data (required)
 * - arrangements: Arrangement JSON data (optional, null for no arrangements)
 * - contractTypes: Array of compatible contract layout types
 * - isStatic: true for pre-built maps
 */
export const MAP_POOL = {
    bank_heist: {
        id: 'bank_heist',
        name: 'First National Bank',
        building: bankHeistData,
        arrangements: bankHeistArrangements,
        contractTypes: ['STANDARD', 'LINEAR', 'COMPOUND'],
        isStatic: true
    }
};

/**
 * Configuration for procedural generation
 */
const GENERATION_CONFIG = {
    enabled: true,  // Set to false to disable procedural maps
    archetypeForDifficulty: {
        // Difficulty ranges map to archetypes
        1: 'bank',
        2: 'bank',
        3: 'bank'
        // Future: 4: 'casino', 5: 'museum', etc.
    }
};

/**
 * Get a map for the given contract
 * May return a static map or generate a procedural one
 * 
 * @param {string} layoutType - Contract layout type (STANDARD, LINEAR, COMPOUND)
 * @param {number} difficulty - Contract difficulty level
 * @param {boolean} forceGenerated - Force procedural generation
 * @returns {Object} Map data { id, name, building, arrangements }
 */
export function getMapForContract(layoutType, difficulty = 1, forceGenerated = false) {
    // Decide whether to use static or generated map
    const useGenerated = forceGenerated ||
        (GENERATION_CONFIG.enabled && Math.random() > 0.5);

    if (useGenerated) {
        // Get archetype for difficulty
        const archetypeId = GENERATION_CONFIG.archetypeForDifficulty[difficulty] || 'bank';

        try {
            const building = generateBuilding(archetypeId, difficulty);
            if (building) {
                console.log(`[MapPool] Generated procedural map: ${building.name}`);
                return {
                    id: building.id,
                    name: building.name,
                    building,
                    arrangements: null,  // Generated maps don't have arrangements yet
                    contractTypes: [layoutType],
                    isStatic: false
                };
            }
        } catch (e) {
            console.error('[MapPool] Generation failed, falling back to static:', e);
        }
    }

    // Fall back to static maps
    const compatibleMaps = Object.values(MAP_POOL).filter(
        map => map.contractTypes.includes(layoutType)
    );

    if (compatibleMaps.length === 0) {
        console.warn(`[MapPool] No maps compatible with ${layoutType}, defaulting to bank_heist`);
        return MAP_POOL.bank_heist;
    }

    const selected = compatibleMaps[Math.floor(Math.random() * compatibleMaps.length)];
    console.log(`[MapPool] Selected static map: ${selected.name} for ${layoutType} contract`);
    return selected;
}

/**
 * Get a specific map by ID (static maps only)
 * @param {string} buildingId 
 * @returns {Object|null}
 */
export function getMapById(buildingId) {
    return MAP_POOL[buildingId] || null;
}

/**
 * Generate a fresh map of specified archetype
 * @param {string} archetypeId - e.g., 'bank', 'casino'
 * @param {number} difficulty
 * @returns {Object} Map data
 */
export function generateMap(archetypeId, difficulty = 1) {
    const building = generateBuilding(archetypeId, difficulty);
    return {
        id: building.id,
        name: building.name,
        building,
        arrangements: null,
        contractTypes: ['STANDARD', 'LINEAR', 'COMPOUND'],
        isStatic: false
    };
}

