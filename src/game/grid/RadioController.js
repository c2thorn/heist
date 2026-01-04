/**
 * RadioController - Global stance manager for crew commands
 * Per SPEC_004 Section 4 - The Radio (Player Agency)
 */

import { Task, TaskType } from './Task.js';

/**
 * Radio stances that affect all crew behavior
 */
export const RadioStance = {
    SILENT_RUNNING: 'SILENT_RUNNING',   // Sneak, avoid cones, hide on sight
    GO_LOUD: 'GO_LOUD',                 // Run, shortest path, engage on sight
    SCRAM: 'SCRAM'                      // Abort - clear queues, flee to exit
};

/**
 * Stance configurations
 */
const STANCE_CONFIG = {
    [RadioStance.SILENT_RUNNING]: {
        movementStance: 'SNEAK',
        avoidVisionCones: true,
        sop: 'COWARD'       // Hide on sight
    },
    [RadioStance.GO_LOUD]: {
        movementStance: 'RUN',
        avoidVisionCones: false,
        sop: 'ENGAGE'       // Takedown on sight
    },
    [RadioStance.SCRAM]: {
        movementStance: 'RUN',
        avoidVisionCones: false,
        sop: 'FLEE'         // Run to exit
    }
};

/**
 * RadioController class - manages global crew stance
 */
export class RadioController {
    constructor() {
        this.stance = RadioStance.SILENT_RUNNING;
        this.units = [];            // Reference to crew units
        this.exitTile = null;       // Extraction point for SCRAM
        this.listeners = [];        // Stance change callbacks
    }

    /**
     * Register units to be controlled by radio
     * @param {Unit[]} units - Array of crew units
     */
    registerUnits(units) {
        this.units = units;
    }

    /**
     * Set the extraction point for SCRAM command
     * @param {{x: number, y: number}} tile - Exit tile position
     */
    setExitTile(tile) {
        this.exitTile = tile;
    }

    /**
     * Get current stance configuration
     */
    getConfig() {
        return { ...STANCE_CONFIG[this.stance] };
    }

    /**
     * Change global stance
     * @param {string} newStance - RadioStance value
     */
    setStance(newStance) {
        if (!RadioStance[newStance] && !Object.values(RadioStance).includes(newStance)) {
            console.warn(`[RadioController] Unknown stance: ${newStance}`);
            return;
        }

        const previousStance = this.stance;
        this.stance = newStance;

        console.log(`[RadioController] Stance changed: ${previousStance} → ${newStance}`);

        // Apply to all units
        this._applyStanceToUnits();

        // Handle SCRAM specially
        if (newStance === RadioStance.SCRAM) {
            this._executeScram();
        }

        // Notify listeners
        this._notifyListeners(newStance, previousStance);
    }

    /**
     * Apply current stance to all registered units
     */
    _applyStanceToUnits() {
        const config = this.getConfig();

        for (const unit of this.units) {
            // Set movement stance
            unit.stance = config.movementStance;

            // Store SOP for detection handling
            unit.currentSOP = config.sop;

            console.log(`[RadioController] ${unit.id}: stance=${config.movementStance}, sop=${config.sop}`);
        }
    }

    /**
     * Execute SCRAM command - abort mission, flee to exit
     */
    _executeScram() {
        if (!this.exitTile) {
            console.warn('[RadioController] SCRAM called but no exit tile set!');
            return;
        }

        console.log('[RadioController] SCRAM! All units fleeing to exit:', this.exitTile);

        for (const unit of this.units) {
            // Clear all pending tasks
            unit.taskController.abort();

            // Add high-priority move to exit
            const exitTask = Task.move(this.exitTile.x, this.exitTile.y);
            unit.assignTask(exitTask);
        }
    }

    /**
     * Convenience methods for stance changes
     */
    silentRunning() {
        this.setStance(RadioStance.SILENT_RUNNING);
    }

    goLoud() {
        this.setStance(RadioStance.GO_LOUD);
    }

    scram() {
        this.setStance(RadioStance.SCRAM);
    }

    /**
     * Add a listener for stance changes
     * @param {Function} callback - Called with (newStance, oldStance)
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Remove a listener
     */
    removeListener(callback) {
        const idx = this.listeners.indexOf(callback);
        if (idx >= 0) this.listeners.splice(idx, 1);
    }

    /**
     * Notify all listeners of stance change
     */
    _notifyListeners(newStance, oldStance) {
        this.listeners.forEach(cb => cb(newStance, oldStance));
    }

    /**
     * Reset for new heist
     */
    reset() {
        this.stance = RadioStance.SILENT_RUNNING;
        this._applyStanceToUnits();
        console.log('[RadioController] Reset to SILENT_RUNNING');
    }
    /**
     * Render quick-trigger buttons for purchased abilities
     * @param {string} containerId - DOM ID of the container
     */
    renderAbilities(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        // Get active abilities from ArrangementEngine
        // We need to import arrangementEngine or pass it in. 
        // Ideally we import it at the top, but circular deps might be an issue?
        // Let's assume global access or dynamic import if needed.
        // Actually, arrangementEngine is a singleton export from existing file.
        // We will assume window.arrangementEngine or import it.
        const engine = window.arrangementEngine;
        if (!engine) return;

        const abilities = engine.getActiveAbilities();

        if (abilities.length === 0) {
            // Optional: Show placeholder or nothing
            return;
        }

        abilities.forEach(ability => {
            const btn = this._createAbilityButton(ability, engine);
            container.appendChild(btn);
        });
    }

    _createAbilityButton(ability, engine) {
        const btn = document.createElement('button');
        btn.className = 'ability-btn';

        // Icon (map based on ID/Type)
        let icon = '⚡';
        if (ability.id.includes('phone')) icon = '📞';
        if (ability.id.includes('bribe')) icon = '🤝';

        btn.innerHTML = `
            <span class="ability-icon">${icon}</span>
            <span class="ability-name">${ability.name}</span>
            <span class="ability-uses">${ability.usesRemaining}</span>
        `;

        btn.onclick = () => {
            if (engine.trigger(ability.id)) {
                // Update UI
                const usesSpan = btn.querySelector('.ability-uses');
                if (usesSpan) usesSpan.innerText = ability.usesRemaining;

                if (ability.usesRemaining <= 0) {
                    btn.disabled = true;
                    btn.classList.add('exhausted');
                }

                // Flash effect
                btn.classList.add('triggered');
                setTimeout(() => btn.classList.remove('triggered'), 200);
            }
        };

        return btn;
    }
}

// Export singleton instance
export const radioController = new RadioController();
