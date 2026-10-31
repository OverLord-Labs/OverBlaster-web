// Balance check: the bot plays levels headless. `npm run sim -- 1 42 3 1.0` = levels 1..42, 3 seeds, aim noise 1.0.
import { simulateLevel } from "../src/core";
declare const process: { argv: string[] };
const [lo = "1", hi = "42", seeds = "3", noise = "1"] = process.argv.slice(2);
console.log("lvl  lost  hull/bat  secs  wings  minCharge");
for (let n = +lo; n <= +hi; n++) {
  let lost = 0, secs = 0, wings = 0, minc = 1;
  const causes: string[] = [];
  for (let s = 1; s <= +seeds; s++) {
    const r = simulateLevel({ level: n, seed: s, noise: +noise });
    if (r.lost) { lost++; causes.push(r.cause ?? "?"); }
    secs += r.seconds; wings += r.wings; minc = Math.min(minc, r.minCharge);
  }
  console.log(String(n).padStart(3), `${lost}/${seeds}`.padStart(5), causes.join(",").padEnd(9), String(Math.round(secs / +seeds)).padStart(5), String(wings).padStart(5), Math.round(minc * 100) + "%");
}
