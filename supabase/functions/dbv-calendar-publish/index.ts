// Restricted official DBV calendar writer. No GitHub-held database credentials.
// This endpoint has verify_jwt=false because GitHub issues its own signed OIDC JWT.
// Reject every request unless jose verifies signature, short lifetime, audience,
// repository identity, main ref and the exact Actions workflow reference.
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.12";

const AUDIENCE = "schmetterlinge-dbv-calendar-yadexibmjmnjfmfabrug";
const ISSUER = "https://token.actions.githubusercontent.com";
const REPO = "metzgerhannes-oss/Badminton";
const WORKFLOW = REPO + "/.github/workflows/dbv-calendar-source.yml@refs/heads/main";
const JWK = createRemoteJWKSet(new URL(ISSUER + "/.well-known/jwks"));
const SOURCE = "https://turniere.badminton.de/";
const AGES = new Set(["U9","U11","U13","U15","U17","U19","U22","O19","O35ff."]);
const LEVELS = new Set(["A","B","C","D","E","Freizeit","International","Sonstige"]);
const SCOPES = new Set(["state","association","national","group","international","unknown"]);
const DISCIPLINES = new Set(["Einzel","Doppel","Mixed"]);
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const ID=/^dbv-calendar-\d{2,12}$/;
const response=(status:number,code:string)=>Response.json({ok:false,error:code},{status,headers:{"Cache-Control":"no-store"}});
function allowedToken(payload:Record<string,unknown>){
 return payload.repository===REPO &&
   payload.repository_id==="1412033492" &&
   payload.repository_owner_id==="326005713" &&
   payload.ref==="refs/heads/main" &&
   payload.workflow_ref===WORKFLOW &&
   payload.sub==="repo:metzgerhannes-oss@326005713/Badminton@1412033492:ref:refs/heads/main" &&
   ["schedule","workflow_dispatch","push"].includes(String(payload.event_name||""));
}
async function authorize(req:Request){
 const auth=req.headers.get("authorization")||"";
 const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(auth);
 if(!match||match[1].length>10000) return false;
 const {payload}=await jwtVerify(match[1],JWK,{
  issuer:ISSUER,audience:AUDIENCE,algorithms:["RS256"],maxTokenAge:"5m",clockTolerance:"15s"
 });
 return allowedToken(payload);
}
function cleanText(value:unknown,max:number,optional=false):string|null{
 if(value===null||value===undefined) return optional?null:null;
 if(typeof value!=="string"||value.length>max||/[\x00-\x08\x0b-\x1f]/.test(value))return null;
 return value.trim();
}
function validDate(s:unknown):boolean{if(typeof s!=="string"||!DATE.test(s))return false;
 const ms=Date.parse(s+"T12:00:00Z");return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===s}
function validUrl(value:unknown):boolean{
 if(value===null)return true;
 if(typeof value!=="string"||value.length>500)return false;
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&["turniere.badminton.de","dbv.turnier.de"].includes(u.hostname)&&!u.username&&!u.password;
 }catch{return false}
}
function normalize(raw:unknown):Record<string,unknown>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("row");
 const row=raw as Record<string,any>;
 if(!ID.test(String(row.source_key||""))||!validDate(row.start_date)||!validDate(row.end_date))throw Error("id_or_date");
 const days=(Date.parse(row.end_date)-Date.parse(row.start_date))/86400000;
 if(days<0||days>14)throw Error("duration");
 const title=cleanText(row.title,240),organizer=cleanText(row.organizer,100);
 if(!title||title.length<3||!organizer)throw Error("text");
 const location=cleanText(row.location_text,180,true);
 const state=cleanText(row.bundesland,90,true);
 const category=cleanText(row.category,100);
 if(location===null&&row.location_text!=null||state===null&&row.bundesland!=null||!category)throw Error("fields");
 if(!SCOPES.has(row.region_scope)||!LEVELS.has(row.level_group))throw Error("facets");
 if(!Array.isArray(row.age_groups)||row.age_groups.length===0||row.age_groups.length>9||
    new Set(row.age_groups).size!==row.age_groups.length||row.age_groups.some(a=>!AGES.has(a)))throw Error("ages");
 if(!Array.isArray(row.disciplines)||row.disciplines.length>3||
    new Set(row.disciplines).size!==row.disciplines.length||row.disciplines.some(d=>!DISCIPLINES.has(d)))throw Error("disciplines");
 if(row.registration_deadline!==null&&!validDate(row.registration_deadline))throw Error("deadline");
 if(!validUrl(row.event_url)||row.source_url!==SOURCE)throw Error("source");
 return {source_key:row.source_key,title,start_date:row.start_date,end_date:row.end_date,
   location_text:location,organizer,bundesland:state,region_scope:row.region_scope,
   category,level_group:row.level_group,age_groups:row.age_groups,disciplines:row.disciplines,
   registration_deadline:row.registration_deadline,event_url:row.event_url,source_url:SOURCE};
}
function databaseKey():string|null{
 const old=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(old)return old;
 const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
 if(raw){
  try{const map=JSON.parse(raw);return map.default||Object.values(map)[0]}catch{return null}
 }
 return null;
}
Deno.serve(async (req:Request)=>{
 if(req.method!=="POST")return response(405,"method_not_allowed");
 let verified=false;
 try{verified=await authorize(req)}catch{return response(401,"invalid_oidc_token")}
 if(!verified)return response(403,"unauthorized_workflow");
 if(!String(req.headers.get("content-type")||"").startsWith("application/json"))return response(415,"content_type");
 if(Number(req.headers.get("content-length")||0)>600000)return response(413,"too_large");
 let payload;
 try{
  const body=await req.text();
  if(body.length>600000)return response(413,"too_large");
  payload=JSON.parse(body);
 }catch{return response(400,"invalid_json")}
 if(!payload||!Array.isArray(payload.entries)||payload.entries.length<1||
    payload.entries.length>1500||payload.expectedCount!==payload.entries.length)return response(422,"invalid_count");
 let rows;
 try{
  rows=payload.entries.map(normalize);
  if(new Set(rows.map(x=>x.source_key)).size!==rows.length)throw Error("duplicates");
 }catch{return response(422,"invalid_calendar_rows")}
 const key=databaseKey(),root=Deno.env.get("SUPABASE_URL");
 if(!key||!root||new URL(root).hostname!=="yadexibmjmnjfmfabrug.supabase.co")
   return response(503,"database_configuration");
 const url=root+"/rest/v1/dbv_calendar_entries?on_conflict=source_key";
 // The server sets the sync timestamp, not the sender. Preserve first_seen_at on upsert.
 const checkedAt=new Date().toISOString();
 const stamped=rows.map(row=>({...row,last_seen_at:checkedAt}));
 // Upsert only official DBV rows. Do not touch private calendar or user tables.
 for(let n=0;n<stamped.length;n+=40){
  const tokenHeader=key.startsWith("eyJ")?{"Authorization":"Bearer "+key}:{};
  let res:Response;
  try{
   res=await fetch(url,{method:"POST",headers:{
    "apikey":key,...tokenHeader,"Content-Type":"application/json",
    "Prefer":"resolution=merge-duplicates,return=minimal"
   },body:JSON.stringify(stamped.slice(n,n+40)),signal:AbortSignal.timeout(14000)});
  }catch{return response(503,"database_unreachable")}
  if(!res.ok)return response(502,"database_upsert_failed");
 }
 return Response.json({ok:true,count:rows.length,source:"official_dbv_calendar"},
  {headers:{"Cache-Control":"no-store"}});
});
