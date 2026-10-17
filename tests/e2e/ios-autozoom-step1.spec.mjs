import {test,expect} from "./invited-member.fixture.mjs";

// WebKit mobile viewport exercises the iPhone focus-zoom prevention. No live backend calls.
const CSS_FIELD='input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="hidden"]), select, textarea, [contenteditable="true"]';
const touch='a, button, summary';
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Musterprofil",birthYear:2016}],
   friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
   historyProfilesInitialized:true
  }));
 });
});
test("mobile controls are >=16px; navigation taps do not invoke double-tap zoom",async({page})=>{
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:720});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-start")).toBeVisible();
  const values=await page.evaluate((selector)=>{
   return [...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length)
     .map(el=>({id:el.id||el.name,px:parseFloat(getComputedStyle(el).fontSize)}));
  },CSS_FIELD);
  expect(values.length).toBeGreaterThan(0);
  expect(values.filter(x=>x.px<16),JSON.stringify(values)).toEqual([]);
  const touchAction=await page.locator('.bottom-nav a[data-page="start"]').evaluate(e=>getComputedStyle(e).touchAction);
  expect(touchAction).toBe("manipulation");
  const viewport=await page.evaluate(()=>document.querySelector('meta[name="viewport"]').content);
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
 }
});
test("search and modal entry remain readable on narrow iPhone and keyboard focus",async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 // Real user route: tap + at friends to reveal the (normally collapsed) search.
 await page.locator("#dashboard-add-friend").click();
 await expect(page.locator("#player-discover")).toBeVisible();
 const search=page.locator("#library-search");
 await expect(search).toBeVisible();
 await search.focus();
 expect(await search.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 await page.goto("/#einstellungen/profile",{waitUntil:"domcontentloaded"});
 await page.locator("#add-player").click();
 const dialog=page.locator("#player-dialog");
 await expect(dialog).toBeVisible();
 const name=dialog.locator('input[name="name"]');
 await name.focus();
 expect(await name.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 await page.locator("#cancel-dialog").click();
 await expect(dialog).toBeHidden();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.activeProfileId).toBe("05-070879");
});
test("iPhone welcome search, manual entry and selects do not autozoom",async({page})=>{
 await page.setViewportSize({width:375,height:700});
 await page.goto("/welcome.html",{waitUntil:"domcontentloaded"});
 for(const id of ["#welcome-player-search","#welcome-reference","#welcome-name","#welcome-language"]){
  const px=await page.locator(id).evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(px,id).toBeGreaterThanOrEqual(16);
 }
 const action=await page.locator("#existing-app-link").evaluate(el=>getComputedStyle(el).touchAction);
 expect(action).toBe("manipulation");
});
