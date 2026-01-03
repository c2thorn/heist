# Project CLOCKWORK - Feature Specification 005
**Title:** Intel & Arrangements (The Setup Phase)
**Version:** 1.0
**Status:** Approved for Implementation

---

## 1. Overview
This specification defines the pre-simulation gameplay loop. Before "Planning" (Queueing tasks), the player enters the **Setup Phase**. Here, they spend **Intel Points** to reveal the map and **Cash** to purchase "Arrangements" (Assets) that modify the level's logic or provide active abilities during the heist.

---

## 2. The Intel Economy (Reconnaissance)

Intel is a persistent resource managed by the `GameManager`.

### 2.1 The Fog of War (FOW) Layer
* **Default State:** All Map Tiles are `HIDDEN`. The player sees a blueprint grid but no walls, doors, or guards.
* **Sectors:** The map is divided into logical "Sectors" (e.g., "Lobby", "Vault Access", "Manager's Office").
* **Buying Intel:**
    * Player clicks a HIDDEN Sector.
    * Cost: `SectorDifficulty * BaseIntelCost`.
    * Effect: All Tiles in that Sector become `REVEALED` (Walls/Static Objects visible).
    * **Note:** Guards are NOT revealed by default (requires specific "Insider Info" Arrangement).

### 2.2 Critical Info
Revealing a sector does not just show walls; it exposes **Opportunity Nodes**.
* *Example:* You cannot bribe a guard you cannot see. You must buy the Intel for the "Lobby" sector to see the Guard, *then* you can click the Guard to buy the "Bribe" Arrangement.

---

## 3. The Arrangements System (Data Structure)

"Arrangements" (referenced in code as `Assets`) are modifiers applied to the Map or Game State.

### 3.1 Arrangement Schema
```json
{
  "id": "arr_bribe_guard_01",
  "name": "Bribe Guard",
  "type": "STATIC_MODIFIER" | "TRIGGERED_ABILITY" | "PLACED_ITEM",
  "cost": 500,           // Cash Cost
  "reqIntel": true,      // Must reveal sector first?
  "targetEntityId": "guard_lobby_01",
  "payload": { ... }     // Specific logic data
}