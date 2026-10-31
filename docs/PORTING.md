# Porting OverBlaster to another language or framework

Port the **core** and write three small adapters. The renderer is the biggest piece but has no logic in it.

## 1. Port `src/core` (about 1,000 lines)

It uses plain data and functions: no generics tricks, no reflection, no async, no DOM. Suggested order:

1. `math.ts`, `rng.ts`: **port the LCG exactly** (`s = (s * 1664525 + 1013904223) mod 2^32`, `next = s / 2^32`). Then the same seed gives the same levels in every port, and you can compare against the TypeScript output.
2. `constants.ts`, `types.ts`, `input.ts`, `events.ts`: data definitions.
3. `view.ts`, `levels.ts`, `intro.ts`.
4. `game.ts`: a class with `update(dt, input)` and `drain()`.
5. `bot.ts` + the tests: they are your acceptance suite (below).

Notes for typed languages: state objects are mutable records; events are a tagged union (`type` field); `Phase`/`RunMode` are enums.
Floats are doubles; keep `dt` in seconds. Avoid language-level randomness anywhere in the core.

## 2. Check it against the reference

`tests/core.test.ts` states the rules in executable form (battery maths, chip doubling, wings gate the level, intro cues, determinism).
Port those tests first. Then compare a run: with seed 9, 30 fps steps, input `fire = true`, turn right for 6 s, the TypeScript run ends with
the numbers in the `determinism` test; your port should print the same charge, score, azimuth and rock count. `npm run sim` output is a second cross-check.

## 3. Write the adapters

| adapter | job | web version |
|---|---|---|
| input | fill an `InputFrame` each frame: `turn`, `orientation`, `head` (absolute head az/el from a head tracker: sets the view directly), `fire`, `pointer`, `look`, `presses`, `commands` | `platform/input.ts` |
| audio | play `SoundEvent`s: `sfx` (sample `sfx_<name>`), `say` (queue of `voice_<key>` clips; `[]` cuts it off), `music`, `alarm`, `drone`, `zap` (3 synthesised effects), `stopRiser` | `platform/audio.ts` |
| renderer | draw `Game` state in a 640 x 640 logical space | `render/*` |

On the Raven glasses themselves the display is additive (black is transparent) and there is no canvas API; the Python app in `../Raven`
is that port: it implements the same rules over positioned image widgets.

## 4. The renderer

Each `render/*.ts` function is `(Draw, Game) -> void`, reading `game.run`, `game.intro`, `game.view`, `game.clock`. `Draw` wraps 12 primitives
(text with letter spacing, polygon fill/stroke, glow, rounded rect, logo, crosshair, stars, the rock). Port `Draw` to your 2D API, then each scene
is a mechanical translation. Visual reference: run the demo (`npm run dev`) and use the debug scenes: `#test=title`, `#test=intro:5`,
`#test=wing:hold&freeze`, `#test=plate&freeze`, `#test=gauge`, ... (list in `src/debug/scenes.ts`), which freeze a game on one moment for side-by-side comparison.

## Keep these invariants

- The core is deterministic and has no side effects other than mutating its own state and appending events.
- Rendering never mutates game state.
- Time comes in as `dt`; the core never reads a clock.
