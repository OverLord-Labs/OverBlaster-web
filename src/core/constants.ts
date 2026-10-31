// Every tunable number in the game, in one place. The values are the Raven glasses app's where they exist.

export type RGB = [number, number, number];

/** The logical screen: 640 x 640 px across a 30 degree field of view. Renderers scale this to any canvas size. */
export const W = 640;
export const FOV = 30;
export const PPD = W / FOV;
export const CENTER = W / 2;

export const CYAN: RGB = [0, 229, 255];
export const GOLD: RGB = [255, 200, 0];
export const PINK: RGB = [255, 60, 220];
export const WHITE: RGB = [255, 255, 255];
export const RED: RGB = [255, 40, 40];
export const GREY: RGB = [141, 162, 180];

// ---- the player's head and the screen ----
export const TURN_RATE = 52; // degrees a second at full key deflection
export const EL_LIMIT = 38; // how far up or down you can look

// ---- battery ----
export const LOW = 0.25; // fraction of capacity that counts as low
export const CELLS = 20;
export const SHOT_COST = 1;
export const SHOT_COOLDOWN = 0.1;
export const CRYSTAL_VALUE = 3;
export const START_CHARGE = 100;
export const CHIP_CAPACITY = 200;

// ---- aiming and harvesting ----
export const HARVEST = 0.3; // seconds of aim on a crystal
export const CRYSTAL_RADIUS = 3.0; // degrees
export const HIT_FORGIVENESS = 1.5; // a shot lands within 1.5 x a rock's radius
export const SPAWN_SPREAD = 45;
export const POINTER_RING = 250; // px: how far from the centre an off-screen arrow sits
export const CRITICAL = 0.72; // a rock past 72% of its way to you is critically close
export const BLINK_FROM = 0.8; // a rock this close starts blinking red itself

// ---- the Overlord BMS chip ----
export const CHIP_LEVEL = 3;
export const CHIP_HOLD = 2.4;
export const CHIP_DRAIN = 0.2;

// ---- the Meridian's battery wings ----
export const WING_LEVELS = [14, 28];
export const WING_HOLD = 2.4;
export const WING_RADIUS = 4.2;
export const WING_COUNT = 2;

// ---- bad gauges: slightly broken chips ----
export const GAUGE_LEVEL = 7;
export const GAUGE_HOLD = 2.0;
export const FIRST_HOLD = 4.0;
export const GAUGE_RADIUS = 3.5;
export const GAUGE_LIFE = 14;
export const RESTORE_ODDS = 0.15;
export const RESTORE_AFTER = 7;
/** Red ones cut capacity by 70%, blue ones by 80%; either one takes the 2x away. */
export const BAD = {
  red: { cap: 30, col: [255, 50, 40] as RGB, cut: "70%" },
  blue: { cap: 20, col: [50, 130, 255] as RGB, cut: "80%" },
};
export type BadColor = keyof typeof BAD;

// ---- difficulty ----
/** How much of your 10 shots a second a level asks for, at level 4 and at level 42. */
export const LOADS: [number, number] = [0.3, 0.55];

// ---- presentation timing (shared by core and renderer) ----
export const BUBBLE_IN = 1.8;
export const BUBBLE_FOLD = 7.0;
export const BADGE_AT = 3.0;
export const SETTLE = 8.0;
export const ACK_MIN = 2.5; // seconds before the sector-cleared plate accepts a click
export const COUNT_S = 1.3;
export const SPLASH_END = 6.8;

export const LEVELS = [
  "THE FAR SIDE", "ASTEROID BELT", "NEBULA GATE", "VOID STORM", "EVENT HORIZON", "DEEP SPACE",
  "SHORT CIRCUIT", "COLD SOLDER", "BROWNOUT", "GRAVEL RUN", "RIFT LINE", "THE SCRAPYARD", "DARK CURRENT", "SHATTER FIELD", "STATIC SEA", "HOLLOW MOON", "BLACK ICE", "RED SHIFT", "THE WHIRL", "ION CANYON", "BURNOUT",
  "LAST LIGHT", "CRATER STORM", "DRIFT WALL", "PULSE GATE", "IRON GRAVE", "THE SIEVE", "FALLOUT", "GHOST FLEET", "THUNDER BELT", "SINGULARITY", "BREAKER", "COLD FRONT", "WIDOWMAKER", "DEEP FREEZE", "TITAN FIELD", "REDLINE", "THE MAW", "ZERO HOUR", "NO RETURN", "OVERLORD GATE", "THE OVERLORD CORE",
];
export const MAX_LEVEL = LEVELS.length;
