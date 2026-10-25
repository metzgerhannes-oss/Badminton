import {test,expect} from "./invited-member.fixture.mjs";
import {mockVerifiedTodayTeam} from "./verified-today-team.mjs";

// Regression: native iPhone Home must not remain on the v177 'Heute' / live view
// even when WebKit has not yet dispatched the hashchange after tapping Home.
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Synthetisches Heimprofil",club:"Testverein"}],
   friends:[],officialLinks:[],activeProfileId:"05-070879",
   chosen:"05-070879",historyProfilesInitialized:true
  }));
 });
});
for(const width of [320,390]){
 test("iPhone "+width+"px: Home switches immediately away from Heute even without hashchange",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/#live",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-turniere")).toBeVisible();
  await expect(page.locator("#view-start")).toBeHidden();
  // Reproduce a delayed/missed hashchange on installed WebKit Home Screen PWAs.
  await page.evaluate(()=>window.addEventListener("hashchange",event=>{
   event.stopImmediatePropagation();
  },{capture:true,once:true}));
  await page.locator('.bottom-nav a[data-page="start"]').click();
  await expect(page).toHaveURL(/#start$/);
  await expect(page.locator("#view-start")).toBeVisible();
  await expect(page.locator("#view-turniere")).toBeHidden();
  await expect(page.locator(".app")).toHaveAttribute("data-current-view","start");
  await expect(page.locator('.bottom-nav a[data-page="start"]')).toHaveAttribute("aria-current","page");
  await expect(page.locator("#view-start #match-stats")).toBeVisible();
  await expect(page.locator("#today-home")).toBeHidden();
  const summaryFirst=await page.evaluate(()=>{
   const stats=document.querySelector("#view-start #match-stats");
   const today=document.querySelector("#today-home");
   return Boolean(stats&&today&&(stats.compareDocumentPosition(today)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(summaryFirst,"Home overview should appear before Heute").toBe(true);
  // Repeated Home taps must not switch back to the Heute screen.
  await page.locator('.bottom-nav a[data-page="start"]').click();
  await expect(page.locator("#view-start")).toBeVisible();
  await expect(page.locator("#view-turniere")).toBeHidden();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")||"null"));
  expect(saved.players[0].name).toBe("Synthetisches Heimprofil");
 });
}
test("Normal Turniertag to Home to Turniertag retains distinct views",async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-turniere")).toBeVisible();
 await page.locator('.bottom-nav a[data-page="start"]').click();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator("#view-turniere")).toBeHidden();
 await page.locator('.bottom-nav a[data-page="turniere"]').click();
 await expect(page.locator("#view-turniere")).toBeVisible();
 await expect(page.locator("#view-start")).toBeHidden();
});

test("iPhone bottom navigation: every destination works and only current tab is selected",async({page})=>{
 await mockVerifiedTodayTeam(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#today-home .today-match-row")).toContainText("Anpfiff",{timeout:15000});
 await expect(page.locator(".bottom-nav a:visible")).toHaveCount(4);
 await expect(page.locator("#live-nav-tab")).toBeVisible();
 await page.locator("#live-nav-tab").click();
 await expect(page.locator("#view-turniere")).toBeVisible();
 const paths=[
  ["start","start"],["spieler","spieler"],["turniere","turniere"],
  ["mannschaft","mannschaft"],["start","start"]
 ];
 for(const [tab,view] of paths){
  await page.locator('.bottom-nav a[data-page="'+tab+'"]').click();
  await expect(page).toHaveURL(new RegExp("#"+tab+"$"));
  await expect(page.locator("#view-"+view)).toBeVisible();
  await expect(page.locator(".app")).toHaveAttribute("data-current-view",tab);
  await expect(page.locator('.bottom-nav a[data-page="'+tab+'"]')).toHaveAttribute("aria-current","page");
  await expect(page.locator('.bottom-nav a[aria-current="page"]')).toHaveCount(1);
 }
 // The old v177 screenshot showed a pink Heute tab shifting the main navigation.
 // Use a verified fixture and require Heute to be outside the four stable tabs.
 const today=page.locator("#live-nav-tab");
 await expect(today).toBeVisible();
 await expect(today).not.toHaveAttribute("aria-current","page");
 const inactiveBg=await today.evaluate(e=>getComputedStyle(e).backgroundColor);
 expect(inactiveBg).toBe("rgb(185, 31, 77)");
 // Verified Heute still opens the #live deep link, and Home escapes it.
 await today.click();
 await expect(page.locator("#view-turniere")).toBeVisible();
 await expect(page.locator(".app")).toHaveAttribute("data-current-view","live");
 await expect(today).toHaveAttribute("aria-current","page");
 await page.locator('.bottom-nav a[data-page="start"]').click();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator("#view-turniere")).toBeHidden();
 await expect(today).not.toHaveAttribute("aria-current","page");
 await expect(page.locator('.bottom-nav a[data-page="start"]')).toHaveAttribute("aria-current","page");
});
