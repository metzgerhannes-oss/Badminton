import {test,expect} from "./invited-member.fixture.mjs";
// Entire suite inherits the hard Supabase network firewall, uses synthetic identities.
const seed={players:[{id:"99-000001",name:"Erstes Kind",club:"Testverein"}],
 friends:[{id:"99-000002",name:"Gefolgtes Kind"}],officialLinks:[],
 activeProfileId:"99-000001",chosen:"99-000001",historyProfilesInitialized:true};
const headers={"Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const rows=[
 {dbv_id:"99-000003",name:"Alex Beispiel",club:"Testverein A",birth_year:2016,age_class:"U11"},
 {dbv_id:"99-000004",name:"Alex Beispiel",club:"Testverein B",birth_year:2014,age_class:"U13"},
 {dbv_id:"99-000001",name:"Erstes Kind",club:"Testverein"},
 {dbv_id:"99-000002",name:"Gefolgtes Kind",club:"Testverein"}
];
test.beforeEach(async({page})=>{
 await page.addInitScript(value=>localStorage.setItem("shuttleboard-v1",JSON.stringify(value)),seed);
 await page.route("**/rpc/search_dbv_player_identity",route=>{
  if(route.request().method()==="OPTIONS")
   return route.fulfill({status:204,headers,body:""});
  const query=String(JSON.parse(route.request().postData()||"{}").p_query||"").toLocaleLowerCase("de");
  return route.fulfill({status:200,headers,body:JSON.stringify(rows.filter(row=>
   row.name.toLocaleLowerCase("de").includes(query)||row.dbv_id.includes(query)))});
 });
 await page.goto("/#einstellungen/profile",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await page.locator("#add-player").click();
 await expect(page.locator("#player-dialog")).toBeVisible();
});
test("Own-player lookup selects between same-name results but saves only on submit",async({page})=>{
 const input=page.locator("#own-player-search");
 await input.fill("Al");
 await expect(page.locator("#own-player-search-results button")).toHaveCount(0);
 await input.fill("Alex");
 const items=page.locator("#own-player-search-results button");
 await expect(items).toHaveCount(2);
 await expect(items.nth(0)).toContainText("Testverein A");
 await expect(items.nth(1)).toContainText("Testverein B");
 await items.nth(1).click();
 await expect(page.locator('#player-form input[name="id"]')).toHaveValue("99-000004");
 await expect(page.locator('#player-form input[name="birthYear"]')).toHaveValue("2014");
 let before=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(before.players).toHaveLength(1);
 await page.locator('#player-form button[type="submit"]').click();
 await expect(page.locator("#player-dialog")).toBeHidden();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(after.players).toHaveLength(2);
 expect(after.players[1]).toMatchObject({id:"99-000004",name:"Alex Beispiel",club:"Testverein B",birthYear:2014});
 expect(after.friends).toHaveLength(1);
});
test("Existing own and followed players cannot be selected as new own profiles",async({page})=>{
 await page.locator("#own-player-search").fill("Kind");
 const buttons=page.locator("#own-player-search-results button");
 await expect(buttons).toHaveCount(2);
 await expect(buttons.nth(0)).toBeDisabled();
 await expect(buttons.nth(1)).toBeDisabled();
 await expect(page.locator('#player-form input[name="id"]')).toHaveValue("");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toHaveLength(1);
});
test("Restricted public source is transparent and manual profile entry stays possible",async({page})=>{
 await page.route("**/rpc/search_dbv_player_identity",route=>
  route.fulfill({status:403,headers,body:'{"message":"forbidden"}'}));
 await page.locator("#own-player-search").fill("Mira");
 await expect(page.locator("#own-player-search-status")).toContainText("401/403");
 await page.locator("#own-player-manual-fallback > summary").click();
 await page.locator('#player-form input[name="name"]').fill("Mira Lokal");
 await page.locator('#player-form button[type="submit"]').click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toHaveLength(2);
 expect(saved.players[1].id).toMatch(/^local-/);
});
test("Closing or editing the dialog does not alter existing family storage",async({page})=>{
 await page.locator("#own-player-search").fill("Alex");
 await page.locator("#cancel-dialog").click();
 await expect(page.locator("#player-dialog")).toBeHidden();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.players).toHaveLength(1);
 await page.locator("#profile-list [data-edit-own]").first().click();
 await expect(page.locator("#own-player-search-panel")).toBeHidden();
 await expect(page.locator('#player-form input[name="name"]')).toHaveValue("Erstes Kind");
});

test("Welcome additional-player flow opens with the existing scoped DBV search",async({page})=>{
 await page.goto("/welcome.html?from=app",{waitUntil:"domcontentloaded"});
 const panel=page.locator("#welcome-manual-panel");
 await expect(panel).toHaveAttribute("open","");
 await expect(panel.locator("#welcome-player-search")).toBeVisible();
 await expect(panel.locator("#welcome-manual-fallback")).not.toHaveAttribute("open","");
 await panel.locator("#welcome-player-search").fill("Alex");
 await expect(panel.locator(".welcome-search-hit")).toHaveCount(2);
 await panel.locator("#welcome-manual-fallback > summary").click();
 await expect(page.locator("#welcome-form")).toBeVisible();
});
