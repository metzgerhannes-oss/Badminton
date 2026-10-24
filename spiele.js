import {SIZE,DURATION_MS,STEP_MS,MODE_VERSION,newSnake,stepSnake,turnSnake} from "./games/snake.mjs";
"use strict";
// P2-A: local-only Snake. No network, DBV scores, external assets, or shared leaderboards.
const KEY="schmetterlinge-arcade-v1";
const $=id=>document.getElementById(id);
const root=$("view-spiele"),canvas=$("arcade-snake-board");
if(root&&canvas){
 const ctx=canvas.getContext("2d");
 let game=null,phase="idle",previousPhase="idle",selected="",elapsed=0,countdown=0,last=0,timer=null,notice="";
 const own=()=>window.badmintonArcadeProfiles?.()||{players:[],activeProfileId:""};
 const profiles=()=>own().players.filter(p=>p&&typeof p.id==="string"&&typeof p.name==="string");
 const isOwn=id=>profiles().some(p=>p.id===id);
 function load(){
  try{
   const value=JSON.parse(localStorage.getItem(KEY)||"null");
   if(value?.version!==1||!Array.isArray(value.records))return [];
   return value.records.filter(x=>x&&typeof x.profileId==="string"&&
    /^[0-9a-f-]{36}$/i.test(x.arcadeId)&&Number.isSafeInteger(x.best)&&x.best>=0).slice(0,12);
  }catch{return []}
 }
 function uuid(){
  if(typeof crypto.randomUUID==="function")return crypto.randomUUID();
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const s=[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
  return s.slice(0,8)+"-"+s.slice(8,12)+"-"+s.slice(12,16)+"-"+s.slice(16,20)+"-"+s.slice(20);
 }
 function saveRecord(score){
  if(!isOwn(selected))return;
  const records=load(),old=records.find(x=>x.profileId===selected);
  if(old&&old.best>=score)return;
  const next={profileId:selected,arcadeId:old?.arcadeId||uuid(),best:score,modeVersion:MODE_VERSION};
  const updated=[...records.filter(x=>x.profileId!==selected),next].slice(-12);
  try{localStorage.setItem(KEY,JSON.stringify({version:1,records:updated}));}
  catch{notice="Lokaler Rekord konnte nicht gespeichert werden."}
 }
 function best(){return load().find(x=>x.profileId===selected)?.best??0}
 function stop(){if(timer!==null){clearInterval(timer);timer=null}}
 function abort(message=""){stop();game=null;phase="idle";previousPhase="idle";elapsed=0;countdown=0;notice=message;paint()}
 function pause(){
  if(phase!=="playing"&&phase!=="countdown")return;
  previousPhase=phase;phase="paused";stop();paint();
 }
 function end(reason){
  stop();phase="over";
  if(isOwn(selected))saveRecord(game.score);
  notice=reason==="time"?"Zeit abgelaufen.":reason==="board-full"?"Spielfeld vollständig gefüllt.":"Runde beendet.";
  paint();
 }
 function tick(){
  if(document.hidden||location.hash.split("/")[0]!=="#spiele"||!isOwn(selected)){pause();return}
  const now=performance.now(),delta=Math.min(250,Math.max(0,now-last));last=now;
  if(phase==="countdown"){
   countdown+=delta;
   if(countdown>=3000){phase="playing";last=performance.now()}
  }else if(phase==="playing"){
   elapsed+=delta;
   if(elapsed>=DURATION_MS){elapsed=DURATION_MS;end("time");return}
   game=stepSnake(game);
   if(game.over){end(game.reason);return}
  }
  paint();
 }
 function start(){
  if(!isOwn(selected)){notice="Wähle zuerst ein eigenes Spielerprofil.";paint();return}
  stop();game=newSnake();elapsed=0;countdown=0;phase="countdown";previousPhase="countdown";notice="";
  last=performance.now();timer=setInterval(tick,STEP_MS);paint();
 }
 function resume(){
  if(phase!=="paused"||!isOwn(selected))return;
  phase=previousPhase;last=performance.now();timer=setInterval(tick,STEP_MS);paint();
 }
 function paintBoard(){
  if(!ctx)return;
  const scale=canvas.width/SIZE;
  ctx.fillStyle="#081b34";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="#1a3958";ctx.lineWidth=0.6;
  for(let i=0;i<=SIZE;i++){const v=i*scale;ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,v);ctx.lineTo(canvas.width,v);ctx.stroke()}
  if(!game)return;
  if(game.food){ctx.fillStyle="#ffbe6a";ctx.beginPath();ctx.arc((game.food.x+.5)*scale,(game.food.y+.5)*scale,scale*.34,0,Math.PI*2);ctx.fill()}
  game.snake.forEach((part,i)=>{ctx.fillStyle=i?"#62d9b7":"#b3ffe4";ctx.fillRect(part.x*scale+2,part.y*scale+2,scale-4,scale-4)});
 }
 function paint(){
  paintBoard();
  $("arcade-score").textContent=String(game?.score||0);
  $("arcade-time").textContent=String(Math.max(0,Math.ceil((DURATION_MS-elapsed)/1000)))+" s";
  $("arcade-best").textContent=String(best());
  const messages={idle:"Bereit für Snake · 20 × 20 Felder.",countdown:"Start in "+Math.max(1,Math.ceil((3000-countdown)/1000))+" …",
   playing:"Snake läuft.",paused:"Pausiert – die Zeit steht still.",over:notice||"Runde beendet."};
  $("arcade-status").textContent=notice&&phase!=="over"?notice:messages[phase];
  $("arcade-start").hidden=phase!=="idle"&&phase!=="over";
  $("arcade-pause").hidden=phase!=="playing"&&phase!=="countdown";
  $("arcade-resume").hidden=phase!=="paused";
  $("arcade-restart").disabled=phase==="idle";
  $("arcade-start").disabled=!isOwn(selected);
  $("arcade-profile").disabled=phase==="countdown"||phase==="playing";
  $("arcade-board-help").textContent=phase==="over"?"Ergebnis: "+(game?.score||0)+" Punkte.":""; 
 }
 function renderProfiles(){
  const options=profiles(),field=$("arcade-profile"),previous=selected;
  if(!options.some(p=>p.id===selected))selected=options.find(p=>p.id===own().activeProfileId)?.id||options[0]?.id||"";
  if(previous&&previous!==selected&&phase!=="idle")abort("Spielerprofil geändert. Runde verworfen.");
  field.replaceChildren();
  if(!options.length){const opt=new Option("Kein eigenes Profil eingerichtet","");field.add(opt)}
  else options.forEach(p=>field.add(new Option(p.name,p.id)));
  field.value=selected;
  $("arcade-no-profile").hidden=Boolean(options.length);
  paint();
 }
 function syncRoute(){
  if(location.hash.split("/")[0]!=="#spiele")pause();
  else{renderProfiles();paint()}
 }
 function direction(value){
  if(phase==="playing"&&game)game=turnSnake(game,value);
 }
 $("arcade-start").addEventListener("click",start);
 $("arcade-pause").addEventListener("click",pause);
 $("arcade-resume").addEventListener("click",resume);
 $("arcade-restart").addEventListener("click",()=>{abort();start()});
 $("arcade-exit").addEventListener("click",()=>{abort();location.hash="#turniere"});
 $("arcade-profile").addEventListener("change",event=>{if(phase!=="idle"&&phase!=="over")abort("Spielerwechsel: Runde verworfen.");selected=event.target.value;paint()});
 root.querySelectorAll("[data-snake-direction]").forEach(button=>button.addEventListener("click",()=>direction(button.dataset.snakeDirection)));
 document.addEventListener("keydown",event=>{
  if(location.hash.split("/")[0]!=="#spiele"||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName||""))return;
  const directions={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",s:"down",a:"left",d:"right"};
  if(directions[event.key]){event.preventDefault();direction(directions[event.key])}
 });
 let touchStart=null;
 canvas.addEventListener("touchstart",event=>{if(event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY}},{passive:true});
 canvas.addEventListener("touchend",event=>{
  if(!touchStart||!event.changedTouches.length)return;
  const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y;touchStart=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  direction(Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"));
 },{passive:true});
 document.addEventListener("visibilitychange",()=>{if(document.hidden)pause()});
 window.addEventListener("pagehide",pause);
 window.addEventListener("hashchange",syncRoute);
 window.addEventListener("badminton:profile-selected",()=>{if(phase==="playing"||phase==="countdown")pause();renderProfiles()});
 window.addEventListener("badminton:arcade-profile-update",renderProfiles);
 renderProfiles();syncRoute();
 // app.js restores local profiles in its DOMContentLoaded handler. A direct\n // /#spiele launch must re-read them after that restore, not show a false empty state.\n document.addEventListener("DOMContentLoaded",()=>{renderProfiles();syncRoute()},{once:true});\n if(document.readyState==="complete")queueMicrotask(()=>{renderProfiles();syncRoute()});
}
