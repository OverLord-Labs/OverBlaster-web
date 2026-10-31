/**
 * What the game needs from the outside world, one frame at a time.
 * The core never touches the DOM, a device, a clock or a speaker: a host (browser, test, bot, native port)
 * fills in an InputFrame and calls Game.update(dt, input).
 */

export type Command =
  | "launch" // leave the title screen
  | "skipStory" // jump from the story to the countdown
  | "skipIntro" // jump from the intro into the first level
  | "recenter" // treat where the head points now as straight ahead
  | "flipYaw"
  | "flipPitch";

export interface InputFrame {
  /** Digital head turn, each axis -1..1 (arrow keys / WASD). x is right, y is up. */
  turn: { x: number; y: number };
  /** Live device orientation in degrees, or null when no sensor has reported lately. */
  orientation: { alpha: number; beta: number } | null;
  /** Absolute head orientation in degrees (a head tracker on smart glasses), or null. When present it sets the view directly and the turn keys, drag and orientation are ignored. */
  head: { az: number; el: number } | null;
  /** Fire is held (mouse down, space, a touch, or a loud sound on the mic). */
  fire: boolean;
  /** The pointer in logical screen px (0..640). `mouse` is true once a mouse or pen has moved over the screen. */
  pointer: { x: number; y: number; mouse: boolean; inside: boolean };
  /** Touch-drag look delta since the last frame, in logical px. Ignored while orientation is live. */
  look: { dx: number; dy: number };
  /** Clicks, taps and space presses since the last frame, in logical px. */
  presses: { x: number; y: number }[];
  commands: Command[];
}

export function emptyInput(): InputFrame {
  return {
    turn: { x: 0, y: 0 },
    orientation: null,
    head: null,
    fire: false,
    pointer: { x: 320, y: 320, mouse: false, inside: false },
    look: { dx: 0, dy: 0 },
    presses: [],
    commands: [],
  };
}
