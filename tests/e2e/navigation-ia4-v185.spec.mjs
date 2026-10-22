import {test,expect} from "./invited-member.fixture.mjs";
import {mockVerifiedTodayTeam} from "./verified-today-team.mjs";

const own=[
 {id:"99-100001",name:"Eigener Testspieler Eins"},
 {id:"99-100002",name:"Eigener Testspieler Zwei"}
];
const friend={id:"98-200001",name:"Gefolgter Testspieler"};
test.beforeEach(async({page})=>{
 await page.addInitScript(({own,friend})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:own,friends:[friend],activeProfileId:own[0].id,
   chosen:own[0].id,officialLinks:[],historyProfilesInitialized:true
  }));
 },{own,friend});
});
for(const width of [320,390,1280,1440,1920]){
 test("IA-4 "+width+"px: primary and context routes match the visible page",async({page},info)=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-spieler")).toBeVisible();
  for(const [tab,view] of [
   ["start","start"],["turniere","turniere"],
   ["spieler","spieler"],["mannschaft","mannschaft"],
   ["berichte","berichte"],["start","start"]
  ]){
   await page.locator('.bottom-nav a[data-page="'+tab+'"]').click();
   await expect(page.locator("#view-"+view)).toBeVisible();
   await expect(page.locator('.bottom-nav a[data-page="'+tab+'"]')).toHaveAttribute("aria-current","page");
   await expect(page.locator('.bottom-nav a[aria-current="page"]')).toHaveCount(1);
  }
  await expect(page.locator("#focused-profile")).toContainText("Eigenes Profil");
  await page.locator(".topbar-settings").click();
  await expect(page.locator("#view-einstellungen")).toBeVisible();
  await expect(page.locator(".topbar-settings")).toHaveAttribute("aria-current","page");
  await page.locator(".topbar .brand").click();
  await expect(page.locator("#view-start")).toBeVisible();
  await expect(page.locator(".topbar-settings")).not.toHaveAttribute("aria-current","page");
  if(width<=390){
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   expect(overflow).toBeLessThanOrEqual(2);
   const targets=await page.locator(".bottom-nav a:visible").evaluateAll(items=>items.map(e=>e.getBoundingClientRect()));
   expect(Math.min(...targets.map(r=>r.width))).toBeGreaterThanOrEqual(44);
  }
  if(width===390||width===1440||width===1920)
   await page.screenshot({path:info.outputPath("ia4-navigation-"+width+".png"),fullPage:false});
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
  expect(stored.players.map(p=>p.id)).toEqual(own.map(p=>p.id));
  expect(stored.friends.map(p=>p.id)).toEqual([friend.id]);
 });
}
test("IA-4: Today is not displayed as a false live status without fresh evidence",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#live-nav-tab")).toBeHidden();
 await page.locator(".topbar-settings").click();
 await page.locator(".topbar .brand").click();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator("#live-nav-tab")).toBeHidden();
});
test("IA-4: verified Today enters Turniertag, keyboard Home returns to own profile",async({page})=>{
 await mockVerifiedTodayTeam(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#live-nav-tab")).toBeVisible();
 await page.locator("#live-nav-tab").click();
 await expect(page.locator(".app")).toHaveAttribute("data-current-view","live");
 await page.locator('.bottom-nav a[data-page="start"]').focus();
 await page.keyboard.press("Enter");
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator('.bottom-nav a[data-page="start"]')).toHaveAttribute("aria-current","page");
 await expect(page.locator("#focused-profile")).toContainText("Eigenes Profil");
 await expect(page.locator("#live-nav-tab")).not.toHaveAttribute("aria-current","page");
});
