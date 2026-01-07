import { getMapForContract } from '../data/buildings/index.js';

export class ContractGenerator {
    static generateDailyContracts(difficulty) {
        return [
            this.createContract(difficulty, 'STANDARD'),
            this.createContract(difficulty, 'LINEAR'),
            this.createContract(difficulty, 'COMPOUND')
        ];
    }

    static createContract(difficulty, type) {
        const id = 'contract_' + Math.random().toString(36).substr(2, 9);
        const name = this.generateName(type);
        const rewardMult = this.getRewardMult(type);

        // Get a compatible map from the pool (may be static or generated)
        const mapData = getMapForContract(type, difficulty);

        // Adjust difficulty flavor slightly based on type
        let diffDisplay = difficulty;
        if (type === 'COMPOUND') diffDisplay += 1; // Compound is harder

        return {
            id: id,
            name: mapData.isStatic ? name : mapData.name,  // Use generated name if procedural
            difficulty: difficulty,
            rewardMult: rewardMult,
            layoutType: type,
            buildingId: mapData.id,
            mapData: mapData.isStatic ? null : mapData,  // Store full mapData if generated
            description: this.getDescription(type)
        };
    }

    static generateName(type) {
        const prefixes = {
            STANDARD: ["First City", "Metro", "Central", "Union"],
            LINEAR: ["Express", "Pipeline", "Corridor", "Train"],
            COMPOUND: ["Fortress", "Citadel", "Complex", "HQ"]
        };
        const suffixes = ["Bank", "Archives", "Depot", "Reserve", "Center"];

        const p = prefixes[type][Math.floor(Math.random() * prefixes[type].length)];
        const s = suffixes[Math.floor(Math.random() * suffixes.length)];
        return `${p} ${s}`;
    }

    static getRewardMult(type) {
        switch (type) {
            case 'LINEAR': return 0.8; // Safer, less loot
            case 'COMPOUND': return 1.5; // Harder, more loot
            default: return 1.0;
        }
    }

    static getDescription(type) {
        switch (type) {
            case 'LINEAR': return "Narrow path. Fewer distractions. Good for speed.";
            case 'COMPOUND': return "High security hub. Dangerous bottlenecks. High payout.";
            default: return "Standard bank layout. Balanced risk and reward.";
        }
    }
}
