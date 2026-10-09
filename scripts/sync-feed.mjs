/**
 * Scheduled import of an explicitly authorized tournament export.
 * Supported: normalized JSON or tournament CSV schema (see docs/DBV_LIVE.md).
 * IMPORTANT: This script never scrapes DBV or Tournament Software pages.
 */
import {mkdir,writeFile} from "node:fs/promises";
import {normalizeAuthorizedFeed} from "./normalize-feed.mjs";
const url=process.env.BADMINTON_FEED_URL?.trim();
const authorized=process.env.BADMINTON_FEED_AUTHORIZED==="true";
if(!url){
 console.log("DBV Live: no authorized provider URL configured; not connected.");
 process.exit(0);
}
if(!authorized)throw Error("BADMINTON_FEED_AUTHORIZED must be 'true' once redistribution permission is confirmed. No data fetched.");
const parsed=new URL(url);
if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw Error("Provider URL must be plain HTTPS without inline credentials.");
const format=(process.env.BADMINTON_FEED_FORMAT||"json").toLowerCase();
if(!["json","csv"].includes(format))throw Error("BADMINTON_FEED_FORMAT must be json or csv");
const ids=(process.env.BADMINTON_PLAYER_IDS||"05-070879").split(",").map(x=>x.trim()).filter(Boolean);
const headers={Accept:format==="csv"?"text/csv, text/plain;q=0.9":"application/json"};
if(process.env.BADMINTON_FEED_TOKEN)headers.Authorization="Bearer "+process.env.BADMINTON_FEED_TOKEN;
const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000),redirect:"error"});
if(!response.ok)throw Error("Authorized provider responded with HTTP "+response.status);
const length=Number(response.headers.get("content-length")||0);
if(length>5_000_000)throw Error("Authorized feed too large");
const raw=await response.text();
if(raw.length>5_000_000)throw Error("Authorized feed too large");
const dateHeader=response.headers.get("last-modified");
let modifiedAt=null;
if(dateHeader){const d=new Date(dateHeader);if(!Number.isNaN(d.getTime()))modifiedAt=d.toISOString()}
const normalized=normalizeAuthorizedFeed(raw,{
 format,updatedAt:modifiedAt,sourceName:"Autorisierter Turnierfeed",sourceUrl:process.env.BADMINTON_PUBLIC_SOURCE_URL||"https://dbv.turnier.de/",allowedIds:ids
});
await mkdir("data",{recursive:true});
await writeFile("data/live.json",JSON.stringify(normalized,null,2)+"\n","utf8");
console.log("Import complete:",normalized.matches.length,"matches,",normalized.tournaments.length,"tournaments; player filter:",ids.join(", "));
console.log("Feed source timestamp:",normalized.updatedAt||"not supplied (shown as stale in the app)");
