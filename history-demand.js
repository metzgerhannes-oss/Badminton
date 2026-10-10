import {PUBLIC_KEY,demandPost,importStatusPath,importMessage,validHistoryId} from "./scripts/history-demand.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";

let shown="",requestSeq=0,timeout,controller;
const $=id=>document.getElementById(id);
// Import diagnostics belong to Historie, not to the everyday Home dashboard.
const views=()=>[$("history-import-status")].filter(Boolean);
const allowed=id=>{
 const ids=window.badmintonLibraryGetState?.()||{own:[],following:[]};
 return validHistoryId(id)&&[...(ids.own||[]),...(ids.following||[])].includes(id);
};
function show(state,id=""){
 const msg=importMessage(state);
 for(const element of views()){
  element.hidden=!validHistoryId(id);
  element.dataset.state=msg.kind;
  element.innerHTML="";
  const label=document.createElement("strong");
  label.textContent=msg.title;
  const detail=document.createElement("span");
  detail.textContent=msg.detail;
  element.append(label,detail);
  if(state?.last_checked_at){
   const stamped=document.createElement("small");
   const date=new Date(state.last_checked_at);
   stamped.textContent="Zuletzt geprüft: "+(Number.isNaN(date.getTime())?"unbekannt":date.toLocaleDateString("de-DE"));
   element.append(stamped);
  }
 }
}
async function callStatus(id,signal){
 const {rows}=await readPublicRows(importStatusPath(id),{signal,count:false});
 return rows[0]||null;
}
async function requestDemand(id,signal){
 const payload=demandPost(id);
 if(!payload)return false;
 const response=await fetch(payload.url,{
  method:"POST",signal,headers:payload.headers,body:payload.body
 });
 if(!response.ok)throw Error("History demand HTTP "+response.status);
 return (await response.json())?.accepted===true;
}
async function refresh(id,{enqueue=true}={}){
 if(!allowed(id))return;
 const seq=++requestSeq;
 shown=id;
 clearTimeout(timeout);
 controller?.abort();
 controller=new AbortController();
 const signal=controller.signal;
 show({status:"checking"},id);
 try{
  // Only an explicit visit to Historie can activate the bounded server queue.
  const accepted=enqueue?await requestDemand(id,signal):true;
  const status=await callStatus(id,signal);
  if(enqueue&&accepted&&seq===requestSeq)void requestIndividualMatches(id);
  if(seq!==requestSeq)return;
  show(status,id);
  if(status?.status==="queued"||status?.status==="checking"){
   timeout=setTimeout(()=>{
    if(document.visibilityState==="visible"&&id===shown)refresh(id,{enqueue:false});
   },60000);
  }
 }catch(error){
  if(seq!==requestSeq||signal.aborted||error.name==="AbortError"||error.kind==="aborted")return;
  console.warn("History import queue temporarily unavailable:",error.message);
  for(const element of views()){
   element.hidden=false;element.dataset.state="offline";
   element.textContent="Historische Quellenprüfung derzeit nicht erreichbar – bereits vorhandene Ergebnisse bleiben sichtbar.";
  }
 }
}
const sourceCheckAt=new Map();
async function requestIndividualMatches(id){
 if(!allowed(id))return;
 // One request per selected player per 15 minutes in this browser session.
 if(Date.now()-(sourceCheckAt.get(id)||0)<15*60000)return;
 sourceCheckAt.set(id,Date.now());
 try{
  const response=await fetch("https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/history-match-import",{
   method:"POST",headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json"},
   body:JSON.stringify({dbv_id:id})
  });
  if(response.ok){
   window.dispatchEvent(new CustomEvent("badminton:external-matches-updated",
    {detail:{playerId:id}}));
  }
 }catch(error){console.warn("Source-backed match import temporarily unavailable",error?.message)}
}
// Following, backup restoration and Home must not upload any DBV-ID.
const historyOpen=()=>location.hash==="#historie";
function select(id){
 clearTimeout(timeout);
 if(!historyOpen()||!allowed(id)){
  shown="";requestSeq++;controller?.abort();
  for(const element of views())element.hidden=true;
  return;
 }
 // Do not enqueue every time the user switches tabs; unique DBV-ID queue is
 // idempotent on the server and the current status is always re-read.
 refresh(id);
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("history-import-status"))return;
 window.addEventListener("badminton:profile-change",e=>select(String(e.detail?.playerId||"")));
 window.addEventListener("hashchange",()=>select(String(window.badmintonActivePlayerId||"")));
 window.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&historyOpen()&&shown&&allowed(shown))refresh(shown,{enqueue:false});
 });
 setTimeout(()=>{if(historyOpen())select(String(window.badmintonActivePlayerId||""));},0);
});
