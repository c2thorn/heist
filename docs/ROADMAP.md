# Heist Game Development Roadmap

> **Status:** Updated 2026-01-04  
> **See Also:** `GDD_v5.md` for implemented features, `ARCHITECTURE.md` for code structure

---

## Recently Completed ✅

### Legacy Audit (All Phases)
- [x] Phase 1: Map Pipeline - BuildingLoader, bank_heist.json
- [x] Phase 2: Rendering Cleanup - EntityLayer unified rendering
- [x] Phase 3: State Management - GameManager.gameState.grid
- [x] Phase 4: Data Files - Arrangements externalized to JSON

### Features Added This Session
- [x] Locked door mechanics with unlock timer
- [x] Vault codes arrangement (1.5s vs 10s)
- [x] Door unlock progress bar
- [x] Vision cone fog-of-war hiding

---

## High Priority - Core Gameplay

### 1. Guard AI & Patrol
**Effort:** Medium | **Impact:** High

Currently guards are static. Need:
- [ ] Patrol routes (waypoints from building JSON)
- [ ] Vision cone detection → investigation state
- [ ] Alert behavior (chase, call backup)
- [ ] Response to audio stimuli (phone distraction)

### 2. Win/Lose Conditions
**Effort:** Low | **Impact:** High

No endgame currently:
- [ ] All crew extracted with loot → Victory screen
- [ ] Crew captured → Failure screen  
- [ ] Timer expires → Alarm escalation
- [ ] Loot summary + payout calculation

### 3. Interactable Completion
**Effort:** Medium | **Impact:** High

Existing interactables need full functionality:
- [ ] Safe cracking → drops loot bag
- [ ] Loot bag pickup + carry mechanic
- [ ] SecurityPanel → actually disables cameras
- [ ] Computer hacking → intel/access rewards

### 4. Heat & Alarm System
**Effort:** Medium | **Impact:** Medium

ThreatClock exists but no consequences:
- [ ] Alarm triggers → locked doors, more guards
- [ ] Heat accumulation affects future heists
- [ ] SCRAM button → all crew flee to exit
- [ ] Heat decay between heists

---

## Medium Priority - Depth & Polish

### 5. Multiple Heist Types
**Effort:** High | **Impact:** High

Only bank_heist.json exists:
- [ ] Create museum_heist.json
- [ ] Create office_heist.json  
- [ ] Contract type → building selection
- [ ] Job board shows variety

### 6. Item System Completion
**Effort:** Medium | **Impact:** Medium

From GDD - items are scaffolded but incomplete:
- [ ] PASSIVE stat bonuses applied in simulation (bug fix)
- [ ] CONSUMABLE effects trigger (EMP, Smoke Bomb)
- [ ] Gear load-out UI in planning phase

### 7. Crew Upgrade System
**Effort:** Medium | **Impact:** Medium

Design needed (from GDD open questions):
- [ ] Decide upgrade currency (XP? Cash?)
- [ ] What gets upgraded? (Stats? Abilities?)
- [ ] UI: Where does upgrade happen?
- [ ] Injury/recovery system?

### 8. SOP Profiles (Autonomous Reactions)
**Effort:** Low | **Impact:** Medium

Units should auto-react when detected:
- [ ] AGGRESSIVE: Fight back
- [ ] CAUTIOUS: Take cover, wait
- [ ] COWARD: Flee immediately

---

## Lower Priority - Content & Meta

### 9. Run Structure
**Effort:** Medium | **Impact:** High

From GDD - runs are too short:
- [ ] Target: 20-40 minute runs
- [ ] 10-15 heists per run
- [ ] Clear difficulty escalation
- [ ] Finale / "Grand Heist" moment

### 10. Economy Rebalance
**Effort:** Low | **Impact:** Medium

From GDD - no hard choices currently:
- [ ] Tighter cash flow
- [ ] Crew wages / upkeep
- [ ] Repair costs for injuries
- [ ] Entry fees for better contracts

### 11. Meta-Progression
**Effort:** High | **Impact:** Medium

Pool expansion (not power creep):
- [ ] Unlock new crew archetypes
- [ ] Unlock new gear types
- [ ] Unlock new contract layouts
- [ ] Run history / stats tracking

### 12. Heist Watchability
**Effort:** Medium | **Impact:** Medium

From GDD - make heists engaging to observe:
- [ ] Crew banter / commentary
- [ ] Near-miss feedback (close rolls)
- [ ] Dynamic camera / focus shifts
- [ ] Sound/music tension

---

## Technical Debt

### State Migration Completion
- [ ] Migrate remaining window.* references (see STATE_MIGRATION.md)
- [ ] TypeScript conversion (optional)

### Documentation
- [ ] Update IMPLEMENTATION_PROGRESS.md or archive it
- [ ] Archive old GDD_v4.md (replaced by v5)
- [ ] Archive heist_redesign/ folder (merged into v5)

---

## Quick Reference: Key Files

| Purpose | Location |
|---------|----------|
| Game design | `docs/GDD_v5.md` |
| Code structure | `docs/ARCHITECTURE.md` |
| Building data | `src/data/buildings/*.json` |
| Arrangement data | `src/data/arrangements/*.json` |
| State | `GameManager.gameState.grid.*` |
