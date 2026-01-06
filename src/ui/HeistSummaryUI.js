/**
 * HeistSummaryUI - End-of-heist debrief screen
 * Shows outcome tier, loot breakdown, crew status, and heat change
 */
export class HeistSummaryUI {
    constructor() {
        this.container = null;
        this.isVisible = false;

        // Listen for heist complete event
        window.addEventListener('heistComplete', (e) => {
            this.show(e.detail);
        });
    }

    /**
     * Create the UI container if it doesn't exist
     */
    _createContainer() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'heist-summary';
        this.container.className = 'heist-summary-overlay';
        this.container.innerHTML = `
            <div class="heist-summary-panel">
                <div class="summary-header">
                    <h1 class="outcome-tier"></h1>
                    <p class="outcome-subtitle"></p>
                </div>
                
                <div class="summary-body">
                    <div class="summary-section loot-section">
                        <h3>💰 Loot Extracted</h3>
                        <ul class="loot-list"></ul>
                        <div class="loot-total"></div>
                    </div>
                    
                    <div class="summary-section crew-section">
                        <h3>👥 Crew Status</h3>
                        <div class="crew-escaped"></div>
                        <div class="crew-captured"></div>
                    </div>
                    
                    <div class="summary-section heat-section">
                        <h3>🔥 Heat Change</h3>
                        <div class="heat-change"></div>
                    </div>
                </div>
                
                <div class="summary-footer">
                    <button class="summary-continue-btn">Continue</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        // Bind continue button
        this.container.querySelector('.summary-continue-btn').addEventListener('click', () => {
            this.hide();
        });
    }

    /**
     * Show the summary screen with outcome data
     * @param {Object} outcome - Outcome data from HeistOutcomeEngine
     */
    show(outcome) {
        this._createContainer();
        this._populateData(outcome);
        this.container.style.display = 'flex';
        this.isVisible = true;
    }

    /**
     * Hide the summary screen
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.isVisible = false;

        // Dispatch event to continue game flow
        window.dispatchEvent(new CustomEvent('heistSummaryClosed'));
    }

    /**
     * Populate the UI with outcome data
     */
    _populateData(outcome) {
        // Outcome tier display
        const tierEl = this.container.querySelector('.outcome-tier');
        const subtitleEl = this.container.querySelector('.outcome-subtitle');

        const tierConfig = this._getTierConfig(outcome.tier);
        tierEl.textContent = tierConfig.title;
        tierEl.style.color = tierConfig.color;
        subtitleEl.textContent = tierConfig.subtitle;

        // Loot list
        const lootList = this.container.querySelector('.loot-list');
        lootList.innerHTML = '';

        if (outcome.extractedLoot && outcome.extractedLoot.length > 0) {
            for (const loot of outcome.extractedLoot) {
                const li = document.createElement('li');
                li.className = loot.isScore ? 'score-loot' : 'side-loot';
                li.innerHTML = `
                    <span class="loot-name">${loot.isScore ? '⭐ ' : ''}${loot.name}</span>
                    <span class="loot-value">$${loot.value.toLocaleString()}</span>
                `;
                lootList.appendChild(li);
            }
        } else {
            lootList.innerHTML = '<li class="no-loot">No loot extracted</li>';
        }

        // Loot total
        const lootTotal = this.container.querySelector('.loot-total');
        lootTotal.innerHTML = `<strong>Total: $${outcome.payout.toLocaleString()}</strong>`;
        lootTotal.className = outcome.payout > 0 ? 'loot-total positive' : 'loot-total zero';

        // Crew status
        const escapedEl = this.container.querySelector('.crew-escaped');
        const capturedEl = this.container.querySelector('.crew-captured');

        escapedEl.innerHTML = `✅ Escaped: ${outcome.escapedCrew?.length || 0}`;
        escapedEl.className = 'crew-escaped';

        if (outcome.capturedCrew && outcome.capturedCrew.length > 0) {
            capturedEl.innerHTML = `❌ Captured: ${outcome.capturedCrew.length} <span class="captured-names">(${outcome.capturedCrew.join(', ')})</span>`;
            capturedEl.className = 'crew-captured danger';
        } else {
            capturedEl.innerHTML = '❌ Captured: 0';
            capturedEl.className = 'crew-captured';
        }

        // Heat change
        const heatEl = this.container.querySelector('.heat-change');
        const heatValue = outcome.heat || 0;
        if (heatValue < 0) {
            heatEl.innerHTML = `<span class="heat-decrease">▼ ${heatValue} Heat</span>`;
        } else if (heatValue > 0) {
            heatEl.innerHTML = `<span class="heat-increase">▲ +${heatValue} Heat</span>`;
        } else {
            heatEl.innerHTML = `<span class="heat-neutral">— No change</span>`;
        }
    }

    /**
     * Get display config for outcome tier
     */
    _getTierConfig(tier) {
        const configs = {
            'PERFECT_SCORE': {
                title: '🏆 PERFECT SCORE',
                subtitle: 'Flawless execution. The Mastermind delivers.',
                color: '#ffd700'
            },
            'CLEAN_SWEEP': {
                title: '✨ CLEAN SWEEP',
                subtitle: 'The Score secured. No one left behind.',
                color: '#22c55e'
            },
            'PROFESSIONAL': {
                title: '💼 PROFESSIONAL',
                subtitle: 'Got the Score, but at a cost.',
                color: '#3b82f6'
            },
            'SALVAGE': {
                title: '📦 SALVAGE',
                subtitle: 'Missed the Score. Better luck next time.',
                color: '#f97316'
            },
            'BUST': {
                title: '💨 BUST',
                subtitle: 'Nothing to show for it.',
                color: '#ef4444'
            },
            'DISASTER': {
                title: '💀 DISASTER',
                subtitle: 'Everyone captured. The heat is on.',
                color: '#dc2626'
            }
        };

        return configs[tier] || {
            title: tier,
            subtitle: '',
            color: '#ffffff'
        };
    }
}

// Create singleton instance
export const heistSummaryUI = new HeistSummaryUI();
