import {test,expect} from "@playwright/test";
test("v154 desktop layout with the original data components",async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto("/#start");
 const layout=await page.evaluate(()=>{
  const nav=document.querySelector(".bottom-nav"),start=document.querySelector("#view-start");
  const nr=nav.getBoundingClientRect(),mr=document.querySelector("#hauptinhalt").getBoundingClientRect();
  return {nav:getComputedStyle(nav).flexDirection,display:getComputedStyle(start).display,
  navBeforeMain:nr.right<=mr.left+4,hasStats:!!document.querySelector("#match-stats"),
  hasTrophies:!!document.querySelector("#dashboard-kpis"),hasRankings:!!document.querySelector("#dashboard-rankings"),
  overflow:document.documentElement.scrollWidth-innerWidth};
 });
 expect(layout.nav).toBe("column");expect(layout.display).toBe("grid");
 expect(layout.navBeforeMain).toBe(true);
 expect(layout.hasStats&&layout.hasTrophies&&layout.hasRankings).toBe(true);
 expect(layout.overflow).toBeLessThanOrEqual(2);
});
test("v154 mobile remains stacked and uses bottom nav",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/#start");
 const r=await page.evaluate(()=>({nav:getComputedStyle(document.querySelector(".bottom-nav")).flexDirection,
 display:getComputedStyle(document.querySelector("#view-start")).display,
 overflow:document.documentElement.scrollWidth-innerWidth}));
 expect(r.nav).toBe("row");expect(r.display).toBe("block");expect(r.overflow).toBeLessThanOrEqual(2);
});
test("v154 desktop RTL sidebar",async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto("/#start");
 const r=await page.evaluate(()=>{document.documentElement.dir="rtl";
 const n=document.querySelector(".bottom-nav").getBoundingClientRect(),m=document.querySelector("#hauptinhalt").getBoundingClientRect();
 return {oppositeSide:n.left>=m.right-4,overflow:document.documentElement.scrollWidth-innerWidth}});
 expect(r.oppositeSide).toBe(true);expect(r.overflow).toBeLessThanOrEqual(2);
});
