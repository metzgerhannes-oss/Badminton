import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,css,js,sw,release,welcome]=await Promise.all([
 "index.html","app-access.css","app-access.js","sw.js","app-release.js","welcome.html"
].map(file=>readFile(file,"utf8")));
assert.match(html,/<html lang="de" data-app-access="checking">/);
assert.match(html,/id="app-access-splash"[^>]+role="status"/);
assert.match(html,/class="app-access-visually-hidden">Zugang wird geprüft\.<\/span>/);
assert.match(html,/id="app-access-splash"[\s\S]*?assets\/spvgg-schmetterlinge\.svg/);
assert.match(html,/class="app-access-shuttle"/);
assert.match(html,/<p id="app-access-status" role="status" aria-live="polite"><\/p>/);
assert.match(css,/html\[data-app-access="checking"\] \.app-access-panel \{display:none!important\}/);
assert.match(css,/html:not\(\[data-app-access="checking"\]\) #app-access-splash \{display:none!important\}/);
assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
assert.match(css,/env\(safe-area-inset-top\)/);
assert.match(js,/root\.dataset\.appAccess="denied"/);
assert.match(js,/root\.dataset\.appAccess="checking"/);
assert.match(js,/withCheckDeadline/);
assert.match(js,/12000/);
assert.match(js,/if\(permission==="member"\)\{grant\(\);return;\}/);
assert.match(js,/if\(permission==="player"\)\{grant\(\{member:false\}\);return;\}/);
assert.doesNotMatch(css,/display:none!important;\s*$/m); // no accidental blanket hiding of errors
assert.match(sw,/schmetterlinge-shell-v169/);
assert.match(sw,/\.\/app-access\.css/);
assert.match(release,/version:"v169"/);
assert.match(welcome,/v169/);
assert.match(html,/v169/);
assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
console.log("U7: animated no-text checking, accessible fallback, preserved invitation flow, version and PWA offline shell.");
