# Architecture

The rule that shapes everything: **the game never touches the outside world.** It is a function from
`(state, dt, InputFrame)` to a new state plus a list of events. Everything else (drawing, sound, devices, timers) is an adapter on either side.

```
 devices ──► platform/input ──► InputFrame ──┐
                                             ▼
                    time (rAF) ───► Game.update(dt, input) ──► Game state (phase, run, view, intro)
                                             │                         │
                                             ▼                         ▼
                                   GameEvent[] (drain)         render/Renderer.render(game)
                                    │            │
                         SoundEvent ▼            ▼ AppEvent
                       platform/AudioEngine   OverBlaster.on(...) / your page
```

## core (`src/core`)

| file | what it holds |
|---|---|
| `game.ts` | `Game`: the state machine (`title → intro → play → over`), rules, collisions, battery, chip, wings, gauges |
| `levels.ts` | `levelPlan(n, rng)`: the rocks of a level from 4 on; level names, voice line keys, plate notes |
| `intro.ts` | the story intro as **data**: narrator lines, event times, sound cues |
| `view.ts` | head orientation (keys / touch drag / device sensor) and the sky-to-screen projection |
| `input.ts` | `InputFrame`: the only thing the game reads from outside |
| `events.ts` | `GameEvent`: the only thing the game says outward (`SoundEvent`, `AppEvent`) |
| `constants.ts` | every tunable number |
| `types.ts` | the shapes of the state the renderer reads |
| `rng.ts` | seeded random numbers; every random choice goes through them |
| `bot.ts` | a bot that plays, for tests and balance (`simulateLevel`) |
| `layout.ts` | hit boxes of the on-screen buttons |

Properties worth keeping:

- **Deterministic.** Same seed + same input script = same game (tested). No `Math.random`, `Date.now` or `performance.now` in core.
- **Headless.** `import { Game } from "overblaster"` runs the game in Node (the browser parts only touch the DOM when you call `mount`). The test suite and the balance bot use exactly the game the player does.
- **Event-out, input-in.** Audio is not called from rules; rules emit `{type:"sfx", name:"explode"}` and an adapter plays it.
  That is why the same core can drive WebAudio, a native audio engine, or nothing.
- **One logical screen.** The world is 640 x 640 px across a 30 degree field of view (the glasses' display). Renderers scale it to any size.

## render (`src/render`)

`Renderer.render(game)` picks a scene by `game.phase` and draws it with `Draw` (a thin wrapper over Canvas 2D: text with letter spacing,
glow, polygons, the rock sprite). Scenes: `screens.ts` (title, game over), `story.ts` (the bridge, the route hologram, the countdown),
`playfield.ts` + `hud.ts` + `pickups.ts` + `arrows.ts` (the game screen). A scene is a pure function of the game state and the clock:
that is what lets the debug scenes freeze a game at any moment and screenshot it.

Rendering never writes game state. If the renderer needs something that is not in the state, add it to the state.

## platform (`src/platform`)

- `input.ts` `InputController`: pointer, keys (scoped to the window or the focused canvas), touch drag, device orientation → one `InputFrame` per animation frame.
- `audio.ts` `AudioEngine`: loads `audio/<name>.m4a`, plays `SoundEvent`s (samples, a few synthesised effects, voice queue, music with ducking).
- `mic.ts` `Mic`: "say Pew": a loud sound counts as fire; ignored while the game's own voice plays.

## index (`src/index.ts`)

`OverBlaster.mount(el, options)` wires one `Game`, one `Renderer`, one `InputController`, one `AudioEngine` and one `Mic` to a canvas and an
animation-frame loop, pauses when the tab is hidden or the game scrolls out of view, and re-emits `AppEvent`s to listeners. `destroy()` undoes all of it.

## Where things go

| you want to… | change |
|---|---|
| add a rule, enemy or pickup | `core/game.ts` (+ a field in `types.ts`, a number in `constants.ts`), then draw it in `render/playfield.ts` |
| tune difficulty | `core/constants.ts`, `core/levels.ts`; check with `npm run sim` |
| change the story | `core/intro.ts` (text and timing) and `render/story.ts` (the pictures); new clips go in `public/audio` and `assets/manifest.ts` |
| add a sound | the clip in `public/audio`, its name in `src/assets/manifest.ts`, emit `{type:"sfx", name}` from core |
| add an input method | an adapter that fills `InputFrame` (a gamepad, say); core is unchanged |
| change how it looks | `render/` only |
