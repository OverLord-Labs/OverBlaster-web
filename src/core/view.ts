import { CENTER, EL_LIMIT, PPD, TURN_RATE, W } from "./constants";
import type { InputFrame } from "./input";
import { azd, clamp, wrap360 } from "./math";
import type { Projected } from "./types";

/**
 * Where your head points, and how the sky maps onto the screen.
 * The world is a sphere around you (azimuth 0..360, elevation up and down); the screen is a 30 degree window of it.
 */
export class View {
  az = 0;
  el = 0;
  private rAz = 0; // turn rate, smoothed
  private rEl = 0;
  // device-orientation tracking
  private a0: number | null = null;
  private az0 = 0;
  private fy = 1;
  private fp = 1;
  /** True while a device sensor is steering the view. */
  sensorLive = false;

  reset(): void {
    this.az = 0; this.el = 0; this.rAz = 0; this.rEl = 0; this.recenter();
  }
  recenter(): void {
    this.a0 = null;
  }
  flipYaw(): void {
    this.fy = -this.fy; this.recenter();
  }
  flipPitch(): void {
    this.fp = -this.fp;
  }

  update(dt: number, input: InputFrame): void {
    const o = input.orientation;
    this.sensorLive = !!o;
    if (o) {
      if (this.a0 == null) { this.a0 = o.alpha; this.az0 = this.az; }
      const diff = ((o.alpha - this.a0 + 540) % 360) - 180;
      const tAz = (this.az0 - diff * this.fy + 720) % 360;
      const tEl = clamp((o.beta - 90) * this.fp, -EL_LIMIT, EL_LIMIT);
      const k = Math.min(1, dt * 14);
      this.az = (this.az + azd(tAz, this.az) * k + 360) % 360;
      this.el += (tEl - this.el) * k;
      this.rAz = this.rEl = 0;
      return;
    }
    // touch-drag look
    if (input.look.dx || input.look.dy) {
      const k = (FOV_DEG / W) * 1.3;
      this.az = wrap360(this.az - input.look.dx * k);
      this.el = clamp(this.el + input.look.dy * k, -EL_LIMIT, EL_LIMIT);
    }
    const tx = input.turn.x * TURN_RATE, ty = input.turn.y * TURN_RATE * 0.8;
    const k = Math.min(1, dt * 9);
    this.rAz += (tx - this.rAz) * k; this.rEl += (ty - this.rEl) * k;
    this.az = (this.az + this.rAz * dt + 360) % 360;
    this.el = clamp(this.el + this.rEl * dt, -EL_LIMIT, EL_LIMIT);
  }

  /** Where a point of the sky lands on the 640 px screen. dx, dy are the offsets from the centre. */
  proj(az: number, el: number): Projected {
    const dx = azd(az, this.az) * Math.cos((el * Math.PI) / 180) * PPD;
    const dy = -(el - this.el) * PPD;
    return { x: CENTER + dx, y: CENTER + dy, dx, dy };
  }
}
const FOV_DEG = 30;

/** Is a screen point inside the visible area? `ox` is the extra width on each side when the screen is wider than the 640 px square. */
export function onScreen(p: { x: number; y: number }, margin: number, ox = 0): boolean {
  return p.x > -ox - margin && p.x < W + ox + margin && p.y > -margin && p.y < W + margin;
}
