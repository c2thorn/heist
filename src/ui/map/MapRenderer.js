import GameManager from '../../game/GameManager';
import { MapGenerator } from '../../game/MapGenerator';
import { SimulationEngine } from '../../game/SimulationEngine';

export class MapRenderer {
    constructor() {
        this.container = document.getElementById('game-map');
        this.svgLayer = document.getElementById('map-connections');
        this.nodesLayer = document.getElementById('map-nodes');
        this.crewToken = document.getElementById('crew-token');
        this.nodeElements = new Map(); // id -> HTMLElement
        this.edgeElements = new Map(); // "from_id-to_id" -> SVGElement
    }

    init() {
        console.log("MapRenderer Initialized");

        // Global Event Listeners
        window.addEventListener('nextDayStarted', () => this.generateAndRender());
        window.addEventListener('startHeist', () => this.handleStartHeist());
        window.addEventListener('gameStateUpdated', () => this.updatePathVisuals());
        window.addEventListener('intelPurchased', () => this.refreshAllNodes());

        // Initial Render
        this.generateAndRender();
    }

    generateAndRender() {
        // Clear Log
        const logArea = document.getElementById('event-log');
        if (logArea) logArea.innerHTML = '';

        let mapData = GameManager.gameState.map;
        if (!mapData) {
            mapData = MapGenerator.generateStaticLevel(0, window.innerHeight);
            GameManager.gameState.map = mapData;
        }
        this.renderMap(mapData);
        this.hideCrewToken();
    }

    renderMap(mapData) {
        // Clear previous
        this.nodesLayer.innerHTML = '';
        this.svgLayer.innerHTML = '';
        this.nodeElements.clear();
        this.edgeElements.clear();

        // 1. Draw Edges (SVG)
        mapData.edges.forEach(edge => {
            const fromNode = mapData.nodes.find(n => n.id === edge.from);
            const toNode = mapData.nodes.find(n => n.id === edge.to);
            if (fromNode && toNode) {
                this.drawEdge(fromNode, toNode);
            }
        });

        // 2. Draw Nodes (HTML)
        mapData.nodes.forEach(node => {
            this.createNodeElement(node);
        });

        // 3. Initial Visual Update
        this.updateUI();
    }

    drawEdge(nodeA, nodeB) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", nodeA.x);
        line.setAttribute("y1", nodeA.y);
        line.setAttribute("x2", nodeB.x);
        line.setAttribute("y2", nodeB.y);
        line.setAttribute("class", "connection-line");

        this.svgLayer.appendChild(line);
        this.edgeElements.set(`${nodeA.id}-${nodeB.id}`, line);
    }

    createNodeElement(node) {
        const el = document.createElement('div');
        // Add statCheck to classes for coloring
        const statType = (node.properties?.statCheck || 'NONE').toUpperCase();
        el.className = `map-node ${node.status.toLowerCase()} ${node.type.toLowerCase()} ${statType}`;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        el.dataset.id = node.id;

        // Content
        const isHidden = node.status === 'HIDDEN';

        let label = node.name;
        // Icons
        let iconChar = "";
        if (!isHidden) {
            // Simple logic for now, can be expanded to specific name matching
            if (statType === 'FORCE') iconChar = "⚔️";
            else if (statType === 'TECH') iconChar = "💻";
            else if (statType === 'STEALTH') iconChar = "👁️";
            else if (statType === 'FACE') iconChar = "💬";
            else if (node.type === 'ENTRY') iconChar = "🚪";
            else if (node.type === 'EXIT') iconChar = "🏁";
            else if (node.type === 'VAULT') iconChar = "💎";
        }

        if (isHidden) {
            label = "???";
            iconChar = "❓";
        }

        let statDisplay = "";
        if (!isHidden && node.properties && node.properties.statCheck) {
            statDisplay = `<div class="node-stat">${node.properties.statCheck} ${node.properties.difficulty}</div>`;
        }

        el.innerHTML = `
            <div class="node-content">
                <div class="node-icon">${iconChar}</div>
            </div>
            <div class="node-label">${label}</div>
            ${statDisplay}
        `;

        // Interaction
        el.onclick = (e) => {
            // Handle Left Click
            if (e.button === 0) this.handleNodeClick(node.id);
        };

        // Right click for scouting?
        el.oncontextmenu = (e) => {
            e.preventDefault();
            this.handleScout(node.id);
        };

        this.nodesLayer.appendChild(el);
        this.nodeElements.set(node.id, el);
    }

    handleNodeClick(nodeId) {
        if (SimulationEngine.isRunning) return;
        const success = GameManager.addToPath(nodeId);
        if (success) {
            this.updatePathVisuals();
            this.updateUI();
        }
    }

    handleScout(nodeId) {
        if (SimulationEngine.isRunning) return;
        const success = GameManager.scoutNode(nodeId);
        if (success) {
            this.refreshNode(nodeId);
            window.dispatchEvent(new CustomEvent('intelPurchased'));
        }
    }

    refreshNode(nodeId) {
        const node = GameManager.gameState.map.nodes.find(n => n.id === nodeId);
        const el = this.nodeElements.get(nodeId);
        if (node && el) {
            // Update classes
            const statType = (node.properties?.statCheck || 'NONE').toUpperCase();
            el.className = `map-node ${node.status.toLowerCase()} ${node.type.toLowerCase()} ${statType}`;

            // Content Logic (Duplicated from createNodeElement for now)
            const isHidden = node.status === 'HIDDEN';

            let label = node.name;
            let iconChar = "";
            if (!isHidden) {
                if (statType === 'FORCE') iconChar = "⚔️";
                else if (statType === 'TECH') iconChar = "💻";
                else if (statType === 'STEALTH') iconChar = "👁️";
                else if (statType === 'FACE') iconChar = "💬";
                else if (node.type === 'ENTRY') iconChar = "🚪";
                else if (node.type === 'EXIT') iconChar = "🏁";
                else if (node.type === 'VAULT') iconChar = "💎";
            }

            if (isHidden) {
                label = "???";
                iconChar = "❓";
            }

            let statDisplay = "";
            if (!isHidden && node.properties && node.properties.statCheck) {
                statDisplay = `<div class="node-stat">${node.properties.statCheck} ${node.properties.difficulty}</div>`;
            }

            el.innerHTML = `
                <div class="node-content">
                    <div class="node-icon">${iconChar}</div>
                </div>
                <div class="node-label">${label}</div>
                ${statDisplay}
            `;
            // Re-apply path highlight if needed
            this.updatePathVisuals();
        }
    }

    refreshAllNodes() {
        GameManager.gameState.map.nodes.forEach(n => this.refreshNode(n.id));
    }

    updatePathVisuals() {
        const path = GameManager.getPath();

        // 1. Reset all edges
        this.edgeElements.forEach(line => line.classList.remove('active'));

        // 2. Highlight Edges in Path
        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];
            // Check both directions
            let line = this.edgeElements.get(`${from}-${to}`);
            if (!line) line = this.edgeElements.get(`${to}-${from}`);

            if (line) {
                line.classList.add('active');
                // Ensure active lines are on top
                this.svgLayer.appendChild(line);
            }
        }

        // 3. Highlight Nodes
        this.nodeElements.forEach((el, id) => {
            if (path.includes(id)) {
                el.classList.add('in-path');
            } else {
                el.classList.remove('in-path');
            }
        });
    }

    handleStartHeist() {
        if (SimulationEngine.isRunning) return;
        const plannedPath = GameManager.getPath();
        const activeCrew = GameManager.gameState.crew.activeStack;

        // Visual Reset
        document.getElementById('event-log').innerHTML = '';

        // We pass 'this' as the visualInterface. 
        SimulationEngine.runHeist(plannedPath, activeCrew, this);
    }

    // --- INTERFACE FOR SIMULATION ENGINE ---

    initStackVisible(x, y) {
        this.crewToken.style.left = `${x}px`;
        this.crewToken.style.top = `${y}px`;
        this.crewToken.classList.remove('hidden');
    }

    async moveStackVisual(node) {
        return new Promise(resolve => {
            this.crewToken.style.left = `${node.x}px`;
            this.crewToken.style.top = `${node.y}px`;

            // Wait for CSS transition
            setTimeout(resolve, 600);
        });
    }

    showEncounterResult(nodeId, result, currentHeat) {
        const el = this.nodeElements.get(nodeId);
        // Pulse effect
        if (el) {
            el.style.transform = "translate(-35px, -35px) scale(1.5)";
            setTimeout(() => {
                el.style.transform = "translate(-35px, -35px) scale(1.0)";
            }, 300);

            // Floating text (DOM)
            this.showFloatingText(nodeId, result);
        }

        // Update Heat Bar
        const fill = document.getElementById('heat-bar-fill');
        const label = document.getElementById('heat-label');
        if (fill) {
            fill.style.width = `${currentHeat}%`;
            if (currentHeat >= 80) fill.classList.add('danger');
            if (label) label.innerText = `SYSTEM HEAT: ${currentHeat}%`;
        }
    }

    showFloatingText(nodeId, result) {
        const node = GameManager.gameState.map.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const floatEl = document.createElement('div');
        floatEl.innerText = `${result.statName}: ${result.crewValue} vs ${result.difficulty}`;
        floatEl.style.position = 'absolute';
        floatEl.style.left = `${node.x}px`;
        floatEl.style.top = `${node.y - 40}px`;
        floatEl.style.color = result.outcome === 'SUCCESS' ? '#0f0' : '#f00';
        floatEl.style.fontWeight = 'bold';
        floatEl.style.fontSize = '16px';
        floatEl.style.textShadow = '0 0 5px #000';
        floatEl.style.pointerEvents = 'none';
        floatEl.style.transition = 'all 1s ease-out';
        floatEl.style.zIndex = '1000';

        this.nodesLayer.appendChild(floatEl);

        // Animate up
        setTimeout(() => {
            floatEl.style.top = `${node.y - 100}px`;
            floatEl.style.opacity = '0';
        }, 50);

        setTimeout(() => floatEl.remove(), 1000);
    }

    showGameOver(isSuccess, msg) {
        const screen = document.getElementById('game-results-screen');
        const title = document.getElementById('results-title');
        const msgEl = document.getElementById('results-msg');
        const btn = document.getElementById('results-btn');

        if (screen && title && msgEl && btn) {
            screen.style.display = 'flex';
            title.innerText = isSuccess ? "HEIST SUCCESSFUL" : "MISSION FAILED";
            title.style.color = isSuccess ? "#0f0" : "#f00";

            // Fix: Provide default message
            const defaultMsg = isSuccess ? "The crew slipped away with the score." : "The alarm was triggered. You were compromised.";
            msgEl.innerText = msg || defaultMsg;

            // Handle Button Logic
            const isRunOver = GameManager.gameState.flags.isGameOver || GameManager.gameState.flags.isVictory;
            btn.innerText = isRunOver ? "NEW RUN" : "GO TO SAFEHOUSE";

            // Clear old listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', () => {
                screen.style.display = 'none';
                if (isRunOver) {
                    GameManager.resetGame();
                    // Reload map
                    this.generateAndRender();
                } else {
                    // Auto-Advance to Next Day Logic
                    import('../ShopManager').then(({ shopManager }) => {
                        shopManager.startDay(); // Generate new map & difficulty
                        window.dispatchEvent(new CustomEvent('openShop')); // Go to Base
                    });
                }
            });
        }
    }

    hideCrewToken() {
        this.crewToken.classList.add('hidden');
    }

    updateUI() {
        const plannedPath = GameManager.getPath();
        const nodes = GameManager.gameState.map.nodes;
        let isCompletable = false;
        if (plannedPath.length > 0) {
            const lastNode = nodes.find(n => n.id === plannedPath[plannedPath.length - 1]);
            if (lastNode && lastNode.type === 'EXIT') isCompletable = true;
        }
        window.dispatchEvent(new CustomEvent('gameStateUpdated', { detail: { isCompletable, pathLength: plannedPath.length } }));
    }
}
