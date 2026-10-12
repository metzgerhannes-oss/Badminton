"use strict";
/** Private, explicit import of Spond-compatible calendar events. No remote writes. */
var SchmetterlingeSpond=(function(){
 const KEY="schmetterlinge.calendarEvents.v1", MAX_EVENTS=120, MAX_FILE=524288;
 const today=()=>dayParts(new Date());
 const dayParts=d=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const o=Object.fromEntries(p.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return o.year+"-"+o.month+"-"+o.day};
 const dateOk=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||""))return false;const d=new Date(s+"T12:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s};
 function day(value){
  if(typeof value!=="string")return "";
  const s=value.trim();
  if(dateOk(s))return s;
  const compact=s.match(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)(Z)?)?$/i);
  if(compact){
   const bare=compact[1]+"-"+compact[2]+"-"+compact[3];
   if(!dateOk(bare))return "";
   if(compact[7]){
    const d=new Date(compact[1]+"-"+compact[2]+"-"+compact[3]+"T"+compact[4]+":"+compact[5]+":"+compact[6]+"Z");
    return Number.isNaN(d.getTime())?"":dayParts(d);
   }
   return bare;
  }
  if(/^\d{4}-\d\d-\d\dT/.test(s)){
   const d=new Date(s);
   if(Number.isNaN(d.getTime()))return "";
   return /(?:Z|[+-]\d\d:?\d\d)$/i.test(s)?dayParts(d):dateOk(s.slice(0,10))?s.slice(0,10):"";
  }
  return "";
 }
 function previousDay(s){const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
 function clean(x,max=120){return String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max)}
 function unescapeIcs(x){return String(x||"").replace(/\\[nN]/g," ").replace(/\\([,;\\])/g,"$1")}
 function idOf(item){
  const raw=item.uid?item.uid:"fallback:"+item.name.toLocaleLowerCase("de")+"|"+item.startDate+"|"+item.location.toLocaleLowerCase("de");
  // A local, stable hash avoids exposing calendar UID in DOM attributes.
  let h=2166136261;
  for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619)}
  return "calendar-"+(h>>>0).toString(16).padStart(8,"0");
 }
 function normalize(row){
  if(!row||typeof row!=="object")return null;
  const name=clean(row.title??row.name??row.summary,140),startDate=day(String(row.start??row.startDate??row.dtstart??""));
  if(!name||!startDate)return null;
  let endDate=day(String(row.end??row.endDate??row.dtend??""))||startDate;
  if(row.exclusiveEnd===true && endDate>startDate)endDate=previousDay(endDate);
  if(endDate<startDate)endDate=startDate;
  const item={name,startDate,endDate,location:clean(row.location,120),uid:clean(row.uid??row.id,160)};
  return {...item,id:idOf(item),source:"spond"};
 }
 function parseIcs(source){
  const lines=String(source).replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,"").split(/\r?\n/);
  const items=[];let current=null;
  for(const line of lines){
   if(/^BEGIN:VEVENT\s*$/i.test(line)){current={};continue}
   if(/^END:VEVENT\s*$/i.test(line)){
    if(current){const parsed=normalize(current);if(parsed)items.push(parsed)}
    current=null;
    if(items.length>=MAX_EVENTS)break;
    continue;
   }
   if(!current)continue;
   const colon=line.indexOf(":");if(colon<0)continue;
   const field=line.slice(0,colon).toUpperCase(),raw=line.slice(colon+1);
   const property=field.split(";")[0];
   if(property==="SUMMARY")current.title=unescapeIcs(raw);
   if(property==="UID")current.uid=raw;
   if(property==="LOCATION")current.location=unescapeIcs(raw);
   if(property==="DTSTART")current.start=raw;
   if(property==="DTEND"){current.end=raw;current.exclusiveEnd=/VALUE=DATE(?:;|$)/i.test(field)}
  }
  return items;
 }
 function parseSource(source){
  if(typeof source!=="string"||!source.trim())throw Error("Keine Kalenderdaten vorhanden.");
  if(source.length>MAX_FILE)throw Error("Kalenderdatei zu groß (maximal 512 KB).");
  const trimmed=source.trim();
  let rows=[];
  if(/BEGIN:VEVENT/i.test(trimmed))rows=parseIcs(trimmed);
  else if(trimmed.startsWith("{")||trimmed.startsWith("[")){
   let data;try{data=JSON.parse(trimmed)}catch{throw Error("Die Kalenderdaten enthalten kein gültiges JSON.")}
   rows=Array.isArray(data)?data:Array.isArray(data.events)?data.events:[data];
   rows=rows.slice(0,MAX_EVENTS).map(normalize).filter(Boolean);
  }else{
   // Simple Shortcut format: title TAB yyyy-mm-dd TAB yyyy-mm-dd TAB location.
   rows=trimmed.split(/\r?\n/).slice(0,MAX_EVENTS).map(line=>{
    const [title,start,end,location]=line.split("\t");
    return normalize({title,start,end,location});
   }).filter(Boolean);
  }
  if(!rows.length)throw Error("Keine Termine mit gültigem Titel und Datum gefunden.");
  const ids=new Set();
  return rows.filter(x=>{if(ids.has(x.id))return false;ids.add(x.id);return true});
 }
 function read(){
  try{
   const raw=JSON.parse(localStorage.getItem(KEY)||"[]");
   if(!Array.isArray(raw))return [];
   return raw.slice(0,MAX_EVENTS).map(item=>{
    const x=normalize({title:item.name,start:item.startDate,end:item.endDate,location:item.location,uid:item.uid});
    if(!x)return null;
    return {...x,playerId:typeof item.playerId==="string"?item.playerId:"",importedAt:clean(item.importedAt,40)};
   }).filter(Boolean);
  }catch{return []}
 }
 function write(items){localStorage.setItem(KEY,JSON.stringify(items.slice(0,MAX_EVENTS)))}
 function importBatch(incoming,playerId){
  if(!playerId||typeof playerId!=="string")throw Error("Bitte zuerst ein eigenes Spielerprofil auswählen.");
  const stored=read(),index=new Map(stored.map((t,i)=>[t.id+"|"+t.playerId,i]));
  let added=0,updated=0,unchanged=0;
  for(const raw of incoming){
   const item=normalize(raw);if(!item)continue;
   const fresh={...item,playerId,importedAt:new Date().toISOString()};
   const key=item.id+"|"+playerId,pos=index.get(key);
   if(pos===undefined){
    if(stored.length>=MAX_EVENTS)break;
    index.set(key,stored.length);stored.push(fresh);added++;
   }else{
    const before=stored[pos];
    if(["name","startDate","endDate","location"].every(k=>before[k]===fresh[k]))unchanged++;
    else{stored[pos]=fresh;updated++}
   }
  }
  write(stored);
  return {added,updated,unchanged};
 }
 function remove(id,playerId){const rows=read();write(rows.filter(x=>!(x.id===id&&x.playerId===playerId)))}
 function forPlayer(playerId){return read().filter(x=>x.playerId===playerId||x.playerId==="all")}
 function dashboardItems(playerId,official=[]){
  const known=new Set(official.filter(t=>t.playerId===playerId||t.playerId==="all").map(t=>t.startDate+"|"+clean(t.name,140).toLocaleLowerCase("de")));
  return forPlayer(playerId).filter(t=>!known.has(t.startDate+"|"+t.name.toLocaleLowerCase("de")));
 }
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const nice=s=>new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z"));
 const looksLikeTournament=name=>/turnier|ranglist|meisterschaft|spieltag|bezirksliga|landesliga|rlt|cup|open/i.test(name||"");
 let pending=[],getState=()=>({players:[],activeProfileId:"",viewingFriendId:null,officialLinks:[]}),onChange=()=>{};
 function status(message){const node=$("spond-status");if(node)node.textContent=message}
 function render(state){
  const host=$("spond-events");if(!host)return;
  const own=state.players||[],viewing=state.viewingFriendId?null:state.activeProfileId;
  const items=viewing?forPlayer(viewing).sort((a,b)=>a.startDate.localeCompare(b.startDate)).filter(x=>x.endDate>=today()):[];
  const options=$("spond-import-player");
  if(options){
   const before=options.value;
   options.innerHTML=own.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
   options.value=own.some(p=>p.id===before)?before:state.activeProfileId||own[0]?.id||"";
  }
  if(!viewing){host.innerHTML='<p class="settings-hint">Wähle ein eigenes Spielerprofil, um die importierten Termine zu sehen.</p>';return}
  if(!items.length){host.innerHTML='<p class="settings-hint">Noch keine Kalendertermine importiert.</p>';return}
  const known=new Set((state.officialLinks||[]).filter(t=>t.playerId===viewing||t.playerId==="all").map(t=>t.startDate+"|"+clean(t.name,140).toLocaleLowerCase("de")));
  host.innerHTML=items.map(t=>{
   const linked=known.has(t.startDate+"|"+t.name.toLocaleLowerCase("de"));
   return '<article class="spond-event"><div class="spond-event-copy"><strong>'+esc(t.name)+'</strong><small>'+esc(nice(t.startDate))+(t.endDate!==t.startDate?" – "+esc(nice(t.endDate)):"")+(t.location?" · "+esc(t.location):"")+'</small><small>'+ (linked?"Auch als DBV-Turnier gespeichert":"Kalendertermin · Teilnahme nicht bestätigt") +'</small></div><button type="button" class="remove-button" data-spond-remove="'+esc(t.id)+'" data-spond-player="'+esc(t.playerId)+'" aria-label="'+esc(t.name)+' aus Kalenderimport entfernen">Entfernen</button></article>';
  }).join("");
  host.querySelectorAll("[data-spond-remove]").forEach(b=>b.addEventListener("click",()=>{
   remove(b.dataset.spondRemove,b.dataset.spondPlayer);onChange();
  }));
 }
 function preview(rows){
  pending=rows;
  const dlg=$("spond-preview-dialog"),list=$("spond-preview-list");
  if(!dlg||!list)return;
  list.innerHTML=rows.map((t,i)=>'<li><label class="spond-preview-event"><input type="checkbox" data-spond-choose="'+i+'" '+(looksLikeTournament(t.name)?'checked':'')+'><span><strong>'+esc(t.name)+'</strong><small>'+esc(nice(t.startDate))+(t.location?" · "+esc(t.location):"")+'</small></span></label></li>').join("");
  $("spond-preview-count").textContent=rows.length+" Kalendertermine gefunden. Mögliche Turniere sind vorausgewählt. Prüfe die Häkchen und den Spieler – Trainings bleiben standardmäßig abgewählt.";
  const state=getState();
  const select=$("spond-import-player");
  select.innerHTML=state.players.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
  select.value=state.activeProfileId||state.players[0]?.id||"";
  $("spond-import-accept").disabled=!state.players.length;
  if($("spond-source-dialog")?.open)$("spond-source-dialog").close();
  dlg.showModal();
 }
 function hashImport(){
  const hash=window.location.hash||"";
  if(!hash.startsWith("#spond="))return;
  // Fragments are never sent to the web server; clear them before preview.
  history.replaceState(null,"",window.location.pathname+window.location.search+"#turniere");
  try{preview(parseSource(decodeURIComponent(hash.slice(7))))}
  catch(e){status("Kurzbefehl konnte nicht eingelesen werden: "+e.message)}
 }
 function mount(opts={}){
  if(typeof opts.getState==="function")getState=opts.getState;
  if(typeof opts.onChange==="function")onChange=opts.onChange;
  const sourceDialog=$("spond-source-dialog");
  const message=text=>{const p=$("spond-source-error");if(p)p.textContent=text;};
  const fromClipboard=async()=>{
   try{
    if(!navigator.clipboard?.readText)throw Error("Zwischenablage auf diesem Gerät nicht verfügbar.");
    const text=await navigator.clipboard.readText();
    if(!text.trim())throw Error("Die Zwischenablage ist leer.");
    preview(parseSource(text));
    status("Kalenderdaten aus der Zwischenablage geprüft.");
   }catch(error){
    if(!sourceDialog?.open)sourceDialog?.showModal();
    message("Noch keine passenden Termine gefunden. Nutze die iPhone-Anleitung oder die weiteren Importmöglichkeiten.");
   }
  };
  $("spond-quick-import")?.addEventListener("click",()=>{message("");void fromClipboard()});
  $("spond-read-clipboard")?.addEventListener("click",()=>{message("");void fromClipboard()});
  $("spond-source-close")?.addEventListener("click",()=>sourceDialog?.close());
  $("spond-ics-file")?.addEventListener("change",async e=>{
   const file=e.target.files?.[0];if(!file)return;
   try{
    if(file.size>MAX_FILE)throw Error("Datei zu groß (maximal 512 KB).");
    preview(parseSource(await file.text()));status("Kalenderdatei geprüft.");
   }catch(err){message(err.message);status(err.message)}
   e.target.value="";
  });
  $("spond-paste-form")?.addEventListener("submit",e=>{
   e.preventDefault();
   try{preview(parseSource($("spond-paste-data").value));status("Kalenderdaten geprüft.")}
   catch(err){message(err.message);status(err.message)}
  });
  $("spond-import-accept")?.addEventListener("click",()=>{
   try{
    const id=$("spond-import-player").value;
    if(!getState().players.some(p=>p.id===id))throw Error("Ungültiges Spielerprofil.");
    const selected=[...$("spond-preview-list").querySelectorAll("[data-spond-choose]:checked")].map(box=>pending[Number(box.dataset.spondChoose)]).filter(Boolean);
    if(!selected.length)throw Error("Bitte mindestens einen Turniertermin auswählen.");
    const result=importBatch(selected,id);pending=[];$("spond-preview-dialog").close();
    status("Importiert: "+result.added+" neu, "+result.updated+" aktualisiert, "+result.unchanged+" unverändert. Alles bleibt privat auf diesem Gerät.");
    onChange();
   }catch(e){status(e.message)}
  });
  $("spond-import-cancel")?.addEventListener("click",()=>{pending=[];$("spond-preview-dialog").close()});
  window.addEventListener("hashchange",hashImport);
  hashImport();
 }
 return Object.freeze({KEY,day,normalize,parseIcs,parseSource,looksLikeTournament,read,importBatch,remove,forPlayer,dashboardItems,render,mount});
})();
