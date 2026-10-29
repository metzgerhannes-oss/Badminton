/** #417: revoked membership must not retain the welcome page's last
 * successful local RPC capability. Synthetic sessions and responses only. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const source=await readFile("welcome.js","utf8");
const start=source.indexOf("async function verifyWelcomeFamilyMember(signal){");
const end=source.indexOf("\nasync function searchPlayers(",start);
assert.ok(start>=0&&end>start,"Welcome page's exact membership gate must exist");
const code=source.slice(start,end)+"\nglobalThis.verify=verifyWelcomeFamilyMember;";
let session=null,permission=false,mode="success",requests=0;
const window={badmintonAppAccess:{allowed:true,getAccessToken:async()=>"stale-member-token"}};
const context=vm.createContext({
 window, SUPABASE_ROOT:"https://example.invalid/rest/v1/",PUBLIC_KEY:"synthetic-public",
 getPrivateSession:async()=>session,
 fetch:async(url,options)=>{
  requests++;
  assert.equal(url,"https://example.invalid/rest/v1/rpc/app_access_status");
  assert.equal(options.headers.Authorization,"Bearer synthetic-family-token");
  if(mode==="network")throw Error("synthetic network error");
  return {ok:mode==="success",json:async()=>({allowed:permission})};
 }
});
vm.runInContext(code,context);
assert.equal(await context.verify(),false,"No session is not a family grant");
assert.equal(window.badmintonAppAccess.allowed,false);
assert.equal(await window.badmintonAppAccess.getAccessToken(),null);
assert.equal(requests,0,"Missing sessions never probe member RPC");
session={access_token:"synthetic-family-token"};permission=true;
assert.equal(await context.verify(),true);
assert.equal(window.badmintonAppAccess.allowed,true);
assert.equal(await window.badmintonAppAccess.getAccessToken(),"synthetic-family-token");
permission=false;mode="success";
assert.equal(await context.verify(),false,"Revoked access is denied");
assert.equal(window.badmintonAppAccess.allowed,false,"Stale member capability must be cleared");
assert.equal(await window.badmintonAppAccess.getAccessToken(),null);
permission=true;
assert.equal(await context.verify(),true);
mode="denied";
assert.equal(await context.verify(),false,"HTTP 403 is not membership");
assert.equal(window.badmintonAppAccess.allowed,false);
mode="success";permission=true;
assert.equal(await context.verify(),true);
mode="network";
await assert.rejects(context.verify(),/synthetic network error/);
assert.equal(window.badmintonAppAccess.allowed,false,"Network failure also invalidates stale capability");
session=null;mode="success";
assert.equal(await context.verify(),false,"Logout must never keep search capability");
assert.equal(window.badmintonAppAccess.allowed,false);

 // Out-of-order replies cannot restore a stale member capability.
 session={access_token:"synthetic-family-token"};
 let finishOld, oldReady;
 const oldStarted=new Promise(resolve=>{oldReady=resolve});
 context.fetch=async()=>({ok:true,json:async()=>{
  oldReady();
  return new Promise(resolve=>{finishOld=resolve});
 }});
 const oldCheck=context.verify();
 await oldStarted;
 assert.equal(window.badmintonAppAccess.allowed,false);
 context.fetch=async()=>({ok:true,json:async()=>({allowed:false})});
 assert.equal(await context.verify(),false);
 finishOld({allowed:true});
 assert.equal(await oldCheck,false);
 assert.equal(window.badmintonAppAccess.allowed,false);

 // Aborting after HTTP headers but before the body resolves must fail closed.
 let finishCanceled, cancelReady;
 const cancelStarted=new Promise(resolve=>{cancelReady=resolve});
 context.fetch=async()=>({ok:true,json:async()=>{
  cancelReady();
  return new Promise(resolve=>{finishCanceled=resolve});
 }});
 const controller=new AbortController();
 const canceled=context.verify(controller.signal);
 await cancelStarted;
 controller.abort();
 finishCanceled({allowed:true});
 assert.equal(await canceled,false);
 assert.equal(window.badmintonAppAccess.allowed,false);
console.log("Welcome membership recheck: stale capability removed on revoked, 403, network or logout.");
