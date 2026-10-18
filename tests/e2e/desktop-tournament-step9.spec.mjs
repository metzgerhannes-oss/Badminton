import {test,expect} from "./invited-member.fixture.mjs";

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))
   localStorage.setItem("shuttleboard-v1",JSON.stringify({
    players:[{id:"05-070879",name:"Synthetisches Profil",club:"Testverein"}],
    friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
    historyProfilesInitialized:true
   }));
 });
});

test("desktop PR2: turniertag has usable right context and no horizontal page overflow",async({page})=>{
 for(const [width,height] of [[1920,1080],[1440,900],[1280,800]]){
  await page.setViewportSize({width,height});
  await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-turniere")).toBeVisible();
  await expect(page.locator("#desktop-tournament-context")).toBeVisible();
  const m=await page.evaluate(()=>{
   const get=s=>document.querySelector(s).getBoundingClientRect();
   const rail=get(".bottom-nav"),main=get("#view-turniere"),panel=get("#desktop-tournament-context"),
    live=get("#view-turniere .live-dbv");
   return {railRight:rail.right,mainLeft:main.left,mainRight:main.right,
    panelLeft:panel.left,panelRight:panel.right,panelWidth:panel.width,
    liveRight:live.right,overflow:document.documentElement.scrollWidth-innerWidth,
    panelDisplay:getComputedStyle(document.querySelector("#desktop-tournament-context")).display,
    calendarCount:document.querySelectorAll("#dbv-calendar-results").length,
    liveCount:document.querySelectorAll("#live-radar-content").length};
  });
  expect(m.railRight).toBeLessThanOrEqual(m.mainLeft-4);
  expect(m.panelLeft).toBeGreaterThanOrEqual(m.liveRight+8);
  expect(m.panelRight).toBeLessThanOrEqual(m.mainRight+2);
  expect(m.panelWidth).toBeGreaterThanOrEqual(289);
  expect(m.panelWidth).toBeLessThanOrEqual(321);
  expect(m.panelDisplay).not.toBe("none");
  expect(m.calendarCount).toBe(1);
  expect(m.liveCount).toBe(1);
  expect(m.overflow).toBeLessThanOrEqual(2);
 }
 await expect(page.locator("#desktop-context-events")).toContainText("Noch keine datierten Termine");
 await page.locator('[data-desktop-action="add-tournament"]').click();
 await expect(page.locator("#tournament-dialog")).toHaveAttribute("open","");
 await page.locator("#cancel-tournament").click();
 await expect(page.locator("#tournament-dialog")).not.toHaveAttribute("open","");
});

test("desktop PR2: saved fixture schedule is local, dated and never claims registration",async({page})=>{
 await page.addInitScript(()=>{
  const key="shuttleboard-v1",s=JSON.parse(localStorage.getItem(key)||"{}");
  s.officialLinks=[{id:"11111111-1111-1111-1111-111111111111",playerId:"05-070879",
   url:"https://dbv.turnier.de/tournament/11111111-1111-1111-1111-111111111111",
   name:"Synthetisches Turnier",startDate:"2026-11-13",endDate:"2026-11-14"}];
  localStorage.setItem(key,JSON.stringify(s));
 });
 await page.setViewportSize({width:1440,height:900});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#desktop-context-events")).toContainText("Synthetisches Turnier");
 await expect(page.locator("#desktop-context-events")).toContainText("Teilnahme nicht bestätigt");
 await expect(page.locator("#desktop-context-events time")).toHaveAttribute("datetime","2026-11-13");
 await expect(page.locator("#desktop-context-events a")).toHaveAttribute("rel","noopener noreferrer");
});

test("desktop PR2: tablet/iPhone keep existing stacked layout and actions",async({page})=>{
 for(const width of [1080,1024,768,390,320]){
  await page.setViewportSize({width,height:844});
  await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-turniere")).toBeVisible();
  await expect(page.locator("#desktop-tournament-context")).toBeHidden();
  await expect(page.locator("#dbv-calendar-results")).toBeAttached();
  await expect(page.locator("#add-tournament")).toBeAttached();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 }
});
