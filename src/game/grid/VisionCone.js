import { GridConfig } from './GridConfig.js';

/**
 * VisionCone - Handles visibility detection for guards/cameras
 * Per SPEC_002 Sections 4-5
 */
export class VisionCone {
    /**
     * Create a vision cone
     * @param {Object} config - Configuration
     * @param {number} config.range - Vision range in tiles
     * @param {number} config.fov - Field of view in degrees
     * @param {number} config.detectionRate - Base detection rate per second
     */
    constructor(config = {}) {
        this.range = config.range || 8;            // Tiles
        this.fov = config.fov || 90;               // Degrees
        this.detectionRate = config.detectionRate || 0.5;  // Per second

        // Current state
        this.origin = { x: 0, y: 0 };              // World position
        this.facingAngle = 0;                      // Degrees (0 = right, 90 = down)

        // Detection tracking per target
        this.detectionMeters = new Map();          // targetId -> detection value (0-1)

        // Thresholds
        this.suspicionThreshold = 0.5;
        this.detectedThreshold = 1.0;

        // Decay rate when out of sight
        this.decayRate = 0.3;                      // Per second
    }

    /**
     * Update the vision cone's position and facing
     * @param {number} worldX - World X position
     * @param {number} worldY - World Y position
     * @param {number} facingAngle - Facing angle in degrees
     */
    setPosition(worldX, worldY, facingAngle) {
        this.origin.x = worldX;
        this.origin.y = worldY;
        this.facingAngle = facingAngle;
    }

    /**
     * Check if a world position is within the vision cone arc (no LOS check)
     * @param {number} targetX - Target world X
     * @param {number} targetY - Target world Y
     * @returns {{inCone: boolean, distance: number, angle: number}}
     */
    checkConeArc(targetX, targetY) {
        const dx = targetX - this.origin.x;
        const dy = targetY - this.origin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const rangePx = this.range * GridConfig.TILE_SIZE;

        // Distance check
        if (distance > rangePx) {
            return { inCone: false, distance, angle: 0 };
        }

        // Angle check
        const angleToTarget = Math.atan2(dy, dx) * (180 / Math.PI);
        let angleDiff = angleToTarget - this.facingAngle;

        // Normalize to -180 to 180
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;

        const halfFov = this.fov / 2;
        const inCone = Math.abs(angleDiff) <= halfFov;

        return { inCone, distance, angle: angleDiff };
    }

    /**
     * Supercover line algorithm - get all tiles a line passes through
     * @param {number} x0 - Start grid X
     * @param {number} y0 - Start grid Y
     * @param {number} x1 - End grid X
     * @param {number} y1 - End grid Y
     * @returns {Array<{x: number, y: number}>} All tiles the line touches
     */
    static supercoverLine(x0, y0, x1, y1) {
        const tiles = [];
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;

        let x = x0;
        let y = y0;

        if (dx === 0 && dy === 0) {
            tiles.push({ x, y });
            return tiles;
        }

        let err = dx - dy;

        while (true) {
            tiles.push({ x, y });

            if (x === x1 && y === y1) break;

            const e2 = 2 * err;

            // Supercover: check diagonal crossing
            if (e2 > -dy && e2 < dx) {
                // Would cross corner - add both adjacent tiles
                tiles.push({ x: x + sx, y });
                tiles.push({ x, y: y + sy });
            }

            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return tiles;
    }

    /**
     * Check line of sight to a target using raycasting
     * @param {TileMap} tileMap - The tile map
     * @param {number} targetX - Target world X
     * @param {number} targetY - Target world Y
     * @returns {{visible: boolean, blockedByTile: Object|null, throughCover: boolean}}
     */
    checkLineOfSight(tileMap, targetX, targetY) {
        const ts = GridConfig.TILE_SIZE;

        // Convert to grid coordinates
        const startGrid = {
            x: Math.floor(this.origin.x / ts),
            y: Math.floor(this.origin.y / ts)
        };
        const endGrid = {
            x: Math.floor(targetX / ts),
            y: Math.floor(targetY / ts)
        };

        // Get all tiles the line passes through
        const lineTiles = VisionCone.supercoverLine(
            startGrid.x, startGrid.y,
            endGrid.x, endGrid.y
        );

        let throughCover = false;

        // Check each tile (skip first which is the observer's tile)
        for (let i = 1; i < lineTiles.length; i++) {
            const pos = lineTiles[i];
            const tile = tileMap.getTile(pos.x, pos.y);

            if (!tile) continue;

            // Blocked by non-transparent tile
            if (!tile.isTransparent) {
                return { visible: false, blockedByTile: tile, throughCover };
            }

            // Check for cover
            if (tile.isCover) {
                throughCover = true;
            }
        }

        return { visible: true, blockedByTile: null, throughCover };
    }

    /**
     * Full visibility check combining cone and LOS
     * @param {TileMap} tileMap - The tile map
     * @param {number} targetX - Target world X
     * @param {number} targetY - Target world Y
     * @param {string} targetStance - Target's stance (SNEAK, WALK, RUN)
     * @returns {{visible: boolean, distance: number, throughCover: boolean, blocked: boolean}}
     */
    checkVisibility(tileMap, targetX, targetY, targetStance = 'WALK') {
        // Step 1: Cone arc check
        const coneResult = this.checkConeArc(targetX, targetY);

        if (!coneResult.inCone) {
            return { visible: false, distance: coneResult.distance, throughCover: false, blocked: false };
        }

        // Step 2: Line of sight check
        const losResult = this.checkLineOfSight(tileMap, targetX, targetY);

        if (!losResult.visible) {
            return { visible: false, distance: coneResult.distance, throughCover: false, blocked: true };
        }

        // Step 3: Cover check - sneaking behind cover = hidden
        if (losResult.throughCover && (targetStance === 'SNEAK' || targetStance === 'CROUCH')) {
            return { visible: false, distance: coneResult.distance, throughCover: true, blocked: false };
        }

        return {
            visible: true,
            distance: coneResult.distance,
            throughCover: losResult.throughCover,
            blocked: false
        };
    }

    /**
     * Update detection meter for a target
     * @param {string} targetId - Target identifier
     * @param {boolean} isVisible - Whether target is currently visible
     * @param {number} distance - Distance to target (pixels)
     * @param {string} targetStance - Target stance
     * @param {number} deltaTime - Time since last update
     * @returns {{value: number, state: string}} Detection value and state
     */
    updateDetection(targetId, isVisible, distance, targetStance, deltaTime) {
        let value = this.detectionMeters.get(targetId) || 0;

        if (isVisible) {
            // Calculate detection rate multipliers
            const maxDist = this.range * GridConfig.TILE_SIZE;
            const distMultiplier = 1 - (distance / maxDist) * 0.5;  // Closer = faster

            let stanceMultiplier = 1.0;
            switch (targetStance) {
                case 'SNEAK':
                case 'CROUCH':
                    stanceMultiplier = 0.5;
                    break;
                case 'RUN':
                    stanceMultiplier = 2.0;
                    break;
            }

            value += this.detectionRate * distMultiplier * stanceMultiplier * deltaTime;
            value = Math.min(value, 1.0);
        } else {
            // Decay when not visible
            value -= this.decayRate * deltaTime;
            value = Math.max(value, 0);
        }

        this.detectionMeters.set(targetId, value);

        // Determine state
        let state = 'UNAWARE';
        if (value >= this.detectedThreshold) {
            state = 'DETECTED';
        } else if (value >= this.suspicionThreshold) {
            state = 'SUSPICIOUS';
        }

        return { value, state };
    }

    /**
     * Get detection value for a target
     * @param {string} targetId - Target identifier
     * @returns {number} Detection value 0-1
     */
    getDetection(targetId) {
        return this.detectionMeters.get(targetId) || 0;
    }

    /**
     * Reset detection for a target
     * @param {string} targetId - Target identifier
     */
    resetDetection(targetId) {
        this.detectionMeters.delete(targetId);
    }

    /**
     * Get vision cone vertices for rendering
     * @returns {Array<{x: number, y: number}>} Points defining the cone
     */
    getConeVertices() {
        const rangePx = this.range * GridConfig.TILE_SIZE;
        const halfFov = (this.fov / 2) * (Math.PI / 180);
        const facingRad = this.facingAngle * (Math.PI / 180);

        const points = [
            { x: this.origin.x, y: this.origin.y }  // Origin
        ];

        // Arc points (for smooth rendering)
        const arcSegments = 16;
        for (let i = 0; i <= arcSegments; i++) {
            const t = i / arcSegments;
            const angle = facingRad - halfFov + (t * 2 * halfFov);
            points.push({
                x: this.origin.x + Math.cos(angle) * rangePx,
                y: this.origin.y + Math.sin(angle) * rangePx
            });
        }

        return points;
    }
}
