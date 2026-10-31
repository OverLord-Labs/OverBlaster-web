import { CYAN, GOLD, PINK, W } from "../core/constants";
import type { Game } from "../core/game";
import { LAUNCH, RETRY, TOTITLE, inBox } from "../core/layout";
import { ramp } from "../core/math";
import { css, Draw } from "./draw";

const bootAlpha = (t: number, delay: number): number => {
  if (t < delay) return 0.06;
  const ph = ((((t - delay) % 2.6) + 2.6) % 2.6) / 2.6;
  if (ph < 0.28) return 0.06 + (0.89 * ph) / 0.28;
  if (ph < 0.62) return 0.95;
  return 0.95 - (0.89 * (ph - 0.62)) / 0.38;
};

export function drawTitle(d: Draw, game: Game): void {
  const ctx = d.ctx, clock = game.clock, ptr = game.input.pointer;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, W); d.drawStars(clock, 3, 0, 0.7);
  for (let i = 0; i < 20; i++) {
    const x = 88 + i * 23;
    d.fillPoly(d.slanted(x, 126, 18, 16, 8), css(CYAN, bootAlpha(clock, i * 0.07)), null);
    d.fillPoly(d.slanted(x, 282, 18, 16, 8), css(CYAN, bootAlpha(clock, (19 - i) * 0.07)), null);
  }
  const s = "OVERBLASTER";
  let size = 66;
  while (size > 40 && d.textW(s, size, 900, 5) > 560) size -= 2;
  ctx.save(); ctx.translate(320, 238); ctx.transform(1, 0, -0.176, 1, 0, 0); d.glow("rgba(255,255,255,.5)", 14); d.text(s, 0, 0, size, "#fff", 900, 5, "center"); d.noGlow(); ctx.restore();
  d.text("AN OVERLORD LABS GAME", 320, 334, 16, GOLD, 700, 7, "center");
  d.text("TURN YOUR HEAD TO AIM", 320, 382, 20, "#fff", 500, 1, "center");
  d.text(game.controls === "select" ? "PRESS SELECT TO FIRE" : "SAY “PEW” TO FIRE", 320, 414, 20, "#fff", 500, 1, "center");
  d.text("HOLD YOUR AIM ON CRYSTALS TO HARVEST THEM", 320, 446, 20, "#fff", 500, 1, "center");
  const b = LAUNCH, hov = inBox(b, ptr.x, ptr.y);
  d.fillPoly(d.cutPlate(b.x, b.y, b.x + b.w, b.y + b.h, 14), hov ? "rgba(0,229,255,.18)" : "rgba(0,229,255,.06)", css(CYAN, 0.9), 2);
  d.text("LAUNCH", 320, 532, 28, CYAN, 700, 3, "center");
  if (game.controls !== "select") d.text("WASD / ARROW KEYS · MOUSE AIMS · CLICK = PEW", 320, 590, 16, CYAN, 500, 3, "center");
  if (ptr.inside) d.crosshair(ptr.x, ptr.y);
}

export function drawOver(d: Draw, game: Game): void {
  const ctx = d.ctx, ptr = game.input.pointer, g = game.run, over = game.over;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, W); d.drawStars(game.clock, 2, 0, 0.5);
  const hull = g.lostCause === "hull", won = g.lostCause === "win", a = ramp(over ? over.t : 0, 0, 0.5);
  ctx.save(); ctx.globalAlpha = a;
  d.text(won ? "BELT CLEARED" : hull ? "HULL DESTROYED" : "BATTERY DEAD", 320, 140, 48, won ? GOLD : PINK, 900, 4, "center");
  d.text(won ? "Both wings are home. The Meridian can jump again." : hull ? "A rock reached your ship." : "You ran out of energy.", 320, 190, 22, "#fff", 500, 1, "center");
  d.text(`SCORE ${g.score.toLocaleString("en-US")}    LEVEL ${g.level}`, 320, 252, 28, CYAN, 700, 2, "center");
  if (won) d.logo(320, 296, 56);
  for (const [r, label] of [[RETRY, "RETRY"], [TOTITLE, "TITLE"]] as const) {
    const hov = inBox(r, ptr.x, ptr.y);
    d.fillPoly(d.cutPlate(r.x, r.y, r.x + r.w, r.y + r.h, 12), hov ? "rgba(0,229,255,.18)" : "rgba(0,229,255,.06)", css(CYAN, 0.9), 2);
    d.text(label, 320, r.y + 42, 26, CYAN, 700, 4, "center");
  }
  ctx.restore();
  if (ptr.inside) d.crosshair(ptr.x, ptr.y);
}
