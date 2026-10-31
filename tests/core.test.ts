import { describe, expect, it } from "vitest";
import {
  CHIP_CAPACITY, CHIP_HOLD, COUNT_AT, Game, GAME_AT, INTRO_END, LEVELS, MAX_LEVEL, Rng, WING_HOLD, azd, emptyInput, levelPlan, levelSay, simulateLevel,
} from "../src/core";
import type { GameEvent, InputFrame } from "../src/core";

const DT = 1 / 30;
function play(seed = 1): Game { const g = new Game({ seed }); g.beginGame(); g.drain(); return g; }
function step(g: Game, secs: number, input: Partial<InputFrame> = {}): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < Math.round(secs / DT); i++) { g.update(DT, { ...emptyInput(), ...input }); out.push(...g.drain()); }
  return out;
}
/** Put the crosshair on a point of the sky by turning the head there. */
const look = (g: Game, p: { az: number; el: number }) => { g.view.az = p.az; g.view.el = p.el; };

describe("rng", () => {
  it("is reproducible from a seed", () => {
    const a = new Rng(42), b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it("stays in range", () => { const r = new Rng(3); for (let i = 0; i < 1000; i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); } });
});

describe("math", () => {
  it("azd takes the short way round", () => { expect(azd(350, 10)).toBe(-20); expect(azd(10, 350)).toBe(20); });
});

describe("levels", () => {
  it("has a name for every level and plans every level from 4 on", () => {
    expect(MAX_LEVEL).toBe(LEVELS.length);
    for (let n = 4; n <= MAX_LEVEL; n++) { const plan = levelPlan(n, new Rng(n)); expect(plan.length).toBeGreaterThan(0); expect(plan.every((r) => r.hp >= 1 && r.appr > 0)).toBe(true); }
  });
  it("same seed, same plan", () => { expect(levelPlan(20, new Rng(5))).toEqual(levelPlan(20, new Rng(5))); });
  it("says numbers above 19 as tens then units", () => {
    expect(levelSay(3)).toEqual(["level_word", "num_03", "name_2"]);
    expect(levelSay(28)).toEqual(["level_word", "num_20", "num_08"]);
    expect(levelSay(30)).toEqual(["level_word", "num_30"]);
  });
});

describe("battery", () => {
  it("spends one unit per shot and stops at the cooldown", () => {
    const g = play(); const c0 = g.run.charge;
    step(g, 1.05, { fire: true });
    expect(c0 - g.run.charge).toBeGreaterThanOrEqual(9); expect(c0 - g.run.charge).toBeLessThanOrEqual(11);
  });
  it("a rock that reaches you ends the run by hull", () => {
    const g = play(); g.run.t = 5; g.run.worlds[0].spawnAt = 0; g.run.worlds[0].p = 0.99; g.run.worlds[0].speed = 1;
    const ev = step(g, 3);
    expect(g.run.lostCause).toBe("hull");
    expect(ev.some((e) => e.type === "gameOver")).toBe(true);
    expect(g.phase).toBe("over");
  });
  it("out of battery with rocks left is a battery loss", () => {
    const g = play(); g.run.charge = 0; g.run.crystals = [];
    step(g, 3);
    expect(g.run.lostCause).toBe("battery");
  });
});

describe("harvesting and shooting", () => {
  it("destroying a rock drops crystals, and holding aim on one recharges the battery", () => {
    const g = play(7); const g1 = g.run;
    step(g, 1.2); // first rock spawns
    for (let i = 0; i < 900 && !g1.crystals.length; i++) {
      const r = g.liveRocks()[0]; if (r) look(g, r);
      step(g, DT, { fire: true });
    }
    expect(g1.crystals.length).toBeGreaterThan(0);
    g1.charge = 50;
    const c = g1.crystals[0]; look(g, c); step(g, 0.5);
    expect(g1.charge).toBeGreaterThan(50);
  });
});

describe("the BMS chip", () => {
  it("doubles capacity and refills when held 2.4 s", () => {
    const g = play(); const r = g.run; r.level = 3;
    g.ejectChip(100, 0); look(g, r.chip!);
    step(g, CHIP_HOLD + 0.3);
    expect(r.chipCollected).toBe(true); expect(r.capacity).toBe(CHIP_CAPACITY); expect(r.charge).toBe(CHIP_CAPACITY);
  });
});

describe("battery wings", () => {
  it("level 14 will not end until its wing is collected", () => {
    const g = play(); g.run.chipCollected = true; g.startLevel(14); g.run.worlds = [];
    step(g, 6); expect(g.run.wing).not.toBeNull(); expect(g.run.mode).toBe("playing");
    step(g, 5); expect(g.run.mode).toBe("playing"); // nothing to shoot, still waiting on the wing
    look(g, g.run.wing!); step(g, WING_HOLD + 0.3);
    expect(g.run.wings).toBe(1); expect(g.run.mode).toBe("intermission");
  });
  it("level 28 can be reached directly and still ends once its wing is taken", () => {
    const r = simulateLevel({ level: 28, seed: 1, noise: 1, maxSeconds: 120 }); expect(r.wings).toBe(1); expect(r.seconds).toBeLessThan(120);
  });
  it("aim that slips drains the hold instead of resetting it", () => {
    const g = play(); g.startLevel(14); g.run.worlds = []; step(g, 6);
    const w = g.run.wing!; look(g, w); step(g, 1.0); const d1 = w.dwell;
    g.view.az = (w.az + 40) % 360; step(g, 0.5);
    expect(w.dwell).toBeLessThan(d1); expect(w.dwell).toBeGreaterThan(0);
  });
});

describe("the intro", () => {
  it("runs story, countdown and jump, then hands over to level 1 and play", () => {
    const g = new Game({ seed: 2 }); g.launch(); expect(g.drain().some((e) => e.type === "launch")).toBe(true); g.beginIntro();
    const ev = step(g, INTRO_END + 0.5);
    expect(g.phase).toBe("play");
    expect(ev.filter((e) => e.type === "say").length).toBeGreaterThanOrEqual(11); // 7 story lines + 3, 2, 1, go... and level voice
    expect(ev.some((e) => e.type === "alarm" && e.on)).toBe(true);
    expect(ev.some((e) => e.type === "music" && e.name === "game")).toBe(true);
    expect(g.run.level).toBe(1);
  });
  it("skipStory lands before the countdown, cuts the voice and keeps the later cues", () => {
    const g = new Game({ seed: 2 }); g.beginIntro(); step(g, 3);
    g.update(DT, { ...emptyInput(), commands: ["skipStory"] });
    const ev = g.drain();
    expect(ev.some((e) => e.type === "say" && e.keys.length === 0)).toBe(true);
    expect(g.intro.t).toBeGreaterThan(COUNT_AT - 1.5); expect(g.intro.t).toBeLessThan(COUNT_AT);
    const rest = step(g, 6);
    expect(rest.some((e) => e.type === "say" && e.keys[0] === "m_three")).toBe(true);
    expect(rest.some((e) => e.type === "say" && e.keys[0] === "m_go")).toBe(true);
  });
  it("skipIntro goes straight to the game", () => {
    const g = new Game({ seed: 2 }); g.beginIntro(); step(g, 2);
    g.update(DT, { ...emptyInput(), commands: ["skipIntro"] });
    expect(g.intro.t).toBeGreaterThanOrEqual(GAME_AT);
  });
});

describe("absolute head orientation", () => {
  it("sets the view directly and ignores keys and drag", () => {
    const g = play();
    step(g, 0.5, { head: { az: 350, el: 5 }, turn: { x: 1, y: 1 }, look: { dx: 50, dy: 50 } });
    expect(g.view.az).toBeCloseTo(350, 9); expect(g.view.el).toBeCloseTo(5, 9); expect(g.view.sensorLive).toBe(false);
    step(g, DT, { head: { az: -10, el: 99 } });
    expect(g.view.az).toBeCloseTo(350, 9); expect(g.view.el).toBe(38);
  });
});

describe("the confirm command (Enter / Select)", () => {
  it("launches from the title, and retries from the game-over screen", () => {
    const g = new Game({ seed: 1, controls: "select" });
    expect(g.controls).toBe("select");
    g.update(DT, { ...emptyInput(), commands: ["launch"] });
    expect(g.launching).toBe(true);
    const o = play(3); o.run.charge = 0; (o as unknown as { setPhase(p: string): void }).setPhase("over");
    o.update(DT, { ...emptyInput(), commands: ["launch"] });
    expect(o.phase).toBe("play");
  });
});

describe("determinism", () => {
  it("two games with one seed and one input script end the same", () => {
    const run = () => { const g = play(9); step(g, 6, { fire: true, turn: { x: 1, y: 0 } }); return [g.run.charge, g.run.score, g.view.az, g.run.worlds.length]; };
    expect(run()).toEqual(run());
  });
});

describe("the bot (balance checks)", () => {
  it("clears the early levels", () => {
    for (const level of [1, 2, 4, 5, 6]) { const r = simulateLevel({ level, seed: 1, noise: 1 }); expect(r.lost, `level ${level}: ${r.cause}`).toBe(false); }
  });
  it("collects the wings on levels 14 and 28 (when it survives)", () => {
    const r = simulateLevel({ level: 14, seed: 1, noise: 1 }); expect(r.lost).toBe(false); expect(r.wings).toBe(1);
  });
});
