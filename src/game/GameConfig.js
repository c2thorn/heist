export const GameConfig = {
    SIMULATION: {
        ACTION_DELAY_MS: 1000,
        LOOT_CHANCE: 0.3
    },
    PASSIVES: {
        FORCE_REROLL_CHANCE: 0.50,
        TECH_HEAT_REDUCTION: 2,
        STEALTH_DODGE_CHANCE: 0.50,
        FACE_LOOT_MULTIPLIER: 1.50
    },
    ECONOMY: {
        STARTING_CASH: 1500,
        STARTING_INTEL: 10,
        VICTORY_CASH: 5000,

        // Costs
        SCOUT_COST: 5,
        BUY_INTEL_COST: 200,
        BUY_INTEL_AMOUNT: 5,
        LAUNDER_COST: 500,
        LAUNDER_AMOUNT: 20,

        // Loot Generation
        BASE_LOOT_VAULT: 2000,
        LOOT_VAULT_SCALING: 500, // Per diff modifier
        BASE_LOOT_SIDE: 300,
        LOOT_SIDE_SCALING: 50
    },
    HEAT: {
        MAX_HEAT: 100,
        DECAY_RATE: 10,
        INITIAL_HEAT: 0
    },
    THREAT_CLOCK: {
        // Zone thresholds in seconds
        CASUAL_START: 0,
        ALERT_START: 30,      // Was 60s
        LOCKDOWN_START: 60,   // Was 120s
        SWAT_START: 90        // Was 180s
    },
    MAP: {
        DEFAULT_ROWS: 4,
        VIEWPORT_PADDING: 100
    }
};
