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
assert.match(html,/id="app-access-retry"[^>]+hidden>Zugang erneut prüfen<\/button>/);
assert.match(html,/Die Anmeldung per E-Mail-Code erfolgt über Cloudflare/);
assert.doesNotMatch(html,/Keine E-Mail-Adresse und kein Passwort erforderlich/);
assert.match(css,/#app-access-retry\[hidden\] \{ display:none!important; \}/);
assert.match(js,/retry\?\.addEventListener\("click"/);
assert.match(css,/html\[data-app-access="checking"\] \.app-access-panel \{display:none!important\}/);
assert.match(html,/html:not\(\[data-app-access="checking"\]\) #app-access-splash\{display:none!important\}/,
 "Critical inline CSS prevents the splash persisting after access resolves");
assert.match(css,/html\[data-app-access="checking"\] #app-access-splash\s*\{/,"Checking state must style visible splash");
assert.doesNotMatch(css,/html:not\(\[data-app-access="checking"\]\)\s*#app-access-splash\s*\{/,"Splash must not style only hidden state");
assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
assert.match(css,/mix-blend-mode:multiply/);
assert.match(css,/@keyframes app-access-shuttle-flight/);

/* Regression: the iPhone shuttle must not stay anchored beside the badge. */
const flightPlacement=css.match(/\.app-access-shuttle\s*\{([^}]+)\}/)?.[1]||"";
assert.match(flightPlacement,/left:50%;top:50%/,"Flight must use the stage centre");
assert.doesNotMatch(flightPlacement,/(?:^|;)\s*(?:right|bottom):/,"No static bottom-right anchor");
const flightFrames=css.match(/@keyframes app-access-shuttle-flight\s*\{([\s\S]*?)\n\}/)?.[1]||"";
const flightPoints=[...flightFrames.matchAll(/translate3d\((-?\d+)px,(-?\d+)px,0\)/g)]
 .map(([,x,y])=>({x:Number(x),y:Number(y)}));
assert.ok(flightPoints.length>=5,"Flight needs segmented trajectory");
assert.ok(flightPoints[0].x>140&&flightPoints[0].y< -150,"Enter from upper right, not beside the badge");
assert.ok(flightPoints.some(({x,y})=>x>=80&&x<=100&&y>=-30&&y<=60),"Travel past emblem's right edge");
assert.ok(flightPoints.at(-1).x<50&&flightPoints.at(-1).y>140,"Exit below emblem");

assert.match(css,/2\.5s linear infinite both/);
assert.match(css,/env\(safe-area-inset-top\)/);
assert.match(js,/root\.dataset\.appAccess="denied"/);
assert.match(js,/root\.dataset\.appAccess="checking"/);
assert.match(js,/withCheckDeadline/);
assert.match(js,/const COLD_START_MIN_MS=800/);
assert.match(js,/COLD_START_MIN_MS-\(performance\.now\(\)-coldStartStartedAt\)/);
assert.match(js,/document\.visibilityState==="visible"/);
assert.match(js,/prefers-reduced-motion: reduce/);
assert.match(js,/await grantAfterIntro\(\)/);
assert.match(js,/await grantAfterIntro\(\{member:false\}\)/);
assert.match(js,/12000/);
assert.match(js,/if\(permission==="member"\)\{await grantAfterIntro\(\);return;\}/);
assert.match(js,/if\(permission==="player"\)\{await grantAfterIntro\(\{member:false\}\);return;\}/);
assert.doesNotMatch(css,/display:none!important;\s*$/m); // no accidental blanket hiding of errors
const current=release.match(/version:"(v\d+)"/)?.[1];
assert.ok(current,"Current PWA release identifier missing");
assert.ok(sw.includes("schmetterlinge-shell-"+current));
assert.match(sw,/\.\/app-access\.css/);
assert.ok(Number(current.slice(1))>=184,"Previously released splash and invitation flow must survive newer versions");
assert.ok(welcome.includes(current),"Welcome shows current release");
assert.ok(html.includes(current),"App shell shows current release");
assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
const embedded=svg=>svg.match(/data:image\/webp;base64,([^"]+)/)?.[1];
assert.ok(embedded(club),"Original image is embedded WebP");
assert.equal(embedded(transparentClub),embedded(club),"Transparent adaptation must preserve every encoded original image byte");
assert.match(transparentClub,/<feColorMatrix[^>]+type="matrix"[^>]+values="[^"]*?-[0-9.]+/);
assert.match(transparentClub,/filter="url\(#remove-white-matte\)"/);
assert.match(shuttle,/viewBox="0 0 96 118"/);
assert.match(shuttle,/linearGradient id="cork"/);
assert.equal((shuttle.match(/class="feather"/g)||[]).length,16,"Shuttle needs sixteen individual vanes");
assert.ok(Buffer.byteLength(shuttle)<=200000,"Offline feather asset must be under 200 KB");
assert.doesNotMatch(shuttle,/<image\b[^>]+href="https?:/i,"No external image requests");
for(const listName of ["ASSETS","SHELL_ASSETS","ESSENTIAL"]){
 const match=sw.match(new RegExp("const "+listName+"=(\\[[^\\n]+\\]);"));
 assert.ok(match,"SW missing "+listName);
 const paths=JSON.parse(match[1]);
 assert.ok(paths.includes("./assets/shuttlecock-splash.svg"));
 assert.ok(paths.includes("./assets/spvgg-schmetterlinge-splash.svg"));
}
console.log("U7: animated no-text checking, accessible fallback, preserved invitation flow, version and PWA offline shell.");
