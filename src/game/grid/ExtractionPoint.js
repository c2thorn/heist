import { MapEntity } from './MapEntity.js';
import { GridConfig } from './GridConfig.js';

/**
 * ExtractionPoint - A location where crew can escape the heist
 * Crew stepping on this tile are instantly extracted (for now)
 */
export class ExtractionPoint extends MapEntity {
    /**
     * @param {Object} config
     * @param {string} config.id - Unique identifier
     * @param {string} config.name - Display name (e.g., "Back Alley")
     * @param {number} config.x - Grid X position
     * @param {number} config.y - Grid Y position
     * @param {boolean} config.isDefault - True if this is the default exit
     */
    constructor(config) {
        super({
            id: config.id,
            gridX: config.x,
            gridY: config.y,
            icon: '🚪',
            color: '#22c55e',  // Green for exit
            layer: 'ground',
            label: config.name || 'Exit',
            hitRadius: GridConfig.TILE_SIZE / 2
        });

        this.name = config.name || 'Exit';
        this.isDefault = config.isDefault || false;
        this.isActive = true;  // Can be disabled by alarms, etc.
    }

    /**
     * Check if a unit is on this extraction point
     * @param {Unit} unit - Unit to check
     * @returns {boolean} True if unit is on this tile
     */
    isUnitOnPoint(unit) {
        return unit.gridPos.x === this.gridX && unit.gridPos.y === this.gridY;
    }

    /**
     * Render the extraction point
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera
     */
    render(ctx, camera) {
        const screenPos = this.getScreenPos(camera);
        const ts = GridConfig.TILE_SIZE;

        // Draw extraction zone highlight
        ctx.save();

        // Pulsing glow effect
        const pulse = 0.5 + 0.3 * Math.sin(Date.now() / 500);

        // Green zone marker
        ctx.fillStyle = `rgba(34, 197, 94, ${0.2 * pulse})`;
        ctx.fillRect(
            screenPos.x - ts / 2,
            screenPos.y - ts / 2,
            ts,
            ts
        );

        // Border
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.6 + 0.2 * pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
            screenPos.x - ts / 2,
            screenPos.y - ts / 2,
            ts,
            ts
        );
        ctx.setLineDash([]);

        // Exit arrow icon
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⬆', screenPos.x, screenPos.y);

        // Label
        if (this.isHovered || this.isDefault) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px sans-serif';
            ctx.fillText(this.name, screenPos.x, screenPos.y + ts / 2 + 10);
        }

        ctx.restore();
    }
}
