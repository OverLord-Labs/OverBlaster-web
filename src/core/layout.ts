// Hit boxes for the on-screen buttons, in logical px. The core does the hit testing; renderers draw into the same boxes.
export interface Box { x: number; y: number; w: number; h: number }
export const LAUNCH: Box = { x: 190, y: 488, w: 260, h: 68 };
export const RETRY: Box = { x: 190, y: 330, w: 260, h: 64 };
export const TOTITLE: Box = { x: 190, y: 420, w: 260, h: 64 };
export const SKIPS: Box = { x: 452, y: 6, w: 176, h: 30 };
export const inBox = (b: Box, x: number, y: number): boolean => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
