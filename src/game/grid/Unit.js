import { GridConfig } from './GridConfig.js';
import { TaskProcessor } from './TaskProcessor.js';

/**
 * Movement speeds per stance (pixels per second)
 * Configurable via GridConfig.CREW_SPEED
 */
export const MovementSpeed = GridConfig.CREW_SPEED;

/**
 * Unit states for collision handling
 */
export const UnitState = {
    IDLE: 'IDLE',
    MOVING: 'MOVING',
    WAITING: 'WAITING',         // Blocked by another unit
    REROUTING: 'REROUTING',     // Finding new path
    EXECUTING_TASK: 'EXECUTING_TASK'  // Processing task from queue
};

/**
 * Unit class - represents a movable entity on the grid
 * Per SPEC_002 Sections 2-3 and SPEC_002 Section 3 (Collision)
 */
export class Unit {
    /**
     * Create a new Unit
     * @param {string} id - Unique identifier
     * @param {number} gridX - Starting grid X position
     * @param {number} gridY - Starting grid Y position
     * @param {TileMap} tileMap - Reference to the tile map
     */
    constructor(id, gridX, gridY, tileMap) {
        this.id = id;
        this.tileMap = tileMap;

        // Dual position tracking (SPEC_002 Section 2.1)
        this.gridPos = { x: gridX, y: gridY };
        this.worldPos = this._gridToWorld(gridX, gridY);

        // Movement state
        this.pathQueue = [];           // Array of {x, y} grid positions
        this.currentTarget = null;     // Current waypoint we're moving toward
        this.stance = 'WALK';          // SNEAK, WALK, RUN
        this.state = UnitState.IDLE;

        // Reservation state
        this.reservedTile = null;      // The tile we've reserved ahead
        this.waitTime = 0;             // How long we've been waiting
        this.maxWaitTime = 1.5;        // Seconds before trying to reroute

        // Reroute callback (set by external code)
        this.onNeedReroute = null;     // Called when unit needs a new path

        // Escape properties
        this.defaultExit = null;       // Assigned during planning
        this.isExtracted = false;      // Set when unit reaches exit

        // Smoothing settings
        this.snapThreshold = 2;        // Pixels - snap to target when this close
        this.waypointTolerance = 10;   // Pixels - start turning toward next waypoint

        // Visual properties
        this.color = '#00ff88';
        this.radius = 12;

        // Loot carrying (Win/Lose system)
        this.carriedLoot = [];         // Array of LootBag instances
        this.isCaptured = false;       // True if captured by guards

        // Task Processor (The Brain)
        this.taskProcessor = new TaskProcessor(this);

        // Register on starting tile
        this._registerOnTile();

        // Enable hearing
        this.enableStimulusListener();
    }

    /**
     * Convert grid position to world position (tile center)
     */
    _gridToWorld(gridX, gridY) {
        const ts = GridConfig.TILE_SIZE;
        return {
            x: gridX * ts + ts / 2,
            y: gridY * ts + ts / 2
        };
    }

    /**
     * Register this unit on its current tile
     */
    _registerOnTile() {
        const tile = this.tileMap.getTile(this.gridPos.x, this.gridPos.y);
        if (tile) {
            tile.setOccupant(this.id);
        }
    }

    /**
     * Unregister from current tile
     */
    _unregisterFromTile() {
        const tile = this.tileMap.getTile(this.gridPos.x, this.gridPos.y);
        if (tile) {
            tile.clearOccupant();
        }
    }

    /**
     * Check if this unit is at a specific grid position
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @returns {boolean} True if unit is at this position
     */
    isAt(gridX, gridY) {
        return this.gridPos.x === gridX && this.gridPos.y === gridY;
    }

    /**
     * Start listening for global game stimuli (Sound, etc.)
     * Called by TaskController/GameManager usually, or here for simplicity.
     */
    enableStimulusListener() {
        if (this._stimulusHandler) return;

        this._stimulusHandler = (e) => this._handleStimulus(e.detail);
        window.addEventListener('gameStimulus', this._stimulusHandler);
    }

    /**
     * Handle a perceived stimulus
     * @param {Object} stimulus - { type, origin, radius, priority }
     */
    _handleStimulus(stimulus) {
        if (stimulus.type !== 'AUDIO') return;

        // Calculate distance to origin (Euclidean)
        const dx = this.gridPos.x - stimulus.origin.x;
        const dy = this.gridPos.y - stimulus.origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if we hear it
        if (dist <= stimulus.radius) {
            console.log(`[Unit ${this.id}] Heard stimulus at (${stimulus.origin.x}, ${stimulus.origin.y})! Distance: ${dist.toFixed(1)}`);

            // Check if we are already investigating something higher priority?
            // For now, just investigate.
            // Push "Investigate" task to front of queue
            // Task.investigate isn't defined yet, assume move + wait
            // TODO: Ideally Import Task to create a proper task
            // We'll trust TaskProcessor to have logic, or just manually queue move.
            if (this.taskProcessor && this.taskProcessor.handleStimulus) {
                this.taskProcessor.handleStimulus(stimulus);
            }
        }
    }

    destroy() {
        if (this._stimulusHandler) {
            window.removeEventListener('gameStimulus', this._stimulusHandler);
        }
    }

    /**
     * Main Update Loop
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Delegate behavior to the Brain
        this.taskProcessor.update(dt);
    }

    /**
     * Move physics towards a target grid coordinate
     * @param {number} targetGridX 
     * @param {number} targetGridY 
     * @param {number} dt 
     * @returns {boolean} True if arrived
     */
    moveTowards(targetGridX, targetGridY, dt) {
        const targetWorld = this._gridToWorld(targetGridX, targetGridY);

        // Calculate vector
        const dx = targetWorld.x - this.worldPos.x;
        const dy = targetWorld.y - this.worldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // DEBUG: Log if distance is unexpectedly large (toggle with window.DEBUG_MOVEMENT = true)
        if (window.DEBUG_MOVEMENT && dist > 100) {
            console.warn(`[${this.id}] TELEPORT DETECTED! dist=${Math.round(dist)}px, worldPos:(${Math.round(this.worldPos.x)},${Math.round(this.worldPos.y)}), target:(${Math.round(targetWorld.x)},${Math.round(targetWorld.y)})`);
        }

        // Snap if close
        if (dist < this.snapThreshold) {
            this.worldPos.x = targetWorld.x;
            this.worldPos.y = targetWorld.y;
            this.gridPos.x = targetGridX;
            this.gridPos.y = targetGridY;
            this._unregisterFromTile();
            this._registerOnTile();
            return true;
        }

        // Move
        const speed = MovementSpeed[this.stance] || MovementSpeed.WALK;
        const moveDist = speed * dt;

        // Normalize and scale
        const ratio = moveDist / dist;
        this.worldPos.x += dx * ratio;
        this.worldPos.y += dy * ratio;

        const ts = GridConfig.TILE_SIZE;
        const newGridX = Math.floor(this.worldPos.x / ts);
        const newGridY = Math.floor(this.worldPos.y / ts);

        if (newGridX !== this.gridPos.x || newGridY !== this.gridPos.y) {
            this._unregisterFromTile(); // Remove from old
            this.gridPos.x = newGridX;
            this.gridPos.y = newGridY;
            this._registerOnTile();     // Add to new
        }

        return false;
    }

    /**
     * Clear any reserved tile
     */
    _clearReservation() {
        if (this.reservedTile) {
            this.reservedTile.clearReservation(this.id);
            this.reservedTile = null;
        }
    }

    /**
     * Try to reserve the next tile in the path
     * @returns {boolean} True if reservation succeeded
     */
    _tryReserveNextTile() {
        if (this.pathQueue.length === 0) return true;

        const nextPos = this.pathQueue[0];
        const nextTile = this.tileMap.getTile(nextPos.x, nextPos.y);

        if (!nextTile) return false;

        // Check if we can reserve it
        if (nextTile.canOccupy(this.id)) {
            if (nextTile.reserve(this.id)) {
                this.reservedTile = nextTile;
                return true;
            }
        }

        return false;
    }

    /**
     * Get current movement speed based on stance
     */
    getSpeed() {
        return MovementSpeed[this.stance] || MovementSpeed.WALK;
    }

    /**
     * Check if the unit is currently moving
     */
    get isMoving() {
        return this.state === UnitState.MOVING;
    }

    /**
     * Set the movement path
     * @param {Array<{x: number, y: number}>} path - Array of grid positions
     */
    setPath(path) {
        // Clear any existing reservation
        this._clearReservation();

        if (!path || path.length === 0) {
            this.pathQueue = [];
            this.currentTarget = null;
            this.state = UnitState.IDLE;
            return;
        }

        // Skip the first node if it's our current position
        if (path[0].x === this.gridPos.x && path[0].y === this.gridPos.y) {
            path = path.slice(1);
        }

        this.pathQueue = path;
        this.waitTime = 0;

        if (path.length > 0) {
            // Try to reserve the first tile
            if (this._tryReserveNextTile()) {
                this.currentTarget = this._gridToWorld(path[0].x, path[0].y);
                this.state = UnitState.MOVING;
            } else {
                // Can't even start - wait
                this.state = UnitState.WAITING;
                this.currentTarget = null;
            }
        } else {
            this.currentTarget = null;
            this.state = UnitState.IDLE;
        }
    }

    /**
     * Legacy path-queue based movement (used by setPath)
     * This is separate from TaskProcessor movement
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updateLegacyMovement(deltaTime) {
        // Handle waiting state
        if (this.state === UnitState.WAITING) {
            this.waitTime += deltaTime;

            // Try to reserve again
            if (this._tryReserveNextTile()) {
                this.currentTarget = this._gridToWorld(this.pathQueue[0].x, this.pathQueue[0].y);
                this.state = UnitState.MOVING;
                this.waitTime = 0;
                return;
            }

            // If waited too long, request reroute
            if (this.waitTime > this.maxWaitTime && this.onNeedReroute) {
                this.state = UnitState.REROUTING;
                this.onNeedReroute(this);
            }
            return;
        }

        if (this.state !== UnitState.MOVING || !this.currentTarget) return;

        const speed = this.getSpeed();

        // Calculate direction to target
        const dx = this.currentTarget.x - this.worldPos.x;
        const dy = this.currentTarget.y - this.worldPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if we've arrived at current waypoint
        if (distance < this.snapThreshold) {
            this._arriveAtWaypoint();
            return;
        }

        // Normalize direction and apply speed
        const moveDistance = speed * deltaTime;

        if (moveDistance >= distance) {
            // We'd overshoot - snap to target
            this.worldPos.x = this.currentTarget.x;
            this.worldPos.y = this.currentTarget.y;
            this._arriveAtWaypoint();
        } else {
            // Normal movement
            const nx = dx / distance;
            const ny = dy / distance;

            this.worldPos.x += nx * moveDistance;
            this.worldPos.y += ny * moveDistance;

            // Corner cutting: if close to waypoint and there's a next one,
            // start blending toward the next waypoint
            if (distance < this.waypointTolerance && this.pathQueue.length > 1) {
                const nextTarget = this._gridToWorld(this.pathQueue[1].x, this.pathQueue[1].y);
                const blendFactor = 1 - (distance / this.waypointTolerance);

                // Blend direction slightly toward next waypoint
                const dx2 = nextTarget.x - this.worldPos.x;
                const dy2 = nextTarget.y - this.worldPos.y;
                const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                if (d2 > 0) {
                    const nx2 = dx2 / d2;
                    const ny2 = dy2 / d2;

                    // Apply a small nudge toward next waypoint for smoother turns
                    this.worldPos.x += nx2 * moveDistance * blendFactor * 0.3;
                    this.worldPos.y += ny2 * moveDistance * blendFactor * 0.3;
                }
            }
        }
    }

    /**
     * Handle arrival at a waypoint
     */
    _arriveAtWaypoint() {
        if (this.pathQueue.length === 0) {
            this.state = UnitState.IDLE;
            this.currentTarget = null;
            this._clearReservation();
            return;
        }

        // Update grid position
        const arrivedAt = this.pathQueue.shift();

        // Unregister from old tile, register on new
        this._unregisterFromTile();
        this.gridPos.x = arrivedAt.x;
        this.gridPos.y = arrivedAt.y;
        this._registerOnTile();
        this._clearReservation();  // Clear the reservation we just fulfilled

        // Snap world position
        this.worldPos = this._gridToWorld(this.gridPos.x, this.gridPos.y);

        // Set next target if there's more path
        if (this.pathQueue.length > 0) {
            // Try to reserve next tile
            if (this._tryReserveNextTile()) {
                this.currentTarget = this._gridToWorld(this.pathQueue[0].x, this.pathQueue[0].y);
                this.state = UnitState.MOVING;
            } else {
                // Wait for the tile to become available
                this.state = UnitState.WAITING;
                this.currentTarget = null;
                this.waitTime = 0;
            }
        } else {
            this.currentTarget = null;
            this.state = UnitState.IDLE;
        }
    }

    /**
     * Stop movement immediately
     */
    stop() {
        this._clearReservation();
        this.pathQueue = [];
        this.currentTarget = null;
        this.state = UnitState.IDLE;
        this.waitTime = 0;
    }

    /**
     * Get screen position for rendering (adjusted by camera)
     * @param {Object} camera - Camera object with x, y offset
     * @returns {{x: number, y: number}} Screen coordinates
     */
    getScreenPos(camera) {
        return {
            x: this.worldPos.x - camera.x,
            y: this.worldPos.y - camera.y
        };
    }

    /**
     * Check if unit is at a specific grid position
     */
    isAt(gridX, gridY) {
        return this.gridPos.x === gridX && this.gridPos.y === gridY;
    }

    /**
     * Get the blocking unit's ID if we're waiting
     * @returns {string|null} ID of blocking unit or null
     */
    getBlockingUnitId() {
        if (this.state !== UnitState.WAITING || this.pathQueue.length === 0) {
            return null;
        }

        const nextPos = this.pathQueue[0];
        const nextTile = this.tileMap.getTile(nextPos.x, nextPos.y);

        if (nextTile) {
            return nextTile.occupantId || nextTile.reservationId;
        }
        return null;
    }

    /**
     * Set the pathfinder reference for task execution
     * @param {Pathfinder} pathfinder - Pathfinder instance
     */
    setPathfinder(pathfinder) {
        // TaskProcessor uses window.pathfinder directly
        // Keeping this for API compatibility
    }

    /**
     * Add a task to this unit's queue
     * @param {Task} task - Task to add
     */
    assignTask(task) {
        // Legacy support - or map to taskProcessor if needed
        console.warn('Unit.assignTask is deprecated. Use GameManager.gameState.simulation.plan');
    }

    /**
     * Add multiple tasks to this unit's queue
     * @param {Task[]} tasks - Tasks to add
     */
    assignTasks(tasks) {
        this.taskController.addTasks(tasks);
    }

    /**
     * Get current task status for UI
     */
    getTaskStatus() {
        return this.taskProcessor ? this.taskProcessor.state : 'OFFLINE';
    }

    // === LOOT SYSTEM ===

    /**
     * Pick up a loot bag
     * @param {LootBag} loot - Loot to pick up
     */
    pickupLoot(loot) {
        if (this.isCaptured || this.isExtracted) return;

        loot.pickup(this.id);
        this.carriedLoot.push(loot);
        console.log(`[${this.id}] Picked up: ${loot.name} ($${loot.value})`);
    }

    /**
     * Get total value of carried loot
     * @returns {number} Total cash value
     */
    getTotalLootValue() {
        return this.carriedLoot.reduce((sum, loot) => sum + loot.value, 0);
    }

    /**
     * Check if carrying THE Score
     * @returns {boolean}
     */
    hasScore() {
        return this.carriedLoot.some(loot => loot.isScore);
    }

    // === CAPTURE SYSTEM (Hook for future Guard AI) ===

    /**
     * Capture this unit (called by guard AI when detected)
     * Loot is forfeit, unit is removed from play
     */
    capture() {
        if (this.isCaptured || this.isExtracted) return;

        this.isCaptured = true;

        // Stop all movement and tasks
        this.stop();
        if (this.taskProcessor) {
            this.taskProcessor.state = 'CAPTURED';
        }

        // Loot is lost (handled by HeistOutcomeEngine)
        console.log(`[${this.id}] CAPTURED! Loot lost: $${this.getTotalLootValue()}`);

        // Notify outcome engine (if available)
        if (window.outcomeEngine) {
            window.outcomeEngine.captureUnit(this);
        }
    }
}
