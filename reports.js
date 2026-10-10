/* Player mentions and source directory: verified links only, no external fulltext replication. */
(() => {
 "use strict";
 const URL="https://yadexibmjmnjfmfabrug.supabase.co";
 const KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const safeUrl=s=>{try{const u=new URL(String(s));return u.protocol==="https:"?u.href:""}catch{return ""}};
 const date=s=>s?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z")):"Datum offen";
 const CATEGORIES={club:"Verein",opponent_club:"Andere Vereine",association:"Verband",dbv:"DBV",media:"Medien",regional_media:"Regionalpresse",sports_organization:"Sport & Stadt",result_portal:"Resultate"};
 let articles=[],sources=[],mentions=new Set(),profileId="",club="",loaded=false,busy=false;
 async function get(path){
  const resp=await fetch(URL+"/rest/v1/"+path,{headers:{"apikey":KEY,"accept":"application/json"},cache:"no-store"});
  if(!resp.ok)throw new Error("Supabase "+resp.status);
  return resp.json();
 }
 function validId(id){return /^\d{2}-\d{6}$/.test(id||"")}
 function isClubArticle(a){
  if(!club)return false;
  return a.club_id==="spvgg-moessingen"&&/^spvgg mössingen$/i.test(club);
 }
 function renderSources(){
  const box=$("report-source-list");if(!box)return;
  if(!sources.length){box.textContent="Keine Quellen verfügbar.";return}
  const ordered=sources.slice().sort((a,b)=>a.priority-b.priority);
  box.innerHTML=ordered.map(s=>{
   const href=safeUrl(s.article_index_url)||safeUrl(s.homepage_url);
   return '<div class="report-source-entry"><a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(s.name)+' ↗</a>'+
    '<span class="report-source-status">'+(s.verification_status==="verified"?"Quelle geprüft":"Recherchequelle – noch keine belegte Nennung")+'</span>'+
    '<small>'+esc(s.access_note||CATEGORIES[s.category]||"")+'</small></div>';
  }).join("");
 }
 function render(){
  const box=$("report-list"),count=$("report-count");
  if(!box)return;
  if(!loaded)return;
  const mode=$("report-scope")?.value||"mentions";
  const category=$("report-category")?.value||"all";
  const term=($("report-search")?.value||"").trim().toLocaleLowerCase("de");
  const matches=articles.filter(a=>{
   const named=mentions.has(a.id);
   if(mode==="mentions"&&!named)return false;
   if(mode==="club"&&!isClubArticle(a))return false;
   if(category!=="all"&&a.report_sources?.category!==category)return false;
   const haystack=[a.title,a.summary,a.report_sources?.name].join(" ").toLocaleLowerCase("de");
   return !term||haystack.includes(term);
  });
  if(count)count.textContent=matches.length+" "+(matches.length===1?"Bericht":"Berichte");
  if(!matches.length){
   let message="Für diese Filter gibt es noch keine belegten Artikel.";
   if(mode==="mentions"&&!validId(profileId))message="Für dieses Profil ist keine gültige DBV-ID hinterlegt.";
   else if(mode==="club"&&!club)message="Für dieses Spielerprofil ist noch kein Verein hinterlegt. Bitte in den Stammdaten ergänzen.";
   else if(mode==="club"&&!/^spvgg mössingen$/i.test(club))message="Für diesen Verein sind noch keine Artikel importiert.";
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
 async function load({force=false}={}){
  if(busy)return;
  if(loaded&&!force){render();return}
  busy=true;
  const button=$("report-refresh");if(button)button.disabled=true;
  const box=$("report-list");if(box)box.innerHTML='<p class="report-empty">Berichte werden geladen …</p>';
  try{
   const [articleRows,sourceRows]=await Promise.all([
    get("articles?select=id,url,title,published_on,summary,club_id,report_sources(name,category)&status=eq.verified&order=published_on.desc.nullslast&limit=500"),
    get("report_sources?select=id,name,category,homepage_url,article_index_url,verification_status,access_note,priority&order=priority.asc&limit=200")
   ]);
   articles=articleRows;sources=sourceRows;loaded=true;
   renderSources();
   await loadMentions();
  }catch(e){
   if(box)box.innerHTML='<p class="report-empty">Die Berichte sind zurzeit nicht erreichbar. Bitte später erneut aktualisieren.</p>';
   console.warn("Badminton report directory:",e.message);
  }finally{busy=false;if(button)button.disabled=false}
 }
 let mentionRequest=0;
 async function loadMentions(){
  const ticket=++mentionRequest,dbv=profileId;
  mentions=new Set();
  if(!validId(dbv)){render();return}
  try{
   const players=await get("players?select=id&dbv_id=eq."+encodeURIComponent(dbv)+"&limit=1");
   if(ticket!==mentionRequest||dbv!==profileId)return;
   if(players.length){
    const rows=await get("article_player_mentions?select=article_id&player_id=eq."+players[0].id+"&limit=500");
    if(ticket!==mentionRequest||dbv!==profileId)return;
    mentions=new Set(rows.map(x=>x.article_id));
   }
  }catch(e){console.warn("Report mentions:",e.message)}
  if(ticket===mentionRequest)render();
 }
 function changeProfile(next,clubName){
  const updated=next!==profileId;
  profileId=next;
  club=clubName||"";
  if(updated&&loaded)loadMentions();
  else render();
 }
 document.addEventListener("DOMContentLoaded",()=>{
  if(!$("report-list"))return;
  profileId=String(window.badmintonActivePlayerId||"");
  club=String(window.badmintonActiveClub||"");
  $("report-refresh")?.addEventListener("click",()=>load({force:true}));
  for(const id of ["report-scope","report-category","report-search"]){
   $(id)?.addEventListener(id==="report-search"?"input":"change",render);
  }
  window.addEventListener("badminton:profile-change",e=>{
   changeProfile(String(e.detail?.playerId||""),String(e.detail?.club||""));
  });
  window.addEventListener("hashchange",()=>{if(location.hash==="#berichte")load()});
  if(location.hash==="#berichte")load();
 });
})();
