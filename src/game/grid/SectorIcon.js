import { MapEntity } from './MapEntity.js';
import { RenderEffects } from './RenderEffects.js';

/**
 * SectorIcon - Intel purchase icon for unrevealed sectors
 * Appears as an "eye" icon at the center of hidden sectors
 */
export class SectorIcon extends MapEntity {
    constructor(config) {
        super({
            id: `sector_icon_${config.sectorId}`,
            gridX: config.centerX,
            gridY: config.centerY,
            icon: '👁️',
            color: '#00ccff',
            layer: 'overlay',
            label: config.label || config.sectorId,
            hitRadius: 20
        });

        this.sectorId = config.sectorId;
        this.intelCost = config.intelCost || 0;
    }

    /**
     * Update position (call when sector bounds change)
     */
    updatePosition(centerX, centerY) {
        this.gridX = centerX;
        this.gridY = centerY;
    }

    render(ctx, camera) {
        const screenPos = this.getScreenPos(camera);
        const size = RenderEffects.hoverScale(24, this.isHovered);

        // Glow effect on hover
        if (this.isHovered) {
            RenderEffects.applyGlow(ctx, this.color, 15);
        }

        // Background circle
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        ctx.fillStyle = this.isHovered ? 'rgba(0, 204, 255, 0.3)' : 'rgba(0, 136, 255, 0.2)';
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.isHovered ? 3 : 2;
        ctx.stroke();

        if (this.isHovered) {
            ctx.restore();
        }

        // Eye icon
        ctx.font = `${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, screenPos.x, screenPos.y);

        // Label + cost on hover
        if (this.isHovered) {
            ctx.fillStyle = this.color;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(this.label.toUpperCase(), screenPos.x, screenPos.y + size + 16);

            if (this.intelCost > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '10px sans-serif';
                ctx.fillText(`🔍 ${this.intelCost} Intel`, screenPos.x, screenPos.y + size + 30);
            }
        }
    }

    onClick() {
        console.log(`[SectorIcon] Clicked sector: ${this.sectorId}`);
        // Dispatch event for sector purchase
        window.dispatchEvent(new CustomEvent('sectorIconClicked', {
            detail: { sectorId: this.sectorId }
        }));
    }
}
