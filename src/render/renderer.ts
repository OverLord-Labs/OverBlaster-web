import { CYAN, W } from "../core/constants";
import { BARS_OPEN_AT, BARS_OPEN_S } from "../core/intro";
import { ease, ramp } from "../core/math";
import type { Game } from "../core/game";
import { SKIPS, inBox } from "../core/layout";
import { Draw } from "./draw";
import { drawPlayfield } from "./playfield";
import { drawOver, drawTitle } from "./screens";
import { drawIntro } from "./story";

/**
 * Draws a Game onto a canvas. It only reads the game; it never changes it.
 * The game is drawn in a fixed 640 x 640 logical space and scaled to whatever size the canvas is.
 */
export class Renderer {
  readonly draw: Draw;
  private ro: ResizeObserver | null = null;

  constructor(readonly canvas: HTMLCanvasElement, logo: HTMLImageElement | null = null) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OverBlaster: 2D canvas is not available");
    this.draw = new Draw(ctx, logo);
    this.resize();
    if (typeof ResizeObserver !== "undefined") { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas); }
  }

  /** Match the canvas's backing store to its on-screen size (any aspect ratio) (capped at 2x pixel ratio). */
  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.max(1, Math.round((this.canvas.clientWidth || W) * dpr)), ph = Math.max(1, Math.round((this.canvas.clientHeight || W) * dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
  }

  private open = -1; // how far the widescreen side bars have parted (0 closed, 1 open); -1 until the first frame
  private lastNow = 0;

  /** How open the side bars should be: gameplay uses the whole width; the title, story and game-over screens sit in the central square. */
  private barsTarget(game: Game): number {
    if (game.phase === "play") return 1;
    if (game.phase === "intro") return ease(ramp(game.intro.t, BARS_OPEN_AT, BARS_OPEN_AT + BARS_OPEN_S));
    return 0;
  }

  /** Draw the game. The 640 x 640 square is the glasses' view and sits in the middle; a wider canvas shows more sky to each side. */
  render(game: Game): void {
    const d = this.draw, ctx = d.ctx, k = this.canvas.height / W;
    const now = performance.now(), dt = Math.min(0.1, (now - this.lastNow) / 1000); this.lastNow = now;
    const tgt = this.barsTarget(game);
    if (this.open < 0 || game.phase === "intro") this.open = tgt; // the intro's bars follow its timeline exactly; elsewhere they glide
    else this.open += Math.max(-dt / 0.9, Math.min(dt / 1.2, tgt - this.open));
    const ox = Math.max(0, (this.canvas.width / k - W) / 2); // canvas px beyond the square on each side, in logical px
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, k * ox, 0);
    // everything is drawn inside the window the bars leave open, so nothing can show outside them while they part
    const bw = ox * (1 - this.open);
    ctx.save(); ctx.beginPath(); ctx.rect(-ox + bw, 0, W + 2 * (ox - bw), W); ctx.clip();
    switch (game.phase) {
      case "title": drawTitle(d, game); break;
      case "intro": drawIntro(d, game, drawPlayfield); break;
      case "play": drawPlayfield(d, game); break;
      case "over": drawOver(d, game); break;
    }
    if (game.launching && game.phase === "title") {
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(0, 0, W, W);
      d.text("LOADING SOUND…", 320, 330, 22, CYAN, 700, 5, "center");
    }
    ctx.restore();
    this.drawBars(ox); // the bars are painted last: the top layer
    const ptr = game.input.pointer;
    this.canvas.style.cursor = game.storyBtnVisible() ? (inBox(SKIPS, ptr.x, ptr.y) ? "pointer" : "default") : "none";
  }

  /** The theatrical bars: black on both sides of the square, parting outward as the open amount rises. */
  private drawBars(ox: number): void {
    if (ox <= 0) return;
    const ctx = this.draw.ctx, bw = ox * (1 - this.open);
    if (bw < 0.5) return;
    ctx.fillStyle = "#000"; ctx.fillRect(-ox - 2, -2, bw + 2, W + 4); ctx.fillRect(W + ox - bw, -2, bw + 2, W + 4);
    if (this.open > 0) { ctx.fillStyle = "rgba(0,229,255,.35)"; ctx.fillRect(-ox + bw, 0, 1.5, W); ctx.fillRect(W + ox - bw - 1.5, 0, 1.5, W); } // a thin edge while they move
  }

  destroy(): void {
    this.ro?.disconnect();
  }
}
