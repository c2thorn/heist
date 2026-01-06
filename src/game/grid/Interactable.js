/**
 * Interactable - Base class for objects crew can interact with
 * Part of INTERACT task system per SPEC_003
 */

import { GridConfig } from './GridConfig.js';

/**
 * Interactable types
 */
export const InteractableType = {
    DOOR: 'DOOR',           // Locked doors requiring lockpick
    COMPUTER: 'COMPUTER',   // Hack for intel or disable systems
    SAFE: 'SAFE',           // Crack for loot
    PANEL: 'PANEL',         // Security panel (disable cameras)
    ITEM: 'ITEM',           // Pickup item
    OBJECTIVE: 'OBJECTIVE'  // Mission objective marker
};

/**
 * Interactable state
 */
export const InteractableState = {
    IDLE: 'IDLE',           // Ready to interact
    IN_PROGRESS: 'IN_PROGRESS', // Being interacted with
    COMPLETED: 'COMPLETED', // Successfully used
    DISABLED: 'DISABLED'    // Cannot be used
};

/**
 * Base Interactable class
 */
export class Interactable {
    /**
     * Create an interactable object
     * @param {Object} config - Configuration
     * @param {string} config.id - Unique identifier
     * @param {string} config.type - InteractableType value
     * @param {number} config.gridX - Grid X position
     * @param {number} config.gridY - Grid Y position
     * @param {number} config.duration - Time to interact in seconds
     * @param {number} config.dc - Skill check difficulty class
     * @param {string} config.requiredTool - Tool ID required (optional)
     * @param {string} config.label - Display name
     */
    constructor(config) {
        this.id = config.id || `interactable_${Date.now()}`;
        this.type = config.type;

        // Position
        this.gridX = config.gridX;
        this.gridY = config.gridY;

        // Interaction settings
        const baseDuration = config.duration || GridConfig.INTERACTION.BASE_DURATION;
        this.duration = baseDuration * GridConfig.INTERACTION.DURATION_MULTIPLIER;
        this.dc = config.dc || 7;                // Difficulty (2d6 check)
        this.requiredTool = config.requiredTool || null;

        // Display
        this.label = config.label || this.type;
        this.color = config.color || '#ffcc00';

        // State
        this.state = InteractableState.IDLE;
        this.progress = 0;
        this.interactingUnitId = null;
    }

    /**
     * Get world position (center of tile)
     */
    getWorldPos() {
        const ts = GridConfig.TILE_SIZE;
        return {
            x: this.gridX * ts + ts / 2,
            y: this.gridY * ts + ts / 2
        };
    }

    /**
     * Check if a unit can interact with this object
     * @param {Unit} unit - The unit trying to interact
     * @returns {{canInteract: boolean, reason: string}}
     */
    canInteract(unit) {
        // Already being used?
        if (this.state === InteractableState.IN_PROGRESS &&
            this.interactingUnitId !== unit.id) {
            return { canInteract: false, reason: 'Already in use' };
        }

        // Already completed?
        if (this.state === InteractableState.COMPLETED) {
            return { canInteract: false, reason: 'Already used' };
        }

        // Disabled?
        if (this.state === InteractableState.DISABLED) {
            return { canInteract: false, reason: 'Disabled' };
        }

        // Check required tool
        if (this.requiredTool) {
            // For now, assume units have all tools (later: check inventory)
            // TODO: Implement tool checking
        }

        // Check adjacency (unit must be within 1 tile)
        const dx = Math.abs(unit.gridPos.x - this.gridX);
        const dy = Math.abs(unit.gridPos.y - this.gridY);
        if (dx > 1 || dy > 1) {
            return { canInteract: false, reason: 'Too far' };
        }

        return { canInteract: true, reason: null };
    }

    /**
     * Start interaction
     * @param {string} unitId - ID of unit starting interaction
     */
    startInteraction(unitId) {
        this.state = InteractableState.IN_PROGRESS;
        this.interactingUnitId = unitId;
        this.progress = 0;
        console.log(`[Interactable:${this.id}] Interaction started by ${unitId}`);
    }

    /**
     * Update interaction progress
     * @param {number} deltaTime - Time passed in seconds
     * @returns {boolean} True if interaction is complete
     */
    updateProgress(deltaTime) {
        if (this.state !== InteractableState.IN_PROGRESS) return false;

        this.progress += deltaTime;

        return this.progress >= this.duration;
    }

    /**
     * Get progress percentage (0-1)
     */
    getProgressPercent() {
        return Math.min(1, this.progress / this.duration);
    }

    /**
     * Complete interaction (called after skill check)
     * @param {boolean} success - Whether the skill check passed
     * @returns {Object} Result of interaction
     */
    completeInteraction(success) {
        this.interactingUnitId = null;

        if (success) {
            this.state = InteractableState.COMPLETED;
            console.log(`[Interactable:${this.id}] Interaction succeeded!`);
            return this.onSuccess();
        } else {
            this.state = InteractableState.IDLE;
            this.progress = 0;
            console.log(`[Interactable:${this.id}] Interaction failed!`);
            return this.onFailure();
        }
    }

    /**
     * Cancel interaction
     */
    cancelInteraction() {
        this.state = InteractableState.IDLE;
        this.interactingUnitId = null;
        this.progress = 0;
    }

    /**
     * Override in subclasses - what happens on success
     * @returns {Object} Result data
     */
    onSuccess() {
        return { type: 'generic', message: 'Interaction complete' };
    }

    /**
     * Override in subclasses - what happens on failure
     * @returns {Object} Result data
     */
    onFailure() {
        return { type: 'generic', message: 'Interaction failed' };
    }

    /**
     * Get adjacent walkable positions for approaching this object
     * @param {TileMap} tileMap - The tile map
     * @returns {Array<{x: number, y: number}>} Valid approach tiles
     */
    getApproachTiles(tileMap) {
        const tiles = [];
        const offsets = [
            { x: 0, y: -1 }, // Above
            { x: 0, y: 1 },  // Below
            { x: -1, y: 0 }, // Left
            { x: 1, y: 0 }   // Right
        ];

        for (const offset of offsets) {
            const tx = this.gridX + offset.x;
            const ty = this.gridY + offset.y;
            const tile = tileMap.getTile(tx, ty);

            if (tile && tile.isWalkable) {
                tiles.push({ x: tx, y: ty });
            }
        }

        return tiles;
    }
}

/**
 * Door - Locked door that can be lockpicked
 */
export class Door extends Interactable {
    constructor(config) {
        super({
            ...config,
            type: InteractableType.DOOR,
            label: config.label || 'Locked Door',
            color: '#8b4513',
            duration: config.duration || 4,
            dc: config.dc || 7
        });

        this.isLocked = true;
    }

    onSuccess() {
        this.isLocked = false;
        // Tell the actual tile to open
        return {
            type: 'door_unlock',
            message: 'Door unlocked!',
            gridX: this.gridX,
            gridY: this.gridY
        };
    }

    onFailure() {
        return {
            type: 'door_fail',
            message: 'Lockpick broke!',
            noise: 2  // Generate noise
        };
    }
}

/**
 * Computer - Hackable terminal
 */
export class Computer extends Interactable {
    constructor(config) {
        super({
            ...config,
            type: InteractableType.COMPUTER,
            label: config.label || 'Computer Terminal',
            color: '#00ccff',
            duration: config.duration || 5,
            dc: config.dc || 8
        });

        this.intelReward = config.intelReward || 3;
        this.canDisableCameras = config.canDisableCameras || false;
    }

    onSuccess() {
        return {
            type: 'computer_hack',
            message: `Hacked! +${this.intelReward} Intel`,
            intel: this.intelReward,
            disableCameras: this.canDisableCameras
        };
    }

    onFailure() {
        return {
            type: 'computer_fail',
            message: 'Hack detected! Alarm triggered!',
            triggerAlarm: true
        };
    }
}

/**
 * Safe - Contains loot
 */
export class Safe extends Interactable {
    constructor(config) {
        super({
            ...config,
            type: InteractableType.SAFE,
            label: config.label || 'Safe',
            color: config.isScore ? '#ffd700' : '#c9a227', // Gold for Score, darker for side
            duration: config.duration || 8,
            dc: config.dc || 9
        });

        this.lootValue = config.lootValue || 1000;
        this.isScore = config.isScore || false;  // Is this THE primary Score?
        this.lootName = config.lootName || (this.isScore ? 'The Score' : 'Loot');
    }

    onSuccess() {
        return {
            type: 'safe_crack',
            message: `Safe cracked! +$${this.lootValue}`,
            loot: this.lootValue,
            lootName: this.lootName,
            interactableId: this.id,
            isScore: this.isScore
        };
    }

    onFailure() {
        return {
            type: 'safe_fail',
            message: 'Safe locked down!',
            noise: 5
        };
    }
}

/**
 * SecurityPanel - Disable cameras/alarms in a zone
 */
export class SecurityPanel extends Interactable {
    constructor(config) {
        super({
            ...config,
            type: InteractableType.PANEL,
            label: config.label || 'Security Panel',
            color: '#ff6600',
            duration: config.duration || 6,
            dc: config.dc || 8
        });

        this.affectedZone = config.affectedZone || null;  // Zone ID to disable
    }

    onSuccess() {
        return {
            type: 'panel_disable',
            message: `Security disabled in ${this.affectedZone || 'zone'}!`,
            disableZone: this.affectedZone
        };
    }

    onFailure() {
        return {
            type: 'panel_fail',
            message: 'Panel access denied!',
            triggerAlarm: true
        };
    }
}
