import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [rooms,html,sw,release,fixture,workflow]=await Promise.all([
 "settings-rooms.js","index.html","sw.js","app-release.js",
 "tests/e2e/supabase-isolated.fixture.mjs",".github/workflows/tests.yml"
].map(path=>readFile(path,"utf8")));
const current=release.match(/version:"(v[0-9]+)"/)?.[1];
assert.ok(Number(current?.slice(1))>=186,"IA-5 required from v186");
assert.ok(sw.includes('const CACHE="schmetterlinge-shell-'+current+'"'));
assert.ok(html.includes(">"+current+"</span>"));
assert.match(rooms,/view\.addEventListener\("click",event=>\{/);
assert.match(rooms,/a\.settings-room-link, a\.settings-room-back/);
assert.match(rooms,/event\.defaultPrevented/);
assert.match(rooms,/event\.metaKey\|\|event\.ctrlKey\|\|event\.shiftKey\|\|event\.altKey/);
assert.match(rooms,/if\(location\.hash!==destination\)location\.hash=destination;/);
assert.match(rooms,/if\(!match\|\|\(match\[1\]&&!rooms\.has\(match\[1\]\)\)\)return;/);
assert.match(rooms,/event\.preventDefault\(\);/);
assert.match(rooms,/window\.addEventListener\("hashchange",sync\)/);
assert.match(rooms,/window\.addEventListener\("pageshow",sync\)/);
assert.match(rooms,/room\.hidden=id!==key/);
assert.match(fixture,/context\.route\(SUPABASE/);
assert.doesNotMatch(rooms,/localStorage\.setItem\(|\bfetch\s*\(|\.supabase\.co/,
 "Settings route cannot mutate profiles, rights or remote data");
assert.match(workflow,/node tests\/navigation-ia5-v186\.mjs/);
console.log("IA-5: immediate settings navigation with valid targets, history and offline isolation.");
