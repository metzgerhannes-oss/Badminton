import {test,expect} from "@playwright/test";

const store={
 players:[{id:"local-older",name:"Philipp",club:"SpVgg Mössingen"},
  {id:"05-070879",name:"Philipp Metzger",club:"SpVgg Mössingen",birthYear:2016}],
 activeProfileId:"local-older",chosen:"local-older",friends:[],
 officialLinks:[{id:"E24DC6EE-152A-454D-B00C-E625B751D7D5",
  url:"https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5",
  name:"Philipps nächstes Turnier",playerId:"local-older",startDate:"2026-12-01",endDate:""}]
};
test("existing local Philipp is merged into DBV Philipp, upcoming bookmarks remain visible",async ({page})=>{
 await page.addInitScript(saved=>localStorage.setItem("shuttleboard-v1",JSON.stringify(saved)),store);
 await page.goto("/#start");
 await expect(page.locator(".focused-profile")).toContainText("DBV 05-070879");
 await expect(page.locator(".focused-profile")).toContainText("Philipp Metzger");
 await expect(page.locator(".focus-switcher")).toHaveCount(0);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players.map(p=>p.id)).toEqual(["05-070879"]);
 expect(saved.activeProfileId).toBe("05-070879");
 expect(saved.officialLinks[0].playerId).toBe("05-070879");
 await expect(page.locator("#dashboard-next")).toContainText("Philipps nächstes Turnier");
});

test("confirmed directory search reselects existing DBV account without making a twin",async ({page})=>{
 await page.addInitScript(saved=>localStorage.setItem("shuttleboard-v1",JSON.stringify(saved)),{
  ...store,players:store.players.slice(1),activeProfileId:"05-070879",chosen:"05-070879"
 });
 await page.route("**/rest/v1/players?**",route=>route.fulfill({
  status:200,contentType:"application/json",
  headers:{"Access-Control-Allow-Origin":"*"},
  body:JSON.stringify([{dbv_id:"05-070879",name:"Philipp Metzger",club:"SpVgg Mössingen",birth_year:2016}])
 }));
 await page.goto("/welcome.html");
 await page.locator("#welcome-player-search").fill("Philipp");
 const found=page.locator(".welcome-search-hit").filter({hasText:"Philipp Metzger"});
 await expect(found).toHaveCount(1);
 await expect(found).toBeEnabled();
 await found.click();
 await expect(page.locator("#welcome-selection-detail")).toContainText("DBV 05-070879");
 await page.locator("#welcome-selection-save").click();
 await expect(page.locator("#onboard-data")).toBeVisible();
 await page.locator("#welcome-data-skip").click();
 await expect(page.locator("#onboard-install")).toBeVisible();
 await expect(page.locator(".welcome-success")).toContainText("05-070879");
 const current=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(current.players).toHaveLength(1);
 expect(current.players[0].id).toBe("05-070879");
 expect(current.activeProfileId).toBe("05-070879");
});
