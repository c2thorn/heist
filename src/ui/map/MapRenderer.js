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
        window.addEventListener('mapLoaded', () => this.generateAndRender()); // FIX: Listen for contract load
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

        // If no map (Job Board mode), clear and return
        if (!mapData) {
            this.nodesLayer.innerHTML = '';
            this.svgLayer.innerHTML = '';
            this.nodeElements.clear();
            this.edgeElements.clear();
            this.hideCrewToken();
            return;
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

        // Loot Indicator
        let lootIndicator = "";
        // Show loot if revealed, OR if it's the Vault (Objective is known)
        if ((!isHidden || node.type === 'VAULT') && node.properties?.hasLoot) {
            lootIndicator = `<div class="loot-marker">💰</div>`;
        }

        let statDisplay = "";
        if (!isHidden && node.properties && node.properties.statCheck) {
            statDisplay = `<div class="node-stat">${node.properties.statCheck} ${node.properties.difficulty}</div>`;
        }

        el.innerHTML = `
            <div class="node-content">
                <div class="node-icon">${iconChar}</div>
                ${lootIndicator}
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
        // We will rebuild the inner content entirely for the AAR

        if (screen) {
            screen.style.display = 'flex';

            // 1. Gather Data
            const history = GameManager.gameState.simulation.runHistory;
            const totalLoot = history.reduce((acc, step) => acc + (step.lootGained || 0), 0);
            const totalHeat = GameManager.gameState.resources.heat;
            const isRunOver = GameManager.gameState.flags.isGameOver || GameManager.gameState.flags.isVictory;

            // 2. Build Timeline HTML
            let timelineHTML = history.map((step, index) => {
                const isFail = step.outcome !== 'SUCCESS';
                const statusColor = isFail ? '#ff4444' : '#00ffaa';
                const lootText = step.lootGained > 0 ? `<span class="step-loot">+$${step.lootGained}</span>` : '';
                const heatText = step.heatAdded > 0 ? `<span class="step-heat">+${step.heatAdded}% Heat</span>` : '';

                return `
                    <div class="aar-step">
                        <div class="step-time">Leg ${index + 1}</div>
                        <div class="step-info">
                            <div class="step-name">${step.nodeName} <span class="step-type">[${step.nodeType}]</span></div>
                            <div class="step-result" style="color: ${statusColor}">
                                ${step.outcome} (${step.details})
                            </div>
                        </div>
                        <div class="step-rewards">
                            ${lootText}
                            ${heatText}
                        </div>
                    </div>
                `;
            }).join('');

            // 3. Status Header
            const headerColor = isSuccess ? "#00ffaa" : "#ff4444";
            const headerText = isSuccess ? "HEIST SUCCESSFUL" : "MISSION FAILED";
            const btnText = isRunOver ? "NEW RUN" : "GO TO SAFEHOUSE";

            // 4. Render Full Overlay
            screen.innerHTML = `
                <div class="aar-container">
                    <h1 style="color: ${headerColor}">${headerText}</h1>
                    <div class="aar-summary">
                        <div class="aar-stat">LOOT SECURED: <span style="color: #ffd700">$${totalLoot}</span></div>
                        <div class="aar-stat">FINAL HEAT: <span style="color: ${totalHeat > 80 ? '#f00' : '#fff'}">${totalHeat}%</span></div>
                    </div>
                    
                    <div class="aar-timeline">
                        ${timelineHTML}
                    </div>

                    <button id="aar-action-btn" class="aar-btn">${btnText}</button>
                </div>
            `;

            // 5. Attach Listener to New Button
            const newBtn = document.getElementById('aar-action-btn');
            newBtn.addEventListener('click', () => {
                screen.style.display = 'none';
                if (isRunOver) {
                    GameManager.resetGame();
                    this.generateAndRender();
                } else {
                    import('../ShopManager').then(({ shopManager }) => {
                        shopManager.startDay();
                        window.dispatchEvent(new CustomEvent('openShop'));
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
