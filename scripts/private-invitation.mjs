/** Private capability tokens never contain a player name, ID or attendance assertion. */
export const TOKEN_RE=/^[a-f0-9]{64}$/;
export const DBV_EVENT_RE=/^https:\/\/dbv\.turnier\.de\/tournament\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const validDate=v=>typeof v==="string"&&DATE_RE.test(v)&&
 !Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
export function newToken(random=globalThis.crypto){
 if(!random?.getRandomValues)throw Error("Sichere Zufallszahlen sind nicht verfügbar.");
 const bytes=new Uint8Array(32);random.getRandomValues(bytes);
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
export function invitationPayload(bookmark,token){
 if(!TOKEN_RE.test(token))throw Error("Ungültiger Freigabeschlüssel.");
 const name=String(bookmark?.name||"").trim();
 const start=bookmark?.startDate||"",end=bookmark?.endDate||start;
 if(!name||name.length>100)throw Error("Bitte einen Turniernamen speichern.");
 if(!validDate(start)||!validDate(end)||end<start||
  (Date.parse(end)-Date.parse(start))/86400000>366)
  throw Error("Bitte zunächst ein gültiges Turnierdatum speichern.");
 const url=String(bookmark?.url||"");
 if(!(DBV_EVENT_RE.test(url)||url==="https://turniere.badminton.de/"))
  throw Error("Nur belegte offizielle Turnierquellen können privat geteilt werden.");
 return {p_token:token,p_title:name,p_start_date:start,p_end_date:end,p_source_url:url};
}
export function linkForToken(base,token){
 if(!TOKEN_RE.test(token))throw Error("Ungültiger Freigabeschlüssel.");
 const u=new URL("./private-invite.html",base);
 u.hash="t="+token;
 return u.href;
}
export function tokenFromHash(hash){
 const text=String(hash||"").replace(/^#/,"");
 const m=/^t=([a-f0-9]{64})$/.exec(text);
 return m?m[1]:"";
}
export function localInviteKey(b){
 return String(b?.id||"")+"|"+String(b?.playerId||"");
}
