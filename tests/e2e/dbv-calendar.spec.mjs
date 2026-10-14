import {test,expect} from "./invited-member.fixture.mjs";
import {readFile} from "node:fs/promises";
const data=JSON.parse(await readFile("data/dbv-calendar.json","utf8"));
const sourceTotal=data.entries.length;
const entries2026=data.entries.filter(e=>e.start_date?.startsWith("2026"));
const countBW2026=entries2026.filter(e=>e.bundesland==="Baden-Württemberg").length;
const own={players:[{id:"05-070879",name:"Testprofil"}],friends:[],officialLinks:[],
 activeProfileId:"05-070879",chosen:"05-070879",historyProfilesInitialized:true};
test.beforeEach(async ({page})=>{
 await page.addInitScript(value=>{if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify(value));},own);
 await page.route("**/*.supabase.co/**",route=>{
  const url=new URL(route.request().url());
  const rows=url.pathname.endsWith("/rpc/app_access_status")?{allowed:true,owner:false}:url.pathname.endsWith("/dbv_calendar_entries")?data.entries:[];
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(rows),
   headers:{"Access-Control-Allow-Origin":"*"}});
 });
});
test("Official calendar clusters by state, age and level without invented registrations",async ({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const results=page.locator("#dbv-calendar-results");
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await expect(page.locator("#dbv-calendar-status")).toContainText(entries2026.length+" von "+sourceTotal);
 await expect(results.locator(".dbv-calendar-entry").first()).toBeVisible();
 const filter=page.locator("#dbv-calendar-region");
 await filter.selectOption("Baden-Württemberg");
 await expect(page.locator("#dbv-calendar-status")).toContainText(countBW2026+" von "+sourceTotal);
 await expect(results.locator(".dbv-calendar-cluster h4")).toHaveCount(1);
 await expect(results).not.toContainText("bestätigte Anmeldung");
 await filter.selectOption("all");
 await page.locator("#dbv-calendar-age").selectOption("U11");
 await expect(page.locator("#dbv-calendar-status")).toContainText("von "+sourceTotal);
 await expect(results.locator(".dbv-calendar-entry").first()).toBeVisible();
 await page.locator("#dbv-calendar-age").selectOption("all");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await expect(results.locator(".dbv-calendar-entry").first()).toContainText("C");
 await page.locator("#dbv-calendar-level").selectOption("all");
 await page.locator("#dbv-calendar-group").selectOption("level");
 await expect(results.locator(".dbv-calendar-cluster h4").first()).toBeVisible();
 const rect=await page.locator(".dbv-calendar-panel").boundingBox();
 expect(rect.x).toBeGreaterThanOrEqual(0);
 expect(rect.x+rect.width).toBeLessThanOrEqual(322);
 await expect(page.locator('.dbv-calendar-entry a[href="https://turniere.badminton.de/"]').first()).toBeVisible();
});

test("Plus saves the official calendar date for the own profile and check removes it on tap",async ({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const first=page.locator("#dbv-calendar-results .dbv-calendar-entry").first();
 await expect(first).toBeVisible();
 const label=await first.locator("h5").textContent();
 const toggle=first.locator("[data-calendar-toggle]");
 await expect(toggle).toHaveText("+");
 await expect(toggle).toHaveAttribute("aria-pressed","false");
 await toggle.click();
 await expect(first.locator("[data-calendar-toggle]")).toHaveText("✓");
 await expect(first.locator("[data-calendar-toggle]")).toHaveAttribute("aria-pressed","true");
 await expect(page.locator("#official-tournament-list")).toContainText(label);
 await expect(page.locator("#official-tournament-list")).toContainText("Anmeldung nicht bestätigt");
 await expect(page.locator("#official-tournament-list [data-edit-id]")).toHaveCount(0,
  "Calendar sources without a verified DBV tournament UUID cannot use the manual edit form");
 const own=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}"));
 expect(own.officialLinks.some(t=>t.id.startsWith("dbv-calendar-")&&t.playerId==="05-070879")).toBe(true);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#official-tournament-list")).toContainText(label);
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry").first().locator("[data-calendar-toggle]")).toHaveAttribute("aria-pressed","true");
 await page.locator("#dbv-calendar-results .dbv-calendar-entry").first().locator("[data-calendar-toggle]").click();
 await expect(page.locator("#official-tournament-list")).not.toContainText(label);
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry").first().locator("[data-calendar-toggle]")).toHaveText("+");
});
test("Calendar plans stay private to the active player",async ({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>{
  const value=JSON.parse(localStorage.getItem("shuttleboard-v1"));
  value.players.push({id:"05-071969",name:"Zweites Spielerprofil"});
  localStorage.setItem("shuttleboard-v1",JSON.stringify(value));
 });
 await page.reload({waitUntil:"domcontentloaded"});
 const first=page.locator("#dbv-calendar-results .dbv-calendar-entry").first();
 await expect(first).toBeVisible();
 await first.locator("[data-calendar-toggle]").click();
 await page.evaluate(()=>window.badmintonSelectViewer("05-071969",{stayOnPage:true}));
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry").first().locator("[data-calendar-toggle]")).toHaveAttribute("aria-pressed","false");
 await expect(page.locator("#official-tournament-list")).not.toContainText("Vorgemerkt · Anmeldung nicht bestätigt");
 await page.locator("#dbv-calendar-results .dbv-calendar-entry").first().locator("[data-calendar-toggle]").click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).officialLinks.filter(t=>t.source==="dbv-calendar"));
 expect(saved).toHaveLength(2);
 expect(new Set(saved.map(t=>t.playerId)).size).toBe(2);
});

test("BW U13 C empty result explains source coverage and provides available D/E level buttons",async ({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#dbv-calendar-status")).toContainText("offiziellen Kalendereinträgen");
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await expect(page.locator("#dbv-calendar-status")).toContainText("0 von "+sourceTotal);
 await expect(page.locator(".dbv-calendar-no-results")).toContainText("Keine passenden Turniere");
 await expect(page.locator(".dbv-calendar-no-results")).toContainText("nicht automatisch alle Turniere");
 await expect(page.locator('[data-calendar-alternative-level="D"]')).toHaveText("Level D (4)");
 await expect(page.locator('[data-calendar-alternative-level="E"]')).toHaveText("Level E (6)");
 await page.locator('[data-calendar-alternative-level="D"]').click();
 await expect(page.locator("#dbv-calendar-level")).toHaveValue("D");
 await expect(page.locator("#dbv-calendar-status")).toContainText("4 von "+sourceTotal);
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry")).toHaveCount(4);
});

test("2027 year selection shows official source-backed future tournaments",async ({page})=>{
 test.skip(!data.entries.some(e=>e.start_date?.startsWith("2027")),"2027 data are published after this PR is merged");
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2027");
 const count=data.entries.filter(e=>e.start_date?.startsWith("2027")).length;
 await expect(page.locator("#dbv-calendar-status")).toContainText(count+" von "+sourceTotal);
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry").first()).toBeVisible();
 await expect(page.locator("#dbv-calendar-year")).toHaveValue("2027");
});
