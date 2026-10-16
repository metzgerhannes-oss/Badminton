import {test,expect} from "./supabase-isolated.fixture.mjs";
const HEADERS={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
 "Content-Type":"application/json"
};
const id="05-070879";
const invite="11111111-2222-4333-8444-555555555555";
const rows=[
 {id:"a",title:"Spielerbericht: Meisterschaft",url:"https://spvgg.org/bericht-a",
  published_on:"2026-10-01",club_id:"spvgg-moessingen",named:true,
  summary:"Belegtes Turnier",report_sources:{name:"SpVgg Mössingen",category:"club"}},
 {id:"b",title:"Vereinsbericht ohne Namensnennung",url:"https://spvgg.org/bericht-b",
  published_on:"2026-09-28",club_id:"spvgg-moessingen",named:false,
  summary:"Vereinsmeldungen",report_sources:{name:"SpVgg Mössingen",category:"club"}}
];
function reply(route,body){
 if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:HEADERS,body:""});
 return route.fulfill({status:200,headers:HEADERS,body:JSON.stringify(body)});
}
test.beforeEach(async({page})=>{
 await page.addInitScript(player=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:player,name:"Testspieler",club:"SpVgg Mössingen"}],
   friends:[],officialLinks:[],activeProfileId:player,chosen:player,
   historyProfilesInitialized:true
  }));
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"report-test-access",refresh_token:"report-test-refresh",
   expires_at:Date.now()+3600000,user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  }));
 },id);
});
test("Member report page renders verified article mentions and club reports",async({page})=>{
 const reads=[];
 await page.route("**/rpc/app_access_status",route=>reply(route,{allowed:true,owner:false}));
 await page.route("**/rpc/app_access_reports_read",route=>{
  reads.push(JSON.parse(route.request().postData()||"{}"));
  return reply(route,{scope:"member",articles:rows});
 });
 await page.goto("/#berichte",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#report-list")).toContainText("Spielerbericht: Meisterschaft");
 await expect(page.locator("#report-list")).not.toContainText("Vereinsbericht ohne Namensnennung");
 await expect(page.locator("#report-count")).toHaveText("1 Bericht");
 expect(reads[0].p_player_dbv_id).toBe(id);
 expect(reads[0].p_invitation_id).toBe(null);
 await page.locator("#report-scope").selectOption("club");
 await expect(page.locator("#report-count")).toHaveText("2 Berichte");
 await expect(page.locator("#report-list a")).toHaveCount(2);
});
test("Narrow player invitation receives only its scoped reports, not all club articles",async({page})=>{
 await page.addInitScript(({player,invite})=>{
  localStorage.setItem("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify([invite]));
  localStorage.setItem("schmetterlinge.acceptedPlayerInviteBindings.v1",JSON.stringify({[invite]:player}));
 },{player:id,invite});
 await page.route("**/rpc/app_access_status",route=>reply(route,{allowed:false,owner:false}));
 await page.route("**/rpc/private_player_access_read",route=>
  reply(route,{player:{dbv_id:id,name:"Testspieler",club:"SpVgg Mössingen"},matches:[]}));
 await page.route("**/rpc/app_access_reports_read",route=>{
  const params=JSON.parse(route.request().postData()||"{}");
  expect(params.p_invitation_id).toBe(invite);
  expect(params.p_player_dbv_id).toBe(id);
  return reply(route,{scope:"player",articles:[rows[0]]});
 });
 await page.goto("/#berichte",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("#report-list")).toContainText("Spielerbericht: Meisterschaft");
 await page.locator("#report-scope").selectOption("club");
 await expect(page.locator("#report-count")).toHaveText("1 Bericht");
 await expect(page.locator("#report-list")).not.toContainText("Vereinsbericht ohne Namensnennung");
});
