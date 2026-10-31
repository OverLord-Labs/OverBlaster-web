import { CELLS, CYAN } from "../core/constants";
import type { RGB } from "../core/constants";
import { css, Draw } from "./draw";

const CYs = "0,229,255", GDs = "255,200,0", PKs = "255,60,220";

/**
 * A battery wing: a slanted panel with cell lines. `fill` is the gold fill alpha (0 for none); `ghost` draws a dashed pink
 * outline instead of the cyan one (a wing that is missing). The ghost pulses with d.clockT unless `steady`.
 */
export function wingIcon(d: Draw, x: number, y: number, s: number, fill: number, ghost: boolean, rot?: number, steady = false): void {
  const ctx = d.ctx;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
  const P = [[-70, -14], [70, -40], [70, -8], [-70, 32]];
  ctx.beginPath(); P.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath();
  if (fill > 0) { ctx.fillStyle = `rgba(${GDs},${fill})`; ctx.fill(); }
  ctx.lineWidth = 2.5 / s; ctx.strokeStyle = `rgba(${ghost ? PKs : CYs},${ghost ? (steady ? 0.7 : 0.5 + 0.4 * Math.sin(d.clockT * 5)) : 1})`;
  if (ghost) ctx.setLineDash([8 / s, 6 / s]);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 1; i < 6; i++) { const f = i / 6, px = -70 + f * 140; ctx.moveTo(px, -14 - f * 26); ctx.lineTo(px, 32 - f * 40); }
  ctx.lineWidth = 1.5 / s; ctx.strokeStyle = `rgba(${CYs},${ghost ? 0.25 : 0.7})`; ctx.stroke();
  ctx.restore();
}

/** The battery cells in the top-left of the HUD (two rows of ten). */
export function drawCells(d: Draw, clock: number, frac: number, tone: RGB, lastPulse: boolean, alpha: number, litOverride?: number | null): void {
  const ctx = d.ctx;
  const lit = litOverride != null ? litOverride : frac <= 0 ? 0 : Math.min(CELLS, Math.max(1, Math.ceil(frac * CELLS)));
  for (let i = 0; i < CELLS; i++) {
    const x = 26 + (i % 10) * 12.5, y = 8 + Math.floor(i / 10) * 30, pts = d.slanted(x, y, 9.5, 24, 4);
    if (i >= lit) { d.fillPoly(pts, null, "rgba(255,255,255,.22)", 1); continue; }
    const a = alpha * (lastPulse && i === lit - 1 ? 0.55 + 0.45 * Math.abs(Math.sin(clock * 4)) : 1);
    d.polyPath(pts); ctx.strokeStyle = css(tone, 0.28 * a); ctx.lineWidth = 5; ctx.stroke(); d.fillPoly(pts, css(tone, 0.95 * a), css(tone, a), 1);
  }
}
export { CYAN };
