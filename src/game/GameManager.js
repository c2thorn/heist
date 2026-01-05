import { v4 as uuidv4 } from 'uuid';
import { GameConfig } from './GameConfig';
import { MapGenerator } from './MapGenerator';
import { CrewGenerator } from './CrewGenerator';
import { ItemSystem } from './ItemSystem';
import { ROSTER_POOL } from '../data/CrewLibrary';
import { SimulationEngine } from './SimulationEngine';

class EventEmitter {
    constructor() {
        this.listeners = {};
    }
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

class GameManager {
    constructor() {
        if (GameManager.instance) {
            return GameManager.instance;
        }

        GameManager.instance = this;

        this.maxDays = 5;
        this.events = new EventEmitter();

        this.initGameState();
        console.log("GameManager Initialized", this.gameState);
    }

    initGameState() {
        this.gameState = {
            meta: {
                runId: uuidv4(),
                currentDay: 1,
                cash: GameConfig.ECONOMY.STARTING_CASH,
                intel: GameConfig.ECONOMY.STARTING_INTEL,
                difficultyModifier: 0,
                activeContract: null
            },
            resources: {
                heat: GameConfig.HEAT.INITIAL_HEAT,
                maxHeat: GameConfig.HEAT.MAX_HEAT,
                heatDecay: GameConfig.HEAT.DECAY_RATE
            },
            flags: {
                vaultCracked: false,
                alarmTriggered: false,
                isGameOver: false,
                isVictory: false,
                primaryLootSecured: false,  // Triggers SIGNAL_EXFIL
                scram: false                // Triggers SIGNAL_SCRAM
            },
            simulation: {
                status: "PLANNING",
                plannedPath: [],
                currentNodeIndex: 0,
                log: [],
                runHistory: [], // Structured timeline for AAR
                plan: {}        // Plan: { crewId: [ { type, target, ... } ] }
            },
            crew: {
                activeStack: [],
                roster: [...ROSTER_POOL].map(c => ({
                    ...c,
                    equipment: [null, null] // 2 slots
                })), // Stores all hired crew
                limit: 12
            },
            inventory: [], // Stores bought items
            shop: {
                hires: [], // Daily recruits
                items: []  // Daily items
            },
            map: null,
            // Grid-based heist state (replaces window.* globals)
            grid: {
                tileMap: null,
                pathfinder: null,
                units: [],
                selectedUnit: null,
                phase: 'PLANNING',  // PLANNING | EXECUTING
                sectorManager: null,
                crewSpawns: [],
                gridRenderer: null
            }
        };
    }

    resetGame() {
        this.initGameState();
        window.dispatchEvent(new CustomEvent('gameReset'));
    }

    // ===== Grid State Accessors =====

    get tileMap() { return this.gameState.grid.tileMap; }
    set tileMap(value) { this.gameState.grid.tileMap = value; }

    get pathfinder() { return this.gameState.grid.pathfinder; }
    set pathfinder(value) { this.gameState.grid.pathfinder = value; }

    get units() { return this.gameState.grid.units; }
    set units(value) { this.gameState.grid.units = value; }

    get selectedUnit() { return this.gameState.grid.selectedUnit; }
    set selectedUnit(value) { this.gameState.grid.selectedUnit = value; }

    get heistPhase() { return this.gameState.grid.phase; }
    set heistPhase(value) { this.gameState.grid.phase = value; }

    get sectorManager() { return this.gameState.grid.sectorManager; }
    set sectorManager(value) { this.gameState.grid.sectorManager = value; }

    get crewSpawns() { return this.gameState.grid.crewSpawns; }
    set crewSpawns(value) { this.gameState.grid.crewSpawns = value; }

    get gridRenderer() { return this.gameState.grid.gridRenderer; }
    set gridRenderer(value) { this.gameState.grid.gridRenderer = value; }

    checkEndConditions() {
        if (this.gameState.resources.heat >= this.gameState.resources.maxHeat) {
            this.gameState.flags.isGameOver = true;
            return 'FAILURE';
        }
        if (this.gameState.meta.cash >= GameConfig.ECONOMY.VICTORY_CASH) {
            this.gameState.flags.isVictory = true;
            return 'VICTORY_CASH';
        }
        // Check days?
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
        // Notify UI immediately
        window.dispatchEvent(new CustomEvent('intelPurchased')); // Reusing event or make new one?
        window.dispatchEvent(new CustomEvent('cashUpdated', { detail: { cash: this.gameState.meta.cash } }));
    }

    spendCash(amount) {
        if (this.gameState.meta.cash >= amount) {
            this.gameState.meta.cash -= amount;
            window.dispatchEvent(new CustomEvent('cashUpdated', { detail: { cash: this.gameState.meta.cash } }));
            return true;
        }
        return false;
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

    startNextDay(newMap = null) {
        this.gameState.meta.currentDay++;
        this.gameState.meta.difficultyModifier++;

        this.gameState.map = newMap;
        if (!newMap) {
            this.gameState.simulation.status = "SELECTING_CONTRACT";
        } else {
            this.gameState.simulation.status = "PLANNING";
        }

        this.gameState.simulation.plannedPath = [];
        this.gameState.simulation.runHistory = [];
        this.gameState.flags.vaultCracked = false;
        this.gameState.flags.alarmTriggered = false;

        // Refresh Shop
        this.refreshShop();

        console.log(`Starting Day ${this.gameState.meta.currentDay}`);
    }

    refreshShop() {
        // Using imports from top of file
        const diff = this.gameState.meta.difficultyModifier;


        // Generate 3 Recruits
        this.gameState.shop.hires = [
            CrewGenerator.generateHire(diff),
            CrewGenerator.generateHire(diff),
            CrewGenerator.generateHire(diff)
        ];

        // Generate 3 Items
        this.gameState.shop.items = ItemSystem.getRandomShopItems(3);

        window.dispatchEvent(new CustomEvent('shopRefreshed'));
    }

    hireCrew(hire) {
        if (this.gameState.crew.roster.length >= this.gameState.crew.limit) return false;
        this.gameState.meta.cash -= hire.wage;
        this.gameState.crew.roster.push({
            ...hire,
            equipment: [null, null]
        });
        // Remove from hires list
        this.gameState.shop.hires = this.gameState.shop.hires.filter(h => h.id !== hire.id);

        this.events.emit('crew-updated', this.gameState.crew);
        return true;
    }

    buyItem(item) {
        if (this.gameState.meta.cash >= item.cost) {
            this.gameState.meta.cash -= item.cost;
            this.gameState.inventory.push(item);
            // Remove from shop list (unique items per day)
            this.gameState.shop.items = this.gameState.shop.items.filter(i => i.instanceId !== item.instanceId);

            this.events.emit('inventory-updated', this.gameState.inventory);
            return true;
        }
        return false;
    }

    equipItem(crewId, itemInstanceId, slotIndex) {
        const crew = this.gameState.crew.roster.find(c => c.id === crewId);
        const itemIndex = this.gameState.inventory.findIndex(i => i.instanceId === itemInstanceId);

        if (!crew || itemIndex === -1) return false;

        // Ensure slot index is valid and empty
        if (slotIndex === undefined || crew.equipment[slotIndex] !== null) return false;

        const item = this.gameState.inventory.splice(itemIndex, 1)[0];
        crew.equipment[slotIndex] = item;

        this.events.emit('crew-updated', this.gameState.crew);
        this.events.emit('inventory-updated', this.gameState.inventory);
        return true;
    }

    unequipItem(crewId, slotIndex) {
        const crew = this.gameState.crew.roster.find(c => c.id === crewId);
        if (!crew || !crew.equipment[slotIndex]) return false;

        const item = crew.equipment[slotIndex];
        crew.equipment[slotIndex] = null;
        this.gameState.inventory.push(item);

        this.events.emit('crew-updated', this.gameState.crew);
        this.events.emit('inventory-updated', this.gameState.inventory);
        return true;
    }

    loadContract(contract) {
        console.log("Loading Contract:", contract);
        const difficulty = this.gameState.meta.difficultyModifier;
        const viewportHeight = window.innerHeight; // safe-ish assumption for now?

        const newMap = MapGenerator.generateStaticLevel(difficulty, viewportHeight, contract.layoutType);
        this.gameState.map = newMap;
        this.gameState.meta.activeContract = contract;
        this.gameState.simulation.status = "PLANNING";

        // Dispatch event so UI updates (MapRenderer will see the map and render it)
        window.dispatchEvent(new CustomEvent('mapLoaded'));
    }

    logRunStep(stepData) {
        this.gameState.simulation.runHistory.push(stepData);
    }
}

const gameManager = new GameManager();
export default gameManager;
