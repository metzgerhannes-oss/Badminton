import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile("sw.js","utf8");
assert.match(source,/const CACHE="schmetterlinge-shell-v[1-9][0-9]*"/);
assert.doesNotMatch(source,/catch\(\)=>caches\.match\(e\.request\)/);
const privateHtml=await readFile("private-player.html","utf8");
assert.match(privateHtml,/navigator\.serviceWorker\.getRegistration\("\.\/"\)/,
 "Existing Safari clients should request worker update on private invite load");
assert.doesNotMatch(privateHtml,/navigator\.serviceWorker\.register\(/,
 "First-time invite recipients should not need to install a worker");


const scope="https://example.test/Badminton/";
const makeReq=(path,mode="navigate",method="GET")=>({
 url:new URL(path,scope).href,mode,method
});
function harness({offline=false,hit=null,cacheFailure=false,failEssential=false,failOptional=false}={}){
 const handlers={};
 const deleted=[],stored=[],cacheWrites=[],waits=[];
 let skipped=false,claimed=false,networkCalls=0,accepted=[];
 const online=async request=>{
  networkCalls++;
  if(offline)throw new Error("Simulated LTE outage");
  return new Response("network",{status:200});
 };
 const store={
  async addAll(paths){
   if(failEssential)throw new Error("Required shell unavailable");
   accepted.push(...paths);
  },
  async add(path){
   if(failOptional)throw new Error("Optional asset unavailable");
   accepted.push(path);
  },
  async put(request,response){
   if(cacheFailure)throw new Error("QuotaExceededError");
   cacheWrites.push({url:request.url,status:response.status});
  }
 };
 const caches={
  async open(){if(cacheFailure)throw new Error("CacheStorage unavailable");return store;},
  async match(request,options={}){
   if(cacheFailure)throw new Error("CacheStorage unavailable");
   const url=typeof request==="string"?request:request.href||request.url;
   const found=hit && (hit==="all"||url===hit.url||(
     options.ignoreSearch && hit.url && new URL(url).pathname===new URL(hit.url).pathname));
   return found?new Response("cached",{status:200}):undefined;
  },
  async keys(){return ["schmetterlinge-shell-v119","schmetterlinge-shell-v121","schmetterlinge-shell-v122","schmetterlinge-shell-v123","schmetterlinge-shell-v124","other-app-cache","schmetterlinge-shell-v125","schmetterlinge-shell-v127","schmetterlinge-shell-v128","schmetterlinge-shell-v129","schmetterlinge-shell-v130","schmetterlinge-shell-v131","schmetterlinge-shell-v132","schmetterlinge-shell-v133"];},
  async delete(key){deleted.push(key);return true;}
 };
 const self={
  location:{origin:new URL(scope).origin},
  registration:{scope},
  addEventListener(name,callback){handlers[name]=callback;},
  skipWaiting(){skipped=true;},
  clients:{claim(){claimed=true;}}
 };
 vm.runInNewContext(source,{self,caches,fetch:online,Response,URL,Promise});
 async function fetchResult(request){
  let reply=null,responded=false;
  const event={request,waitUntil(p){waits.push(p);},
    respondWith(p){responded=true;reply=p;}};
  handlers.fetch(event);
  if(!responded)return null;
  const response=await reply;
  await Promise.allSettled(waits.splice(0));
  return response;
 }
 async function lifecycle(kind){
  let tasks=[];
  handlers[kind]({waitUntil(p){tasks.push(p);}});
  return Promise.all(tasks);
 }
 return {fetchResult,lifecycle,deleted,cacheWrites,accepted,
   get skipped(){return skipped;},get claimed(){return claimed;},
   get networkCalls(){return networkCalls;}};
}
// Regression: old Safari worker returned undefined when fetch failed and cache missed.
for(const path of ["/Badminton/","/Badminton/index.html?fresh=1"]){
 const sw=harness({offline:true});
 const response=await sw.fetchResult(makeReq(path));
 assert.ok(response instanceof Response,"Offline navigation must resolve to a real Response");
 assert.equal(response.status,503);
 assert.match(await response.text(),/Schmetterlinge ist momentan nicht erreichbar/);
}
{
 const sw=harness({offline:true});
 const response=await sw.fetchResult(makeReq("app.js","script"));
 assert.equal(response.status,503,"Offline asset must never resolve to undefined");
}
{
 const sw=harness({offline:true,hit:"all"});
 const response=await sw.fetchResult(makeReq("index.html"));
 assert.equal(response.status,200);
 assert.equal(await response.text(),"cached");
}
{
 const sw=harness({offline:true,hit:{url:scope+"welcome.html"}});
 const response=await sw.fetchResult(makeReq("welcome.html?from=app"));
 assert.equal(response.status,200,"Invitation link should show cached onboarding page");
 assert.equal(await response.text(),"cached");
}
{
 const sw=harness({offline:true,hit:{url:scope+"index.html"}});
 const response=await sw.fetchResult(makeReq("welcome.html"));
 assert.equal(response.status,503,"Invitation link must not show cached home instead");
 assert.match(await response.text(),/Schmetterlinge ist momentan nicht erreichbar/);
}
{
 const sw=harness({offline:true,hit:{url:scope+"index.html"}});
 const response=await sw.fetchResult(makeReq("private-player.html"));
 assert.equal(response.status,503,"Private invitation must never fall back to public home");
}
{
 const sw=harness({offline:true,cacheFailure:true});
 const response=await sw.fetchResult(makeReq("index.html"));
 assert.equal(response.status,503,"CacheStorage exceptions must not reject respondWith");
}
{
 const sw=harness({cacheFailure:true});
 const response=await sw.fetchResult(makeReq("index.html"));
 assert.equal(response.status,200,"Cache failure must not prevent online load");
}
{
 const sw=harness();
 const response=await sw.fetchResult(makeReq("index.html"));
 assert.equal(response.status,200);
 assert.equal(sw.cacheWrites.length,1);
}
// v166: install only the directly used shell. Unvisited features load on demand.
{
 const sw=harness();
 await sw.lifecycle("install");
 const html=await readFile("index.html","utf8");
 const linked=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="(\.\/[^"]+)"/g),
  ...html.matchAll(/<script\b[^>]*src="(\.\/[^"]+)"/g)].map(match=>match[1]);
 for(const path of linked)assert.ok(sw.accepted.includes(path),"Missing initial shell asset "+path);
 for(const png of ["./assets/schmetterlinge-apple-touch-icon-180.png",
  "./assets/schmetterlinge-pwa-192.png","./assets/schmetterlinge-pwa-512.png"])
  assert.ok(sw.accepted.includes(png),"iPhone install icon missing: "+png);
 assert.ok(!sw.accepted.includes("./wiki.js"),"Wiki module should load on first use");
 assert.ok(!sw.accepted.some(path=>path.includes("/data/")),"No player indexes during worker installation");
 for(const asset of ["./spiele.js","./spiele.css","./games/snake.mjs"])
  assert.ok(sw.accepted.includes(asset),"Snake must work offline on first installed launch: "+asset);
 for(const asset of ["./spiele-2048.js","./games/2048.mjs"])
  assert.ok(sw.accepted.includes(asset),"2048 must work offline on first installed launch: "+asset);
 // v207 adds exactly two small 2048 modules to the bounded v206 install set.
 // All secondary Wiki/data indexes remain lazy; do not grow this budget silently.
 assert.ok(sw.accepted.length<=102,"Avoid full pre-caching of every optional feature");
}
// Invitation query tokens, unrelated resources and JSON indexes remain outside runtime CacheStorage.
for(const path of ["welcome.html?invite=secret","private-player.html?code=secret","unknown.json","data/history.json"]){
 const sw=harness();
 const response=await sw.fetchResult(makeReq(path));
 if(path==="data/history.json"){assert.equal(response,null);continue;}
 assert.equal(response.status,200);
 assert.equal(sw.cacheWrites.length,0,"Sensitive/unlisted URL was cached: "+path);
}
assert.doesNotMatch(source,/\blocalStorage\b|\bindexedDB\b/,
 "PWA updates must not modify any private local profile storage");
{
 const sw=harness({failOptional:true});
 await sw.lifecycle("install");
 assert.ok(sw.skipped,"Optional assets must not block installation");
 assert.ok(sw.accepted.includes("./index.html"));
 assert.ok(sw.accepted.includes("./welcome.html"));
 assert.ok(sw.accepted.includes("./private-player.html"));
 assert.ok(sw.accepted.includes("./private-player-reader.js"));
 assert.ok(sw.accepted.includes("./scripts/invited-player-local.mjs"));
 assert.ok(sw.accepted.includes("./private-invites.js"));
 assert.ok(sw.accepted.includes("./scripts/private-invite-utils.mjs"));
 assert.ok(sw.accepted.includes("./welcome.js"));
 assert.ok(sw.accepted.includes("./consented-player-data.js"));
 assert.ok(sw.accepted.includes("./scripts/consented-player-data.mjs"));
 assert.ok(sw.accepted.includes("./scripts/invitation-search.mjs"));
 await sw.lifecycle("activate");
 assert.deepEqual(sw.deleted,["schmetterlinge-shell-v119","schmetterlinge-shell-v121","schmetterlinge-shell-v122","schmetterlinge-shell-v123","schmetterlinge-shell-v124","schmetterlinge-shell-v125","schmetterlinge-shell-v127","schmetterlinge-shell-v128","schmetterlinge-shell-v129","schmetterlinge-shell-v130","schmetterlinge-shell-v131","schmetterlinge-shell-v132","schmetterlinge-shell-v133"],
   "Worker must not delete caches belonging to other GitHub Pages apps");
 assert.equal(sw.claimed,true);
}
{
 const sw=harness({failEssential:true});
 await assert.rejects(sw.lifecycle("install"),/Required shell unavailable/);
 assert.equal(sw.skipped,false,"Do not activate when offline shell is missing");
}
{
 const sw=harness();
 assert.equal(await sw.fetchResult(makeReq("data/player-history/index.json","cors")),null,
   "Personal data paths must stay outside CacheStorage");
 assert.equal(await sw.fetchResult(makeReq("private-player.html","navigate","POST")),null);
 assert.equal(sw.networkCalls,0);
}
console.log("Safari PWA: no undefined responses, resilient install, scoped cleanup and no personal-data caching.");
