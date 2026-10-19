import {test,expect} from "./invited-member.fixture.mjs";

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
  await expect(page.locator("#today-home")).toBeVisible();
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
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-turniere")).toBeVisible();
 const paths=[
  ["start","start"],["turniere","turniere"],["spieler","spieler"],
  ["mannschaft","mannschaft"],["berichte","berichte"],["start","start"]
 ];
 for(const [tab,view] of paths){
  await page.locator('.bottom-nav a[data-page="'+tab+'"]').click();
  await expect(page).toHaveURL(new RegExp("#"+tab+"$"));
  await expect(page.locator("#view-"+view)).toBeVisible();
  await expect(page.locator(".app")).toHaveAttribute("data-current-view",tab);
  await expect(page.locator('.bottom-nav a[data-page="'+tab+'"]')).toHaveAttribute("aria-current","page");
  await expect(page.locator('.bottom-nav a[aria-current="page"]')).toHaveCount(1);
 }
 // The latest v177 screenshot showed a pink Heute tab even on Home. This
 // shortcut must have neither aria-current nor the selected pink treatment.
 await page.evaluate(()=>{
  const live=document.querySelector("#live-nav-tab");
  live.hidden=false;
  live.parentElement.classList.add("has-live-tab");
 });
 const today=page.locator("#live-nav-tab");
 await expect(today).not.toHaveAttribute("aria-current","page");
 const inactiveBg=await today.evaluate(e=>getComputedStyle(e).backgroundColor);
 expect(inactiveBg).not.toBe("rgb(185, 31, 77)");
 // A backed 'Heute' destination still opens Turniertag, and Home escapes it.
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
