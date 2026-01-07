/**
 * SectorManager - Manages sector visibility and intel purchasing
 * Per SPEC_005 Section 2 - The Intel Economy (Reconnaissance)
 */

import { GridConfig } from './GridConfig.js';

/**
 * Sector visibility states
 */
export const SectorState = {
    HIDDEN: 'HIDDEN',       // Not purchased - shows fog
    REVEALED: 'REVEALED',   // Intel purchased - shows layout
    VISIBLE: 'VISIBLE'      // Currently in view (guards visible)
};

/**
 * SectorManager class - manages map sector intel and visibility
 */
export class SectorManager {
    /**
     * Create a SectorManager
     * @param {TileMap} tileMap - Reference to the tile map
     */
    constructor(tileMap) {
        this.tileMap = tileMap;
        this.sectors = new Map();  // sectorId -> sector data
        this.intelAvailable = 10;  // Starting intel points
    }

    /**
     * Initialize sectors from hiddenZones array (for generated maps)
     * Only creates sectors for zones that require intel to reveal
     * @param {Object[]} hiddenZones - Array of { id, name, intelCost }
     */
    initFromHiddenZones(hiddenZones) {
        // Clear existing sectors
        this.sectors.clear();

        if (!hiddenZones || hiddenZones.length === 0) {
            console.log('[SectorManager] No hidden zones - all areas visible');
            return;
        }

        for (const zone of hiddenZones) {
            const tileMapZone = this.tileMap.getZone(zone.id);
            if (!tileMapZone) {
                console.warn(`[SectorManager] Zone not found in tileMap: ${zone.id}`);
                continue;
            }

            this.sectors.set(zone.id, {
                id: zone.id,
                name: zone.name || tileMapZone.name,
                intelCost: zone.intelCost || 2,
                difficulty: 1,
                state: SectorState.HIDDEN,
                arrangements: []
            });

            console.log(`[SectorManager] Sector defined: ${zone.id} (cost: ${zone.intelCost})`);
        }

        console.log(`[SectorManager] Initialized ${this.sectors.size} purchasable sectors`);
    }

    /**
     * Define a sector with intel cost
     * @param {string} sectorId - Unique sector identifier (matches zone id)
     * @param {Object} config - Sector configuration
     * @param {number} config.intelCost - Cost to reveal (in intel points)
     * @param {number} config.difficulty - 1-5 difficulty rating
     * @param {boolean} config.isHidden - Start hidden (default true)
     */
    defineSector(sectorId, config = {}) {
        const zone = this.tileMap.getZone(sectorId);

        if (!zone) {
            console.warn(`[SectorManager] Zone not found: ${sectorId}`);
            return;
        }

        const sector = {
            id: sectorId,
            name: zone.name,
            intelCost: config.intelCost || 2,
            difficulty: config.difficulty || 1,
            state: config.isHidden !== false ? SectorState.HIDDEN : SectorState.REVEALED,
            arrangements: []  // Available arrangements in this sector
        };

        this.sectors.set(sectorId, sector);

        // Apply initial visibility
        if (sector.state === SectorState.HIDDEN) {
            this.tileMap.setZoneVisibility(sectorId, GridConfig.VISIBILITY.HIDDEN);
        }

        console.log(`[SectorManager] Defined sector: ${sectorId} (cost: ${sector.intelCost} intel)`);
    }

    /**
     * Purchase intel to reveal a sector
     * @param {string} sectorId - Sector to reveal
     * @returns {boolean} True if purchase succeeded
     */
    purchaseIntel(sectorId) {
        const sector = this.sectors.get(sectorId);

        if (!sector) {
            console.warn(`[SectorManager] Unknown sector: ${sectorId}`);
            return false;
        }

        if (sector.state !== SectorState.HIDDEN) {
            console.log(`[SectorManager] Sector already revealed: ${sectorId}`);
            return true;
        }

        if (this.intelAvailable < sector.intelCost) {
            console.warn(`[SectorManager] Not enough intel! Need ${sector.intelCost}, have ${this.intelAvailable}`);
            return false;
        }

        // Deduct intel
        this.intelAvailable -= sector.intelCost;
        sector.state = SectorState.REVEALED;

        // Reveal tiles in the zone
        this.tileMap.setZoneVisibility(sectorId, GridConfig.VISIBILITY.REVEALED);

        console.log(`[SectorManager] Revealed sector: ${sectorId} (${this.intelAvailable} intel remaining)`);

        // Dispatch event for UI
        window.dispatchEvent(new CustomEvent('sectorRevealed', {
            detail: { sectorId, sector }
        }));

        return true;
    }

    /**
     * Check if a sector is revealed
     * @param {string} sectorId - Sector to check
     * @returns {boolean} True if revealed (or not in hidden zones)
     */
    isSectorRevealed(sectorId) {
        const sector = this.sectors.get(sectorId);
        // If sector is not in our map, it's not a hidden zone → revealed by default
        if (!sector) return true;
        return sector.state !== SectorState.HIDDEN;
    }

    /**
     * Get all defined sectors
     * @returns {Object[]} Array of sector data
     */
    getAllSectors() {
        return Array.from(this.sectors.values());
    }

    /**
     * Get revealed sectors
     * @returns {Object[]} Array of revealed sector data
     */
    getRevealedSectors() {
        return this.getAllSectors().filter(s => s.state !== SectorState.HIDDEN);
    }

    /**
     * Get hidden sectors (purchasable)
     * @returns {Object[]} Array of hidden sector data
     */
    getHiddenSectors() {
        return this.getAllSectors().filter(s => s.state === SectorState.HIDDEN);
    }

    /**
     * Get sector by ID
     * @param {string} sectorId - Sector ID
     * @returns {Object|null} Sector data or null
     */
    getSector(sectorId) {
        return this.sectors.get(sectorId) || null;
    }

    /**
     * Set available intel points
     * @param {number} intel - Intel points available
     */
    setIntel(intel) {
        this.intelAvailable = intel;
    }

    /**
     * Add intel points
     * @param {number} amount - Amount to add
     */
    addIntel(amount) {
        this.intelAvailable += amount;
        console.log(`[SectorManager] Intel added: +${amount} (total: ${this.intelAvailable})`);
    }

    /**
     * Get current intel balance
     * @returns {number} Intel points available
     */
    getIntel() {
        return this.intelAvailable;
    }

    /**
     * Reveal all sectors (debug/testing)
     */
    revealAll() {
        for (const [sectorId, sector] of this.sectors) {
            sector.state = SectorState.REVEALED;
            this.tileMap.setZoneVisibility(sectorId, GridConfig.VISIBILITY.REVEALED);
        }
        console.log('[SectorManager] All sectors revealed (debug)');
    }

    /**
     * Reset for new heist
     */
    reset() {
        for (const sector of this.sectors.values()) {
            sector.state = SectorState.HIDDEN;
            this.tileMap.setZoneVisibility(sector.id, GridConfig.VISIBILITY.HIDDEN);
        }
        console.log('[SectorManager] All sectors hidden');
    }
}
