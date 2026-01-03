/**
 * TileGrid Configuration Constants
 * Extends GameConfig with tile-based grid settings per SPEC_001
 */
export const GridConfig = {
    // Tile dimensions
    TILE_SIZE: 32,              // 1 tile = 32px = 1 meter (in-game abstraction)

    // Default map dimensions
    DEFAULT_WIDTH: 32,          // Tiles wide
    DEFAULT_HEIGHT: 32,         // Tiles tall

    // Visibility states
    VISIBILITY: {
        HIDDEN: 'HIDDEN',       // Pitch black / blueprint sketch - no interaction
        REVEALED: 'REVEALED',   // Static architecture visible, greyed out
        VISIBLE: 'VISIBLE'      // Full color, active LOS
    },

    // Tile types
    TILE_TYPE: {
        VOID: 'VOID',           // Empty space outside building
        FLOOR: 'FLOOR',         // Walkable floor
        WALL: 'WALL',           // Non-walkable, opaque
        DOOR: 'DOOR',           // Initially non-walkable, can open
        WINDOW: 'WINDOW',       // Non-walkable but transparent
        VENT: 'VENT'            // Walkable only for small/tech units, opaque
    },

    // Terrain types (affects movement cost and noise)
    TERRAIN: {
        DEFAULT: 'DEFAULT',     // Standard floor
        CARPET: 'CARPET',       // Quieter movement
        TILE: 'TILE',           // Louder movement
        GRAVEL: 'GRAVEL',       // Very loud
        VENT: 'VENT'            // Slow crawling
    },

    // A* pathfinding costs
    MOVEMENT_COST: {
        DEFAULT: 10,
        CARPET: 10,
        TILE: 20,               // Discourage unless rushing
        GRAVEL: 20,
        VENT: 30,               // Slow movement
        GUARD_ZONE: 50          // Soft avoidance
    },

    // Diagonal movement multiplier (approx sqrt(2))
    DIAGONAL_COST_MULTIPLIER: 1.4
};
