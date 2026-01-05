/**
 * EntityLayer - Manages map entities by render layer
 * Provides unified hit-testing across all entities
 */
export class EntityLayer {
    constructor() {
        // Render order: ground → entity → overlay (overlay on top)
        this.layers = {
            ground: [],    // Vision cones, zone highlights
            entity: [],    // Units, interactables
            overlay: []    // Icons, labels, UI markers
        };

        this.hoveredEntity = null;
        this.selectedEntity = null;
    }

    /**
     * Add an entity to its designated layer
     */
    add(entity) {
        const layer = this.layers[entity.layer];
        if (layer && !layer.includes(entity)) {
            layer.push(entity);
        }
    }

    /**
     * Remove an entity by ID
     */
    remove(entityId) {
        for (const layerName in this.layers) {
            const layer = this.layers[layerName];
            const idx = layer.findIndex(e => e.id === entityId);
            if (idx >= 0) {
                layer.splice(idx, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * Get an entity by ID
     */
    get(entityId) {
        for (const layerName in this.layers) {
            const entity = this.layers[layerName].find(e => e.id === entityId);
            if (entity) return entity;
        }
        return null;
    }

    /**
     * Get all entities in a layer
     */
    getLayer(layerName) {
        return this.layers[layerName] || [];
    }

    /**
     * Get all entities across all layers
     */
    getAll() {
        return [
            ...this.layers.ground,
            ...this.layers.entity,
            ...this.layers.overlay
        ];
    }

    /**
     * Clear all entities
     */
    clear() {
        this.layers.ground = [];
        this.layers.entity = [];
        this.layers.overlay = [];
        this.hoveredEntity = null;
        this.selectedEntity = null;
    }

    /**
     * Update hover state based on mouse position
     * Tests from top layer (overlay) down to bottom (ground)
     * @returns {MapEntity|null} The hovered entity
     */
    updateHover(screenX, screenY, camera) {
        // Clear previous hover state
        if (this.hoveredEntity) {
            this.hoveredEntity.isHovered = false;
        }
        this.hoveredEntity = null;

        // Check layers top-to-bottom (overlay first)
        const layerOrder = ['overlay', 'entity', 'ground'];

        for (const layerName of layerOrder) {
            // Check in reverse order (last added = on top)
            const layer = [...this.layers[layerName]].reverse();

            for (const entity of layer) {
                if (entity.isVisible && entity.hitTest(screenX, screenY, camera)) {
                    entity.isHovered = true;
                    this.hoveredEntity = entity;
                    return entity;
                }
            }
        }

        return null;
    }

    /**
     * Handle click - returns clicked entity
     */
    handleClick(screenX, screenY, camera) {
        const entity = this.updateHover(screenX, screenY, camera);
        if (entity) {
            entity.onClick();
            return entity;
        }
        return null;
    }

    /**
     * Render all visible entities in layer order
     */
    render(ctx, camera, tileSize = 24, visibilityCheck = null) {
        const layerOrder = ['ground', 'entity', 'overlay'];

        for (const layerName of layerOrder) {
            for (const entity of this.layers[layerName]) {
                // Skip if not visible or off-screen
                if (!entity.isVisible) continue;
                if (!entity.isOnScreen(camera)) continue;

                // Optional visibility check (fog of war)
                if (visibilityCheck && !visibilityCheck(entity)) continue;

                entity.render(ctx, camera, tileSize);
            }
        }
    }
}
