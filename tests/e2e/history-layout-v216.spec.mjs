import {test,expect} from "./invited-member.fixture.mjs";

for(const width of [320,390,1280]){
 test("v216 "+width+"px: statistic entry, trophy-first layout, source details and return",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.addInitScript(()=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"99-111111",name:"Synthetisches Profil"}],friends:[],officialLinks:[],
   activeProfileId:"99-111111",chosen:"99-111111",historyProfilesInitialized:true
  })));
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  const link=page.locator('#match-stats a.home-stats-link');
  await expect(link).toHaveText("Komplette Statistik");
  await link.click();
  await expect(page).toHaveURL(/#historie$/);
  await expect(page.locator("#view-historie")).toHaveClass(/active/);
  const hierarchy=await page.locator("#view-historie").evaluate(el=>{
   const children=[...el.children];
   const i=s=>children.findIndex(n=>n.matches(s));
   return {trophy:i(".trophy-section"),coverage:i("#history-source-details"),
    career:i("#career-history"),matches:i("#external-match-history"),overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(hierarchy.trophy).toBe(1);
  expect(hierarchy.coverage).toBeGreaterThan(hierarchy.trophy);
  expect(hierarchy.career).toBeGreaterThan(hierarchy.coverage);
  expect(hierarchy.matches).toBeGreaterThan(hierarchy.career);
  expect(hierarchy.overflow).toBeLessThanOrEqual(2);
  const source=page.locator("#external-match-source-details");
  await expect(source).not.toHaveAttribute("open",/.+/);
  await expect(source.locator("summary")).toHaveText("Quellenstand und Abweichungen anzeigen");
  // Verify native keyboard disclosure without depending on live/private source data.
  await page.locator("#external-match-history").evaluate(el=>{el.hidden=false});
  await source.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(source).toHaveJSProperty("open",true);
  await page.locator("#external-match-year").dispatchEvent("change");
  await expect(source).toHaveJSProperty("open",true);

  await page.locator('#view-historie a.history-inline-link[href="#start"]').click();
  await expect(page).toHaveURL(/#start$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
