// These profile flows require a synthetic, already-invited member session.
// Unauthorized entry is tested separately by the fail-closed access specs.
import {test,expect} from "./invited-member.fixture.mjs";

const store={
 players:[{id:"local-older",name:"Mira",club:"Testverein"},
  {id:"99-000001",name:"Mira Muster",club:"Testverein",birthYear:2016}],
 activeProfileId:"local-older",chosen:"local-older",friends:[],
 officialLinks:[{id:"11111111-2222-4333-8444-555555555555",
  url:"https://dbv.turnier.de/tournament/11111111-2222-4333-8444-555555555555",
  name:"Fiktives Turnier",playerId:"local-older",startDate:"2026-12-01",endDate:""}]
};
test("unverified local Mira remains independent of homonymous DBV Mira and keeps own bookmarks",async ({page})=>{
 await page.addInitScript(saved=>localStorage.setItem("shuttleboard-v1",JSON.stringify(saved)),store);
 await page.goto("/#start");
 await expect(page.locator(".focused-profile")).toContainText("Mira");
 await expect(page.locator(".focused-profile")).not.toContainText("Mira Muster");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players.map(p=>p.id)).toEqual(["local-older","99-000001"]);
 expect(saved.activeProfileId).toBe("local-older");
 expect(saved.officialLinks[0].playerId).toBe("local-older");
 await expect(page.locator("#dashboard-next")).toContainText("Fiktives Turnier");
});

test("confirmed directory search reselects existing DBV account without making a twin",async ({page})=>{
 await page.addInitScript(saved=>localStorage.setItem("shuttleboard-v1",JSON.stringify(saved)),{
  ...store,players:store.players.slice(1),activeProfileId:"99-000001",chosen:"99-000001"
 });
 await page.route("**/rest/v1/players?**",route=>route.fulfill({
  status:200,contentType:"application/json",
  headers:{"Access-Control-Allow-Origin":"*"},
  body:JSON.stringify([{dbv_id:"99-000001",name:"Mira Muster",club:"Testverein",birth_year:2016}])
 }));
 await page.goto("/welcome.html");
 await page.locator("#welcome-player-search").fill("Mira");
 const found=page.locator(".welcome-search-hit").filter({hasText:"Mira Muster"});
 await expect(found).toHaveCount(1);
 await expect(found).toBeEnabled();
 await found.click();
 await expect(page.locator("#welcome-selection-detail")).toContainText("DBV 99-000001");
 await page.locator("#welcome-selection-save").click();
 await expect(page).toHaveURL(/\/index\.html#start$/);
 await expect(page.locator(".focused-profile")).toContainText("Mira Muster");
 // Reselecting a previously stored profile is not fresh consent: no auto-copy modal or pending key.
 await expect(page.locator("#player-copy-dialog")).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem("schmetterlinge.pendingPlayerDataCopy.v1"))).toBeNull();
 const current=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(current.players).toHaveLength(1);
 expect(current.players[0].id).toBe("99-000001");
 expect(current.activeProfileId).toBe("99-000001");
});
