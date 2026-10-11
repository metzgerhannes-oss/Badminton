/** Schmetterlinge public Badhub event-result bridge.
 * One event overview or one discipline per request. No credentials, no broad crawl.
 * Provider match IDs/timestamps are not available on these pages: NEVER label as real-time LIVE.
 * Intended for Workers Free: max one allowed Badhub fetch and 300s cache per request.
 */
const ASSOCIATIONS=new Set(["bvbb","bvrp","hbv","bwbv","nbv","bbv","bvs","bvr","sbv","dbv"]);
const ALLOWED_ORIGIN="https://metzgerhannes-oss.github.io";
const MAX_BYTES=900000;
export function eventUrl(raw){
 try{
  const u=new URL(String(raw||""));
  if(u.protocol!=="https:"||u.hostname!=="badhub.de"||u.port||u.username||u.password||u.hash)return null;
  const m=u.pathname.match(/^\/([a-z]{2,5})\/turnier(?:\.php)?\/?$/);
  if(!m||!ASSOCIATIONS.has(m[1]))return null;
  const id=u.searchParams.get("id");
  if(!/^[1-9]\d{0,7}$/.test(id||""))return null;
  // Reject all supplied query parameters except the single event ID.
  if([...u.searchParams.keys()].some(k=>k!=="id")||[...u.searchParams.keys()].length!==1)return null;
  return {url:"https://badhub.de/"+m[1]+"/turnier.php?id="+id,id,association:m[1]};
 }catch{return null}
}
function decode(value){
 return String(value||"").replace(/&(?:amp|quot|lt|gt|nbsp|#(?:\d+|x[0-9a-f]+));/gi,s=>{
  const named={"&amp;":"&","&quot;":'"',"&lt;":"<","&gt;":">","&nbsp;":" "};
  const low=s.toLowerCase();
  if(named[low])return named[low];
  if(low.startsWith("&#")){const n=low.startsWith("&#x")?parseInt(low.slice(3,-1),16):parseInt(low.slice(2,-1),10);return n>31&&n<=0xffff?String.fromCharCode(n):""}
  return s;
 }).replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,150);
}
export function disciplineLinks(html,id){
 const out=new Map();
 for(const m of html.matchAll(/href=["']([^"']*\bdisc=[^"']+)["']/gi)){
  const raw=decode(m[1]);let url;
  try{url=new URL(raw,"https://badhub.de/bvbb/turnier.php")}catch{continue}
  if(url.searchParams.get("id")!==id)continue;
  const name=url.searchParams.get("disc")||"";
  if(!name||name.length>120)continue;
  const lower=name.toLocaleLowerCase("de");
  if(!out.has(lower))out.set(lower,name);
  if(out.size>=32)break;
 }
 return [...out.values()];
}
function teams(html,side){
 const re=new RegExp('<td\\b[^>]*class="[^"]*td-player--'+side+'[^"]*"[^>]*>([\\s\\S]*?)<\\/td>','i');
 const cell=html.match(re)?.[1]||"";
 const names=[...cell.matchAll(/<span\s+class="name-full"[^>]*>([^<]+)<\/span>/gi)].map(m=>decode(m[1])).filter(Boolean).slice(0,2);
 return names.length?names.join(" / "):"";
}
export function parseDiscipline(html,source,discipline){
 const matches=[],re=/<tr\b([^>]*\bbericht-row\b[^>]*)>([\s\S]*?)<\/tr>/gi;
 let m,ordinal=0;
 while((m=re.exec(html))&&matches.length<200){
  const attrs=m[1],row=m[2];
  const home=teams(row,"home"),away=teams(row,"guest");
  if(!home&&!away)continue;
  ordinal++;
  const sets=[...row.matchAll(/<span\s+class="set-score"[^>]*>\s*(\d{1,2})\s*:\s*(\d{1,2})\s*<\/span>/gi)]
   .map(v=>[Number(v[1]),Number(v[2])]).filter(v=>v[0]<=40&&v[1]<=40).slice(0,5);
  const wonHome=/\bwon--home\b/.test(attrs),wonGuest=/\bwon--guest\b/.test(attrs);
  const winner=wonHome&&!wonGuest?"home":wonGuest&&!wonHome?"guest":null;
  const prefix=html.slice(Math.max(0,m.index-1200),m.index);
  const heads=[...prefix.matchAll(/<div\b[^>]*class="[^"]*tm-group-header[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
  const round=heads.length?decode(heads.at(-1)[1]):"";
  const explicitNonplay=/\b(BYE|Rast|Freilos|Walkover|kampflos|W\.O\.)\b/i.test(decode(row.slice(0,160)))&&!sets.length;
  if(explicitNonplay)continue;
  matches.push({id:source.association+":"+source.id+":"+encodeURIComponent(discipline)+":"+ordinal,
   discipline:discipline.slice(0,100),round:round.slice(0,75),
   home:home||"Noch offen",away:away||"Noch offen",
   sets:sets.map(s=>s.join(":")),
   winner,category:winner&&sets.length?"finished":"unknown"});
 }
 return matches;
}
const cors={"Access-Control-Allow-Origin":ALLOWED_ORIGIN,"Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"Accept"};
const asJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 "Content-Type":"application/json;charset=utf-8","Cache-Control":status===200?"public,max-age=60,s-maxage=300":"no-store",
 ...cors,"X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
async function sourceHtml(target){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const res=await fetch(target,{signal:controller.signal,redirect:"manual",
   headers:{"Accept":"text/html","User-Agent":"SchmetterlingeEventViewer/1.0 (one event discipline, read-only)"},
   cf:{cacheTtl:300,cacheEverything:true}});
  if(!res.ok||res.status>=300)throw Error("Source unavailable");
  const type=res.headers.get("content-type")||"";
  if(!type.includes("text/html"))throw Error("Unexpected source");
  const text=await res.text();
  if(text.length>MAX_BYTES||text.length<100)throw Error("Unexpected document size");
  return text;
 }finally{clearTimeout(timer)}
}
export default {
 async fetch(request,env,ctx){
  const u=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="GET"||u.pathname!=="/v1/event")return asJson({error:"not_found"},404);
  const source=eventUrl(u.searchParams.get("url"));
  if(!source)return asJson({error:"invalid_event_url"},400);
  const disc=u.searchParams.get("disc")||"";
  if(disc.length>120)return asJson({error:"invalid_discipline"},400);
  const key=new Request(u.href,{method:"GET"}),cached=await caches.default.match(key);
  if(cached)return cached;
  try{
   const html=await sourceHtml(source.url+(disc?"&disc="+encodeURIComponent(disc):""));
   if(!html.includes("bericht")&&!html.includes("tm-winner"))throw Error("Unrecognized source");
   const name=decode(html.match(/<title[^>]*>([^<]+)/i)?.[1]||"").replace(/\s+[–-]\s+Badhub$/i,"");
   // Refuse to accept an error page or a redirected unrelated tournament.
   if(!html.includes("turnier.php?id="+source.id))throw Error("Tournament identity mismatch");
   const options=disciplineLinks(html,source.id);
   if(disc&&!options.includes(disc))throw Error("Discipline not published");
   const matches=disc?parseDiscipline(html,source,disc):[];
   const response=asJson({provider:"Badhub",kind:"published-event-results",
    source_url:source.url,checked_at:new Date().toISOString(),
    event:{id:source.id,name,association:source.association},
    disciplines:options,selected_discipline:disc||null,
    matches,count:matches.length,complete:false,
    note:"Nur veröffentlichte Begegnungen der ausgewählten Disziplin. Kein offizieller DBV-Livefeed; keine verifizierten Einzelmatch-IDs oder minutengenauen Spielstände."});
   ctx.waitUntil(caches.default.put(key,response.clone()));
   return response;
  }catch(error){return asJson({error:"source_unavailable",reason:String(error).slice(0,80)},503)}
 }
};
