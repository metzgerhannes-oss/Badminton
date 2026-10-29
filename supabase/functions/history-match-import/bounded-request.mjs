/** Byte-bounded JSON reader for public Edge Function requests.
 * Header-only checks are insufficient: transfer-encoded uploads may omit
 * Content-Length. Never include request bytes or player data in thrown errors.
 */
export class PayloadTooLargeError extends Error {
 constructor(){super("payload_too_large");this.name="PayloadTooLargeError";}
}
export async function readBoundedJson(request,maxBytes=1024){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new TypeError("invalid_limit");
 const declared=request.headers.get("content-length");
 if(declared!==null){
  if(!/^\d+$/.test(declared))throw new SyntaxError("invalid_content_length");
  if(Number(declared)>maxBytes)throw new PayloadTooLargeError();
 }
 const reader=request.body?.getReader();
 if(!reader)throw new SyntaxError("invalid_json");
 const decoder=new TextDecoder("utf-8",{fatal:true});
 let text="",received=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   received+=value.byteLength;
   if(received>maxBytes){
    await reader.cancel();
    throw new PayloadTooLargeError();
   }
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  return JSON.parse(text);
 }finally{reader.releaseLock();}
}

/** Read third-party HTML with a strict BYTE limit even if Content-Length is absent
 * or inaccurate. Never retain/log provider payload on overflow. */
export async function readBoundedText(response,maxBytes=5500000){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>5500000)
  throw new TypeError("invalid_limit");
 const declared=response.headers.get("content-length");
 if(declared!==null){
  if(!/^\d+$/.test(declared))throw new SyntaxError("invalid_content_length");
  if(Number(declared)>maxBytes)throw new PayloadTooLargeError();
 }
 const reader=response.body?.getReader();
 if(!reader)throw new SyntaxError("invalid_source_body");
 const decoder=new TextDecoder("utf-8");
 let text="",received=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   received+=value.byteLength;
   if(received>maxBytes){
    await reader.cancel();
    throw new PayloadTooLargeError();
   }
   text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
 }finally{reader.releaseLock();}
}
