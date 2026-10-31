import { CYAN, PINK, W } from "../core/constants";
import type { Game } from "../core/game";
import { COUNT_AT, COUNT_STEP, EV, INTRO_LINES, JUMP_AT, PARTS, SH } from "../core/intro";
import { SKIPS, inBox } from "../core/layout";
import { TAU, clamp, ease, lerp, ramp } from "../core/math";
import { Rng, srng } from "../core/rng";
import { css, Draw } from "./draw";
import type { Pt } from "./draw";
import { wingIcon } from "./sprites";

// colours as "r,g,b" strings, the way the bridge builds its rgba() values
const CYs = "0,229,255", GDs = "255,200,0", PKs = "255,60,220";

// the warp rays and the debris that rush at you as the first level arrives
interface Ray { a: number; sp: number; ph: number; w: number; cy: boolean }
interface Debris { a: number; d: number; dur: number; rot: number; sz: number }
const RAYS: Ray[] = [];
const DEBRIS: Debris[] = [];
{
  const r = new Rng(7);
  for (let i = 0; i < 100; i++) RAYS.push({ a: r.next() * 6.283, sp: 0.5 + r.next() * 1.1, ph: r.next(), w: 1.5 + r.next() * 2, cy: i % 5 === 0 });
  for (let i = 0; i < 30; i++) { const dur = 0.4 + r.next() * 0.3; DEBRIS.push({ a: r.next() * 6.283, d: r.next() * (1 - dur), dur, rot: r.next() * 6, sz: 60 + r.next() * 90 }); }
}

// the bridge: the big front window and the two side panes (where the wings are)
const WIN: Pt[][] = [[[140, 100], [500, 100], [538, 372], [102, 372]], [[0, 128], [92, 156], [86, 366], [0, 396]], [[640, 128], [548, 156], [554, 366], [640, 396]]];

/** Add a closed polygon to the current path. */
function plg(ctx: CanvasRenderingContext2D, p: Pt[]): void {
  p.forEach((q, k) => { if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
  ctx.closePath();
}
function sparks(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, t: number, seed: number, spread: number): void {
  const r = srng(seed + Math.floor(t * 14));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const an = r() * TAU, dd = r() * spread;
    ctx.strokeStyle = i % 3 ? "rgba(255,170,60,.95)" : "#fff"; ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * dd * 0.4, y + Math.sin(an) * dd * 0.4); ctx.lineTo(x + Math.cos(an) * dd, y + Math.sin(an) * dd); ctx.stroke();
  }
  ctx.restore();
}

/** One side pane: the wing, sparking, tearing away (`tear` 0..1), and the dashed outline it leaves behind once gone. */
function wingPane(d: Draw, side: number, tear: number, spark: number, t: number, dead: boolean): void {
  const ctx = d.ctx, rx = side < 0 ? 88 : 552, ry = 262;
  ctx.save(); ctx.beginPath(); plg(ctx, WIN[side < 0 ? 1 : 2]); ctx.clip();
  if (tear >= 1) {
    if (dead) {
      ctx.setLineDash([10, 8]); ctx.strokeStyle = `rgba(${PKs},${0.35 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(rx, 195); ctx.lineTo(rx + side * 130, 215); ctx.lineTo(rx + side * 130, 330); ctx.lineTo(rx, 345); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore(); return;
  }
  const k = ease(tear), bend = spark * 0.05 * side;
  ctx.save(); ctx.translate(rx + side * k * 320, ry + k * 120); ctx.rotate(side * k * 1.8 + bend); ctx.translate(-rx, -ry);
  const fl = 0.8 + 0.18 * Math.sin(t * 40) * spark, g = ctx.createLinearGradient(rx, 0, rx + side * 170, 0);
  g.addColorStop(0, `rgba(255,150,30,${fl})`); g.addColorStop(1, `rgba(255,215,60,${fl})`);
  ctx.fillStyle = g; ctx.shadowColor = `rgba(${GDs},.9)`; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.moveTo(rx, 195); ctx.lineTo(rx + side * 170, 165); ctx.lineTo(rx + side * 170, 362); ctx.lineTo(rx, 345); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 1; i < 7; i++) { const px = rx + side * i * 24; ctx.moveTo(px, 195 - i * 4.5); ctx.lineTo(px, 345 + i * 2.4); }
  for (let i = 1; i < 4; i++) { ctx.moveTo(rx, 195 + i * 37); ctx.lineTo(rx + side * 170, 165 + i * 49); }
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.moveTo(rx, 198); ctx.lineTo(rx + side * 170, 168); ctx.lineTo(rx + side * 170, 182); ctx.lineTo(rx, 212); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#39434d"; ctx.fillRect(Math.min(rx, rx - side * 16), 255, 16, 30);
  if (spark > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.5 * spark})`; ctx.lineWidth = 2;
    const r = srng(side + 9 + Math.floor(t * 18));
    ctx.beginPath(); ctx.moveTo(rx, 270); for (let j = 1; j <= 6; j++) ctx.lineTo(rx + side * j * 24, 270 + (r() - 0.5) * 90 * spark); ctx.stroke();
    ctx.strokeStyle = `rgba(255,40,30,${spark * 0.7})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(rx + side * 4, 205); ctx.lineTo(rx + side * 22, 250); ctx.lineTo(rx + side * 10, 290); ctx.lineTo(rx + side * 30, 340); ctx.stroke();
  }
  ctx.restore();
  if (tear > 0) {
    const fr = srng(side * 13 + 5);
    for (let i = 0; i < 14; i++) {
      const an = (side < 0 ? Math.PI : 0) + (fr() - 0.5) * 2.4, sp = 80 + fr() * 260;
      const x = rx + Math.cos(an) * sp * k * 1.6, y = ry + Math.sin(an) * sp * k * 1.6 + 260 * k * k * fr();
      ctx.save(); ctx.translate(x, y); ctx.rotate(fr() * 6 + tear * 10 * (fr() - 0.5)); ctx.globalAlpha = 1 - tear * 0.6;
      ctx.fillStyle = i % 3 ? "rgba(255,190,50,.95)" : "rgba(80,90,100,.95)"; const q = 5 + fr() * 12; ctx.fillRect(-q, -q * 0.5, q * 2, q); ctx.restore();
    }
    const fb = 1 - ramp(tear, 0, 0.35);
    if (fb > 0) {
      const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, 110);
      rg.addColorStop(0, `rgba(255,255,230,${fb})`); rg.addColorStop(0.35, `rgba(255,150,40,${fb * 0.8})`); rg.addColorStop(1, "rgba(255,60,20,0)");
      ctx.fillStyle = rg; ctx.fillRect(rx - 120, ry - 120, 240, 240);
    }
  }
  ctx.restore();
  if (spark > 0 && tear <= 0) { ctx.save(); ctx.beginPath(); plg(ctx, WIN[side < 0 ? 1 : 2]); ctx.clip(); sparks(ctx, rx, ry, Math.floor(6 + 26 * spark), t, side < 0 ? 3 : 8, 30 + 80 * spark); ctx.restore(); }
}

/** The hyperspace tunnel seen through the front window. `amt` is how fast, `inst` how unstable (turns it pink and flickery). */
function tunnel(d: Draw, t: number, amt: number, inst: number): void {
  const ctx = d.ctx, cx = 320, cy = 235;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 380);
  g.addColorStop(0, inst > 0.3 ? "rgba(90,10,60,.9)" : "rgba(10,60,110,.9)"); g.addColorStop(0.5, "rgba(4,10,30,.9)"); g.addColorStop(1, "#000");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 480);
  const col = inst > 0.3 ? PKs : CYs;
  for (let i = 0; i < 8; i++) {
    const p = (t * 0.55 * (0.6 + amt) + i / 8) % 1, rr = p * p * 460, wob = 0;
    ctx.strokeStyle = `rgba(${col},${(1 - p) * 0.55 * Math.min(1, amt + 0.2)})`; ctx.lineWidth = 1 + 5 * p;
    ctx.beginPath(); ctx.ellipse(cx + wob, cy + wob * 0.5, rr, rr * 0.72, 0, 0, TAU); ctx.stroke();
  }
  const r = srng(14);
  for (let i = 0; i < 110; i++) {
    const an = r() * TAU, sp = 0.5 + r() * 1.2, ph = r(), q = (t * sp * (0.35 + 1.6 * amt) + ph) % 1, r1 = 8 + Math.pow(q, 1.7) * 430, r2 = r1 + 6 + 170 * amt * q * sp, jit = 0;
    ctx.globalAlpha = Math.min(1, 0.25 + 0.75 * q) * Math.min(1, amt * 2); ctx.strokeStyle = i % 5 === 0 ? `rgb(${col})` : "#fff"; ctx.lineWidth = 1 + r() * 2.2 * q;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r1 + jit, cy + Math.sin(an) * r1 * 0.8); ctx.lineTo(cx + Math.cos(an) * r2 + jit, cy + Math.sin(an) * r2 * 0.8); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (inst > 0.5) {
    const rr2 = srng(40 + Math.floor(t * 9));
    if (rr2() < 0.6 * inst) {
      ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 14; ctx.lineWidth = 2; ctx.beginPath();
      const sx = rr2() < 0.5 ? 130 : 510, sy = 90 + rr2() * 280; ctx.moveTo(sx, sy);
      for (let j = 1; j <= 7; j++) ctx.lineTo(lerp(sx, cx, j / 7) + (rr2() - 0.5) * 60, lerp(sy, cy, j / 7) + (rr2() - 0.5) * 50);
      ctx.stroke(); ctx.restore();
    }
  }
}

interface Crew { x: number; s: number }
const CREW: Crew[] = [{ x: 130, s: 1 }, { x: 232, s: 0.78 }, { x: 320, s: 0.7 }, { x: 408, s: 0.78 }, { x: 510, s: 1 }];

/** A crew silhouette at the console, rim-lit; `flinch` drops them on impact, `face` turns the head. */
function officer(d: Draw, o: Crew, talk: boolean, rim: string, t: number, flinch: number, face: number): void {
  const ctx = d.ctx;
  ctx.save(); ctx.translate(o.x, 500 + flinch); ctx.scale(o.s, o.s); ctx.translate(0, -500);
  const tn = face * 5;
  ctx.fillStyle = "#04070b"; ctx.beginPath(); ctx.moveTo(-84, 520); ctx.bezierCurveTo(-80, 470, -52, 456, -26, 448); ctx.lineTo(-14, 436); ctx.lineTo(14, 436); ctx.lineTo(26, 448); ctx.bezierCurveTo(52, 456, 80, 470, 84, 520); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(tn, 410, 25, 29, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${rim},.8)`; ctx.lineWidth = 2.6 / o.s; ctx.beginPath(); ctx.arc(tn, 410, 26, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-80, 500); ctx.bezierCurveTo(-76, 470, -52, 458, -26, 450); ctx.moveTo(80, 500); ctx.bezierCurveTo(76, 470, 52, 458, 26, 450); ctx.stroke();
  ctx.beginPath(); ctx.arc(tn, 412, 28, Math.PI * 0.95, Math.PI * 1.35); ctx.stroke(); ctx.beginPath(); ctx.moveTo(tn - 26, 420); ctx.lineTo(tn - 18, 436); ctx.stroke();
  if (talk) { ctx.fillStyle = `rgba(${GDs},${0.6 + 0.4 * Math.sin(t * 22)})`; ctx.shadowColor = `rgba(${GDs},1)`; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(tn - 17, 437, 4.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/** The bridge at story time T: the tunnel, the wings tearing off, the crew, the console's POWER meter, the alarms. A pure function of T. */
function bridge(d: Draw, T: number): void {
  const ctx = d.ctx, s1 = PARTS[1].t0;
  const inst = ramp(T, s1, EV.w1 + 0.5), drop = ramp(T, EV.drop, EV.drop + 0.8), dead = T > EV.drop + 0.7;
  const tear1 = ramp(T, EV.w1, EV.w1 + 1.1), tear2 = ramp(T, EV.w2, EV.w2 + 1.1);
  const sp1 = ramp(T, s1 + 0.3, EV.w1) * (tear1 > 0 ? 0 : 1), sp2 = ramp(T, EV.w1 + 0.5, EV.w2) * (tear2 > 0 ? 0 : 1);
  const imp = (T >= EV.w1 ? Math.exp(-(T - EV.w1) * 6) : 0) + (T >= EV.w2 ? Math.exp(-(T - EV.w2) * 6) : 0);
  const shake = 2.6 * imp, amt = dead ? 0 : (0.55 + 0.55 * inst) * (1 - drop);
  let p = 1;
  if (T >= EV.w1) p = lerp(1, 0.5, ease(ramp(T, EV.w1, EV.w1 + 0.8)));
  if (T >= EV.w2) p = lerp(0.5, 0, ease(ramp(T, EV.w2, EV.w2 + 0.9)));
  if (inst > 0 && p > 0) p = clamp(p + Math.sin(T * 31) * 0.03 * inst, 0, 1);
  const alarm = ramp(T, s1, s1 + 0.4) * (1 - drop * 0.5) + (dead ? 0.6 : 0), pulse = 0.5 + 0.5 * Math.sin(T * 9), rim = alarm > 0.1 ? "255,70,90" : CYs;
  d.clockT = T; ctx.save(); ctx.translate(Math.sin(T * 61) * 7 * shake, Math.cos(T * 47) * 7 * shake);
  ctx.fillStyle = "#000"; ctx.fillRect(-20, -20, 680, 680);
  if (amt > 0.02) tunnel(d, T, amt, inst); else d.drawStars(T, 4, 0, 0.9);
  wingPane(d, -1, tear1, sp1, T, dead); wingPane(d, 1, tear2, sp2, T, dead);
  // the wings' wreckage tumbling away through the window
  ([[EV.w1, -1], [EV.w2, 1]] as [number, number][]).forEach((ev) => {
    const u = ramp(T, ev[0], ev[0] + 1.1);
    if (u <= 0 || u >= 1) return;
    const sr = srng(ev[1] + 31);
    ctx.save(); ctx.beginPath(); plg(ctx, WIN[0]); ctx.clip();
    for (let sj = 0; sj < 12; sj++) {
      const x0 = 320 + ev[1] * 190, ex = 320 + (sr() - 0.5) * 420, ey = 235 + (sr() - 0.4) * 260, e = ease(u);
      ctx.save(); ctx.translate(lerp(x0, ex, e), lerp(260, ey, e)); ctx.rotate(sr() * 6 + u * 9 * (sr() - 0.5)); ctx.globalAlpha = 1 - u * u;
      ctx.fillStyle = sj % 3 ? "rgba(255,200,60,1)" : "rgba(140,150,160,1)"; const q = 2 + 16 * e * (0.5 + sr()); ctx.fillRect(-q, -q * 0.5, q * 2, q); ctx.restore();
    }
    ctx.restore();
  });
  if (dead) {
    const dr = srng(21);
    for (let di = 0; di < 7; di++) {
      const dx = 140 + dr() * 360 + Math.sin(T * 0.3 + di) * 10, dy = 120 + dr() * 230 + (T - EV.drop) * 4 * (dr() - 0.5), q = 4 + dr() * 9;
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(dr() * 6 + T * 0.5 * (dr() - 0.5)); ctx.fillStyle = di % 2 ? "rgba(255,190,50,.7)" : "rgba(120,130,140,.7)"; ctx.fillRect(-q, -q * 0.5, q * 2, q); ctx.restore();
    }
  }
  /* interior shell */
  ctx.fillStyle = "#080d14"; ctx.beginPath(); ctx.rect(-20, -20, 680, 680); WIN.forEach((w) => plg(ctx, w)); ctx.fill("evenodd");
  ctx.strokeStyle = `rgba(${rim},.22)`; ctx.lineWidth = 1.5; ctx.beginPath();
  [[140, 100, 0, 0], [500, 100, 640, 0], [102, 372, 0, 500], [538, 372, 640, 500], [0, 60, 140, 100], [640, 60, 500, 100]].forEach((l) => { ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); });
  ctx.stroke();
  const strip = alarm > 0.1 ? 0.35 + 0.65 * pulse : 0.6;
  ctx.strokeStyle = `rgba(${rim},${strip * 0.8})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, 40); ctx.lineTo(150, 88); ctx.moveTo(620, 40); ctx.lineTo(490, 88); ctx.stroke();
  ctx.strokeStyle = `rgba(${rim},.55)`; ctx.lineWidth = 3; ctx.beginPath(); WIN.forEach((w) => plg(ctx, w)); ctx.stroke();
  const fl = Math.min(1, imp) * 7;
  [2, 1, 3, 0, 4].forEach((j) => officer(d, CREW[j], false, rim, T, fl, 0));
  /* console */
  ctx.fillStyle = "#0a1119"; ctx.beginPath(); plg(ctx, [[-20, 524], [150, 492], [490, 492], [660, 524], [660, 660], [-20, 660]]); ctx.fill();
  ctx.strokeStyle = `rgba(${rim},.55)`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-20, 524); ctx.lineTo(150, 492); ctx.lineTo(490, 492); ctx.lineTo(660, 524); ctx.stroke();
  CREW.forEach((o, j) => {
    for (let m = 0; m < 5; m++) {
      const on = alarm > 0.1 ? Math.sin(T * (6 + j * 1.7) + m * 2.1) > -0.2 : Math.sin(T * (1.2 + j * 0.4) + m * 1.9) > 0.1;
      ctx.fillStyle = dead ? `rgba(255,60,90,${0.15 + (0.1 * m) % 2})` : on ? `rgba(${alarm > 0.1 ? "255,90,80" : j % 2 ? GDs : CYs},.95)` : "rgba(255,255,255,.12)";
      ctx.fillRect(o.x - 24 + m * 11, 498 + (o.s < 1 ? 2 : 0), 7, 4);
    }
  });
  [[30, 150], [610, 150], [30, 300], [610, 300]].forEach((l, j) => {
    ctx.fillStyle = alarm > 0.1 ? `rgba(255,50,60,${0.3 + 0.7 * Math.abs(Math.sin(T * 7 + j))})` : `rgba(${CYs},.35)`;
    ctx.beginPath(); ctx.arc(l[0], l[1], 5, 0, TAU); ctx.fill();
  });
  d.text("POWER", 150, 540, 13, `rgba(${CYs},.95)`, 700, 6, "left");
  d.text(Math.round(p * 100) + " %", 486, 544, 22, `rgb(${p > 0.6 ? GDs : PKs})`, 700, 2, "right", dead ? 0.5 + 0.5 * Math.sin(T * 6) : 1);
  const lit = Math.round(p * 20);
  for (let k = 0; k < 20; k++) {
    const cx = 148 + k * 17.3;
    ctx.beginPath(); ctx.moveTo(cx + 3, 556); ctx.lineTo(cx + 15, 556); ctx.lineTo(cx + 12, 592); ctx.lineTo(cx, 592); ctx.closePath();
    if (k < lit) { ctx.fillStyle = `rgba(${p > 0.6 ? GDs : p > 0.25 ? "255,140,40" : "255,60,90"},.95)`; ctx.shadowColor = `rgba(${GDs},.7)`; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0; }
    else { ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1; ctx.stroke(); }
  }
  const gone1 = T >= EV.w1, gone2 = T >= EV.w2;
  wingIcon(d, 76, 566, 0.4, gone1 ? 0 : 0.85, gone1, -0.15); wingIcon(d, 564, 566, 0.4, gone2 ? 0 : 0.85, gone2, 0.15);
  d.text("WING 1", 76, 604, 12, `rgb(${gone1 ? PKs : CYs})`, 700, 4, "center"); d.text("WING 2", 564, 604, 12, `rgb(${gone2 ? PKs : CYs})`, 700, 4, "center");
  ctx.restore();
  /* banners and flashes */
  const bl = Math.floor(T * 5) % 2 ? 0.45 : 1;
  let msg = "";
  if (T >= EV.w1 && T < EV.w1 + 1.3) msg = "WING 1  LOST";
  else if (T >= EV.w2 && T < EV.w2 + 1.3) msg = "WING 2  LOST";
  else if (T >= EV.w1 + 1.3 && T < EV.drop) msg = "POWER  FAILURE";
  if (msg && !dead) {
    const ba = ramp(T, s1, s1 + 0.3) * (1 - drop);
    let bsz = 34; while (bsz > 18 && d.textW(msg, bsz, 800, 8) > 500) bsz -= 1; // the frame is as wide as its message (up to 560 px)
    const fw = Math.max(340, d.textW(msg, bsz, 800, 8) + 48);
    ctx.save(); ctx.globalAlpha = ba; ctx.fillStyle = "rgba(20,0,6,.72)"; ctx.fillRect(320 - fw / 2, 182, fw, 54); ctx.strokeStyle = `rgba(255,70,90,${bl})`; ctx.lineWidth = 3; ctx.strokeRect(320 - fw / 2, 182, fw, 54); ctx.restore();
    d.text(msg, 320, 220, bsz, "#fff", 800, 8, "center", bl * ba);
  }
  if (alarm > 0.05 && !dead) {
    const g = ctx.createRadialGradient(320, 320, 150, 320, 320, 470);
    g.addColorStop(0, "rgba(255,40,60,0)"); g.addColorStop(1, `rgba(255,40,60,${0.2 * alarm + 0.5 * alarm * pulse})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; const an = T * 5;
    const bg = ctx.createRadialGradient(320, 60, 0, 320 + Math.cos(an) * 300, 60 + Math.abs(Math.sin(an)) * 320, 340);
    bg.addColorStop(0, `rgba(255,50,60,${0.35 * alarm})`); bg.addColorStop(1, "rgba(255,50,60,0)"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 500); ctx.restore();
  }
  if (inst > 0.3 && !dead) { const fr = srng(Math.floor(T * 20)); if (fr() < 0.22 * inst) { ctx.fillStyle = `rgba(0,0,0,${0.35 + fr() * 0.35})`; ctx.fillRect(0, 0, W, W); } }
  [EV.w1, EV.w2].forEach((e) => { if (T >= e && T < e + 0.45) { ctx.fillStyle = `rgba(255,190,90,${0.7 * (1 - (T - e) / 0.45)})`; ctx.fillRect(0, 0, W, W); } });
  if (T >= EV.drop && T < EV.drop + 0.9) { ctx.fillStyle = `rgba(255,255,255,${0.95 * (1 - ramp(T, EV.drop, EV.drop + 0.9))})`; ctx.fillRect(0, 0, W, W); }
  if (dead) {
    ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(0, 0, W, W);
    const ep = 0.5 + 0.5 * Math.sin(T * 3), g2 = ctx.createRadialGradient(320, 320, 160, 320, 320, 460);
    g2.addColorStop(0, "rgba(255,40,60,0)"); g2.addColorStop(1, `rgba(255,40,60,${0.12 + 0.3 * ep})`); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, W);
  }
}

// scenes that carry on from the one before, with no fade between
const SCN_CONT = [0, 1, 1, 1, 1, 0, 1];

/** The "way back" map: the hazard route from the Meridian up through the belt. `p` is how much of the route is drawn. */
function hazardRoute(d: Draw, t: number, x0: number, y0: number, x1: number, y1: number, seed: number, p: number): void {
  const ctx = d.ctx, r = srng(seed || 23);
  for (let i = 0; i < 16; i++) {
    const u = r();
    let px = lerp(x0, x1, u) + (r() - 0.5) * 360;
    const py = lerp(y0, y1, u) + (r() - 0.5) * 60;
    if (Math.abs(px - lerp(x0, x1, u) - Math.sin(u * 9) * 60) < 50) px += 110;
    ctx.save(); ctx.globalAlpha *= 0.75; d.drawRock(clamp(px, 40, 600), py, 14 + r() * 22, r() * 6 + t * 0.1, PINK, false, false, false); ctx.restore();
  }
  ctx.save(); ctx.strokeStyle = `rgba(${CYs},.7)`; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 30; ctx.beginPath();
  for (let k = 0; k <= 30 * p; k++) { const f = k / 30, x = lerp(x0, x1, f) + Math.sin(f * 9) * 60, y = lerp(y0, y1, f); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke(); ctx.restore();
}

/** The route hologram: the Meridian at the bottom, the way through the belt, and the two wing blips (alpha a1, a2). `nh` fades "NO HYPERSPACE". */
function mapDraw(d: Draw, t: number, rp: number, a1: number, a2: number, nh: number): void {
  const ctx = d.ctx;
  d.clockT = t; hazardRoute(d, t, 320, 400, 320, 130, 31, rp);
  ctx.fillStyle = `rgb(${CYs})`; ctx.beginPath(); ctx.arc(320, 440, 7, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${CYs},${1 - ((t * 0.6) % 1)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(320, 440, 8 + 36 * ((t * 0.6) % 1), 0, TAU); ctx.stroke();
  d.text("MERIDIAN  ·  STRANDED", 320, 478, 14, `rgb(${CYs})`, 600, 5, "center");
  ([[220, 100, a1], [430, 150, a2]] as [number, number, number][]).forEach((b, k) => {
    const p = (t * 0.8 + k * 0.4) % 1;
    ctx.save(); ctx.globalAlpha *= b[2]; ctx.strokeStyle = `rgba(${GDs},${1 - p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b[0], b[1], 8 + 30 * p, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgb(${GDs})`; ctx.beginPath(); ctx.arc(b[0], b[1], 7, 0, TAU); ctx.fill(); ctx.restore();
  });
  d.text("NO HYPERSPACE", 320, 30, 16, `rgb(${PKs})`, 700, 8, "center", nh);
}

/** The story at intro time t: the bridge for the first five lines, then the route hologram for the last two. */
export function drawStory(d: Draw, t: number): void {
  const ctx = d.ctx;
  let i = 0;
  while (i < PARTS.length - 1 && t >= PARTS[i + 1].t0) i++;
  const s = PARTS[i], lt = t - s.t0;
  const a = (SCN_CONT[i] ? 1 : ramp(lt, 0, 0.45)) * (SCN_CONT[i + 1] ? 1 : 1 - ramp(lt, s.D - 0.4, s.D));
  ctx.save(); ctx.globalAlpha *= a; d.clockT = lt;
  if (i <= 4) {
    bridge(d, t);
    if (i === 4) {
      d.text("EMPTY  SPACE", 320, 230, 18, `rgba(${CYs},.6)`, 600, 10, "center", ramp(lt, 0.8, 1.6));
      d.text("EARTH  ·  412,000,000 km", 320, 262, 13, `rgba(${PKs},.85)`, 600, 5, "center", ramp(lt, 3, 3.6));
    }
  } else if (i === 5) mapDraw(d, lt, ease(ramp(lt, 1, 5)), ramp(lt, 3.4, 3.9), ramp(lt, 3.9, 4.4), ramp(lt, 1.4, 2));
  else {
    mapDraw(d, lt + PARTS[5].D, 1, 1, 1, 1);
    d.text("WING 1", 220, 70, 14, `rgb(${GDs})`, 700, 4, "center", ramp(lt, 0.3, 0.8));
    d.text("WING 2", 430, 120, 14, `rgb(${GDs})`, 700, 4, "center", ramp(lt, 0.6, 1.1));
    d.text("WINGS 0 / 2", 320, 622, 18, `rgb(${PKs})`, 700, 8, "center", ramp(lt, 1, 1.5));
  }
  ctx.restore();
}

/**
 * The whole intro: the story, the countdown over the route hologram, the jump, and the arrival into level 1.
 * `drawPlayfield` draws the first level underneath once it has taken over.
 */
export function drawIntro(d: Draw, game: Game, drawPlayfield: (d: Draw, game: Game) => void): void {
  const ctx = d.ctx, t = game.intro.t;
  if (game.intro.game) drawPlayfield(d, game); else { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, W); }
  const warp = ramp(t, JUMP_AT, 14.4 + SH) * (1 - ramp(t, 14.4 + SH, 15.6 + SH)), calm = 1 - warp, fade = 1 - ramp(t, 14.2 + SH, 14.8 + SH);
  ctx.save(); ctx.globalAlpha = fade;
  if (t < COUNT_AT) drawStory(d, t);
  else {
    d.drawStars(t, 4 + 40 * warp, 0, 0.9 * calm);
    const u = t - COUNT_AT;
    if (u < 3) { // the way back behind the numbers: wing 1, wing 2, then the rocks begin to stream at you
            if (u > 2) {
        const q = ramp(u, 2, 3), sr = srng(55);
        for (let ri = 0; ri < 9; ri++) {
          const an = (ri / 9) * 6.283 + sr(), dd = 60 + 300 * ease(q) * (0.5 + sr());
          ctx.save(); ctx.globalAlpha *= q * 0.8; d.drawRock(320 + Math.cos(an) * dd, 320 + Math.sin(an) * dd, 6 + 30 * q * q, ri + u, PINK, true, false, false); ctx.restore();
        }
      }
      d.text("WINGS 0 / 2", 320, 622, 18, `rgb(${PKs})`, 700, 8, "center");
    }
  }
  const cd = t >= COUNT_AT && t < JUMP_AT ? 3 - Math.floor((t - COUNT_AT) / COUNT_STEP) : 0, ph = ((t - COUNT_AT) % COUNT_STEP) / COUNT_STEP;
  if (cd > 0) {
    ctx.save(); ctx.globalAlpha *= 1 - ph * 0.6; ctx.strokeStyle = css(CYAN, 0.8 * (1 - ph)); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(320, 320, 90 + 160 * ph, 0, 7); ctx.stroke();
    const s = 1.5 - 0.5 * ease(Math.min(1, ph * 2)); ctx.translate(320, 320); ctx.scale(s, s); d.text(String(cd), 0, 40, 120, "#fff", 900, 0, "center"); ctx.restore();
  }
  ctx.restore();
  if (warp > 0) { // the jump: rays streaming out of the centre, and a shake
    ctx.save(); ctx.translate(Math.sin(t * 77) * 6 * warp, Math.cos(t * 63) * 6 * warp);
    RAYS.forEach((r) => {
      const p = (t * r.sp * (0.4 + 2.6 * warp) + r.ph) % 1, r1 = 20 + p * 520, r2 = r1 + 8 + 190 * warp * p * r.sp;
      ctx.globalAlpha = warp * (0.3 + 0.7 * p); ctx.strokeStyle = r.cy ? "#00e5ff" : "#fff"; ctx.lineWidth = r.w;
      ctx.beginPath(); ctx.moveTo(320 + Math.cos(r.a) * r1, 320 + Math.sin(r.a) * r1); ctx.lineTo(320 + Math.cos(r.a) * r2, 320 + Math.sin(r.a) * r2); ctx.stroke();
    });
    ctx.restore();
  }
  if (t >= JUMP_AT) d.text("GO", 320, 360, 130, "#fff", 800, 14, "center", 1 - ramp(t, JUMP_AT + 0.2, JUMP_AT + 0.5));
  const arr = ramp(t, 14.3 + SH, 16.2 + SH);
  if (arr > 0 && arr < 1) {
    DEBRIS.forEach((db) => {
      const p = clamp((arr - db.d) / db.dur, 0, 1);
      if (p <= 0 || p >= 1) return;
      const r = 14 + 560 * p * p;
      ctx.save(); ctx.globalAlpha = Math.min(1, p * 6); d.drawRock(320 + Math.cos(db.a) * r, 320 + Math.sin(db.a) * r, 4 + db.sz * p * p, db.rot + t * 1.5, PINK, true, false, false); ctx.restore();
    });
  }
  const fl = 0.95 * ramp(t, 13.9 + SH, 14.3 + SH) * (1 - ramp(t, 14.3 + SH, 15.0 + SH));
  if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(-game.ox, 0, W + 2 * game.ox, W); } // the flash covers the whole screen, bars or not
  // the narrator's captions: at the top over the bridge, at the bottom over the map
  INTRO_LINES.forEach((l, k) => {
    if (t >= l[0] && t < l[1]) {
      const parts = l[2].split("|"), o = ramp(t, l[0], l[0] + 0.25) * (1 - ramp(t, l[1] - 0.25, l[1])), y0 = k <= 4 ? 20 : 512;
      d.text("NARRATOR", 320, y0, 13, CYAN, 700, 5, "center", o * 0.8);
      d.text(parts[0], 320, y0 + 36, 22, "#fff", 700, 1, "center", o);
      if (parts[1]) d.text(parts[1], 320, y0 + 65, 22, "#fff", 700, 1, "center", o);
    }
  });
  if (game.storyBtnVisible()) { // a way out of the story, always on screen while it runs
    const a = ramp(t, 0.9, 1.5) * (1 - ramp(t, COUNT_AT - 2.6, COUNT_AT - 1.6)), b = SKIPS, pt = game.input.pointer, hov = inBox(b, pt.x, pt.y);
    ctx.save(); ctx.globalAlpha *= a;
    d.fillPoly(d.cutPlate(b.x, b.y, b.x + b.w, b.y + b.h, 9), hov ? "rgba(0,229,255,.22)" : "rgba(0,0,0,.55)", css(CYAN, hov ? 1 : 0.7), 1.5);
    d.text("SKIP STORY", b.x + 66, b.y + 20, 13, hov ? "#fff" : CYAN, 700, 3, "center");
    d.fillPoly([[b.x + 136, b.y + 9], [b.x + 148, b.y + 15], [b.x + 136, b.y + 21]], css(CYAN, hov ? 1 : 0.8), null);
    d.fillPoly([[b.x + 148, b.y + 9], [b.x + 160, b.y + 15], [b.x + 148, b.y + 21]], css(CYAN, hov ? 1 : 0.8), null);
    ctx.restore();
  }
}
