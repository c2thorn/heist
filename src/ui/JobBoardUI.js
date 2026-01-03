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
