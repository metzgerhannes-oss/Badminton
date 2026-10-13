/** Private individual tournament invitations, never public player announcements.
 * Browser fragments prevent the token appearing in URL requests and Referrer.
 * No account, player ID or private Spond appointment goes into the invite. */
export const INVITE_STORE="schmetterlinge.privateInvites.v1";
export const SESSION_STORE="schmetterlinge.communitySession.v1";
export const TOKEN=/^[0-9a-f]{64}$/;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY=/^\d{4}-\d\d-\d\d$/;
export function freshToken(cryptoProvider=globalThis.crypto){
 if(!cryptoProvider?.getRandomValues)throw Error("Sichere Zufallszahlen nicht verfügbar");
 const buffer=new Uint8Array(32);cryptoProvider.getRandomValues(buffer);
 return Array.from(buffer,x=>x.toString(16).padStart(2,"0")).join("");
}
export function tokenFromFragment(fragment){
 const raw=String(fragment||"").replace(/^#/,"");
 const match=raw.match(/^invite=([0-9a-f]{64})$/);
 return match?match[1]:null;
}
export function invitationLink(token,base){
 if(!TOKEN.test(token))throw Error("Ungültiges Einladungstoken");
 const url=new URL("private-invite.html",base);
 if(!/^https?:$/.test(url.protocol))throw Error("Ungültige App-Adresse");
 url.hash="invite="+token;
 return url.href;
}
export function safeEvent(bookmark){
 if(!bookmark||typeof bookmark!=="object")throw Error("Kein Turnier ausgewählt");
 const title=String(bookmark.name||"").trim();
 const start=String(bookmark.startDate||""),end=String(bookmark.endDate||start);
 if(!title||title.length>100)throw Error("Bitte einen Turniernamen eintragen");
 if(!DAY.test(start)||!DAY.test(end)||end<start)throw Error("Für private Einladungen sind Beginn und Ende nötig");
 const elapsed=(Date.parse(end+"T00:00:00Z")-Date.parse(start+"T00:00:00Z"))/86400000;
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>366)throw Error("Ungültiger Turnierzeitraum");
 const url=String(bookmark.url||"");
 const official=/^https:\/\/dbv\.turnier\.de\/tournament\/([0-9a-f-]+)$/i.exec(url);
 if(url!=="https://turniere.badminton.de/"&&(!official||!ID.test(official[1])))
  throw Error("Nur belegte DBV-Quellen dürfen privat geteilt werden");
 return {title,start_date:start,end_date:end,source_url:url};
}
export function storedInvites(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
 const out={};
 for(const [key,rec] of Object.entries(raw).slice(0,30)){
  if(!/^.{1,160}$/.test(key)||!rec||typeof rec!=="object"||!TOKEN.test(rec.token)||!ID.test(rec.id)||!Number.isFinite(Date.parse(rec.expires)))continue;
  out[key]={token:rec.token,id:rec.id,expires:rec.expires};
 }
 return out;
}
export function inviteKey(bookmark){return String(bookmark.id||"")+"|"+String(bookmark.playerId||"");}
