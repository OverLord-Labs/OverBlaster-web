import { BAD, GAUGE_LIFE } from "../core/constants";
import type { RGB } from "../core/constants";
import type { Game } from "../core/game";
import { clamp, ease, ramp } from "../core/math";
import type { Gauge } from "../core/types";
import { onScreen } from "../core/view";
import { drawPointer } from "./arrows";
import { css, Draw, mixc } from "./draw";

/** The Overlord BMS chip. */
export function drawChip(d: Draw, x: number, y: number, size: number, sc: number): void {
  const ctx = d.ctx;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); const s = size / 2; d.glow("rgba(0,229,255,.6)", 12);
  ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 3; ctx.fillStyle = "#001a1f"; ctx.beginPath(); d.roundRect(-s * 0.62, -s * 0.62, s * 1.24, s * 1.24, s * 0.1); ctx.fill(); ctx.stroke(); d.noGlow();
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const o = (i - 1.5) * s * 0.34; ctx.moveTo(o, -s * 0.62); ctx.lineTo(o, -s * 0.9); ctx.moveTo(o, s * 0.62); ctx.lineTo(o, s * 0.9); ctx.moveTo(-s * 0.62, o); ctx.lineTo(-s * 0.9, o); ctx.moveTo(s * 0.62, o); ctx.lineTo(s * 0.9, o); }
  ctx.stroke();
  d.logo(0, 0, s * 1.05); ctx.restore();
}

// a bad gauge: a chip that has seen better days. Chipped corner, a crack, bent and missing leads, burn marks; red or blue.
export function drawBadChip(d: Draw, clock: number, x: number, y: number, size: number, col: RGB, seed: number, alpha: number): void {
  const ctx = d.ctx, s = size / 2, dark = css(mixc(col, [0, 0, 0], 0.85)), cc = css(col);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(clock * 1.7 + seed) * 0.3 + ((seed % 7) - 3) * 0.1); ctx.globalAlpha *= alpha;
  d.glow(css(col, 0.8), 14); ctx.lineWidth = 3; ctx.strokeStyle = cc; ctx.fillStyle = dark;
  d.polyPath([[-0.62 * s, -0.62 * s], [0.28 * s, -0.62 * s], [0.62 * s, -0.26 * s], [0.62 * s, 0.62 * s], [-0.62 * s, 0.62 * s]]); ctx.fill(); ctx.stroke(); d.noGlow();
  ctx.beginPath();
  for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) {
    const o = (i - 1.5) * s * 0.34, h = (seed * 31 + k * 7 + i * 13) % 10, len = h < 4 ? 0.3 : 0.9, kx = h < 2 ? 0 : 0.12 * s; // h<2: lead is gone; h<4: a bent stub
    if (k === 0 && i === 3) continue;
    if (h < 2) continue;
    const x0 = k === 2 ? -0.62 * s : k === 3 ? 0.62 * s : o, y0 = k === 0 ? -0.62 * s : k === 1 ? 0.62 * s : o, dx = k === 2 ? -1 : k === 3 ? 1 : 0, dy = k === 0 ? -1 : k === 1 ? 1 : 0;
    ctx.moveTo(x0, y0);
    const mx = x0 + dx * (len - 0.62) * s * 0.5 + (dx ? 0 : kx * 0.5), my = y0 + dy * (len - 0.62) * s * 0.5 + (dy ? 0 : kx * 0.5);
    ctx.lineTo(mx, my);
    if (h < 4) ctx.lineTo(mx + (dx ? 0 : kx), my + (dy ? 0 : kx)); else ctx.lineTo(x0 + dx * (len - 0.62) * s, y0 + dy * (len - 0.62) * s);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2; d.glow(css(col), 8); ctx.beginPath();
  ctx.moveTo(0.5 * s, -0.4 * s); ctx.lineTo(0.18 * s, -0.12 * s); ctx.lineTo(0.3 * s, 0.05 * s); ctx.lineTo(-0.1 * s, 0.22 * s); ctx.lineTo(-0.05 * s, 0.4 * s); ctx.lineTo(-0.4 * s, 0.62 * s); ctx.stroke(); d.noGlow(); // the crack
  ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.beginPath(); ctx.ellipse(-0.25 * s, -0.2 * s, 0.22 * s, 0.15 * s, 0.4, 0, 7); ctx.fill(); // a burn mark
  ctx.fillStyle = css(col, 0.5 + 0.5 * Math.sin(clock * 20 + seed)); ctx.beginPath(); ctx.arc(-0.45 * s, 0.4 * s, 0.07 * s, 0, 7); ctx.fill(); // a dying LED
  ctx.restore();
}

export function drawGauge(d: Draw, game: Game, q: Gauge): void {
  const ctx = d.ctx, clock = game.clock, p = game.proj(q.az, q.el);
  if (!onScreen(p, 60)) { drawPointer(d, game, q.az, q.el, BAD[q.color].col, 40); return; }
  const col = BAD[q.color].col, fade = q.age > GAUGE_LIFE - 2 && !q.first ? (Math.sin(clock * 18) > 0 ? 1 : 0.25) : 1, pop = ease(ramp(q.age, 0, 0.25)), prog = clamp(q.dwell / q.hold, 0, 1);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.scale(pop, pop); ctx.translate(-p.x, -p.y);
  ctx.save(); ctx.setLineDash([7, 7]); ctx.lineDashOffset = -clock * 30; ctx.strokeStyle = css(col, 0.55 + 0.3 * Math.sin(clock * 8)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 62, 0, 7); ctx.stroke(); ctx.restore(); // a warning ring: stay out of it
  ctx.save(); ctx.setLineDash([4, 10]); ctx.lineDashOffset = -clock * 40; ctx.strokeStyle = css(col, 0.35); ctx.lineWidth = 2; ctx.beginPath(); const apx = game.aimPx(); ctx.moveTo(p.x, p.y); ctx.lineTo(apx.x, apx.y); ctx.stroke(); ctx.restore(); // its tether to your crosshair
  drawBadChip(d, clock, p.x, p.y, 92, col, q.seed, 1);
  if (prog > 0) { ctx.strokeStyle = css(col, 1); ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(p.x, p.y, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke(); }
  ctx.restore();
}
