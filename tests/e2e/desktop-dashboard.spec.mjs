import {test,expect} from "@playwright/test";

test.use({
 viewport:{width:1440,height:900},
 deviceScaleFactor:1,
 isMobile:false,
 hasTouch:false
});

const own={id:"99-100001",name:"Testperson A",birthYear:2016,club:"Musterverein"};
const friends=["Testperson B","Testperson C","Testperson D","Testperson E","Testperson F"]
 .map((name,i)=>({id:"99-"+String(100002+i),name,club:"Musterverein"}));

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
 await expect(page.locator("#view-start > .settings-hint")).toBeVisible();
 await expect(page.locator("#dashboard-friends .friend-quick")).toHaveCount(4);
 await expect(page.locator("#dashboard-friends .friend-quick-more")).toContainText("+1 weitere");
 await expect(page.locator("#dashboard-next")).toBeVisible();
 await expect(page.locator("#match-stats")).toBeVisible();
 await expect(page.locator("#dashboard-rankings")).toBeVisible();
 const pos=await page.evaluate(()=>{
  const box=id=>{const r=document.querySelector(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
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
  navBottom:document.querySelector(".bottom-nav").getBoundingClientRect().bottom,
  viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth
 }));
 expect(measured.navBottom).toBeGreaterThan(790);
 expect(measured.scrollWidth).toBeLessThanOrEqual(measured.viewport+2);
});

test("right-to-left desktop navigation respects reading direction",async ({page})=>{
 await page.goto("/#start");
 await page.evaluate(()=>{document.documentElement.dir="rtl"});
 const box=await page.evaluate(()=>{
  const nav=document.querySelector(".bottom-nav").getBoundingClientRect();
  const content=document.querySelector("#hauptinhalt").getBoundingClientRect();
  return {navLeft:nav.left,contentRight:content.right,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 expect(box.navLeft).toBeGreaterThanOrEqual(box.contentRight-2);
 expect(box.overflow).toBeLessThanOrEqual(2);
});
