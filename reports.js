/* Verified player mentions and article links. Read only through the invitation-scoped RPC. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
(() => {
 "use strict";
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const safeUrl=s=>{try{const u=new URL(String(s));return u.protocol==="https:"?u.href:""}catch{return ""}};
 const date=s=>s&&/^\d{4}-\d\d-\d\d$/.test(s)?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z")):"Datum offen";
 const CATEGORIES={club:"Verein",opponent_club:"Andere Vereine",association:"Verband",dbv:"DBV",media:"Medien",regional_media:"Regionalpresse",sports_organization:"Sport & Stadt",result_portal:"Resultate"};
 const validId=id=>/^\d{2}-\d{6}$/.test(id||"");
 const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
 const norm=s=>String(s||"").trim().toLocaleLowerCase("de").replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/[.]/g,"").replace(/\s+/g," ");
 let articles=[],sources=[],mentions=new Set(),profileId="",club="",loadedFor=null,loaded=false,busy=false,pending=false;
 function isClubArticle(a){
  const chosen=norm(club);
  if(!chosen)return false;
  // Do not depend on the first 200 of the 916 public club-directory rows.
  if(chosen.includes("moessingen")&&chosen.includes("spvgg"))
   return a.club_id==="spvgg-moessingen";
  return !!a.club_id&&norm(a.club_id)===chosen;
 }
 function renderSources(){
  const box=$("report-source-list");if(!box)return;
  if(!sources.length){box.textContent="Keine Quellen verfügbar.";return}
  const ordered=sources.slice().sort((a,b)=>(a.priority||99)-(b.priority||99));
  box.innerHTML=ordered.map(s=>{
   const href=safeUrl(s.article_index_url)||safeUrl(s.homepage_url);
   if(!href)return "";
   return '<div class="report-source-entry"><a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(s.name)+' ↗</a>'+
     '<span class="report-source-status">'+(s.verification_status==="verified"?"Quelle geprüft":"Recherchequelle – noch keine belegte Nennung")+'</span>'+
     '<small>'+esc(s.access_note||CATEGORIES[s.category]||"")+'</small></div>';
  }).join("");
 }
 function render(){
  const box=$("report-list"),count=$("report-count");
  if(!box||!loaded)return;
  const mode=$("report-scope")?.value||"mentions";
  const category=$("report-category")?.value||"all";
  const term=($("report-search")?.value||"").trim().toLocaleLowerCase("de");
  const matches=articles.filter(a=>{
   if(mode==="mentions"&&!mentions.has(a.id))return false;
   if(mode==="club"&&!isClubArticle(a))return false;
   if(category!=="all"&&a.report_sources?.category!==category)return false;
   return !term||[a.title,a.summary,a.report_sources?.name].join(" ").toLocaleLowerCase("de").includes(term);
  });
  if(count)count.textContent=matches.length+" "+(matches.length===1?"Bericht":"Berichte");
  if(!matches.length){
   let message="Für diese Filter gibt es noch keine belegten Artikel.";
   if(mode==="mentions"&&!validId(profileId))message="Wähle ein Spielerprofil mit DBV-ID.";
   else if(mode==="mentions"&&articles.length)message="Für dieses Profil sind keine weiteren namentlichen Treffer hinterlegt. Unter „Berichte zum Verein“ findest du die Vereinsartikel.";
   else if(mode==="club"&&!club)message="Für dieses Spielerprofil ist noch kein Verein hinterlegt.";
   else if(mode==="club"&&!isClubArticle({club_id:"spvgg-moessingen"})&&articles.length===0)message="Für diesen Verein sind keine geprüften Berichte verfügbar.";
   box.innerHTML='<div class="report-empty">'+esc(message)+'</div>';return;
  }
  box.innerHTML=matches.map(a=>{
   const link=safeUrl(a.url),type=CATEGORIES[a.report_sources?.category]||"Bericht";
   return '<article class="report-card">'+
     '<div class="report-card-meta"><span>'+esc(a.report_sources?.name||type)+'</span><time>'+esc(date(a.published_on))+'</time></div>'+
     '<h3>'+esc(a.title)+'</h3>'+
     (a.summary?'<p>'+esc(a.summary)+'</p>':"")+
     '<div class="report-card-footer"><span>'+esc(mentions.has(a.id)?"Spieler namentlich erwähnt":type)+'</span>'+
     (link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Originalbericht öffnen ↗</a>':"")+'</div>'+
     '</article>';
  }).join("");
 }
 function linkedInvitation(id){
  if(!validId(id))return null;
  try{
   const bindings=JSON.parse(localStorage.getItem("schmetterlinge.acceptedPlayerInviteBindings.v1")||"{}");
   const ids=JSON.parse(localStorage.getItem("schmetterlinge.acceptedPlayerInvite.v3")||"[]");
   const accepted=Array.isArray(ids)?ids:(ids?.id?[ids.id]:[]);
   return accepted.find(key=>UUID.test(key)&&bindings?.[key]===id)||null;
  }catch{return null}
 }
 async function getReports(id){
  if(!window.badmintonAppAccess?.shellAllowed)return null;
  const member=window.badmintonAppAccess.allowed===true;
  const invite=member?null:linkedInvitation(id);
  if(!member&&!invite)return null;
  const token=member?await window.badmintonAppAccess.getAccessToken(): (await getPrivateSession(false))?.access_token;
  if(!token)return null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
  try{
   const response=await fetch(SUPABASE_ROOT+"rpc/app_access_reports_read",{
    method:"POST",cache:"no-store",signal:controller.signal,
    headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({p_player_dbv_id:validId(id)?id:null,p_invitation_id:invite})
   });
   if(!response.ok)throw new Error("Berichte HTTP "+response.status);
   const data=await response.json();
   if(!data||!Array.isArray(data.articles)||!["member","player"].includes(data.scope))throw new Error("Ungültige Berichtsdaten");
   return data;
  }finally{clearTimeout(timer)}
 }
 async function load({force=false}={}){
  if(busy){pending=true;return}
  if(loaded&&loadedFor===profileId&&!force){render();return}
  const requested=profileId;
  busy=true;
  const button=$("report-refresh"),box=$("report-list");if(button)button.disabled=true;
  if(box)box.innerHTML='<p class="report-empty">Berichte werden geladen …</p>';
  try{
   // Public registry lists source links only. Private player mentions are never
   // restored from public JSON or exposed through direct table reads.
   const [catalog,registry]=await Promise.all([
    getReports(requested),
    fetch("./data/report-sources.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Quellenverzeichnis");return r.json()}).catch(()=>({sources:[]}))
   ]);
   if(requested!==profileId){pending=true;return}
   sources=Array.isArray(registry.sources)?registry.sources:[];
   renderSources();
   if(!catalog){
    loaded=false;
    if(box)box.innerHTML='<p class="report-empty">Berichte sind nach bestätigter App- oder Spielerfreigabe sichtbar. Bitte öffne einen gültigen Einladungslink.</p>';
    if($("report-count"))$("report-count").textContent="Berechtigung erforderlich";
    return;
   }
   articles=catalog.articles.filter(a=>a&&safeUrl(a.url)&&typeof a.title==="string");
   mentions=new Set(articles.filter(a=>a.named===true).map(a=>a.id));
   loadedFor=requested;loaded=true;render();
  }catch(error){
   loaded=false;
   if(box)box.innerHTML='<p class="report-empty">Berichte konnten nicht geladen werden. Bitte erneut aktualisieren.</p>';
   if($("report-count"))$("report-count").textContent="Quelle nicht erreichbar";
   console.warn("Badminton report directory:",error.message);
  }finally{
   busy=false;if(button)button.disabled=false;
   if(pending){pending=false;void load({force:true})}
  }
 }
 function changeProfile(next,clubName){
  const updated=next!==profileId;
  profileId=next;club=clubName||"";
  if(updated&&location.hash==="#berichte")void load({force:true});
  else render();
 }
 document.addEventListener("DOMContentLoaded",()=>{
  if(!$("report-list"))return;
  profileId=String(window.badmintonActivePlayerId||"");
  club=String(window.badmintonActiveClub||"");
  $("report-refresh")?.addEventListener("click",()=>load({force:true}));
  for(const id of ["report-scope","report-category","report-search"])
   $(id)?.addEventListener(id==="report-search"?"input":"change",render);
  window.addEventListener("badminton:profile-change",e=>
   changeProfile(String(e.detail?.playerId||""),String(e.detail?.club||"")));
  window.addEventListener("hashchange",()=>{if(location.hash==="#berichte")void load()});
  window.addEventListener("badminton:app-access-granted",()=>{if(location.hash==="#berichte")void load({force:true})});
  window.addEventListener("badminton:player-shell-granted",()=>{if(location.hash==="#berichte")void load({force:true})});
  if(location.hash==="#berichte")void load();
 });
})();
