/** Client-only deep link to a verified result inside the currently selected,
 * already authorized player's history. Never pass access grants in the URL. */
const PREFIX="#historie/result/";
export function resultEvidenceHash(id){
 if(typeof id!=="string"||!id.trim()||id.length>220||/[\u0000-\u001f]/.test(id))return "#historie";
 return PREFIX+encodeURIComponent(id);
}
export function parseResultEvidenceHash(hash){
 if(typeof hash!=="string"||!hash.startsWith(PREFIX))return "";
 const part=hash.slice(PREFIX.length);
 if(!part||part.length>660||part.includes("/")||part.includes("?")||part.includes("#"))return "";
 try{
  const id=decodeURIComponent(part);
  return id.length>0&&id.length<=220&&id.trim()&&
   !/[\u0000-\u001f]/.test(id)&&encodeURIComponent(id)===part?id:"";
 }catch{return ""}
}
