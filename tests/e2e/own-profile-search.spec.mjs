import {test,expect} from "./invited-member.fixture.mjs";

const identities=[
 {dbv_id:"99-000011",name:"Anna Beispiel",club:"Testverein",birth_year:2014,age_class:"U13"},
 {dbv_id:"99-000012",name:"Ben Beispiel",club:"Testverein",birth_year:2015,age_class:"U11"}
];
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[{id:"99-000001",name:"Startprofil"}],friends:[],officialLinks:[],
  activeProfileId:"99-000001",historyProfilesInitialized:true
 })));
 await page.route("**/rest/v1/rpc/search_dbv_player_identity",async route=>{
  const query=JSON.parse(route.request().postData()||"{}").p_query||"";
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(
   query.toLowerCase().includes("beispiel")?identities:[])});
 });
 await page.goto("/#einstellungen");
});

test("own + Spielerprofil searches and adds selected DBV identity, preserving existing profile",async({page})=>{
 await page.locator("#add-player").click();
 await expect(page.locator("#own-profile-lookup")).toBeVisible();
 await expect(page.locator("#own-player-manual")).not.toHaveAttribute("open","");
 await page.locator("#own-player-search").fill("Beispiel");
 await expect(page.locator(".own-player-result")).toHaveCount(2);
 await page.getByRole("button",{name:"Anna Beispiel: + Profil hinzufügen"}).click();
 await expect(page.locator("#player-dialog")).not.toBeVisible();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.players).toHaveLength(2);
 expect(stored.players[0]).toMatchObject({id:"99-000001",name:"Startprofil"});
 expect(stored.players[1]).toMatchObject({id:"99-000011",name:"Anna Beispiel",birthYear:2014,club:"Testverein"});
 expect(stored.activeProfileId).toBe("99-000001");
});

test("duplicate DBV identity is disabled and editing still opens manual fields",async({page})=>{
 await page.locator("#add-player").click();
 await page.locator("#own-player-search").fill("Beispiel");
 await page.getByRole("button",{name:"Anna Beispiel: + Profil hinzufügen"}).click();
 await page.locator("#add-player").click();
 await page.locator("#own-player-search").fill("Beispiel");
 await expect(page.getByRole("button",{name:"Anna Beispiel: Bereits gespeichert"})).toBeDisabled();
 await page.locator("#cancel-dialog").click();
 await page.locator('[data-edit-own="99-000011"]').click();
 await expect(page.locator("#own-profile-lookup")).toBeHidden();
 await expect(page.locator("#own-player-manual")).toHaveAttribute("open","");
});

test("manual alternative works when DBV lookup returns a synthetic outage",async({page})=>{
 await page.route("**/rest/v1/rpc/search_dbv_player_identity",route=>
  route.fulfill({status:503,contentType:"application/json",body:'{"message":"synthetic outage"}'}));
 await page.locator("#add-player").click();
 await page.locator("#own-player-search").fill("Beispiel");
 await expect(page.locator("#own-player-search-status")).toContainText("nicht erreichbar");
 await page.locator("#own-player-manual summary").click();
 await page.locator('#player-form input[name="name"]').fill("Manuelles Profil");
 await page.locator('#player-form button[type="submit"]').click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).players);
 expect(saved).toHaveLength(2);
 expect(saved[1].name).toBe("Manuelles Profil");
});

test("explicit choice transfers already followed player into own list without duplicate",async({page})=>{
 await page.evaluate(()=>{const record=JSON.parse(localStorage.getItem("shuttleboard-v1"));
  record.friends=[{id:"99-000011",name:"Anna Beispiel"}];
  localStorage.setItem("shuttleboard-v1",JSON.stringify(record));
 });
 await page.reload();
 await page.locator("#add-player").click();
 await page.locator("#own-player-search").fill("Beispiel");
 await page.getByRole("button",{name:"Anna Beispiel: Als eigenes Profil"}).click();
 const result=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(result.players.filter(x=>x.id==="99-000011")).toHaveLength(1);
 expect(result.friends.filter(x=>x.id==="99-000011")).toHaveLength(0);
});
