import {test,expect} from "./invited-member.fixture.mjs";
// Synthetic device-only family and followed players, all Supabase egress blocked.
// IA-4: immediate context navigation also works when iPhone delays hashchange.
const OWN="99-000001",FRIEND="98-000002";
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"99-000001",name:"Mein eigenes Kind",birthYear:2015},{id:"99-000003",name:"Zweites Kind",birthYear:2016}],
   friends:[{id:"98-000002",name:"Gefolgter Testspieler",club:"Testverein"}],
   activeProfileId:"99-000001",chosen:"99-000001",officialLinks:[],historyProfilesInitialized:true
  }));
 });
});
for(const width of [320,390,1280]){
 test("IA-4 "+width+"px: selected friend statistics stay selected, Home/Logo restores own profile",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  await expect(page.locator(".focused-profile")).toContainText("Mein eigenes Kind");
  await page.locator('[data-friend-quick="'+FRIEND+'"]').click();
  await expect(page.locator(".focused-profile")).toContainText("Gefolgter Testspieler");
  await expect(page.locator("#view-start")).toBeVisible();
  // Simulate lost WebKit hashchange after tapping the persistent Home logo.
  await page.evaluate(()=>window.addEventListener("hashchange",e=>e.stopImmediatePropagation(),{capture:true,once:true}));
  await page.locator('.topbar .brand[href="#start"]').click();
  await expect(page.locator(".focused-profile")).toContainText("Mein eigenes Kind");
  await expect(page.locator(".focused-profile")).not.toContainText("Gefolgter Testspieler");
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
  expect(saved.players.map(p=>p.id)).toEqual([OWN,"99-000003"]);
  expect(saved.friends.map(p=>p.id)).toEqual([FRIEND]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
test("IA-4: Home history teaser enters one canonical history route immediately",async({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-start")).toBeVisible();
 await page.evaluate(()=>window.addEventListener("hashchange",e=>e.stopImmediatePropagation(),{capture:true,once:true}));
 await page.locator('#view-start a.home-stats-link[href="#historie"]').click();
 await expect(page).toHaveURL(/#historie$/);
 await expect(page.locator("#view-historie")).toBeVisible();
 await expect(page.locator("#view-start")).toBeHidden();
 await expect(page.locator(".app")).toHaveAttribute("data-current-view","historie");
 await expect(page.locator('.bottom-nav a[data-page="turniere"]')).toHaveAttribute("aria-current","page");
 await page.locator('.topbar .brand[href="#start"]').click();
 await expect(page.locator("#view-start")).toBeVisible();
});
test("IA-4: Heute → Turniere → Home works without delayed hashchange",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator(".app")).toHaveAttribute("data-current-view","live");
 await page.evaluate(()=>window.addEventListener("hashchange",e=>e.stopImmediatePropagation(),{capture:true,once:true}));
 await page.locator('a.live-tournaments-return[href="#turniere"]').click();
 await expect(page.locator(".app")).toHaveAttribute("data-current-view","turniere");
 await expect(page.locator("#view-turniere")).toBeVisible();
 await page.locator('.bottom-nav a[data-page="start"]').click();
 await expect(page.locator(".app")).toHaveAttribute("data-current-view","start");
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator("#live-nav-tab")).toBeHidden();
});
test("IA-4: Home + opens the single player following search immediately",async({page})=>{
 await page.setViewportSize({width:320,height:844});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>window.addEventListener("hashchange",e=>e.stopImmediatePropagation(),{capture:true,once:true}));
 await page.locator("#dashboard-add-friend").click();
 await expect(page).toHaveURL(/#spieler$/);
 await expect(page.locator("#view-spieler")).toBeVisible();
 await expect(page.locator("#followed-player-search")).toBeVisible();
 await expect(page.locator("#followed-player-search")).toBeFocused();
 await expect(page.locator("#player-discover")).toBeHidden();
 await expect(page.locator("#view-einstellungen #friend-settings-list")).toHaveCount(0);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.players).toHaveLength(2);
 expect(stored.friends).toHaveLength(1);
});
