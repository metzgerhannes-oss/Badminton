/** Private Cloudflare Pages build: explicit runtime-only allowlist.
 * Do not publish SQL, tests, source-control docs, secrets, or raw player backups.
 */
import {readdir,cp,mkdir,rm,writeFile,stat} from "node:fs/promises";
import {join,resolve,relative,extname} from "node:path";
const root=process.cwd();
const dest=resolve(root,".cloudflare-private-dist");
if(dest===root)throw Error("Invalid destination");
const runtimeRootExt=new Set([".html",".js",".css",".webmanifest",".png",".svg",".ico"]);
const assetDirs=new Set(["assets","games","locales"]);
const runtimeModuleExt=new Set([".js",".mjs",".json",".css",".svg",".png",".webp"]);
const calendarFixtures=new Set([
 "bw-youth-calendar-archive.json",
 "bwbv-youth-framework-2027.json",
 "dbv-calendar.json",
 "source-register.json",
 "team-report-links.json",
 "report-sources.json",
 "spvgg-active-roster.json",
 "report-articles.json"
]);
async function take(from,to){
 const info=await stat(from);
 if(!info.isFile()||info.size>4*1024*1024)throw Error("Unexpected runtime asset: "+relative(root,from));
 await mkdir(resolve(to,".."),{recursive:true});
 await cp(from,to);
}
await rm(dest,{recursive:true,force:true});
await mkdir(dest,{recursive:true});
const entries=await readdir(root,{withFileTypes:true});
for(const entry of entries){
 if(entry.isFile()&&runtimeRootExt.has(extname(entry.name).toLowerCase()))
  await take(join(root,entry.name),join(dest,entry.name));
 if(!entry.isDirectory())continue;
 if(assetDirs.has(entry.name)){
  await cp(join(root,entry.name),join(dest,entry.name),{recursive:true,
   filter:src=>src===join(root,entry.name)||runtimeModuleExt.has(extname(src).toLowerCase())});
 }
}
const scripts=await readdir(join(root,"scripts"),{withFileTypes:true});
for(const entry of scripts){
 if(entry.isFile()&&runtimeModuleExt.has(extname(entry.name).toLowerCase()))
  await take(join(root,"scripts",entry.name),join(dest,"scripts",entry.name));
}
for(const name of calendarFixtures)
 await take(join(root,"data",name),join(dest,"data",name));
await writeFile(join(dest,"_headers"),`/*.html
  Cache-Control: no-store
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
\n/* 
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
`);
const output=await readdir(dest,{recursive:true});
if(!output.includes("index.html")||!output.includes("welcome.html")||
 !output.includes("scripts/supabase-read.mjs"))throw Error("Incomplete private runtime build");
for(const forbidden of ["database","docs","supabase","tests",".github","AGENTS.md","README.md",
 "data/player-library","data/player-history","data/history.json","data/ranking.json"]){
 if(output.includes(forbidden)||output.some(p=>p.startsWith(forbidden+"/")))
  throw Error("Forbidden private runtime output: "+forbidden);
}
console.log("Private Pages runtime-only build verified, files:",output.filter(x=>!x.endsWith("/")).length);
