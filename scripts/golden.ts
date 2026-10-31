// Cross-language parity data: what the TypeScript core does, for the Python port (Raven) to reproduce.
//   npx tsx scripts/golden.ts > ../Raven/tests/golden/core_parity.json
declare const process: { stdout: { write(s: string): void } };
import {
  EV, GAME_AT, INTRO_CUES, INTRO_END, INTRO_LINES, PARTS, COUNT_AT, JUMP_AT, SH, RISER_AT, SKIP_STORY_TO, Game, Rng, botTarget, emptyInput, levelPlan, simulateLevel,
} from "../src/core";
import type { GameEvent, InputFrame } from "../src/core";

const DT = 1 / 30;
const r9 = (x: number): number => Math.round(x * 1e9) / 1e9;

// 1. the random numbers
const rng42 = (() => { const r = new Rng(42); return Array.from({ length: 20 }, () => r.next()); })();

// 2. level plans
const plans: Record<string, unknown> = {};
for (const n of [4, 7, 8, 14, 20, 28, 33, 42]) {
  plans[n] = levelPlan(n, new Rng(n)).map((p) => ({ t: r9(p.t), az: r9(p.az), el: r9(p.el), hp: p.hp, appr: r9(p.appr), eject: p.eject ?? null }));
}

// 3. scripted runs
function counts(evs: GameEvent[], into: Record<string, number>): void { for (const e of evs) into[e.type] = (into[e.type] ?? 0) + 1; }
function snap(g: Game) {
  const r = g.run;
  return { t: r1(g.clock), charge: r9(r.charge), score: r.score, az: r9(g.view.az), el: r9(g.view.el), worlds: r.worlds.filter((w) => !w.dead).length, crystals: r.crystals.length, gauges: r.gauges.length, wings: r.wings, mode: r.mode, level: r.level };
}
const r1 = (x: number): number => Math.round(x * 1e6) / 1e6;

// 3a. the 'determinism' test: seed 9, fire, turn right, 6 s
const run1 = (() => {
  const g = new Game({ seed: 9 }); g.beginGame(); g.drain();
  const ev: Record<string, number> = {}, trace = [];
  for (let i = 0; i < 180; i++) {
    g.update(DT, { ...emptyInput(), fire: true, turn: { x: 1, y: 0 } }); counts(g.drain(), ev);
    if (i % 30 === 29) trace.push(snap(g));
  }
  return { final: snap(g), trace, events: ev };
})();

// 3b. level 7 with bad gauges: the view follows the bot's target, fire held, 25 s
const run2 = (() => {
  const g = new Game({ seed: 5 }); g.beginGame(); g.drain();
  g.run.chipCollected = true; g.run.capacity = 200; g.run.charge = 200; g.startLevel(7); g.drain();
  const ev: Record<string, number> = {}, trace = [];
  const inp = emptyInput(); inp.fire = true;
  for (let i = 0; i < 750; i++) {
    if (g.phase !== "play") break;
    const p = botTarget(g); g.view.az = p.az; g.view.el = p.el;
    g.update(DT, inp); counts(g.drain(), ev);
    if (i % 30 === 29) trace.push({ ...snap(g), bad: g.run.bad ? g.run.bad.color : null, capacity: g.run.capacity });
  }
  return { final: { ...snap(g), bad: g.run.bad ? g.run.bad.color : null, capacity: g.run.capacity }, trace, events: ev };
})();

// 3c. the whole intro: every event with its frame, then level 1 underneath
const introRun = (() => {
  const g = new Game({ seed: 2 }); g.launch(); const first = g.drain(); g.beginIntro();
  const evs: unknown[] = first.map((e) => ({ f: -1, ...e }));
  const n = Math.round((INTRO_END + 0.5) / DT);
  for (let f = 0; f < n; f++) {
    g.update(DT, emptyInput());
    for (const e of g.drain()) evs.push({ f, ...e });
  }
  const w = g.run.worlds.map((x) => ({ az: r9(x.az), el: r9(x.el), spawnAt: r9(x.spawnAt), hp: x.hp }));
  return { events: evs, phase: g.phase, level: g.run.level, worlds: w, clock: r1(g.clock) };
})();

// 3d. skip commands
function skipRun(cmd: "skipStory" | "skipIntro", at: number) {
  const g = new Game({ seed: 2 }); g.beginIntro(); g.drain();
  const evs: unknown[] = [];
  for (let f = 0; f < Math.round(at / DT); f++) { g.update(DT, emptyInput()); g.drain(); }
  const cmdFrame: InputFrame = { ...emptyInput(), commands: [cmd] };
  g.update(DT, cmdFrame); for (const e of g.drain()) evs.push(e);
  for (let f = 0; f < Math.round(12 / DT); f++) { g.update(DT, emptyInput()); for (const e of g.drain()) evs.push({ f, ...e }); }
  return { t: r1(g.intro.t), phase: g.phase, events: evs };
}

// 4. the bot, level by level
const sims: unknown[] = [];
for (const level of [1, 3, 7, 14, 20, 28]) for (const seed of [1, 2]) sims.push({ seed, noise: 1, ...simulateLevel({ level, seed, noise: 1 }), });

const out = {
  rng42,
  plans,
  run1, run2, introRun,
  skipStory: skipRun("skipStory", 3), skipIntro: skipRun("skipIntro", 2),
  sims,
  intro: {
    parts: PARTS.map((p) => ({ key: p.key, text: p.text, t0: r9(p.t0), D: r9(p.D), v0: r9(p.v0), v1: r9(p.v1) })),
    lines: INTRO_LINES.map((l) => [r9(l[0]), r9(l[1]), l[2]]),
    cues: INTRO_CUES.map((c) => ({ at: r9(c.at), events: c.events })),
    ev: { w1: r9(EV.w1), w2: r9(EV.w2), drop: r9(EV.drop) },
    times: { SH, COUNT_AT: r9(COUNT_AT), JUMP_AT: r9(JUMP_AT), GAME_AT, INTRO_END, RISER_AT: r9(RISER_AT), SKIP_STORY_TO: r9(SKIP_STORY_TO) },
  },
};
process.stdout.write(JSON.stringify(out));
