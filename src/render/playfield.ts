import {
  BADGE_AT, BLINK_FROM, CENTER, CHIP_HOLD, CYAN, GOLD, HARVEST, LOW, PINK, PPD, SPLASH_END, W, WING_HOLD,
} from "../core/constants";
import { rockRadius } from "../core/game";
import type { Game } from "../core/game";
import { levelName } from "../core/levels";
import { clamp, ease, lerp, ramp } from "../core/math";
import type { Pickup } from "../core/types";
import { onScreen } from "../core/view";
const visible = (game: { ox: number }, p: { x: number; y: number }, m: number): boolean => onScreen(p, m, game.ox);
import { drawPointer, drawRockArrows } from "./arrows";
import { css, Draw } from "./draw";
import { drawAward, drawCallout, drawPlate } from "./hud";
import { drawBadChip, drawChip, drawGauge } from "./pickups";
import { drawCells, wingIcon } from "./sprites";

export { drawChip, drawBadChip };

const HALF = Math.PI / 2;

/** The ring, label and "slipped" arrow for a hold-to-collect pickup (the chip and the wings). */
function holdRing(d: Draw, game: Game, c: Pickup, cx: number, cy: number, radius: number, prog: number): void {
  const ctx = d.ctx;
  void game;
  ctx.strokeStyle = css(prog > 0 && !c.onTarget ? PINK : GOLD, 0.25); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 7); ctx.stroke();
  if (prog > 0) { ctx.strokeStyle = css(!c.onTarget ? PINK : GOLD); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, radius, -HALF, -HALF + Math.PI * 2 * prog); ctx.stroke(); }
}
function slipArrow(d: Draw, game: Game, cx: number, cy: number): void {
  const ctx = d.ctx, ang = Math.atan2(cy - CENTER, cx - CENTER), al = 0.65 + 0.35 * Math.sin(game.clock * 10);
  ctx.save(); ctx.translate(CENTER + Math.cos(ang) * 52, CENTER + Math.sin(ang) * 52); ctx.rotate(ang); ctx.fillStyle = css(PINK, al);
  d.polyPath([[-12, -12], [14, 0], [-12, 12], [-5, 0]]); ctx.fill(); ctx.restore();
}

export function drawPlayfield(d: Draw, game: Game): void {
  const ctx = d.ctx, g = game.run, t = g.t, clock = game.clock, ptr = game.input.pointer;
  d.clockT = clock;
  const ox = game.ox; ctx.fillStyle = "#000"; ctx.fillRect(-ox, 0, W + 2 * ox, W); // no stars here: on the glasses, black is see-through
  ctx.save();
  if (g.shake > 0) ctx.translate(Math.sin(clock * 90) * 8 * g.shake, Math.cos(clock * 70) * 8 * g.shake);
  // the level splash hangs in the sky above where you were looking: turn away and it slides out of view
  const st = clock - g.splashT0, sa = st < 0 ? 0 : st < 0.3 ? (0.55 * st) / 0.3 : st <= 6.0 ? 0.55 : st < SPLASH_END ? (0.55 * (SPLASH_END - st)) / (SPLASH_END - 6.0) : 0;
  if (sa > 0) {
    const sp = game.proj(g.splashAz, g.splashEl);
    ctx.save(); ctx.globalAlpha = 0.7; ctx.translate(sp.x - 320, sp.y - 186 - 18 * (1 - ease(ramp(st, 0, 0.6))));
    d.fillPoly(d.cutPlate(40, 124, 600, 248, 22), "rgba(0,229,255," + (0.06 * sa) / 0.55 + ")", css(CYAN, (0.8 * sa) / 0.55), 2);
    d.glow(css(CYAN, 0.5), 8); d.fillPoly([[78, 140], [196, 140], [182, 232], [64, 232]], css(CYAN, Math.min(0.9, (0.9 * sa) / 0.55)), null); d.noGlow();
    d.text("LVL", 124, 164, 16, "#000", 700, 3, "center", sa / 0.55);
    ctx.save(); ctx.translate(124, 220); ctx.transform(1, 0, -0.176, 1, 0, 0); d.text(String(g.level), 0, 0, 62, "#000", 900, 0, "center", sa / 0.55); ctx.restore();
    const nm = levelName(g.level);
    let size = 54;
    while (size > 30 && d.textW(nm, size, 800, 4) > 340) size -= 2;
    d.text(nm, 224, 186 + size * 0.36, size, "#fff", 800, 4, "left", sa / 0.55);
    ctx.restore();
  }
  // rocks, far to near
  const live = game.liveRocks().sort((x, y) => x.p - y.p);
  for (const w of live) {
    let p: { x: number; y: number } = game.proj(w.az, w.el), r = rockRadius(w) * PPD, al = 1;
    if (w.arrive) {
      const u = clamp((clock - w.arrive.t0 - w.arrive.delay) / w.arrive.dur, 0, 1);
      if (u <= 0) continue;
      const k = u * u;
      p = { x: CENTER + (p.x - CENTER) * k, y: CENTER + (p.y - CENTER) * k }; r = r * (0.12 + 0.88 * k); al = Math.min(1, u * 6);
    }
    if (!visible(game, p, r + 30)) continue;
    const blink = w.p >= BLINK_FROM && Math.sin(clock * 6.283 * lerp(3, 10, ramp(w.p, BLINK_FROM, 1))) > 0; // faster and faster as it closes
    ctx.save(); ctx.globalAlpha = al; d.drawRock(p.x, p.y, r, w.rot, w.carrier ? GOLD : PINK, true, w.hurt > 0, blink); ctx.restore();
    if (w.hp < w.max) {
      const by = Math.min(p.y + r + 6, 596), bw = Math.min(r * 1.4, 220);
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(p.x - bw / 2, by, bw, 3); ctx.fillStyle = css(w.carrier ? GOLD : PINK, 0.9); ctx.fillRect(p.x - bw / 2, by, bw * (w.hp / w.max), 3);
    }
  }
  // crystals
  for (const c of g.crystals) {
    const p = game.proj(c.az, c.el);
    if (!visible(game, p, 40)) continue;
    const pul = 1 + 0.12 * Math.sin(clock * 6 + c.az);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(clock * 1.5); ctx.scale(pul, pul); d.glow("rgba(255,200,0,.9)", 10); d.fillPoly([[0, -14], [9, 0], [0, 14], [-9, 0]], "#ffc800", "#fff3b0", 1.5); d.noGlow(); ctx.restore();
    if (c.dwell > 0) { ctx.strokeStyle = css(GOLD, 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 22, -HALF, -HALF + (Math.PI * 2 * c.dwell) / HARVEST); ctx.stroke(); }
  }
  g.gauges.forEach((q) => drawGauge(d, game, q));
  // the Overlord BMS chip: hold ring, label, and an arrow back to it when your aim slips
  if (g.chip) {
    const c = g.chip, p = game.proj(c.az, c.el), prog = clamp(c.dwell / CHIP_HOLD, 0, 1);
    if (visible(game, p, 80)) {
      const cx = p.x + Math.sin(clock * 2) * 4, cy = p.y + Math.cos(clock * 3) * 3;
      holdRing(d, game, c, cx, cy, 58, prog);
      drawChip(d, cx, cy, 90, 1 + (prog > 0.95 ? 0.1 : 0));
      const lx = clamp(cx, 16 + 205, W - 16 - 205); d.text("HOLD YOUR AIM ON THE CHIP", lx, cy + 112, 18, "#fff", 700, 4, "center");
      if (!c.onTarget) slipArrow(d, game, cx, cy);
    }
  }
  // a battery wing: hold ring, label, and an arrow back to it when your aim slips
  if (g.wing) {
    const wg = g.wing, wp = game.proj(wg.az, wg.el), wprog = clamp(wg.dwell / WING_HOLD, 0, 1);
    if (visible(game, wp, 90)) {
      const wx = wp.x + Math.sin(clock * 1.6) * 5, wy = wp.y + Math.cos(clock * 2.3) * 4;
      holdRing(d, game, wg, wx, wy, 70, wprog);
      d.glow("rgba(255,200,0,.8)", 16); wingIcon(d, wx, wy, 0.95, 0.9, false, -0.2 + Math.sin(clock * 1.3) * 0.08); d.noGlow();
      const lx = clamp(wx, 16 + 205, W - 16 - 205); d.text("HOLD YOUR AIM ON THE WING", lx, wy + 118, 18, "#fff", 700, 4, "center");
      if (!wg.onTarget) slipArrow(d, game, wx, wy);
    }
  }
  // pointer arrows: blue to the closest rock, gold to the closest crystal or chip, only while it is out of view
  if (g.mode !== "lost") drawRockArrows(d, game, live.filter((w) => !game.arriving(w))); // an arrow for every rock out of view; red when it is critically close (drawn last, nearest on top)
  let tg: { az: number; el: number } | null = null, td = 1e9;
  for (const c of g.crystals) { const dd = game.angDist(c.az, c.el); if (dd < td) { td = dd; tg = c; } }
  if (g.chip) tg = g.chip;
  if (g.wing) tg = g.wing;
  if (tg && g.mode !== "lost") drawPointer(d, game, tg.az, tg.el, GOLD, 32);
  // the shot: a bolt that streaks in diagonally from off-screen, alternating lower right and lower left
  if (g.flash > 0) {
    const cx0 = g.flashSide > 0 ? W + ox : -ox, gl = ctx.createRadialGradient(cx0, W, 0, cx0, W, 150);
    gl.addColorStop(0, "rgba(255,226,122," + (0.55 * g.flash) / 0.09 + ")"); gl.addColorStop(1, "rgba(255,226,122,0)");
    ctx.fillStyle = gl; ctx.fillRect(g.flashSide > 0 ? W + ox - 160 : -ox, W - 160, 160, 160);
  }
  for (const b of g.bolts) {
    const f = b.t / 0.14, head = clamp(f, 0, 1), tail = clamp(f - 0.5, 0, 1), sx = b.side > 0 ? W + ox + 80 : -ox - 80, sy = W + 110;
    const hx = lerp(sx, b.tx, head), hy = lerp(sy, b.ty, head), tx = lerp(sx, b.tx, tail), ty = lerp(sy, b.ty, tail), fade = 1 - ramp(b.t, 0.12, 0.22);
    ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = "round"; d.glow("rgba(255,60,220,.9)", 14); ctx.strokeStyle = "rgba(255,60,220,.65)"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke(); d.noGlow();
    ctx.strokeStyle = "#ffe0fb"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(lerp(tx, hx, 0.3), lerp(ty, hy, 0.3)); ctx.lineTo(hx, hy); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, 7); ctx.fill(); ctx.restore();
  }
  for (const f of g.fx) {
    if (f.t < 0) continue;
    const p = game.proj(f.az, f.el);
    if (f.k === "burst") {
      const b = f.t / 0.9, a1 = Math.max(0, 1 - b);
      if (b < 1) {
        ctx.strokeStyle = css(f.col, 0.9 * a1); ctx.lineWidth = 8 - 6 * b; ctx.beginPath(); ctx.arc(p.x, p.y, f.r * 0.5 + 170 * ease(b), 0, 7); ctx.stroke();
        for (let i = 0; i < 10; i++) {
          const an = (i / 10) * 6.283, r1 = 20 + 110 * ease(b), r2 = r1 + 26 * (1 - b);
          ctx.strokeStyle = css(f.col, a1); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(an) * r1, p.y + Math.sin(an) * r1); ctx.lineTo(p.x + Math.cos(an) * r2, p.y + Math.sin(an) * r2); ctx.stroke();
        }
      }
    } else if (f.k === "spark") {
      const s = f.t / 0.25;
      if (s < 1) { ctx.fillStyle = "rgba(255,255,255," + 0.9 * (1 - s) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, 10 + 10 * s, 0, 7); ctx.fill(); }
    } else if (f.k === "glitch") {
      const gl2 = f.t / 0.55;
      if (gl2 < 1) {
        const seedn = Math.floor(f.t * 24);
        for (let j = 0; j < 7; j++) { const hh = ((seedn * 37 + j * 91) % 100) / 100; ctx.fillStyle = css(f.col, (1 - gl2) * (0.5 + 0.4 * hh)); ctx.fillRect(p.x - 60 + hh * 40 - j * 3, p.y - 40 + j * 12 + hh * 6, 30 + hh * 80, 3 + (j % 3) * 2); }
      }
    } else if (f.k === "ping") {
      const p2 = f.t / 0.5;
      if (p2 < 1) { ctx.strokeStyle = css(GOLD, 1 - p2); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 14 + 30 * p2, 0, 7); ctx.stroke(); }
    }
  }
  for (const f of g.floaters) { const p = game.proj(f.az, f.el); d.text(f.s, p.x, p.y - 20 - 40 * ease(f.t / 1.2), 28, GOLD, 900, 0, "center", 1 - f.t / 1.2); }
  drawAward(d, game);
  const frac = clamp(g.charge / g.capacity, 0, 1), tone = frac < LOW ? PINK : g.bad ? g.bad.col : g.chipCollected ? GOLD : CYAN, aT = g.awardT0 != null ? clock - g.awardT0 : null;
  drawCells(d, clock, frac, tone, true, 1);
  ctx.strokeStyle = css(tone, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(164, 8); ctx.lineTo(164, 62); ctx.stroke();
  d.text("LVL " + g.level, 176, 44, 26, tone, 700, 2);
  for (let wk = 0; wk < 2; wk++) wingIcon(d, 364 + wk * 46, 35, 0.3, g.wings > wk ? 0.9 : 0.12, g.wings <= wk, -0.15, true);
  d.text(String(g.score), 535, 40, 28, "#fff", 700, 0, "right");
  const badge = aT != null ? ramp(aT, BADGE_AT, BADGE_AT + 0.5) : g.chipCollected ? 1 : 0;
  if (g.bad) {
    const bu = ramp(clock - g.badT0, 0, 0.4), bk = 0.5 + 0.5 * ease(bu), bcol = g.bad.col;
    ctx.save(); ctx.translate(64, 82); ctx.scale(bk, bk); ctx.translate(-64, -82); ctx.globalAlpha = Math.min(1, bu * 3) * (0.8 + 0.2 * Math.sin(clock * 5)); ctx.fillStyle = css(bcol);
    ctx.beginPath(); d.roundRect(26, 68, 104, 28, 14); ctx.fill(); drawBadChip(d, clock, 44, 82, 24, [255, 255, 255], 3, 1); d.text("−" + g.bad.cut, 106, 89, 16, "#000", 900, 0, "center"); ctx.restore();
  } else if (badge > 0) {
    const u = badge, k = 0.4 + 0.6 * ease(u) + 0.25 * Math.sin(u * Math.PI);
    ctx.save(); ctx.translate(64, 82); ctx.scale(k, k); ctx.translate(-64, -82); ctx.globalAlpha = Math.min(1, u * 3); ctx.fillStyle = "#ffc800";
    ctx.beginPath(); d.roundRect(26, 68, 76, 28, 14); ctx.fill(); d.logo(40, 82, 24); d.text("×2", 76, 89, 17, "#000", 900, 0); ctx.restore();
  }
  if (g.mode === "intermission") drawPlate(d, game);
  if (g.tutorial && g.level === 1 && g.mode === "playing") {
    const tt = clock - g.tutT0, p1 = ramp(tt, 2.6, 3.0) * (1 - ramp(tt, 7.0, 7.4)), p2 = ramp(tt, 7.4, 7.8) * (0.7 + 0.3 * Math.sin(tt * 12));
    const ms = ptr.mouse;
    const sel = game.controls === "select";
    d.text(ms && !sel ? "AIM WITH THE MOUSE" : "TURN YOUR HEAD", 320, 548, 22, CYAN, 700, 6, "center", p1);
    if (!sel) d.text(ms ? "WASD OR ARROW KEYS TURN YOUR VIEW" : game.view.sensorLive ? "PHONE MOTION" : "WASD OR ARROW KEYS", 320, 576, 15, CYAN, 500, 5, "center", p1 * 0.8);
    d.text(sel ? "PRESS SELECT" : ms ? "CLICK TO FIRE" : "SAY “PEW”", 320, 548, 28, GOLD, 900, 6, "center", p2);
    if (!sel) d.text(ms ? "OR HOLD SPACE" : "HOLD SPACE (OR SAY IT, WITH THE MIC ON)", 320, 576, 15, GOLD, 500, 3, "center", p2 * 0.8);
  }
  const bt = clock - g.badT0;
  if (bt >= 0 && bt < 0.8 && g.bad) {
    const bc = g.bad.col;
    ctx.fillStyle = css(bc, 0.38 * (1 - bt / 0.8)); ctx.fillRect(-ox, 0, W + 2 * ox, W);
    for (let q2 = 0; q2 < 9; q2++) { const rh = ((Math.floor(bt * 30) * 53 + q2 * 29) % 100) / 100; ctx.fillStyle = css(bc, 0.55 * (1 - bt / 0.8)); ctx.fillRect(rh * 300, rh * 640, 200 + rh * 300, 4 + (q2 % 4) * 3); }
  }
  drawCallout(d, game);
  if (g.mode === "lost") { const lt = ramp(g.lostT, 0, 0.6); ctx.fillStyle = "rgba(255,60,220," + 0.16 * lt * (g.lostCause === "hull" ? 1 : 0) + ")"; ctx.fillRect(-ox, 0, W + 2 * ox, W); }
  ctx.restore();
  const apx = game.aimPx(); d.crosshair(apx.x, apx.y, g.mode === "lost" ? 0.3 : 1); // the crosshair follows the mouse (the view follows the arrow keys)
}
