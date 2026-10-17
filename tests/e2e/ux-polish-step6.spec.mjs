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
  const overflow=await page.evaluate(()=>{
   const viewport=innerWidth;
   const exposed=[...document.querySelectorAll("body *")].flatMap(node=>{
    if(!(node instanceof HTMLElement || node instanceof SVGElement))return [];
    const rect=node.getBoundingClientRect();
    const style=getComputedStyle(node);
    if(style.display==="none"||style.visibility==="hidden"||rect.width<=0||rect.height<=0||rect.right<=viewport+3)return [];
    return [{node:node.tagName.toLowerCase(),id:node.id,cls:String(node.getAttribute("class")||"").slice(0,90),
      right:Math.round(rect.right),width:Math.round(rect.width),parent:node.parentElement?.className||"",
      text:(node.textContent||"").trim().slice(0,55)}];
   }).sort((a,b)=>b.right-a.right).slice(0,18);
   return {extra:document.documentElement.scrollWidth-viewport,viewport,exposed};
  });
  expect(overflow.extra,JSON.stringify({width,overflow},null,2)).toBeLessThanOrEqual(2);
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
