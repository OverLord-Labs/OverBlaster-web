import { AUDIO_CLIPS } from "./assets/manifest";
import type { AppEvent } from "./core/events";
import { isSound } from "./core/events";
import { Game } from "./core/game";
import type { GameOptions } from "./core/game";
import { AudioEngine } from "./platform/audio";
import { InputController } from "./platform/input";
import type { KeyboardScope } from "./platform/input";
import { Mic } from "./platform/mic";
import { Renderer } from "./render/renderer";

export interface OverBlasterOptions extends GameOptions {
  /** Folder (URL) that holds `audio/` and `logo.png`, e.g. "/games/overblaster/". Default "./". */
  assetsUrl?: string;
  /** Play sound (needs the audio files). Default true. */
  sound?: boolean;
  /** Skip the story intro and go straight to level 1 when the player launches. */
  skipIntro?: boolean;
  /** Where keys are heard: "focus" (default) only while the game has focus, "window" anywhere on the page, "off" never. */
  keyboard?: KeyboardScope;
  /** Use phone motion sensors to turn the view. Default true. */
  motion?: boolean;
  /** Pause automatically when the tab is hidden or the game scrolls out of view. Default true. */
  autoPause?: boolean;
}

export type OverBlasterEventName = AppEvent["type"];
type Listener = (e: AppEvent) => void;

/**
 * OverBlaster, mounted into a page. One instance owns a canvas, a game loop, input and audio.
 *
 *   const game = OverBlaster.mount(document.getElementById("here")!, { assetsUrl: "/overblaster/" });
 *   game.on("gameOver", (e) => console.log(e.score));
 *   game.destroy();                       // when you are done
 *
 * The playable logic lives in `Game` (src/core) and knows nothing about the browser; this class is the browser adapter.
 */
export class OverBlaster {
  readonly game: Game;
  readonly canvas: HTMLCanvasElement;
  private root: HTMLElement;
  private ownsCanvas: boolean;
  private renderer: Renderer;
  private input: InputController;
  private audio: AudioEngine | null;
  private mic: Mic;
  private listeners = new Map<string, Set<Listener>>();
  private raf = 0;
  private last = 0;
  private running = true;
  private userPaused = false;
  private visible = true;
  private io: IntersectionObserver | null = null;
  private onVis = (): void => this.syncPause();

  static mount(target: HTMLElement, opts: OverBlasterOptions = {}): OverBlaster {
    return new OverBlaster(target, opts);
  }

  private constructor(target: HTMLElement, private opts: OverBlasterOptions) {
    const base = (opts.assetsUrl ?? "./").replace(/\/?$/, "/");
    if (target instanceof HTMLCanvasElement) { this.canvas = target; this.root = target; this.ownsCanvas = false; }
    else {
      this.root = target; this.ownsCanvas = true;
      this.canvas = document.createElement("canvas");
      this.canvas.setAttribute("aria-label", "OverBlaster game screen");
      Object.assign(this.canvas.style, { display: "block", width: "100%", aspectRatio: "1 / 1", background: "#000", touchAction: "none" });
      target.appendChild(this.canvas);
    }
    this.game = new Game(opts);
    const logo = new Image(); logo.src = base + "logo.png";
    this.renderer = new Renderer(this.canvas, logo);
    this.input = new InputController(this.canvas, {
      keyboard: opts.keyboard ?? "focus", motion: opts.motion !== false,
      onKey: (k) => { if (k === "m" || k === "M") this.setMuted(!this.muted); },
    });
    this.audio = opts.sound === false ? null : new AudioEngine({ baseUrl: base + "audio/" });
    this.mic = new Mic(() => this.audio?.context ?? null);
    if (opts.autoPause !== false) {
      document.addEventListener("visibilitychange", this.onVis);
      if (typeof IntersectionObserver !== "undefined") { this.io = new IntersectionObserver((es) => { this.visible = es[es.length - 1].isIntersecting; this.syncPause(); }); this.io.observe(this.canvas); }
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // ---- the loop ----
  private frame(now: number): void {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (this.running) {
      this.mic.update(dt, !!this.audio?.isSpeaking());
      this.input.micFire = this.mic.held;
      this.game.update(dt, this.input.frame());
      this.audio?.tick();
    } else this.input.frame(); // keep draining so a pause does not queue clicks
    for (const e of this.game.drain()) this.dispatch(e);
    this.renderer.render(this.game);
  }

  private dispatch(e: ReturnType<Game["drain"]>[number]): void {
    if (isSound(e)) { this.audio?.handle(e); return; }
    if (e.type === "launch") {
      void this.input.requestMotionPermission();
      if (this.audio) void this.audio.init().then(() => this.beginAfterLaunch());
      else this.beginAfterLaunch();
    }
    this.listeners.get(e.type)?.forEach((l) => l(e));
    this.listeners.get("*")?.forEach((l) => l(e));
  }
  private beginAfterLaunch(): void { if (this.opts.skipIntro) this.game.beginGame(); else this.game.beginIntro(); }

  private syncPause(): void {
    const should = !this.userPaused && !document.hidden && this.visible;
    if (should === this.running) return;
    this.running = should;
    if (!should) void this.audio?.context?.suspend(); else void this.audio?.context?.resume();
  }

  // ---- public API ----
  /** Listen for app events ("launch", "phase", "levelStart", "levelClear", "chipFound", "wingFound", "gameOver", or "*"). Returns an unsubscribe function. */
  on(type: OverBlasterEventName | "*", fn: Listener): () => void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }
  pause(): void { this.userPaused = true; this.syncPause(); }
  resume(): void { this.userPaused = false; this.syncPause(); }
  get muted(): boolean { return !!this.audio?.muted; }
  setMuted(m: boolean): void { this.audio?.setMuted(m); }
  recenter(): void { this.input.command("recenter"); }
  /** Jump from the story/countdown into level 1. */
  skipIntro(): void { this.input.command("skipIntro"); }
  /** Switch the microphone on or off ("say pew" fires). Must be called from a click or key press. */
  async toggleMic(): Promise<"on" | "off" | "blocked" | "unavailable"> {
    if (this.mic.on) { this.mic.disable(); return "off"; }
    return this.mic.enable();
  }
  get micOn(): boolean { return this.mic.on; }
  get phase(): Game["phase"] { return this.game.phase; }
  /** Stop everything and remove what mount() added. */
  destroy(): void {
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVis);
    this.io?.disconnect();
    this.input.destroy(); this.renderer.destroy(); this.mic.destroy(); this.audio?.destroy();
    this.listeners.clear();
    if (this.ownsCanvas) this.canvas.remove();
  }
}

export { AUDIO_CLIPS };
export * from "./core"; // the pure game is part of the public API too (headless use, bots, tests)

/** `<overblaster-game assets-url="/overblaster/" seed="7" skip-intro keyboard="window"></overblaster-game>` */
export class OverBlasterElement extends HTMLElement {
  private ob: OverBlaster | null = null;
  connectedCallback(): void {
    if (this.ob) return;
    if (!this.style.display) this.style.display = "block";
    const num = (n: string) => (this.hasAttribute(n) ? Number(this.getAttribute(n)) : undefined);
    this.ob = OverBlaster.mount(this, {
      assetsUrl: this.getAttribute("assets-url") ?? "./",
      seed: num("seed"),
      skipIntro: this.hasAttribute("skip-intro"),
      sound: !this.hasAttribute("no-sound"),
      keyboard: (this.getAttribute("keyboard") as KeyboardScope | null) ?? "focus",
      motion: !this.hasAttribute("no-motion"),
    });
  }
  disconnectedCallback(): void { this.ob?.destroy(); this.ob = null; }
  /** The mounted game, for scripting. */
  get game(): OverBlaster | null { return this.ob; }
}
export function defineElement(tag = "overblaster-game"): void {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) customElements.define(tag, OverBlasterElement);
}
