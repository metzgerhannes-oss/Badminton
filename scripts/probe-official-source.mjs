/** Read-only P0 source probe. Logs ONLY URL route shape/status, public tournament IDs,
 * and structural counters: never player records, names, results, HTML, or credentials. */
const clubReports=[
 "https://www.spvgg.org/abteilungen/badminton/aktuelles/4-e-rangliste-suedwuerttemberg-u11-u19-am-26-september-2026",
 "https://www.spvgg.org/abteilungen/badminton/aktuelles/55-bwbv-meisterschaft-u11-u19-am-03-04-oktober-2026"
];
const official=new Set(["https://dbv.turnier.de/tournament/05402696-731C-44C2-B74D-9A013115948C"]);
async function fetchHtml(url){
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),9000);
 try{
  const res=await fetch(url,{signal:ctl.signal,redirect:"follow",headers:{Accept:"text/html"}});
  const type=res.headers.get("content-type")||"";
  if(!res.ok||!type.includes("text/html"))return {http:res.status};
  if(Number(res.headers.get("content-length")||0)>1500000)return {http:res.status,oversize:true};
  const html=await res.text();
  return html.length<=1500000?{http:res.status,html}:{http:res.status,oversize:true};
 }catch(error){return {error:error.name==="AbortError"?"timeout":"unavailable"}}
 finally{clearTimeout(timeout)}
}
for(let i=0;i<clubReports.length;i++){
 const result=await fetchHtml(clubReports[i]);
 if(!result.html){console.log(JSON.stringify({club:i+1,http:result.http||null,error:result.error}));continue}
 const links=[...result.html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1].replace(/&amp;/g,"&"));
 const candidates=links.filter(l=>/turnier\.de\/tournament\//i.test(l));
 for(const l of candidates){
  try{
   const u=new URL(l);if(["dbv.turnier.de","www.turnier.de","turnier.de"].includes(u.hostname)&&
    /^\/tournament\/[a-f0-9-]{36}(?:\/.*)?$/i.test(u.pathname))
    official.add("https://dbv.turnier.de/tournament/"+u.pathname.split("/")[2]);
  }catch{}
 }
 console.log(JSON.stringify({club:i+1,http:result.http,officialLinkCount:candidates.length}));
}
for(const [i,url] of [...official].entries()){
 for(const suffix of ["","/matches","/draws"]){
  const result=await fetchHtml(url+suffix);
  if(!result.html){console.log(JSON.stringify({event:i+1,suffix:suffix||"/",http:result.http||null,error:result.error}));continue}
  const html=result.html,count=re=>(html.match(re)||[]).length;
  console.log(JSON.stringify({event:i+1,suffix:suffix||"/",http:result.http,bytes:html.length,
   nextData:count(/id="__NEXT_DATA__"/g),matchLinks:count(/href="[^"]*\/match\//g),
   tableTags:count(/<table\b/gi),scriptTags:count(/<script\b/gi)}));
 }
}

const peer=await fetchHtml("https://badhub.de/spieler/05-067838?saison=2026&src=turnier");
if(peer.html){
 const cards=peer.html.split(/<div class="card sp-tournament-card(?: [^"]*)?">/).slice(1);
 const ev=cards.filter(c=>/Friedrichshafen 2026/i.test(c.slice(0,1400))&&/BWBV-Meisterschaft/i.test(c.slice(0,1400)));
 const links=ev.flatMap(c=>[...c.matchAll(/href="\/(?:bwbv|dbv)\/turnier\.php\?id=(\d+)"/g)].map(m=>m[1]));
 console.log(JSON.stringify({badhubPeer:peer.http,tournamentCards:cards.length,matchedEventCards:ev.length,eventIdCount:links.length}));
 for(const id of [...new Set(links)].slice(0,2)){
  const event=await fetchHtml("https://badhub.de/bwbv/turnier.php?id="+id);
  const html=event.html||"";
  console.log(JSON.stringify({badhubTournament:1,http:event.http||null,bytes:html.length,
   matchCards:(html.match(/sp-match-item/g)||[]).length,
   matchRows:(html.match(/sp-match-body/g)||[]).length,
   scoreSets:(html.match(/sp-set-score/g)||[]).length,
   targetMention:html.includes("Charlotte Metzger"),
   sourceId:id}));
 }
}else console.log(JSON.stringify({badhubPeer:peer.http||null,error:peer.error}));
