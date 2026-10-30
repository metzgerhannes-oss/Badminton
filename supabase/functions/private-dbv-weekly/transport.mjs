// Official DBV transport only. Offline-testable with a synthetic fetcher.
// This code never reads player rows or stores files and never crosses hosts.
const HOST="turniere.badminton.de";
const REDIRECTS=new Set([301,302,303,307,308]);
export class DbvTransportError extends Error {
 constructor(code,reason){super(reason);this.name="DbvTransportError";this.code=code;this.reason=reason;}
}
/**
 * @param {string} url Official URL on the allowlisted DBV host
 * @param {{accept:string,maxBytes:number,timeoutMs:number,fetchImpl?:typeof fetch,
 *   report?:(detail:{reason:string,status?:number,hops?:number,bytes?:number,
 *     declaredBytes?:number,contentType?:string})=>void}} options
 */
export async function fetchOfficialBytes(url,{accept,maxBytes,timeoutMs,fetchImpl=fetch,report=()=>{}}){
 let current;
 try{current=new URL(url);}catch{throw new DbvTransportError("source_unavailable","bad_url");}
 if(current.protocol!=="https:"||current.hostname!==HOST||current.port||current.username||current.password)
  throw new DbvTransportError("source_unavailable","untrusted_host");
 if(!Number.isInteger(maxBytes)||maxBytes<1||!Number.isInteger(timeoutMs)||timeoutMs<1)
  throw new DbvTransportError("source_unavailable","invalid_limit");
 // A single wall-clock timeout applies across the complete at-most-two-hop
 // same-origin redirect chain, not a fresh timeout for each hop.
 const signal=AbortSignal.timeout(timeoutMs);
 for(let hops=0;hops<=2;hops++){
  let response;
  try{
   response=await fetchImpl(current.href,{
    method:"GET",redirect:"manual",headers:{"accept":accept},signal
   });
  }catch{
   report({reason:"network_error",hops});
   throw new DbvTransportError("source_unavailable","network_error");
  }
  if(response.status===401||response.status===403){
   report({reason:"source_forbidden",status:response.status,hops});
   throw new DbvTransportError("source_forbidden","source_forbidden");
  }
  if(response.status===429){
   report({reason:"source_throttled",status:429,hops});
   throw new DbvTransportError("source_throttled","source_throttled");
  }
  if(REDIRECTS.has(response.status)){
   if(hops===2){
    report({reason:"too_many_redirects",status:response.status,hops});
    throw new DbvTransportError("source_unavailable","too_many_redirects");
   }
   const location=response.headers.get("location");
   let next;
   try{next=new URL(location||"",current);}catch{
    report({reason:"invalid_redirect",status:response.status,hops});
    throw new DbvTransportError("source_unavailable","invalid_redirect");
   }
   if(!location||next.protocol!=="https:"||next.hostname!==HOST||next.port||
      next.username||next.password){
    report({reason:"untrusted_redirect",status:response.status,hops});
    throw new DbvTransportError("source_unavailable","untrusted_redirect");
   }
   await response.body?.cancel().catch(()=>{});
   current=next;
   continue;
  }
  if(response.status!==200){
   report({reason:"http_error",status:response.status,hops});
   throw new DbvTransportError("source_unavailable","http_error");
  }
  const declared=Number(response.headers.get("content-length")||0);
  if(!Number.isFinite(declared)||declared<0||declared>maxBytes){
   report({reason:"declared_size_invalid",status:200,hops});
   throw new DbvTransportError("source_unavailable","declared_size_invalid");
  }
  if(!response.body){
   report({reason:"empty_body",status:200,hops});
   throw new DbvTransportError("source_unavailable","empty_body");
  }
  const reader=response.body.getReader(),chunks=[];
  let length=0;
  try{
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    length+=value.byteLength;
    if(length>maxBytes){
     await reader.cancel().catch(()=>{});
     throw new DbvTransportError("source_unavailable","stream_size_limit");
    }
    chunks.push(value);
   }
  }catch(error){
   report({reason:error instanceof DbvTransportError?error.reason:"stream_error",status:200,hops,bytes:length});
   if(error instanceof DbvTransportError)throw error;
   throw new DbvTransportError("source_unavailable","stream_error");
  }
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  report({reason:length?"ok":"zero_bytes",status:200,hops,bytes:length,
   declaredBytes:declared,contentType:(response.headers.get("content-type")||"").split(";")[0].slice(0,64)});
  if(!length)throw new DbvTransportError("source_unavailable","zero_bytes");
  return bytes;
 }
 throw new DbvTransportError("source_unavailable","redirect_limit");
}
