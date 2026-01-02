import { v4 as uuidv4 } from 'uuid';

class GameManager {
    constructor() {
        if (GameManager.instance) {
            return GameManager.instance;
        }

        GameManager.instance = this;

        this.maxDays = 5;
        this.victoryCash = 5000;

        this.initGameState();
        console.log("GameManager Initialized", this.gameState);
    }

    initGameState() {
        this.gameState = {
            meta: {
                runId: uuidv4(),
                currentDay: 1,
                cash: 1500,
                intel: 10,
                difficultyModifier: 0
            },
            resources: {
                heat: 0,
                maxHeat: 100,
                heatDecay: 10
            },
            flags: {
                vaultCracked: false,
                alarmTriggered: false,
                isGameOver: false,
                isVictory: false
            },
            simulation: {
                status: "PLANNING",
                plannedPath: [],
                currentNodeIndex: 0,
                log: []
            },
            crew: {
                activeStack: []
            },
            map: null
        };
    }

    resetGame() {
        this.initGameState();
        window.dispatchEvent(new CustomEvent('gameReset'));
    }

    checkEndConditions() {
        if (this.gameState.resources.heat >= this.gameState.resources.maxHeat) {
            this.gameState.flags.isGameOver = true;
            return 'FAILURE';
        }
        if (this.gameState.meta.cash >= this.victoryCash) {
            this.gameState.flags.isVictory = true;
            return 'VICTORY_CASH';
        }
        return null;
    }

    addToPath(nodeId) {
        const { plannedPath } = this.gameState.simulation;
        const { nodes } = this.gameState.map;

        const targetNode = nodes.find(n => n.id === nodeId);
        if (!targetNode) return false;

        if (plannedPath.length === 0) {
            if (targetNode.type === 'ENTRY') {
                plannedPath.push(nodeId);
                return true;
            }
            return false;
        }

        const lastNodeId = plannedPath[plannedPath.length - 1];
        const lastNode = nodes.find(n => n.id === lastNodeId);

        if (lastNode.connectedTo.includes(nodeId)) {
            plannedPath.push(nodeId);
            return true;
        }
        return false;
    }

    getPath() {
        return this.gameState.simulation.plannedPath;
    }

    scoutNode(nodeId) {
        const node = this.gameState.map.nodes.find(n => n.id === nodeId);
        if (!node || node.status === 'REVEALED') return false;

        const scoutCost = 5;
        if (this.gameState.meta.intel >= scoutCost) {
            this.gameState.meta.intel -= scoutCost;
            node.status = 'REVEALED';
            return true;
        }
        return false;
    }

    addCash(amount) {
        this.gameState.meta.cash += amount;
    }

    buyIntel() {
        const cost = 200;
        if (this.gameState.meta.cash >= cost) {
            this.gameState.meta.cash -= cost;
            this.gameState.meta.intel += 5;
            return true;
        }
        return false;
    }

    launderMoney() {
        const cost = 500;
        if (this.gameState.meta.cash >= cost) {
            this.gameState.meta.cash -= cost;
            this.gameState.resources.heat = Math.max(0, this.gameState.resources.heat - 20);
            return true;
        }
        return false;
    }

    startNextDay(newMap) {
        this.gameState.meta.currentDay++;
        this.gameState.meta.difficultyModifier++;
        this.gameState.map = newMap;
        this.gameState.simulation.plannedPath = [];
        this.gameState.flags.vaultCracked = false;
        this.gameState.flags.alarmTriggered = false;
        console.log(`Starting Day ${this.gameState.meta.currentDay}`);
    }
}

const gameManager = new GameManager();
export default gameManager;
