/**
 * Fetches a licensed/authorized normalized JSON feed.
 * Never scrapes TournamentSoftware or DBV pages.
 * GitHub Actions: repository variable BADMINTON_FEED_URL; optional secret BADMINTON_FEED_TOKEN.
 */
import {mkdir,writeFile} from "node:fs/promises";
const url=process.env.BADMINTON_FEED_URL?.trim();
if(!url){console.log("No authorized feed configured; keeping the unconfigured starter snapshot.");process.exit(0)}
const parsed=new URL(url);
if(parsed.protocol!=="https:")throw Error("BADMINTON_FEED_URL must be HTTPS");
const headers={Accept:"application/json"};
if(process.env.BADMINTON_FEED_TOKEN)headers.Authorization="Bearer "+process.env.BADMINTON_FEED_TOKEN;
const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000),redirect:"error"});
if(!response.ok)throw Error("Feed request failed: HTTP "+response.status);
const contentLength=Number(response.headers.get("content-length")||0);
if(contentLength>5_000_000)throw Error("Feed too large");
const raw=await response.text();
if(raw.length>5_000_000)throw Error("Feed too large");
const obj=JSON.parse(raw);
if(!obj||!Array.isArray(obj.matches)||!Array.isArray(obj.tournaments))throw Error("Feed must contain matches[] and tournaments[]");
if(obj.matches.length>2000||obj.tournaments.length>300)throw Error("Feed limit exceeded");
const statuses=new Set(["scheduled","ready","called","live","finished","delayed","cancelled"]);
const limit=(x,n=200)=>String(x??"").slice(0,n);
const publicUrl=x=>{try{const u=new URL(String(x));return u.protocol==="https:"?u.href:""}catch{return ""}};
const iso=x=>{if(!x)return "";const d=new Date(x);return Number.isNaN(d.getTime())?"":d.toISOString()};
const matches=obj.matches.map((m,i)=>{
 if(!m||!m.id||!statuses.has(m.status))throw Error("Invalid match entry #"+i);
 return {id:limit(m.id,100),tournamentId:limit(m.tournamentId,100),discipline:limit(m.discipline,120),scheduledAt:iso(m.scheduledAt),court:limit(m.court,50),status:m.status,players:Array.isArray(m.players)?m.players.slice(0,4).map(p=>limit(p,120)):[],playerIds:Array.isArray(m.playerIds)?m.playerIds.slice(0,8).map(p=>limit(p,40)):[],score:limit(m.score,150),url:publicUrl(m.url)};
});
const tournaments=obj.tournaments.map((t,i)=>{
 if(!t||!t.id)throw Error("Invalid tournament entry #"+i);
 return {id:limit(t.id,100),name:limit(t.name,200),location:limit(t.location,180),startDate:iso(t.startDate),url:publicUrl(t.url)};
});
const data={schemaVersion:1,connection:"connected",updatedAt:iso(obj.updatedAt)||new Date().toISOString(),source:{name:limit(obj.source?.name||"Autorisierter Turnierfeed",200),url:publicUrl(obj.source?.url)},matches,tournaments};
await mkdir("data",{recursive:true});await writeFile("data/live.json",JSON.stringify(data,null,2)+"\n","utf8");
console.log("Feed synced:",matches.length,"matches,",tournaments.length,"tournaments.");
