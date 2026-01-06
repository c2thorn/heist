/**
 * GoalDiscoveryService - Discovers available objectives for the Goal Queue
 * Returns structured objectives grouped by type (ACTION, HOLD, LOOT, ESCAPE)
 */

// Trigger constants
export const Triggers = {
    SIGNAL_EXFIL: 'SIGNAL_EXFIL',     // Primary loot secured
    SIGNAL_SCRAM: 'SIGNAL_SCRAM',     // Emergency abort
    TIMER_COMPLETE: 'TIMER_COMPLETE', // Mission timer filled
};

// Objective role types
export const HoldRoles = {
    LOOKOUT: 'LOOKOUT',
    GUARD: 'GUARD',
    WAIT: 'WAIT'
};

export class GoalDiscoveryService {

    /**
     * Get top-level objective categories for the menu
     * Simplified: User picks category first, then details
     */
    static getObjectiveCategories() {
        return [
            { id: 'interact', label: '⚡ Interact', type: 'ACTION' },
            { id: 'lookout', label: '👁️ Lookout', type: 'HOLD', role: HoldRoles.LOOKOUT },
            { id: 'escape', label: '🚪 Escape', type: 'ESCAPE' }
        ];
    }

    /**
     * Get available targets for a specific category
     */
    static getTargetsForCategory(category) {
        switch (category) {
            case 'interact':
                return this.getInteractableTargets(); // All interactables (panels, safes, terminals)
            case 'lookout':
                return this.getZoneTargets();
            case 'escape':
                return this.getExitTargets();
        }
        return [];
    }

    /**
     * Get interactable targets (terminals, panels, etc.)
     */
    static getInteractableTargets() {
        const targets = [];
        if (!window.gridRenderer) return targets;

        const interactables = window.gridRenderer.interactables || [];
        interactables.forEach(item => {
            // Check if position is in a revealed sector
            const isVisible = this.isPositionRevealed(item.gridX, item.gridY);
            if (isVisible) {
                targets.push({
                    id: item.id,
                    label: item.label || item.type,
                    verb: this.getVerbForType(item.type),
                    icon: this.getIconForType(item.type)
                });
            }
        });

        return targets;
    }

    /**
     * Get zone targets for HOLD/lookout
     */
    static getZoneTargets() {
        const targets = [];
        if (!window.sectorManager) return targets;

        const sectors = window.sectorManager.getRevealedSectors();
        sectors.forEach(sector => {
            targets.push({
                id: sector.id,
                label: sector.name,
                icon: '📍'
            });
        });

        return targets;
    }

    /**
     * Get loot targets (safes, vaults)
     */
    static getLootTargets() {
        const targets = [];
        if (!window.gridRenderer) return targets;

        const interactables = window.gridRenderer.interactables || [];
        interactables
            .filter(item => item.type === 'SAFE' || item.type === 'VAULT')
            .forEach(item => {
                const isVisible = this.isPositionRevealed(item.gridX, item.gridY);
                if (isVisible) {
                    targets.push({
                        id: item.id,
                        label: item.label || item.type,
                        priority: item.type === 'VAULT' ? 'PRIMARY' : 'SECONDARY',
                        icon: '💰'
                    });
                }
            });

        return targets;
    }

    /**
     * Get escape/exit targets
     */
    static getExitTargets() {
        const targets = [];

        // Check for extractionPoints (new system)
        if (window.extractionPoints && window.extractionPoints.length > 0) {
            window.extractionPoints.forEach(exit => {
                targets.push({
                    id: exit.id,
                    label: exit.name || 'Exit',
                    icon: '🚪'
                });
            });
        }

        // Fallback: use radioController exit
        if (targets.length === 0 && window.radioController) {
            const exitTile = window.radioController.exitTile;
            if (exitTile) {
                targets.push({
                    id: 'main_exit',
                    label: 'Main Exit',
                    icon: '🚪'
                });
            }
        }

        return targets;
    }

    /**
     * Check if a grid position is in a revealed sector
     */
    static isPositionRevealed(gridX, gridY) {
        if (!window.tileMap || !window.sectorManager) return true; // Default visible

        const tile = window.tileMap.getTile(gridX, gridY);
        if (!tile || !tile.zoneId) return true; // No zone = visible

        return window.sectorManager.isSectorRevealed(tile.zoneId);
    }

    /**
     * Get action verb based on interactable type
     */
    static getVerbForType(type) {
        const verbs = {
            'PANEL': 'Disable',
            'COMPUTER': 'Hack',
            'DOOR': 'Unlock',
            'SAFE': 'Crack',
            'VAULT': 'Open'
        };
        return verbs[type] || 'Interact';
    }

    /**
     * Get icon based on interactable type
     */
    static getIconForType(type) {
        const icons = {
            'PANEL': '⚡',
            'COMPUTER': '💻',
            'DOOR': '🔓',
            'SAFE': '🔐',
            'VAULT': '🏦'
        };
        return icons[type] || '⚡';
    }

    /**
     * Get available triggers for the UI dropdown
     */
    static getAvailableTriggers() {
        return [
            { id: null, label: 'None' },
            { id: Triggers.SIGNAL_EXFIL, label: 'Primary Loot Secured' },
            { id: Triggers.TIMER_COMPLETE, label: 'Mission Timer Fills' }
        ];
    }
}
