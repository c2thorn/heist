# Project CLOCKWORK - Feature Specification 003
**Title:** Command Queue & Crew AI Logic
**Version:** 1.0
**Status:** Approved for Implementation

---

## 1. Overview
This specification defines the "Programmable Agent" system. The Player does not control Crew Members directly; instead, they populate a **Task Queue**. The Crew Member processes this queue autonomously. This spec also covers the **Dependency System** (Logic Gates) and **Standard Operating Procedures (SOP)** for autonomous reactions to threats.

---

## 2. The Task Queue Architecture

Every Crew Member possesses a `TaskController`.

### 2.1 The Queue Data Structure
A FIFO (First-In-First-Out) array of `Task` objects.

// Task Schema
{
  "id": "task_12345",
  "type": "MOVE" | "INTERACT" | "WAIT" | "SIGNAL",
  "target": { "x": 10, "y": 15 }, // or EntityID
  "status": "PENDING" | "ACTIVE" | "COMPLETED" | "FAILED",
  
  // Logic Gate Properties
  "waitForSignal": "hack_camera_01_complete", // Nullable
  "emitSignal": "brick_in_position",          // Nullable
  
  // Interaction Properties (Only for INTERACT type)
  "interactionId": "door_vault_main",
  "actionType": "BREACH"
}

### 2.2 The Processing Loop
The `TaskController` runs on every simulation tick:

1.  **Safety Check:** Is the Unit currently in a "Reaction State" (e.g., Cowering from a Guard)? If yes, PAUSE Queue.
2.  **Fetch Task:** If `currentTask` is null, shift `nextTask` from `taskQueue`.
3.  **Dependency Check:**
    * If `currentTask.waitForSignal` is NOT null:
    * Check `GlobalSignalBus`. Is signal active?
    * If NO: Unit enters `IDLE_WAIT` state (Visual: "Waiting" icon).
    * If YES: Proceed.
4.  **Execution:**
    * **MOVE:** Pass target to Pathfinding Engine (SPEC_002).
    * **INTERACT:** Initiate Interaction Loop (See Section 3).
    * **SIGNAL:** Broadcast `emitSignal` to `GlobalSignalBus` immediately and mark task Complete.

---

## 3. Interaction & Resolution Loop

When a Unit arrives at an Interactive Object (Door, Terminal, Loot), they enter the Resolution Loop.

### 3.1 The Interaction State Machine
1.  **APPROACH:** Move to the defined "Access Point" tile of the object.
2.  **PREPARE:**
    * Check Requirement: Does Unit have `Tech > 0`?
    * Check Tool: Does Unit have `Drill`?
    * Calculate Duration: `BaseTime / (SkillMultiplier + ToolMultiplier)`.
3.  **WORK (Progress Bar):**
    * Unit freezes in place.
    * Progress bar fills over `Duration` seconds.
    * *Visual:* Animation loop (Typing/Drilling).
4.  **RESOLVE (The Dice Roll):**
    * Occurs at 100% progress.
    * Formula: `Roll = (RNG 1-100) + StatBonus`.
    * **Success:** Object state changes (Door Opens). Task Complete.
    * **Failure:** Trigger "Fumble" Logic (See SPEC_004).

---

## 4. The Dependency System (Logic Gates)

This allows complex "Sync" maneuvers without the player managing timelines manually.

### 4.1 The Signal Registry
A simple global dictionary in the Game Manager.
`activeSignals: { "string_id": timestamp }`

### 4.2 Gameplay Example: The "Breach & Clear"
* **Player Plan:**
    1.  **Zero (Hacker):** `[MOVE TO TERMINAL]` -> `[INTERACT: DISABLE CAMERAS]` -> `[SIGNAL: "cams_down"]`
    2.  **Brick (Muscle):** `[WAIT FOR: "cams_down"]` -> `[MOVE TO HALLWAY]`
* **Execution:**
    * Brick stands at the entry, smoking a cigarette (Idle).
    * Zero finishes the hack.
    * The system broadcasts `cams_down`.
    * Brick instantly triggers his Move task.

---

## 5. Standard Operating Procedures (SOP)

SOPs are the "AI Personality." They dictate how a unit reacts to **unplanned** threats (Guards) when the player does not intervene.

### 5.1 The Reaction Trigger
If a Unit enters `DETECTED` state (Spotted by Guard):
1.  **Interrupt:** The active Task is PAUSED.
2.  **Check SOP:** Look up the Unit's specific behavior profile.
3.  **Execute Reaction:** Override movement logic.

### 5.2 SOP Profiles

#### Profile A: "Professional" (Default)
* **Trigger:** Spotted.
* **Action:** `FREEZE`.
* **Logic:** Stop moving. Hope the Guard's suspicion meter decays. If Guard goes to ALERT, switch to `COWER`.

#### Profile B: "Coward / Non-Combatant" (e.g., The Face)
* **Trigger:** Spotted.
* **Action:** `FLEE`.
* **Logic:** Run away from the Guard vector to the nearest "Safe" (Fog of War) tile.
* **Risk:** High. Might run into more guards. Disrupts the plan significantly.

#### Profile C: "Psychopath" (e.g., The Brick)
* **Trigger:** Spotted.
* **Action:** `ENGAGE`.
* **Logic:** Pathfind directly to the Guard. Initiate `MELEE_TAKEDOWN`.
* **Risk:** Extremely High. Generates "Violence" noise. Increases Global Heat significantly.

### 5.3 Player Override (The Radio)
The Player can override an active SOP reaction using a Global Command (SPEC_004).
* *Example:* Brick is about to punch a guard (`ENGAGE`). Player hits `HOLD FAST` button. Brick cancels `ENGAGE` and switches to `FREEZE`.

---

## 6. Implementation Priorities
1.  **Task Processor:** Build the loop that pops tasks and logs "Executing Move to X,Y".
2.  **Wait Logic:** Implement the `waitForSignal` check and verify one unit waits for another.
3.  **Interaction Mockup:** A simple 3-second timer when a unit touches a "Loot" tile.