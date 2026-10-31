import type { GameEvent } from "./events";

/**
 * The story intro, as data: the narrator's lines, when things happen, and what sounds go with them.
 * Seen from the stranded mothership's bridge: the jump goes unstable, the battery wings tear away,
 * the ship finishes the run alone, and someone has to go back for them. Then 3, 2, 1, Go.
 * Times are seconds from the start of the intro.
 */
// [voice clip, caption (| = line break), clip length s, gap after s, lead-in s]
const NAR: [string, string, number, number, number][] = [
  ["m_n1", "The Meridian was carrying|the lights home.", 3.0, 0.7, 0.4],
  ["m_n2", "Then the jump|became unstable.", 2.58, 0.5, 0.4],
  ["m_n3", "It tore away|one battery wing.", 2.38, 0.5, 0.4],
  ["m_n4", "Then the other.", 1.25, 2.6, 0.4],
  ["m_e3", "The ship finished the run alone, in an empty|patch of space. No wings. No power.", 6.48, 1.7, 0.6],
  ["m_e4", "It can't jump again. Someone has to go back|for them. The long way. Through the belt.", 5.96, 1.7, 0.6],
  ["m_e5", "Find both wings.|Bring them back.", 2.65, 1.7, 0.6],
];

export interface Part { key: string; text: string; t0: number; D: number; v0: number; v1: number }
export const PARTS: Part[] = [];
export let STORY_END = 0;
for (const n of NAR) {
  const D = n[2] + n[3];
  PARTS.push({ key: n[0], text: n[1], t0: STORY_END, D, v0: STORY_END + n[4], v1: STORY_END + n[4] + n[2] });
  STORY_END += D;
}

/** The story's length less 10.6 s, so the countdown starts as the last line ends. */
export const SH = 23.1;
export const COUNT_AT = 10.6 + SH;
export const COUNT_STEP = 1.0;
export const JUMP_AT = COUNT_AT + 3 * COUNT_STEP;
/** The first level takes over at GAME_AT, under the last of the intro. */
export const GAME_AT = 14.5 + SH;
export const INTRO_END = 17.6 + SH;

/** The wings go as the narrator says so. */
export const EV = { w1: PARTS[2].v0 + 0.6, w2: PARTS[3].v0 + 0.3, drop: PARTS[3].v1 + 1.1 };

/** Captions: [shown from, shown until, text]. */
export const INTRO_LINES: [number, number, string][] = PARTS.map((p) => [p.v0, p.v1 + 0.2, p.text]);

export interface Cue { at: number; events: GameEvent[] }
const say = (k: string): GameEvent => ({ type: "say", keys: [k] });
export const INTRO_CUES: Cue[] = [
  ...PARTS.map((p) => ({ at: p.v0, events: [say(p.key)] })),
  { at: 0, events: [{ type: "drone", on: true }] },
  { at: PARTS[1].t0, events: [{ type: "alarm", on: true }] },
  { at: EV.w1, events: [{ type: "sfx", name: "hit", gain: 1 }, { type: "sfx", name: "explode", gain: 0.7 }] },
  { at: EV.w2, events: [{ type: "sfx", name: "explode", gain: 1 }, { type: "sfx", name: "battery_dead", gain: 0.8 }] },
  { at: EV.drop, events: [{ type: "alarm", on: false }, { type: "sfx", name: "hull_death", gain: 0.7 }] },
  { at: COUNT_AT - 7.4, events: [{ type: "sfx", name: "warp_charge", gain: 0.9, tag: "riser" }] },
  { at: COUNT_AT - 0.08, events: [say("m_three")] },
  { at: COUNT_AT + COUNT_STEP - 0.08, events: [say("m_two")] },
  { at: COUNT_AT + 2 * COUNT_STEP - 0.08, events: [say("m_one")] },
  { at: JUMP_AT - 0.08, events: [say("m_go")] },
  { at: COUNT_AT + 3, events: [{ type: "drone", on: false }] },
  { at: 13.9 + SH, events: [{ type: "sfx", name: "explode", gain: 0.9 }, { type: "sfx", name: "level_start", gain: 0.8 }] },
];
/** When the drive's riser starts. A story skip that lands after this starts it part-way in. */
export const RISER_AT = COUNT_AT - 7.4;
/** Where "skip story" lands: just before the countdown. */
export const SKIP_STORY_TO = COUNT_AT - 1.2;
