import { OverBlaster } from "../index";
import { applyScene } from "../debug/scenes";

// The demo page: the game in a box, plus the control strip. Everything the page does goes through the public OverBlaster API.
const stage = document.getElementById("stage")!;
const $ = (id: string) => document.getElementById(id) as HTMLButtonElement;
const ob = OverBlaster.mount(stage, { assetsUrl: "./", keyboard: "window" });

$("mute").addEventListener("click", () => { ob.setMuted(!ob.muted); $("mute").textContent = "Sound: " + (ob.muted ? "off" : "on"); });
window.addEventListener("keydown", (e) => { if (e.key === "m" || e.key === "M") $("mute").textContent = "Sound: " + (ob.muted ? "off" : "on"); });
$("mic").addEventListener("click", async () => {
  const r = await ob.toggleMic();
  $("mic").textContent = r === "on" ? "Mic: on (say pew)" : r === "off" ? "Mic: off" : r === "blocked" ? "Mic: blocked" : "Mic: not available here";
});
$("skip").addEventListener("click", () => ob.skipIntro());
// show "Skip intro" only while there is an intro to skip
setInterval(() => { $("skip").style.visibility = ob.game.canSkipIntro() ? "visible" : "hidden"; $("head").textContent = ob.game.view.sensorLive ? "Head: phone motion" : "Head: keys"; }, 200);
ob.on("gameOver", (e) => console.info("game over", e));

// test hooks: #test=<scene>[:arg[:arg2]] jumps to a known moment and leaves it playable (add &freeze to hold it still, for screenshots)
//   e.g. #test=lvl:28:6   level 28 after 6 s (its wing has appeared)   #test=wing:hold   #test=plate   #test=intro:36
const hash = location.hash.slice(1);
if (hash.startsWith("test=")) {
  const [spec, ...flags] = hash.slice(5).split("&");
  const [name, a, b] = spec.split(":");
  ob.game.setAspect(stage.clientWidth / stage.clientHeight);
  applyScene(ob.game, name, a, b);
  if (!flags.includes("freeze")) ob.game.frozen = false;
}
(window as unknown as { __ob: unknown }).__ob = { ob, game: ob.game, applyScene };
