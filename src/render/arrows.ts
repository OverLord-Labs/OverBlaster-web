import { CRITICAL, CYAN, GOLD, POINTER_RING, RED, CENTER } from "../core/constants";
import type { RGB } from "../core/constants";
import { rockRadius } from "../core/game";
import type { Game } from "../core/game";
import type { Rock } from "../core/types";
import { onScreen } from "../core/view";
const visible = (game: { ox: number }, p: { x: number; y: number }, m: number): boolean => onScreen(p, m, game.ox);
import { css, Draw } from "./draw";
import { PPD } from "../core/constants";

export function drawArrow(d: Draw, clock: number, ang: number, radius: number, col: RGB, scale: number, crit: boolean): void {
  const ctx = d.ctx, k = scale * (crit ? 1.35 + 0.15 * Math.sin(clock * 12) : 1);
  ctx.save(); ctx.translate(CENTER + Math.cos(ang) * radius, CENTER + Math.sin(ang) * radius); ctx.rotate(ang); ctx.scale(k, k);
  ctx.globalAlpha *= crit ? 0.75 + 0.25 * Math.sin(clock * 12) : 0.9;
  d.glow(css(col, 0.8), crit ? 16 : 10); d.fillPoly([[18, 0], [-12, -15], [-4, 0], [-12, 15]], css(col, 0.95), null); d.noGlow(); ctx.restore();
}

/** An arrow toward a point of the sky, only while it is out of view. */
export function drawPointer(d: Draw, game: Game, az: number, el: number, col: RGB, margin: number): void {
  const p = game.proj(az, el);
  if (!visible(game, p, margin)) drawArrow(d, game.clock, Math.atan2(p.dy, p.dx), POINTER_RING, col, 1, false);
}

// one arrow for every rock that is out of view. Arrows that point the same way are stacked inward, the nearest rock outermost; a rock that is critically close gets a red, pulsing arrow
export function drawRockArrows(d: Draw, game: Game, rocks: Rock[]): void {
  interface Item { ang: number; p: number; crit: boolean; col: RGB }
  const items: Item[] = [];
  for (const w of rocks) {
    const p = game.proj(w.az, w.el);
    if (visible(game, p, rockRadius(w) * PPD)) continue;
    items.push({ ang: Math.atan2(p.dy, p.dx), p: w.p, crit: w.p >= CRITICAL, col: w.carrier ? GOLD : CYAN });
  }
  items.sort((a, b) => a.ang - b.ang);
  let group: Item[] = [];
  const groups: Item[][] = [];
  for (const it of items) { if (group.length && it.ang - group[group.length - 1].ang > 0.2) { groups.push(group); group = []; } group.push(it); }
  if (group.length) groups.push(group);
  for (const g of groups) {
    g.sort((a, b) => a.p - b.p);
    g.forEach((it, i) => { const depth = Math.min(5, g.length - 1 - i); drawArrow(d, game.clock, it.ang, POINTER_RING - 17 * depth, it.crit ? RED : it.col, 1 - 0.07 * depth, it.crit); });
  }
}
