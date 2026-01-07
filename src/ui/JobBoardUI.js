import GameManager from '../game/GameManager';
import { ContractGenerator } from '../game/ContractGenerator';

export class JobBoardUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId || 'game-map'); // We overlay on the map container
        this.element = null;
    }

    render() {
        if (GameManager.gameState.simulation.status !== 'SELECTING_CONTRACT') return;

        // Clean up existing
        if (this.element) this.element.remove();

        // Create Container
        this.element = document.createElement('div');
        this.element.id = 'job-board-overlay';
        this.element.innerHTML = `
            <div class="job-board-header">
                <h2>AVAILABLE CONTRACTS</h2>
                <p>Select your next target.</p>
            </div>
            <div class="contracts-container"></div>
        `;

        const contractsContainer = this.element.querySelector('.contracts-container');

        // Generate Contracts
        const diff = GameManager.gameState.meta.difficultyModifier;
        const contracts = ContractGenerator.generateDailyContracts(diff);

        contracts.forEach(contract => {
            // Build debug info from map data
            const mapData = contract.mapData || null;
            const building = mapData?.building || null;
            const isGenerated = !!mapData;

            let debugInfo = '';
            if (building) {
                const roomCount = building.rooms?.length || 0;
                const guardCount = building.guards?.length || 0;
                const cameraCount = building.cameras?.length || 0;
                const interactableCount = building.interactables?.length || 0;
                const hiddenZoneCount = building.hiddenZones?.length || 0;

                debugInfo = `
                    <div class="contract-debug">
                        <span class="debug-tag generated">GENERATED</span>
                        <div>Rooms: ${roomCount} | Guards: ${guardCount} | Cams: ${cameraCount}</div>
                        <div>Interactables: ${interactableCount} | Hidden Zones: ${hiddenZoneCount}</div>
                        <div>Size: ${building.width}x${building.height}</div>
                    </div>
                `;
            } else {
                debugInfo = `
                    <div class="contract-debug">
                        <span class="debug-tag static">STATIC</span>
                        <div>Map ID: ${contract.buildingId}</div>
                    </div>
                `;
            }

            const card = document.createElement('div');
            card.className = 'contract-card';
            card.innerHTML = `
                <div class="contract-type">${contract.layoutType}</div>
                <h3>${contract.name}</h3>
                <div class="contract-stats">
                    <span>DIFFICULTY: ${contract.difficulty}</span>
                    <span>REWARD: x${contract.rewardMult}</span>
                </div>
                <p class="contract-desc">${contract.description}</p>
                ${debugInfo}
                <button class="accept-contract-btn">ACCEPT CONTRACT</button>
            `;

            card.querySelector('button').addEventListener('click', () => {
                this.selectContract(contract);
            });

            contractsContainer.appendChild(card);
        });

        this.container.appendChild(this.element);
    }

    selectContract(contract) {
        GameManager.loadContract(contract);
        this.hide();
    }

    hide() {
        if (this.element) this.element.remove();
        this.element = null;
    }
}
