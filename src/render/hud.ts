import { ACK_MIN, BADGE_AT, BAD, BUBBLE_FOLD, BUBBLE_IN, CELLS, COUNT_S, CYAN, GAUGE_LEVEL, GOLD, LOW, PINK } from "../core/constants";
import type { Game } from "../core/game";
import { levelName, levelNote } from "../core/levels";
import { clamp, ease, lerp, ramp } from "../core/math";
import { css, Draw } from "./draw";

export function drawCallout(d: Draw, game: Game): void {
  const co = game.run.callout, ctx = d.ctx;
  if (!co) return;
  const ct = game.clock - co.t0;
  if (ct > co.dur) return;
  let sz = 14;
  const a = ramp(ct, 0, 0.25) * (1 - ramp(ct, co.dur - 0.5, co.dur));
  while (sz > 10 && d.textW(co.b, sz, 700, 2) > 600) sz -= 1;
  ctx.save(); ctx.globalAlpha = a * 0.75; ctx.fillStyle = "#000"; ctx.fillRect(20, 492, 600, 70); ctx.restore();
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = css(co.col, 0.9); ctx.lineWidth = 2; ctx.strokeRect(20, 492, 600, 70); ctx.restore();
  d.text(co.a, 320, 526, 28, co.col, 900, 4, "center", a); d.text(co.b, 320, 551, sz, "#fff", 700, 2, "center", a);
}

/** The BMS award: a ring, cells flying to the battery, the medallion and the callout. */
export function drawAward(d: Draw, game: Game): void {
  const g = game.run, ctx = d.ctx;
  if (g.awardT0 == null || !g.awardOrigin) return;
  const t = game.clock - g.awardT0, o = g.awardOrigin;
  const br = ramp(t, 0, 0.9);
  if (br < 1) { ctx.strokeStyle = css(GOLD, 0.9 * (1 - br)); ctx.lineWidth = 7 * (1 - br) + 1; ctx.beginPath(); ctx.arc(o.x, o.y, 20 + 180 * ease(br), 0, 7); ctx.stroke(); }
  for (let i = 0; i < 10; i++) {
    const s0 = 0.1 + i * 0.1, u = ease(ramp(t, s0, s0 + 1.0)), a = (i / 10) * 6.283, k = ramp(t, 0, 0.3), al = ramp(t, 0, 0.1) * (1 - ramp(t, s0 + 1.0, s0 + 1.2));
    if (al <= 0) continue;
    const bx = o.x + Math.cos(a) * 60 * k, by = o.y + Math.sin(a) * 60 * k;
    ctx.fillStyle = css(CYAN, al); ctx.beginPath(); ctx.arc(lerp(bx, 31 + i * 12.5, u), lerp(by, 20, u), 5, 0, 7); ctx.fill();
  }
  // the medallion and the callout
  const grow = ease(ramp(t, BUBBLE_IN, BUBBLE_IN + 0.5)), fold = ease(ramp(t, BUBBLE_FOLD, BUBBLE_FOLD + 0.8)), sc = grow * (1 - fold);
  const su = ramp(t, BUBBLE_IN, BUBBLE_IN + 1.0), sx = Math.cos(su * Math.PI * 4) * (1 - su) + su, ma = ramp(t, BUBBLE_IN, BUBBLE_IN + 0.2);
  if (ma > 0) {
    const hp = (t * 1.1) % 1, halo = 0.7 * (1 - hp) * ramp(t, BUBBLE_IN + 1.0, BUBBLE_IN + 1.3);
    if (halo > 0) { ctx.strokeStyle = css(CYAN, halo); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(298, 36, 28 + 10 * hp, 0, 7); ctx.stroke(); }
    ctx.save(); ctx.globalAlpha = ma; ctx.translate(298, 36); ctx.scale(Math.max(0.05, Math.abs(sx)), 1);
    if (d.logoImg && d.logoImg.complete) ctx.drawImage(d.logoImg, -26, -26, 52, 52);
    ctx.restore();
  }
  if (sc > 0.01) {
    ctx.save(); ctx.translate(298, 84); ctx.scale(sc, sc); ctx.translate(-298, -84);
    d.fillPoly(d.cutPlate(20, 108, 480, 244, 14), "#1a1400", "#ffc800", 2); d.fillPoly([[278, 108], [298, 88], [318, 108]], "#ffc800", null);
    d.logo(74, 164, 70); const ph = (t * 1.3) % 1; ctx.strokeStyle = css(CYAN, 0.8 * (1 - ph)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(74, 164, 36 + 12 * ph, 0, 7); ctx.stroke();
    const back = g.awardKind === "restore", ttl = back ? "OVERLORD BMS RESTORED!" : "OVERLORD BMS FOUND!";
    let ts = 24;
    while (ts > 14 && d.textW(ttl, ts, 900, 2) > 340) ts -= 1;
    d.text(ttl, 126, 148, ts, GOLD, 900, 2);
    d.text(back ? "THE REAL THING IS BACK." : "BATTERY MANAGEMENT, BUILT", 126, 178, 16, CYAN, 700, 2); d.text(back ? "BAD GAUGES: STAY SHARP." : "FROM THE SILICON UP.", 126, 200, 16, CYAN, 700, 2);
    d.text(back ? "2× THE SHOTS, BACK ON." : "NOW YOU GET 2× THE SHOTS.", 126, 232, 17, "#fff", 700, 1);
    ctx.restore();
  }
}

/** The sector-cleared plate. */
export function drawPlate(d: Draw, game: Game): void {
  const g = game.run, ctx = d.ctx, pt = game.clock - g.plateAt;
  if (pt < 0) return;
  const frac = clamp(g.charge / g.capacity, 0, 1), tone = frac < LOW ? PINK : g.bad ? g.bad.col : g.chipCollected ? GOLD : CYAN, lit = Math.min(CELLS, Math.max(1, Math.ceil(frac * CELLS)));
  d.fillPoly(d.cutPlate(90, 166, 550, 476, 22), css(tone, 0.12), css(tone, 0.9), 2);
  ctx.strokeStyle = css(tone, 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(124, 276); ctx.lineTo(516, 276); ctx.moveTo(352, 296); ctx.lineTo(352, 380); ctx.stroke();
  d.text("LVL " + g.level, 124, 212, 22, tone, 700, 2); d.text("SECTOR CLEARED", 124, 258, 36, "#fff", 900, 2);
  d.text("SCORE", 124, 316, 16, CYAN, 500, 4);
  const shown = pt >= COUNT_S ? g.score : Math.round(g.score * ease(pt / COUNT_S));
  d.text(shown.toLocaleString("en-US"), 124, 352, 34, "#fff", 900, 0);
  const na = ramp(pt, 0.5, 1.0), dy = 12 * (1 - ease(ramp(pt, 0.5, 1.0)));
  d.text("NEXT", 372, 316, 16, CYAN, 500, 4, "left", na); d.text("LVL " + (g.level + 1), 372, 348 + dy, 30, GOLD, 900, 2, "left", na); d.text(levelName(g.level + 1), 372, 372 + dy, 16, "#fff", 500, 3, "left", na);
  const note = levelNote(g.level + 1);
  if (note) d.text(note, 372, 389 + dy, 12, g.level + 1 >= GAUGE_LEVEL ? BAD.red.col : CYAN, 700, 3, "left", na);
  for (let i = 0; i < CELLS; i++) {
    const pts = d.slanted(124 + i * 15.5, 396, 11, 16, 5);
    if (i < lit) { const al = 0.95 * ramp(pt, 0.3 + i * 0.05, 0.65 + i * 0.05); d.fillPoly(pts, css(tone, al), css(tone, al), 1); }
    else d.fillPoly(pts, null, "rgba(255,255,255,.22)", 1);
  }
  const pa = ramp(pt, COUNT_S + 0.2, COUNT_S + 0.5) * (pt >= ACK_MIN ? 0.7 + 0.3 * Math.sin(pt * 6) : 0.5);
  d.text("CLICK OR SPACE TO CONTINUE", 320, 452, 18, GOLD, 700, 4, "center", pa);
}
export { BADGE_AT };
