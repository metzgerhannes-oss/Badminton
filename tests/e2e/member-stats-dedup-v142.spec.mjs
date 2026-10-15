import {test,expect} from "./invited-member.fixture.mjs";

// Authenticated family users get individually sourced statistics and no
// second provider career totals panel. The provider link stays available.
test("v142: mobile home shows a single match-statistics panel for invited members",async({page})=>{
 const id="05-070879";
 await page.addInitScript(playerId=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:playerId,name:"Testprofil",birthYear:2016,club:"Testverein"}],
   friends:[],officialLinks:[],activeProfileId:playerId,chosen:playerId,
   historyProfilesInitialized:true
  }));
 },id);
 const headers={"Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
 const matches=Array.from({length:62},(_,i)=>({
  dbv_id:id,source_key:"test:"+i,category:"tournament",competition:"Prüfturnier",
  discipline:"Einzel",event:"JE U11",match_date:"2026-10-03",match_year:2026,
  player_side:1,winning_side:i<26?1:2,opponent_names:["Testgegner"],
  partner_names:[],games:i<26?[[21,11],[21,11]]:[[11,21],[11,21]],source_name:"Badhub",
  source_kind:"third-party-match-card",source_url:"https://badhub.de/bwbv/turnier.php?id=123"
 }));
 await page.route("**/*.supabase.co/rest/v1/**",route=>{
  const url=new URL(route.request().url()),method=route.request().method();
  if(url.pathname.endsWith("/rpc/app_access_status"))return route.fallback();
  if(method==="OPTIONS")return route.fulfill({status:204,headers});
  let body=[];
  if(url.pathname.endsWith("/player_external_match_facts"))body=matches;
  if(url.pathname.endsWith("/players"))body=[{birth_year:2016}];
  return route.fulfill({status:200,contentType:"application/json",headers,
   body:JSON.stringify(body)});
 });
 await page.setViewportSize({width:375,height:667});
 await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
 await expect.poll(()=>page.evaluate(()=>window.badmintonAppAccess?.allowed)).toBe(true);
 await page.evaluate(playerId=>window.dispatchEvent(
  new CustomEvent("badminton:profile-change",{detail:{playerId}})),id);
 await expect(page.locator("#match-stats-values .match-stat")).toHaveCount(4);
 await expect(page.locator("#match-stats-values")).toContainText("62");
 await expect(page.locator("#match-stats-reference")).toBeHidden();
 await expect(page.locator("#match-stats-reference")).toBeEmpty();
 await expect(page.locator("#match-stats-source-link")).toContainText("Badhub");
 await expect(page.locator("#app-version-badge")).toContainText("v143");
});
