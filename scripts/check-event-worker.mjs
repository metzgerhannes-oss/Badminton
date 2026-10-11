/** E2E provider bridge check: one public event, two source routes, no mass scraping. */
const root="https://schmetterlinge-event-feed.metzger-hannes.workers.dev/v1/event";
for(const disc of ["","offenes Doppel U9"]){
 const endpoint=root+"?"+new URLSearchParams({url:"https://badhub.de/bvbb/turnier.php?id=4962",...(disc?{disc}:{})});
 try{
  const x=await fetch(endpoint,{signal:AbortSignal.timeout(11000),headers:{Accept:"application/json"}});
  const doc=await x.json();
  console.log("BRIDGE_CHECK",JSON.stringify({disc,status:x.status,keys:Object.keys(doc),provider:doc.provider,event:doc.event,
   disciplines:doc.disciplines?.slice(0,8),match_count:doc.count,sample:doc.matches?.slice(0,2),error:doc.error,reason:doc.reason,
   access_control:x.headers.get("access-control-allow-origin"),cache_control:x.headers.get("cache-control")}).slice(0,4200));
 }catch(e){console.log("BRIDGE_CHECK_ERROR",disc,String(e).slice(0,300))}
}
