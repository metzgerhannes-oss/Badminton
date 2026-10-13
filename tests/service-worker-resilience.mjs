import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile("sw.js","utf8");
assert.match(source,/const CACHE="schmetterlinge-shell-v121"/);
assert.doesNotMatch(source,/catch\(\)=>caches\.match\(e\.request\)/);

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
  async match(request){
   if(cacheFailure)throw new Error("CacheStorage unavailable");
   const url=typeof request==="string"?request:request.href||request.url;
   return hit && (hit==="all"||url===hit.url)?new Response("cached",{status:200}):undefined;
  },
  async keys(){return ["schmetterlinge-shell-v119","other-app-cache","schmetterlinge-shell-v121"];},
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
{
 const sw=harness({failOptional:true});
 await sw.lifecycle("install");
 assert.ok(sw.skipped,"Optional assets must not block installation");
 assert.ok(sw.accepted.includes("./index.html"));
 await sw.lifecycle("activate");
 assert.deepEqual(sw.deleted,["schmetterlinge-shell-v119"],
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
console.log("Safari PWA v121: no undefined responses, resilient install, scoped cleanup and no personal-data caching.");
