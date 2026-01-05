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
            icon: '🔍',
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
        const baseSize = 36; // 1.5x larger (was 24)
        const size = RenderEffects.hoverScale(baseSize, this.isHovered, 1.2);

        // Blue glow shadow directly on the eye (no circle)
        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.isHovered ? 20 : 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Eye icon - prominent, no shading
        ctx.font = `${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff'; // Bright white eye
        ctx.fillText(this.icon, screenPos.x, screenPos.y);

        ctx.restore();

        // Label + cost on hover
        if (this.isHovered) {
            ctx.fillStyle = this.color;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(this.label.toUpperCase(), screenPos.x, screenPos.y + size / 2 + 20);

            if (this.intelCost > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '10px sans-serif';
                ctx.fillText(`🔍 ${this.intelCost} Intel`, screenPos.x, screenPos.y + size / 2 + 34);
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
