import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,css,js,sw,release,welcome,club,transparentClub,shuttle]=await Promise.all([
 "index.html","app-access.css","app-access.js","sw.js","app-release.js","welcome.html",
 "assets/spvgg-schmetterlinge.svg","assets/spvgg-schmetterlinge-splash.svg","assets/shuttlecock-splash.svg"
].map(file=>readFile(file,"utf8")));
assert.match(html,/<html lang="de" data-app-access="checking">/);
assert.match(html,/<style>[\s\S]*?html\[data-app-access="checking"\] \.app-access-panel\{display:none!important\}/,"Invitation panel must be hidden on first paint without external CSS");
assert.match(html,/id="app-access-splash"[^>]+role="status"/);
assert.match(html,/class="app-access-visually-hidden">Zugang wird geprüft\.<\/span>/);
assert.match(html,/id="app-access-splash"[\s\S]*?assets\/spvgg-schmetterlinge-splash\.svg/);
assert.match(html,/class="app-access-shuttle"[^>]+src="\.\/assets\/shuttlecock-splash\.svg"/);
assert.match(html,/class="brand"[\s\S]*?src="\.\/assets\/spvgg-schmetterlinge\.svg"/);
assert.match(html,/<p id="app-access-status" role="status" aria-live="polite"><\/p>/);
assert.match(css,/html\[data-app-access="checking"\] \.app-access-panel \{display:none!important\}/);
assert.match(css,/html:not\(\[data-app-access="checking"\]\) #app-access-splash \{display:none!important\}/);
assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
assert.match(css,/mix-blend-mode:multiply/);
assert.match(css,/@keyframes app-access-shuttle-flight/);
assert.match(css,/3\.4s ease-in-out infinite/);
assert.match(css,/env\(safe-area-inset-top\)/);
assert.match(js,/root\.dataset\.appAccess="denied"/);
assert.match(js,/root\.dataset\.appAccess="checking"/);
assert.match(js,/withCheckDeadline/);
assert.match(js,/12000/);
assert.match(js,/if\(permission==="member"\)\{grant\(\);return;\}/);
assert.match(js,/if\(permission==="player"\)\{grant\(\{member:false\}\);return;\}/);
assert.doesNotMatch(css,/display:none!important;\s*$/m); // no accidental blanket hiding of errors
assert.match(sw,/schmetterlinge-shell-v173/);
assert.match(sw,/\.\/app-access\.css/);
assert.match(release,/version:"v173"/);
assert.match(welcome,/v173/);
assert.match(html,/v173/);
assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
const embedded=svg=>svg.match(/data:image\/webp;base64,([^"]+)/)?.[1];
assert.ok(embedded(club),"Original image is embedded WebP");
assert.equal(embedded(transparentClub),embedded(club),"Transparent adaptation must preserve every encoded original image byte");
assert.match(transparentClub,/<feColorMatrix[^>]+type="matrix"[^>]+values="[^"]*?-[0-9.]+/);
assert.match(transparentClub,/filter="url\(#remove-white-matte\)"/);
assert.match(shuttle,/viewBox="0 0 96 118"/);
assert.match(shuttle,/linearGradient id="cork"/);
for(const listName of ["ASSETS","SHELL_ASSETS","ESSENTIAL"]){
 const match=sw.match(new RegExp("const "+listName+"=(\\[[^\\n]+\\]);"));
 assert.ok(match,"SW missing "+listName);
 const paths=JSON.parse(match[1]);
 assert.ok(paths.includes("./assets/shuttlecock-splash.svg"));
 assert.ok(paths.includes("./assets/spvgg-schmetterlinge-splash.svg"));
}
console.log("U7: animated no-text checking, accessible fallback, preserved invitation flow, version and PWA offline shell.");
