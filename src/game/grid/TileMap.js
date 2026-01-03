import { GridConfig } from './GridConfig.js';
import { Tile } from './Tile.js';

/**
 * TileMap class - manages the 2D grid of tiles
 * Per SPEC_001 Section 3 - The Grid Data Structure
 */
export class TileMap {
    /**
     * Create a new TileMap
     * @param {number} width - Grid width in tiles
     * @param {number} height - Grid height in tiles
     */
    constructor(width = GridConfig.DEFAULT_WIDTH, height = GridConfig.DEFAULT_HEIGHT) {
        this.width = width;
        this.height = height;
        this.tileSize = GridConfig.TILE_SIZE;

        // 2D array of Tile objects
        this.tiles = [];

        // Quick lookup by ID
        this.tileById = new Map();

        // Zone definitions for room rendering
        this.zones = new Map();  // zoneId -> { name, color, tiles: [] }

        // Initialize empty grid
        this._initializeGrid();
    }

    /**
     * Initialize grid with default VOID tiles
     */
    _initializeGrid() {
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                const tile = new Tile(x, y, GridConfig.TILE_TYPE.VOID);
                this.tiles[y][x] = tile;
                this.tileById.set(tile.id, tile);
            }
        }
    }

    // =========================================================================
    // COORDINATE CONVERSION (SPEC_001 Section 2)
    // =========================================================================

    /**
     * Convert grid coordinates to world (pixel) coordinates
     * Returns center of tile
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @returns {{x: number, y: number}} World coordinates (pixels)
     */
    gridToWorld(gridX, gridY) {
        return {
            x: gridX * this.tileSize + this.tileSize / 2,
            y: gridY * this.tileSize + this.tileSize / 2
        };
    }

    /**
     * Convert world (pixel) coordinates to grid coordinates
     * @param {number} worldX - World X coordinate (pixels)
     * @param {number} worldY - World Y coordinate (pixels)
     * @returns {{x: number, y: number}} Grid coordinates (integers)
     */
    worldToGrid(worldX, worldY) {
        return {
            x: Math.floor(worldX / this.tileSize),
            y: Math.floor(worldY / this.tileSize)
        };
    }

    /**
     * Get world bounds of the map
     * @returns {{width: number, height: number}} Map size in pixels
     */
    getWorldBounds() {
        return {
            width: this.width * this.tileSize,
            height: this.height * this.tileSize
        };
    }

    // =========================================================================
    // TILE ACCESS
    // =========================================================================

    /**
     * Get tile at grid coordinates
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate
     * @returns {Tile|null} Tile at position or null if out of bounds
     */
    getTile(x, y) {
        if (!this.isInBounds(x, y)) return null;
        return this.tiles[y][x];
    }

    /**
     * Get tile by ID string
     * @param {string} id - Tile ID (format: "x_y")
     * @returns {Tile|null} Tile or null if not found
     */
    getTileById(id) {
        return this.tileById.get(id) || null;
    }

    /**
     * Check if coordinates are within grid bounds
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate
     * @returns {boolean} True if in bounds
     */
    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    /**
     * Set tile type at position
     * @param {number} x - Grid X coordinate
     * @param {number} y - Grid Y coordinate  
     * @param {string} type - Tile type from GridConfig.TILE_TYPE
     * @param {string} terrain - Terrain type from GridConfig.TERRAIN
     */
    setTile(x, y, type, terrain = GridConfig.TERRAIN.DEFAULT) {
        const tile = this.getTile(x, y);
        if (tile) {
            tile.type = type;
            tile.terrain = terrain;
            tile._initializeProperties();
        }
    }

    /**
     * Fill a rectangular area with a tile type
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X (inclusive)
     * @param {number} y2 - End Y (inclusive)
     * @param {string} type - Tile type
     * @param {string} terrain - Terrain type
     */
    fillRect(x1, y1, x2, y2, type, terrain = GridConfig.TERRAIN.DEFAULT) {
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                this.setTile(x, y, type, terrain);
            }
        }
    }

    /**
     * Draw a rectangular outline (walls)
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X (inclusive)
     * @param {number} y2 - End Y (inclusive)
     * @param {string} type - Tile type for the outline
     */
    drawRect(x1, y1, x2, y2, type = GridConfig.TILE_TYPE.WALL) {
        // Top and bottom edges
        for (let x = x1; x <= x2; x++) {
            this.setTile(x, y1, type);
            this.setTile(x, y2, type);
        }
        // Left and right edges
        for (let y = y1; y <= y2; y++) {
            this.setTile(x1, y, type);
            this.setTile(x2, y, type);
        }
    }

    // =========================================================================
    // ZONE MANAGEMENT (for room-based rendering)
    // =========================================================================

    /**
     * Define a zone (room)
     * @param {string} zoneId - Unique zone identifier
     * @param {string} name - Display name
     * @param {string} color - CSS color for rendering
     */
    defineZone(zoneId, name, color) {
        this.zones.set(zoneId, { name, color, tiles: [] });
    }

    /**
     * Assign tiles in a rectangle to a zone
     * @param {string} zoneId - Zone to assign to
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X (inclusive)
     * @param {number} y2 - End Y (inclusive)
     */
    assignZone(zoneId, x1, y1, x2, y2) {
        const zone = this.zones.get(zoneId);
        if (!zone) return;

        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                const tile = this.getTile(x, y);
                if (tile) {
                    tile.zoneId = zoneId;
                    tile.zoneName = zone.name;
                    zone.tiles.push(tile.id);
                }
            }
        }
    }

    /**
     * Get zone info
     * @param {string} zoneId - Zone ID
     * @returns {Object|null} Zone data or null
     */
    getZone(zoneId) {
        return this.zones.get(zoneId) || null;
    }

    // =========================================================================
    // VISIBILITY (SPEC_001 Section 4)
    // =========================================================================

    /**
     * Set visibility for all tiles in a zone
     * @param {string} zoneId - Zone to reveal
     * @param {string} state - Visibility state
     */
    setZoneVisibility(zoneId, state) {
        const zone = this.zones.get(zoneId);
        if (!zone) return;

        for (const tileId of zone.tiles) {
            const tile = this.getTileById(tileId);
            if (tile) tile.setVisibility(state);
        }
    }

    /**
     * Reveal all tiles (for debugging)
     */
    revealAll() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.tiles[y][x].setVisibility(GridConfig.VISIBILITY.VISIBLE);
            }
        }
    }

    // =========================================================================
    // PATHFINDING HELPERS
    // =========================================================================

    /**
     * Get all walkable neighbors of a tile
     * @param {number} x - Grid X
     * @param {number} y - Grid Y
     * @param {boolean} includeDiagonals - Include diagonal neighbors
     * @returns {Tile[]} Array of walkable neighbor tiles
     */
    getWalkableNeighbors(x, y, includeDiagonals = true) {
        const neighbors = [];
        const directions = [
            { dx: 0, dy: -1 },  // North
            { dx: 1, dy: 0 },   // East
            { dx: 0, dy: 1 },   // South
            { dx: -1, dy: 0 }   // West
        ];

        if (includeDiagonals) {
            directions.push(
                { dx: 1, dy: -1 },   // NE
                { dx: 1, dy: 1 },    // SE
                { dx: -1, dy: 1 },   // SW
                { dx: -1, dy: -1 }   // NW
            );
        }

        for (const dir of directions) {
            const tile = this.getTile(x + dir.dx, y + dir.dy);
            if (tile && tile.isWalkable) {
                neighbors.push(tile);
            }
        }

        return neighbors;
    }

    /**
     * Check if there's a clear line of movement between two tiles (no diagonal wall clipping)
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @returns {boolean} True if movement is valid
     */
    canMoveDiagonally(x1, y1, x2, y2) {
        // For diagonal moves, check that we don't clip through walls
        const dx = x2 - x1;
        const dy = y2 - y1;

        if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
            // Diagonal move - check adjacent tiles
            const adj1 = this.getTile(x1 + dx, y1);
            const adj2 = this.getTile(x1, y1 + dy);

            // Can only move diagonally if at least one adjacent is walkable
            return (adj1 && adj1.isWalkable) || (adj2 && adj2.isWalkable);
        }

        return true;
    }

    // =========================================================================
    // SERIALIZATION
    // =========================================================================

    /**
     * Serialize map to JSON
     * @returns {Object} Serialized map data
     */
    toJSON() {
        return {
            width: this.width,
            height: this.height,
            tileSize: this.tileSize,
            zones: Array.from(this.zones.entries()),
            tiles: this.tiles.map(row => row.map(tile => tile.toJSON()))
        };
    }

    /**
     * Create TileMap from JSON data
     * @param {Object} data - Serialized map data
     * @returns {TileMap} Reconstructed map
     */
    static fromJSON(data) {
        const map = new TileMap(data.width, data.height);

        // Restore zones
        for (const [zoneId, zoneData] of data.zones) {
            map.zones.set(zoneId, zoneData);
        }

        // Restore tiles
        for (let y = 0; y < data.height; y++) {
            for (let x = 0; x < data.width; x++) {
                const tileData = data.tiles[y][x];
                const tile = map.getTile(x, y);
                Object.assign(tile, tileData);
                tile._initializeProperties();
            }
        }

        return map;
    }
}
