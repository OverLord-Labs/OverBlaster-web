// The files a release publishes, in dist/release. Run after `npm run build`.
//   overblaster.js, overblaster.umd.cjs   the game (ES module / UMD), no audio inside
//   overblaster.d.ts                      one bundled declaration file
//   overblaster.html                      the whole game in one file: audio and logo inlined (needs `npm run build:single` first)
//   overblaster-assets.zip                audio/ + logo.png: unzip it into the folder you pass as `assetsUrl`
import { copyFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const out = "dist/release";
if (!existsSync("dist/lib/overblaster.js")) throw new Error("run `npm run build` first");
if (!existsSync("dist/overblaster.single.html")) throw new Error("run `npm run build:single` first");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyFileSync("dist/lib/overblaster.js", `${out}/overblaster.js`);
copyFileSync("dist/lib/overblaster.umd.cjs", `${out}/overblaster.umd.cjs`);
copyFileSync("dist/overblaster.single.html", `${out}/overblaster.html`);
execFileSync("npx", ["dts-bundle-generator", "--no-check", "-o", `${out}/overblaster.d.ts`, "src/index.ts"], { stdio: "inherit" });
execFileSync("zip", ["-qr", resolve(out, "overblaster-assets.zip"), "audio", "logo.png"], { cwd: "public", stdio: "inherit" });
console.log("release files in", out);
