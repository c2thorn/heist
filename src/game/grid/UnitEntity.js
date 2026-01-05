import { MapEntity } from './MapEntity.js';
import { RenderEffects } from './RenderEffects.js';

/**
 * UnitEntity - Wrapper to make Unit objects work with EntityLayer
 * This is a composition approach - wraps existing Unit instance
 */
export class UnitEntity extends MapEntity {
    constructor(unit) {
        super({
            id: `unit_entity_${unit.id}`,
            gridX: unit.gridPos.x,
            gridY: unit.gridPos.y,
            icon: '👤',
            color: unit.color || '#00ff88',
            layer: 'entity',
            label: unit.id,
            hitRadius: unit.radius || 14
        });

        this.unit = unit; // Reference to actual Unit instance
    }

    /**
     * Sync position and visibility from the underlying unit
     * @param {TileMap} tileMap - For fog of war visibility check
     */
    sync(tileMap) {
        this.gridX = this.unit.gridPos.x;
        this.gridY = this.unit.gridPos.y;

        // Check extraction state
        if (this.unit.isExtracted) {
            this.isVisible = false;
            return;
        }

        // Crew members are always visible
        const isCrew = this.unit.id.startsWith('crew') || this.unit.isFriendly;
        if (isCrew) {
            this.isVisible = true;
            return;
        }

        // Enemies hidden in fog of war (visible in REVEALED or VISIBLE tiles)
        if (tileMap) {
            const tile = tileMap.getTile(this.gridX, this.gridY);
            this.isVisible = tile && tile.visibility !== 'HIDDEN';
        } else {
            this.isVisible = true;
        }
    }

    /**
     * Override getWorldPos to use unit's actual world position for smooth movement
     */
    getWorldPos() {
        return {
            x: this.unit.worldPos.x,
            y: this.unit.worldPos.y
        };
    }

    render(ctx, camera, tileSize = 24) {
        if (!this.isVisible) return;

        const screenPos = this.getScreenPos(camera);
        const baseRadius = this.unit.radius || 12;
        const isSelected = window.selectedUnit === this.unit;
        const size = this.isHovered ? baseRadius * 1.15 : baseRadius;

        // 1. Waiting indicator (pulsing red ring)
        if (this.unit.state === 'WAITING') {
            const pulse = 1 + Math.sin(performance.now() / 200) * 0.2;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, baseRadius * 1.5 * pulse, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.lineWidth = 1;
        }

        // 2. Selection ring (green glow)
        if (isSelected) {
            ctx.save();
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, baseRadius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }

        // 3. Hover glow
        if (this.isHovered && !isSelected) {
            ctx.save();
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
        }

        // 4. Unit body
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = this.isHovered ? '#ffffff' :
            (this.unit.state === 'WAITING' ? '#ff6666' : 'rgba(255,255,255,0.8)');
        ctx.lineWidth = this.isHovered ? 3 : 2;
        ctx.stroke();
        ctx.lineWidth = 1;

        if (this.isHovered && !isSelected) {
            ctx.restore();
        }

        // 5. Direction indicator if moving
        if (this.unit.isMoving && this.unit.currentTarget) {
            const targetWorld = {
                x: this.unit.currentTarget.x * tileSize + tileSize / 2,
                y: this.unit.currentTarget.y * tileSize + tileSize / 2
            };
            const targetScreen = {
                x: targetWorld.x - camera.x,
                y: targetWorld.y - camera.y
            };
            const dx = targetScreen.x - screenPos.x;
            const dy = targetScreen.y - screenPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                const nx = dx / dist;
                const ny = dy / dist;

                ctx.beginPath();
                ctx.moveTo(screenPos.x, screenPos.y);
                ctx.lineTo(screenPos.x + nx * 20, screenPos.y + ny * 20);
                ctx.strokeStyle = '#ffcc00';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.lineWidth = 1;
            }
        }

        // 6. Unlock progress bar
        if (this.unit.taskProcessor && this.unit.taskProcessor.state === 'UNLOCKING') {
            const progress = this.unit.taskProcessor.getUnlockProgress();
            const barWidth = tileSize * 0.8;
            const barHeight = 6;
            const barX = screenPos.x - barWidth / 2;
            const barY = screenPos.y - baseRadius - 12;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Progress fill (orange)
            ctx.fillStyle = '#ff9900';
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);

            // Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🔓', screenPos.x, barY - 4);
        }

        // 7. Unit label on hover
        if (this.isHovered) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.unit.id.toUpperCase(), screenPos.x, screenPos.y - size - 8);
        }
    }

    onClick() {
        console.log(`[UnitEntity] Clicked unit: ${this.unit.id}`);
        window.dispatchEvent(new CustomEvent('unitClicked', {
            detail: { unit: this.unit, unitId: this.unit.id }
        }));
    }
}
