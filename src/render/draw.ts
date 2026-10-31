import { GOLD, GREY, W } from "../core/constants";
import type { RGB } from "../core/constants";
import { Rng } from "../core/rng";

export const css = (c: RGB, a?: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a == null ? 1 : a})`;
export const mixc = (a: RGB, b: RGB, u: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * u), Math.round(a[1] + (b[1] - a[1]) * u), Math.round(a[2] + (b[2] - a[2]) * u),
];
export type Pt = [number, number];
const FONT = "Inter, system-ui, sans-serif";

// stars: a fixed field that drifts
interface Star { x: number; y: number; z: number; ph: number; r: number }
const STARS: Star[] = [];
{
  const r = new Rng(1);
  for (let i = 0; i < 70; i++) STARS.push({ x: r.next() * W, y: r.next() * W, z: 0.3 + r.next() * 0.7, ph: r.next() * 6.28, r: 0.6 + r.next() * 1.4 });
}
// a rock: 15 points of jagged radius, with craters, ice and angry eyes
const ROCK: number[] = [];
{
  let seed = 3;
  for (let k = 0; k < 15; k++) { seed = (seed * 1103515245 + 12345) % 2147483648; ROCK.push(0.76 + ((seed % 17) / 17) * 0.24); }
}

/**
 * Canvas2D drawing helpers, bound to one context. All coordinates are logical px (0..640);
 * the renderer sets a transform that scales them to the real canvas.
 * `clockT` is the animation clock the dashed "ghost" outlines read, set by whichever scene is drawing.
 */
export class Draw {
  clockT = 0;
  constructor(public ctx: CanvasRenderingContext2D, public logoImg: HTMLImageElement | null = null) {}

  textW(s: string, size: number, weight?: number, sp?: number): number {
    const c = this.ctx;
    c.font = `${weight || 700} ${size}px ${FONT}`;
    if (!sp) return c.measureText(s).width;
    let w = 0;
    for (let i = 0; i < s.length; i++) w += c.measureText(s[i]).width + sp;
    return w - sp;
  }
  /** Text with optional letter spacing (`sp`), alignment and alpha. `col` is an RGB tuple or any CSS colour string. */
  text(s: string, x: number, y: number, size: number, col: RGB | string, weight?: number, sp?: number, align?: "left" | "center" | "right", alpha?: number): void {
    const c = this.ctx;
    c.save();
    if (alpha != null) c.globalAlpha *= alpha;
    c.font = `${weight || 700} ${size}px ${FONT}`;
    c.fillStyle = typeof col === "string" ? col : css(col);
    c.textBaseline = "alphabetic";
    if (!sp) { c.textAlign = align || "left"; c.fillText(s, x, y); }
    else {
      c.textAlign = "left";
      const total = this.textW(s, size, weight, sp);
      let sx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
      for (let i = 0; i < s.length; i++) { c.fillText(s[i], sx, y); sx += c.measureText(s[i]).width + sp; }
    }
    c.restore();
  }
  polyPath(pts: Pt[]): void {
    const c = this.ctx;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }
  fillPoly(pts: Pt[], fill: string | null, stroke: string | null, lw?: number): void {
    const c = this.ctx;
    this.polyPath(pts);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
  }
  /** A rectangle with its top-left and bottom-right corners cut. */
  cutPlate(x1: number, y1: number, x2: number, y2: number, c: number): Pt[] {
    return [[x1 + c, y1], [x2, y1], [x2, y2 - c], [x2 - c, y2], [x1, y2], [x1, y1 + c]];
  }
  slanted(x: number, y: number, w: number, h: number, s: number): Pt[] {
    return [[x + s, y], [x + s + w, y], [x + w, y + h], [x, y + h]];
  }
  glow(col: RGB | string, blur: number): void {
    this.ctx.shadowColor = typeof col === "string" ? col : css(col); this.ctx.shadowBlur = blur;
  }
  noGlow(): void {
    this.ctx.shadowBlur = 0; this.ctx.shadowColor = "transparent";
  }
  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx;
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  logo(cx: number, cy: number, size: number, alpha?: number): void {
    const img = this.logoImg;
    if (!img || !img.complete) return;
    const c = this.ctx;
    c.save(); c.globalAlpha *= alpha == null ? 1 : alpha; c.drawImage(img, cx - size / 2, cy - size / 2, size, size); c.restore();
  }
  crosshair(x: number, y: number, a?: number): void {
    const c = this.ctx;
    c.save(); c.globalAlpha *= a == null ? 1 : a; c.strokeStyle = "#7dff7d"; c.lineWidth = 3; c.beginPath();
    for (const l of [[-26, 0, -10, 0], [10, 0, 26, 0], [0, -26, 0, -10], [0, 10, 0, 26]]) { c.moveTo(x + l[0], y + l[1]); c.lineTo(x + l[2], y + l[3]); }
    c.stroke(); c.fillStyle = "#fff"; c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); c.restore();
  }
  drawStars(t: number, driftX: number, driftY: number, alpha: number): void {
    const c = this.ctx, base = c.globalAlpha;
    for (const s of STARS) {
      const x = (((s.x - t * driftX * s.z) % W) + W) % W, y = (((s.y + t * driftY * s.z) % W) + W) % W;
      c.globalAlpha = base * alpha * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.ph))) * s.z;
      c.fillStyle = "#fff"; c.beginPath(); c.arc(x, y, s.r, 0, 7); c.fill();
    }
    c.globalAlpha = base;
  }
  /** A rock with craters, ice and (optionally) angry eyes. `rim` picks the colour scheme: GOLD, GREY, or anything else for pink. */
  drawRock(x: number, y: number, r: number, rot: number, rim: RGB, eyes: boolean, hurt: boolean, redOn: boolean): void {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(r, r);
    if (redOn) this.glow("rgba(255,40,40,.95)", 22);
    else if (rim === GREY) this.noGlow();
    else this.glow(rim === GOLD ? "rgba(255,200,0,.8)" : "rgba(255,60,220,.55)", 14);
    c.lineJoin = "round";
    c.beginPath();
    for (let k = 0; k < 15; k++) { const a = (k / 15) * Math.PI * 2, rr = ROCK[k]; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (!k) c.moveTo(px, py); else c.lineTo(px, py); }
    c.closePath();
    c.fillStyle = redOn ? "#5a0a10" : hurt ? "#3a2030" : "#15131b"; c.fill();
    c.strokeStyle = redOn ? "#ff2a2a" : rim === GOLD ? "#ffc800" : "#8da2b4"; c.lineWidth = redOn ? 0.12 : 0.09; c.stroke(); this.noGlow();
    c.fillStyle = "#0b0a10";
    for (const k of [[-0.3, -0.18, 0.2], [0.34, 0.2, 0.15], [0.06, -0.5, 0.11], [-0.4, 0.4, 0.13]]) { c.beginPath(); c.ellipse(k[0], k[1], k[2], k[2] * 0.6, 0, 0, 7); c.fill(); }
    c.fillStyle = "rgba(0,229,255,.85)";
    for (const p of [[-0.7, -0.36], [0.55, -0.55], [0.62, 0.45]]) { this.polyPath([[p[0], p[1] - 0.25], [p[0] + 0.11, p[1]], [p[0], p[1] + 0.25], [p[0] - 0.11, p[1]]]); c.fill(); }
    if (eyes) {
      c.fillStyle = rim === GOLD ? "#ffe27a" : "#ff3cdc";
      this.polyPath([[-0.3, -0.1], [-0.07, -0.23], [-0.07, -0.1]]); c.fill();
      this.polyPath([[0.3, -0.1], [0.07, -0.23], [0.07, -0.1]]); c.fill();
    }
    c.restore();
  }
}
