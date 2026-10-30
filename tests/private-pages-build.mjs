/** Offline CI guard: private Cloudflare Pages must never publish source, raw players or DB dumps. */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readdir,readFile} from "node:fs/promises";
import {join} from "node:path";
execFileSync(process.execPath,["scripts/build-private-pages.mjs"],{stdio:"pipe"});
const root=".cloudflare-private-dist";
const files=await readdir(root,{recursive:true});
const required=["index.html","welcome.html","app-access.js","app.js","scripts/supabase-read.mjs",
 "scripts/targeted-player-search.mjs","assets/schmetterlinge-pwa-192.png","sw.js"];
for(const file of required)assert.ok(files.includes(file),"Missing runtime asset: "+file);
const forbiddenPrefixes=[".github/","tests/","database/","supabase/","docs/",
 "data/player-library/","data/player-history/"];
for(const path of files)for(const x of forbiddenPrefixes)
 assert.ok(!path.startsWith(x),"Protected source file in private bundle: "+path);
for(const exact of ["README.md","AGENTS.md","package.json","data/history.json","data/ranking.json"])
 assert.ok(!files.includes(exact),"Protected document/backup in private bundle: "+exact);
const welcome=await readFile(join(root,"welcome.js"),"utf8");
assert.match(welcome,/verifyWelcomeFamilyMember/);
const client=await readFile(join(root,"scripts/supabase-read.mjs"),"utf8");
assert.match(client,/member\?\.allowed!==true/);
assert.ok(!files.some(x=>x.endsWith(".sql")||x.endsWith(".py")),
 "No private SQL or Python maintenance scripts in frontend dist");
console.log("P0 #417: Cloudflare family runtime built and strictly excludes test, source and player dump files.");
