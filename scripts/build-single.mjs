// One self-contained HTML file: the game, the logo and every audio clip inlined. Run after `npm run build`.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const site = "dist/site";
let html = readFileSync(join(site, "index.html"), "utf8");
const jsPath = html.match(/<script[^>]+src="\.\/(assets\/[^"]+\.js)"/)?.[1];
if (!jsPath) throw new Error("run `npm run build` first");
const b64 = (p, mime) => `data:${mime};base64,` + readFileSync(p).toString("base64");

const audio = {};
for (const f of readdirSync("public/audio")) if (f.endsWith(".m4a")) audio[f.replace(/\.m4a$/, "")] = b64(join("public/audio", f), "audio/mp4");
const logo = b64("public/logo.png", "image/png");

// The player reads clips from `${assetsUrl}audio/<name>.m4a`; in the single file, route those fetches and the logo to the inlined data.
const shim = `<script>(function(){var A=${JSON.stringify(audio)},L=${JSON.stringify(logo)},f=window.fetch;
window.fetch=function(u,o){var m=/audio\\/([^/]+)\\.m4a$/.exec(String(u));return m&&A[m[1]]?f(A[m[1]],o):f(u,o)};
var d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");Object.defineProperty(HTMLImageElement.prototype,"src",{set:function(v){d.set.call(this,/logo\\.png$/.test(v)?L:v)},get:d.get});})();</script>`;
const js = readFileSync(join(site, jsPath), "utf8").replace(/<\/script/g, "<\\/script");
html = html.replace(/<script[^>]+src="\.\/assets\/[^"]+\.js"[^>]*><\/script>/, "").replace(/<link[^>]+href="\.\/assets\/[^"]+"[^>]*>/g, "");
html = html.replace("</body>", `${shim}<script type="module">${js}</script></body>`);
writeFileSync("dist/overblaster.single.html", html);
console.log("dist/overblaster.single.html", (html.length / 1e6).toFixed(2), "MB");
