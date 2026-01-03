import { GameConfig } from './GameConfig';

const NODE_FLAVOR_TABLE = {
    TECH: ["CCTV Camera", "Laser Grid", "Biometric Lock", "Encryption Hub", "Motion Sensor"],
    FORCE: ["Security Guard", "Reinforced Door", "Concrete Wall", "Heavy Gate", "Armed Sentry"],
    STEALTH: ["Sleeping Guard", "Motion Sensor", "Ventilation Shaft", "Dark Corner", "Hidden Alcove"],
    FACE: ["Receptionist", "VIP Guest", "Police Patrol", "Curious Janitor", "Staff Guard"]
};

export class MapGenerator {
    static getRandomFlavor(statCheck) {
        const list = NODE_FLAVOR_TABLE[statCheck];
        if (!list) return "Mystery Node";
        return list[Math.floor(Math.random() * list.length)];
    }

    static generateStaticLevel(difficultyModifier = 0, viewportHeight = 800, layoutType = 'STANDARD', isGrandHeist = false) {
        const nodes = [];
        const edges = [];

        // UI Constraint: Leave bottom 35% for the Command Deck (65vh map height)
        const playableHeight = viewportHeight * 0.65;
        const margin = GameConfig.MAP.VIEWPORT_PADDING;

        const lerpY = (ratio) => margin + (playableHeight - margin) * ratio;

        if (isGrandHeist) {
            return this.generateGrandHeist(difficultyModifier, playableHeight, margin, lerpY);
        }

        const baseLoot = GameConfig.ECONOMY.BASE_LOOT_VAULT + (difficultyModifier * GameConfig.ECONOMY.LOOT_VAULT_SCALING);
        const sideLoot = GameConfig.ECONOMY.BASE_LOOT_SIDE + (difficultyModifier * GameConfig.ECONOMY.LOOT_SIDE_SCALING);

        let layer0, layer1, layer2, layer3;

        // --- LAYOUT LOGIC ---
        if (layoutType === 'LINEAR') {
            // 1-1-1-1 Chain
            layer0 = [
                { id: "n_entry_01", x: 150, y: lerpY(0.5), type: "ENTRY", name: "Maintenance Hatch", status: "REVEALED", properties: { statCheck: "FORCE", difficulty: 3 + difficultyModifier, riskValue: 10 } }
            ];
            layer1 = [
                { id: "n_sec_01", x: 450, y: lerpY(0.5), type: "TRANSIT", name: this.getRandomFlavor("TECH"), status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 5 + difficultyModifier, riskValue: 20 } }
            ];
            layer2 = [
                { id: "n_vault", x: 850, y: lerpY(0.5), type: "VAULT", name: "Local Vault", status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 8 + difficultyModifier, riskValue: 50, lootValue: baseLoot * 0.8, hasLoot: true } }
            ];
            layer3 = [
                { id: "n_exit_01", x: 1200, y: lerpY(0.5), type: "EXIT", name: "Side Door", status: "HIDDEN", properties: { statCheck: "FACE", difficulty: 4 + difficultyModifier, riskValue: 10 } }
            ];
        } else if (layoutType === 'COMPOUND') {
            // Divergent -> Convergent
            layer0 = [
                { id: "n_entry_01", x: 150, y: lerpY(0.5), type: "ENTRY", name: "Main Gate", status: "REVEALED", properties: { statCheck: "FACE", difficulty: 5 + difficultyModifier, riskValue: 20 } }
            ];
            // Layer 1 has 3 nodes
            layer1 = [
                { id: "n_sec_01", x: 450, y: lerpY(0.2), type: "TRANSIT", name: this.getRandomFlavor("STEALTH"), status: "HIDDEN", properties: { statCheck: "STEALTH", difficulty: 6 + difficultyModifier, riskValue: 25 } },
                { id: "n_sec_02", x: 450, y: lerpY(0.5), type: "TRANSIT", name: this.getRandomFlavor("FORCE"), status: "HIDDEN", properties: { statCheck: "FORCE", difficulty: 7 + difficultyModifier, riskValue: 30 } },
                { id: "n_sec_03", x: 450, y: lerpY(0.8), type: "TRANSIT", name: this.getRandomFlavor("TECH"), status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 6 + difficultyModifier, riskValue: 25 } }
            ];
            layer2 = [
                { id: "n_vault", x: 850, y: lerpY(0.5), type: "VAULT", name: "Fortress Vault", status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 10 + difficultyModifier, riskValue: 60, lootValue: baseLoot * 1.5, hasLoot: true } }
            ];
            layer3 = [
                { id: "n_exit_01", x: 1200, y: lerpY(0.2), type: "EXIT", name: "Helipad", status: "HIDDEN", properties: { statCheck: "FORCE", difficulty: 7 + difficultyModifier, riskValue: 20 } },
                { id: "n_exit_02", x: 1200, y: lerpY(0.8), type: "EXIT", name: "Sewers", status: "HIDDEN", properties: { statCheck: "STEALTH", difficulty: 5 + difficultyModifier, riskValue: 15 } }
            ];
        } else {
            // STANDARD (Original)
            layer0 = [
                { id: "n_entry_01", x: 150, y: lerpY(0.3), type: "ENTRY", name: "Sewer Connection", status: "REVEALED", properties: { statCheck: "FORCE", difficulty: 3 + difficultyModifier, riskValue: 10 } },
                { id: "n_entry_02", x: 150, y: lerpY(0.7), type: "ENTRY", name: "Roof Access", status: "REVEALED", properties: { statCheck: "STEALTH", difficulty: 4 + difficultyModifier, riskValue: 15 } }
            ];
            layer1 = [
                { id: "n_sec_01", x: 450, y: lerpY(0.15), type: "TRANSIT", name: this.getRandomFlavor("TECH"), status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 5 + difficultyModifier, riskValue: 20 } },
                { id: "n_sec_02", x: 450, y: lerpY(0.5), type: "TRANSIT", name: this.getRandomFlavor("FORCE"), status: "HIDDEN", properties: { statCheck: "FORCE", difficulty: 6 + difficultyModifier, riskValue: 25 } },
                { id: "n_sec_03", x: 450, y: lerpY(0.85), type: "TRANSIT", name: this.getRandomFlavor("TECH"), status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 5 + difficultyModifier, riskValue: 20 } }
            ];
            layer2 = [
                { id: "n_vault", x: 850, y: lerpY(0.5), type: "VAULT", name: "High-Security Vault", status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 9 + difficultyModifier, riskValue: 50, lootValue: baseLoot, hasLoot: true } }
            ];
            layer3 = [
                { id: "n_exit_01", x: 1200, y: lerpY(0.3), type: "EXIT", name: this.getRandomFlavor("FACE"), status: "HIDDEN", properties: { statCheck: "FACE", difficulty: 4 + difficultyModifier, riskValue: 10 } },
                { id: "n_exit_02", x: 1200, y: lerpY(0.7), type: "EXIT", name: this.getRandomFlavor("FACE"), status: "HIDDEN", properties: { statCheck: "FACE", difficulty: 6 + difficultyModifier, riskValue: 20 } }
            ];
        }

        // Random Side Loot Injection
        [...layer1, ...layer3].forEach(node => {
            if (node.type === 'TRANSIT' && Math.random() < GameConfig.SIMULATION.LOOT_CHANCE) {
                node.properties.lootValue = sideLoot;
                node.properties.hasLoot = true;
            }
        });

        // Combine all nodes
        const allLayers = [layer0, layer1, layer2, layer3];
        allLayers.forEach(layer => nodes.push(...layer));

        // Helper to add edge and update connectedTo
        const connect = (fromId, toId) => {
            edges.push({ from: fromId, to: toId });
            const fromNode = nodes.find(n => n.id === fromId);
            if (!fromNode.connectedTo) fromNode.connectedTo = [];
            fromNode.connectedTo.push(toId);
        };

        // --- CONNECTIONS LOGIC ---
        // Simplistic: Connect every node in Layer N to every node in Layer N+1 (Mesh)
        // This works for all our layouts generally.
        layer0.forEach(n0 => {
            layer1.forEach(n1 => connect(n0.id, n1.id));
        });
        layer1.forEach(n1 => {
            layer2.forEach(n2 => connect(n1.id, n2.id));
        });
        layer2.forEach(n2 => {
            layer3.forEach(n3 => connect(n2.id, n3.id));
        });

        return {
            levelId: `bank_lvl_${difficultyModifier}`,
            nodes: nodes,
            edges: edges
        };
    }

    static generateGrandHeist(diff, playableHeight, margin, lerpY) {
        const nodes = [];
        const edges = [];

        const connect = (fromId, toId) => {
            edges.push({ from: fromId, to: toId });
            const fromNode = nodes.find(n => n.id === fromId);
            if (!fromNode.connectedTo) fromNode.connectedTo = [];
            fromNode.connectedTo.push(toId);
        };

        // 1. Entry
        const layer0 = [
            { id: "g_entry_1", x: 100, y: lerpY(0.5), type: "ENTRY", name: "Executive Hangar", status: "REVEALED", properties: { statCheck: "FACE", difficulty: 8 + diff, riskValue: 30 } }
        ];

        // 2. Security Layers (3 layers)
        const layer1 = [
            { id: "g_sec1_1", x: 300, y: lerpY(0.2), type: "TRANSIT", name: "Cryo-Lock", status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 10 + diff, riskValue: 40 } },
            { id: "g_sec1_2", x: 300, y: lerpY(0.8), type: "TRANSIT", name: "Armed Barracks", status: "HIDDEN", properties: { statCheck: "FORCE", difficulty: 10 + diff, riskValue: 40 } }
        ];

        const layer2 = [
            { id: "g_sec2_1", x: 500, y: lerpY(0.3), type: "TRANSIT", name: "Invisible Sensors", status: "HIDDEN", properties: { statCheck: "STEALTH", difficulty: 12 + diff, riskValue: 50 } },
            { id: "g_sec2_2", x: 500, y: lerpY(0.5), type: "TRANSIT", name: "AI Gatekeeper", status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 12 + diff, riskValue: 50 } },
            { id: "g_sec2_3", x: 500, y: lerpY(0.7), type: "TRANSIT", name: "Blast Shield", status: "HIDDEN", properties: { statCheck: "FORCE", difficulty: 12 + diff, riskValue: 50 } }
        ];

        const layer3 = [
            { id: "g_deco_1", x: 700, y: lerpY(0.2), type: "TRANSIT", name: "Decoy Vault A", status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 15 + diff, riskValue: 60, lootValue: 500 } },
            { id: "g_real_v", x: 700, y: lerpY(0.5), type: "VAULT", name: "THE GRAND VAULT", status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 20 + diff, riskValue: 100, lootValue: 10000 } },
            { id: "g_deco_2", x: 700, y: lerpY(0.8), type: "TRANSIT", name: "Decoy Vault B", status: "HIDDEN", properties: { statCheck: "TECH", difficulty: 15 + diff, riskValue: 60, lootValue: 500 } }
        ];

        // 3. Exit
        const layer4 = [
            { id: "g_exit", x: 1000, y: lerpY(0.5), type: "EXIT", name: "Emergency Extraction", status: "HIDDEN", properties: { statCheck: "FORCE", difficulty: 15 + diff, riskValue: 50 } }
        ];

        [layer0, layer1, layer2, layer3, layer4].forEach(l => nodes.push(...l));

        // Connections
        connect("g_entry_1", "g_sec1_1");
        connect("g_entry_1", "g_sec1_2");

        connect("g_sec1_1", "g_sec2_1");
        connect("g_sec1_1", "g_sec2_2");
        connect("g_sec1_2", "g_sec2_2");
        connect("g_sec1_2", "g_sec2_3");

        connect("g_sec2_1", "g_deco_1");
        connect("g_sec2_2", "g_real_v");
        connect("g_sec2_3", "g_deco_2");

        connect("g_deco_1", "g_exit");
        connect("g_real_v", "g_exit");
        connect("g_deco_2", "g_exit");

        return { levelId: 'GRAND_HEIST', nodes, edges };
    }
}
