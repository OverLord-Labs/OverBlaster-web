import { CYAN, W } from "../core/constants";
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

  /** Match the canvas's backing store to its on-screen size (capped at 2x pixel ratio). */
  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const css = this.canvas.clientWidth || W;
    const px = Math.max(1, Math.round(css * dpr));
    if (this.canvas.width !== px || this.canvas.height !== px) { this.canvas.width = px; this.canvas.height = px; }
  }

  render(game: Game): void {
    const d = this.draw, ctx = d.ctx, k = this.canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
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
    const ptr = game.input.pointer;
    this.canvas.style.cursor = game.storyBtnVisible() ? (inBox(SKIPS, ptr.x, ptr.y) ? "pointer" : "default") : "none";
  }

  destroy(): void {
    this.ro?.disconnect();
  }
}
