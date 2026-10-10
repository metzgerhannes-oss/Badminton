/** Safe read-only lookup of players from the official DBV directory. */
export const SUPABASE_PLAYERS="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/players";
export const SEARCH_LIMIT=30;
const ID=/^\d{2}-\d{6}$/;
export function normalizeFriendSearch(value){
 return String(value??"").normalize("NFC").replace(/[^\p{L}\p{N} \-]/gu," ").replace(/\s+/g," ").trim().slice(0,70);
}
export function friendSearchUrl(query){
 const term=normalizeFriendSearch(query);
 if(term.length<2)return null;
 const qs=new URLSearchParams({
  select:"dbv_id,name,club,birth_year,age_class,association",
  order:"name.asc,dbv_id.asc",
  limit:String(SEARCH_LIMIT)
 });
 const safe=term.replace(/\s+/g," ");
 // OR grammar is constructed solely from validated letters/digits/hyphens.
 // Numeric DBV IDs can additionally be searched exactly.
 qs.set("or",ID.test(safe)
  ?"(name.ilike.*"+safe+"*,dbv_id.eq."+safe+")"
  :"(name.ilike.*"+safe+"*)");
 return SUPABASE_PLAYERS+"?"+qs.toString();
}
export function asFriendCandidate(record){
 if(!record||!ID.test(String(record.dbv_id??record.id??"")))return null;
 const name=String(record.name||"").trim().replace(/\s+/g," ").slice(0,80);
 if(!name)return null;
 const year=Number(record.birth_year??record.birthYear);
 return {
  id:String(record.dbv_id??record.id),
  name,
  birthYear:Number.isInteger(year)&&year>=1900&&year<=2100?year:undefined,
  club:String(record.club||"").trim().slice(0,120),
  ageClass:String(record.age_class??record.ageClass??""),
  association:String(record.association||""),
  url:""
 };
}
export function classifyFriendCandidate(candidate,selection){
 if((selection?.own||[]).includes(candidate.id))return "own";
 if((selection?.following||[]).includes(candidate.id))return "following";
 return "available";
}
