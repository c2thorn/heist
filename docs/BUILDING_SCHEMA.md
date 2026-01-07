# Building Schema Reference

> Reference for procedural map generators - output must match this format for `BuildingLoader` compatibility.

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique building identifier |
| `name` | string | ✅ | Display name |
| `width` | number | ✅ | Map width in tiles |
| `height` | number | ✅ | Map height in tiles |
| `zones` | Zone[] | ✅ | Sector definitions |
| `rooms` | Room[] | ✅ | Room layouts |
| `guards` | Guard[] | ❌ | Enemy guards |
| `cameras` | Camera[] | ❌ | Security cameras (stub) |
| `alarms` | Alarm[] | ❌ | Alarm triggers (stub) |
| `interactables` | Interactable[] | ❌ | Safes, computers, panels |
| `crewSpawns` | SpawnPoint[] | ✅ | Where crew spawns |
| `score` | Score | ✅ | Primary heist objective |
| `sideScores` | SideScore[] | ❌ | Optional bonus loot |
| `extraction` | Extraction | ✅ | Exit points |
| `openDoors` | Position[] | ❌ | Pre-opened doors |
| `initiallyRevealed` | string[] | ❌ | Zones visible at start |

---

## Zone

Defines sectors for intel/fog system.

```json
{
  "id": "vault",
  "name": "Vault",
  "color": "#1a365d"
}
```

---

## Room

Rooms are defined by bounds (wall outline) and interior (floor tiles).

```json
{
  "zone": "lobby",
  "bounds": { "x1": 10, "y1": 22, "x2": 21, "y2": 28 },
  "interior": { "x1": 11, "y1": 23, "x2": 20, "y2": 27 },
  "doors": [{ "x": 15, "y": 28 }],
  "connections": [{ "x": 15, "y": 16, "type": "FLOOR" }]
}
```

### Room Fields

| Field | Type | Description |
|-------|------|-------------|
| `zone` | string | Which zone this room belongs to |
| `bounds` | Rect | Outer wall rectangle (tiles become WALL) |
| `interior` | Rect | Inner floor rectangle (tiles become FLOOR) |
| `doors` | Door[] | Door positions on walls |
| `connections` | Connection[] | Hallway/corridor floor tiles |
| `customWalls` | WallLine[] | Additional wall lines |

### Door

```json
{
  "x": 23,
  "y": 22,
  "locked": true,
  "unlockDuration": 10.0,
  "quickUnlockDuration": 1.5,
  "quickUnlockArrangement": "vault_codes"
}
```

---

## Guard

```json
{
  "id": "guard_1",
  "x": 16,
  "y": 7,
  "color": "#ff4444",
  "radius": 10,
  "visionCone": {
    "fov": 90,
    "range": 6,
    "facing": 180
  }
}
```

---

## Interactable

```json
{
  "type": "SAFE",
  "id": "main_safe",
  "x": 25,
  "y": 22,
  "label": "Vault Safe",
  "duration": 6,
  "dc": 10,
  "lootValue": 5000
}
```

Types: `SAFE`, `COMPUTER`, `PANEL`

---

## Score (Primary Objective)

```json
{
  "id": "vault_haul",
  "name": "Vault Cash Reserves",
  "value": 8000,
  "interactableId": "main_safe"
}
```

Must link to an existing interactable via `interactableId`.

---

## SideScore (Bonus Loot)

```json
{
  "id": "teller_cash",
  "name": "Teller Drawer",
  "value": 500,
  "x": 13,
  "y": 25,
  "sector": "lobby",
  "duration": 3
}
```

Creates a standalone Safe interactable at the given position.

---

## Extraction

```json
{
  "points": [
    {
      "id": "main_entrance",
      "name": "Main Entrance",
      "x": 15,
      "y": 28,
      "isDefault": true
    }
  ]
}
```

At least one extraction point required, one marked `isDefault`.

---

## Crew Spawns

```json
{
  "x": 15,
  "y": 26,
  "default": true
}
```

---

# Arrangements Schema (Optional)

Separate file with purchasable pre-heist modifiers.

```json
{
  "arrangements": [
    {
      "id": "vault_codes",
      "name": "Vault Access Codes",
      "type": "STATIC_MODIFIER",
      "cost": 400,
      "reqSector": "vault",
      "description": "Quick unlock vault door",
      "payload": { "effect": "VAULT_BYPASS", "x": 24, "y": 21 }
    }
  ]
}
```

### Arrangement Types

| Type | Description |
|------|-------------|
| `TRIGGERED_ABILITY` | Usable ability during heist |
| `STATIC_MODIFIER` | Passive effect when purchased |

### Common Payload Effects

- `PHONE_DISTRACTION` - Distract guards
- `POWER_CUT` - Disable cameras  
- `REMOVE_GUARD` - Guard doesn't spawn
- `VAULT_BYPASS` - Reduces door unlock time
