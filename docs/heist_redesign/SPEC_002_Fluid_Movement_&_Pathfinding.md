# Project CLOCKWORK - Feature Specification 002
**Title:** Fluid Movement, Physics & Vision
**Version:** 1.0
**Status:** Approved for Implementation

---

## 1. Overview
This specification details the "Simulation Loop" that drives character behavior. It bridges the gap between the discrete Logic Grid (defined in SPEC_001) and the visual renderer. It also defines the mathematical rules for Stealth (Vision Cones) and Collision.

---

## 2. The Movement Engine (Vector Interpolation)

To achieve "fluidity," we decouple the Logical Position from the Visual Position.

### 2.1 Unit Position State
Each Unit (Crew or Guard) maintains two coordinate sets:
1.  `gridPos: {x, y}` (Integer) - The tile they currently "own" logically.
2.  `worldPos: {x, y}` (Float) - The exact pixel coordinate for rendering.

### 2.2 Movement Logic Loop
The `update(deltaTime)` function handles movement along a path.

**The Algorithm:**
1.  **Target Acquisition:** Unit looks at `pathQueue[0]` (Next Tile).
2.  **Vector Calculation:** Calculate normalized direction vector `D` from `worldPos` to `TargetTileCenter`.
3.  **Displacement:** `worldPos += D * moveSpeed * deltaTime`.
4.  **Arrival Check:**
    * Calculate distance to `TargetTileCenter`.
    * If `distance < SNAP_THRESHOLD` (e.g., 2 pixels):
        * Snap `worldPos` to `TargetTileCenter`.
        * Update `gridPos` to New Tile.
        * Shift `pathQueue` to get next target.

### 2.3 Smoothing (Corner Cutting)
To prevent robotic 90-degree turns:
* **Beziers?** No, too complex for now.
* **Technique:** "Waypoint Tolerance."
* **Logic:** When the unit is within `10px` of the current target node, and there is a *subsequent* node in the queue, begin interpolating towards the *subsequent* node immediately. This creates a natural arc around corners.

---

## 3. Collision & Flow (The "Dance")

Since we use a grid, we must prevent unit stacking (two units on one tile) while maintaining flow.

### 3.1 Tile Reservation System
We use a "Look-Ahead" reservation system to handle traffic.

1.  **The Reserve:** Before a unit starts moving to `Tile B`, it attempts to place a `reservationID` on `Tile B`.
2.  **The Check:**
    * If `Tile B` is empty: Grant reservation. Unit moves.
    * If `Tile B` is occupied OR reserved by another: **WAIT**.
3.  **The "Yield" Logic:**
    * If Unit A is waiting for Unit B, and Unit B is stationary (e.g., performing a task), Unit A enters `REPATH` state to find a path around Unit B.

### 3.2 Dynamic Avoidance (Fluidity)
* **Visual Only:** If two units pass in adjacent halls, the renderer nudges their sprite `offsets` slightly away from each other.
* **Logic:** The logical grid remains absolute (1 unit per tile), but the visual layer fakes "squeezing past."

---

## 4. Stealth & Vision Math

This is the core "Roguelike Risk" mechanic. Vision is calculated every `TICK` (e.g., 100ms), not every frame.

### 4.1 The Vision Cone
Every Guard has a `VisionComponent`.
* `origin`: {x, y} (Unit's worldPos)
* `facingAngle`: Float (Radians)
* `fov`: Float (Degrees, e.g., 90°)
* `range`: Float (Pixels, e.g., 300px)

### 4.2 The Check (Is Player Visible?)
A 3-step check to determine visibility.

**Step 1: Distance Check**
* `dist = distance(Guard, Crew)`
* If `dist > range`, return `FALSE`.

**Step 2: Angle Check**
* Calculate angle to Crew.
* If `angle` is outside `(facingAngle ± fov/2)`, return `FALSE`.

**Step 3: Raycast (Line of Sight)**
* Trace a line from Guard Center to Crew Center.
* Algorithm: Supercover Line Algorithm (checks every grid cell the line touches).
* **Collision:** If the line hits a Tile with property `isTransparent: false` (Wall/Door), return `FALSE`.
* **Cover:** If the line passes through a Tile with `isCover: true` (Desk):
    * If Crew State is `CROUCH/SNEAK`: Return `FALSE` (Hidden).
    * If Crew State is `RUN/STAND`: Return `TRUE` (Spotted).

---

## 5. Detection & Awareness States

Detection is not instant. It is an analog value ("Heat").

### 5.1 The Detection Meter
* **Visual:** A UI indicator filling up over the Guard's head.
* **Logic:** `detectionValue` (0.0 to 1.0).

### 5.2 Accumulation Formula
If `Check_Is_Visible` returns TRUE:
`detectionValue += (BaseRate * DistanceMultiplier * StateMultiplier) * deltaTime`

* `BaseRate`: e.g., 0.5 per second.
* `DistanceMultiplier`: Closer = Faster.
* `StateMultiplier`:
    * Crew Standing: 1.0x
    * Crew Running: 2.0x
    * Crew Sneaking (in open): 0.5x

### 5.3 Thresholds
1.  **Suspicion (> 0.5):**
    * Guard stops moving.
    * Guard faces direction of detection.
    * "?" Icon appears.
2.  **Detected (>= 1.0):**
    * "!" Icon appears.
    * Guard enters `ALERT` state.
    * **Global Event:** `TRIGGER_ALARM` or `INITIATE_COMBAT`.

---

## 6. Movement Speeds & Constants

Defines the "Time Economy" of movement.

| Stance | Speed (Pixels/Sec) | Noise Radius (Tiles) | Description |
|--------|-------------------|----------------------|-------------|
| **SNEAK** | 60 | 0 | Silent. Slow. High Cover bonus. |
| **WALK** | 120 | 2 | Standard patrol speed. |
| **RUN** | 200 | 5 | Fast. Loud. Ignores Cover. |

### 6.1 Noise Logic
Movement generates a "Noise Pulse" at the destination tile.
* Guards have a `HearingRadius`.
* If `NoiseSource` is within `HearingRadius`: Guard turns to look at the source (Wait 2s).
* *Strategic Use:* Player can intentionally RUN to lure a guard to a specific spot, then SNEAK away.

---

## 7. Implementation Priorities
1.  **Sprite Mover:** Implement `update` loop to move a dot from A to B smoothly.
2.  **Vision Debugger:** Draw the Vision Cone (Canvas Arc) and color it Red when it touches a wall.
3.  **Raycast Test:** Color the Unit dot Green (Safe) or Red (Spotted) based on LOS.