import {test,expect} from "./invited-member.fixture.mjs";

const FRIEND={dbv_id:"05-123456",name:"Vinzent Muster",club:"SpVgg. Mössingen",age_class:"U17",association:"BAW-Baden-Württemberg"};
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[{id:"05-070879",name:"Startprofil",club:"SpVgg. Mössingen"}],
  friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
  historyProfilesInitialized:true
 }));});
 await page.route("**/rest/v1/rpc/search_dbv_player_identity",route=>
  route.fulfill({status:route.request().method()==="OPTIONS"?204:200,
   headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
    "Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"},
   body:route.request().method()==="OPTIONS"?"":JSON.stringify([FRIEND])}));
});
test("Home + opens search, follow remains open and inline unfollow is one action",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start");
 await expect(page.locator("#dashboard-add-friend")).toBeVisible();
 await page.locator("#dashboard-add-friend").click();
 await expect(page).toHaveURL(/#spieler$/);
 await expect(page.locator("#player-discover")).toBeVisible();
 await expect(page.locator("#library-search")).toBeFocused();
 await expect(page.locator("#spvgg-active-roster")).toHaveCount(0);
 await page.locator("#library-search").fill("Vinzent");
 await expect(page.locator("#library-count")).toContainText("1 passende Spieler");
 await page.locator("[data-library-toggle='05-123456']").click();
 await expect(page.locator("#player-discover")).toBeVisible();
 await expect(page.locator("[data-library-toggle='05-123456']")).toBeDisabled();
 await expect(page.locator("#friend-list .followed-player-row")).toHaveCount(1);
 await page.locator("#followed-player-search").fill("unbekannt");
 await expect(page.locator("#friend-list .followed-player-row")).toHaveCount(0);
 await page.locator("#followed-show-all").click();
 await expect(page.locator("#friend-list .followed-player-row")).toHaveCount(1);
 await expect(page.locator("#dashboard-friends-manage")).toHaveText("Alle anzeigen");
 await page.locator("[data-unfollow-inline='05-123456']").click();
 await expect(page.locator("#friend-list .followed-player-row")).toHaveCount(0);
 await expect(page.locator("#followed-player-count")).toHaveText("(0)");
 const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).friends.map(p=>p.id));
 expect(ids).toEqual([]);
});
test("Gefolgte Spieler: all entries, name/club/ID filtering, no iPhone horizontal overflow",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[{id:"05-070879",name:"Startprofil"}],
  friends:[{id:"05-123456",name:"Vinzent Muster",club:"SpVgg. Mössingen"},{id:"05-234567",name:"Andere Person",club:"Tübingen"}],
  officialLinks:[],activeProfileId:"05-070879",historyProfilesInitialized:true
 })));
 await page.setViewportSize({width:320,height:720});
 await page.goto("/#spieler");
 await expect(page.locator("#friend-list .followed-player-row")).toHaveCount(2);
 await page.locator("#followed-player-search").fill("Mössingen");
 await expect(page.locator("#friend-list .followed-player-row")).toHaveCount(1);
 await expect(page.locator("#friend-list")).toContainText("Vinzent");
 await page.locator("#followed-player-search").fill("05-234567");
 await expect(page.locator("#friend-list .followed-player-row")).toHaveCount(1);
 await expect(page.locator("#friend-list")).toContainText("Andere Person");
 const excess=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(excess).toBeLessThanOrEqual(2);
});
