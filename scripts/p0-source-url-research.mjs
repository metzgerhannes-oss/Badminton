/** Read-only lookup of published tournament source URLs; no DB writes or match imports. */
const sources=[
 ["club-ehingen","https://spvgg.org/abteilungen/badminton/aktuelles/4-e-rangliste-suedwuerttemberg-u11-u19-am-26-september-2026"],
 ["club-friedrichshafen","https://spvgg.org/abteilungen/badminton/aktuelles/55-bwbv-meisterschaft-u11-u19-am-03-04-oktober-2026"],
 ["dbv-events-september","https://dbv.turnier.de/find/tournament?DateFilterType=0&Distance=15&EndDate=2026-09-28&StartDate=2026-09-24&page=1"],
 ["dbv-events-october","https://dbv.turnier.de/find/tournament?DateFilterType=0&Distance=15&EndDate=2026-10-05&StartDate=2026-10-01&page=1"],
 ["bwbv-tournament","https://badhub.de/bwbv/turnier.php?id=4986"]
];
for(const [label,url] of sources){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{"Accept":"text/html","User-Agent":"Mozilla/5.0"}});
  if(!res.ok){console.log(JSON.stringify({label,status:res.status,url:res.url}));continue}
  const html=await res.text(),title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.replace(/<[^>]+>/g,"").trim().slice(0,100);
  const links=[...html.matchAll(/<a\b[^>]*href=["']([^"'<>]{1,600})["'][^>]*>([\s\S]*?)<\/a>/gi)]
   .map(([,href,text])=>({href:href.replaceAll("&amp;","&"),text:text.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,110)}));
  const selected=links.filter(x=>/turnier\.de\/tournament\/|\/tournament\/|Alle Infos|Ehingen|Friedrichshafen|BWBV.*Meisterschaft|4\. E-RLT/i.test(x.href+" "+x.text));
  const absolute=selected.map(v=>{try{const u=new URL(v.href,res.url);return {text:v.text,url:u.toString()}}catch{return null}}).filter(x=>x&&["dbv.turnier.de","www.turnier.de","turnier.de","spvgg.org","www.spvgg.org","badhub.de"].includes(new URL(x.url).hostname)).slice(0,22);
  console.log(JSON.stringify({label,status:res.status,bytes:html.length,title,links:absolute}));
 }catch(e){console.log(JSON.stringify({label,error:e.name==="AbortError"?"timeout":"unavailable"}))}
 finally{clearTimeout(timeout)}
}

const tournaments=[
 ["ehingen","F7B661DD-BC15-4B5B-B38D-49D48FD9A67A"],
 ["friedrichshafen","05402696-731C-44C2-B74D-9A013115948C"]
];
for(const [event,id] of tournaments){
 for(const host of ["https://dbv.turnier.de","https://www.turnier.de","https://www.tournamentsoftware.com"]){
  const root=host+"/tournament/"+id;
  try{
   const result=await fetch(root,{redirect:"manual",signal:AbortSignal.timeout(9000)});
   console.log("TOURNAMENT_STATUS "+JSON.stringify({event,host,status:result.status,location:result.headers.get("location")?.slice(0,150)}));
  }catch(e){console.log("TOURNAMENT_STATUS "+JSON.stringify({event,host,error:e.name==="TimeoutError"?"timeout":"unavailable"}))}
 }
}
const htmlGet=async url=>{
 try{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});return {status:r.status,html:r.ok?await r.text():""}}catch(e){return {status:"unavailable",html:""}}
};
for(const [label,url] of [
 ["badhub-charlotte","https://badhub.de/spieler/05-071969?src=turnier&saison=all"],
 ["badhub-benjamin","https://badhub.de/spieler/05-069897?src=turnier&saison=all"],
 ["badhub-meisterschaft","https://badhub.de/bwbv/turnier.php?id=4986"],
 ["badhub-ehingen-peer","https://badhub.de/spieler/05-071497?src=turnier&saison=all"]
]){
 const {status,html}=await htmlGet(url);
 const txt=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<[^>]*>/g," ").replace(/\s+/g," ");
 const targets=[...txt.matchAll(/(?:Charlotte Metzger|Benjamin Belser|4\. E-RLT BAW U11-U19 SW Ehingen 2026)/gi)].slice(0,3)
  .map(m=>txt.slice(Math.max(0,m.index-160),m.index+270).trim());
 const hrefs=[...html.matchAll(/href=["']([^"'<>]{1,450})["']/gi)].map(m=>m[1]);
 const tourney=hrefs.filter(s=>/\/(?:bwbv|dbv)\/turnier\.php\?id=/.test(s));
 const profiles=hrefs.filter(s=>/\/spieler\/[0-9]{2}-[0-9]{6}/.test(s));
 console.log("BADHUB_RESEARCH "+JSON.stringify({label,status,htmlSize:html.length,matchItems:(html.match(/class="sp-match-item/g)||[]).length,
  uniquePlayerLinks:[...new Set(profiles)].length,tournamentLinks:[...new Set(tourney)].slice(0,12),targetContexts:targets}));
}
