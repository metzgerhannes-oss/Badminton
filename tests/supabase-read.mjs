import assert from "node:assert/strict";
import {readPublicRows,PublicReadError,SUPABASE_ROOT} from "../scripts/supabase-read.mjs";
const query="players?select=dbv_id,name&limit=40&offset=0";
const result={dbv_id:"05-123456",name:"Muster"};
let calls=0,last;
const success=async(url,options)=>{
 calls++;last={url,options};
 return {ok:true,status:200,headers:{get:header=>header==="content-range"?"0-0/1":null},
  json:async()=>[result]};
};
assert.deepEqual(await readPublicRows(query,{fetchImpl:success}),{rows:[result],range:"0-0/1"});
assert.equal(calls,1);
assert.equal(last.url,SUPABASE_ROOT+query);
assert.equal(last.options.method,"GET");
assert.equal(last.options.cache,"no-store");
assert.equal(last.options.headers.Prefer,"count=exact");
assert.equal(last.options.signal.aborted,false);

for(const invalid of ["", "../players?select=*", "https://evil.example/players?select=*",
 "players#fragment","/rest/v1/players?select=*", "players?select=*&x#bad"]){
 await assert.rejects(()=>readPublicRows(invalid,{fetchImpl:success}),error=>
  error instanceof PublicReadError&&error.kind==="invalid");
}
assert.equal(calls,1,"Invalid requests never hit network");

let retries=0;
const retry=async(url,options)=>{
 retries++;
 if(retries===1)return {ok:false,status:503};
 return success(url,options);
};
assert.deepEqual((await readPublicRows(query,{fetchImpl:retry})).rows,[result]);
assert.equal(retries,2,"Transient GET failure retries exactly once");

let authCalls=0;
await assert.rejects(()=>readPublicRows(query,{fetchImpl:async()=>{
 authCalls++;return {ok:false,status:403};
}}),error=>error.kind==="http"&&error.status===403);
assert.equal(authCalls,1,"Do not retry authorization failures");

let malformedCalls=0;
await assert.rejects(()=>readPublicRows(query,{fetchImpl:async()=>{
 malformedCalls++;return {ok:true,status:200,json:async()=>({not:"rows"})};
}}),error=>error.kind==="invalid");
assert.equal(malformedCalls,1,"Do not retry unexpected response shapes");

let disconnected=0;
const controller=new AbortController();controller.abort();
await assert.rejects(()=>readPublicRows(query,{signal:controller.signal,fetchImpl:async()=>{
 disconnected++;return {ok:true};
}}),error=>error.kind==="aborted");
assert.equal(disconnected,0,"An aborted request must not hit network");

await assert.rejects(()=>readPublicRows(query,{timeoutMs:100,retries:0,fetchImpl:async(url,{signal})=>{
 await new Promise((resolve,reject)=>{
  signal.addEventListener("abort",()=>reject(Object.assign(new Error("aborted"),{name:"AbortError"})),{once:true});
 });
}}),error=>error.kind==="timeout");

let networkAttempts=0;
await assert.rejects(()=>readPublicRows(query,{retries:1,fetchImpl:async()=>{
 networkAttempts++;throw new TypeError("Network not available");
}}),error=>error.kind==="offline");
assert.equal(networkAttempts,2);

console.log("Public Supabase read-only client: bounded GET, pagination, timeouts, transient retries and safe failures.");
