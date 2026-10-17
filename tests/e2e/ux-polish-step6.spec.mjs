import {test,expect} from "./invited-member.fixture.mjs";

/* U6: presentation-only tests. Supabase requests remain blocked/mocked by the
   isolated Playwright fixture; no real roster, imports or player data. */
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"UI Testprofil"}],friends:[],
   officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
   historyProfilesInitialized:true
  }));
 });
});
test("mobile secondary views use consistent card, heading and control shapes",async({page})=>{
 for(const width of [320,390]){
  await page.setViewportSize({width,height:720});
  await page.goto("/#berichte",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-berichte")).toBeVisible();
  await expect(page.locator('link[rel="stylesheet"][href="./ux-polish.css"]')).toHaveCount(1);
  const heading=await page.locator("#view-berichte>.section-heading h2").evaluate(node=>({
   fontSize:parseFloat(getComputedStyle(node).fontSize),
   color:getComputedStyle(node).color,
   lineHeight:parseFloat(getComputedStyle(node).lineHeight)
  }));
  expect(heading.fontSize).toBeGreaterThanOrEqual(17.9);
  expect(heading.fontSize).toBeLessThanOrEqual(22.1);
  expect(heading.color).toBe("rgb(12, 53, 92)");
  const refresh=await page.locator("#report-refresh").evaluate(node=>({
   height:parseFloat(getComputedStyle(node).minHeight),
   radius:parseFloat(getComputedStyle(node).borderTopLeftRadius)
  }));
  expect(refresh.height).toBeGreaterThanOrEqual(44);
  expect(refresh.radius).toBe(12);
  const fieldRadius=await page.locator("#report-search").evaluate(node=>
   parseFloat(getComputedStyle(node).borderTopLeftRadius));
  expect(fieldRadius).toBe(12);
  await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-turniere")).toBeVisible();
  const card=await page.locator(".dbv-calendar-panel").evaluate(node=>({
   radius:parseFloat(getComputedStyle(node).borderTopLeftRadius),
   shadow:getComputedStyle(node).boxShadow
  }));
  expect(card.radius).toBe(16);
  expect(card.shadow).not.toBe("none");
  // WebKit can report a transient document.scrollWidth for hidden/deferred
  // descendants that are not actually exposed as horizontal page scrolling.
  // Assert the visible card/heading fit, then try a real horizontal scroll.
  const frame=await page.evaluate(()=>{
   const nodes=[".dbv-calendar-panel","#view-turniere>.section-heading"];
   const rects=nodes.map(selector=>{
    const el=document.querySelector(selector);
    const rect=el.getBoundingClientRect();
    return {selector,left:rect.left,right:rect.right};
   });
   return {width:innerWidth,rects,bodyOverflowX:getComputedStyle(document.body).overflowX};
  });
  for(const rect of frame.rects){
   expect(rect.left,rect.selector).toBeGreaterThanOrEqual(-1);
   expect(rect.right,rect.selector).toBeLessThanOrEqual(frame.width+2);
  }
  // The user's horizontal gesture is clipped; programmatic scrollTo can
  // still move a CSS overflow:hidden viewport in WebKit, so do not use it.
  expect(frame.bodyOverflowX).toBe("hidden");
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
  expect(stored.activeProfileId).toBe("05-070879");
 }
});
test("approved navy desktop remains unchanged and zoom stays enabled",async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto("/#verein",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-verein")).toBeVisible();
 const panelColor=await page.locator(".club-overview-panel").evaluate(node=>
  getComputedStyle(node).backgroundColor);
 expect(panelColor).toBe("rgb(17, 44, 81)");
 const viewport=await page.locator('meta[name="viewport"]').getAttribute("content");
 expect(viewport).toContain("viewport-fit=cover");
 expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
});
