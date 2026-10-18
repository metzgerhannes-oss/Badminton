import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,css,sw,release,existing]=await Promise.all([
 "index.html","desktop-shell-v172.css","sw.js","app-release.js","desktop-dashboard.css"
].map(f=>readFile(f,"utf8")));
assert.match(css,/@media \(min-width:1080px\)/);
assert.match(css,/@media \(min-width:1280px\)/);
assert.match(css,/max-width:none/);
assert.match(css,/--desktop-rail:220px/);
assert.match(css,/\.app > \.topbar/);
assert.match(css,/\.bottom-nav \{/);
assert.match(css,/html\[dir="rtl"\] \.bottom-nav/);
assert.doesNotMatch(css,/user-scalable|maximum-scale|touch-action\s*:\s*none|localStorage|supabase/i);
assert.match(existing,/\.bottom-nav/,"The existing navigation is reused");
assert.equal((html.match(/<nav class="bottom-nav"/g)||[]).length,1,"No duplicate navigation");
assert.match(html,/<link rel="stylesheet" href="\.\/desktop-shell-v172\.css">/);
const ver=release.match(/version:"(v\d+)"/)?.[1];
assert.equal(ver,"v172");
assert.match(sw,new RegExp("schmetterlinge-shell-"+ver+"\\b"));
for(const name of ["ASSETS","SHELL_ASSETS"]){
 const m=sw.match(new RegExp("const "+name+"=(\\[[^\\n]+\\]);"));
 assert.ok(m,name+" exists");
 assert.ok(JSON.parse(m[1]).includes("./desktop-shell-v172.css"),name+" includes desktop CSS");
}
assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
console.log("Desktop PR 1: one rail, one header, responsive-only CSS, cached offline and no data changes.");
