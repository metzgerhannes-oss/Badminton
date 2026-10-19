import {mkdir} from "node:fs/promises";
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
    pickerAppearance:getComputedStyle(document.querySelector("#live-player-select")).appearance,
    pickerColor:getComputedStyle(document.querySelector("#live-player-select")).color,
    pickerBackground:getComputedStyle(document.querySelector("#live-player-select")).backgroundColor,
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
  expect(m.pickerAppearance,"WebKit native select must use deterministic custom paint").toBe("none");
  expect(m.pickerColor).toBe("rgb(247, 251, 255)");
  expect(m.pickerBackground).toBe("rgb(23, 59, 95)");
  expect(m.calendarCount).toBe(1);
  expect(m.liveCount).toBe(1);
  expect(m.overflow).toBeLessThanOrEqual(2);
  await mkdir("test-results",{recursive:true});
  await page.screenshot({path:`test-results/desktop-pr2-${width}x${height}-${test.info().project.name}.png`,animations:"disabled"});
 }
 await expect(page.locator("#desktop-context-events")).toContainText("Noch keine datierten Termine");
 await page.locator('[data-desktop-action="add-tournament"]').click();
 await expect(page.locator("#tournament-dialog")).toHaveAttribute("open","");
 await page.locator("#cancel-tournament").click();
 await expect(page.locator("#tournament-dialog")).not.toHaveAttribute("open","");
});

test("desktop PR2: saved fixture schedule is local, dated and never claims registration",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>{
  const key="shuttleboard-v1",s=JSON.parse(localStorage.getItem(key)||"{}");
  s.officialLinks=[{id:"11111111-1111-1111-1111-111111111111",playerId:"05-070879",
   url:"https://dbv.turnier.de/tournament/11111111-1111-1111-1111-111111111111",
   name:"Synthetisches Turnier",startDate:"2026-11-13",endDate:"2026-11-14"}];
  localStorage.setItem(key,JSON.stringify(s));
 });
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#desktop-context-events")).toContainText("Synthetisches Turnier");
 await expect(page.locator("#desktop-context-events")).toContainText("Teilnahme nicht bestätigt");
 await expect(page.locator("#desktop-context-events time")).toHaveAttribute("datetime","2026-11-13");
 await expect(page.locator("#desktop-context-events a")).toHaveAttribute("rel","noopener noreferrer");
});

test("desktop PR2: tablet/iPhone keep existing stacked layout and actions",async({page})=>{
 // A single synthetic page load is sufficient: responsive CSS is verified at every width.
 // Reloading ten times made this viewport-only check exceed the 30s WebKit test budget.
 await page.setViewportSize({width:1080,height:844});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 for(const width of [1080,1024,768,440,420,400,390,375,350,320]){
  await page.setViewportSize({width,height:844});
  await expect(page.locator("#view-turniere")).toBeVisible();
  await expect(page.locator("#desktop-tournament-context")).toBeHidden();
  await expect(page.locator("#dbv-calendar-results")).toBeAttached();
  await expect(page.locator("#add-tournament")).toBeAttached();
  if(width<=440){
   const columns=await page.locator(".dbv-calendar-filters").evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(" ").length);
   expect(columns,"Native WebKit calendar selects need one column at "+width+"px").toBe(1);
  }
  const diag=await page.evaluate(()=>{
   const overflow=document.documentElement.scrollWidth-innerWidth;
   const outliers=[...document.querySelectorAll("body *")].map(node=>{
    const r=node.getBoundingClientRect(),css=getComputedStyle(node);
    return {tag:node.tagName,selector:node.id?"#"+node.id:node.className&&typeof node.className==="string"?"."+node.className.trim().replace(/\\s+/g,"."):node.tagName,
     left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),display:css.display,whiteSpace:css.whiteSpace};
   }).filter(x=>x.display!=="none"&&x.right>innerWidth+3).sort((a,b)=>b.right-a.right).slice(0,12);
   const internal=[...document.querySelectorAll("html,body,.app,#hauptinhalt,#view-turniere,#view-turniere *,nav.bottom-nav")].map(node=>{
    const b=node.getBoundingClientRect(),c=getComputedStyle(node);
    return {selector:node.id?"#"+node.id:node.className&&typeof node.className==="string"?"."+node.className.trim().replace(/\\s+/g,"."):node.tagName,
     width:Math.round(b.width),client:node.clientWidth,scroll:node.scrollWidth,
     left:Math.round(b.left),right:Math.round(b.right),xOverflow:c.overflowX,display:c.display};
   }).filter(x=>x.display!=="none"&&x.scroll>x.client+8).sort((a,b)=>b.scroll-b.client-(a.scroll-a.client)).slice(0,20);
   return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow,outliers,internal,
    bodyScroll:document.body.scrollWidth,bodyClient:document.body.clientWidth,documentClient:document.documentElement.clientWidth};
  });
  if(diag.overflow>2)console.log("DESKTOP_PR2_OVERFLOW_DIAGNOSTIC",JSON.stringify({width,...diag}));
  expect(diag.overflow).toBeLessThanOrEqual(2);
 }
});
