# Custom Events Catalog

Reference for all `window.dispatchEvent(CustomEvent)` events in the codebase.

## Game Flow Events

| Event | Dispatched From | Listened By | Purpose |
|-------|-----------------|-------------|---------|
| `nextDayStarted` | `renderer.js` (heistSummaryClosed) | `renderer.js`, `CommandCenterUI.js` | Transition to next day |
| `startHeist` | `index.html` (execute button) | `renderer.js`, `index.html` | Begin heist execution |
| `heistComplete` | `outcomeEngine` | `HeistSummaryUI.js` | Heist ended, show summary |
| `heistSummaryClosed` | `HeistSummaryUI.js` | `renderer.js` | Player closed summary, proceed |
| `mapLoaded` | `JobBoardUI.js` | `renderer.js` | Contract selected, load map |

## Resource Events

| Event | Dispatched From | Listened By | Purpose |
|-------|-----------------|-------------|---------|
| `resourcesChanged` | `ShopManager.js` | `renderer.js` | Cash/intel changed (hire/buy) |
| `intelPurchased` | `ShopManager.js`, `GameManager.js` | `renderer.js` | Intel specifically purchased |
| `heatLaundered` | `ShopManager.js` | `renderer.js` | Heat reduced via launder |
| `heatChanged` | Various | `renderer.js` | Heat value changed |
| `shopRefreshed` | `GameManager.js` | `ShopManager.js` | Shop inventory updated |

## Gameplay Events

| Event | Dispatched From | Listened By | Purpose |
|-------|-----------------|-------------|---------|
| `heistEventLog` | Task processors | `index.html`, `renderer.js` | Log entry for event display |
| `tileClicked` | `GridRenderer.js` | `renderer.js` | Player clicked map tile |
| `unitClicked` | `GridRenderer.js` | `renderer.js` | Player clicked unit |
| `interactableClicked` | `GridRenderer.js` | `renderer.js` | Player clicked interactable |

## Sector/Intel Events

| Event | Dispatched From | Listened By | Purpose |
|-------|-----------------|-------------|---------|
| `sectorRevealed` | `SectorManager.js` | `SetupPhaseUI.js` | Intel spent to reveal sector |
| `arrangementPurchased` | `ArrangementEngine.js` | `SetupPhaseUI.js` | Support asset purchased |

## UI Events

| Event | Dispatched From | Listened By | Purpose |
|-------|-----------------|-------------|---------|
| `assetHover` | `SetupPhaseUI.js` | `GridRenderer.js` | Hover over asset card |
| `crew-updated` | `GameManager.events` | `renderer.js` | Crew roster changed |

---

## Notes

- Most events use `window.dispatchEvent` for cross-module communication
- `GameManager.events` (EventEmitter pattern) used for internal game state events
- Consider migrating to unified event bus in future refactor
