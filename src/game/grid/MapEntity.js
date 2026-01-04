import { GridConfig } from './GridConfig.js';

/**
 * MapEntity - Base class for all interactive map elements
 * Provides unified hit-testing, rendering interface, and hover/selection state
 */
export class MapEntity {
    /**
     * @param {Object} config
     * @param {string} config.id - Unique identifier
     * @param {number} config.gridX - Grid X position
     * @param {number} config.gridY - Grid Y position
     * @param {string} config.icon - Emoji or character to display
     * @param {string} config.color - Primary color
     * @param {string} config.layer - Render layer: 'ground', 'entity', 'overlay'
     * @param {string} config.label - Display label
     */
    constructor(config) {
        this.id = config.id;
        this.gridX = config.gridX ?? 0;
        this.gridY = config.gridY ?? 0;
        this.icon = config.icon || '?';
        this.color = config.color || '#ffffff';
        this.layer = config.layer || 'entity';
        this.label = config.label || '';

        // State
        this.isVisible = true;
        this.isHovered = false;
        this.isSelected = false;

        // Hit detection
        this.hitRadius = config.hitRadius || 16;
    }

    /**
     * Get world position (center of entity)
     */
    getWorldPos() {
        const ts = GridConfig.TILE_SIZE;
        return {
            x: this.gridX * ts + ts / 2,
            y: this.gridY * ts + ts / 2
        };
    }

    /**
     * Get screen position given camera
     */
    getScreenPos(camera) {
        const world = this.getWorldPos();
        return {
            x: world.x - camera.x,
            y: world.y - camera.y
        };
    }

    /**
     * Test if a screen point hits this entity
     */
    hitTest(screenX, screenY, camera) {
        const screenPos = this.getScreenPos(camera);
        const dist = Math.hypot(screenX - screenPos.x, screenY - screenPos.y);
        return dist < this.hitRadius;
    }

    /**
     * Check if entity is on screen
     */
    isOnScreen(camera) {
        const screenPos = this.getScreenPos(camera);
        const margin = this.hitRadius + 10;
        return screenPos.x > -margin &&
            screenPos.x < camera.width + margin &&
            screenPos.y > -margin &&
            screenPos.y < camera.height + margin;
    }

    /**
     * Render the entity - override in subclasses
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera
     */
    render(ctx, camera) {
        // Default: simple circle with icon
        const screenPos = this.getScreenPos(camera);
        const size = this.isHovered ? this.hitRadius * 1.15 : this.hitRadius;

        // Glow on hover
        if (this.isHovered) {
            ctx.save();
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 12;
        }

        // Circle background
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = this.isHovered ? '#ffffff' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = this.isHovered ? 3 : 2;
        ctx.stroke();

        if (this.isHovered) {
            ctx.restore();
        }

        // Icon
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, screenPos.x, screenPos.y);

        // Label on hover
        if (this.isHovered && this.label) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px sans-serif';
            ctx.fillText(this.label, screenPos.x, screenPos.y + size + 14);
        }
    }

    /**
     * Called when entity is clicked - override in subclasses
     */
    onClick() {
        console.log(`[MapEntity] Clicked: ${this.id}`);
    }
}
