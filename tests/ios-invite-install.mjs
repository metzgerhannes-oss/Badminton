import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [app,install,gate,css,sw,manifest,release,fixture,invites]=await Promise.all([
 "app-access.js","install-invite.html","index.html","app-access.css",
 "sw.js","manifest.webmanifest","app-release.js",
 "tests/e2e/supabase-isolated.fixture.mjs","invite.js"
].map(path=>readFile(path,"utf8")));

// iOS invitation opens a focused install page BEFORE the original accept RPC.
assert.match(app,/ios&&!standalone&&TOKEN\.test\(incoming\|\|""\)/);
assert.match(app,/location\.replace\("\.\/install-invite\.html#appinvite="/);
assert.match(install,/navigator\.standalone===true/);
assert.match(install,/location\.replace\(next\.href\)/);
assert.match(install,/navigator\.clipboard\.writeText\(next\.href\)/);
assert.match(install,/browser\.href=next\.href\+"&browser=1"/);
assert.match(app,/hashParams\.get\("browser"\)!=="1"/);
// No PWA manifest on the install page: iOS is allowed to retain its URL.
assert.doesNotMatch(install,/rel=["']manifest["']/);
assert.match(install,/<meta name="referrer" content="no-referrer">/);
assert.match(install,/<meta name="apple-mobile-web-app-capable" content="yes">/);
// The original generic manifest stays untouched for all other entry points.
assert.match(manifest,/"start_url": "\.\/#start"/);
assert.match(app,/navigator\.clipboard\?\.readText/);
assert.match(gate,/id="app-access-paste"[^>]*hidden/);
assert.match(css,/#app-access-paste:focus-visible/);
assert.match(app,/rpc\("app_access_invite_accept"/);
assert.match(app,/rpc\("app_access_status"/);
assert.match(app,/if\(permission==="member"\)\{grant\(\);return;\}/);
assert.match(app,/history\.replaceState\(null/);
assert.doesNotMatch(install,/auth\/v1|supabase\.co|localStorage|analytics|fetch\(/);
assert.doesNotMatch(app,/new URLSearchParams\(location\.search\)\.set\("appinvite"/);
assert.match(fixture,/context\.route\(SUPABASE/);
assert.match(invites,/appinvite=/);
assert.match(sw,/schmetterlinge-shell-v174/);
assert.match(release,/version:"v174"/);
for(const key of ["ASSETS","SHELL_ASSETS","ESSENTIAL"]){
 const m=sw.match(new RegExp("const "+key+"=(\\[[^\\n]+\\]);"));
 assert.ok(m,key+" present");
 assert.ok(JSON.parse(m[1]).includes("./install-invite.html"),key+" must cache generic bootstrap");
}
console.log("iOS: invitation accepted inside standalone PWA, no repeat-code entry or weaker authorization.");
