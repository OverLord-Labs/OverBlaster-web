import { BAD, CHIP_CAPACITY, GAME_AT, HIT_FORGIVENESS, INTRO_CUES, MAX_LEVEL, Game, botTarget, emptyInput, rockRadius } from "../core";
import type { InputFrame } from "../core";

/**
 * Jump a game to a known moment, for screenshots and manual checks. Debug tooling only: the library entry does not include it.
 * Used by the demo page via `#test=<scene>[:arg]` (see src/demo/main.ts).
 */
const DT = 1 / 30;

function step(g: Game, inp: InputFrame, sec: number, fire: boolean, bot = true): void {
  for (let i = 0, n = Math.round(sec * 30); i < n; i++) {
    if (g.phase !== "play") break;
    if (bot) face(g);
    inp.fire = fire && g.run.mode === "playing";
    g.update(DT, inp); g.drain();
  }
  inp.fire = false;
}
function face(g: Game): void { const p = botTarget(g); g.view.az = p.az; g.view.el = p.el; }
function until(g: Game, inp: InputFrame, cond: () => boolean, max = 6000): void {
  let n = 0;
  while (!cond() && n++ < max && g.phase === "play") { face(g); inp.fire = g.run.mode === "playing"; g.update(DT, inp); g.drain(); }
  inp.fire = false;
}
const tick = (g: Game, inp: InputFrame, n: number): void => { for (let i = 0; i < n; i++) { g.update(DT, inp); g.drain(); } };

/** Show the intro at time t (seconds). */
export function introAt(g: Game, t: number): void {
  g.frozen = false; g.beginIntro(); g.drain();
  INTRO_CUES.forEach((_, i) => g.intro.fired.add(i));
  const inp = emptyInput(); inp.pointer.inside = true;
  if (t < GAME_AT) { g.intro.t = t; g.input = inp; g.frozen = true; return; }
  g.intro.t = GAME_AT - 0.001;
  for (let k = 0; k < Math.round((t - GAME_AT) * 30) + 1; k++) { if (g.phase !== "intro") break; g.update(DT, inp); g.drain(); }
  g.frozen = true;
}

export function applyScene(g: Game, name: string, arg?: string, arg2?: string): void {
  g.frozen = false;
  const inp = emptyInput(); inp.pointer.inside = true; g.input = inp;
  if (name === "title") { g.phase = "title"; g.frozen = true; return; }
  if (name === "intro") { introAt(g, parseFloat(arg ?? "0")); return; }
  g.newGame(false); g.phase = "play"; g.drain();
  const R = () => g.run;
  const free = (lvl: number) => { R().chipCollected = true; R().capacity = CHIP_CAPACITY; R().charge = CHIP_CAPACITY; g.startLevel(lvl); };
  const enough = (w: { dead: boolean; spawnAt: number }) => !w.dead && R().t >= w.spawnAt;
  const inReach = () => R().worlds.some((w) => enough(w) && !g.arriving(w) && g.angDist(w.az, w.el) <= rockRadius(w) * HIT_FORGIVENESS);
  if (name === "splash") step(g, inp, 2.6, false, false);
  else if (name === "arrow") step(g, inp, 5.5, false, false);
  else if (name === "rocks") { step(g, inp, 9, false, false); face(g); }
  else if (name === "fight") step(g, inp, 11, true);
  else if (name === "laser") { g.startLevel(5); R().tutorial = false; step(g, inp, 6, false, false); face(g); inp.fire = true; tick(g, inp, 3); }
  else if (name === "mouse") {
    g.startLevel(5); R().tutorial = false; step(g, inp, 6, false, false); inp.pointer.mouse = true;
    const rk = R().worlds.filter(enough)[0]; g.view.az = rk.az - 6; g.view.el = rk.el + 2;
    const pr = g.proj(rk.az, rk.el); inp.pointer.x = pr.x; inp.pointer.y = pr.y; inp.fire = true; tick(g, inp, 4);
  }
  else if (name === "win") { R().level = MAX_LEVEL; R().score = 123456; R().lostCause = "win"; g.phase = "over"; g.over = { t: 1 }; }
  else if (name === "over") { R().charge = 0; until(g, inp, () => g.phase === "over"); g.phase = "over"; g.over = { t: 1 }; }
  else if (name === "wing") {
    free(14); R().worlds = []; R().t = 6; R().tutorial = false; step(g, inp, 0.1, false, false);
    const w = R().wing!;
    if (arg === "hold") { g.view.az = w.az; g.view.el = w.el; step(g, inp, 1.2, false, false); }
    else if (arg === "side") { g.view.az = (w.az + 12) % 360; step(g, inp, 0.2, false, false); }
  }
  else if (name === "lvl") { free(parseInt(arg ?? "7", 10) || 7); step(g, inp, parseFloat(arg2 ?? "4"), false, false); }
  else if (name === "fight7") {
    R().chipCollected = true; R().capacity = CHIP_CAPACITY; R().charge = 180; g.startLevel(7); R().tutorial = false;
    let q = 0; while (q++ < 900 && !(R().gauges.length && R().gauges[0].age > 0.6)) { face(g); inp.fire = R().mode === "playing" && inReach(); g.update(DT, inp); g.drain(); }
    inp.fire = false; g.view.az = R().gauges[0].az - 9; g.view.el = R().gauges[0].el + 3; step(g, inp, 0.1, false, false);
  }
  else if (name === "gauge" || name === "bad" || name === "back") {
    R().chipCollected = true; R().capacity = CHIP_CAPACITY; R().charge = 160; g.startLevel(7); g.view.az = 0; g.view.el = 0;
    R().worlds = [g.makeWorld({ az: 0, el: 0, spawnAt: 9999, approach: 30, hp: 3 })]; R().tutorial = false;
    R().gauges = [
      { az: 8, el: 3, color: "red", age: 1, dwell: 0, vaz: 0, vel: 0, seed: 8, on: false, first: false, hold: 2 },
      { az: -10, el: -4, color: "blue", age: 1, dwell: 0, vaz: 0, vel: 0, seed: 21, on: false, first: false, hold: 2 },
    ];
    R().gaugeSeen = true; g.callout("BAD GAUGE!", "IT LOCKS ON TO YOUR AIM. IN 4 SECONDS IT IS YOURS.", BAD.red.col, 30);
    if (name !== "gauge") { g.takeBad(R().gauges[0]); R().callout = null; g.callout("OVERLORD BMS LOST", "CAPACITY CUT 70%. SHOOT ROCKS: ONE WILL EJECT A NEW BMS.", BAD.red.col, 30); step(g, inp, 0.9, false, false); }
    if (name === "back") { R().callout = null; R().chip = { az: 0, el: 0, age: 0, dwell: 0, onTarget: false }; until(g, inp, () => R().awardT0 != null && g.clock - R().awardT0! >= 3.0); }
    step(g, inp, 0.2, false, false);
  }
  else {
    g.startLevel(3);
    if (name === "close") { const pc = parseFloat(arg ?? "0.9"); R().worlds.forEach((w, i) => { if (i === 0) { w.hold = false; w.spawnAt = -1; w.p = pc; w.az = g.view.az; w.el = g.view.el; w.speed = 0; w.azv = w.elv = 0; w.carrier = false; } else w.dead = true; }); tick(g, inp, 2); }
    else if (name === "arrows") { R().t = 3; R().worlds.forEach((w, i) => { w.hold = false; w.spawnAt = -1; w.p = 0.08 + (i % 6) * 0.17; w.azv = w.elv = 0; w.az = (i * 31) % 360; w.el = ((i * 7) % 30) - 15; }); g.view.az = 0; g.view.el = 0; tick(g, inp, 3); }
    else if (name === "wave1") { step(g, inp, 7, false, false); g.view.az = 0; g.view.el = 0; }
    else if (name === "wave1b") until(g, inp, () => R().t > 9);
    else if (name === "wave2") until(g, inp, () => R().awardT0 != null && g.clock - R().awardT0! >= 9.5);
    else if (name === "chip50") until(g, inp, () => !!R().chip && R().chip!.dwell >= 1.2);
    else if (name === "chipslip") { until(g, inp, () => !!R().chip && R().chip!.dwell >= 0.8); g.view.az += 6; g.view.el -= 2; tick(g, inp, 28); }
    else if (name === "chipfar") { until(g, inp, () => !!R().chip); g.view.az += 20; tick(g, inp, 20); }
    else if (name === "award") until(g, inp, () => R().awardT0 != null && g.clock - R().awardT0! >= 2.6);
    else if (name === "plate") until(g, inp, () => R().mode === "intermission" && g.clock - R().plateAt >= 3.2, 9000);
  }
  g.frozen = true;
}
