import test from "node:test";
import assert from "node:assert/strict";
import {fetchOfficialBytes,DbvTransportError} from "../supabase/functions/private-dbv-weekly/transport.mjs";

const BASE="https://turniere.badminton.de";
const FILE=BASE+"/uploads/ranking/Ranking_2026_KW43.xlsx";
const XLSX_TYPE="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const zipped=new Uint8Array([80,75,3,4,0,0,0,0,1]);
const opts={accept:XLSX_TYPE,maxBytes:1_000_000,timeoutMs:3000};

test("official URL downloads directly with no redirect, exact bytes and diagnostics",async()=>{
 const calls=[],reports=[];
 const read=await fetchOfficialBytes(FILE,{...opts,
  fetchImpl:async(url,init)=>{
   calls.push({url,redirect:init.redirect,accept:init.headers.accept});
   return new Response(zipped,{status:200,headers:{"content-length":String(zipped.length),"content-type":XLSX_TYPE}});
  },report:r=>reports.push(r)
 });
 assert.deepEqual([...read],[...zipped]);
 assert.deepEqual(calls,[{url:FILE,redirect:"manual",accept:XLSX_TYPE}]);
 assert.deepEqual(reports[0],{reason:"ok",status:200,hops:0,
  bytes:zipped.length,declaredBytes:zipped.length,contentType:XLSX_TYPE});
});

test("only same-host HTTPS redirect is followed, at most twice",async()=>{
 const urls=[];
 const result=await fetchOfficialBytes(FILE,{...opts,
  fetchImpl:async(url)=>{
   urls.push(url);
   if(url===FILE)return new Response(null,{status:302,headers:{location:"/ranking/download"}});
   return new Response(zipped,{status:200});
  }
 });
 assert.deepEqual(urls,[FILE,BASE+"/ranking/download"]);
 assert.deepEqual([...result],[...zipped]);
});

for(const evil of ["https://evil.example/file.xlsx","http://turniere.badminton.de/ranking/download",
 "https://turniere.badminton.de:8443/ranking/download"]){
 test("untrusted redirect rejected without making a second request: "+evil,async()=>{
  let count=0;
  await assert.rejects(()=>fetchOfficialBytes(FILE,{...opts,
   fetchImpl:async()=>{count++;return new Response(null,{status:302,headers:{location:evil}});}}),
  e=>e instanceof DbvTransportError&&e.code==="source_unavailable"&&e.reason==="untrusted_redirect");
  assert.equal(count,1);
 });
}

for(const [status,code] of [[401,"source_forbidden"],[403,"source_forbidden"],[429,"source_throttled"]]){
 test("HTTP "+status+" is terminal, no same-host or other URL retry",async()=>{
  let count=0;
  await assert.rejects(()=>fetchOfficialBytes(FILE,{...opts,fetchImpl:async()=>{
    count++;return new Response(null,{status});
  }}),e=>e.code===code);
  assert.equal(count,1);
 });
}

test("HTTP 200 with zero bytes remains a failure and emits only aggregate metrics",async()=>{
 const diagnostics=[];
 await assert.rejects(()=>fetchOfficialBytes(FILE,{...opts,
  fetchImpl:async()=>new Response(null,{status:200,headers:{"content-length":"0"}}),
  report:r=>diagnostics.push(r)
 }),e=>e.code==="source_unavailable"&&e.reason==="empty_body");
 assert.equal(diagnostics.length,1);
 assert.deepEqual(diagnostics[0],{reason:"empty_body",status:200,hops:0});
});

test("streamed HTTP 200 empty body emits zero_bytes diagnosis",async()=>{
 const diagnostics=[];
 await assert.rejects(()=>fetchOfficialBytes(FILE,{...opts,
  fetchImpl:async()=>new Response(new ReadableStream({start(controller){controller.close()}}),{status:200}),
  report:r=>diagnostics.push(r)
 }),e=>e.code==="source_unavailable"&&e.reason==="zero_bytes");
 assert.equal(diagnostics[0].reason,"zero_bytes");
 assert.equal(diagnostics[0].bytes,0);
});

test("bounded body reader rejects oversized or declared oversized streams",async()=>{
 await assert.rejects(()=>fetchOfficialBytes(FILE,{...opts,maxBytes:3,
  fetchImpl:async()=>new Response(zipped,{status:200,headers:{"content-length":"9"}})
 }),e=>e.reason==="declared_size_invalid");
 await assert.rejects(()=>fetchOfficialBytes(FILE,{...opts,maxBytes:3,
  fetchImpl:async()=>new Response(zipped,{status:200})
 }),e=>e.reason==="stream_size_limit");
});

test("three redirects fail closed, cannot reach unrestricted URLs",async()=>{
 let count=0;
 await assert.rejects(()=>fetchOfficialBytes(FILE,{...opts,fetchImpl:async()=>{
  count++;return new Response(null,{status:302,headers:{location:"/ranking/download"}});
 }}),e=>e.reason==="too_many_redirects");
 assert.equal(count,3);
});
