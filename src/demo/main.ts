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
setInterval(() => { $("skip").style.visibility = ob.game.canSkipIntro() ? "visible" : "hidden"; $("head").textContent = ob.game.view.sensorLive ? "Head: phone motion" : "Head: arrow keys or WASD"; }, 200);
ob.on("gameOver", (e) => console.info("game over", e));

// test hooks: #test=<scene>[:arg] freezes the game on a known moment (used for screenshots); #skipstory
const hash = location.hash.slice(1);
if (hash.startsWith("test=")) { const [name, a, b] = hash.slice(5).split(":"); applyScene(ob.game, name, a, b); }
(window as unknown as { __ob: unknown }).__ob = { ob, game: ob.game, applyScene };
