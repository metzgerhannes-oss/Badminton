// Private DBV player directory: official Excel -> GitHub OIDC -> atomic Supabase RPC.
// Nothing containing named players is written to public GitHub artifacts or logs.
import {createRemoteJWKSet,jwtVerify} from "npm:jose@6.2.12";
const PROJECT="yadexibmjmnjfmfabrug";
const ISSUER="https://token.actions.githubusercontent.com";
const REPOSITORY="metzgerhannes-oss/Badminton";
const WORKFLOW=REPOSITORY+"/.github/workflows/private-dbv-directory.yml@refs/heads/main";
const AUDIENCE="schmetterlinge-private-dbv-directory-"+PROJECT;
const JWKS=createRemoteJWKSet(new URL(ISSUER+"/.well-known/jwks"));
const ID=/^[0-9]{2}-[0-9]{6}$/;
const CLUB_ID=/^[0-9]{2}-[0-9]{3,8}$/;
const AGES=new Set(["U11","U13","U15","U17","U19","U22"]);
const SOURCE="https://turniere.badminton.de/ranking";
const MAX_BODY=4_800_000;
const error=(status:number,code:string)=>Response.json({ok:false,error:code},{
 status,headers:{"Cache-Control":"no-store"}
});
async function allowed(req:Request):Promise<boolean>{
 const auth=req.headers.get("authorization")||"";
 const found=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(auth);
 if(!found||found[1].length>10000)return false;
 const {payload}=await jwtVerify(found[1],JWKS,{
   issuer:ISSUER,audience:AUDIENCE,algorithms:["RS256"],maxTokenAge:"5m",clockTolerance:"15s"
 });
 return payload.repository===REPOSITORY &&
   payload.repository_id==="1412033492" &&
   payload.repository_owner_id==="326005713" &&
   payload.ref==="refs/heads/main" &&
   payload.workflow_ref===WORKFLOW &&
   payload.sub==="repo:metzgerhannes-oss@326005713/Badminton@1412033492:ref:refs/heads/main" &&
   ["schedule","workflow_dispatch"].includes(String(payload.event_name||""));
}
function serviceKey():string|null{
 const old=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(old)return old;
 const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
 if(raw)try{
   const keys=JSON.parse(raw);return keys.default||Object.values(keys)[0] as string||null;
 }catch{return null}
 return null;
}
function checkPayload(p:any):boolean{
 if(!p||typeof p!=="object"||Array.isArray(p)||
  p.source!==SOURCE || !Number.isInteger(p.year) || p.year<2026 || p.year>2100 ||
  !Number.isInteger(p.week)||p.week<1||p.week>53||
  !Array.isArray(p.players)||p.players.length<5000||p.players.length>20000||
  p.total!==p.players.length)return false;
 const seen=new Set<string>();
 const tag=p.year+"-KW"+String(p.week).padStart(2,"0");
 for(const row of p.players){
   if(!row||typeof row!=="object"||Array.isArray(row)||
      typeof row.id!=="string"||!ID.test(row.id)||seen.has(row.id)||
      typeof row.name!=="string"||row.name.trim().length<3||row.name.length>90||
      !Number.isInteger(row.birthYear)||row.birthYear<1990||row.birthYear>2100||
      !AGES.has(row.ageClass)||typeof row.club!=="string"||row.club.length>120||
      typeof row.clubId!=="string"||row.clubId.length>30||
      (row.clubId!==""&&(!CLUB_ID.test(row.clubId)||!row.club.trim()))||
      typeof row.association!=="string"||row.association.length>70||
      row.lastSeen!==tag)return false;
   seen.add(row.id);
 }
 return true;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return error(405,"method_not_allowed");
 let authorized=false;
 try{authorized=await allowed(req)}catch{return error(401,"invalid_oidc_token")}
 if(!authorized)return error(403,"unauthorized_workflow");
 if(!String(req.headers.get("content-type")||"").startsWith("application/json"))return error(415,"content_type");
 if(Number(req.headers.get("content-length")||0)>MAX_BODY)return error(413,"too_large");
 let payload:any;
 try{
   const body=await req.text();
   if(body.length>MAX_BODY)return error(413,"too_large");
   payload=JSON.parse(body);
 }catch{return error(400,"invalid_json")}
 if(!checkPayload(payload))return error(422,"invalid_directory_snapshot");
 const key=serviceKey(),root=Deno.env.get("SUPABASE_URL")||"";
 if(!key||!root||new URL(root).hostname!==PROJECT+".supabase.co")
   return error(503,"database_configuration");
 const headers:Record<string,string>={
   "apikey":key,"Content-Type":"application/json","Accept":"application/json",
   "Cache-Control":"no-store"
 };
 if(key.startsWith("eyJ"))headers.Authorization="Bearer "+key;
 let db:Response;
 try{
   db=await fetch(root+"/rest/v1/rpc/ingest_private_dbv_directory",{
     method:"POST",headers,
     body:JSON.stringify({p_year:payload.year,p_week:payload.week,
       p_total:payload.total,p_players:payload.players}),
     signal:AbortSignal.timeout(90000)
   });
 }catch{return error(503,"database_unreachable")}
 if(!db.ok)return error(502,"database_ingest_rejected");
 let result:any;
 try{result=await db.json()}catch{return error(502,"bad_database_response")}
 if(result?.read!==payload.total||result?.snapshot!==payload.year+"-KW"+String(payload.week).padStart(2,"0"))
   return error(502,"database_confirmation_mismatch");
 return Response.json({ok:true,snapshot:result.snapshot,count:result.read,
   updated:result.players_upserted,clubs:result.clubs_inserted},
   {headers:{"Cache-Control":"no-store"}});
});
