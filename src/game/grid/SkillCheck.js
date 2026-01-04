/**
 * SkillCheck - Dice roll system for interaction outcomes
 * Per SPEC_004 - 2d6 + modifier vs DC
 */

/**
 * Result of a skill check
 */
export class SkillCheckResult {
    constructor(roll1, roll2, modifier, dc) {
        this.roll1 = roll1;
        this.roll2 = roll2;
        this.modifier = modifier;
        this.dc = dc;
        this.total = roll1 + roll2 + modifier;
        this.success = this.total >= dc;
        this.margin = this.total - dc;

        // Special outcomes
        this.isCriticalSuccess = roll1 === 6 && roll2 === 6;  // Snake eyes (inverted for heist)
        this.isCriticalFailure = roll1 === 1 && roll2 === 1;  // Box cars
    }

    /**
     * Get description of the result
     */
    getDescription() {
        if (this.isCriticalSuccess) return 'CRITICAL SUCCESS!';
        if (this.isCriticalFailure) return 'FUMBLE!';
        if (this.success) return 'Success';
        return 'Failed';
    }

    /**
     * Get detailed roll info
     */
    toString() {
        return `${this.roll1}+${this.roll2}+${this.modifier} = ${this.total} vs DC ${this.dc}: ${this.getDescription()}`;
    }
}

/**
 * SkillCheck utility class
 */
export class SkillCheck {
    /**
     * Roll 2d6 + modifier against DC
     * @param {number} modifier - Modifier to add (from unit skill, tools, etc.)
     * @param {number} dc - Difficulty class to beat
     * @returns {SkillCheckResult}
     */
    static roll(modifier, dc) {
        const roll1 = Math.floor(Math.random() * 6) + 1;
        const roll2 = Math.floor(Math.random() * 6) + 1;

        return new SkillCheckResult(roll1, roll2, modifier, dc);
    }

    /**
     * Roll with advantage (roll twice, take better)
     */
    static rollAdvantage(modifier, dc) {
        const result1 = SkillCheck.roll(modifier, dc);
        const result2 = SkillCheck.roll(modifier, dc);

        return result1.total >= result2.total ? result1 : result2;
    }

    /**
     * Roll with disadvantage (roll twice, take worse)
     */
    static rollDisadvantage(modifier, dc) {
        const result1 = SkillCheck.roll(modifier, dc);
        const result2 = SkillCheck.roll(modifier, dc);

        return result1.total < result2.total ? result1 : result2;
    }

    /**
     * Get effective modifier for a unit interacting with something
     * @param {Unit} unit - The unit performing the action
     * @param {Interactable} interactable - The target object
     * @returns {number} Combined modifier
     */
    static getModifier(unit, interactable) {
        let modifier = 0;

        // Base skill (could come from crew stats later)
        modifier += unit.skillModifier || 0;

        // Tool bonus (if unit has required tool)
        if (interactable.requiredTool) {
            // TODO: Check unit inventory for tool and add bonus
            // For now, assume no tool bonus
        }

        // Radio stance modifier
        if (window.radioController) {
            const stance = window.radioController.currentStance;
            if (stance === 'GO_LOUD') {
                modifier += 2;  // Less careful = easier checks
            } else if (stance === 'SILENT_RUNNING') {
                modifier -= 1;  // Being extra careful = harder
            }
        }

        return modifier;
    }
}
