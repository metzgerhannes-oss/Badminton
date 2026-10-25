import {test,expect} from "./invited-member.fixture.mjs";

// Only offline/synthetic profiles and tournament URLs. Browser fixture blocks Supabase.
const own={id:"99-900010",name:"Eigenes Testprofil"};
const saved={id:"11111111-2222-4333-8444-555555555555",
 url:"https://dbv.turnier.de/tournament/11111111-2222-4333-8444-555555555555",
 name:"Synthetisches Turnier",playerId:own.id,startDate:"2027-02-06",endDate:"2027-02-07",
 place:"Synthetische Turnhalle"};
async function seed(page){
 await page.addInitScript(({own,saved})=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[own],friends:[],officialLinks:[saved],activeProfileId:own.id,
  chosen:own.id,historyProfilesInitialized:true
 })),{own,saved});
}
for(const width of [320,390,1280]){
 test("v214 "+width+"px: tap saved tournament heading opens its own target",async({page})=>{
  await seed(page);
  await page.setViewportSize({width,height:844});
  await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
  const card=page.locator("#official-tournament-list .tournament-card").first();
  await expect(card).toContainText(saved.name);
  await expect(card).toBeVisible();
  const link=card.locator("a.card-open-primary");
  await expect(link).toHaveAttribute("href",saved.url);
  // WebKit can finish stylesheet calculation after DOMContentLoaded; assert the actual interactive hit-layer once ready.
  await expect.poll(()=>link.evaluate(el=>getComputedStyle(el,"::after").position)).toBe("absolute");
  await expect.poll(()=>link.evaluate(el=>getComputedStyle(el,"::after").inset)).toBe("0px");
  // Repoint to a local route so this click never fetches real tournament sources.
  await link.evaluate(el=>{el.href="#spieler";el.removeAttribute("target")});
  const title=await card.locator("h3").boundingBox();
  await page.mouse.click(title.x+title.width/2,title.y+title.height/2);
  await expect(page).toHaveURL(/#spieler$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
test("v214: Remove button does not trigger entire tournament card target",async({page})=>{
 await seed(page);
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const card=page.locator("#official-tournament-list .tournament-card").first();
 await expect(card).toContainText(saved.name);
 await card.locator("a.card-open-primary").evaluate(a=>{a.href="#spieler";a.removeAttribute("target")});
 await card.locator("[data-remove-id]").click();
 await expect(page).toHaveURL(/#turniere$/);
 await expect(page.locator("#official-tournament-list")).not.toContainText(saved.name);
});
test("v214: card and nested secondary button each activate only their own action",async({page})=>{
 await seed(page);
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>{
  // Isolate this click contract from subsequent asynchronous tournament list re-renders.
  // Keep the synthetic surface within .app, so the production CSS rules still apply.
  const host=document.querySelector(".app");
  host.insertAdjacentHTML("beforeend",
   '<article class="card-open-surface" id="synthetic-card" style="position:fixed;top:84px;left:16px;z-index:9999;width:260px;padding:14px;background:white"><h3>Details öffnen</h3>'+
   '<button class="card-open-primary" type="button" id="card-main">Details</button>'+
   '<button type="button" id="card-save">+ Merken</button></article>';
  window.__cardCounts={primary:0,secondary:0};
  document.querySelector("#card-main").onclick=()=>window.__cardCounts.primary++;
  document.querySelector("#card-save").onclick=()=>window.__cardCounts.secondary++;
 });
 await expect(page.locator("#synthetic-card")).toBeVisible();
 await expect.poll(()=>page.locator("#card-main").evaluate(el=>getComputedStyle(el,"::after").position)).toBe("absolute");
 const bounds=await page.locator("#synthetic-card h3").boundingBox();
 expect(bounds).toBeTruthy();
 await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
 expect(await page.evaluate(()=>window.__cardCounts)).toEqual({primary:1,secondary:0});
 await page.locator("#card-save").click();
 expect(await page.evaluate(()=>window.__cardCounts)).toEqual({primary:1,secondary:1});
 await page.locator("#card-main").focus();
 await page.keyboard.press("Enter");
 expect(await page.evaluate(()=>window.__cardCounts)).toEqual({primary:2,secondary:1});
});
