/** CI contract: browser tests must inherit non-network Supabase interception. */
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {strict as assert} from "node:assert";
const dir=join(process.cwd(),"tests/e2e");
const files=readdirSync(dir).filter(name=>name.endsWith(".spec.mjs"));
assert.ok(files.length>0,"Browser specs are required, not an empty test suite");
const config=readFileSync(join(process.cwd(),"playwright.config.mjs"),"utf8");
assert.match(config,/baseURL:\s*["']http:\/\/127\.0\.0\.1:\d+["']/,
 "QA web server must remain on loopback");
assert.match(config,/serviceWorkers:\s*["']block["']/,
 "Service workers must not bypass request interception");
assert.match(config,/proxy:\s*\{\s*server:\s*["']http:\/\/127\.0\.0\.1:1["']/,
 "Fail-closed proxy must block unmocked outbound traffic");
assert.match(config,/bypass:\s*["']127\.0\.0\.1,localhost["']/,
 "Only the local QA server may bypass the network block");
const isolated=readFileSync(join(dir,"supabase-isolated.fixture.mjs"),"utf8");
assert.match(isolated,/context\.route\(SUPABASE/,
 "Supabase isolation must cover the whole browser context");
assert.match(isolated,/route\.fulfill\(/,
 "Supabase requests must be answered locally");
assert.doesNotMatch(isolated,/route\.continue\(/,
 "The fallback fixture must never forward Supabase requests");

for(const file of files){
 const source=readFileSync(join(dir,file),"utf8");
 assert.doesNotMatch(source,/from\s*["']@playwright\/test["']/,
  file+": raw Playwright would allow production Supabase requests");
 assert.match(source,/from\s*["']\.\/(?:supabase-isolated|invited-member)\.fixture\.mjs["']/,
  file+": import an isolated Supabase browser fixture");
}
assert.match(readFileSync(join(dir,"invited-member.fixture.mjs"),"utf8"),
 /from\s*["']\.\/supabase-isolated\.fixture\.mjs["']/);
console.log(files.length+" browser specs inherit the Supabase QA network firewall.");
