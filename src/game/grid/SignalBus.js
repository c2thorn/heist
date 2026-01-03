/**
 * SignalBus - Global signal registry for task dependencies
 * Per SPEC_003 Section 4 - The Dependency System (Logic Gates)
 */

/**
 * SignalBus class - manages signals for task synchronization
 * Singleton pattern for global access
 */
class SignalBus {
    constructor() {
        this.signals = new Map();  // signalId -> timestamp
        this.listeners = new Map(); // signalId -> Set of callbacks
    }

    /**
     * Emit a signal
     * @param {string} signalId - Unique signal identifier
     */
    emit(signalId) {
        this.signals.set(signalId, Date.now());
        console.log(`[SignalBus] Signal emitted: "${signalId}"`);

        // Notify any listeners
        const callbacks = this.listeners.get(signalId);
        if (callbacks) {
            callbacks.forEach(cb => cb(signalId));
        }
    }

    /**
     * Check if a signal has been emitted
     * @param {string} signalId - Signal to check
     * @returns {boolean} True if signal is active
     */
    check(signalId) {
        return this.signals.has(signalId);
    }

    /**
     * Get timestamp when signal was emitted
     * @param {string} signalId - Signal to check
     * @returns {number|null} Timestamp or null if not emitted
     */
    getTimestamp(signalId) {
        return this.signals.get(signalId) || null;
    }

    /**
     * Clear a specific signal
     * @param {string} signalId - Signal to clear
     */
    clear(signalId) {
        this.signals.delete(signalId);
    }

    /**
     * Reset all signals (e.g., at start of new heist)
     */
    reset() {
        this.signals.clear();
        console.log('[SignalBus] All signals cleared');
    }

    /**
     * Add a listener for a specific signal
     * @param {string} signalId - Signal to listen for
     * @param {Function} callback - Called when signal is emitted
     */
    addListener(signalId, callback) {
        if (!this.listeners.has(signalId)) {
            this.listeners.set(signalId, new Set());
        }
        this.listeners.get(signalId).add(callback);
    }

    /**
     * Remove a listener
     * @param {string} signalId - Signal to stop listening for
     * @param {Function} callback - Callback to remove
     */
    removeListener(signalId, callback) {
        const callbacks = this.listeners.get(signalId);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    /**
     * Get list of all active signals (for debugging)
     */
    getActiveSignals() {
        return Array.from(this.signals.keys());
    }
}

// Export singleton instance
export const signalBus = new SignalBus();

// Also export class for testing purposes
export { SignalBus };
