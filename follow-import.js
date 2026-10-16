/** v158: Shared on-demand import requests for new and existing player selections.
 * Only public DBV IDs cross the wire, never device follow lists.
 * The server checks invitation membership, known identity, deduplication and quotas. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
const ID=/^\d{2}-\d{6}$/;
const LAST_KEY="schmetterlinge.importRequested.v158";
const DAY=24*60*60*1000, WEEK=7*DAY, MAX_MATCHES_PER_VISIT=4;
const queue=[],queued=new Set(),matchQueue=[],matchQueued=new Set();
let working=false,matchWorking=false,matchBudget=MAX_MATCHES_PER_VISIT;
function state(){
 try{
  const value=JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}");
  return [...(value.players||[]),...(value.friends||[])].map(p=>p?.id).filter(id=>ID.test(id));
 }catch{return []}
}
function stamp(){
 try{return JSON.parse(localStorage.getItem(LAST_KEY)||"{}")}catch{return {}}
}
function mark(id,kind){
 try{
  const data=stamp(),keys=Object.keys(data).slice(-80);
  const compact=Object.fromEntries(keys.map(k=>[k,data[k]]));
  compact[kind+":"+id]=Date.now();
  localStorage.setItem(LAST_KEY,JSON.stringify(compact));
 }catch{/* Storage is optional. Server rate limits remain authoritative. */}
}
function recent(id,kind,age){
 const t=Number(stamp()[kind+":"+id]||0);
 return t>0&&Date.now()-t<age;
}
function allowed(){return window.badmintonAppAccess?.allowed===true}
async function memberPost(route,id){
 const jwt=await window.badmintonAppAccess.getAccessToken();
 if(!jwt)throw Error("member_unavailable");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const res=await fetch(SUPABASE_ROOT+"rpc/"+route,{
   method:"POST",cache:"no-store",signal:controller.signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+jwt,"Content-Type":"application/json"},
   body:JSON.stringify({p_player_dbv_id:id})
  });
  if(!res.ok)throw Error("demand_http_"+res.status);
  return res.json();
 }finally{clearTimeout(timer)}
}
function matchLater(id){
 if(!allowed()||matchQueued.has(id)||recent(id,"source",WEEK))return;
 matchQueued.add(id);matchQueue.push(id);void drainMatches();
}
async function drainMatches(){
 if(matchWorking)return;
 matchWorking=true;
 try{
  while(matchQueue.length&&allowed()&&matchBudget>0){
   const id=matchQueue.shift();matchQueued.delete(id);
   if(!state().includes(id)||recent(id,"source",WEEK))continue;
   matchBudget--;
   try{
    const jwt=await window.badmintonAppAccess.getAccessToken();
    if(!jwt)break;
    const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),42000);
    try{
     // This route checks an invited member session and the existing central claim.
     const result=await fetch("https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/history-match-import",{
      method:"POST",signal:ctl.signal,headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+jwt,
       "Content-Type":"application/json"},body:JSON.stringify({dbv_id:id})
     });
     if(result.ok){
      const outcome=await result.json().catch(()=>null);
      // HTTP 200 with queued:false can be a rate-limit or missing-source refusal.
      // Do not pretend that such a request imported or refreshed any results.
      if(outcome?.queued===true){
       mark(id,"source");
       window.dispatchEvent(new CustomEvent("badminton:external-matches-updated",{detail:{playerId:id}}));
      }else if(outcome?.reason==="recently_complete"){
       mark(id,"source");
      }
     }
    }finally{clearTimeout(timeout)}
   }catch{/* Existing evidence remains visible; a later visit can retry. */}
  }
 }finally{matchWorking=false}
}
function demand(id,{prioritize=false}={}){
 if(!ID.test(String(id||""))||!state().includes(id))return;
 if(!allowed())return;
 if(recent(id,"demand",DAY)){
  if(prioritize)matchLater(id);
  return;
 }
 if(queued.has(id))return;
 queued.add(id);
 if(prioritize)queue.unshift(id);else queue.push(id);
 void drain();
}
async function drain(){
 if(working)return;working=true;
 try{
  while(queue.length&&allowed()){
   const id=queue.shift();queued.delete(id);
   if(!state().includes(id)||recent(id,"demand",DAY))continue;
   try{
    const result=await memberPost("app_access_history_demand",id);
    if(result?.accepted===true){
     mark(id,"demand");
     matchLater(id);
    }
   }catch{/* Temporary network errors must not mark an import as completed. */}
   // Avoid a burst of profile requests on first launch.
   if(queue.length)await new Promise(resolve=>setTimeout(resolve,350));
  }
 }finally{working=false}
}
function registerExisting(){
 if(!allowed())return;
 const selected=String(window.badmintonActivePlayerId||"");
 const ids=[...new Set(state())];
 if(ids.includes(selected))demand(selected,{prioritize:true});
 for(const id of ids)if(id!==selected)demand(id);
}
window.addEventListener("badminton:app-access-granted",registerExisting);
window.addEventListener("badminton:friend-followed",e=>demand(String(e.detail?.playerId||""),{prioritize:true}));
window.addEventListener("badminton:own-profile-added",e=>demand(String(e.detail?.playerId||""),{prioritize:true}));
window.addEventListener("badminton:profile-change",e=>{
 // Switching among existing profiles prioritizes already requested results.
 const id=String(e.detail?.playerId||"");
 if(allowed()&&state().includes(id)){
  demand(id,{prioritize:true});
  if(recent(id,"demand",DAY))matchLater(id);
 }
});
document.addEventListener("DOMContentLoaded",registerExisting);
