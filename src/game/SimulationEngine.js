import GameManager from './GameManager';

export const SimulationEngine = {
    isRunning: false,

    async runHeist(pathIds, crew, scene) {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log("--- STARTING HEIST SIMULATION ---");
        const mapNodes = GameManager.gameState.map.nodes;

        // Reset currentNodeIndex for run tracking
        GameManager.gameState.simulation.currentNodeIndex = 0;

        // Initial position - move stack to start node immediately if not there
        if (pathIds.length > 0) {
            const firstNode = mapNodes.find(n => n.id === pathIds[0]);
            if (firstNode && scene) {
                scene.initStackVisible(firstNode.x, firstNode.y);
            }
        }

        for (const nodeId of pathIds) {
            const node = mapNodes.find(n => n.id === nodeId);
            if (!node) continue;

            // 1. Move visuals first (Arrival)
            if (scene) {
                await scene.moveStackVisual(node);
                // Reveal if hidden when stack arrives (Blind Jump)
                if (node.status === 'HIDDEN') {
                    node.status = 'REVEALED';
                    scene.refreshNode(node.id);
                }
            }

            console.log(`Checking Node: ${node.name} [${node.id}] (${node.properties.statCheck || 'NONE'})`);

            // 2. Resolve Logic
            const result = this.resolveEncounter(node, crew);

            // 3. Apply Results
            GameManager.gameState.resources.heat += result.heatAdded;
            const currentHeat = GameManager.gameState.resources.heat;

            console.log(`Result: ${result.outcome} | Heat Added: +${result.heatAdded} | Total Heat: ${currentHeat}%`);

            // Grant Loot if success (not just Vaults now, e.g. Decoys)
            if (result.outcome === 'SUCCESS' && node.properties.lootValue) {
                const loot = node.properties.lootValue;
                GameManager.addCash(loot);
                if (node.type === 'VAULT') GameManager.gameState.flags.vaultCracked = true;
                console.log(`GAINED LOOT! +$${loot}`);
            }

            // 4. Update Visual Feedback
            if (scene) {
                scene.showEncounterResult(node.id, result, currentHeat);
            }

            // 5. Update UI Log
            this.updateEventLog(result, node);

            // Check Fail State (Max Heat)
            const endType = GameManager.checkEndConditions();
            if (endType === 'FAILURE') {
                console.log("!!! ALARM TRIGGERED - BUSTED !!!");
                GameManager.gameState.flags.alarmTriggered = true;
                if (scene) scene.showGameOver(false);
                window.dispatchEvent(new CustomEvent('heistFinished'));
                this.isRunning = false;
                return;
            }

            // Check Win State (Early Retirement)
            if (endType === 'VICTORY_CASH') {
                if (scene) scene.showGameOver(true, "EARLY RETIREMENT");
                window.dispatchEvent(new CustomEvent('heistFinished'));
                this.isRunning = false;
                return;
            }
        }

        // Check if finished path at Exit
        const lastNodeId = pathIds[pathIds.length - 1];
        const lastNode = mapNodes.find(n => n.id === lastNodeId);

        if (lastNode && lastNode.type === 'EXIT') {
            console.log("--- HEIST COMPLETE: SUCCESS ---");
            if (scene) scene.showGameOver(true);
        } else {
            console.log("--- HEIST TERMINATED: NOT AT EXIT ---");
        }

        window.dispatchEvent(new CustomEvent('heistFinished'));
        this.isRunning = false;
    },

    resolveEncounter(node, crew) {
        const statType = node.properties.statCheck;
        if (!statType || statType === 'NONE') {
            return {
                outcome: 'SUCCESS',
                heatAdded: 0,
                statName: 'NONE',
                crewValue: 0,
                difficulty: 0,
                specialistName: 'Crew'
            };
        }

        const difficulty = node.properties.difficulty || 0;
        let bestSpecialist = null;
        let highestStat = -1;

        crew.forEach(member => {
            if (!member.stats) return;
            const statKey = statType.toLowerCase();
            const val = member.stats[statKey] || 0;
            if (val > highestStat) {
                highestStat = val;
                bestSpecialist = member;
            }
        });

        const rng = Math.floor(Math.random() * 5) - 2;
        const totalRoll = highestStat + rng;
        const isSuccess = totalRoll >= difficulty;

        return {
            outcome: isSuccess ? 'SUCCESS' : 'FAIL',
            heatAdded: isSuccess ? 0 : (node.properties.riskValue || 10),
            statName: statType,
            crewValue: highestStat,
            difficulty: difficulty,
            rollResult: totalRoll,
            specialistName: bestSpecialist ? bestSpecialist.name : 'Crew',
            difference: totalRoll - difficulty
        };
    },

    updateEventLog(result, node) {
        if (node.type === 'ENTRY' || node.type === 'EXIT') return;

        let message = "";
        if (result.outcome === 'SUCCESS') {
            message = `[${result.specialistName}] bypassed [${node.name}] smoothly. (0 Heat)`;
        } else {
            const diff = Math.abs(result.difference);
            message = `[${result.specialistName}] tried to handle [${node.name}] but missed by ${diff}! (+${result.heatAdded} Heat)`;
        }

        const logEvent = new CustomEvent('heistEventLog', { detail: { message, outcome: result.outcome } });
        window.dispatchEvent(logEvent);
    }
};
