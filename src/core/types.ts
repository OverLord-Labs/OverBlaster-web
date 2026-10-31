import type { BadColor, RGB } from "./constants";

// The shapes of the game's state. Renderers read these; only the core writes them.

export interface Rock {
  az: number; el: number; azv: number; elv: number;
  /** 0 when it appears, 1 when it reaches you. */
  p: number;
  spawnAt: number;
  hold: boolean; // waiting to be released (the BMS carrier in wave one)
  speed: number;
  hp: number; max: number;
  carrier: boolean; // the gold rock that drops the BMS chip
  rot: number; spin: number;
  dead: boolean;
  hurt: number;
  arrive?: { t0: number; delay: number; dur: number }; // flies in from the centre (the first level's opening rocks)
  eject: BadColor | null; // spits out a bad gauge when destroyed
  warned?: boolean;
}

export interface Crystal { az: number; el: number; age: number; dwell: number }
/** The BMS chip and the battery wings: collected by holding your aim on them. */
export interface Pickup { az: number; el: number; age: number; dwell: number; onTarget: boolean }
export interface Gauge {
  az: number; el: number; color: BadColor; age: number; dwell: number;
  vaz: number; vel: number; seed: number; on: boolean; first: boolean; hold: number;
}
export type Fx =
  | { k: "burst"; az: number; el: number; t: number; r: number; col: RGB }
  | { k: "spark"; az: number; el: number; t: number }
  | { k: "glitch"; az: number; el: number; t: number; col: RGB }
  | { k: "ping"; az: number; el: number; t: number };
export interface Bolt { t: number; tx: number; ty: number; side: number }
export interface Floater { az: number; el: number; s: string; t: number }
export interface Callout { a: string; b: string; col: RGB; t0: number; dur: number }
export interface BadState { color: BadColor; cap: number; col: RGB; cut: string }

export type RunMode = "playing" | "intermission" | "lost";
export type LostCause = "hull" | "battery" | "win" | null;

/** One game, from level 1 to the end. */
export interface Run {
  level: number; score: number; charge: number; capacity: number;
  chipCollected: boolean;
  worlds: Rock[]; crystals: Crystal[]; chip: Pickup | null; wing: Pickup | null; gauges: Gauge[];
  fx: Fx[]; floaters: Floater[]; bolts: Bolt[];
  t: number; // seconds into the level
  mode: RunMode;
  cool: number; flash: number; lastHit: number; hitAt: { az: number; el: number } | null;
  side: number; flashSide: number;
  splashT0: number; splashAz: number; splashEl: number;
  plateAt: number; plateVoiced: number; interT: number;
  awardT0: number | null; awardOrigin: { x: number; y: number } | null; awardKind: "found" | "restore" | null;
  lowFired: boolean; tutorial: boolean; tutT0: number;
  shake: number; lostT: number; lostCause: LostCause;
  chipSeen: boolean; tickK: number;
  bad: BadState | null; badCount: number; killsBad: number; gaugeSeen: boolean; badT0: number;
  callout: Callout | null;
  wings: number; wingSpawned: boolean;
  stingy: boolean; wave2: { count: number; gap: number; hp: number; approach: number } | null;
  pendingSay: { at: number; keys: string[] } | null;
  lastWarn: number; warns: number;
}

export interface IntroState {
  t: number;
  fired: Set<number>;
  /** True once the first level is running underneath the end of the intro. */
  game: boolean;
}

export interface Projected { x: number; y: number; dx: number; dy: number }
