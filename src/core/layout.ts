// Hit boxes for the on-screen buttons, in logical px. The core does the hit testing; renderers draw into the same boxes.
export interface Box { x: number; y: number; w: number; h: number }
export const LAUNCH: Box = { x: 190, y: 488, w: 260, h: 68 };
export type OverAction = "retryLevel" | "startOver" | "title";
/** The buttons on the game-over screen: after a loss, retry the level, start over, or go to the title; after a win, play again or go to the title. */
export const overButtons = (won: boolean): { box: Box; label: string; act: OverAction }[] => won
  ? [{ box: { x: 190, y: 360, w: 260, h: 64 }, label: "PLAY AGAIN", act: "startOver" }, { box: { x: 190, y: 440, w: 260, h: 64 }, label: "TITLE", act: "title" }]
  : [{ box: { x: 190, y: 300, w: 260, h: 64 }, label: "RETRY LEVEL", act: "retryLevel" }, { box: { x: 190, y: 376, w: 260, h: 64 }, label: "START OVER", act: "startOver" }, { box: { x: 190, y: 452, w: 260, h: 64 }, label: "TITLE", act: "title" }];
/** The "skip story" button, in the top-right corner of what is visible (`vx` is the extra width shown on each side of the square). */
export const skipsBox = (vx: number): Box => ({ x: 452 + vx, y: 6, w: 176, h: 30 });
/** The sound toggle, in the top-left corner of the whole canvas (so it moves out with a widescreen frame). */
export const soundBox = (ox: number): Box => ({ x: 8 - ox, y: 8, w: 28, h: 28 });
export const inBox = (b: Box, x: number, y: number): boolean => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
