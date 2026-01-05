/**
 * ArrangementEngine - Manages pre-heist asset purchases and effects
 * Per SPEC_005 Section 3 - The Arrangements System
 */

/**
 * Arrangement types per SPEC_005 §3.1
 */
export const ArrangementType = {
    STATIC_MODIFIER: 'STATIC_MODIFIER',     // Immediate effect (remove guard, unlock door)
    TRIGGERED_ABILITY: 'TRIGGERED_ABILITY', // Button during heist (distraction)
    PLACED_ITEM: 'PLACED_ITEM'              // Place on map (entry point, equipment)
};

/**
 * ArrangementEngine class - manages arrangements for the current heist
 */
import GameManager from '../GameManager.js';

export class ArrangementEngine {
    constructor() {
        if (ArrangementEngine.instance) return ArrangementEngine.instance;
        ArrangementEngine.instance = this;

        // Remove local cash
        // this.cashAvailable = 1000; (Deleted)

        this.activeArrangements = [];
        this.available = [];    // Arrangements available for purchase
        this.purchased = []; // List of purchased arrangement instances
    }

    /**
     * Define an available arrangement
     * @param {Object} arrangement - Arrangement definition per SPEC_005
     */
    defineArrangement(arrangement) {
        const arr = {
            id: arrangement.id,
            name: arrangement.name,
            type: arrangement.type || ArrangementType.STATIC_MODIFIER,
            cost: arrangement.cost || 100,
            reqSector: arrangement.reqSector || null,  // Must reveal sector first
            description: arrangement.description || '',
            uses: arrangement.uses || 1,     // For triggered abilities
            usesRemaining: arrangement.uses || 1,
            payload: arrangement.payload || {},
            purchased: false
        };

        this.available.push(arr);
        console.log(`[ArrangementEngine] Defined: ${arr.name} ($${arr.cost})`);
    }

    /**
     * Get arrangements available for purchase
     * @param {SectorManager} sectorManager - For checking sector requirements
     * @returns {Object[]} Purchasable arrangements
     */
    getAvailable(sectorManager = null) {
        return this.available.filter(arr => {
            if (arr.purchased) return false;
            if (arr.reqSector && sectorManager && !sectorManager.isSectorRevealed(arr.reqSector)) {
                return false;
            }
            return true;
        });
    }

    /**
     * Purchase an arrangement
     * @param {string} arrangementId - ID of arrangement to purchase
     * @returns {boolean} True if purchase succeeded
     */
    purchase(arrangementId) {
        const arr = this.available.find(a => a.id === arrangementId);

        if (!arr) {
            console.warn(`[ArrangementEngine] Unknown arrangement: ${arrangementId}`);
            return false;
        }

        if (arr.purchased) {
            console.warn(`[ArrangementEngine] Already purchased: ${arrangementId}`);
            return false;
        }

        // Use GameManager to spend
        if (GameManager.spendCash(arr.cost)) {
            arr.purchased = true;
            this.purchased.push(arr);

            console.log(`[ArrangementEngine] Purchased: ${arr.name} ($${GameManager.gameState.meta.cash} remaining)`);

            // Apply immediate effect for STATIC_MODIFIER
            if (arr.type === ArrangementType.STATIC_MODIFIER) {
                this._applyStaticModifier(arr);
            }

            // Dispatch event for UI
            window.dispatchEvent(new CustomEvent('arrangementPurchased', {
                detail: { arrangement: arr }
            }));

            return true;
        }
        return false;
    }

    /**
     * Apply a static modifier immediately
     */
    _applyStaticModifier(arr) {
        const payload = arr.payload;

        switch (payload.effect) {
            case 'REMOVE_GUARD':
                console.log(`[ArrangementEngine] Effect: Remove guard ${payload.targetId}`);
                // Would remove guard from map - deferred until guard system exists
                break;
            case 'UNLOCK_DOOR':
                console.log(`[ArrangementEngine] Effect: Unlock door at (${payload.x}, ${payload.y})`);
                // Would unlock door - integrates with TileMap
                break;
            case 'DISABLE_CAMERA':
                console.log(`[ArrangementEngine] Effect: Disable camera ${payload.targetId}`);
                break;
            default:
                console.log(`[ArrangementEngine] Static effect: ${payload.effect || 'custom'}`);
        }
    }

    /**
     * Trigger a purchased ability (during heist)
     * @param {string} arrangementId - ID of arrangement to trigger
     * @returns {boolean} True if triggered successfully
     */
    trigger(arrangementId) {
        const arr = this.purchased.find(a => a.id === arrangementId);

        if (!arr) {
            console.warn(`[ArrangementEngine] Not purchased: ${arrangementId}`);
            return false;
        }

        if (arr.type !== ArrangementType.TRIGGERED_ABILITY) {
            console.warn(`[ArrangementEngine] Not a triggered ability: ${arrangementId}`);
            return false;
        }

        if (arr.usesRemaining <= 0) {
            console.warn(`[ArrangementEngine] No uses remaining: ${arrangementId}`);
            return false;
        }

        arr.usesRemaining--;
        console.log(`[ArrangementEngine] Triggered: ${arr.name} (${arr.usesRemaining} uses left)`);

        // Execute the payload effect
        this._executeTrigger(arr);

        // Dispatch event
        window.dispatchEvent(new CustomEvent('arrangementTriggered', {
            detail: { arrangement: arr }
        }));

        return true;
    }

    /**
     * Execute a triggered ability
     */
    /**
     * Execute a triggered ability
     * Uses modular event system (Stimulus & Response)
     */
    _executeTrigger(arr) {
        const payload = arr.payload;

        switch (payload.effect) {
            case 'PHONE_DISTRACTION':
                console.log(`[ArrangementEngine] 📞 Phone ringing at (${payload.x}, ${payload.y})!`);

                // Generic Audio Stimulus
                window.dispatchEvent(new CustomEvent('gameStimulus', {
                    detail: {
                        type: 'AUDIO',
                        origin: { x: payload.x, y: payload.y },
                        radius: 12,     // How far the sound travels
                        priority: 10,   // Priority over patrol
                        sourceId: 'phone_distraction'
                    }
                }));
                break;

            case 'POWER_CUT':
                console.log(`[ArrangementEngine] ⚡ Power cut! Cameras disabled for ${payload.duration}s`);

                // Generic Global Effect
                window.dispatchEvent(new CustomEvent('globalEffectStart', {
                    detail: {
                        type: 'VISION_DAMPENING',
                        value: 0.0, // Vision reduced to 0 (or blindness layer)
                        duration: payload.duration
                    }
                }));

                // Auto-end effect after duration (handled here or by a GameState manager)
                // For simplicity, we dispatch the end event after timeout here
                setTimeout(() => {
                    console.log(`[ArrangementEngine] ⚡ Power restored.`);
                    window.dispatchEvent(new CustomEvent('globalEffectEnd', {
                        detail: { type: 'VISION_DAMPENING' }
                    }));
                }, payload.duration * 1000);
                break;

            case 'GETAWAY_CAR':
                console.log(`[ArrangementEngine] 🚗 Getaway car arrived at extraction!`);
                // Could be a game state change event
                break;

            default:
                console.log(`[ArrangementEngine] Trigger effect: ${payload.effect || 'custom'}`);
        }
    }

    /**
     * Get purchased triggered abilities (for Radio UI)
     * @returns {Object[]} Active triggered abilities with uses remaining
     */
    getActiveAbilities() {
        return this.purchased.filter(arr =>
            arr.type === ArrangementType.TRIGGERED_ABILITY &&
            arr.usesRemaining > 0
        );
    }

    /**
     * Check if an arrangement has been purchased
     * @param {string} arrangementId - ID of arrangement to check
     * @returns {boolean} True if purchased
     */
    hasPurchased(arrangementId) {
        return this.purchased.some(a => a.id === arrangementId);
    }

    /**
     * Set available cash
     * @param {number} cash - Cash available
     */
    setCash(cash) {
        this.cashAvailable = cash;
    }

    /**
     * Get current cash available
     */
    getCash() {
        if (GameManager && GameManager.gameState) {
            return GameManager.gameState.meta.cash;
        }
        return 0;
    }

    /**
     * Reset for new heist
     */
    reset() {
        this.purchased = [];
        for (const arr of this.available) {
            arr.purchased = false;
            arr.usesRemaining = arr.uses;
        }
        console.log('[ArrangementEngine] Reset');
    }

    /**
     * Load sample arrangements for testing
     */
    loadSampleArrangements() {
        this.defineArrangement({
            id: 'phone_distraction',
            name: 'Phone Distraction',
            type: ArrangementType.TRIGGERED_ABILITY,
            cost: 200,
            uses: 2,
            description: 'Ring a phone to distract nearby guards',
            payload: { effect: 'PHONE_DISTRACTION', x: 19, y: 9 }  // Moved away from guard
        });

        this.defineArrangement({
            id: 'power_cut',
            name: 'Power Cut',
            type: ArrangementType.TRIGGERED_ABILITY,
            cost: 500,
            uses: 1,
            description: 'Disable cameras for 30 seconds',
            payload: { effect: 'POWER_CUT', duration: 30 }
        });

        this.defineArrangement({
            id: 'bribe_guard',
            name: 'Bribe Lobby Guard',
            type: ArrangementType.STATIC_MODIFIER,
            cost: 300,
            reqSector: 'lobby',
            description: 'The lobby guard looks the other way',
            payload: { effect: 'REMOVE_GUARD', targetId: 'guard_lobby' }
        });

        this.defineArrangement({
            id: 'vault_codes',
            name: 'Vault Access Codes',
            type: ArrangementType.STATIC_MODIFIER,
            cost: 400,
            reqSector: 'vault',
            description: 'Quick unlock vault door (1.5s vs 10s)',
            payload: { effect: 'VAULT_BYPASS', x: 24, y: 21 }  // Icon position (not door position)
        });
    }
}

// Export singleton
export const arrangementEngine = new ArrangementEngine();
