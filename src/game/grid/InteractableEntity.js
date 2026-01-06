import { MapEntity } from './MapEntity.js';
import { GridConfig } from './GridConfig.js';

/**
 * InteractableEntity - Wrapper to make Interactable objects work with EntityLayer
 * Uses the "blue square" style from legacy rendering
 */
export class InteractableEntity extends MapEntity {
    constructor(interactable) {
        // Determine icon based on type (matching legacy)
        let icon = '?';
        const isScore = interactable.isScore || false;

        switch (interactable.type) {
            case 'SAFE':
                icon = isScore ? '⭐' : '$';
                break;
            case 'COMPUTER':
                icon = '💻';
                break;
            case 'PANEL':
                icon = '⚡';
                break;
            case 'DOOR':
                icon = '🔒';
                break;
            case 'ITEM':
                icon = '📦';
                break;
            case 'OBJECTIVE':
                icon = '⭐';
                break;
        }

        super({
            id: `interactable_entity_${interactable.id}`,
            gridX: interactable.gridX,
            gridY: interactable.gridY,
            icon: icon,
            color: interactable.color || '#ffcc00',
            layer: 'entity',
            label: interactable.name || interactable.label || interactable.id,
            hitRadius: GridConfig.TILE_SIZE * 0.35  // Match rounded rect size
        });

        this.interactable = interactable;
        this.isScore = isScore;  // Track if this is THE Score
    }

    /**
     * Sync visibility from interactable state
     */
    sync(tileMap) {
        // Score is ALWAYS visible, even through fog
        if (this.isScore) {
            this.isVisible = true;
        } else if (tileMap) {
            // Hide if in fog of war for non-Score items
            const tile = tileMap.getTile(this.gridX, this.gridY);
            this.isVisible = tile && tile.visibility !== 'HIDDEN';
        }

        // Update color if state changed
        if (this.interactable.state === 'COMPLETED') {
            this.color = '#666666';
        }
    }

    render(ctx, camera) {
        if (!this.isVisible) return;

        const screenPos = this.getScreenPos(camera);
        const ts = GridConfig.TILE_SIZE;
        const baseSize = ts * 0.6;
        const size = this.isHovered ? ts * 0.7 : baseSize;  // Scale up on hover

        // Glow effect on hover
        if (this.isHovered) {
            ctx.save();
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        // Rounded rectangle background (the "blue square" style)
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.isHovered ? '#ffffff' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = this.isHovered ? 3 : 2;

        ctx.beginPath();
        ctx.roundRect(screenPos.x - size / 2, screenPos.y - size / 2, size, size, 4);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1;

        if (this.isHovered) {
            ctx.restore();
        }

        // Draw icon (black, centered)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, screenPos.x, screenPos.y);

        // Draw progress bar if in progress
        if (this.interactable.state === 'IN_PROGRESS') {
            const barWidth = ts * 0.8;
            const barHeight = 6;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y - size / 2 - 10;
            const progress = this.interactable.getProgressPercent ?
                this.interactable.getProgressPercent() : 0;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Progress fill
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);

            // Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        // Label on hover
        if (this.isHovered && this.label) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.label, screenPos.x, screenPos.y + size / 2 + 12);
        }
    }

    onClick() {
        console.log(`[InteractableEntity] Clicked: ${this.interactable.id}`);
        window.dispatchEvent(new CustomEvent('interactableClicked', {
            detail: { interactable: this.interactable }
        }));
    }
}
