/** One-time P0 rebuild staging writer. Official GitHub Actions OIDC only.
 * Stages source-labelled facts in a non-public table; never alters live match stats.
 * There is intentionally no public client API to invoke this endpoint.
 */
import {createRemoteJWKSet,jwtVerify} from "npm:jose@6.2.12";
const REF="yadexibmjmnjfmfabrug",AUD="schmetterlinge-fresh-results-"+REF;
const ISSUER="https://token.actions.githubusercontent.com",REPO="metzgerhannes-oss/Badminton";
const WORKFLOW=REPO+"/.github/workflows/p0-fresh-scan.yml@refs/heads/main";
const JWKS=createRemoteJWKSet(new URL(ISSUER+"/.well-known/jwks"));
const PLAYERS=new Set(["05-067838","05-070637","05-069897","05-071969","05-061414","05-061352","05-067866","05-070915","05-070879","05-061350","05-070941","05-070006","05-068197"]);
const error=(code:number,message:string)=>Response.json({ok:false,error:message},{status:code,headers:{"Cache-Control":"no-store"}});
function validFact(x:any):boolean{
 if(!x||typeof x!=="object"||Array.isArray(x)||!PLAYERS.has(x.dbv_id))return false;
 if(typeof x.source_key!=="string"||x.source_key.length<20||x.source_key.length>460||
    !/^tournament:(?:dbv-)?\d+:|^league:\d+:/.test(x.source_key))return false;
 if(!["tournament","league"].includes(x.category)||!["Einzel","Doppel","Mixed"].includes(x.discipline))return false;
 if(![1,2].includes(x.player_side)||![1,2].includes(x.winning_side))return false;
 if(!Number.isInteger(x.match_year)||x.match_year<2000||x.match_year>2100)return false;
 if(!Array.isArray(x.games)||x.games.length>5||
    x.games.some((g:any)=>!Array.isArray(g)||g.length!==2||g.some((v:any)=>!Number.isInteger(v)||v<0||v>40)))return false;
 if(!Array.isArray(x.opponent_names)||x.opponent_names.length<1||x.opponent_names.length>2||
    x.opponent_names.some((n:any)=>typeof n!=="string"||n.length>120))return false;
 if(!Array.isArray(x.partner_names)||x.partner_names.length>1||
    x.partner_names.some((n:any)=>typeof n!=="string"||n.length>120))return false;
 if(typeof x.competition!=="string"||x.competition.length>180||typeof x.event!=="string"||x.event.length>60)return false;
 if(x.match_date!==null&&(typeof x.match_date!=="string"||!/^20\d\d-\d\d-\d\d$/.test(x.match_date)))return false;
 if(typeof x.source_url!=="string"||!/^https:\/\/badhub\.de\/(?:bwbv\/(?:turnier|begegnung)|dbv\/turnier)\.php\?id=\d+$/.test(x.source_url))return false;
 return x.source_name==="Badhub"&&x.source_kind==="third-party-match-card";
}
async function authorize(req:Request):Promise<boolean>{
 const match=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.get("authorization")||"");
 if(!match||match[1].length>10000)return false;
 const {payload}=await jwtVerify(match[1],JWKS,{
  issuer:ISSUER,audience:AUD,algorithms:["RS256"],maxTokenAge:"5m",clockTolerance:"15s"
 });
 return payload.repository===REPO&&payload.repository_id==="1412033492"&&
  payload.repository_owner_id==="326005713"&&
  payload.ref==="refs/heads/main"&&payload.workflow_ref===WORKFLOW&&
  payload.sub==="repo:metzgerhannes-oss@326005713/Badminton@1412033492:ref:refs/heads/main"&&
  ["push","workflow_dispatch","schedule"].includes(String(payload.event_name||""));
}
function secret(){
 const old=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(old)return old;
 try{const map=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");return map.default||Object.values(map)[0]||null}catch{return null}
}
Deno.serve(async (req:Request)=>{
 if(req.method!=="POST")return error(405,"method");
 try{if(!(await authorize(req)))return error(403,"identity")}catch{return error(401,"identity")}
 if(!String(req.headers.get("content-type")||"").startsWith("application/json"))return error(415,"content");
 if(Number(req.headers.get("content-length")||0)>220000)return error(413,"size");
 let body:any;try{
  const text=await req.text();if(text.length>220000)return error(413,"size");
  body=JSON.parse(text);
 }catch{return error(400,"json")}
 if(body?.mode==="reconcile"){
  if(!/^run-[0-9]{8,20}$/.test(body.run||"")||
     !Number.isInteger(body.expected_count)||body.expected_count<1700||body.expected_count>10000||
     !Number.isInteger(body.sources_ok)||!Number.isInteger(body.sources_missing))
     return error(422,"invalid_reconcile_summary");
  const url=Deno.env.get("SUPABASE_URL")||"",key=secret();
  if(!key||!url||new URL(url).hostname!==REF+".supabase.co")return error(503,"dbconfig");
  const headers={apikey:key,...(key.startsWith("eyJ")?{"Authorization":"Bearer "+key}:{}),
    "Content-Type":"application/json"};
  let result:Response;
  try{
   result=await fetch(url+"/rest/v1/rpc/reconcile_spvgg_match_sources",{
    method:"POST",headers,
    body:JSON.stringify({p_source_run:body.run,p_expected_count:body.expected_count,
     p_sources_ok:body.sources_ok,p_sources_missing:body.sources_missing}),
    signal:AbortSignal.timeout(22000)
   });
  }catch{return error(503,"reconciliation_unavailable")}
  if(!result.ok)return error(409,"source_reconciliation_rejected");
  let answer:any;
  try{answer=await result.json()}catch{return error(502,"invalid_db_reply")}
  if(answer?.ok!==true||answer.staged!==body.expected_count)return error(502,"reconciliation_mismatch");
  // Respond only with counts, never identities or underlying match rows.
  return Response.json({ok:true,new_matches:answer.new_matches,quarantined:answer.quarantined,
   source_rows:answer.staged,sources_ok:answer.sources_ok,sources_missing:answer.sources_missing},
   {headers:{"Cache-Control":"no-store"}});
 }
 if(!/^run-[0-9]{8,20}$/.test(body?.run||"")||
    !Array.isArray(body?.rows)||body.rows.length<1||body.rows.length>75||
    body.rows.some((x:any)=>!validFact(x)))return error(422,"facts");
 const pairs=body.rows.map((x:any)=>x.dbv_id+"|"+x.source_key);
 if(new Set(pairs).size!==pairs.length)return error(422,"duplicate");
 const url=Deno.env.get("SUPABASE_URL")||"",key=secret();
 if(!key||!url||new URL(url).hostname!==REF+".supabase.co")return error(503,"dbconfig");
 const rows=body.rows.map((x:any)=>({dbv_id:x.dbv_id,source_key:x.source_key,source_run:body.run,payload:x}));
 const auth=key.startsWith("eyJ")?{"Authorization":"Bearer "+key}:{};
 let res:Response;
 try{
  res=await fetch(url+"/rest/v1/spvgg_match_rebuild_stage?on_conflict=dbv_id,source_key",{
   method:"POST",headers:{apikey:key,...auth,"Content-Type":"application/json",
    Prefer:"resolution=merge-duplicates,return=minimal"},
   body:JSON.stringify(rows),signal:AbortSignal.timeout(20000)
  });
 }catch{return error(503,"dbunavailable")}
 if(!res.ok)return error(502,"upsert_failed");
 return Response.json({ok:true,staged:rows.length,run:body.run},{headers:{"Cache-Control":"no-store"}});
});