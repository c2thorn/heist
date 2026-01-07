import { GridConfig } from './GridConfig.js';
import { EntityLayer } from './EntityLayer.js';
import { SectorIcon } from './SectorIcon.js';
import { AssetIcon } from './AssetIcon.js';
import { UnitEntity } from './UnitEntity.js';
import { InteractableEntity } from './InteractableEntity.js';

/**
 * GridRenderer - Canvas-based tile grid renderer with camera/viewport
 * Supports panning via drag or WASD keys, and viewport clipping
 */
export class GridRenderer {
    /**
     * Create a new GridRenderer
     * @param {HTMLCanvasElement} canvas - Target canvas element
     * @param {TileMap} tileMap - The tile map to render
     * @param {Object} options - Optional configuration
     */
    constructor(canvas, tileMap, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileMap = tileMap;

        // Units to render (legacy - kept for compatibility)
        this.units = [];

        // Vision cones to render (for guards/cameras)
        this.visionCones = [];

        // Interactables to render (legacy - kept for compatibility)
        this.interactables = [];

        // NEW: Unified entity layer system
        this.entityLayer = new EntityLayer();

        // Rendering settings
        this.tileSize = GridConfig.TILE_SIZE;

        // Viewport/Camera settings
        this.camera = {
            x: 0,       // Camera position (top-left corner in world coords)
            y: 0,
            width: options.viewportWidth || 800,
            height: options.viewportHeight || 500
        };

        // Pan settings
        this.panSpeed = 300;  // Pixels per second for keyboard pan
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.cameraStart = { x: 0, y: 0 };

        // Keyboard state
        this.keysPressed = new Set();
        this.lastFrameTime = performance.now();

        // Color palette for tile types
        this.colors = {
            [GridConfig.TILE_TYPE.VOID]: '#0a0a12',
            [GridConfig.TILE_TYPE.FLOOR]: '#3d4a5a',
            [GridConfig.TILE_TYPE.WALL]: '#1a1a2e',
            [GridConfig.TILE_TYPE.DOOR]: '#8b4513',
            [GridConfig.TILE_TYPE.WINDOW]: '#4a7c9b',
            [GridConfig.TILE_TYPE.VENT]: '#2a2a3a',
            hiddenOverlay: 'rgba(0, 0, 0, 0.9)',
            revealedOverlay: 'rgba(0, 0, 0, 0.5)',
            gridLine: 'rgba(255, 255, 255, 0.05)',
            wallOutline: '#0d0d1a'
        };

        // Hover state
        this.hoveredTile = null;

        // Setup canvas size to viewport
        this._resizeCanvas();



        // Bind input handlers
        this._setupInputHandlers();

        // Clamp camera to valid bounds immediately (prevents jump on first scroll)
        this._clampCamera();

        // Setup Phase Hover State
        this.hoveredAssetId = null;
        window.addEventListener('assetHover', (e) => {
            const { assetId, hovering } = e.detail;
            this.hoveredAssetId = hovering ? assetId : null;
        });

        // Fog of war noise animation
        this.fogTime = 0;
        this._initFogNoise();
    }

    /**
     * Initialize fog noise pattern (creates a small noise texture)
     */
    _initFogNoise() {
        // Create a small noise canvas for fog texture
        this.fogNoiseCanvas = document.createElement('canvas');
        this.fogNoiseCanvas.width = 64;
        this.fogNoiseCanvas.height = 64;
        const noiseCtx = this.fogNoiseCanvas.getContext('2d');

        // Generate noise pattern
        const imgData = noiseCtx.createImageData(64, 64);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const noise = Math.random() * 60; // Subtle variation
            imgData.data[i] = noise;       // R
            imgData.data[i + 1] = noise;   // G
            imgData.data[i + 2] = noise;   // B
            imgData.data[i + 3] = 255;     // A
        }
        noiseCtx.putImageData(imgData, 0, 0);

        // Create pattern
        this.fogPattern = this.ctx.createPattern(this.fogNoiseCanvas, 'repeat');
    }

    /**
     * Add a unit to be rendered and updated
     * @param {Unit} unit - The unit to add
     */
    addUnit(unit) {
        this.units.push(unit);

        // Create UnitEntity wrapper for EntityLayer
        const unitEntity = new UnitEntity(unit);
        this.entityLayer.add(unitEntity);
    }

    /**
     * Remove a unit
     * @param {string} unitId - ID of unit to remove
     */
    removeUnit(unitId) {
        this.units = this.units.filter(u => u.id !== unitId);
        this.entityLayer.remove(`unit_entity_${unitId}`);
    }

    /**
     * Get a unit by ID
     * @param {string} unitId - ID of unit
     * @returns {Unit|null}
     */
    getUnit(unitId) {
        return this.units.find(u => u.id === unitId) || null;
    }

    /**
     * Add an interactable to be rendered
     * @param {Interactable} interactable - The interactable to add
     */
    addInteractable(interactable) {
        this.interactables.push(interactable);

        // Create InteractableEntity wrapper for unified hover/click in EntityLayer
        const entity = new InteractableEntity(interactable);
        this.entityLayer.add(entity);
    }

    /**
     * Remove an interactable
     * @param {string} id - ID of interactable to remove
     */
    removeInteractable(id) {
        this.interactables = this.interactables.filter(i => i.id !== id);
        this.entityLayer.remove(`interactable_entity_${id}`);
    }

    /**
     * Get interactable at a grid position
     * @param {number} gridX - Grid X
     * @param {number} gridY - Grid Y
     * @returns {Interactable|null}
     */
    getInteractableAt(gridX, gridY) {
        return this.interactables.find(i => i.gridX === gridX && i.gridY === gridY) || null;
    }

    /**
     * Add a generic map entity to be rendered
     * @param {MapEntity} entity - Any MapEntity subclass (ExtractionPoint, etc.)
     */
    addEntity(entity) {
        this.entityLayer.add(entity);
    }

    /**
     * Remove a generic entity by ID
     * @param {string} entityId - ID of entity to remove
     */
    removeEntity(entityId) {
        this.entityLayer.remove(entityId);
    }

    /**
     * Set canvas size to viewport dimensions
     */
    _resizeCanvas() {
        this.canvas.width = this.camera.width;
        this.canvas.height = this.camera.height;
    }



    /**
     * Clamp camera to map bounds with padding for UI elements
     */
    _clampCamera() {
        const bounds = this.tileMap.getWorldBounds();
        const padding = 80;

        const minX = -padding;
        const minY = -padding;
        const maxX = Math.max(0, bounds.width - this.camera.width + padding);
        const maxY = Math.max(0, bounds.height - this.camera.height + padding);

        this.camera.x = Math.max(minX, Math.min(this.camera.x, maxX));
        this.camera.y = Math.max(minY, Math.min(this.camera.y, maxY));
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.camera.x,
            y: screenY + this.camera.y
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.camera.x,
            y: worldY - this.camera.y
        };
    }

    /**
     * Setup mouse and keyboard input handlers
     */
    _setupInputHandlers() {
        // Mouse move - update hovered entities
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            // Handle dragging
            if (this.isDragging) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                this.camera.x = this.cameraStart.x - dx;
                this.camera.y = this.cameraStart.y - dy;
                this._clampCamera();
            }

            // Update hovered tile
            const world = this.screenToWorld(screenX, screenY);
            const gridPos = this.tileMap.worldToGrid(world.x, world.y);
            this.hoveredTile = this.tileMap.getTile(gridPos.x, gridPos.y);

            // EntityLayer handles all entity hover detection (units, interactables, icons)
            const hoveredEntity = this.entityLayer.updateHover(screenX, screenY, this.camera);

            // Update cursor style based on hovered entity
            this.canvas.style.cursor = hoveredEntity ? 'pointer' : 'default';
        });

        // Mouse leave
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredTile = null;
            this.isDragging = false;
        });

        // Mouse down - start drag
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || e.button === 2) {  // Middle or right click
                this.isDragging = true;
                this.dragStart = { x: e.clientX, y: e.clientY };
                this.cameraStart = { x: this.camera.x, y: this.camera.y };
                e.preventDefault();
            }
        });

        // Mouse up - end drag
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 1 || e.button === 2) {
                this.isDragging = false;
            }
        });

        // Prevent context menu on right-click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Left click - check entities first, then tile
        this.canvas.addEventListener('click', (e) => {
            if (this.isDragging) return;

            // Get screen coordinates
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            // Check entity layer for clicks first (SectorIcons, etc.)
            const clickedEntity = this.entityLayer.handleClick(screenX, screenY, this.camera);
            if (clickedEntity) {
                console.log('Clicked entity:', clickedEntity.id);
                return; // Entity handled the click
            }

            // No entity hit - dispatch tile click
            if (this.hoveredTile) {
                console.log('Clicked tile:', this.hoveredTile.toJSON());
                window.dispatchEvent(new CustomEvent('tileClicked', {
                    detail: this.hoveredTile.toJSON()
                }));
            }
        });

        // Keyboard - WASD panning
        window.addEventListener('keydown', (e) => {
            if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
                this.keysPressed.add(e.key.toLowerCase());
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keysPressed.delete(e.key.toLowerCase());
        });

        // Mouse wheel - future zoom support (for now just pan up/down)
        this.canvas.addEventListener('wheel', (e) => {
            this.camera.y += e.deltaY * 0.5;
            this.camera.x += e.deltaX * 0.5;
            this._clampCamera();
            e.preventDefault();
        }, { passive: false });
    }

    /**
     * Update camera based on keyboard input
     */
    _updateCamera(deltaTime) {
        const speed = this.panSpeed * deltaTime;

        if (this.keysPressed.has('w')) this.camera.y -= speed;
        if (this.keysPressed.has('s')) this.camera.y += speed;
        if (this.keysPressed.has('a')) this.camera.x -= speed;
        if (this.keysPressed.has('d')) this.camera.x += speed;

        if (this.keysPressed.size > 0) {
            this._clampCamera();
        }
    }

    /**
     * Get fill color for a tile
     */
    _getTileColor(tile) {
        if (tile.zoneId && tile.type === GridConfig.TILE_TYPE.FLOOR) {
            const zone = this.tileMap.getZone(tile.zoneId);
            if (zone && zone.color) return zone.color;
        }
        return this.colors[tile.type] || this.colors[GridConfig.TILE_TYPE.VOID];
    }

    /**
     * Render the visible portion of the grid
     */
    render() {
        const ctx = this.ctx;
        const ts = this.tileSize;

        // Calculate visible tile range
        const startX = Math.floor(this.camera.x / ts);
        const startY = Math.floor(this.camera.y / ts);
        const endX = Math.ceil((this.camera.x + this.camera.width) / ts);
        const endY = Math.ceil((this.camera.y + this.camera.height) / ts);

        // Clear canvas
        ctx.fillStyle = this.colors[GridConfig.TILE_TYPE.VOID];
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw only visible tiles
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = this.tileMap.getTile(x, y);
                if (!tile) continue;

                // World to screen conversion
                const screen = this.worldToScreen(x * ts, y * ts);
                const px = screen.x;
                const py = screen.y;

                // Base tile fill
                ctx.fillStyle = this._getTileColor(tile);
                ctx.fillRect(px, py, ts, ts);

                // Wall rendering
                if (tile.type === GridConfig.TILE_TYPE.WALL) {
                    ctx.fillStyle = this.colors.wallOutline;
                    ctx.fillRect(px, py, ts, ts);
                    ctx.fillStyle = this.colors[GridConfig.TILE_TYPE.WALL];
                    ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
                }

                // Door rendering
                if (tile.type === GridConfig.TILE_TYPE.DOOR) {
                    ctx.fillStyle = this.colors[GridConfig.TILE_TYPE.DOOR];
                    ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);

                    if (tile.doorState === 'OPEN') {
                        ctx.fillStyle = this._getTileColor({
                            type: GridConfig.TILE_TYPE.FLOOR,
                            zoneId: tile.zoneId
                        });
                        ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
                    }
                }

                // Visibility overlay with animated fog
                if (tile.visibility === GridConfig.VISIBILITY.HIDDEN) {
                    // Dark base layer
                    ctx.fillStyle = 'rgba(5, 5, 15, 0.92)';
                    ctx.fillRect(px, py, ts, ts);

                    // Animated noise overlay
                    if (this.fogPattern) {
                        ctx.save();
                        ctx.globalAlpha = 0.15;
                        ctx.globalCompositeOperation = 'screen';
                        // Animate by shifting pattern
                        const shift = Math.sin(this.fogTime * 0.5 + (x + y) * 0.3) * 2;
                        ctx.translate(shift, shift * 0.7);
                        ctx.fillStyle = this.fogPattern;
                        ctx.fillRect(px - shift, py - shift * 0.7, ts + 4, ts + 4);
                        ctx.restore();
                    }
                } else if (tile.visibility === GridConfig.VISIBILITY.REVEALED) {
                    // Revealed: subtle darken with slight noise
                    ctx.fillStyle = 'rgba(10, 10, 25, 0.45)';
                    ctx.fillRect(px, py, ts, ts);
                }

                // Grid lines
                ctx.strokeStyle = this.colors.gridLine;
                ctx.strokeRect(px, py, ts, ts);
            }
        }

        // Tile hover highlight removed - focus on units/interactables instead

        // Render vision cones (between tiles and units)
        this._renderVisionCones();


        // Interactables now rendered via EntityLayer (InteractableEntity)
        // this._renderInteractables();

        // Units now rendered via EntityLayer (UnitEntity)
        // this._renderUnits();

        // Render tile info overlay (bottom-left corner)
        this._renderTileInfoOverlay();

        // EntityLayer overlay now rendered in startRenderLoop (after planning overlay)
    }

    /**
     * Render tile info overlay in bottom-left corner
     */
    _renderTileInfoOverlay() {
        if (!this.hoveredTile) return;

        const ctx = this.ctx;
        const tile = this.hoveredTile;
        const padding = 10;
        const lineHeight = 16;

        // Collect info lines
        const lines = [];
        lines.push(`Pos: (${tile.x}, ${tile.y})`);
        lines.push(`Type: ${tile.type}`);

        if (tile.zoneId) {
            const zone = this.tileMap.getZone(tile.zoneId);
            lines.push(`Zone: ${zone ? zone.name : tile.zoneId}`);
        }

        lines.push(`Visibility: ${tile.visibility}`);

        if (tile.terrain && tile.terrain !== 'DEFAULT') {
            lines.push(`Terrain: ${tile.terrain}`);
        }

        // Calculate box dimensions
        const boxWidth = 140;
        const boxHeight = lines.length * lineHeight + padding * 2;
        const boxX = padding;
        const boxY = this.camera.height - boxHeight - padding;

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        lines.forEach((line, i) => {
            ctx.fillText(line, boxX + padding, boxY + padding + i * lineHeight);
        });
    }

    /**
     * Render all units
     */
    _renderUnits() {
        const ctx = this.ctx;
        const ts = this.tileSize;

        for (const unit of this.units) {
            // 1. VISIBILITY CHECK (Fog of War & Planning)
            const gridPos = this.tileMap.worldToGrid(unit.worldPos.x, unit.worldPos.y);
            const tile = this.tileMap.getTile(gridPos.x, gridPos.y);

            const isCrew = unit.id.startsWith('crew') || unit.isFriendly;

            // In PLANNING, we act based on Intel (REVEALED vs HIDDEN)
            // In EXECUTING, we act based on Fog (REVEALED/VISIBLE vs HIDDEN)
            // Always show Crew
            if (!isCrew) {
                // If tile is hidden, hide the unit
                if (tile && tile.visibility === GridConfig.VISIBILITY.HIDDEN) {
                    continue;
                }
            }

            const screenPos = unit.getScreenPos(this.camera);

            // Skip if off-screen
            if (screenPos.x < -20 || screenPos.x > this.camera.width + 20 ||
                screenPos.y < -20 || screenPos.y > this.camera.height + 20) {
                continue;
            }

            const baseRadius = unit.radius || 12;
            const isHovered = unit.isHovered || false;
            const isSelected = window.selectedUnit === unit;

            // Scale up on hover
            const radius = isHovered ? baseRadius * 1.15 : baseRadius;

            // Draw waiting indicator (pulsing red ring)
            if (unit.state === 'WAITING') {
                const pulse = 1 + Math.sin(performance.now() / 200) * 0.2;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, radius * 1.5 * pulse, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.lineWidth = 1;
            }

            // Selection ring (green glow for selected unit)
            if (isSelected) {
                ctx.save();
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, radius + 6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();
            }

            // Hover glow
            if (isHovered && !isSelected) {
                ctx.save();
                ctx.shadowColor = unit.color || '#00ff88';
                ctx.shadowBlur = 10;
            }

            // Draw unit circle
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = unit.color || '#00ff88';
            ctx.fill();
            ctx.strokeStyle = isHovered ? '#ffffff' : (unit.state === 'WAITING' ? '#ff6666' : 'rgba(255,255,255,0.8)');
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.stroke();
            ctx.lineWidth = 1;

            if (isHovered && !isSelected) {
                ctx.restore();
            }

            // Draw direction indicator if moving
            if (unit.isMoving && unit.currentTarget) {
                const targetScreen = this.worldToScreen(
                    unit.currentTarget.x,
                    unit.currentTarget.y
                );
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

            // Draw unlock progress bar for UNLOCKING state
            if (unit.taskProcessor && unit.taskProcessor.state === 'UNLOCKING') {
                const progress = unit.taskProcessor.getUnlockProgress();
                const barWidth = ts * 0.8;
                const barHeight = 6;
                const barX = screenPos.x - barWidth / 2;
                const barY = screenPos.y - baseRadius - 12;

                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(barX, barY, barWidth, barHeight);

                // Progress fill (orange for unlocking)
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
        }
    }

    /**
     * Render all interactables
     */
    _renderInteractables() {
        const ctx = this.ctx;
        const ts = this.tileSize;

        for (const interactable of this.interactables) {
            // Check visibility - skip if in unrevealed area
            const tile = this.tileMap.getTile(interactable.gridX, interactable.gridY);
            if (tile && tile.visibility === GridConfig.VISIBILITY.HIDDEN) {
                continue; // Don't show interactables in fog
            }

            const worldPos = interactable.getWorldPos();
            const screenPos = this.worldToScreen(worldPos.x, worldPos.y);

            // Skip if off-screen
            if (screenPos.x < -ts || screenPos.x > this.camera.width + ts ||
                screenPos.y < -ts || screenPos.y > this.camera.height + ts) {
                continue;
            }

            // Determine color and icon based on type and state
            let color = interactable.color || '#ffcc00';
            let icon = '?';

            switch (interactable.type) {
                case 'SAFE':
                    icon = '$';
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
            }

            // Dim if completed
            if (interactable.state === 'COMPLETED') {
                color = '#666666';
            }

            // Check if hovered (synced from EntityLayer)
            const isHovered = interactable.isHovered || false;

            // Draw the interactable marker
            const size = isHovered ? ts * 0.7 : ts * 0.6; // Scale up on hover

            // Glow effect on hover
            if (isHovered) {
                ctx.save();
                ctx.shadowColor = color;
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }

            ctx.fillStyle = color;
            ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.7)';
            ctx.lineWidth = isHovered ? 3 : 2;

            ctx.beginPath();
            ctx.roundRect(screenPos.x - size / 2, screenPos.y - size / 2, size, size, 4);
            ctx.fill();
            ctx.stroke();
            ctx.lineWidth = 1;

            if (isHovered) {
                ctx.restore();
            }

            // Draw icon
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, screenPos.x, screenPos.y);

            // Draw progress bar if in progress
            if (interactable.state === 'IN_PROGRESS') {
                const barWidth = ts * 0.8;
                const barHeight = 6;
                const barX = screenPos.x - barWidth / 2;
                const barY = screenPos.y - size / 2 - 10;
                const progress = interactable.getProgressPercent();

                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(barX, barY, barWidth, barHeight);

                // Progress fill
                ctx.fillStyle = '#00ff88';
                ctx.fillRect(barX, barY, barWidth * progress, barHeight);

                // Border
                ctx.strokeStyle = '#ffffff';
                ctx.strokeRect(barX, barY, barWidth, barHeight);
            }

            // Draw label
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(interactable.label, screenPos.x, screenPos.y + size / 2 + 12);
        }
    }

    /**
     * Update all units (call with deltaTime)
     */
    updateUnits(deltaTime) {
        for (const unit of this.units) {
            unit.update(deltaTime);
        }
    }

    /**
     * Add a vision cone to render
     * @param {VisionCone} cone - The vision cone
     * @param {Object} config - Rendering config
     */
    addVisionCone(cone, config = {}) {
        this.visionCones.push({
            cone,
            color: config.color || 'rgba(255, 100, 100, 0.3)',
            alertColor: config.alertColor || 'rgba(255, 50, 50, 0.5)'
        });
    }

    /**
     * Remove a vision cone
     */
    removeVisionCone(cone) {
        this.visionCones = this.visionCones.filter(vc => vc.cone !== cone);
    }

    /**
     * Render all vision cones
     */
    /**
     * Render all vision cones
     */
    _renderVisionCones() {
        const ctx = this.ctx;

        // 1. PLANNING CHECK
        if (window.heistPhase === 'PLANNING') return;

        for (const { cone, color, alertColor } of this.visionCones) {
            // 2. FOG CHECK
            // We need to find the unit associated with this cone to check if they are hidden.
            // This is a bit tricky as cone doesn't explicitly link back to unit ID in this list, 
            // but we can check the cone's origin position against the map visibility.

            const originGrid = this.tileMap.worldToGrid(cone.x, cone.y);
            const tile = this.tileMap.getTile(originGrid.x, originGrid.y);

            // Only show cone if origin tile is fully VISIBLE (not hidden or just revealed)
            if (!tile || tile.visibility !== GridConfig.VISIBILITY.VISIBLE) {
                continue;
            }

            const vertices = cone.getConeVertices();
            if (vertices.length < 3) continue;

            // Convert to screen coordinates
            const screenVerts = vertices.map(v => this.worldToScreen(v.x, v.y));

            // Determine color based on detection state
            let hasDetection = false;
            for (const [targetId, value] of cone.detectionMeters) {
                if (value > 0.3) {
                    hasDetection = true;
                    break;
                }
            }

            // Draw filled cone
            ctx.beginPath();
            ctx.moveTo(screenVerts[0].x, screenVerts[0].y);
            for (let i = 1; i < screenVerts.length; i++) {
                ctx.lineTo(screenVerts[i].x, screenVerts[i].y);
            }
            ctx.closePath();

            ctx.fillStyle = hasDetection ? alertColor : color;
            ctx.fill();

            // Draw cone outline
            ctx.strokeStyle = hasDetection ? 'rgba(255, 50, 50, 0.8)' : 'rgba(255, 200, 200, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    /**
     * Start render loop with delta time
     */
    startRenderLoop() {
        const loop = (currentTime) => {
            const deltaTime = (currentTime - this.lastFrameTime) / 1000;
            this.lastFrameTime = currentTime;

            // Update fog animation time
            this.fogTime += deltaTime;

            this._updateCamera(deltaTime);
            // Unit updates removed - handled by main game loop in renderer.js
            this.render();

            // Render Planning Overlay if in Setup Phase
            if (window.heistPhase === 'PLANNING') {
                this._renderPlanningOverlay();
            }

            // Sync entity wrappers with their underlying objects
            this._syncEntityLayer();

            // Render EntityLayer overlay LAST (on top of everything)
            this.entityLayer.render(this.ctx, this.camera, this.tileSize);

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    /**
     * Sync EntityLayer wrappers with their underlying objects
     */
    _syncEntityLayer() {
        // Sync UnitEntity wrappers (with tileMap for fog of war check)
        for (const unit of this.units) {
            const entity = this.entityLayer.get(`unit_entity_${unit.id}`);
            if (entity && entity.sync) {
                entity.sync(this.tileMap);
            }
        }

        // Sync InteractableEntity wrappers
        for (const interactable of this.interactables) {
            const entity = this.entityLayer.get(`interactable_entity_${interactable.id}`);
            if (entity && entity.sync) {
                entity.sync(this.tileMap);
            }
        }
    }

    /**
     * Render the Setup Phase overlay (Blueprints, Icons)
     */
    _renderPlanningOverlay() {
        if (!window.sectorManager) return;
        const ctx = this.ctx;
        const ts = this.tileSize;

        // 1. Sync Sector Icons to EntityLayer
        const sectors = window.sectorManager.getAllSectors();
        for (const sector of sectors) {
            if (sector.state === 'HIDDEN') {
                // Render blueprint tiles
                this._renderSectorBlueprint(sector);

                // Create/update SectorIcon in EntityLayer
                const iconId = `sector_icon_${sector.id}`;
                let icon = this.entityLayer.get(iconId);

                if (!icon) {
                    // Calculate sector center
                    const zone = this.tileMap.getZone(sector.id);
                    if (zone && zone.tiles.length > 0) {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        for (const tileId of zone.tiles) {
                            const tile = this.tileMap.getTileById(tileId);
                            if (tile) {
                                minX = Math.min(minX, tile.x);
                                minY = Math.min(minY, tile.y);
                                maxX = Math.max(maxX, tile.x);
                                maxY = Math.max(maxY, tile.y);
                            }
                        }

                        const centerX = Math.floor((minX + maxX) / 2);
                        const centerY = Math.floor((minY + maxY) / 2);

                        icon = new SectorIcon({
                            sectorId: sector.id,
                            centerX: centerX,
                            centerY: centerY,
                            label: sector.id,
                            intelCost: sector.cost || 0
                        });
                        this.entityLayer.add(icon);
                    }
                }

                if (icon) icon.isVisible = true;
            } else {
                // Sector is revealed - hide its icon
                const iconId = `sector_icon_${sector.id}`;
                const icon = this.entityLayer.get(iconId);
                if (icon) icon.isVisible = false;
            }
        }

        // 2. Sync Asset Icons to EntityLayer
        const assets = window.arrangementEngine.available;
        for (const asset of assets) {
            // Only show if sector is revealed (or no sector req)
            if (asset.reqSector && !window.sectorManager.isSectorRevealed(asset.reqSector)) {
                // Hide if sector not revealed
                const iconId = `asset_icon_${asset.id}`;
                const existingIcon = this.entityLayer.get(iconId);
                if (existingIcon) existingIcon.isVisible = false;
                continue;
            }

            // Only show if it has a map location
            if (asset.payload && asset.payload.x !== undefined && asset.payload.y !== undefined) {
                const iconId = `asset_icon_${asset.id}`;
                let icon = this.entityLayer.get(iconId);

                if (!icon) {
                    // Determine icon type
                    let iconChar = '📦';
                    if (asset.id.includes('phone')) iconChar = '📞';
                    if (asset.id.includes('power')) iconChar = '⚡';
                    if (asset.id.includes('vault')) iconChar = '🔢';
                    if (asset.id.includes('bribe')) iconChar = '🤝';

                    icon = new AssetIcon({
                        assetId: asset.id,
                        gridX: asset.payload.x,
                        gridY: asset.payload.y,
                        icon: iconChar,
                        label: asset.name || asset.id,
                        cost: asset.cost
                    });
                    this.entityLayer.add(icon);
                }

                // Update state
                const canAfford = window.arrangementEngine.getCash() >= asset.cost;
                icon.updateFromAsset(asset, canAfford);
                icon.isVisible = true;
            }
        }
    }

    /**
     * Render a sector as a blueprint (outline + icon)
     */
    _renderSectorBlueprint(sector) {
        const ctx = this.ctx;
        const ts = this.tileSize;
        const zone = this.tileMap.getZone(sector.id);
        if (!zone) return;

        // Calculate bounding box for center icon
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasTiles = false;

        // Draw tile outlines - subtle blueprint style
        ctx.strokeStyle = 'rgba(0, 136, 255, 0.15)'; // Very faint blue outline
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(0, 136, 255, 0.05)'; // Nearly transparent blue fill

        for (const tileId of zone.tiles) {
            const tile = this.tileMap.getTileById(tileId);
            if (!tile) continue;

            hasTiles = true;
            const screen = this.worldToScreen(tile.x * ts, tile.y * ts);

            // Skip offscreen
            if (screen.x < -ts || screen.x > this.camera.width ||
                screen.y < -ts || screen.y > this.camera.height) {
                // We still process bounds for center text, or maybe optimize later
            }

            // Update bounds
            minX = Math.min(minX, tile.x * ts);
            minY = Math.min(minY, tile.y * ts);
            maxX = Math.max(maxX, tile.x * ts + ts);
            maxY = Math.max(maxY, tile.y * ts + ts);

            // Draw tile box (simple blueprint style)
            // Just drawing rects for now. Ideal would be merged outline.
            ctx.fillRect(screen.x, screen.y, ts, ts);
            ctx.strokeRect(screen.x, screen.y, ts, ts);
        }

        // Icon now rendered via EntityLayer (SectorIcon class)
    }

    /**
     * Helper to render a centered icon
     */
    _renderIconAt(x, y, icon, color, size) {
        const ctx = this.ctx;
        ctx.font = `${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        ctx.fillText(icon, x, y);
        ctx.shadowBlur = 0;
    }

    /**
     * Set viewport dimensions
     */
    setViewport(width, height) {
        this.camera.width = width;
        this.camera.height = height;
        this._resizeCanvas();
        this._clampCamera();
    }

    /**
     * Clear all entities for fresh map loading
     */
    clearAllEntities() {
        this.units = [];
        this.interactables = [];
        this.visionCones = [];
        this.entities = [];
        this.entityLayer.clear();
        console.log('[GridRenderer] Cleared all entities');
    }

    /**
     * Update the tile map reference
     */
    setTileMap(tileMap) {
        this.tileMap = tileMap;
        this._clampCamera();
    }

    /**
     * Pan to a specific grid position
     */
    panTo(gridX, gridY) {
        const world = this.tileMap.gridToWorld(gridX, gridY);
        this.camera.x = world.x - this.camera.width / 2;
        this.camera.y = world.y - this.camera.height / 2;
        this._clampCamera();
    }
}

