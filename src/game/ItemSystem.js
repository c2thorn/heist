// Tactical Effects for the Simulation Engine
export const ITEM_EFFECTS = {
    "EMP": { type: 'FORCE_SUCCESS', targetStat: 'tech' },
    "BREACH_CHARGE": { type: 'FORCE_SUCCESS', targetStat: 'force' },
    "SMOKE_BOMB": { type: 'PREVENT_HEAT' }
};

export const ITEM_DEFINITIONS = {
    // Consumables (Tactical Items)
    "EMP": {
        id: "EMP",
        name: "EMP Charge",
        type: "CONSUMABLE",
        cost: 500,
        description: "Instantly pass next Tech node."
    },
    "BREACH_CHARGE": {
        id: "BREACH_CHARGE",
        name: "Breach Charge",
        type: "CONSUMABLE",
        cost: 600,
        description: "Instantly pass next Force node."
    },
    "SMOKE_BOMB": {
        id: "SMOKE_BOMB",
        name: "Smoke Bomb",
        type: "CONSUMABLE",
        cost: 400,
        description: "Prevents Heat generation for one node."
    },
    "MEDKIT": {
        id: "MEDKIT",
        name: "Medkit",
        type: "CONSUMABLE",
        cost: 300,
        description: "Standard issue first aid."
    },
    // Passives (Gear)
    "LOCKPICK": {
        id: "LOCKPICK",
        name: "Lockpick Set",
        type: "PASSIVE",
        cost: 800,
        stats: { tech: 1 },
        description: "+1 TECH when equipped."
    },
    "KEVLAR": {
        id: "KEVLAR",
        name: "Kevlar Vest",
        type: "PASSIVE",
        cost: 800,
        stats: { force: 1 },
        description: "+1 FORCE when equipped."
    }
};

export class ItemSystem {
    static getItemEffect(itemId) {
        return ITEM_EFFECTS[itemId] || null;
    }

    static getRandomShopItems(count = 3) {
        const keys = Object.keys(ITEM_DEFINITIONS);
        const items = [];
        for (let i = 0; i < count; i++) {
            const key = keys[Math.floor(Math.random() * keys.length)];
            items.push({ ...ITEM_DEFINITIONS[key], instanceId: Math.random().toString(36).substr(2, 9) });
        }
        return items;
    }
}
