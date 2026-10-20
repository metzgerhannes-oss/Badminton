import {test,expect} from "./invited-member.fixture.mjs";
// Offline synthetic profiles/follows. No production Supabase request may pass
// the inherited route firewall. No owner permissions derived from a follow.
const own=[
 {id:"99-000001",name:"Eigenes Testprofil Eins",birthYear:2015},
 {id:"99-000002",name:"Eigenes Testprofil Zwei",birthYear:2016}
];
const friends=[
 {id:"98-000003",name:"Gefolgter Demo Eins",club:"Testverein"},
 {id:"98-000004",name:"Gefolgter Demo Zwei",club:"Testverein"}
];
async function prepare(page){
 await page.addInitScript(({own,friends})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:own,activeProfileId:own[0].id,chosen:own[0].id,
   friends,officialLinks:[],historyProfilesInitialized:true
  }));
 },{own,friends});
}
test("v183: followed friends move only inside Spieler; family profile count unchanged",async({page})=>{
 await prepare(page);
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("#view-spieler")).toBeVisible();
 await expect(page.locator("#friend-list [data-view-friend]")).toHaveCount(2);
 await expect(page.locator("#player-own-preview")).toBeHidden();
 await expect(page.locator("#friend-manage-details")).toBeVisible();
 await page.locator("#friend-manage-details summary").click();
 await expect(page.locator("#friend-settings-list [data-friend-move]")).toHaveCount(4);
 await page.locator('#friend-settings-list [data-friend-move="98-000004"][data-direction="-1"]').click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players.map(p=>p.id)).toEqual(["99-000001","99-000002"]);
 expect(saved.friends.map(p=>p.id)).toEqual(["98-000004","98-000003"]);
 expect(saved.activeProfileId).toBe("99-000001");
 await page.goto("/#einstellungen/profile",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#profile-list .own-profile")).toHaveCount(2);
 await expect(page.locator("#owner-admin-panel")).toBeHidden();
 await expect(page.locator("#view-einstellungen #friend-settings-list")).toHaveCount(0);
 await expect(page.locator("#view-einstellungen #team-settings-list")).toHaveCount(0);
});
test("v183: old settings follow bookmarks resolve to canonical pages, no duplicate dialogs",async({page})=>{
 await prepare(page);
 await page.goto("/#einstellungen/spieler",{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(/#spieler$/);
 await expect(page.locator("#view-spieler")).toBeVisible();
 await expect(page.locator("#player-add-open")).toBeVisible();
 await page.goto("/#einstellungen/mannschaften",{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(/#mannschaft$/);
 await expect(page.locator("#view-mannschaft")).toBeVisible();
 await expect(page.locator("#team-manage-details")).toBeVisible();
 await expect(page.locator("#team-followed")).toBeVisible();
 await page.locator('nav.bottom-nav [data-page="start"]').click();
 await expect(page.locator("#view-start")).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toHaveLength(2);
 expect(saved.friends).toHaveLength(2);
});
for(const width of [320,390,1280,1440,1920]){
 test("v183: canonical management reachable without horizontal overflow "+width+"px",async({page})=>{
  await prepare(page);
  await page.setViewportSize({width,height:844});
  await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  await page.locator("#friend-manage-details summary").click();
  await expect(page.locator("#friend-settings-list [data-friend-move]")).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  const h=await page.locator("#friend-manage-details summary").evaluate(e=>e.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(44);
 });
}
