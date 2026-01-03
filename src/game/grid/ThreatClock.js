/**
 * ThreatClock - Global timer managing threat escalation
 * Per SPEC_004 Section 2 - The Timeline (Global Clock)
 */

/**
 * Threat zones that escalate as time passes
 */
export const ThreatZone = {
    CASUAL: 0,      // 0-60s: Guards walk, 60° FOV, 1.0x detection
    ALERT: 1,       // 60-120s: Guards walk fast, 90° FOV, 1.5x detection
    LOCKDOWN: 2,    // 120-180s: Guards run, 120° FOV, 2.0x detection
    SWAT: 3         // 180s+: Infinite waves, chaos
};

/**
 * Zone thresholds in seconds
 */
const ZONE_THRESHOLDS = {
    [ThreatZone.CASUAL]: 0,
    [ThreatZone.ALERT]: 60,
    [ThreatZone.LOCKDOWN]: 120,
    [ThreatZone.SWAT]: 180
};

/**
 * Zone modifiers for guards - per SPEC_004 §2.2
 */
const ZONE_MODIFIERS = {
    [ThreatZone.CASUAL]: {
        guardSpeed: 'WALK',
        fov: 60,
        detectionRate: 1.0,
        ambience: 'calm'
    },
    [ThreatZone.ALERT]: {
        guardSpeed: 'WALK',  // Walk fast simulated by higher speed multiplier
        fov: 90,
        detectionRate: 1.5,
        ambience: 'tense'
    },
    [ThreatZone.LOCKDOWN]: {
        guardSpeed: 'RUN',
        fov: 120,
        detectionRate: 2.0,
        ambience: 'alarm'
    },
    [ThreatZone.SWAT]: {
        guardSpeed: 'RUN',
        fov: 120,
        detectionRate: 2.5,
        ambience: 'chaos'
    }
};

/**
 * ThreatClock class - manages global heist timer and threat escalation
 */
export class ThreatClock {
    constructor() {
        this.elapsedTime = 0;           // Seconds since heist start
        this.zone = ThreatZone.CASUAL;  // Current threat zone
        this.isPaused = false;          // Pause during cutscenes, etc.
        this.listeners = [];            // Zone change callbacks
    }

    /**
     * Update the clock each frame
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        if (this.isPaused) return;

        this.elapsedTime += deltaTime;
        this._checkZoneTransition();
    }

    /**
     * Check if we should transition to a new zone
     */
    _checkZoneTransition() {
        const previousZone = this.zone;

        // Find the highest zone we've reached
        if (this.elapsedTime >= ZONE_THRESHOLDS[ThreatZone.SWAT]) {
            this.zone = ThreatZone.SWAT;
        } else if (this.elapsedTime >= ZONE_THRESHOLDS[ThreatZone.LOCKDOWN]) {
            this.zone = ThreatZone.LOCKDOWN;
        } else if (this.elapsedTime >= ZONE_THRESHOLDS[ThreatZone.ALERT]) {
            this.zone = ThreatZone.ALERT;
        } else {
            this.zone = ThreatZone.CASUAL;
        }

        // Notify listeners if zone changed
        if (this.zone !== previousZone) {
            console.log(`[ThreatClock] Zone escalated: ${this._getZoneName(previousZone)} → ${this._getZoneName(this.zone)}`);
            this._notifyListeners(this.zone, previousZone);
        }
    }

    /**
     * Get current zone modifiers for guards
     * @returns {Object} Modifiers object with fov, detectionRate, guardSpeed
     */
    getModifiers() {
        return { ...ZONE_MODIFIERS[this.zone] };
    }

    /**
     * Get zone name string for logging
     */
    _getZoneName(zone) {
        return Object.keys(ThreatZone).find(key => ThreatZone[key] === zone) || 'UNKNOWN';
    }

    /**
     * Get current zone name
     */
    getZoneName() {
        return this._getZoneName(this.zone);
    }

    /**
     * Get progress through current zone (0-1)
     */
    getZoneProgress() {
        const thresholds = Object.values(ZONE_THRESHOLDS);
        const currentThreshold = thresholds[this.zone];
        const nextThreshold = thresholds[this.zone + 1] || (currentThreshold + 60);

        const progress = (this.elapsedTime - currentThreshold) / (nextThreshold - currentThreshold);
        return Math.min(1, Math.max(0, progress));
    }

    /**
     * Get overall heist progress (0-1, maxes at SWAT)
     */
    getOverallProgress() {
        const maxTime = ZONE_THRESHOLDS[ThreatZone.SWAT];
        return Math.min(1, this.elapsedTime / maxTime);
    }

    /**
     * Add a listener for zone changes
     * @param {Function} callback - Called with (newZone, oldZone)
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
     * Notify all listeners of zone change
     */
    _notifyListeners(newZone, oldZone) {
        this.listeners.forEach(cb => cb(newZone, oldZone));
    }

    /**
     * Add virtual time (penalty from fumbles, etc.)
     * @param {number} seconds - Seconds to add
     */
    addPenalty(seconds) {
        this.elapsedTime += seconds;
        console.log(`[ThreatClock] Time penalty: +${seconds}s (Total: ${this.elapsedTime.toFixed(1)}s)`);
        this._checkZoneTransition();
    }

    /**
     * Subtract time (bonus from critical success)
     * @param {number} seconds - Seconds to subtract
     */
    addBonus(seconds) {
        this.elapsedTime = Math.max(0, this.elapsedTime - seconds);
        console.log(`[ThreatClock] Time bonus: -${seconds}s (Total: ${this.elapsedTime.toFixed(1)}s)`);
        // Note: we don't de-escalate zones
    }

    /**
     * Pause the clock
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * Resume the clock
     */
    resume() {
        this.isPaused = false;
    }

    /**
     * Reset for new heist
     */
    reset() {
        this.elapsedTime = 0;
        this.zone = ThreatZone.CASUAL;
        this.isPaused = false;
        console.log('[ThreatClock] Reset');
    }

    /**
     * Get formatted time string (MM:SS)
     */
    getFormattedTime() {
        const mins = Math.floor(this.elapsedTime / 60);
        const secs = Math.floor(this.elapsedTime % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Export singleton instance
export const threatClock = new ThreatClock();
