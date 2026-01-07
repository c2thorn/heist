import { MapEntity } from './MapEntity.js';

/**
 * Camera - Security camera entity (stub for future implementation)
 * 
 * Planned features:
 * - Fixed position with rotating view cone
 * - Can be disabled via security panel or power cut arrangement
 * - Alerts guards if crew spotted in view
 */
export class Camera extends MapEntity {
    constructor(config) {
        super({
            id: config.id || `camera_${Date.now()}`,
            gridX: config.gridX,
            gridY: config.gridY,
            icon: '📹',
            color: '#ff6b6b',
            layer: 'entity',
            label: config.label || 'Security Camera',
            hitRadius: 12
        });

        // Camera-specific properties
        this.facing = config.facing || 0;  // Degrees (0 = right, 90 = down)
        this.fov = config.fov || 60;       // Field of view degrees
        this.range = config.range || 5;    // Vision range in tiles
        this.rotationSpeed = config.rotationSpeed || 0;  // Degrees per second (0 = fixed)
        this.rotationRange = config.rotationRange || 0;  // Max rotation from start

        // State
        this.isDisabled = false;
        this.alertLevel = 0;  // 0-1 detection meter
    }

    /**
     * Update camera rotation and detection (stub)
     */
    update(deltaTime) {
        if (this.isDisabled) return;

        // TODO: Implement rotation
        // TODO: Implement crew detection
        // TODO: Alert guards on detection
    }

    /**
     * Disable the camera (via arrangement or panel)
     */
    disable() {
        this.isDisabled = true;
        this.icon = '📷';  // Different icon when disabled
        this.color = '#666666';
        console.log(`[Camera] ${this.id} disabled`);
    }

    /**
     * Re-enable the camera
     */
    enable() {
        this.isDisabled = false;
        this.icon = '📹';
        this.color = '#ff6b6b';
        console.log(`[Camera] ${this.id} re-enabled`);
    }

    /**
     * Render camera with view cone indicator
     */
    render(ctx, camera) {
        // Base entity render
        super.render(ctx, camera);

        // TODO: Draw view cone (similar to guard vision)
        // For now, just show facing direction as a line
        if (!this.isDisabled) {
            const screenPos = this.getScreenPos(camera);
            const radians = this.facing * Math.PI / 180;
            const lineLength = 20;

            ctx.beginPath();
            ctx.moveTo(screenPos.x, screenPos.y);
            ctx.lineTo(
                screenPos.x + Math.cos(radians) * lineLength,
                screenPos.y + Math.sin(radians) * lineLength
            );
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}
