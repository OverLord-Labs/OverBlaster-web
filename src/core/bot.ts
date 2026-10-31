import { BAD, CHIP_CAPACITY, HIT_FORGIVENESS, TURN_RATE } from "./constants";
import type { BadColor } from "./constants";
import { Game, rockRadius } from "./game";
import { emptyInput } from "./input";
import { azd, clamp } from "./math";
import { Rng } from "./rng";

/** Where a reasonably careful player would look next: a wing or the chip first, crystals when the battery needs them, else the most urgent rock. */
export function botTarget(game: Game): { az: number; el: number } {
  const g = game.run;
  if (g.wing) return { az: g.wing.az, el: g.wing.el };
  if (g.chip) return { az: g.chip.az, el: g.chip.el };
  const live = g.worlds.filter((w) => !w.dead && g.t >= w.spawnAt && !game.arriving(w));
  const urgent = live.some((w) => w.p > 0.5); // a person grabs crystals when the battery needs them or when nothing presses
  if ((!urgent || g.charge / g.capacity < 0.35) && g.crystals.length) return { az: g.crystals[0].az, el: g.crystals[0].el };
  let best = null as (typeof live)[number] | null, bp = -1;
  for (const w of live) {
    const sc = (w.p >= 0.6 ? 100 : 0) + w.p * 20 - game.angDist(w.az, w.el) * 0.5; // the urgent ones first, then whatever is closest to where you look
    if (sc > bp || best === null) { bp = sc; best = w; }
  }
  return best ? { az: best.az, el: best.el } : { az: game.view.az, el: game.view.el };
}

export interface SimOptions {
  level: number;
  seed?: number;
  /** How wobbly the bot's aim is (degrees-ish). 0 is perfect. */
  noise?: number;
  /** Start as if a bad gauge had already cut the battery. */
  bad?: BadColor;
  /** Give up after this many simulated seconds. */
  maxSeconds?: number;
  loads?: [number, number];
}
export interface SimResult {
  level: number; lost: boolean; cause: string | null; seconds: number; wings: number; minCharge: number; rocks: number; badTaken: number; gaugesSeen: number;
}

/** Play one level headless with the bot, as if you already had the BMS (the late game). Used by tests and `npm run sim`. */
export function simulateLevel(o: SimOptions): SimResult {
  const rng = new Rng(((o.seed ?? 1) * 7919 + o.level * 104729) >>> 0);
  const game = new Game({ seed: (o.seed ?? 1) * 31 + o.level, loads: o.loads });
  game.newGame(false);
  game.phase = "play";
  const g0 = game.run;
  g0.chipCollected = true; g0.capacity = CHIP_CAPACITY; g0.charge = CHIP_CAPACITY;
  if (o.bad) { g0.bad = { color: o.bad, cap: BAD[o.bad].cap, col: BAD[o.bad].col, cut: BAD[o.bad].cut }; g0.capacity = BAD[o.bad].cap; g0.charge = BAD[o.bad].cap; }
  game.startLevel(o.level);
  const g = game.run, noise = o.noise ?? 0, dt = 1 / 30, maxStep = (TURN_RATE / 30) * 0.9;
  const off = { az: 0, el: 0 };
  let k = 0, minf = 1, badTaken = 0, gaugesSeen = 0;
  const rocks = g.worlds.length;
  const input = emptyInput();
  const limit = (o.maxSeconds ?? 150) * 30;
  while (game.phase === "play" && g.mode !== "intermission" && k++ < limit) {
    const p = botTarget(game);
    off.az = off.az * 0.92 + rng.gauss() * noise * 0.28; off.el = off.el * 0.92 + rng.gauss() * noise * 0.28;
    const da = azd(p.az + off.az, game.view.az), de = p.el + off.el - game.view.el;
    game.view.az = (game.view.az + clamp(da, -maxStep, maxStep) + 360) % 360; game.view.el = clamp(game.view.el + clamp(de, -maxStep, maxStep), -38, 38); // turns no faster than a head can
    input.fire = g.mode === "playing" && g.worlds.some((w) => !w.dead && g.t >= w.spawnAt && !game.arriving(w) && game.angDist(w.az, w.el) <= rockRadius(w) * HIT_FORGIVENESS);
    game.update(dt, input);
    for (const e of game.drain()) if (e.type === "zap") { if (e.kind === "bad") badTaken++; else if (e.kind === "eject") gaugesSeen++; }
    minf = Math.min(minf, g.charge / g.capacity);
  }
  return { level: o.level, lost: (game.phase as string) === "over", cause: g.lostCause, seconds: Math.round(g.t), wings: g.wings, minCharge: minf, rocks, badTaken, gaugesSeen };
}
