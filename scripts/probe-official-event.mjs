/** Bounded, read-only probe of publicly reachable official matchday web pages.
 * This diagnostic script is not a crawler or product importer. */
const urls=[
 "https://dbv.turnier.de/",
 "https://dbv.turnier.de/tournament/F7B661DD-BC15-4B5B-B38D-49D48FD9A67A",
 "https://dbv.turnier.de/tournament/F7B661DD-BC15-4B5B-B38D-49D48FD9A67A/player/114",
 "https://badhub.de/api/spieler_live.php?lic=05-061350",
 "https://badhub.de/bvbb/turniere.php?jahr=2026",
 "https://badhub.de/bvbb/turnier.php?id=4962",
 "https://badhub.de/assets/js/turniere.js?v=1787664608",
 "https://badhub.de/assets/js/turnier.js?v=1787664608",
 "https://dbv.turnier.de/cookiewall/",
];
const allowed=new Set(["dbv.turnier.de","badhub.de"]);
const clean=s=>String(s||"").replace(/[\\r\\n\\t]+/g," ").replace(/\\s+/g," ").trim().slice(0,150);
for(const url of urls){
 const u=new URL(url);if(u.protocol!=="https:"||!allowed.has(u.hostname))continue;
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),11000);
  let res;
  try{res=await fetch(url,{signal:controller.signal,headers:{Accept:"text/html,application/json;q=0.9", "User-Agent":"SchmetterlingeTournamentResearch/1.0 (+research, bounded)"},redirect:"manual"})}
  finally{clearTimeout(timer)}
  const type=res.headers.get("content-type")||"";
  let body=res.status===200?await res.text():"";
  if(body.length>2200000)body=body.slice(0,2200000);
  console.log("\nPROBE",u.pathname,"status",res.status,"type",type,"bytes",body.length,"location",res.headers.get("location")||"");
  if(u.pathname.endsWith(".js")){console.log("SCRIPT",body.slice(0,12500));}
  if(type.includes("json")){
   let doc;try{doc=JSON.parse(body)}catch{}
   if(doc&&typeof doc==="object"){
    console.log("JSON top keys",Object.keys(doc).slice(0,28).join(", "));
    const samples={};
    for(const k of ["tournament","running","next","upcoming","past","hero","entries"]){
     if(doc[k]!==undefined){
      const v=doc[k];samples[k]=Array.isArray(v)?{length:v.length,sampleKeys:Object.keys(v[0]||{}).slice(0,18)}:
       v&&typeof v==="object"?{keys:Object.keys(v).slice(0,25),sample:JSON.stringify(v).slice(0,450)}:v;
     }
    }
    console.log("JSON kinds",JSON.stringify(samples).slice(0,1500));
   }
  }else{
   const title=body.match(/<title[^>]*>([^<]*)/i)?.[1]||"";
   console.log("TITLE",clean(title));
   const scripts=[...body.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m=>m[1]).filter(Boolean).slice(0,22);
   console.log("SCRIPTS",JSON.stringify(scripts).slice(0,2200));
   const links=[...body.matchAll(/href=["']([^"']+)/gi)].map(m=>m[1]).filter(x=>/match|draw|tournament|court|schedule|livescore|live/i.test(x)).slice(0,32);
   console.log("MATCH_LINKS",JSON.stringify(links).slice(0,3500));
   if(u.pathname.includes("turnier.php")||u.pathname.includes("turniere.php")){
    const look=["turnier.php?id=4962","Spielplan","matches","match","Begegnungen","Ergebnisse","Spieler","Disziplin"];
    for(const word of look){
     const i=body.toLowerCase().indexOf(word.toLowerCase());
     if(i>=0)console.log("NEAR",word,body.slice(Math.max(0,i-190),i+900).replace(/\\s+/g," ").slice(0,1100));
    }
    console.log("HTML COUNTS",JSON.stringify({table:body.split("<table").length-1,tr:body.split("<tr").length-1,score:body.split("score").length-1,match:body.toLowerCase().split("match").length-1}));
    if(u.pathname.includes("turnier.php"))console.log("EVENT_HTML_SECTION",body.slice(10500,17500));
   }
   if(u.pathname.includes("turniere.php")){
    const other=[...body.matchAll(/href=["']([^"']+)/gi)].map(m=>m[1]).filter(x=>/turnier|event|match|spiel/i.test(x)).slice(0,45);
    console.log("TOURNAMENT_TARGETS",JSON.stringify(other).slice(0,5500));
   }
   if(u.pathname.includes("cookiewall")){
    console.log("FORM",clean(body.slice(Math.max(0,body.indexOf("<form")),body.indexOf("<form")+2700)));
   }
   const markers=["__NEXT_DATA__","__NUXT__","__INITIAL_STATE__","application/ld+json","/api/","Matches","Spiele","matches","Auslosung","Live","tournamentsoftware"];
   console.log("MARKERS",markers.filter(m=>body.includes(m)).join(","));
   const needle=body.search(/__NEXT_DATA__|match-list|matches|matchlist|startlist|match\//i);
   if(needle>=0)console.log("MATCH_NEAR",clean(body.slice(Math.max(0,needle-100),needle+500)));
  }
 }catch(e){console.log("PROBE ERROR",u.pathname,String(e).slice(0,180))}
}
