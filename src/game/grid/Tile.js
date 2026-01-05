import { GridConfig } from './GridConfig.js';

/**
 * Tile class - represents a single cell in the Logic Grid
 * Per SPEC_001 Section 3.1
 */
export class Tile {
    /**
     * Create a new Tile
     * @param {number} x - Grid X coordinate (integer)
     * @param {number} y - Grid Y coordinate (integer)
     * @param {string} type - Tile type from GridConfig.TILE_TYPE
     * @param {string} terrain - Terrain type from GridConfig.TERRAIN
     */
    constructor(x, y, type = GridConfig.TILE_TYPE.FLOOR, terrain = GridConfig.TERRAIN.DEFAULT) {
        // Identity
        this.id = `${x}_${y}`;
        this.x = x;
        this.y = y;

        // Type configuration
        this.type = type;
        this.terrain = terrain;

        // Logical properties (derived from type, can be overridden)
        this._initializeProperties();

        // Dynamic state
        this.occupantId = null;         // ID of Unit standing here
        this.interactableId = null;     // ID of Door/Terminal/Loot on this tile
        this.reservationId = null;      // ID of Unit moving toward this tile

        // Visibility state
        this.visibility = GridConfig.VISIBILITY.HIDDEN;

        // Room/zone metadata for rendering
        this.zoneId = null;             // Which room/zone this tile belongs to
        this.zoneName = null;           // Display name (e.g., "Lobby", "Vault")
    }

    /**
     * Initialize logical properties based on tile type
     */
    _initializeProperties() {
        switch (this.type) {
            case GridConfig.TILE_TYPE.FLOOR:
                this.isWalkable = true;
                this.isCover = false;
                this.isTransparent = true;
                break;
            case GridConfig.TILE_TYPE.WALL:
                this.isWalkable = false;
                this.isCover = true;
                this.isTransparent = false;
                break;
            case GridConfig.TILE_TYPE.DOOR:
                // Doors: always walkable for pathfinding. Locked doors will pause unit for unlock.
                this.doorState = 'CLOSED';  // CLOSED, OPEN
                this.isLocked = false;      // If true, unit will pause to unlock when reached
                this.isWalkable = true;     // All doors are pathable
                this.isCover = true;
                this.isTransparent = false;
                break;
            case GridConfig.TILE_TYPE.WINDOW:
                this.isWalkable = false;
                this.isCover = false;
                this.isTransparent = true;
                break;
            case GridConfig.TILE_TYPE.VENT:
                this.isWalkable = true;     // Only for certain units (checked elsewhere)
                this.isCover = false;
                this.isTransparent = false;
                this.requiresSmall = true;  // Flag for unit size check
                break;
            case GridConfig.TILE_TYPE.VOID:
            default:
                this.isWalkable = false;
                this.isCover = false;
                this.isTransparent = true;
                break;
        }
    }

    /**
     * Get movement cost for this tile
     * @returns {number} Movement cost for pathfinding
     */
    getMovementCost() {
        if (!this.isWalkable) return Infinity;
        return GridConfig.MOVEMENT_COST[this.terrain] || GridConfig.MOVEMENT_COST.DEFAULT;
    }

    /**
     * Open a door tile
     */
    openDoor() {
        if (this.type !== GridConfig.TILE_TYPE.DOOR) return;
        this.doorState = 'OPEN';
        this.isWalkable = true;
        this.isCover = false;
        this.isTransparent = true;
    }

    /**
     * Close a door tile (still walkable if unlocked)
     */
    closeDoor() {
        if (this.type !== GridConfig.TILE_TYPE.DOOR) return;
        this.doorState = 'CLOSED';
        this.isWalkable = !this.isLocked;  // Walkable only if unlocked
        this.isCover = true;
        this.isTransparent = false;
    }

    /**
     * Lock a door (still walkable for pathfinding, but unit will pause to unlock)
     */
    lockDoor() {
        if (this.type !== GridConfig.TILE_TYPE.DOOR) return;
        this.isLocked = true;
        // Keep walkable for pathfinding - TaskProcessor handles the unlock pause
        this.isWalkable = true;
    }

    /**
     * Unlock a door (makes it walkable)
     */
    unlockDoor() {
        if (this.type !== GridConfig.TILE_TYPE.DOOR) return;
        this.isLocked = false;
        this.isWalkable = true;
    }

    /**
     * Set visibility state
     * @param {string} state - Visibility state from GridConfig.VISIBILITY
     */
    setVisibility(state) {
        if (Object.values(GridConfig.VISIBILITY).includes(state)) {
            this.visibility = state;
        }
    }

    /**
     * Check if a unit can occupy this tile
     * @param {string} unitId - ID of unit trying to enter
     * @returns {boolean} Whether the tile can be occupied
     */
    canOccupy(unitId) {
        if (!this.isWalkable) return false;
        if (this.occupantId && this.occupantId !== unitId) return false;
        if (this.reservationId && this.reservationId !== unitId) return false;
        return true;
    }

    /**
     * Reserve this tile for a moving unit
     * @param {string} unitId - ID of unit reserving the tile
     * @returns {boolean} Whether reservation succeeded
     */
    reserve(unitId) {
        if (this.reservationId && this.reservationId !== unitId) return false;
        if (this.occupantId && this.occupantId !== unitId) return false;
        this.reservationId = unitId;
        return true;
    }

    /**
     * Clear reservation
     * @param {string} unitId - ID of unit releasing reservation
     */
    clearReservation(unitId) {
        if (this.reservationId === unitId) {
            this.reservationId = null;
        }
    }

    /**
     * Set occupant when unit arrives
     * @param {string} unitId - ID of unit occupying tile
     */
    setOccupant(unitId) {
        this.occupantId = unitId;
        this.clearReservation(unitId);
    }

    /**
     * Clear occupant when unit leaves
     */
    clearOccupant() {
        this.occupantId = null;
    }

    /**
     * Serialize tile to JSON for save/debug
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            type: this.type,
            terrain: this.terrain,
            isWalkable: this.isWalkable,
            isCover: this.isCover,
            isTransparent: this.isTransparent,
            visibility: this.visibility,
            zoneId: this.zoneId,
            zoneName: this.zoneName,
            occupantId: this.occupantId,
            interactableId: this.interactableId
        };
    }
}
