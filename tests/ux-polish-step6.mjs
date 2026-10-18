import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [css,html,sw,release]=await Promise.all([
 "ux-polish.css","index.html","sw.js","app-release.js"].map(f=>readFile(f,"utf8")));
assert.match(css,/@media\(max-width:1079px\)/,"Desktop must keep existing dark layout");
assert.match(css,/\.app \.page:not\(#view-start\)/,"Compact home must stay structurally unchanged");
assert.doesNotMatch(css,/user-scalable|maximum-scale|touch-action\s*:\s*none/);
assert.match(html,/<link rel="stylesheet" href="\.\/ux-polish\.css">/);
assert.match(html,/<span[^>]*data-app-version[^>]*>v174<\/span>/);
assert.match(sw,/schmetterlinge-shell-v174/);
const patterns=[/const ASSETS=(\[[^\n]+\]);/,/const SHELL_ASSETS=(\[[^\n]+\]);/];
for(const regex of patterns){
 const match=sw.match(regex);
 assert.ok(match,"Missing SW asset catalogue");
 assert.ok(JSON.parse(match[1]).includes("./ux-polish.css"),"Polish must be cached for existing PWA updates");
}
assert.match(release,/version:"v174"/);
console.log("U6: presentation only, correct CSS cascade/cache and persistent PWA version.");
