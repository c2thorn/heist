import { MapEntity } from './MapEntity.js';
import { RenderEffects } from './RenderEffects.js';

/**
 * AssetIcon - Purchasable arrangement icon on the map
 * Shows during planning phase for assets with map locations
 */
export class AssetIcon extends MapEntity {
    constructor(config) {
        super({
            id: `asset_icon_${config.assetId}`,
            gridX: config.gridX,
            gridY: config.gridY,
            icon: config.icon || '📦',
            color: config.color || '#00ff88',
            layer: 'overlay',
            label: config.label || config.assetId,
            hitRadius: 18
        });

        this.assetId = config.assetId;
        this.cost = config.cost || 0;
        this.purchased = config.purchased || false;
    }

    /**
     * Update state from asset data
     */
    updateFromAsset(asset, canAfford) {
        this.purchased = asset.purchased;
        this.cost = asset.cost;

        if (this.purchased) {
            this.color = '#ffffff'; // Owned - white
            this.icon = '✅';
        } else if (!canAfford) {
            this.color = '#ff4444'; // Can't afford - red
        } else {
            this.color = '#00ff88'; // Available - green
        }
    }

    render(ctx, camera) {
        const screenPos = this.getScreenPos(camera);
        const baseSize = 28;
        const size = RenderEffects.hoverScale(baseSize, this.isHovered, 1.15);

        // Glow effect
        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.isHovered ? 18 : 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Icon
        ctx.font = `${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.icon, screenPos.x, screenPos.y);

        ctx.restore();

        // Label + cost on hover (or always show if not purchased)
        if (this.isHovered) {
            ctx.fillStyle = this.color;
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.label, screenPos.x, screenPos.y + size / 2 + 14);

            if (!this.purchased && this.cost > 0) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '10px sans-serif';
                ctx.fillText(`$${this.cost}`, screenPos.x, screenPos.y + size / 2 + 26);
            }
        }
    }

    onClick() {
        console.log(`[AssetIcon] Clicked asset: ${this.assetId}`);
        window.dispatchEvent(new CustomEvent('assetIconClicked', {
            detail: { assetId: this.assetId }
        }));
    }
}
