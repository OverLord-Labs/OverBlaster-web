import {
  ACK_MIN, BAD, MAX_ASPECT, BADGE_AT, CELLS, CHIP_CAPACITY, CHIP_DRAIN, CHIP_HOLD, CHIP_LEVEL, CENTER, COUNT_S, CRITICAL, CRYSTAL_RADIUS, CRYSTAL_VALUE,
  EL_LIMIT, FIRST_HOLD, GAUGE_HOLD, GAUGE_LEVEL, GAUGE_LIFE, GAUGE_RADIUS, GOLD, HARVEST, HIT_FORGIVENESS, LOADS, LOW, MAX_LEVEL, PINK,
  PPD, RESTORE_AFTER, RESTORE_ODDS, SETTLE, SHOT_COOLDOWN, SHOT_COST, SPAWN_SPREAD, START_CHARGE, W, WING_HOLD, WING_LEVELS, WING_RADIUS,
} from "./constants";
import type { BadColor } from "./constants";
import type { GameEvent, Phase } from "./events";
import { emptyInput } from "./input";
import type { InputFrame } from "./input";
import { COUNT_AT, GAME_AT, INTRO_CUES, INTRO_END, RISER_AT, SKIP_STORY_TO } from "./intro";
import { LAUNCH, RETRY, SKIPS, TOTITLE, inBox } from "./layout";
import { crystalsFor, gaugeChase, levelPlan, levelSay } from "./levels";
import { azd, clamp, ramp, wrap360 } from "./math";
import { Rng } from "./rng";
import type { Callout, Gauge, IntroState, Pickup, Rock, Run } from "./types";
import { View, onScreen } from "./view";

export interface GameOptions {
  /** Seeds every random choice in the run. Same seed, same levels. Default: random. */
  seed?: number;
  /** Override the difficulty curve (how much shooting a level asks of you at level 4 and level 42). */
  loads?: [number, number];
}

const ENTRY_SPOTS: [number, number][] = [[-9, 3], [8, 6], [-3, -6], [11, -4]]; // where the first rocks come to rest: all inside the window, none on top of another

/** Angular radius in degrees: a rock grows slowly, then fast; at impact it is 8 degrees, a diameter of 53% of the screen. */
export const rockRadius = (w: Rock): number => (1.0 + 1.8 * w.p + 5.2 * Math.pow(w.p, 4)) * (w.carrier ? 1.08 : 1);

/**
 * The whole game, with no DOM, canvas, audio or timer in it.
 *   const game = new Game({ seed });
 *   game.update(dt, input);          // advance by dt seconds with this frame's input
 *   for (const e of game.drain()) …  // sounds and app events to act on
 *   // read game.phase / game.run / game.view / game.intro to draw it
 */
export class Game {
  phase: Phase = "title";
  clock = 0;
  readonly view = new View();
  rng: Rng;
  loads: [number, number];
  input: InputFrame = emptyInput();
  intro: IntroState = { t: 0, fired: new Set(), game: false };
  run!: Run;
  over: { t: number } | null = null;
  /** True between asking to launch and the host calling beginIntro() (while audio loads). */
  launching = false;
  /** Extra visible width on each side of the 640 px square, in logical px (0 on a square screen). Set with setAspect(). */
  ox = 0;
  /** Frozen games ignore update(): used by screenshot and debug tools. */
  frozen = false;
  private events: GameEvent[] = [];

  constructor(opts: GameOptions = {}) {
    this.rng = new Rng(opts.seed ?? Math.floor(Math.random() * 4294967296));
    this.loads = opts.loads ?? LOADS;
  }

  // ---------------------------------------------------------------- events
  emit(e: GameEvent): void { this.events.push(e); }
  /** Take the events emitted since the last call. */
  drain(): GameEvent[] { const e = this.events; this.events = []; return e; }
  private sfx(name: string, gain?: number): void { this.emit({ type: "sfx", name, gain }); }
  private say(keys: string[]): void { this.emit({ type: "say", keys }); }

  /** Tell the game how wide the screen is (width / height). The 30 degree vertical field stays; a wider screen sees more sky to each side. */
  setAspect(aspect: number): void { this.ox = (clamp(aspect, 1, MAX_ASPECT) * W - W) / 2; }

  // ---------------------------------------------------------------- aim and projection
  proj(az: number, el: number) { return this.view.proj(az, el); }
  /** Where the crosshair is on screen: it follows the mouse; with head or phone motion it stays at the centre. */
  aimPx(): { x: number; y: number } {
    const p = this.input.pointer;
    return p.mouse ? { x: clamp(p.x, -this.ox, W + this.ox), y: clamp(p.y, 0, W) } : { x: CENTER, y: CENTER };
  }
  /** Degrees from the crosshair to a point of the sky. */
  angDist(az: number, el: number): number {
    const a = this.aimPx(), p = this.proj(az, el);
    return Math.hypot(p.dx - (a.x - CENTER), p.dy - (a.y - CENTER)) / PPD;
  }
  arriving(w: Rock): boolean { return !!w.arrive && this.clock < w.arrive.t0 + w.arrive.delay + w.arrive.dur; }
  /** Rocks that are on the field right now. */
  liveRocks(): Rock[] { return this.run.worlds.filter((w) => !w.dead && this.run.t >= w.spawnAt); }

  // ---------------------------------------------------------------- phases
  private setPhase(p: Phase): void { if (this.phase !== p) { this.phase = p; this.emit({ type: "phase", phase: p }); } }

  /** Ask to start. The host loads audio and then calls beginIntro(). */
  launch(): void {
    if (this.phase !== "title" || this.launching) return;
    this.launching = true;
    this.emit({ type: "launch" });
  }
  beginIntro(): void {
    this.launching = false;
    this.intro = { t: 0, fired: new Set(), game: false };
    this.setPhase("intro");
  }
  /** Straight into level 1 with no intro (embedders can offer this as an option). */
  beginGame(): void {
    this.launching = false;
    this.newGame(false);
    this.setPhase("play");
    this.emit({ type: "music", name: "game" });
  }
  toTitle(): void {
    this.setPhase("title");
    this.emit({ type: "music", name: null });
  }

  // ---------------------------------------------------------------- new game and levels
  newGame(fromIntro: boolean): void {
    this.view.reset();
    this.run = {
      level: 0, score: 0, charge: START_CHARGE, capacity: START_CHARGE, chipCollected: false,
      worlds: [], crystals: [], chip: null, wing: null, gauges: [], fx: [], floaters: [], bolts: [],
      t: 0, mode: "playing", cool: 0, flash: 0, lastHit: -9, hitAt: null, side: -1, flashSide: -1,
      splashT0: 0, splashAz: 0, splashEl: 0, plateAt: 0, plateVoiced: 0, interT: 0,
      awardT0: null, awardOrigin: null, awardKind: null, lowFired: false, tutorial: true, tutT0: 0,
      shake: 0, lostT: 0, lostCause: null, chipSeen: false, tickK: 0,
      bad: null, badCount: 0, killsBad: 0, gaugeSeen: false, badT0: -9, callout: null,
      wings: 0, wingSpawned: false, stingy: false, wave2: null, pendingSay: null, lastWarn: -9, warns: 0,
    };
    this.startLevel(1, fromIntro);
  }

  makeWorld(o: { az: number; el: number; p?: number; spawnAt: number; hold?: boolean; approach: number; hp: number; carrier?: boolean; arrive?: Rock["arrive"]; eject?: BadColor }): Rock {
    const r = this.rng;
    return {
      az: o.az, el: o.el, azv: (r.next() - 0.5) * 0.9, elv: (r.next() - 0.5) * 0.4, p: o.p || 0,
      spawnAt: o.hold ? 9999 : o.spawnAt, hold: !!o.hold, speed: 1 / o.approach, hp: o.hp, max: o.hp, carrier: !!o.carrier,
      rot: r.next() * 6, spin: (r.next() - 0.5) * 0.6, dead: false, hurt: 0, arrive: o.arrive, eject: o.eject || null,
    };
  }

  startLevel(n: number, fromIntro = false): void {
    const g = this.run, r = this.rng, V = this.view;
    g.level = n; g.mode = "playing"; g.t = 0; g.crystals = []; g.chip = null; g.wing = null; g.wingSpawned = false; g.plateVoiced = 0;
    g.splashAz = V.az; g.splashEl = V.el + 6.3; g.tutT0 = this.clock; g.pendingSay = null; g.wave2 = null; g.stingy = false; g.gauges = [];
    const approach = 34 / (1 + 0.12 * (n - 1)), carrier = n >= CHIP_LEVEL && !g.chipCollected, entry = fromIntro ? ENTRY_SPOTS.length : 0;
    g.worlds = [];
    if (n === CHIP_LEVEL && !g.chipCollected) {
      // wave one is a huge, tough cluster that drains the battery; the gold rock with the BMS is inside it. When the BMS is taken, wave two finishes the level.
      g.stingy = true; g.wave2 = { count: 10, gap: 0.9, hp: 6, approach: 30 };
      const CARRIER_AT = 7;
      const cl: { az: number; el: number }[] = [];
      for (let c = 0; c < 5; c++) cl.push({ az: V.az + r.signed() * 11, el: r.signed() * 8 }); // five tight clusters of three, each arriving as one lump
      for (let i = 0; i < 15; i++) {
        const ce = cl[Math.floor(i / 3)];
        g.worlds.push(this.makeWorld({ az: wrap360(ce.az + r.signed() * 5), el: clamp(ce.el + r.signed() * 4, -18, 18), p: 0.08 + r.next() * 0.22, spawnAt: 1.0 + Math.floor(i / 3) * 2.4, approach: 42, hp: 7, carrier: i === CARRIER_AT, hold: i === CARRIER_AT }));
      }
    } else if (n >= 4) {
      for (const p of levelPlan(n, r, this.loads)) g.worlds.push(this.makeWorld({ az: wrap360(V.az + p.az), el: p.el, spawnAt: p.t, approach: p.appr, hp: p.hp, eject: p.eject }));
    } else {
      const count = 4 + 2 * n, gap = Math.max(1.4, 2.8 - 0.15 * n), hp = 4 + n;
      for (let j = 0; j < count; j++) {
        const isC = carrier && j === 0;
        const w = this.makeWorld({ az: wrap360(V.az + r.signed() * SPAWN_SPREAD), el: r.signed() * 16, spawnAt: 1.0 + j * gap, approach, hp: isC ? hp + 4 : hp, carrier: isC });
        if (j < entry) { w.az = wrap360(V.az + ENTRY_SPOTS[j][0]); w.el = ENTRY_SPOTS[j][1]; w.azv = w.elv = 0; w.p = 0.42 + 0.04 * j; w.spawnAt = -9; w.arrive = { t0: this.clock, delay: j * 0.16, dur: 1.5 }; }
        else if (entry) w.spawnAt = 4.0 + (j - entry) * gap;
        g.worlds.push(w);
      }
    }
    this.emit({ type: "levelStart", level: n });
    if (fromIntro) { g.splashT0 = this.clock + 5.0; g.pendingSay = { at: this.clock + 5.0, keys: levelSay(n) }; }
    else { g.splashT0 = this.clock; this.sfx("level_start"); this.say(levelSay(n)); }
  }

  // ---------------------------------------------------------------- things that happen
  private loseGame(cause: "hull" | "battery"): void {
    const g = this.run;
    if (g.mode === "lost") return;
    g.mode = "lost"; g.lostCause = cause; g.lostT = 0;
    if (cause === "hull") { this.sfx("hull_death"); this.say(["hull_destroyed"]); g.shake = 1; } else { this.sfx("battery_dead"); this.say(["battery_dead"]); }
  }

  private destroy(w: Rock): void {
    const g = this.run, r = this.rng;
    w.dead = true; g.score += 100; this.sfx("explode", 0.8);
    g.fx.push({ k: "burst", az: w.az, el: w.el, t: -0.12, r: rockRadius(w) * PPD, col: w.carrier ? GOLD : PINK });
    g.floaters.push({ az: w.az, el: w.el, s: "+100", t: 0 });
    if (w.carrier) this.ejectChip(w.az, w.el);
    else {
      let n = g.level < 4 ? 2 + Math.floor(r.next() * 2) : crystalsFor(w.max);
      if (w.eject) n = Math.max(1, n - 1);
      for (let i = 0; i < n; i++) g.crystals.push({ az: w.az + (i - (n - 1) / 2) * 2.4, el: w.el, age: 0, dwell: 0 });
      if (w.eject) this.ejectGauge(w);
      else if (g.bad && !g.chip && ++g.killsBad >= 1 && (r.next() < RESTORE_ODDS || g.killsBad >= (g.badCount <= 1 ? 3 : RESTORE_AFTER))) this.ejectChip(w.az, w.el + 3); // lost your BMS? sooner or later a rock spits a new one out
    }
  }
  ejectChip(az: number, el: number): void {
    const g = this.run;
    g.chip = { az, el, age: 0, dwell: 0, onTarget: false }; g.chipSeen = false; g.killsBad = 0;
  }
  callout(a: string, b: string, col: Callout["col"], dur?: number): void {
    this.run.callout = { a, b, col, t0: this.clock, dur: dur || 4.2 };
  }
  ejectGauge(w: Rock): void {
    const g = this.run, r = this.rng, color = w.eject as BadColor;
    const first = !g.gaugeSeen; g.gaugeSeen = true;
    g.gauges.push({ az: w.az, el: clamp(w.el, -20, 20), color, age: 0, dwell: 0, vaz: (r.next() - 0.5) * 7, vel: (r.next() - 0.5) * 2.5, seed: Math.floor(r.next() * 1000), on: false, first, hold: first ? FIRST_HOLD : GAUGE_HOLD });
    g.fx.push({ k: "glitch", az: w.az, el: w.el, t: 0, col: BAD[color].col });
    this.emit({ type: "zap", kind: "eject" });
    if (first) { this.callout("BAD GAUGE!", "IT LOCKS ON TO YOUR AIM. IN 4 SECONDS IT IS YOURS.", BAD[color].col, 6); this.say(["gauge_seen"]); }
  }
  takeBad(gz: Gauge): void {
    const g = this.run, b = BAD[gz.color];
    g.gauges.splice(g.gauges.indexOf(gz), 1); g.badT0 = this.clock; g.shake = 0.5; g.killsBad = 0; g.score = Math.max(0, g.score - 200);
    this.emit({ type: "zap", kind: "bad" }); this.say(["bad_gauge"]);
    if (!g.bad) {
      g.badCount++; g.bad = { color: gz.color, cap: b.cap, col: b.col, cut: b.cut }; g.capacity = b.cap; g.charge = Math.min(g.charge, g.capacity);
      this.callout("OVERLORD BMS LOST", `CAPACITY CUT ${b.cut}. SHOOT ROCKS: ONE WILL EJECT A NEW BMS.`, b.col, 5.5);
    } else { g.charge = Math.max(0, g.charge - 0.3 * g.capacity); this.callout("ANOTHER BAD GAUGE", "YOUR BATTERY JUST TOOK A HIT", b.col, 3.5); }
    g.fx.push({ k: "glitch", az: gz.az, el: gz.el, t: 0, col: b.col });
  }
  private shoot(): void {
    const g = this.run;
    g.charge -= SHOT_COST; g.flash = 0.09; g.tutorial = false;
    let best: Rock | null = null, bd = 1e9; g.hitAt = null;
    for (const w of g.worlds) {
      if (w.dead || g.t < w.spawnAt || this.arriving(w)) continue;
      const d = this.angDist(w.az, w.el);
      if (d <= rockRadius(w) * HIT_FORGIVENESS && d < bd) { best = w; bd = d; }
    }
    let tgt: { x: number; y: number } = this.aimPx();
    if (best) tgt = this.proj(best.az, best.el); // shots pass straight through a bad gauge: you can only keep your aim off it
    g.side = -g.side; g.flashSide = g.side; g.bolts.push({ t: 0, tx: tgt.x, ty: tgt.y, side: g.side }); // the blaster fires from the right side, then the left, then the right
    if (best) {
      best.hp -= 1; best.p = Math.max(0, best.p - 0.0015); best.hurt = 0.08; g.hitAt = { az: best.az, el: best.el };
      if (this.clock - g.lastHit > 0.1) { this.sfx("hit", 0.45); g.lastHit = this.clock; }
      g.fx.push({ k: "spark", az: best.az, el: best.el, t: -0.13 });
      if (best.hp <= 0) this.destroy(best);
    }
  }
  private acknowledge(): void {
    const g = this.run;
    this.sfx("ui_confirm");
    if (g.level >= MAX_LEVEL) { g.lostCause = "win"; this.setPhase("over"); this.over = { t: 0 }; this.sfx("level_clear"); this.say(["victory"]); this.emit({ type: "gameOver", won: true, cause: "win", score: g.score, level: g.level }); return; }
    this.startLevel(g.level + 1);
  }
  private collectWing(): void {
    const g = this.run, w = g.wing as Pickup;
    g.wings++; g.score += 2000;
    g.fx.push({ k: "ping", az: w.az, el: w.el, t: 0 }); g.floaters.push({ az: w.az, el: w.el + 4, t: 0, s: `WING ${g.wings} / 2` });
    g.wing = null; this.sfx("chip_collect"); this.emit({ type: "wingFound", wings: g.wings });
  }
  private collectChip(): void {
    const g = this.run, c = g.chip as Pickup, p = this.proj(c.az, c.el);
    g.awardOrigin = { x: clamp(p.x, 30, W - 30), y: clamp(p.y, 30, W - 30) };
    const back = g.chipCollected;
    g.chip = null; g.chipSeen = false; g.chipCollected = true; g.bad = null; g.capacity = CHIP_CAPACITY; g.charge = CHIP_CAPACITY; g.score += back ? 500 : 1000;
    g.awardT0 = this.clock; g.awardKind = back ? "restore" : "found"; g.callout = null; this.sfx("chip_collect"); this.say([back ? "chip_back" : "chip_found"]); g.stingy = false;
    this.emit({ type: "chipFound" });
    if (g.wave2) {
      const w2 = g.wave2; g.wave2 = null;
      for (let i = 0; i < w2.count; i++) g.worlds.push(this.makeWorld({ az: wrap360(this.view.az + this.rng.signed() * 30), el: this.rng.signed() * 14, spawnAt: g.t + 5.5 + i * w2.gap, approach: w2.approach, hp: w2.hp }));
    }
  }

  // ---------------------------------------------------------------- input
  private press(x: number, y: number): void {
    if (this.phase === "intro" && !this.intro.game) { if (this.storyBtnVisible() && inBox(SKIPS, x, y)) this.skipStory(); return; }
    if (this.phase === "title") { this.launch(); return; }
    if (this.phase === "play" && this.run.mode === "intermission") { if (this.clock - this.run.plateAt >= ACK_MIN) this.acknowledge(); return; }
    if (this.phase === "over") {
      if (inBox(RETRY, x, y)) { this.newGame(false); this.setPhase("play"); this.emit({ type: "music", name: "game" }); }
      else if (inBox(TOTITLE, x, y)) this.toTitle();
    }
  }
  private command(c: InputFrame["commands"][number]): void {
    if (c === "launch") { if (this.phase === "title") this.launch(); }
    else if (c === "skipStory") this.skipStory();
    else if (c === "skipIntro") this.skipIntro();
    else if (c === "recenter") this.view.recenter();
    else if (c === "flipYaw") this.view.flipYaw();
    else if (c === "flipPitch") this.view.flipPitch();
  }
  /** Is the in-canvas "skip story" button showing? */
  storyBtnVisible(): boolean { return this.phase === "intro" && !this.intro.game && this.intro.t > 0.9 && this.intro.t < COUNT_AT - 1.6; }
  /** Is a skip control worth offering right now (story or countdown still running)? */
  canSkipIntro(): boolean { return this.phase === "intro" && this.intro.t < GAME_AT; }

  /** Skip the story only: the narrator stops, and the drive's last climb, the countdown and the jump still play. */
  skipStory(): void {
    const I = this.intro;
    if (this.phase !== "intro" || I.game || I.t >= SKIP_STORY_TO) return;
    const needRiser = I.t < RISER_AT;
    INTRO_CUES.forEach((c, i) => { if (c.at < SKIP_STORY_TO) I.fired.add(i); });
    this.say([]); this.emit({ type: "alarm", on: false });
    if (needRiser) this.emit({ type: "sfx", name: "warp_charge", gain: 0.9, offset: SKIP_STORY_TO - RISER_AT, tag: "riser" });
    I.t = SKIP_STORY_TO;
  }
  /** Skip the whole intro and drop into level 1. */
  skipIntro(): void {
    const I = this.intro;
    if (!this.canSkipIntro()) return;
    INTRO_CUES.forEach((c, i) => { if (c.at < GAME_AT) I.fired.add(i); });
    this.emit({ type: "stopRiser" }); this.say([]); this.emit({ type: "alarm", on: false }); this.emit({ type: "drone", on: false });
    I.t = GAME_AT;
  }

  // ---------------------------------------------------------------- the clock
  update(dt: number, input: InputFrame): void {
    if (this.frozen) return;
    this.input = input;
    for (const c of input.commands) this.command(c);
    for (const p of input.presses) this.press(p.x, p.y);
    this.clock += dt;
    if (this.phase === "intro") { this.updateIntro(dt); if (!this.intro.game) return; }
    else if (this.phase === "over") { if (this.over) this.over.t += dt; return; }
    else if (this.phase !== "play") return;
    this.updateRun(dt);
  }

  private updateIntro(dt: number): void {
    const I = this.intro;
    I.t += dt;
    INTRO_CUES.forEach((c, i) => { if (I.t >= c.at && !I.fired.has(i)) { I.fired.add(i); c.events.forEach((e) => this.emit(e)); } });
    if (I.t >= GAME_AT && !I.game) { I.game = true; this.newGame(true); this.emit({ type: "music", name: "game" }); }
    if (I.t >= INTRO_END) this.setPhase("play");
  }

  private updateRun(dt: number): void {
    const g = this.run, input = this.input, clock = this.clock;
    if (g.pendingSay && clock >= g.pendingSay.at) { this.say(g.pendingSay.keys); g.pendingSay = null; }
    g.t += dt; g.flash = Math.max(0, g.flash - dt); g.shake = Math.max(0, g.shake - dt * 1.2);
    this.view.update(dt, input);
    g.bolts.forEach((b) => { b.t += dt; }); g.bolts = g.bolts.filter((b) => b.t < 0.3);
    g.fx.forEach((f) => { f.t += dt; }); g.fx = g.fx.filter((f) => f.t < 1.2);
    g.floaters.forEach((f) => { f.t += dt; }); g.floaters = g.floaters.filter((f) => f.t < 1.2);
    if (g.callout && clock - g.callout.t0 > g.callout.dur) g.callout = null;
    if (g.mode === "lost") {
      g.lostT += dt;
      if (g.lostT >= (g.lostCause === "hull" ? 1.4 : 0.6)) { this.setPhase("over"); this.over = { t: 0 }; this.emit({ type: "gameOver", won: false, cause: g.lostCause as "hull" | "battery", score: g.score, level: g.level }); }
      return;
    }
    for (const w of g.worlds) {
      if (w.dead || g.t < w.spawnAt) continue;
      w.p += w.speed * dt; w.rot += w.spin * dt; w.az = wrap360(w.az + w.azv * dt); w.el = clamp(w.el + w.elv * dt, -22, 22); w.hurt = Math.max(0, w.hurt - dt);
      if (w.p >= 1) this.loseGame("hull");
    }
    if ((g.mode as string) === "lost") return;
    // a rock that is critically close and whose arrow is showing sounds an alarm (once per rock, not more than one alarm a second)
    for (const w of g.worlds) {
      if (w.dead || g.t < w.spawnAt || this.arriving(w) || w.warned || w.p < CRITICAL) continue;
      if (onScreen(this.proj(w.az, w.el), rockRadius(w) * PPD, this.ox)) continue;
      w.warned = true;
      if (clock - g.lastWarn > 1.0) { g.lastWarn = clock; g.warns++; this.sfx("warning", 0.9); }
    }
    g.cool = Math.max(g.cool - dt, -Math.min(dt, SHOT_COOLDOWN));
    if (g.mode === "playing" && input.fire && g.charge >= SHOT_COST && g.cool <= 0) { this.shoot(); g.cool += SHOT_COOLDOWN; }
    for (const c of g.crystals) { c.age += dt; c.el = Math.max(-24, c.el - 0.6 * dt); const on = this.angDist(c.az, c.el) <= CRYSTAL_RADIUS; c.dwell = on ? c.dwell + dt : Math.max(0, c.dwell - dt * 2); }
    g.crystals = g.crystals.filter((c) => {
      if (c.age > 9) return false;
      if (c.dwell >= HARVEST) { g.charge = Math.min(g.capacity, g.charge + CRYSTAL_VALUE); g.score += 10; this.sfx("crystal", 0.8); g.fx.push({ k: "ping", az: c.az, el: c.el, t: 0 }); return false; }
      return true;
    });
    if (g.chip) {
      const c = g.chip; c.age += dt; c.el = Math.max(-20, c.el - 0.25 * dt);
      if (!g.chipSeen) { g.chipSeen = true; g.tickK = 0; this.say(["chip_seen"]); }
      c.onTarget = this.angDist(c.az, c.el) <= CRYSTAL_RADIUS;
      if (c.onTarget) c.dwell += dt; else c.dwell = Math.max(0, c.dwell - dt * CHIP_DRAIN * CHIP_HOLD);
      const k = Math.min(8, Math.floor((c.dwell / CHIP_HOLD) * 8));
      if (c.onTarget) while (g.tickK < k) { this.sfx("charge_" + g.tickK, 0.8); g.tickK++; }
      if (c.dwell >= CHIP_HOLD) this.collectChip();
      else if (c.age > 18) { // you let it drift off: it comes back as a rock to shoot again
        g.chip = null; g.chipSeen = false;
        g.worlds.push({ az: wrap360(this.view.az + this.rng.signed() * 30), el: 0, azv: 0, elv: 0, p: 0.3, spawnAt: g.t, speed: 1 / 22, hp: 4, max: 4, carrier: true, rot: 0, spin: 0.2, dead: false, hurt: 0, hold: false, eject: null });
      }
    }
    // the level's wing drifts in a few seconds after it starts, and the level will not end until it is yours
    const wi = WING_LEVELS.indexOf(g.level);
    if (g.mode === "playing" && wi >= 0 && !g.wing && !g.wingSpawned && g.t > 5) {
      g.wingSpawned = true;
      g.wing = { az: wrap360(this.view.az + (this.rng.next() < 0.5 ? -1 : 1) * (28 + this.rng.next() * 14)), el: 2, age: 0, dwell: 0, onTarget: false };
      this.sfx("warning", 0.8); g.floaters.push({ az: g.wing.az, el: g.wing.el + 5, t: 0, s: "BATTERY WING" });
    }
    if (g.wing) {
      const wg = g.wing; wg.age += dt; wg.onTarget = this.angDist(wg.az, wg.el) <= WING_RADIUS;
      if (wg.onTarget) wg.dwell += dt; else wg.dwell = Math.max(0, wg.dwell - dt * CHIP_DRAIN * WING_HOLD);
      if (wg.dwell >= WING_HOLD) this.collectWing();
    }
    for (const q of g.gauges) {
      q.age += dt; q.vaz *= 1 - 1.2 * dt; q.vel *= 1 - 1.2 * dt; // thrown out of the rock, then it settles and homes in on your crosshair
      const cs = Math.cos((q.el * Math.PI) / 180), ap = this.aimPx(), pq = this.proj(q.az, q.el);
      const dx = (ap.x - pq.x) / PPD, dy = -(ap.y - pq.y) / PPD, dist = Math.hypot(dx, dy);
      const step = Math.min(dist, (q.first ? 60 : gaugeChase(g.level)) * ramp(q.age, 0.5, 1.3) * dt);
      q.az = wrap360(q.az + q.vaz * dt + (dist > 1e-6 ? (step * dx) / dist / Math.max(0.3, cs) : 0));
      q.el = clamp(q.el + q.vel * dt + (dist > 1e-6 ? (step * dy) / dist : 0), -24, 24);
      q.on = g.mode === "playing" && this.angDist(q.az, q.el) <= GAUGE_RADIUS;
      q.dwell = q.on ? q.dwell + dt : Math.max(0, q.dwell - dt * 1.5);
    }
    for (const q of g.gauges.slice()) { if (q.dwell >= q.hold) this.takeBad(q); else if (q.age > GAUGE_LIFE && !q.first) g.gauges.splice(g.gauges.indexOf(q), 1); }
    const frac = g.charge / g.capacity;
    if (g.stingy) { // wave one: the belt feeds on your power. It bleeds you down to a last reserve, never to zero, and the BMS rock turns up once you are low.
      if (frac > 0.12) g.charge = Math.max(0.12 * g.capacity, g.charge - 2.0 * dt);
      if (frac < 0.14) g.charge = Math.min(g.capacity, g.charge + 4.0 * dt);
      for (const w of g.worlds) if (w.hold && !w.dead && ((g.t > 9 && frac < 0.4) || frac < 0.22 || g.t > 22)) { w.hold = false; w.spawnAt = g.t + 0.4; }
    }
    if (frac < LOW && !g.lowFired) { g.lowFired = true; this.sfx("low_battery"); this.say(["battery_low"]); } else if (frac >= LOW + 0.1) g.lowFired = false;
    const pending = g.worlds.some((w) => !w.dead);
    if (g.mode === "playing") {
      if (!pending && !g.crystals.length && !g.chip && !g.wing && !(wi >= 0 && !g.wingSpawned)) {
        g.mode = "intermission"; g.interT = 0; g.gauges = [];
        const left = g.awardT0 != null ? Math.max(0, SETTLE - (clock - g.awardT0)) : 0;
        g.plateAt = clock + left; g.plateVoiced = 0;
        this.emit({ type: "levelClear", level: g.level, score: g.score });
      } else if (g.charge < SHOT_COST && !g.crystals.length && !g.chip && pending && !g.stingy) this.loseGame("battery"); // in wave one the last reserve keeps you alive until the BMS
    } else if (g.mode === "intermission") {
      const pt = clock - g.plateAt;
      if (pt >= 0 && g.plateVoiced === 0) { g.plateVoiced = 1; this.sfx("level_clear"); this.say(["level_clear"]); }
      if (pt >= COUNT_S + 0.2 && g.plateVoiced === 1) { g.plateVoiced = 2; this.say(["continue"]); }
    }
  }

  /** Continue from the sector-cleared plate (what a click does once the plate accepts it). Exposed for bots and tests. */
  continueFromPlate(): void { if (this.phase === "play" && this.run.mode === "intermission") this.acknowledge(); }
}


