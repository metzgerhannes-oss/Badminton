import {SIDE,DURATION_MS,MODE_VERSION,newGame,moveGame} from './games/2048.mjs';
'use strict';
// P2-C: optional local-only 2048. No network, DBV identifiers, or shared scores.
const KEY='schmetterlinge-arcade-2048-v1';
const $=id=>document.getElementById(id);
const panel=$('arcade-2048-shell'),switcher=$('arcade-game');
if(panel&&switcher){
 let state=null,phase='idle',resumePhase='idle',elapsed=0,countdown=0,last=0,timer=null,selected='',notice='',boardFingerprint='';
 const setText=(node,value)=>{if(node.textContent!==value)node.textContent=value};
 const own=()=>window.badmintonArcadeProfiles?.()||{players:[],activeProfileId:''};
 const profiles=()=>own().players.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string');
 const isOwn=id=>profiles().some(p=>p.id===id);
 const uuid=()=>crypto.randomUUID?crypto.randomUUID():[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
 function records(){
  try{const data=JSON.parse(localStorage.getItem(KEY)||'null');
   if(data?.version!==1||!Array.isArray(data.records))return [];
   return data.records.filter(x=>x&&typeof x.profileId==='string'&&
    /^[0-9a-f-]{32,36}$/i.test(x.arcadeId)&&x.modeVersion===MODE_VERSION&&
    Number.isSafeInteger(x.best)&&x.best>=0&&x.best<=1e9).slice(0,12);
  }catch{return []}
 }
 function best(){return records().find(x=>x.profileId===selected)?.best||0}
 function save(){
  if(!isOwn(selected)||!state||!Number.isSafeInteger(state.score))return;
  const current=records(),old=current.find(x=>x.profileId===selected);
  if(old&&old.best>=state.score)return;
  const next={profileId:selected,arcadeId:old?.arcadeId||uuid(),modeVersion:MODE_VERSION,best:state.score};
  try{localStorage.setItem(KEY,JSON.stringify({version:1,records:[...current.filter(x=>x.profileId!==selected),next].slice(-12)}));}
  catch{notice='Lokaler Rekord konnte nicht gespeichert werden.'}
 }
 function stop(){if(timer!==null){clearInterval(timer);timer=null}}
 function abort(message=''){stop();state=null;phase='idle';resumePhase='idle';elapsed=0;countdown=0;notice=message;paint()}
 function pause(){if(phase!=='playing'&&phase!=='countdown')return;resumePhase=phase;phase='paused';stop();paint()}
 function end(reason){stop();phase='over';save();notice=reason==='time'?'Zeit abgelaufen.':reason==='no-moves'?'Keine Züge mehr.':'Runde beendet.';paint()}
 function tick(){
  if(document.hidden||location.hash.split('/')[0]!=='#spiele'||!isOwn(selected)){pause();return}
  const now=performance.now(),delta=Math.min(250,Math.max(0,now-last));last=now;
  if(phase==='countdown'){
   countdown+=delta;if(countdown>=3000){phase='playing';last=performance.now()}
  }else if(phase==='playing'){
   elapsed+=delta;if(elapsed>=DURATION_MS){elapsed=DURATION_MS;end('time');return}
  }
  paint();
 }
 function start(){
  if(!isOwn(selected)){notice='Wähle zuerst ein eigenes Spielerprofil.';paint();return}
  stop();state=newGame();phase='countdown';resumePhase='countdown';elapsed=0;countdown=0;notice='';last=performance.now();
  timer=setInterval(tick,80);paint();
 }
 function resume(){if(phase!=='paused'||!isOwn(selected))return;phase=resumePhase;last=performance.now();timer=setInterval(tick,80);paint()}
 function move(direction){
  if(phase!=='playing'||!state)return;
  const next=moveGame(state,direction);if(next===state)return;
  state=next;if(state.over){end(state.reason);return}paint();
 }
 function draw(){
  const board=$('arcade-2048-board');
  const values=state?.board||Array.from({length:SIDE},()=>Array(SIDE).fill(0));
  const fingerprint=values.flat().join(',');if(boardFingerprint===fingerprint)return;boardFingerprint=fingerprint;
  board.replaceChildren();
  for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
   const value=values[y][x],cell=document.createElement('div');
   cell.className='arcade-2048-cell';cell.dataset.value=String(value);
   cell.setAttribute('role','gridcell');
   cell.setAttribute('aria-label','Zeile '+(y+1)+', Spalte '+(x+1)+': '+(value||'leer'));
   cell.textContent=value?String(value):'';board.append(cell);
  }
 }
 function paint(){
  draw();setText($('arcade-2048-score'),String(state?.score||0));
  setText($('arcade-2048-time'),Math.max(0,Math.ceil((DURATION_MS-elapsed)/1000))+' s');
  setText($('arcade-2048-best'),String(best()));
  const messages={idle:'Bereit für 2048 · 4 × 4 Felder.',countdown:'Start in '+Math.max(1,Math.ceil((3000-countdown)/1000))+' …',
   playing:'2048 läuft. Pfeiltasten oder wischen.',paused:'Pausiert – die Zeit steht still.',over:notice||'Runde beendet.'};
  setText($('arcade-2048-status'),notice&&phase!=='over'?notice:messages[phase]);
  $('arcade-2048-start').hidden=phase!=='idle'&&phase!=='over';
  $('arcade-2048-pause').hidden=phase!=='playing'&&phase!=='countdown';
  $('arcade-2048-resume').hidden=phase!=='paused';
  $('arcade-2048-restart').disabled=phase==='idle';
  $('arcade-2048-start').disabled=!isOwn(selected);
  $('arcade-2048-profile').disabled=phase==='countdown'||phase==='playing';
  switcher.dataset.tileBusy=phase==='countdown'||phase==='playing'?'1':'0';
  switcher.disabled=switcher.dataset.tileBusy==='1'||switcher.dataset.snakeBusy==='1'||switcher.dataset.pongBusy==='1';
 }
 function renderProfiles(){
  const options=profiles(),field=$('arcade-2048-profile'),previous=selected;
  if(!options.some(p=>p.id===selected))selected=options.find(p=>p.id===own().activeProfileId)?.id||options[0]?.id||'';
  if(previous&&previous!==selected&&phase!=='idle')abort('Spielerprofil geändert. Runde verworfen.');
  field.replaceChildren();
  if(!options.length)field.add(new Option('Kein eigenes Profil eingerichtet',''));
  else options.forEach(p=>field.add(new Option(p.name,p.id)));
  field.value=selected;$('arcade-2048-no-profile').hidden=Boolean(options.length);paint();
 }
 function sync(){if(location.hash.split('/')[0]!=='#spiele')pause();else{renderProfiles();paint()}}
 switcher.addEventListener('change',()=>{if(switcher.value!=='2048'&&phase!=='idle')abort('2048-Runde verworfen.');
  $('arcade-snake-shell').hidden=switcher.value!=='snake';panel.hidden=switcher.value!=='2048';
  if(switcher.value==='2048')renderProfiles();
 });
 $('arcade-2048-start').addEventListener('click',start);
 $('arcade-2048-pause').addEventListener('click',pause);
 $('arcade-2048-resume').addEventListener('click',resume);
 $('arcade-2048-restart').addEventListener('click',()=>{abort();start()});
 $('arcade-2048-exit').addEventListener('click',()=>{abort();location.hash='#turniere'});
 $('arcade-2048-profile').addEventListener('change',event=>{if(phase!=='idle'&&phase!=='over')abort('Spielerwechsel: Runde verworfen.');selected=event.target.value;paint()});
 panel.querySelectorAll('[data-2048-direction]').forEach(button=>button.addEventListener('click',()=>move(button.dataset['2048Direction'])));
 document.addEventListener('keydown',event=>{
  if(location.hash.split('/')[0]!=='#spiele'||switcher.value!=='2048'||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName||''))return;
  const directions={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
  if(directions[event.key]){event.preventDefault();move(directions[event.key])}
 });
 let touchStart=null;const board=$('arcade-2048-board');
 board.addEventListener('touchstart',event=>{if(event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY}},{passive:true});
 board.addEventListener('touchend',event=>{
  if(!touchStart||!event.changedTouches.length)return;
  const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y;touchStart=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
 },{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
 window.addEventListener('pagehide',pause);window.addEventListener('hashchange',sync);
 window.addEventListener('badminton:profile-selected',()=>{pause();renderProfiles()});
 window.addEventListener('badminton:arcade-profile-update',renderProfiles);
 renderProfiles();sync();
 document.addEventListener('DOMContentLoaded',()=>{renderProfiles();sync()},{once:true});
 if(document.readyState==='complete')queueMicrotask(()=>{renderProfiles();sync()});
}
