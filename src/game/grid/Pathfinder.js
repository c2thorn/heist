import EasyStar from 'easystarjs';
import { GridConfig } from './GridConfig.js';

/**
 * Pathfinder - A* pathfinding wrapper using EasyStar.js
 * Per SPEC_001 Section 5 and SPEC_002 Section 2
 */
export class Pathfinder {
    /**
     * Create a new Pathfinder for a TileMap
     * @param {TileMap} tileMap - The tile map to pathfind on
     */
    constructor(tileMap) {
        this.tileMap = tileMap;
        this.easystar = new EasyStar.js();

        // Configure EasyStar
        this._configureGrid();

        // Enable diagonal movement with higher cost
        this.easystar.enableDiagonals();
        this.easystar.enableCornerCutting();

        // Set iterations per calculation (higher = faster but may block)
        this.easystar.setIterationsPerCalculation(1000);
    }

    /**
     * Configure the EasyStar grid from the TileMap
     */
    _configureGrid() {
        // Build a 2D array of tile costs (0 = unwalkable)
        const grid = [];
        const acceptableTiles = [];

        for (let y = 0; y < this.tileMap.height; y++) {
            grid[y] = [];
            for (let x = 0; x < this.tileMap.width; x++) {
                const tile = this.tileMap.getTile(x, y);
                if (tile && tile.isWalkable) {
                    const cost = tile.getMovementCost();
                    grid[y][x] = cost;
                    if (!acceptableTiles.includes(cost)) {
                        acceptableTiles.push(cost);
                    }
                } else {
                    grid[y][x] = 0;  // Unwalkable
                }
            }
        }

        this.easystar.setGrid(grid);
        this.easystar.setAcceptableTiles(acceptableTiles);

        // Set tile costs
        for (const cost of acceptableTiles) {
            this.easystar.setTileCost(cost, cost);
        }
    }

    /**
     * Refresh the grid (call after map changes)
     */
    refresh() {
        this._configureGrid();
    }

    /**
     * Mark a tile as temporarily blocked (e.g., occupied by unit)
     * @param {number} x - Grid X
     * @param {number} y - Grid Y
     */
    avoidTile(x, y) {
        this.easystar.avoidAdditionalPoint(x, y);
    }

    /**
     * Clear a temporarily blocked tile
     * @param {number} x - Grid X
     * @param {number} y - Grid Y
     */
    clearAvoidTile(x, y) {
        this.easystar.stopAvoidingAdditionalPoint(x, y);
    }

    /**
     * Clear all temporarily blocked tiles
     */
    clearAllAvoidTiles() {
        this.easystar.stopAvoidingAllAdditionalPoints();
    }

    /**
     * Find a path between two points
     * @param {number} startX - Start grid X
     * @param {number} startY - Start grid Y
     * @param {number} endX - End grid X
     * @param {number} endY - End grid Y
     * @returns {Promise<Array<{x: number, y: number}>|null>} Path array or null if no path
     */
    findPath(startX, startY, endX, endY) {
        return new Promise((resolve) => {
            this.easystar.findPath(startX, startY, endX, endY, (path) => {
                resolve(path);
            });
            this.easystar.calculate();
        });
    }

    /**
     * Find path synchronously (blocks until complete)
     * Use sparingly - prefer async version
     * @param {number} startX - Start grid X
     * @param {number} startY - Start grid Y
     * @param {number} endX - End grid X
     * @param {number} endY - End grid Y
     * @returns {Array<{x: number, y: number}>|null} Path array or null
     */
    findPathSync(startX, startY, endX, endY) {
        let result = null;
        let done = false;

        this.easystar.findPath(startX, startY, endX, endY, (path) => {
            result = path;
            done = true;
        });

        // Keep calculating until done
        while (!done) {
            this.easystar.calculate();
        }

        return result;
    }
}
