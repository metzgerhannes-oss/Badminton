/** CI contract: browser tests must inherit non-network Supabase interception. */
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {strict as assert} from "node:assert";
const dir=join(process.cwd(),"tests/e2e");
const files=readdirSync(dir).filter(name=>name.endsWith(".spec.mjs"));
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
