import {test,expect} from "@playwright/test";

const DBV="05-070879";
const USER="2980046b-abd4-4056-b275-090a7364c4ac";
const EVENT="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const BOOKMARK={id:EVENT,playerId:DBV,name:"Beispielturnier",startDate:"2026-12-03",endDate:"2026-12-04"};
test.beforeEach(async ({page})=>{
 await page.addInitScript(({dbv,user})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:dbv,name:"Testspieler"}],friends:[],officialLinks:[],
   activeProfileId:dbv,chosen:dbv,historyProfilesInitialized:true
  }));
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   user_id:user,access_token:"test-token-only",
   refresh_token:"test-refresh-only",expires_at:Date.now()+3_600_000
  }));
 },{dbv:DBV,user:USER});
});

test("unverified session cannot send a public tournament hint",async ({page})=>{
 let inserts=0,grantChecks=0;
 await page.route("**/rest/v1/player_publication_grants?*",route=>{
  grantChecks++;
  return route.fulfill({status:200,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},body:"[]"});
 });
 await page.route("**/rest/v1/user_tournament_links?*",route=>{
  inserts++;
  return route.fulfill({status:201,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},body:"{}"});
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Boolean(window.badmintonCommunity));
 await page.evaluate(bookmark=>window.dispatchEvent(
  new CustomEvent("badminton:share-tournament",{detail:{bookmark,publicShare:true}})
 ),BOOKMARK);
 await expect(page.locator("#community-sync-status")).toContainText("keine geprüfte Veröffentlichungsberechtigung");
 await expect(page.locator("#community-sync-status")).toContainText(DBV);
 expect(grantChecks).toBe(1);
 expect(inserts).toBe(0);
 const flags=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.communityShares.v1")||"{}"));
 expect(flags[DBV+"|"+EVENT]).toBeFalsy();
});

test("approved session can share only after a matching player grant",async ({page})=>{
 let inserts=0,checked=false;
 await page.route("**/rest/v1/player_publication_grants?*",route=>{
  const u=new URL(route.request().url());
  checked=u.searchParams.get("user_id")==="eq."+USER&&
   u.searchParams.get("player_dbv_id")==="eq."+DBV;
  return route.fulfill({status:200,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},
    body:JSON.stringify([{player_dbv_id:DBV}])});
 });
 await page.route("**/rest/v1/user_tournament_links?*",route=>{
  inserts++;
  return route.fulfill({status:201,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},body:"{}"});
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Boolean(window.badmintonCommunity));
 await page.evaluate(bookmark=>window.dispatchEvent(
  new CustomEvent("badminton:share-tournament",{detail:{bookmark,publicShare:true}})
 ),BOOKMARK);
 await expect(page.locator("#community-sync-status")).toContainText("Deine Follower können es sehen");
 expect(checked).toBe(true);
 expect(inserts).toBe(1);
 const flags=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.communityShares.v1")||"{}"));
 expect(flags[DBV+"|"+EVENT]).toBe(true);
});
