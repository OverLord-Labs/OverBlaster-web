import type { RGB } from "./constants";

/**
 * Everything the core wants the outside world to do or know. The core appends these during update();
 * the host drains them with Game.drain(). Audio adapters play the sound events; an embedding page can
 * listen to the app events. This is the only way the core talks outward, which keeps it portable.
 */
export type Phase = "title" | "intro" | "play" | "over";

export type SoundEvent =
  | { type: "sfx"; name: string; gain?: number; offset?: number; tag?: "riser" } // a sample, "sfx_<name>"
  | { type: "stopRiser" }
  | { type: "zap"; kind: "eject" | "bad" | "pop" } // synthesised effects
  | { type: "say"; keys: string[] } // narrator/voice clips played in order; [] cuts the voice off
  | { type: "music"; name: string | null }
  | { type: "alarm"; on: boolean }
  | { type: "drone"; on: boolean };

export type AppEvent =
  | { type: "launch" } // the player asked to start; the host loads audio, then calls Game.beginIntro()
  | { type: "phase"; phase: Phase }
  | { type: "levelStart"; level: number }
  | { type: "levelClear"; level: number; score: number }
  | { type: "chipFound" }
  | { type: "wingFound"; wings: number }
  | { type: "gameOver"; won: boolean; cause: "hull" | "battery" | "win"; score: number; level: number };

export type GameEvent = SoundEvent | AppEvent;

export const isSound = (e: GameEvent): e is SoundEvent =>
  e.type === "sfx" || e.type === "stopRiser" || e.type === "zap" || e.type === "say" || e.type === "music" || e.type === "alarm" || e.type === "drone";

export type { RGB };
