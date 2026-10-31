# Embedding OverBlaster

## What to host

The library (`dist/lib/overblaster.js` ES module, or `overblaster.umd.cjs`) does not bundle media. Serve a folder containing

```
audio/*.m4a     (copy of public/audio)
logo.png
```

and pass its URL as `assetsUrl`. Or use `npm run build:single` for one HTML file with everything inlined.

## From a release

Each tagged release (`v*`) on GitHub publishes the files ready to use: `overblaster.js` (ES module), `overblaster.umd.cjs`, `overblaster.d.ts` (one bundled declaration file), `overblaster.html` (the whole game in one file, audio inlined) and `overblaster-assets.zip`. Unzip the assets into the folder you serve, so you have `audio/` and `logo.png` next to each other, and pass that folder's URL as `assetsUrl`. `npm run build && npm run build:single && npm run build:release` makes the same files in `dist/release`.

## API

```ts
const ob = OverBlaster.mount(element, options);   // element: a container (a canvas is created) or an existing <canvas>
```

| option | default | |
|---|---|---|
| `assetsUrl` | `"./"` | folder with `audio/` and `logo.png` |
| `sound` | `true` | `false` runs silent and needs no audio files |
| `skipIntro` | `false` | go straight to level 1 on launch |
| `keyboard` | `"focus"` | `"focus"`: keys only while the game is focused (click it); `"window"`: anywhere; `"off"` |
| `motion` | `true` | phone orientation steers the view |
| `soundButton` | `true` | the speaker icon in the top-left corner of the game (hidden when `sound` is `false`); `M` also toggles |
| `onMuteChange` | none | `(muted: boolean) => void`, called whenever sound is switched on or off |
| `autoPause` | `true` | pause when the tab is hidden or the game is off screen |
| `seed` | random | same seed, same levels |
| `loads` | `[0.3, 0.55]` | difficulty curve (see `core/constants.ts`) |

Methods: `on(type | "*", fn)` (returns unsubscribe), `pause()`, `resume()`, `setMuted(bool)`, `muted`, `recenter()`, `skipIntro()`,
`toggleMic()` (call from a click), `micOn`, `phase`, `game` (the core `Game`, read-only use please), `destroy()`.

Events (`AppEvent`): `launch`, `phase {phase}`, `levelStart {level}`, `levelClear {level, score}`, `chipFound`, `wingFound {wings}`,
`gameOver {won, cause, score, level}`.

## Sizing

The canvas fills its container, so give the container a width **and a height**; any aspect ratio works. A square container shows the
glasses' view exactly (30 degrees vertical). A wider one shows more sky to each side (up to 2.4:1). The title, the story intro and the
game-over screen stay in a centred square with black bars either side; the bars part outward as gameplay starts. The HUD stays in that
square too. The backing store follows the container size (up to 2x pixel ratio).

## Custom element

```js
import { defineElement } from "./overblaster.js"; defineElement();
```
```html
<overblaster-game assets-url="/overblaster/" seed="7" skip-intro keyboard="window"></overblaster-game>
```
Attributes: `assets-url`, `seed`, `skip-intro`, `no-sound`, `no-motion`, `keyboard`. `el.game` is the mounted `OverBlaster`.

## Autoplay and permissions

Browsers only start audio, the microphone and (iOS) motion sensors after a user gesture. The game's LAUNCH click does the first two
(audio loads then); the microphone is a button you wire to `toggleMic()`.
