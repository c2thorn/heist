/**
 * RenderEffects - Shared rendering utilities for consistent visual feedback
 */
export const RenderEffects = {
    /**
     * Apply glow effect (call ctx.restore() after drawing)
     */
    applyGlow(ctx, color, blur = 12) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    },

    /**
     * Calculate hover scale
     */
    hoverScale(baseSize, isHovered, scale = 1.15) {
        return isHovered ? baseSize * scale : baseSize;
    },

    /**
     * Draw a circular entity (unit-style)
     */
    drawCircle(ctx, x, y, radius, color, isHovered, isSelected) {
        // Selection ring
        if (isSelected) {
            this.applyGlow(ctx, '#00ff88', 12);
            ctx.beginPath();
            ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }

        // Hover glow
        if (isHovered && !isSelected) {
            this.applyGlow(ctx, color, 10);
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();
        ctx.lineWidth = 1;

        if (isHovered && !isSelected) {
            ctx.restore();
        }
    },

    /**
     * Draw a rounded rectangle (interactable-style)
     */
    drawRoundedRect(ctx, x, y, size, color, isHovered, cornerRadius = 4) {
        if (isHovered) {
            this.applyGlow(ctx, color, 15);
        }

        ctx.fillStyle = color;
        ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = isHovered ? 3 : 2;

        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, cornerRadius);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1;

        if (isHovered) {
            ctx.restore();
        }
    },

    /**
     * Draw centered icon/emoji
     */
    drawIcon(ctx, x, y, icon, color = '#000000', fontSize = 14) {
        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, x, y);
    },

    /**
     * Draw label text below an entity
     */
    drawLabel(ctx, x, y, label, color = '#ffffff', fontSize = 10) {
        ctx.fillStyle = color;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y);
    },

    /**
     * Draw progress bar
     */
    drawProgressBar(ctx, x, y, width, height, progress, bgColor = 'rgba(0,0,0,0.7)', fillColor = '#00ff88') {
        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(x - width / 2, y, width, height);

        // Fill
        ctx.fillStyle = fillColor;
        ctx.fillRect(x - width / 2, y, width * progress, height);

        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(x - width / 2, y, width, height);
    }
};
