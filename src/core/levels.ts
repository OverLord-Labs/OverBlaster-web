import { BAD, GAUGE_LEVEL, LEVELS, LOADS, SPAWN_EL, WING_LEVELS } from "./constants";
import { clamp, lerp } from "./math";
import type { Rng } from "./rng";
import type { BadColor } from "./constants";

/** One rock in a level's plan. `t` is when it appears, `appr` how many seconds it takes to reach you. */
export interface PlanRock { t: number; az: number; el: number; hp: number; appr: number; eject?: BadColor }

/**
 * Where the next rock (or lump of rocks) goes, as degrees to the right of where you look, anywhere on the full circle.
 * Each step is about 137.5 degrees (the golden angle) plus a little jitter, so rocks that arrive one after another are far
 * apart, and over a level they cover the whole 360.
 */
export function ringSpots(rng: Rng): () => number {
  let a = rng.next() * 360;
  return () => { a = (a + 137.508) % 360; return ((a + rng.signed() * 14 + 540) % 360) - 180; };
}

export const levelName = (n: number): string => LEVELS[clamp(n, 1, LEVELS.length) - 1];

const LEVEL_VOICE = ["name_far", "name_1", "name_2", "name_3", "name_4", "name_5"];
/** The voice says "Level", the number, and (for the first six) the name. Numbers above 19 are a tens word, then a units word. */
export function levelSay(n: number): string[] {
  const k = ["level_word"];
  if (n < 20) k.push("num_" + (n < 10 ? "0" : "") + n);
  else {
    k.push("num_" + Math.floor(n / 10) * 10);
    if (n % 10) k.push("num_0" + (n % 10));
  }
  if (n <= 6) k.push(LEVEL_VOICE[n - 1]);
  return k;
}

/** The small note under the next level's name on the sector-cleared plate. */
export function levelNote(n: number): string {
  if (WING_LEVELS.includes(n)) return "A BATTERY WING DRIFTS IN";
  if (n === 4) return "NEW: CLUSTERS";
  if (n === GAUGE_LEVEL) return "NEW: BAD GAUGES";
  if (n > GAUGE_LEVEL) return ["", "WATCH FOR BAD GAUGES", "WALL OF ROCKS", "FAST AND FRAGILE", "TURN TO FIND THEM", "ARMOURED. BAD GAUGES."][(n - 8) % 6];
  return "";
}

/** Degrees a second a bad gauge drifts toward your crosshair: sweep your head faster than that and it falls behind. */
export const gaugeChase = (n: number): number => 12 + 0.25 * (n - GAUGE_LEVEL);
export const crystalsFor = (hp: number): number => clamp(Math.round(hp / 3 + 1), 3, 5);

/**
 * A level from 4 on is a list of rocks. The pace comes from how much shooting is asked of you per second
 * ("load", of the 10 shots a second you can fire), how little time you have before a rock lands, and the bad gauges.
 */
export function levelPlan(n: number, rng: Rng, loads: [number, number] = LOADS): PlanRock[] {
  const plan: PlanRock[] = [];
  const kind = n <= 6 ? "cluster" : n === GAUGE_LEVEL ? "intro" : ["stream", "cluster", "gauge", "swarm", "pincer", "boss"][(n - 8) % 6];
  const u = clamp((n - 4) / 38, 0, 1);
  const load = lerp(loads[0], loads[1], u);
  const hp = n <= 6 ? [3, 3, 4][n - 4] : n === GAUGE_LEVEL ? 3 : clamp(Math.round(3 + (n - 8) * 0.1), 3, 6);
  const appr = n <= 6 ? [24, 22, 20][n - 4] : Math.max(12, 28 * Math.pow(0.98, n - 4));
  const span = 20 + 0.4 * (n - 4);
  let tt = 1.0, pinA = 0;
  const frac = n < GAUGE_LEVEL ? 0 : Math.min(0.45, 0.06 + 0.012 * (n - GAUGE_LEVEL)) + (kind === "gauge" || kind === "boss" ? 0.15 : 0);
  const side = ringSpots(rng);
  const lump = (t: number, size: number, az: number, h: number, ap: number) => {
    for (let k = 0; k < size; k++) plan.push({ t: t + rng.next() * 0.2, az: az + rng.signed() * 4.5, el: clamp(rng.signed() * 3 + ((az * 7) % 11) - 5, -SPAWN_EL, SPAWN_EL), hp: h, appr: ap });
  };
  if (kind === "intro") {
    for (let i = 0; i < 6; i++) plan.push({ t: tt + i * 3.2, az: side(), el: rng.signed() * 12, hp, appr });
    plan[1].eject = "red"; plan[4].eject = "blue";
    return plan;
  }
  if (kind === "cluster" || kind === "boss" || kind === "pincer") {
    const size = n <= 6 ? [3, 4, 4][n - 4] : clamp(3 + Math.floor((n - 8) / 6), 3, 6);
    const h = kind === "boss" ? Math.round(hp * 1.5) : hp;
    const ap = kind === "boss" ? appr * 0.9 : appr;
    const nL = n <= 6 ? [4, 5, 6][n - 4] : Math.round((span * 10 * load) / (size * h));
    for (let i = 0; i < nL; i++) {
      if (kind === "pincer") { if (i % 2 === 0) pinA = side(); } // a pincer: two lumps on opposite sides of you
      lump(tt, size, kind === "pincer" ? (i % 2 ? pinA + 180 + rng.signed() * 12 : pinA) : side(), h, ap);
      tt += ((size * h) / (10 * load)) * (n <= 6 ? 1.3 : kind === "pincer" ? 1.35 : 1);
    }
  } else if (kind === "swarm") {
    const h2 = Math.max(1, Math.round(hp * 0.5)), cnt = Math.round(((span * 10 * load) / h2) * 0.6);
    for (let i = 0; i < cnt; i++) {
      plan.push({ t: tt, az: side(), el: rng.signed() * SPAWN_EL, hp: h2, appr: appr * 0.85 });
      tt += (h2 / (10 * load)) * (0.7 + 0.6 * rng.next());
    }
  } else {
    const cnt = Math.round((span * 10 * load) / hp);
    for (let i = 0; i < cnt; i++) {
      plan.push({ t: tt, az: side(), el: rng.signed() * SPAWN_EL, hp, appr });
      tt += (hp / (10 * load)) * (0.75 + 0.5 * rng.next());
    }
  }
  const ne = n < GAUGE_LEVEL ? 0 : Math.max(1, Math.round(plan.length * frac));
  const pick = rng.shuffle(plan.map((_, k) => k));
  for (let i = 0; i < ne; i++) plan[pick[i]].eject = rng.next() < 0.5 ? "red" : "blue";
  plan.sort((a, b) => a.t - b.t);
  return plan;
}

export { BAD };
