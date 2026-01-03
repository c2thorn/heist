# Project CLOCKWORK - Feature Specification 004
**Title:** Economy: Time, Heat & The Radio
**Version:** 1.0
**Status:** Approved for Implementation

---

## 1. Overview
This specification redefines the game's economy. "Cash" is the score, but **Time** is the currency spent to get it. "Heat" is not a resource to be managed, but a dynamic difficulty curve that escalates as Time passes. This spec also defines the Player's primary agency tool during execution: The Radio.

---

## 2. The Timeline (Global Clock)

The heist does not have a turn limit; it has a "Point of No Return."

### 2.1 The Time Bar
A global counter `elapsedTime` (Float, Seconds) runs continuously.
* **Visual:** A progress bar at the top of the HUD.
* **Markers:** The bar is divided into four distinct **Threat Zones**.

### 2.2 Threat Zones & Escalation
As `elapsedTime` passes thresholds, the `GlobalThreatLevel` increases.

| Zone | Time Start | Visual Ambience | Gameplay Modifiers |
|------|------------|-----------------|--------------------|
| **1. CASUAL** | 0s | Calm, elevator music. | Guards Walk. Vision Cone 60°. Detection Rate 1.0x. |
| **2. ALERT** | 60s (Configurable) | Music picks up tempo. | Guards Walk Fast. Vision Cone 90°. Detection Rate 1.5x. Stationary guards begin short patrols. |
| **3. LOCKDOWN**| 120s | Siren blaring. Red lights. | Guards Run. Vision Cone 120°. Detection Rate 2.0x. Extra reinforcements spawn at Entry points. |
| **4. SWAT** | 180s | Chaos. | Infinite SWAT waves. Escape zones may become compromised. |

### 2.3 The "Time Penalty" Mechanics
Certain actions artificially advance the Global Clock (adding "Virtual Time") or pause the clock for specific actors.
* **Waiting:** If Unit A waits for Unit B, they are burning Real Time.
* **Fumbles:** (See Section 3) Add Virtual Time to the specific Unit's interactions.

---

## 3. The Skill Check System (Risk vs. Time)

We remove "Instant Failure" in favor of "Complications." A bad dice roll doesn't end the run; it complicates the timeline.

### 3.1 Resolution Formula
When a Unit completes an interaction bar (e.g., Picking Lock):
1.  **Calculate Margin:** `Delta = Skill - Difficulty + RNG`.
2.  **Outcome Table:**
    * **CRITICAL SUCCESS:** Instant Open. -5s to Global Alarm (Quiet).
    * **SUCCESS:** Open. Normal Time.
    * **FUMBLE (Failure):** The door does *not* open yet.
        * **Consequence:** The Unit enters a `RETRY` state.
        * **Duration:** `BaseDuration * 0.5`.
        * **Logic:** The Unit is stuck there for longer. This delays their queue.
    * **CRITICAL FAILURE:** The interaction succeeds, BUT generates a **NOISE EVENT**.
        * *Flavor:* "I broke the lock, but it was loud!"
        * *Logic:* Door opens, but nearest Guard investigates.

---

## 4. The Radio (Player Agency)

The Player cannot control movement, but they act as the "Dispatcher" via the Radio Console.

### 4.1 Global Commands (Stance Switching)
These are toggle buttons that broadcast a state change to **ALL** Crew Members.

1.  **SILENT RUNNING (Default)**
    * *Movement:* Units prioritize `SNEAK` speed.
    * *Pathfinding:* Units strictly avoid Vision Cones (even if it means a long detour).
    * *SOP:* "Coward" / Hide on sight.
2.  **GO LOUD (Rush)**
    * *Movement:* Units use `RUN` speed.
    * *Pathfinding:* Shortest path, ignoring cameras/guards.
    * *SOP:* "Engage" / Takedown on sight.
3.  **SCRAM (Abort)**
    * *Logic:* Clear all Task Queues.
    * *New Task:* `[MOVE TO EXIT]` (Nearest available extraction zone).
    * *Stance:* RUN.

### 4.2 Asset Triggers (The "Arrangements")
If the player placed Active Assets (SPEC_005) during prep, they appear as buttons on the Radio.
* **Button:** "Trigger Phone Distraction" (Uses: 1).
* **Action:** When clicked, executes the Asset's payload immediately.

### 4.3 The "Ping" (Unit Override)
The Player can click a specific Crew Member to issue a "Radio Override."
* **Interaction:** Click Unit -> Select "Override".
* **Effect:** Pushes a high-priority Task to the front of their queue.
    * *Example:* "Wait Here" (Pauses them).
    * *Example:* "Force Interact" (Make them use a tool they normally wouldn't).
* **Cost:** Uses `Command Points` (Limited resource per heist) to prevent micro-management spam.

---

## 5. Loot & Extraction logic

### 5.1 Loot Weight
Loot is not just a number; it slows you down.
* **Bag System:** Each Crew Member has `CarryCapacity` (e.g., 2 Bags).
* **Encumbrance:**
    * 0 Bags: 100% Speed.
    * 1 Bag: 90% Speed.
    * 2 Bags: 75% Speed.
* **Strategic Choice:** Do you grab the heavy gold bars (High Value, Slow Speed) or the diamonds (Med Value, Fast Speed)? Slowing down risks hitting the "Lockdown" Zone.

### 5.2 Banking
* Units must reach the `EXTRACTION_ZONE` tile to "Secure" loot.
* If a Unit is "Downed" or "Arrested" before reaching the zone, their loot is lost.

---

## 6. Implementation Priorities
1.  **Global Clock:** A timer loop that increments and updates a "Threat Level" integer.
2.  **Zone Mutators:** Logic that checks `ThreatLevel` and modifies Guard Speed variables.
3.  **Fumble Loop:** Modify the Interaction Resolution (SPEC_003) to support the `RETRY` outcome.