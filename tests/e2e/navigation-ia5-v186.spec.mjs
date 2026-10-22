import {test,expect} from "./invited-member.fixture.mjs";
// Offline synthetic profiles/follows; inherited fixture blocks production Supabase.
const own=[{id:"99-900001",name:"Erstes Kind"},{id:"99-900002",name:"Zweites Kind"}];
const friends=[{id:"98-900003",name:"Gefolgte Person"}];
async function seed(page){
 await page.addInitScript(({own,friends})=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:own,friends,activeProfileId:own[0].id,chosen:own[0].id,
  officialLinks:[],historyProfilesInitialized:true
 })),{own,friends});
}
for(const width of [320,390,1280,1440,1920]){
 test("IA-5 "+width+"px: settings navigation survives lost hashchange",async({page})=>{
  await seed(page);
  await page.setViewportSize({width,height:844});
  await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  await expect(page.locator("#settings-room-hub")).toBeVisible();
  const links=page.locator("#settings-room-hub .settings-room-link");
  await expect(links).toHaveCount(5);
  const sizes=await links.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
  await page.evaluate(()=>window.addEventListener("hashchange",e=>e.stopImmediatePropagation(),{capture:true,once:true}));
  await page.locator('[data-settings-target="profile"]').click();
  await expect(page).toHaveURL(/#einstellungen\/profile$/);
  await expect(page.locator("#settings-room-profile")).toBeVisible();
  await expect(page.locator("#settings-room-hub")).toBeHidden();
  await expect(page.locator("#profile-list .own-profile")).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.evaluate(()=>window.addEventListener("hashchange",e=>e.stopImmediatePropagation(),{capture:true,once:true}));
  await page.locator("#settings-room-profile a.settings-room-back").click();
  await expect(page.locator("#settings-room-hub")).toBeVisible();
  await expect(page.locator("#settings-room-profile")).toBeHidden();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
  expect(saved.players.map(p=>p.id)).toEqual(own.map(p=>p.id));
  expect(saved.friends.map(p=>p.id)).toEqual(friends.map(p=>p.id));
 });
}
test("IA-5: browser Back/Forward and keyboard activation of all rooms",async({page})=>{
 await seed(page);
 await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
 for(const area of ["profile","darstellung","einladungen","daten","hilfe"]){
  await page.locator('[data-settings-target="'+area+'"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#settings-room-"+area)).toBeVisible();
  await page.goBack();
  await expect(page.locator("#settings-room-hub")).toBeVisible();
 }
 await page.locator('[data-settings-target="daten"]').click();
 await expect(page.locator("#settings-room-daten #backup-export")).toBeVisible();
 await page.goBack();
 await expect(page.locator("#settings-room-hub")).toBeVisible();
 await page.goForward();
 await expect(page.locator("#settings-room-daten")).toBeVisible();
});
