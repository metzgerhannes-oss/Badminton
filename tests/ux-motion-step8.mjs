import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const paths=["ux-polish.css","index.html","sw.js","app-release.js","router.js","tests/e2e/supabase-isolated.fixture.mjs"];
const [css,html,sw,release,router,isolation]=await Promise.all(paths.map(p=>readFile(p,"utf8")));

assert.match(css,/U7 · v171: calm native-like touch feedback only/);
assert.match(css,/@media \(prefers-reduced-motion:no-preference\)/);
assert.match(css,/\.app \.bottom-nav a:active > span\s*\{\s*transform:scale\(\.91\)/);
assert.match(css,/\.app \.topbar-settings:active svg\s*\{\s*transform:rotate\(8deg\) scale\(\.94\)/);
assert.match(css,/:not\(:disabled\):not\(\[aria-disabled="true"\]\):active/);
assert.match(css,/@media \(prefers-reduced-motion:reduce\)\s*\{/);
assert.match(css,/transition:none!important/);
assert.doesNotMatch(css,/animation-name:|animation:\s*[^n]|display\s*:\s*none|opacity\s*:\s*0\s*;|touch-action\s*:\s*none|user-scalable|maximum-scale/);
assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
assert.match(html,/<link rel="stylesheet" href="\.\/ux-polish\.css">/);
assert.match(html,/>v172<\/span>/);
assert.match(release,/version:"v172"/);
assert.match(sw,/schmetterlinge-shell-v172/);
assert.match(sw,/"\.\/ux-polish\.css"/);
assert.match(router,/function rememberScroll\(/);
assert.match(router,/function focusCurrentView\(/);
assert.match(isolation,/context\.route\(SUPABASE/);
console.log("U7: scoped tap feedback, no page animations or storage changes, reduced-motion and QA isolation intact.");
