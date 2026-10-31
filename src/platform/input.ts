import { W } from "../core/constants";
import { emptyInput } from "../core/input";
import type { Command, InputFrame } from "../core/input";

export type KeyboardScope = "window" | "focus" | "off";
export interface InputOptions {
  /** "window": keys work anywhere on the page. "focus": only while the game has focus (best for embedding). */
  keyboard: KeyboardScope;
  /** Use device orientation (phones) to turn the view. */
  motion: boolean;
  /** Called for keys the host owns (e.g. "m" for mute). */
  onKey?: (key: string) => void;
  /** Called first on a pointer press, in game space. Return true if the host used it (a button): the game never sees it. */
  onPress?: (p: { x: number; y: number }) => boolean;
}

const ARROWS: Record<string, "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"> = {
  ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown",
  KeyA: "ArrowLeft", KeyD: "ArrowRight", KeyW: "ArrowUp", KeyS: "ArrowDown",
};

/**
 * Turns browser events (pointer, keys, device orientation) into InputFrames for the core.
 * Call frame() once per animation frame; it hands over what happened since the last call.
 */
export class InputController {
  private keys: Record<string, boolean> = {};
  private space = false;
  private down = false;
  private ptr = { x: 320, y: 320, mouse: false, inside: false };
  private presses: { x: number; y: number }[] = [];
  private commands: Command[] = [];
  private look = { dx: 0, dy: 0 };
  private orient: { alpha: number; beta: number; at: number } | null = null;
  /** Set from outside (the microphone adapter): a loud sound counts as holding fire. */
  micFire = false;
  private off: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private opts: InputOptions) {
    const on = <T extends EventTarget>(t: T, type: string, fn: (e: never) => void, o?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, o); this.off.push(() => t.removeEventListener(type, fn as EventListener, o));
    };
    canvas.style.touchAction = "none";
    on(canvas, "pointermove", (e: PointerEvent) => {
      const p = this.toGame(e);
      if (e.pointerType === "mouse" || e.pointerType === "pen") this.ptr.mouse = true;
      if (e.pointerType === "touch" && this.down) { this.look.dx += p.x - this.ptr.x; this.look.dy += p.y - this.ptr.y; }
      this.ptr.x = p.x; this.ptr.y = p.y; this.ptr.inside = true;
    });
    on(canvas, "pointerleave", () => { this.ptr.inside = false; });
    on(canvas, "pointerdown", (e: PointerEvent) => {
      const p = this.toGame(e);
      if (e.pointerType === "mouse" || e.pointerType === "pen") this.ptr.mouse = true;
      this.ptr.x = p.x; this.ptr.y = p.y;
      if (opts.onPress?.(p)) return;
      this.down = true; this.presses.push(p);
      if (opts.keyboard === "focus") canvas.focus({ preventScroll: true });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable: fine */ }
    });
    on(canvas, "pointerup", () => { this.down = false; });
    on(canvas, "pointercancel", () => { this.down = false; });
    if (opts.keyboard !== "off") {
      if (opts.keyboard === "focus") { canvas.tabIndex = 0; canvas.style.outline = "none"; }
      const target: EventTarget = opts.keyboard === "window" ? window : canvas;
      on(target, "keydown", (e: KeyboardEvent) => this.keydown(e));
      on(target, "keyup", (e: KeyboardEvent) => {
        if (ARROWS[e.code]) this.keys[ARROWS[e.code]] = false;
        if (e.code === "Space") this.space = false;
      });
    }
    on(window, "blur", () => { this.keys = {}; this.space = false; this.down = false; });
    if (opts.motion) {
      on(window, "deviceorientation", (e: DeviceOrientationEvent) => {
        if (e.alpha == null || e.beta == null) return;
        this.orient = { alpha: e.alpha, beta: e.beta, at: performance.now() };
      });
    }
  }

  private keydown(e: KeyboardEvent): void {
    if (ARROWS[e.code]) { e.preventDefault(); this.keys[ARROWS[e.code]] = true; return; }
    if (e.code === "Space") { e.preventDefault(); if (!this.space) { this.space = true; this.presses.push({ x: this.ptr.x, y: this.ptr.y }); } return; }
    if (e.key === "Enter") this.commands.push("launch");
    else if (e.key === "Escape") this.commands.push("skipStory");
    else if (e.key === "c" || e.key === "C") this.commands.push("recenter");
    else if (e.key === "y" || e.key === "Y") this.commands.push("flipYaw");
    else if (e.key === "p" || e.key === "P") this.commands.push("flipPitch");
    else this.opts.onKey?.(e.key);
  }

  private toGame(e: PointerEvent): { x: number; y: number } {
    // game space: the 640 px square is centred; a wider canvas has `ox` more on each side (so x can be negative or past 640)
    const r = this.canvas.getBoundingClientRect(), lw = (W * r.width) / r.height;
    return { x: ((e.clientX - r.left) / r.width) * lw - (lw - W) / 2, y: ((e.clientY - r.top) / r.height) * W };
  }

  /** iOS needs a user gesture to allow motion sensors. Call from a click handler. */
  async requestMotionPermission(): Promise<void> {
    try {
      const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      if (D && typeof D.requestPermission === "function") await D.requestPermission();
    } catch { /* denied: keys and touch still work */ }
  }

  /** Queue a command from outside (a host button, say). */
  command(c: Command): void { this.commands.push(c); }

  /** Everything that happened since the last call. */
  frame(): InputFrame {
    const f = emptyInput();
    f.turn.x = (this.keys.ArrowRight ? 1 : 0) - (this.keys.ArrowLeft ? 1 : 0);
    f.turn.y = (this.keys.ArrowUp ? 1 : 0) - (this.keys.ArrowDown ? 1 : 0);
    f.orientation = this.orient && performance.now() - this.orient.at < 800 ? { alpha: this.orient.alpha, beta: this.orient.beta } : null;
    f.fire = this.down || this.space || this.micFire;
    f.pointer = { ...this.ptr };
    f.look = this.look; this.look = { dx: 0, dy: 0 };
    f.presses = this.presses; this.presses = [];
    f.commands = this.commands; this.commands = [];
    return f;
  }

  destroy(): void { this.off.forEach((f) => f()); this.off = []; }
}
