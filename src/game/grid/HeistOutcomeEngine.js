import { LootBag } from './LootBag.js';
import { threatClock } from './ThreatClock.js';
import GameManager from '../GameManager.js';

/**
 * HeistOutcomeEngine - Tracks heist progress and determines final outcome
 * 
 * Outcome Tiers:
 * - Perfect Score: Score + all crew + no alarms
 * - Clean Sweep: Score + all crew
 * - Professional: Score + some crew escaped
 * - Salvage: No Score, some loot
 * - Bust: No loot, crew escaped
 * - Disaster: All crew captured
 */
export class HeistOutcomeEngine {
    constructor() {
        // Score tracking
        this.score = null;              // The primary Score config
        this.sideScores = [];           // Array of side score configs
        this.scoreCollected = false;    // Has THE Score been picked up?

        // Extraction
        this.extractionPoints = [];     // Array of ExtractionPoint entities

        // Loot tracking
        this.allLoot = [];              // All LootBag instances created
        this.extractedLoot = [];        // Loot successfully carried out

        // Crew tracking
        this.totalCrew = 0;             // Starting crew count
        this.escapedCrew = [];          // Units that extracted
        this.capturedCrew = [];         // Units that were captured

        // Alarm/Heat
        this.alarmsTriggered = 0;
        this.heistHeat = 0;             // Heat generated this heist

        // State
        this.isComplete = false;
        this.outcome = null;            // Set when heist ends
    }

    /**
     * Initialize with building data
     * @param {Object} scoreData - Score config from building JSON
     * @param {Array} sideScoreData - Side scores from building JSON
     * @param {Array} extractionPoints - ExtractionPoint entities
     * @param {number} crewCount - Number of crew on this heist
     */
    initialize(scoreData, sideScoreData, extractionPoints, crewCount) {
        this.score = scoreData;
        this.sideScores = sideScoreData || [];
        this.extractionPoints = extractionPoints || [];
        this.totalCrew = crewCount;

        // Reset heist heat tracking
        this.heistHeat = 0;
        this.alarmsTriggered = 0;
        this._lastZone = 0;

        // Subscribe to ThreatClock zone escalations
        this._zoneListener = (newZone, oldZone) => {
            const zoneHeat = 5; // Heat per zone crossed
            this.heistHeat += zoneHeat;
            GameManager.gameState.resources.heat += zoneHeat;
            console.log(`[HeistOutcome] Zone escalation! +${zoneHeat} heat (Total heist: ${this.heistHeat})`);
            window.dispatchEvent(new CustomEvent('heatChanged'));
        };
        threatClock.addListener(this._zoneListener);

        console.log(`[HeistOutcome] Initialized: Score="${scoreData?.name}" ($${scoreData?.value}), ` +
            `${this.sideScores.length} side scores, ${extractionPoints.length} extraction points, ` +
            `${crewCount} crew`);
    }

    /**
     * Create a LootBag when an interactable is looted
     * @param {string} sourceId - ID of the interactable
     * @param {string} name - Display name
     * @param {number} value - Cash value
     * @param {boolean} isScore - Is this THE Score?
     * @returns {LootBag}
     */
    createLoot(sourceId, name, value, isScore = false) {
        const loot = new LootBag({
            id: `loot_${sourceId}_${Date.now()}`,
            name,
            value,
            isScore,
            sourceId
        });

        this.allLoot.push(loot);

        if (isScore) {
            this.scoreCollected = true;
            console.log(`[HeistOutcome] THE SCORE has been collected!`);
        }

        return loot;
    }

    /**
     * Check if a unit is on an extraction point and handle extraction
     * @param {Unit} unit - Unit to check
     * @returns {boolean} True if unit was extracted
     */
    checkExtraction(unit) {
        if (unit.isExtracted || unit.isCaptured) return false;

        for (const point of this.extractionPoints) {
            if (point.isActive && point.isUnitOnPoint(unit)) {
                this.extractUnit(unit);
                return true;
            }
        }

        return false;
    }

    /**
     * Extract a unit (called when they reach extraction point)
     * @param {Unit} unit
     */
    extractUnit(unit) {
        unit.isExtracted = true;
        this.escapedCrew.push(unit.id);

        // Transfer their loot to extracted pile
        if (unit.carriedLoot && unit.carriedLoot.length > 0) {
            for (const loot of unit.carriedLoot) {
                loot.extract();
                this.extractedLoot.push(loot);
            }
            console.log(`[HeistOutcome] ${unit.id} extracted with ${unit.carriedLoot.length} loot bags!`);
        } else {
            console.log(`[HeistOutcome] ${unit.id} extracted (no loot)`);
        }

        // Check if heist is complete
        this.checkHeistComplete();
    }

    /**
     * Capture a unit (hook for future guard AI)
     * @param {Unit} unit
     */
    captureUnit(unit) {
        if (unit.isExtracted || unit.isCaptured) return;

        unit.isCaptured = true;
        this.capturedCrew.push(unit.id);

        // Their loot is lost
        if (unit.carriedLoot && unit.carriedLoot.length > 0) {
            for (const loot of unit.carriedLoot) {
                loot.lose();
                // Check if we lost THE Score
                if (loot.isScore) {
                    this.scoreCollected = false;
                    console.log(`[HeistOutcome] THE SCORE WAS LOST!`);
                }
            }
            unit.carriedLoot = [];
        }

        // Heat penalty for captured crew (they might rat)
        const heatPenalty = 15; // Base penalty per captured crew
        this.heistHeat += heatPenalty;
        GameManager.gameState.resources.heat += heatPenalty;
        console.log(`[HeistOutcome] ${unit.id} CAPTURED! +${heatPenalty} heat`);
        window.dispatchEvent(new CustomEvent('heatChanged'));

        this.checkHeistComplete();
    }

    /**
     * Check if the heist is complete (all crew accounted for)
     */
    checkHeistComplete() {
        const accountedFor = this.escapedCrew.length + this.capturedCrew.length;

        if (accountedFor >= this.totalCrew) {
            this.completeHeist();
        }
    }

    /**
     * Force complete the heist (SCRAM, timer, etc.)
     */
    completeHeist() {
        if (this.isComplete) return;

        this.isComplete = true;
        this.outcome = this.calculateOutcome();

        // Unsubscribe from ThreatClock
        if (this._zoneListener) {
            threatClock.removeListener(this._zoneListener);
            this._zoneListener = null;
        }

        console.log(`[HeistOutcome] HEIST COMPLETE!`);
        console.log(`  Outcome: ${this.outcome.tier}`);
        console.log(`  Payout: $${this.outcome.payout}`);
        console.log(`  Heat this heist: +${this.outcome.heat}`);

        // Dispatch event for UI to show summary
        window.dispatchEvent(new CustomEvent('heistComplete', {
            detail: this.outcome
        }));
    }

    /**
     * Calculate the final outcome
     * @returns {Object} Outcome data
     */
    calculateOutcome() {
        const hasScore = this.extractedLoot.some(l => l.isScore);
        const allCrewEscaped = this.capturedCrew.length === 0 && this.escapedCrew.length === this.totalCrew;
        const someCrewEscaped = this.escapedCrew.length > 0;
        const noAlarms = this.alarmsTriggered === 0;

        // Calculate payout
        let payout = 0;
        for (const loot of this.extractedLoot) {
            payout += loot.value;
        }

        // Determine tier (outcome doesn't modify heat)
        let tier;

        if (this.capturedCrew.length === this.totalCrew) {
            tier = 'DISASTER';
        } else if (!someCrewEscaped) {
            tier = 'DISASTER';
        } else if (hasScore && allCrewEscaped && noAlarms) {
            tier = 'PERFECT_SCORE';
        } else if (hasScore && allCrewEscaped) {
            tier = 'CLEAN_SWEEP';
        } else if (hasScore) {
            tier = 'PROFESSIONAL';
        } else if (payout > 0) {
            tier = 'SALVAGE';
        } else {
            tier = 'BUST';
        }

        // Heat is the sum of what happened this heist (already applied to GameManager)
        return {
            tier,
            payout,
            heat: this.heistHeat,  // Just display, don't modify
            hasScore,
            extractedLoot: this.extractedLoot,
            escapedCrew: this.escapedCrew,
            capturedCrew: this.capturedCrew,
            alarmsTriggered: this.alarmsTriggered
        };
    }

    /**
     * Get default extraction point
     * @returns {ExtractionPoint|null}
     */
    getDefaultExtraction() {
        return this.extractionPoints.find(p => p.isDefault) || this.extractionPoints[0] || null;
    }

    /**
     * Record an alarm trigger
     * @param {string} source - What triggered the alarm
     */
    triggerAlarm(source) {
        this.alarmsTriggered++;
        const alarmHeat = 10;
        this.heistHeat += alarmHeat;
        GameManager.gameState.resources.heat += alarmHeat;
        console.log(`[HeistOutcome] ALARM! Source: ${source}, +${alarmHeat} heat`);
        window.dispatchEvent(new CustomEvent('heatChanged'));
    }
}

// Singleton instance for easy access
export const outcomeEngine = new HeistOutcomeEngine();
