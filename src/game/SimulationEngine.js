import GameManager from './GameManager';
import { GameConfig } from './GameConfig';

export const SimulationEngine = {
    isRunning: false,
    activeModifier: null,

    applyItem(item) {
        // item is the full item object
        this.activeModifier = item;
        console.log(`Tactical Item Activated: ${item.name}`);
    },
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

        // Initialize Loot Tracker
        let lootSecured = 0;

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
                const baseLoot = node.properties.lootValue;
                const multiplier = result.lootMultiplier || 1;
                const loot = Math.floor(baseLoot * multiplier);

                lootSecured += loot; // Track it
                GameManager.addCash(loot); // Immediate add (or could bank it till end)
                if (node.type === 'VAULT') GameManager.gameState.flags.vaultCracked = true;

                // Add loot info to result for UI
                result.lootGained = loot;
                console.log(`GAINED LOOT! +$${loot} (x${multiplier})`);
            }

            // 4. Update Visual Feedback
            if (scene) {
                scene.showEncounterResult(node.id, result, currentHeat);

                // PACING: Wait to let the user read the result
                await new Promise(r => setTimeout(r, GameConfig.SIMULATION.ACTION_DELAY_MS));
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

        let finalOutcome = 'FAILURE';
        if (lastNode && lastNode.type === 'EXIT') {
            finalOutcome = 'SUCCESS';
            console.log(`--- HEIST COMPLETE: SUCCESS (Loot: $${lootSecured}) ---`);
            if (scene) scene.showGameOver(true, `Mission Complete. Secured $${lootSecured}.`);
        } else {
            console.log("--- HEIST TERMINATED: NOT AT EXIT ---");
        }

        // Calculate Expenses
        // 1. Crew Wages
        const crewWages = crew.reduce((sum, c) => sum + (c.wage || 0), 0);

        // 2. Asset Costs (Retrieved from ArrangementEngine if possible, or tracked)
        // Ideally GameManager tracks 'dailyExpenses' or similar.
        // For now, assume 0 or we need to add tracking.
        const assetCosts = 0; // TODO: Track this in ArrangementEngine/GameManager

        const heistResult = {
            success: finalOutcome === 'SUCCESS',
            loot: lootSecured,
            heat: GameManager.gameState.resources.heat,
            expenses: {
                wages: crewWages,
                assets: assetCosts
            },
            netProfit: lootSecured - crewWages - assetCosts
        };

        window.dispatchEvent(new CustomEvent('heistFinished', {
            detail: heistResult
        }));

        this.isRunning = false;
        return heistResult;
    },

    resolveEncounter(node, crew) {
        const statType = node.properties.statCheck;

        // --- TACTICAL ITEM OVERRIDE (ACTIVE MODIFIER) ---
        if (this.activeModifier) {
            const mod = this.activeModifier;
            const effect = mod.effectData; // We'll store this in the item from GameManager

            if (effect && effect.type === 'FORCE_SUCCESS' && statType?.toLowerCase() === effect.targetStat?.toLowerCase()) {
                const specName = crew.length > 0 ? crew[0].name : 'Crew';
                this.activeModifier = null; // Consume
                return {
                    outcome: 'SUCCESS',
                    method: 'ITEM',
                    heatAdded: 0,
                    statName: statType,
                    crewValue: 99,
                    difficulty: 0,
                    rollResult: 99,
                    specialistName: specName,
                    difference: 99,
                    passiveTriggered: `Used ${mod.name}`
                };
            }
        }

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
        let totalRoll = highestStat + rng;
        let isSuccess = totalRoll >= difficulty;

        let heatAdded = isSuccess ? 0 : (node.properties.riskValue || 10);
        let passiveTriggered = null;
        let lootMultiplier = 1;

        // --- PREVENT HEAT MODIFIER ---
        if (this.activeModifier && this.activeModifier.effectData?.type === 'PREVENT_HEAT') {
            if (!isSuccess) {
                heatAdded = 0;
                passiveTriggered = `Used ${this.activeModifier.name}`;
            }
            this.activeModifier = null; // Consume
        }

        // --- PASSIVE ABILITIES ---
        if (bestSpecialist) {
            const role = this.identifyRole(bestSpecialist);

            // 1. MUSCLE: Second Wind (Re-roll Force Failures)
            if (role === 'MUSCLE' && statType === 'FORCE' && !isSuccess) {
                if (Math.random() < GameConfig.PASSIVES.FORCE_REROLL_CHANCE) {
                    // Re-roll
                    const newRng = Math.floor(Math.random() * 5) - 2;
                    totalRoll = highestStat + newRng;
                    isSuccess = totalRoll >= difficulty;
                    if (isSuccess) heatAdded = 0; // Fixed it!
                    passiveTriggered = `Second Wind (Re-rolled to ${totalRoll})`;
                }
            }

            // 2. HACKER: Patch (Reduce Heat on Tech Success)
            if (role === 'HACKER' && statType === 'TECH' && isSuccess) {
                heatAdded -= GameConfig.PASSIVES.TECH_HEAT_REDUCTION; // Can go negative relative to step, but handle global clamp later? 
                // Wait, heatAdded is 0 on success usually. So this is -2.
                // We need to apply this to the global heat directly or allow negative heatAdded.
                // Let's allow negative here and let the main loop handle it.
                passiveTriggered = 'Patch (Heat -2)';
            }

            // 3. STEALTH: Shadow (Dodge penalty on Stealth Failure)
            if (role === 'STEALTH' && statType === 'STEALTH' && !isSuccess) {
                if (Math.random() < GameConfig.PASSIVES.STEALTH_DODGE_CHANCE) {
                    heatAdded = 0;
                    passiveTriggered = 'Shadow (Dodged Heat)';
                }
            }

            // 4. FACE: Skimming (Loot Bonus)
            // Apply if Face resolves a node that has loot
            if (role === 'FACE' && node.properties.lootValue && isSuccess) {
                lootMultiplier = GameConfig.PASSIVES.FACE_LOOT_MULTIPLIER;
                passiveTriggered = 'Skimming (+50% Loot)';
            }
        }

        return {
            outcome: isSuccess ? 'SUCCESS' : 'FAIL',
            heatAdded: heatAdded,
            statName: statType,
            crewValue: highestStat,
            difficulty: difficulty,
            rollResult: totalRoll,
            specialistName: bestSpecialist ? bestSpecialist.name : 'Crew',
            difference: totalRoll - difficulty,
            passiveTriggered: passiveTriggered,
            lootMultiplier: lootMultiplier
        };
    },

    identifyRole(member) {
        // Simple logic: Highest stat determines role
        const s = member.stats;
        if (s.force >= s.tech && s.force >= s.stealth && s.force >= s.face) return 'MUSCLE';
        if (s.tech >= s.force && s.tech >= s.stealth && s.tech >= s.face) return 'HACKER';
        if (s.stealth >= s.force && s.stealth >= s.tech && s.stealth >= s.face) return 'STEALTH';
        return 'FACE';
    },

    updateEventLog(result, node) {
        // Log to GameManager History for AAR
        GameManager.logRunStep({
            nodeName: node.name,
            nodeType: node.type,
            outcome: result.outcome,
            specialist: result.specialistName,
            heatAdded: result.heatAdded,
            lootGained: result.lootGained || 0,
            details: result.outcome === 'SUCCESS' ? 'Bypassed' : `Failed (Missed by ${Math.abs(result.difference)})`
        });

        if (node.type === 'ENTRY' || node.type === 'EXIT') return;

        let message = "";
        if (result.outcome === 'SUCCESS') {
            message = `[${result.specialistName}] bypassed [${node.name}]. (0 Heat)`;
            if (result.lootGained) {
                message += ` Secured $${result.lootGained}!`;
            }
        } else {
            const diff = Math.abs(result.difference);
            message = `[${result.specialistName}] tried to handle [${node.name}] but missed by ${diff}! (+${result.heatAdded} Heat)`;
        }

        const logEvent = new CustomEvent('heistEventLog', { detail: { message, outcome: result.outcome } });
        window.dispatchEvent(logEvent);
    }
};
