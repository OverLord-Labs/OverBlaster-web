// Small numeric helpers. Pure and dependency free, so they port line for line.

export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
/** 0 at or before `a`, 1 at or after `b`, linear between. */
export const ramp = (t: number, a: number, b: number): number => clamp((t - a) / (b - a), 0, 1);
/** Ease-out cubic on 0..1. */
export const ease = (u: number): number => 1 - Math.pow(1 - u, 3);
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
/** Signed shortest difference between two azimuths, in degrees (-180..180). */
export const azd = (a: number, b: number): number => ((((a - b + 540) % 360) + 360) % 360) - 180;
/** Wrap an azimuth into 0..360. */
export const wrap360 = (a: number): number => ((a % 360) + 360) % 360;
