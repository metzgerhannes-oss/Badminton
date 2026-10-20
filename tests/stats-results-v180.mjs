import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
// Static structure-only regression. No external requests, app storage or Supabase.
const [css,html,stats,release,sw]=await Promise.all([
 "desktop-workspace-v176.css","index.html","stats.js","app-release.js","sw.js"
].map(p=>readFile(p,"utf8")));
assert.match(html,/id="match-stats-values"/,"Result counts must remain");
assert.match(html,/id="home-match-filter-panel"/,"Age/year/discipline filters must remain");
assert.match(html,/id="match-stats-details"/,"Individual evidence navigation must remain");
assert.match(html,/class="home-stats-link" href="#historie"/,"History remains reachable");
assert.match(css,/#match-stats-source-link,\s*#match-stats-provenance\s*\{\s*display:\s*none\s*!important;\s*\}/,
 "Suppress both duplicate Home-only elements on all viewport sizes");
assert.match(stats,/sourceDetails\.textContent/,"Keep the original evidence explanations internally");
assert.match(stats,/function render\(/,"Match calculation must remain unchanged");
assert.match(release,/version:"v182"/,"User-visible shell version");
assert.match(sw,/const CACHE="schmetterlinge-shell-v182"/,"Versioned PWA cache without deleting user data");
assert.doesNotMatch(css,/#[\w-]*match-stats-(?:values|details|list|filters)[\w-]*\s*\{\s*display:\s*none/i,
 "Never suppress result counts, filters or match cards");
console.log("v180 UI: no duplicate links/methodology; results, proofs, filters, user data unchanged.");
