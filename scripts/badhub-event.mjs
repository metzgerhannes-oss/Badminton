/** Public Badhub event results. Distinct from official DBV and from player realtime feed. */
export const BRIDGE="https://schmetterlinge-event-feed.metzger-hannes.workers.dev/v1/event";
export const SOURCE_KEY="schmetterlinge-badhub-events-v1";
const ASSOC=new Set(["bvbb","bvrp","hbv","bwbv","nbv","bbv","bvs","bvr","sbv","dbv"]);
export function parseBadhubLink(input){
 try{
  const u=new URL(String(input||"").trim());
  if(u.protocol!=="https:"||u.hostname!=="badhub.de"||u.port||u.username||u.password||u.hash)return null;
  const m=u.pathname.match(/^\/([a-z]{2,5})\/turnier(?:\.php)?\/?$/);
  if(!m||!ASSOC.has(m[1]))return null;
  const id=u.searchParams.get("id");
  if(!/^[1-9]\d{0,7}$/.test(id||""))return null;
  // User may paste a discipline/player deep link; keep only canonical event ID.
  if([...u.searchParams.keys()].some(k=>!["id","disc","player"].includes(k)))return null;
  return "https://badhub.de/"+m[1]+"/turnier.php?id="+id;
 }catch{return null}
}
export function queryEvent(url,discipline=""){
 const normalized=parseBadhubLink(url);
 if(!normalized||typeof discipline!=="string"||discipline.length>120)return null;
 const q=new URLSearchParams({url:normalized});
 if(discipline)q.set("disc",discipline);
 return BRIDGE+"?"+q;
}
const txt=(x,n=140)=>typeof x==="string"?x.trim().slice(0,n):"";
export function validateEventResult(value,url,discipline=""){
 const canonical=parseBadhubLink(url);
 if(!canonical||!value||value.provider!=="Badhub"||value.kind!=="published-event-results"||
  value.source_url!==canonical||typeof value.event?.name!=="string"||
  !Array.isArray(value.disciplines)||value.disciplines.length>32||
  !Array.isArray(value.matches)||value.matches.length>200||
  value.selected_discipline!==(discipline||null))return null;
 const options=value.disciplines.filter(x=>typeof x==="string"&&x.length<=120);
 const matches=[];
 for(const item of value.matches){
  if(!item||typeof item!=="object")continue;
  if(!["finished","unknown"].includes(item.category)||!["home","guest",null].includes(item.winner)||
    !Array.isArray(item.sets)||item.sets.length>5||
    !item.sets.every(s=>typeof s==="string"&&/^(?:[0-9]|[1-3][0-9]|40):(?:[0-9]|[1-3][0-9]|40)$/.test(s)))continue;
  matches.push({id:txt(item.id,230),discipline:txt(item.discipline,100),round:txt(item.round,75),
   home:txt(item.home,140),away:txt(item.away,140),sets:item.sets,
   winner:item.winner,category:item.category});
 }
 return {name:txt(value.event.name,140),checkedAt:txt(value.checked_at,50),
  disciplines:options,matches,sourceUrl:canonical};
}
export function renderSummary(data){
 if(!data)return "Keine geprüften Turnierergebnisse";
 const known=data.matches.filter(m=>m.category==="finished").length;
 return data.matches.length+" veröffentlichte Begegnungen · "+known+" mit ausgewiesenem Sieger";
}
