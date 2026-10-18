import {mkdir} from "node:fs/promises";
import {test,expect} from "./invited-member.fixture.mjs";

// Entirely synthetic local profile. Shared CI fixture denies all unintended
// production Supabase traffic in Chromium and WebKit.
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))
   localStorage.setItem("shuttleboard-v1",JSON.stringify({
    players:[{id:"05-070879",name:"Testprofil",club:"Testverein"}],
    friends:[],officialLinks:[],activeProfileId:"05-070879",
    chosen:"05-070879",historyProfilesInitialized:true
   }));
 });
});

const bounds=async(page)=>page.evaluate(()=>{
 const rect=s=>{const el=document.querySelector(s);if(!el)return null;
  const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}};
 return {innerWidth,scroll:document.documentElement.scrollWidth,
  main:rect("#hauptinhalt"),nav:rect(".bottom-nav"),
  active:rect("#hauptinhalt>.page.active"),
  pages:document.querySelectorAll("#hauptinhalt>.page.active").length,
  navCount:document.querySelectorAll("nav.bottom-nav").length};
});

test("desktop PR3: wide existing views use the shell without clipping or duplicate navigation",async({page})=>{
 test.setTimeout(120_000); // 21 route loads plus deterministic screenshots on CI
 for(const width of [1280,1440,1920]){
  await page.setViewportSize({width,height:900});
  for(const route of ["start","spieler","verein","mannschaft","berichte","historie","einstellungen"]){
   await page.goto("/#"+route,{waitUntil:"domcontentloaded"});
   await expect(page.locator("#view-"+route)).toBeVisible();
   const m=await bounds(page);
   expect(m.pages,route+" should display only one main route").toBe(1);
   expect(m.navCount).toBe(1);
   expect(m.nav.right).toBeLessThanOrEqual(m.main.left-4);
   expect(m.scroll-innerWidth,route+" overflows at "+width+"px").toBeLessThanOrEqual(2);
   expect(m.active?.width).toBeGreaterThan(300);
   if(width===1440&&["start","spieler","verein","mannschaft","berichte","einstellungen"].includes(route)){
    await mkdir("test-results",{recursive:true});
    await page.screenshot({
     path:`test-results/desktop-pr3-${route}-${width}-${test.info().project.name}.png`,
     animations:"disabled"
    });
   }
  }
 }
});

test("desktop PR3: player search opens alongside followed profiles and keeps focus",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator("#player-add-open").click();
 await expect(page.locator("#player-discover")).toBeVisible();
 const m=await page.evaluate(()=>{
  const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top}};
  const c=getComputedStyle(document.getElementById("view-spieler"));
  return {cols:c.gridTemplateColumns.split(" ").length,follow:document.querySelector("#view-spieler .follow-hub").getBoundingClientRect().right,find:rect("player-discover"),overflow:document.documentElement.scrollWidth-innerWidth};
 });
 expect(m.cols).toBe(2);
 expect(m.find.left).toBeGreaterThanOrEqual(m.follow+8);
 expect(m.overflow).toBeLessThanOrEqual(2);
 await expect(page.locator("#library-search")).toBeVisible();
 // Regression: mobile's pale discovery card must not retain a white desktop
 // heading. Measure rendered contrast rather than only checking CSS strings.
 const contrast=await page.locator("#player-discover").evaluate(panel=>{
  const parse=value=>value.match(/[0-9.]+/g).slice(0,3).map(Number);
  const lum=rgb=>rgb.map(v=>{
   const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
  }).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const background=lum(parse(getComputedStyle(panel).backgroundColor));
  const heading=lum(parse(getComputedStyle(panel.querySelector("h3")).color));
  return (Math.max(background,heading)+.05)/(Math.min(background,heading)+.05);
 });
 expect(contrast,"Desktop discovery heading must be readable").toBeGreaterThan(7);
 await page.locator("#player-discover-close").focus();
 await page.keyboard.press("Tab");
 await expect(page.locator("#library-reload")).toBeFocused();
 await page.keyboard.press("Tab");
 await expect(page.locator("#library-search")).toBeFocused();
 await page.locator("#player-discover-close").click();
 await expect(page.locator("#player-discover")).toBeHidden();
});

test("desktop PR3: selected team details and report cards fit in two columns",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto("/#mannschaft",{waitUntil:"domcontentloaded"});
 // Synthetic presentation-only team selection, no source data is fabricated.
 const m=await page.evaluate(()=>{
  const d=document.getElementById("team-detail");d.hidden=false;
  const p=document.getElementById("view-mannschaft");
  const list=p.querySelector(".team-section").getBoundingClientRect();
  const detail=d.getBoundingClientRect();
  const overflow=document.documentElement.scrollWidth-innerWidth;
  d.hidden=true;
  return {listRight:list.right,detailLeft:detail.left,detailWidth:detail.width,overflow};
 });
 expect(m.detailLeft).toBeGreaterThanOrEqual(m.listRight+8);
 expect(m.detailWidth).toBeGreaterThan(300);
 expect(m.overflow).toBeLessThanOrEqual(2);
 await page.goto("/#berichte",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#report-list")).toBeAttached();
 const cols=await page.locator("#report-list").evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length);
 expect(cols).toBe(2);
});

test("desktop PR3: tablet/iPhone keep familiar stacked views and original nav",async({page})=>{
 test.setTimeout(120_000); // 25 route loads across five viewport sizes
 for(const width of [1024,768,440,390,320]){
  await page.setViewportSize({width,height:844});
  for(const route of ["start","spieler","mannschaft","berichte","einstellungen"]){
   await page.goto("/#"+route,{waitUntil:"domcontentloaded"});
   await expect(page.locator("#view-"+route)).toBeVisible();
   const m=await bounds(page);
   expect(m.pages).toBe(1);
   expect(m.navCount).toBe(1);
   expect(m.scroll-innerWidth,route+" mobile overflow at "+width).toBeLessThanOrEqual(2);
   if(width===320&&route==="spieler")await expect(page.locator("#player-add-open")).toBeVisible();
  }
 }
});
