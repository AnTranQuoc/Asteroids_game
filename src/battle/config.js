    export const MAX_PLAYERS = 4;
    export const WORLD_W = 3600;
    export const WORLD_H = 3600;
    export const MOVE_SPEED = 5.2;
    export const DECEL = 0.9;
    export const PLAYER_RADIUS = 18;
    export const PLAYER_MAX_HP = 100;
    export const SHIELD_MAX = 100;
    export const SNAPSHOT_HZ = 20;
    export const INPUT_HZ = 20;
    export const PLAYER_COLORS = ["#5fd0ff", "#ff7a7a", "#9be36b", "#ffd24d"];
    export const DROP_DURATION_MS = 6000;
    export const ZONE_PHASES = [
      { waitMs: 12000, shrinkMs: 12000, radiusFactor: 0.62, dps: 2 },
      { waitMs: 10000, shrinkMs: 10000, radiusFactor: 0.55, dps: 5 },
      { waitMs: 9000, shrinkMs: 9000, radiusFactor: 0.5, dps: 8 },
      { waitMs: 8000, shrinkMs: 8000, radiusFactor: 0.45, dps: 12 },
      { waitMs: 7000, shrinkMs: 9000, radiusFactor: 0.0, dps: 20 },
    ];
    export const ZONE_START_RADIUS = Math.min(WORLD_W, WORLD_H) * 0.55;
    export const HAZARD_COUNT = 16;
    export const HAZARD_CONTACT_DAMAGE = 18;
export const HAZARD_KNOCKBACK = 8; // Speed a rock shoves a ship away on contact.
    export const LOOT_COUNT = 26;