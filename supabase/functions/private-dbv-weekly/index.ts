// #414. Private, source-rights-gated weekly DBV XLSX importer.
// Never invoked by GitHub Actions. The scheduler is not deployed or enabled
// until operator/source permissions #17/#56 are independently proven.
import {unzipSync} from "npm:fflate@0.8.2";
import {officialPublication,buildWeeklyPayload,importDecision} from "./model.mjs";

import {parseOfficialXlsxXml} from "./xlsx.mjs";

const PROJECT="yadexibmjmnjfmfabrug";
const ROOT="https://"+PROJECT+".supabase.co";
const PAGE="https://turniere.badminton.de/ranking";
function officialXlsxUrl(year:number,week:number):string {
  // Deterministic official archive file naming scheme. Current year/week
  // MUST first be independently verified against the ranking publication stamp.
  if(!Number.isInteger(year)||year<2026||year>2100||
     !Number.isInteger(week)||week<1||week>53)
     throw new ImportError("publication_invalid");
  const file="Ranking_"+String(year)+"_KW"+String(week).padStart(2,"0")+".xlsx";
  return "https://turniere.badminton.de/uploads/ranking/"+file;
}
const MAX_PAGE=5_000_000,MAX_XLSX=12_000_000,MAX_UNZIPPED=65_000_000;
const codes=new Set(["source_forbidden","source_throttled","source_unavailable",
  "publication_invalid","xlsx_invalid","coverage_invalid","database_error","internal_error"]);
class ImportError extends Error {
  code:string;
  constructor(code:string){super(code);this.code=code;}
}
const response=(status:number,body:Record<string,unknown>)=>Response.json(body,{
  status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}
});
// Use a database-only Vault secret for scheduler authorization. Neither the
// token nor its hash is stored in GitHub, Edge source or browser bundles.
async function authorized(req:Request):Promise<boolean> {
  const token=req.headers.get("x-private-dbv-cron-token")||"";
  if(token.length<64||token.length>256)return false;
  try {
    return await dbRpc("authorize_private_dbv_weekly",{p_token:token})===true;
  }catch{return false;}
}
function secretKey():string|null {
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy)return legacy;
  try {
    const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    return typeof keys.default==="string"?keys.default:null;
  }catch{return null;}
}
async function dbRpc(name:string,args:Record<string,unknown>):Promise<any> {
  if(!["authorize_private_dbv_weekly","claim_private_dbv_weekly","finish_private_dbv_weekly","ingest_private_dbv_weekly"].includes(name))
    throw new ImportError("database_error");
  const key=secretKey();
  if(!key||Deno.env.get("SUPABASE_URL")!==ROOT)throw new ImportError("database_error");
  const headers:Record<string,string>={"apikey":key,"content-type":"application/json","accept":"application/json"};
  if(key.startsWith("eyJ"))headers.authorization="Bearer "+key;
  let r:Response;
  try {
    r=await fetch(ROOT+"/rest/v1/rpc/"+name,{
      method:"POST",headers,body:JSON.stringify(args),signal:AbortSignal.timeout(65000)
    });
  }catch{throw new ImportError("database_error");}
  if(!r.ok)throw new ImportError("database_error");
  try{return await r.json();}catch{throw new ImportError("database_error");}
}
async function readLimited(res:Response,max:number):Promise<Uint8Array> {
  if(!res.body)throw new ImportError("source_unavailable");
  const claimed=Number(res.headers.get("content-length")||0);
  if(claimed>max)throw new ImportError("source_unavailable");
  const reader=res.body.getReader(),chunks:Uint8Array[]=[];
  let length=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    length+=value.byteLength;
    if(length>max){await reader.cancel();throw new ImportError("source_unavailable");}
    chunks.push(value);
  }
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return bytes;
}
async function source(url:string,accept:string,max:number,timeout:number):Promise<Uint8Array> {
  let r:Response;
  try {
    r=await fetch(url,{redirect:"error",headers:{"accept":accept,
      "user-agent":"Schmetterlinge-Private-Ranking/2.0 (rights-approved-only)"},
      signal:AbortSignal.timeout(timeout)});
  }catch{throw new ImportError("source_unavailable");}
  if(r.status===401||r.status===403)throw new ImportError("source_forbidden");
  if(r.status===429)throw new ImportError("source_throttled");
  if(r.status!==200||new URL(r.url).hostname!=="turniere.badminton.de")
    throw new ImportError("source_unavailable");
  return readLimited(r,max);
}
function parseXlsx(bytes:Uint8Array):any[] {
  if(bytes.length===0)throw new ImportError("source_unavailable");
  if(bytes.length<100||bytes[0]!==0x50||bytes[1]!==0x4b)
    throw new ImportError("xlsx_invalid");
  let files:Record<string,Uint8Array>;
  try {
    // Reject ZIP bombs from central-directory metadata BEFORE inflation.
    // The parser accepts at most twelve sheets plus one shared-strings file.
    let selected=0,declaredUnzipped=0;
    files=unzipSync(bytes,{filter:file=>{
      const name=file.name;
      if(name!=="xl/sharedStrings.xml"&&!/^xl\/worksheets\/sheet\d+\.xml$/.test(name))
        return false;
      if(!Number.isSafeInteger(file.originalSize)||file.originalSize<0||
         ++selected>13||(declaredUnzipped+=file.originalSize)>MAX_UNZIPPED)
        throw Error("xlsx_inflated_limit");
      return true;
    }});
    if(Object.values(files).reduce((n,b)=>n+b.byteLength,0)>MAX_UNZIPPED)
      throw Error("xlsx_inflated_limit");
    return parseOfficialXlsxXml(files);
  }catch{throw new ImportError("xlsx_invalid");}
}
Deno.serve(async (req:Request)=>{
  if(req.method!=="POST")return response(405,{ok:false,code:"method_not_allowed"});
  if(!await authorized(req))return response(403,{ok:false,code:"not_authorized"});
  // The member-only private import is approved for family use by the operator.
  // Server-side private DB enabled state and the Vault token are BOTH required.
  // No public release or third-party history API permission is implied.
  let claim=null;
  try {
    claim=await dbRpc("claim_private_dbv_weekly",{});
    if(claim?.allowed!==true)return response(202,{ok:false,code:claim?.code||"disabled"});
    if(!/^[0-9a-f-]{36}$/i.test(String(claim.attemptId||"")))
      throw new ImportError("database_error");
    const html=new TextDecoder("utf-8",{fatal:true}).decode(
      await source(PAGE,"text/html",MAX_PAGE,15000));
    let publication;
    try{publication=officialPublication(html);}catch{throw new ImportError("publication_invalid");}
    let decision;
    try{decision=importDecision(claim.latest,publication);}
    catch{throw new ImportError("publication_invalid");}
    if(decision==="unchanged") {
      await dbRpc("finish_private_dbv_weekly",{
        p_attempt_id:claim.attemptId,p_code:"unchanged"});
      return response(200,{ok:true,code:"unchanged",year:publication.year,week:publication.week});
    }
    const xlsxUrl=officialXlsxUrl(publication.year,publication.week);
    const bytes=await source(xlsxUrl,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",MAX_XLSX,35000);
    const rows=parseXlsx(bytes);
    let payload;
    try{payload=buildWeeklyPayload(rows,publication);}
    catch{throw new ImportError("coverage_invalid");}
    const saved=await dbRpc("ingest_private_dbv_weekly",{
      p_attempt_id:claim.attemptId,p_year:payload.year,p_week:payload.week,
      p_total:payload.total,p_players:payload.players,
      p_source_published_at:payload.sourcePublishedAt
    });
    if(saved?.read!==payload.total||saved?.rankings_imported!==payload.rankingTotal||
      saved?.snapshot!==String(payload.year)+"-KW"+String(payload.week).padStart(2,"0"))
      throw new ImportError("database_error");
    return response(200,{ok:true,code:"imported",year:payload.year,week:payload.week,
      players:saved.read,rankings:saved.rankings_imported});
  }catch(error){
    const code=error instanceof ImportError&&codes.has(error.code)?error.code:"internal_error";
    // Only bounded aggregate error categories; no player names, IDs, URLs or payloads.
    if(claim?.attemptId) {
      try{await dbRpc("finish_private_dbv_weekly",{
        p_attempt_id:claim.attemptId,p_code:code});}catch{/* preserve original failure */}
    }
    return response(503,{ok:false,code});
  }
});
