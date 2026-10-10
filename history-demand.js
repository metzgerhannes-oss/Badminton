import {PUBLIC_KEY,importPost,importStatusUrl,importMessage,validHistoryId} from "./scripts/history-demand.mjs";

let shown="",requestSeq=0,timeout,controller;
const $=id=>document.getElementById(id);
const views=()=>[$("history-import-status"),$("home-import-status")].filter(Boolean);
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
 const response=await fetch(importStatusUrl(id),{
  signal,cache:"no-store",headers:{apikey:PUBLIC_KEY,Accept:"application/json"}
 });
 if(!response.ok)throw Error("Status HTTP "+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows))throw Error("Unerwartete Antwort");
 return rows[0]||null;
}
async function requestNew(id,signal){
 const payload=importPost(id);
 if(!payload)return false;
 const response=await fetch(payload.url,{
  method:"POST",signal,headers:payload.headers,body:payload.body
 });
 if(!response.ok)throw Error("Importauftrag HTTP "+response.status);
 return true;
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
  let status=await callStatus(id,signal);
  if(!status&&enqueue){
   await requestNew(id,signal);
   status=await callStatus(id,signal);
  }
  if(seq!==requestSeq)return;
  show(status,id);
  if(status?.status==="queued"||status?.status==="checking"){
   timeout=setTimeout(()=>{
    if(document.visibilityState==="visible"&&id===shown)refresh(id,{enqueue:false});
   },60000);
  }
 }catch(error){
  if(seq!==requestSeq||error.name==="AbortError")return;
  console.warn("History import queue temporarily unavailable:",error.message);
  for(const element of views()){
   element.hidden=false;element.dataset.state="offline";
   element.textContent="Historische Quellenprüfung derzeit nicht erreichbar – bereits vorhandene Ergebnisse bleiben sichtbar.";
  }
 }
}
async function enqueueQuietly(id){
 if(!allowed(id))return;
 try{
  const prior=await callStatus(id);
  if(!prior)await requestNew(id);
 }catch(error){
  console.warn("History job could not be requested:",error?.message);
 }
}
function select(id){
 clearTimeout(timeout);
 if(!allowed(id)){
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
 window.addEventListener("badminton:friend-followed",e=>{
  const id=String(e.detail?.playerId||"");
  if(allowed(id))enqueueQuietly(id);
 });
 window.addEventListener("badminton:own-profile-added",e=>{
  const id=String(e.detail?.playerId||"");
  if(allowed(id))refresh(id);
 });
 window.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&shown&&allowed(shown))refresh(shown,{enqueue:false});
 });
 setTimeout(()=>select(String(window.badmintonActivePlayerId||"")),0);
});
