import {parseDbvPlayerMatchday} from "./dbv-player-parser.mjs";
const ORIGINS=new Set(["https://schmetterlinge-familie.pages.dev",
 "https://metzgerhannes-oss.github.io"]);
const PROJECT="yadexibmjmnjfmfabrug";
const ROOT=Deno.env.get("SUPABASE_URL")||"";
function serviceKey(){
 const old=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(old)return old;
 const s=Deno.env.get("SUPABASE_SECRET_KEYS");
 if(!s)return "";
 try {const j=JSON.parse(s);return j.default||Object.values(j)[0]||""}
 catch{return ""}
}
const KEY=serviceKey();
const PUBLIC="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const headers=(origin:string|null)=>({
 "Content-Type":"application/json","Cache-Control":"no-store",
 "Access-Control-Allow-Origin":origin&&ORIGINS.has(origin)?origin:"null",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,content-type,apikey",
 "Vary":"Origin"
});
const reply=(status:number,body:Record<string,unknown>,origin:string|null)=>
 new Response(JSON.stringify(body),{status,headers:headers(origin)});
async function db(path:string,init:RequestInit={}){
 if(!ROOT||new URL(ROOT).hostname!==PROJECT+".supabase.co"||!KEY)
  throw Error("service_configuration");
 const response=await fetch(ROOT+"/rest/v1/"+path,{
  method:init.method||"GET",body:init.body,signal:init.signal,
  headers:{apikey:KEY,Authorization:"Bearer "+KEY,
   "Content-Type":"application/json",...init.headers},redirect:"error",
  cache:"no-store"
 });
 if(!response.ok)throw Error("database_http_"+response.status);
 const body=await response.text();
 return body?JSON.parse(body):null;
}
async function member(req:Request){
 const auth=req.headers.get("authorization")||"";
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth)||auth.length>4500)return false;
 try{
  const r=await fetch(ROOT+"/rest/v1/rpc/app_access_status",{
   method:"POST",headers:{apikey:PUBLIC,Authorization:auth,
    "Content-Type":"application/json"},body:"{}",redirect:"error"
  });
  return r.ok&&(await r.json())?.allowed===true;
 }catch{return false}
}
async function cron(req:Request){
 const token=req.headers.get("x-schmetterlinge-matchday-cron")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return false;
 try{
  const valid=await db("rpc/dbv_matchday_cron_authorized",{
   method:"POST",body:JSON.stringify({p_token:token})
  });
  return valid===true;
 }catch{return false}
}
function cookies(r:Response){
 const all=typeof r.headers.getSetCookie==="function"?
  r.headers.getSetCookie():[r.headers.get("set-cookie")||""];
 const jar=new Map<string,string>();
 for(const raw of all)for(const name of ["ASP.NET_SessionId","st"]){
  const m=raw.match(new RegExp("(?:^|,\\s*)("+name+")=([^;,]+)"));
  if(m)jar.set(name,m[2]);
 }
 return jar;
}
function mergeCookies(a:Map<string,string>,b:Map<string,string>){
 for(const [name,value] of b)a.set(name,value);
 return [...a].map(([name,value])=>name+"="+value).join("; ");
}
async function htmlText(r:Response){
 if(r.status!==200||!(r.headers.get("content-type")||"").toLowerCase().includes("text/html"))
  throw Error("source_html_unavailable");
 const len=Number(r.headers.get("content-length")||0);
 if(len>700000)throw Error("source_oversize");
 const body=await r.text();
 if(body.length>700000)throw Error("source_oversize");
 return body;
}
/** Explicitly accept only the technically required cookie, never analytics/ads.
 * No cookies, raw HTML, credentials or player names are stored or logged. */
async function dbvPage(eventId:string,playerNo:number){
 const path="/tournament/"+eventId.toUpperCase()+"/player/"+playerNo;
 const url="https://dbv.turnier.de"+path;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),42000);
 try{
  const first=await fetch(url,{redirect:"manual",signal:ctrl.signal,
   headers:{Accept:"text/html","User-Agent":"Schmetterlinge/1.0 (private tournament matchday)"}});
  if(first.status===200){
   const body=await htmlText(first);
   if(/<title>Player\s*-\s*/i.test(body))return body;
  }else if(first.status!==302&&first.status!==301)throw Error("source_connect");
  let jar=cookies(first);
  const accepted=await fetch("https://dbv.turnier.de/cookiewall/Save",{
   method:"POST",redirect:"manual",signal:ctrl.signal,
   headers:{"Content-Type":"application/x-www-form-urlencoded",
    Cookie:[...jar].map(([k,v])=>k+"="+v).join("; "),Referer:url},
   body:new URLSearchParams({ReturnUrl:path,SettingsOpen:"false",
    CookiePurposes:"1"})
  });
  if(accepted.status!==302&&accepted.status!==200&&accepted.status!==303)
   throw Error("source_consent");
  mergeCookies(jar,cookies(accepted));
  if(!jar.get("st")?.includes("c=1")||!jar.get("st")?.includes("cp=1"))
   throw Error("source_functional_cookie_missing");
  const final=await fetch(url,{redirect:"manual",signal:ctrl.signal,
   headers:{Accept:"text/html",
    Cookie:[...jar].map(([k,v])=>k+"="+v).join("; ")}});
  const html=await htmlText(final);
  if(!/<title>Player\s*-\s*/i.test(html)||!html.includes("match-group__item"))
   throw Error("source_profile_not_loaded");
  return html;
 }finally{clearTimeout(timer)}
}
const berlinDay=(when=Date.now())=>{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Berlin",year:"numeric",
  month:"2-digit",day:"2-digit"}).formatToParts(when);
 const v=(type:string)=>parts.find(x=>x.type===type)?.value||"";
 return [v("year"),v("month"),v("day")].join("-");
};
function due(target:any,tournament:any,now:number,ignoreAge=false){
 if(!tournament||tournament.provider!=="dbv.turnier.de"||
  !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tournament.external_id||"")||
  !/^\d{2}-\d{6}$/.test(target.dbv_id||"")||
  !Number.isSafeInteger(target.source_player_no))return false;
 const day=berlinDay(now);
 if(day<tournament.start_date||day>target.active_until||day>tournament.end_date)
  return false;
 if(!ignoreAge&&Date.parse(target.last_checked_at||"")>now-4*60000)return false;
 return true;
}
async function targets(){
 const rows=await db("dbv_matchday_targets?select=tournament_id,dbv_id,source_player_no,active_until,last_checked_at&order=last_checked_at.asc.nullsfirst&limit=12");
 if(!Array.isArray(rows)||rows.length===0)return [];
 const ids=[...new Set(rows.map((r:any)=>r.tournament_id))];
 if(ids.length>12||ids.some((id:any)=>!/^[a-f0-9-]{36}$/i.test(id)))throw Error("target_ids");
 const events=await db("tournaments?select=id,external_id,provider,start_date,end_date&id=in.("+ids.join(",")+")");
 const mapped=new Map((events||[]).map((e:any)=>[e.id,e]));
 return rows.map((target:any)=>({target,tournament:mapped.get(target.tournament_id)}));
}
async function markError(target:any){
 try{
  await db("dbv_matchday_targets?tournament_id=eq."+target.tournament_id+
   "&dbv_id=eq."+target.dbv_id,{
   method:"PATCH",headers:{Prefer:"return=minimal"},
   body:JSON.stringify({last_checked_at:new Date().toISOString(),
    last_error_at:new Date().toISOString(),error_code:"source_temporarily_unavailable"})
  });
 }catch{}
}
async function syncOne(target:any,tournament:any){
 try{
  const html=await dbvPage(tournament.external_id,target.source_player_no);
  const rows=parseDbvPlayerMatchday(html,{
   tournamentId:tournament.external_id,dbvId:target.dbv_id,
   playerNo:target.source_player_no
  });
  // Database performs identity + source-event validation and atomic upserts.
  return await db("rpc/dbv_matchday_store",{method:"POST",body:JSON.stringify({
   p_tournament_id:target.tournament_id,p_dbv_id:target.dbv_id,
   p_player_no:target.source_player_no,p_rows:rows
  })});
 }catch(error){
  // Never log raw provider data, cookies, identity, URL or SQL response.
  console.error("DBV matchday refresh failed",{code:"source_temporarily_unavailable"});
  await markError(target);
  throw Error("refresh_failed");
 }
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
 if(req.method!=="POST")return reply(405,{error:"post_required"},origin);
 if(origin&&!ORIGINS.has(origin))return reply(403,{error:"origin_denied"},origin);
 if(Number(req.headers.get("content-length")||0)>512)
  return reply(413,{error:"payload_too_large"},origin);
 let body:any;try{const raw=await req.text();if(raw.length>512)throw Error();
  body=JSON.parse(raw);
 }catch{return reply(400,{error:"invalid_json"},origin)}
 const scheduled=body?.mode==="cron";
 if(scheduled?!(await cron(req)):!(await member(req)))
  return reply(403,{error:"member_or_scheduler_required"},origin);
 let selected;
 try{
  const all=await targets();
  if(scheduled){
   selected=all.filter(({target,tournament}:any)=>due(target,tournament,Date.now())).slice(0,4);
  }else{
   const dbvId=String(body?.dbv_id||"");
   const eventId=String(body?.tournament_uuid||"");
   if(!/^\d{2}-\d{6}$/.test(dbvId)||!/^[a-f0-9-]{36}$/i.test(eventId))
    return reply(400,{error:"invalid_scope"},origin);
   selected=all.filter(({target,tournament}:any)=>
    target.dbv_id===dbvId&&tournament?.external_id?.toLowerCase()===eventId.toLowerCase()&&
    due(target,tournament,Date.now())).slice(0,1);
  }
 }catch{return reply(503,{error:"targets_unavailable"},origin)}
 let completed=0,failed=0,stored=0;
 for(const {target,tournament} of selected){
  try{
   const result=await syncOne(target,tournament);
   stored+=Number(result?.stored||0);completed++;
  }catch{failed++}
 }
 return reply(failed&&completed===0?502:200,{
  ok:failed===0,checked:completed,failed,stored,
  next_check_minutes:5,
  source:"DBV tournament player view – exact identity"
 },origin);
});
