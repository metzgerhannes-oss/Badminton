/** Read-only technical probe of public DBV tournament pages. No player names,
 * results, HTML, credentials, or personal identifiers are written to logs. */
const ROOT="https://dbv.turnier.de/tournament/05402696-731C-44C2-B74D-9A013115948C";
const paths=["","/matches","/draws"];
for(const path of paths){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
 try{
  const res=await fetch(ROOT+path,{signal:ctl.signal,redirect:"error",headers:{Accept:"text/html"}});
  const type=res.headers.get("content-type")||"";
  if(!res.ok||!type.includes("text/html")){console.log(JSON.stringify({path:path||"/",http:res.status,html:false}));continue}
  const size=Number(res.headers.get("content-length")||0);
  if(size>1500000){console.log(JSON.stringify({path:path||"/",http:res.status,oversize:true}));continue}
  const html=await res.text();
  if(html.length>1500000){console.log(JSON.stringify({path:path||"/",http:res.status,oversize:true}));continue}
  const count=re=>(html.match(re)||[]).length;
  const info={path:path||"/",http:res.status,bytes:html.length,
   nextData:count(/id="__NEXT_DATA__"/g),nuxtData:count(/__NUXT__/g),
   jsonScripts:count(/type="application\/ld\+json"/g),
   eventLinks:count(/href="[^"]*\/event\//g),
   matchLinks:count(/href="[^"]*\/match\//g),
   rowMarkers:count(/class="[^"]*(?:match-row|match-card|match-result|match-score)[^"]*"/gi),
   tableTags:count(/<table\b/gi),scriptTags:count(/<script\b/gi)};
  console.log(JSON.stringify(info));
 }catch(e){console.log(JSON.stringify({path:path||"/",error:e.name==="AbortError"?"timeout":"unavailable"}))}
 finally{clearTimeout(timer)}
}
