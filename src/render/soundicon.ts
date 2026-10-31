import { soundBox } from "../core/layout";
import type { Draw } from "./draw";

/** The small speaker button in the top-left corner: waves when sound is on, a slash when it is muted. */
export function drawSoundIcon(d: Draw, ox: number, muted: boolean, hover: boolean): void {
  const ctx = d.ctx, b = soundBox(ox), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.save();
  ctx.globalAlpha = hover ? 1 : 0.65;
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.arc(cx, cy, b.w / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hover ? "#00e5ff" : "rgba(0,229,255,.5)"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx - 8, cy - 3); ctx.lineTo(cx - 4, cy - 3); ctx.lineTo(cx + 1, cy - 7); ctx.lineTo(cx + 1, cy + 7); ctx.lineTo(cx - 4, cy + 3); ctx.lineTo(cx - 8, cy + 3); ctx.closePath(); ctx.fill();
  if (muted) {
    ctx.strokeStyle = "#ff5a5a"; ctx.beginPath(); ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx + 10, cy + 4); ctx.moveTo(cx + 10, cy - 4); ctx.lineTo(cx + 4, cy + 4); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx + 1, cy, 5, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 1, cy, 9, -0.9, 0.9); ctx.stroke();
  }
  ctx.restore();
}
