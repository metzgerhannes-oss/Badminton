import {WIDTH,HEIGHT,DURATION_MS,MODE_VERSION,PADDLE_HEIGHT,PADDLE_WIDTH,BALL_RADIUS,newPong,movePaddle,tickPong} from './games/pong.mjs';
'use strict';
const $=id=>document.getElementById(id),panel=$('arcade-pong-shell'),selector=$('arcade-game');
if(panel&&selector){
 const KEY='schmetterlinge-arcade-pong-v1',canvas=$('arcade-pong-board'),ctx=canvas.getContext('2d');
 let game=null,phase='idle',resumePhase='idle',selected='',elapsed=0,countdown=0,last=0,timer=null,notice='';
 const own=()=>window.badmintonArcadeProfiles?.()||{players:[],activeProfileId:''};
 const profiles=()=>own().players.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string');
 const isOwn=id=>profiles().some(p=>p.id===id);
 const uuid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
 function records(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d?.version!==1||!Array.isArray(d.records))return [];
  return d.records.filter(x=>x&&typeof x.profileId==='string'&&/^[0-9a-f-]{32,36}$/i.test(x.arcadeId)&&x.modeVersion===MODE_VERSION&&Number.isSafeInteger(x.best)&&x.best>=0&&x.best<=6000).slice(0,12);
 }catch{return []}}
 const best=()=>records().find(x=>x.profileId===selected)?.best||0;
 function save(){if(!game||!isOwn(selected)||!Number.isSafeInteger(game.score))return;
  const rows=records(),old=rows.find(x=>x.profileId===selected);if(old&&old.best>=game.score)return;
  const entry={profileId:selected,arcadeId:old?.arcadeId||uuid(),modeVersion:MODE_VERSION,best:game.score};
  try{localStorage.setItem(KEY,JSON.stringify({version:1,records:[...rows.filter(x=>x.profileId!==selected),entry].slice(-12)}))}
  catch{notice='Lokaler Rekord konnte nicht gespeichert werden.'}
 }
 function stop(){if(timer!==null){clearInterval(timer);timer=null}}
 function abort(message=''){stop();game=null;phase='idle';resumePhase='idle';elapsed=0;countdown=0;notice=message;paint()}
 function pause(){if(phase!=='playing'&&phase!=='countdown')return;resumePhase=phase;phase='paused';stop();paint()}
 function end(){stop();phase='over';save();notice='Zeit abgelaufen.';paint()}
 function tick(){if(document.hidden||location.hash.split('/')[0]!=='#spiele'||selector.value!=='pong'||!isOwn(selected)){pause();return}
  const now=performance.now(),delta=Math.min(100,Math.max(0,now-last));last=now;
  if(phase==='countdown'){countdown+=delta;if(countdown>=3000){phase='playing';last=performance.now()}}
  else if(phase==='playing'){elapsed+=delta;if(elapsed>=DURATION_MS){elapsed=DURATION_MS;end();return}
   let rest=delta;while(rest>0){const step=Math.min(rest,16);game=tickPong(game,step);rest-=step}
  }paint();
 }
 function start(){if(!isOwn(selected)){notice='Wähle zuerst ein eigenes Spielerprofil.';paint();return}
  stop();game=newPong();phase='countdown';resumePhase='countdown';elapsed=0;countdown=0;notice='';last=performance.now();timer=setInterval(tick,32);paint()}
 function resume(){if(phase!=='paused'||!isOwn(selected))return;phase=resumePhase;last=performance.now();timer=setInterval(tick,32);paint()}
 function move(y){if(phase==='playing'&&game){game=movePaddle(game,y);paint()}}
 function draw(){if(!ctx)return;ctx.fillStyle='#081b34';ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle='#2c628b';for(let y=8;y<HEIGHT;y+=24)ctx.fillRect(WIDTH/2-2,y,4,12);
  if(!game)return;ctx.fillStyle='#aaf7df';ctx.fillRect(18,game.playerY,PADDLE_WIDTH,PADDLE_HEIGHT);
  ctx.fillStyle='#7eb9e9';ctx.fillRect(WIDTH-18-PADDLE_WIDTH,game.botY,PADDLE_WIDTH,PADDLE_HEIGHT);
  ctx.beginPath();ctx.fillStyle='#ffca85';ctx.arc(game.ballX,game.ballY,BALL_RADIUS,0,Math.PI*2);ctx.fill();
 }
 function paint(){draw();$('arcade-pong-score').textContent=String(game?.score||0);
  $('arcade-pong-time').textContent=Math.max(0,Math.ceil((DURATION_MS-elapsed)/1000))+' s';
  $('arcade-pong-best').textContent=String(best());
  const states={idle:'Bereit für Pong Solo.',countdown:'Start in '+Math.max(1,Math.ceil((3000-countdown)/1000))+' …',
   playing:'Pong läuft – jeder Rückschlag zählt.',paused:'Pausiert – die Zeit steht still.',over:notice||'Runde beendet.'};
  $('arcade-pong-status').textContent=notice&&phase!=='over'?notice:states[phase];
  $('arcade-pong-start').hidden=phase!=='idle'&&phase!=='over';
  $('arcade-pong-pause').hidden=phase!=='playing'&&phase!=='countdown';
  $('arcade-pong-resume').hidden=phase!=='paused';
  $('arcade-pong-restart').disabled=phase==='idle';
  $('arcade-pong-start').disabled=!isOwn(selected);
  $('arcade-pong-profile').disabled=phase==='playing'||phase==='countdown';
  selector.dataset.pongBusy=phase==='playing'||phase==='countdown'?'1':'0';
  selector.disabled=['snakeBusy','tileBusy','pongBusy'].some(k=>selector.dataset[k]==='1');
 }
 function renderProfiles(){const list=profiles(),field=$('arcade-pong-profile'),before=selected;
  if(!list.some(p=>p.id===selected))selected=list.find(p=>p.id===own().activeProfileId)?.id||list[0]?.id||'';
  if(before&&before!==selected&&phase!=='idle')abort('Spielerprofil geändert. Runde verworfen.');
  field.replaceChildren();if(!list.length)field.add(new Option('Kein eigenes Profil eingerichtet',''));
  else list.forEach(p=>field.add(new Option(p.name,p.id)));
  field.value=selected;$('arcade-pong-no-profile').hidden=Boolean(list.length);paint();
 }
 function sync(){if(location.hash.split('/')[0]!=='#spiele')pause();else{renderProfiles();paint()}}
 selector.addEventListener('change',()=>{if(selector.value!=='pong'&&phase!=='idle')abort('Pong-Runde verworfen.');
  panel.hidden=selector.value!=='pong';if(selector.value==='pong')renderProfiles()});
 $('arcade-pong-start').addEventListener('click',start);
 $('arcade-pong-pause').addEventListener('click',pause);
 $('arcade-pong-resume').addEventListener('click',resume);
 $('arcade-pong-restart').addEventListener('click',()=>{abort();start()});
 $('arcade-pong-exit').addEventListener('click',()=>{abort();location.hash='#turniere'});
 $('arcade-pong-profile').addEventListener('change',event=>{if(phase!=='idle'&&phase!=='over')abort('Spielerwechsel: Runde verworfen.');selected=event.target.value;paint()});
 const pointer=event=>{const rect=canvas.getBoundingClientRect();if(rect.height)move((event.clientY-rect.top)/rect.height*HEIGHT-PADDLE_HEIGHT/2)};
 canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture?.(event.pointerId);pointer(event)});
 canvas.addEventListener('pointermove',event=>{if(event.buttons||event.pointerType==='touch')pointer(event)});
 document.addEventListener('keydown',event=>{
  if(location.hash.split('/')[0]!=='#spiele'||selector.value!=='pong'||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName||''))return;
  if(['ArrowUp','ArrowDown','w','W','s','S'].includes(event.key)){
   event.preventDefault();move((game?.playerY||0)+(['ArrowUp','w','W'].includes(event.key)?-18:18));
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
 window.addEventListener('pagehide',pause);window.addEventListener('hashchange',sync);
 window.addEventListener('badminton:profile-selected',()=>{pause();renderProfiles()});
 window.addEventListener('badminton:arcade-profile-update',renderProfiles);
 renderProfiles();sync();
 document.addEventListener('DOMContentLoaded',()=>{renderProfiles();sync()},{once:true});
 if(document.readyState==='complete')queueMicrotask(()=>{renderProfiles();sync()});
}
