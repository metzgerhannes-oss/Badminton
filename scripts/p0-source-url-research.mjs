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
