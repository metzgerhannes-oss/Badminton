import {test,expect} from "./invited-member.fixture.mjs";

// P0 mobile acceptance: entirely synthetic fixtures, never a live account,
// genuine player identity or productive Supabase request.
const FIRST="99-000001",SECOND="99-000002";
const FIRST_MATCHES=5,SECOND_MATCHES=4;
const headers={"Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
function match(player,n,{wins=1,mixed=0}={}){
 const success=n<wins,kind=n>=FIRST_MATCHES-mixed?"Mixed":"Einzel";
 return {dbv_id:player,source_key:"tournament:123:p0-mobile:"+player+":"+n,
  category:"tournament",competition:"Synthetisches Jugendturnier",
  competition_id:"123",event:kind==="Mixed"?"MxD U13":"JE U13",
  discipline:kind,round_label:"Belegte Runde "+(n+1),
  match_date:"2026-07-11",match_year:2026,
  player_side:1,winning_side:success?1:2,
  opponent_names:kind==="Mixed"?["Gegner Eins","Gegner Zwei"]:["Gegner Eins"],
  partner_names:kind==="Mixed"?["Team Partner"]:[],
  games:success?[[15,9],[15,11]]:[[4,15],[9,15]],
  source_name:"Badhub",source_kind:"third-party-match-card",
  source_url:"https://badhub.de/bwbv/turnier.php?id=123"};
}
const facts={
 [FIRST]:Array.from({length:FIRST_MATCHES},(_,i)=>match(FIRST,i,{wins:1,mixed:2})),
 [SECOND]:Array.from({length:SECOND_MATCHES},(_,i)=>match(SECOND,i,{wins:1}))
};
function medals(id){
 return id===FIRST?[0,1].map(i=>({
  id:"p0-synthetic-trophy-"+i,playerId:id,verified:true,
  place:3,event:"Synthetisches Jugendturnier",discipline:i?"Mixed":"Einzel",
  date:"2026-07-11",source:{url:"https://badhub.de/bwbv/turnier.php?id=123"}
 })):[];
}
async function setup(page,id){
 await page.addInitScript(playerId=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:playerId,name:"Demo-Profil",birthYear:2015,club:"Testverein"}],
   friends:[],officialLinks:[],activeProfileId:playerId,chosen:playerId,
   historyProfilesInitialized:true
  }));
 },id);
 await page.route("**/*.supabase.co/rest/v1/**",route=>{
  const req=route.request(),u=new URL(req.url()),method=req.method();
  if(u.pathname.endsWith("/rpc/app_access_status"))return route.fallback();
  if(method==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  let response=[];
  const queried=(u.searchParams.get("dbv_id")||"").replace(/^eq\./,"");
  if(u.pathname.endsWith("/player_external_match_facts")){
   response=(facts[queried]||[]).map(m=>({...m}));
  }else if(u.pathname.endsWith("/rpc/app_access_player_coverage")){
   const player=JSON.parse(req.postData()||"{}").p_player_dbv_id;
   response={dbv_id:player,match_cards:facts[player]?.length||0,
    import_status:"partial",last_import:"2026-10-17T11:30:00Z",
    birth_year:2015,placements:player===FIRST?2:0,top_four:player===FIRST?2:0};
  }else if(u.pathname.endsWith("/rpc/app_access_trophies_read")){
   const player=JSON.parse(req.postData()||"{}").p_player_dbv_id;
   response={player_dbv_id:player,scope:"app_archive",results:medals(player)};
  }else if(u.pathname.endsWith("/rpc/app_access_rankings_read")){
   const player=JSON.parse(req.postData()||"{}").p_player_dbv_id;
   response={player_dbv_id:player,status:"no_verified_ranking"};
  }
  return route.fulfill({status:200,contentType:"application/json",headers,
   body:JSON.stringify(response)});
 });
}
test("P0 iPhone: verified five-match 1:4 totals, two bronze podiums and match filters",async({page})=>{
 await setup(page,FIRST);
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("5");
 await expect(page.locator("#match-stats-values .match-stat.wins strong")).toHaveText("1");
 await expect(page.locator("#match-stats-values .match-stat.losses strong")).toHaveText("4");
 await expect(page.locator("#match-stats-source")).toContainText("Bisher belegte Spiele");
 await expect(page.locator("#match-stats-note")).toContainText("Weitere Ergebnisse können fehlen");
 await expect(page.locator("#match-stats-reference")).toBeHidden();
 await expect(page.locator(".home-trophy-grid .home-trophy-slot.bronze strong")).toHaveText("2");
 await expect(page.locator(".home-trophy-latest .home-trophy-result")).toHaveCount(2);
 await page.locator("#home-match-filter-panel summary").click();
 await page.locator("#match-stats-discipline").selectOption("Mixed");
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("2");
 await expect(page.locator("#match-stats-values .match-stat.wins strong")).toHaveText("0");
 await expect(page.locator("#match-stats-values .match-stat.losses strong")).toHaveText("2");
 await page.locator("#match-stats-discipline").selectOption("all");
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("5");
 // No horizontal clipping on either iPhone viewport.
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 await page.locator("#match-stats-heading + a").click();
 await expect(page).toHaveURL(/#historie$/);
 await expect(page.locator("#external-match-count")).toContainText("5 einzeln belegte Spiele");
 await expect(page.locator("#external-match-count")).toContainText("1 Siege");
 await expect(page.locator("#external-match-list .external-match-item")).toHaveCount(5);
 await expect(page.locator("#external-match-list .external-match-item a")).toHaveCount(5);
 await expect(page.locator("#external-match-list .external-match-item a").first()).toHaveAttribute(
  "href","https://badhub.de/bwbv/turnier.php?id=123");
 await page.locator("#external-match-discipline").selectOption("Mixed");
 await expect(page.locator("#external-match-count")).toContainText("2 einzeln belegte Spiele");
 await expect(page.locator("#external-match-list .external-match-item")).toHaveCount(2);
});
test("P0 iPhone: independent four-match 1:3 profile, no incorrect trophies or mixed data",async({page})=>{
 await setup(page,SECOND);
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("4");
 await expect(page.locator("#match-stats-values .match-stat.wins strong")).toHaveText("1");
 await expect(page.locator("#match-stats-values .match-stat.losses strong")).toHaveText("3");
 await expect(page.locator(".home-trophy-grid .home-trophy-slot.bronze strong")).toHaveText("0");
 await page.goto("/#historie");
 await expect(page.locator("#external-match-count")).toContainText("4 einzeln belegte Spiele");
 await expect(page.locator("#external-match-list .external-match-item")).toHaveCount(4);
 await page.locator("#external-match-discipline").selectOption("Mixed");
 await expect(page.locator("#external-match-count")).toContainText("keine zählbaren Einzelspiele");
});
