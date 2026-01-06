/**
 * LootBag - Represents loot that crew members can carry
 * Created when interacting with Score/sideScore objects
 */
export class LootBag {
    /**
     * @param {Object} config
     * @param {string} config.id - Unique identifier
     * @param {string} config.name - Display name
     * @param {number} config.value - Cash value
     * @param {boolean} config.isScore - True if this is THE Score (primary target)
     * @param {string} config.sourceId - ID of the interactable this came from
     */
    constructor(config) {
        this.id = config.id;
        this.name = config.name || 'Loot';
        this.value = config.value || 0;
        this.isScore = config.isScore || false;
        this.sourceId = config.sourceId || null;

        // Tracking
        this.pickedUpAt = null;     // Timestamp when picked up
        this.carriedBy = null;      // Unit ID currently carrying this
        this.isExtracted = false;   // True if successfully extracted
    }

    /**
     * Mark this loot as picked up by a unit
     * @param {string} unitId - ID of unit picking up
     */
    pickup(unitId) {
        this.carriedBy = unitId;
        this.pickedUpAt = Date.now();
        console.log(`[LootBag] ${this.name} ($${this.value}) picked up by ${unitId}`);
    }

    /**
     * Mark this loot as extracted (successfully carried out)
     */
    extract() {
        this.isExtracted = true;
        console.log(`[LootBag] ${this.name} ($${this.value}) EXTRACTED!`);
    }

    /**
     * Mark this loot as lost (carrier captured/killed)
     */
    lose() {
        console.log(`[LootBag] ${this.name} ($${this.value}) LOST - carrier captured`);
        this.carriedBy = null;
    }
}
