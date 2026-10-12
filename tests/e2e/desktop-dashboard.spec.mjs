import {test,expect} from "@playwright/test";

test.use({
 viewport:{width:1440,height:900},
 deviceScaleFactor:1,
 isMobile:false,
 hasTouch:false
});

const own={id:"05-070879",name:"Testprofil",birthYear:2016,club:"SpVgg Mössingen"};
const friends=["Sarah Storz","Vincent Beispiel","Charlotte Beispiel","Nina Beispiel","Philipp Beispiel"]
 .map((name,i)=>({id:"05-"+String(710001+i),name,club:"SpVgg Mössingen"}));

test.beforeEach(async ({page})=>{
 await page.addInitScript(({own,friends})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[own],friends,officialLinks:[],activeProfileId:own.id,chosen:own.id,historyProfilesInitialized:true
  }));
 },{own,friends});
});

test("wide dashboard uses vertical navigation and real dashboard sections without overflow",async ({page})=>{
 await page.goto("/#start");
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".bottom-nav")).toHaveCSS("flex-direction","column");
 await expect(page.locator("#view-start")).toHaveCSS("display","grid");
 await expect(page.locator("#dashboard-friends .friend-quick")).toHaveCount(4);
 await expect(page.locator("#dashboard-friends .friend-quick-more")).toContainText("+1 weitere");
 await expect(page.locator("#dashboard-next")).toBeVisible();
 await expect(page.locator("#match-stats")).toBeVisible();
 await expect(page.locator("#dashboard-rankings")).toBeVisible();
 const pos=await page.evaluate(()=>{
  const box=id=>document.querySelector(id).getBoundingClientRect();
  return {nav:box(".bottom-nav").right,main:box("#hauptinhalt").left,
    tournament:box("#dashboard-next"),friends:box(".dashboard-friends-section"),
    stats:box("#match-stats"),ranking:box(".home-ranking-section"),
    scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
 });
 expect(pos.nav).toBeLessThan(pos.main);
 expect(pos.friends.left).toBeGreaterThan(pos.tournament.right-1);
 expect(pos.ranking.left).toBeGreaterThan(pos.stats.right-1);
 expect(pos.scrollWidth).toBeLessThanOrEqual(pos.viewport+2);
 await page.locator('.bottom-nav a[data-page="mannschaft"]').click();
 await expect(page.locator("#view-mannschaft")).toBeVisible();
 await expect(page.locator(".bottom-nav a[data-page=mannschaft]")).toHaveAttribute("aria-current","page");
});

test("tablet/mobile retains horizontal bottom navigation and original stacked home",async ({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start");
 await expect(page.locator(".bottom-nav")).toHaveCSS("flex-direction","row");
 await expect(page.locator("#view-start")).toHaveCSS("display","block");
 const measured=await page.evaluate(()=>({
  nav:document.querySelector(".bottom-nav").getBoundingClientRect(),
  viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth
 }));
 expect(measured.nav.bottom).toBeGreaterThan(790);
 expect(measured.scrollWidth).toBeLessThanOrEqual(measured.viewport+2);
});
