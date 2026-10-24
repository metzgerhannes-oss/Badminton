import {test,expect} from "./invited-member.fixture.mjs";
import {readFile} from "node:fs/promises";
const data=JSON.parse(await readFile("data/dbv-calendar.json","utf8"));
const sourceTotal=data.entries.length;
const entries2026=data.entries.filter(e=>e.start_date?.startsWith("2026"));
const bwArchive=JSON.parse(await readFile("data/bw-youth-calendar-archive.json","utf8"));
// The app merges six source-backed BW archive events with the 2026 snapshot.
// Four are intentionally displayed via the separately verified curated
// result cards, so they are not counted twice in the imported event grid.
const curatedArchiveKeys=new Set([
 "dbv-calendar-44014","dbv-calendar-44018","dbv-calendar-44019","dbv-calendar-44020"
]);
const unique2026=new Map([...entries2026,...bwArchive.entries.filter(e=>
 e.start_date?.startsWith("2026")&&!curatedArchiveKeys.has(e.source_key)
)].map(e=>[e.source_key,e]));
const expected2026=unique2026.size;
const countBW2026=[...unique2026.values()].filter(e=>e.bundesland==="Baden-Württemberg").length;
const own={players:[{id:"05-070879",name:"Testprofil"}],friends:[],officialLinks:[],
 activeProfileId:"05-070879",chosen:"05-070879",historyProfilesInitialized:true};
test.beforeEach(async ({page})=>{
 await page.addInitScript(value=>{if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify(value));},own);
 await page.route("**/*.supabase.co/**",route=>{
  const url=new URL(route.request().url());
  const rows=url.pathname.endsWith("/rpc/app_access_status")?{allowed:true,owner:false}:url.pathname.endsWith("/dbv_calendar_entries")?data.entries:[];
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(rows),
   headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
 });
});
test("Official calendar clusters by state, age and level without invented registrations",async ({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const results=page.locator("#dbv-calendar-results");
 // Compare with the complete 2026 fixture, not the date-dependent upcoming
 // subset (yesterday's tournaments leave that subset at local midnight).
 await page.locator("#dbv-calendar-period").selectOption("all");
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await expect(page.locator("#dbv-calendar-status")).toContainText(expected2026+" passende Turniere");
 await expect(results.locator(".dbv-calendar-entry").first()).toBeVisible();
 const filter=page.locator("#dbv-calendar-region");
 await filter.selectOption("Baden-Württemberg");
 await expect(page.locator("#dbv-calendar-status")).toContainText(countBW2026+" passende Turniere");
 await expect(results.locator(".dbv-calendar-cluster h4")).toHaveCount(1);
 await expect(results).not.toContainText("bestätigte Anmeldung");
 await filter.selectOption("all");
 await page.locator("#dbv-calendar-age").selectOption("U11");
 await expect(page.locator("#dbv-calendar-status")).toContainText("passende Turniere");
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

test("German Masters U11 stays visible in Baden-Württemberg U11 A filter",async({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U11");
 await page.locator("#dbv-calendar-level").selectOption("A");
 await page.locator("#dbv-calendar-q").fill("German Masters");
 const results=page.locator("#dbv-calendar-results");
 await expect(results.locator(".dbv-calendar-entry")).toHaveCount(1);
 await expect(results).toContainText("German Masters U11");
 await expect(results).toContainText("DBV · bundesweit");
 await expect(results).toContainText("Hofheim");
 await expect(results).toContainText("10.11.2026");
 await expect(page.locator("#dbv-calendar-status")).toContainText("inkl. German Masters U11");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await expect(results).not.toContainText("German Masters U11");
 await page.locator("#dbv-calendar-level").selectOption("A");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await expect(results).not.toContainText("German Masters U11");
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

test("v148: BW U13 C presents real 2026 tournament results instead of source explanation boxes",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await page.locator("#dbv-calendar-period").selectOption("all");
 await expect(page.locator("#dbv-calendar-status")).toContainText("4 passende Turniere");
 const cards=page.locator("#dbv-calendar-results .dbv-calendar-external-result");
 await expect(cards).toHaveCount(3);
 await expect(cards.nth(0)).toContainText("Reutlingen");
 await expect(cards.nth(1)).toContainText("Friedrichshafen");
 await expect(cards.nth(2)).toContainText("Mössingen");
 await expect(cards.nth(0).locator('a[href*="dbv.turnier.de/tournament/"]')).toHaveAttribute("href",/dbv\.turnier\.de\/tournament/);
 await expect(cards.nth(0).locator('a[href*="bwbv.de/2026/02/02/"]')).toBeVisible();
 await expect(cards.nth(2).locator("a")).toHaveAttribute("href",/DBB7AC20/i);
 await expect(page.locator(".dbv-calendar-archive,.dbv-calendar-framework,.dbv-calendar-no-results")).toHaveCount(0);
 await expect(page.locator("#dbv-calendar-results [data-calendar-toggle]")).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test("v148: BW U13 historic A/B/C results distinguish Hexen-Cup A from C",async({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-period").selectOption("all");
 for(const [level,count,curated,venues] of [
  ["C",4,3,["Reutlingen","Friedrichshafen","Mössingen"]],
  ["A",2,2,["Eggenstein","Konstanz"]],
  ["B",1,1,["Waghäusel"]]
 ]){
  await page.locator("#dbv-calendar-level").selectOption(level);
  await expect(page.locator(".dbv-calendar-external-result")).toHaveCount(curated);
  const list=await page.locator(".dbv-calendar-external-result").allTextContents();
  for(const venue of venues)expect(list.join(" ")).toContain(venue);
  await expect(page.locator("#dbv-calendar-status")).toContainText(count+" passende Turniere");
 }
 await page.locator("#dbv-calendar-level").selectOption("all");
 await expect(page.locator(".dbv-calendar-external-result")).toHaveCount(6);
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry")).toHaveCount(17);
});

test("v148: upcoming period has direct one-click access to past results",async({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await page.locator("#dbv-calendar-period").selectOption("upcoming");
 await expect(page.locator(".dbv-calendar-external-result")).toHaveCount(0);
 await page.locator("[data-calendar-show-history]").click();
 await expect(page.locator("#dbv-calendar-period")).toHaveValue("all");
 await expect(page.locator(".dbv-calendar-external-result")).toHaveCount(3);
});

test("v148: BWBV 2027 A/B/C announced dates are compact sourced cards, never fake registrations",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2027");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 for(const [level,count,source] of [["A",2,"badminton.de"],["B",1,"bwbv.de"],["C",4,"bwbv.de"]]){
  await page.locator("#dbv-calendar-level").selectOption(level);
  await expect(page.locator("#dbv-calendar-status")).toContainText(count+" passende Turniere");
  await expect(page.locator(".dbv-calendar-external-plan")).toHaveCount(count);
  await expect(page.locator(".dbv-calendar-external-plan a").first()).toHaveAttribute("href",new RegExp(source.replace(".","\\.")));
  await expect(page.locator(".dbv-calendar-external-plan [data-calendar-toggle]")).toHaveCount(0);
 }
 await page.locator("#dbv-calendar-level").selectOption("all");
 await expect(page.locator(".dbv-calendar-external-plan")).toHaveCount(7);
 await expect(page.locator("#dbv-calendar-results")).toContainText("Eggenstein");
 await expect(page.locator("#dbv-calendar-results")).toContainText("U13 noch offen");
 await expect(page.locator(".dbv-calendar-framework,.dbv-calendar-archive")).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test("v148: BW U13 2026 with other DBV results preserves calendar cards and quick switch to 2027",async({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("all");
 await expect(page.locator(".dbv-calendar-external-result")).toHaveCount(0);
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry")).toHaveCount(10);
 await page.locator("[data-calendar-show-2027]").click();
 await expect(page.locator("#dbv-calendar-year")).toHaveValue("2027");
 await expect(page.locator(".dbv-calendar-external-plan")).toHaveCount(7);
});

test("2027 year selection still shows published DBV source-backed tournaments elsewhere",async({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2027");
 const n=data.entries.filter(e=>e.start_date?.startsWith("2027")).length;
 await expect(page.locator("#dbv-calendar-status")).toContainText(n+" passende Turniere");
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry").first()).toBeVisible();
});


test("v148: BW U13 C 2026 puts 2027 jump ahead of sourced historical results",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await page.locator("#dbv-calendar-period").selectOption("all");
 const results=page.locator("#dbv-calendar-results");
 await expect(results.locator(".dbv-calendar-external-result")).toHaveCount(3);
 await expect(results.locator("[data-calendar-show-2027]")).toBeVisible();
 const order=await results.evaluate(el=>[...el.children].map(node=>node.className));
 expect(order[0]).toContain("dbv-calendar-year-jump");
 await results.locator("[data-calendar-show-2027]").click();
 await expect(page.locator("#dbv-calendar-year")).toHaveValue("2027");
 await expect(results.locator(".dbv-calendar-external-plan")).toHaveCount(4);
});

test("v148: BW U13 C 2026 zero upcoming puts 2027 jump before no-results",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await page.locator("#dbv-calendar-period").selectOption("upcoming");
 const results=page.locator("#dbv-calendar-results");
 await expect(results.locator("[data-calendar-show-2027]")).toBeVisible();
 await expect(results.locator(".dbv-calendar-no-results")).toBeVisible();
 expect(await results.evaluate(el=>el.firstElementChild?.classList.contains("dbv-calendar-year-jump"))).toBe(true);
 await results.locator("[data-calendar-show-2027]").click();
 await expect(page.locator("#dbv-calendar-year")).toHaveValue("2027");
 await expect(results.locator(".dbv-calendar-external-plan")).toHaveCount(4);
});

test("v150: BW U11/U13/U15/U17/U19 C histories are source-backed and age-filtered",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await page.locator("#dbv-calendar-period").selectOption("all");
 for(const [age,curated,total,hexen] of [["U11",3,4,false],["U13",3,4,false],["U15",4,5,true],["U17",4,6,true],["U19",4,5,true]]){
  await page.locator("#dbv-calendar-age").selectOption(age);
  const results=page.locator("#dbv-calendar-results");
  await expect(results.locator(".dbv-calendar-external-result")).toHaveCount(curated);
  await expect(page.locator("#dbv-calendar-status")).toContainText(total+" passende Turniere");
  await expect(results).toContainText("Reutlingen");
  await expect(results).toContainText("Friedrichshafen");
  await expect(results).toContainText("Mössingen");
  if(hexen)await expect(results).toContainText("C-RLT U15/U17/U19");
  else await expect(results).not.toContainText("C-RLT U15/U17/U19");
  await expect(results.locator(".dbv-calendar-external-result [data-calendar-toggle]")).toHaveCount(0);
 }
 await page.locator("#dbv-calendar-age").selectOption("U9");
 await expect(page.locator(".dbv-calendar-external-result")).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test("v150: BW youth A/B/C 2027 remains age-correct for U11 through U19",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2027");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 for(const [age,counts] of [
  ["U11",{A:2,B:0,C:2}],["U13",{A:2,B:1,C:4}],
  ["U15",{A:0,B:1,C:4}],["U17",{A:0,B:1,C:4}],["U19",{A:0,B:1,C:4}]
 ]){
  await page.locator("#dbv-calendar-age").selectOption(age);
  for(const [level,count] of Object.entries(counts)){
   await page.locator("#dbv-calendar-level").selectOption(level);
   await expect(page.locator(".dbv-calendar-external-plan")).toHaveCount(count);
   if(count)await expect(page.locator(".dbv-calendar-external-plan [data-calendar-toggle]")).toHaveCount(0);
  }
 }
 await page.locator("#dbv-calendar-age").selectOption("U9");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await expect(page.locator(".dbv-calendar-external-plan")).toHaveCount(0);
});

test("v150: U17 2026 C missing imported events suggests past verified events and 2027 framework",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U17");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await page.locator("#dbv-calendar-period").selectOption("upcoming");
 const results=page.locator("#dbv-calendar-results");
 await expect(results.locator("[data-calendar-show-2027]")).toBeVisible();
 await expect(results.locator("[data-calendar-show-history]")).toBeVisible();
 await results.locator("[data-calendar-show-history]").click();
 await expect(results.locator(".dbv-calendar-external-result")).toHaveCount(4);
 await expect(page.locator("#dbv-calendar-status")).toContainText("6 passende Turniere");
 await expect(results.locator("[data-calendar-show-2027]")).toBeVisible();
 await results.locator("[data-calendar-show-2027]").click();
 await expect(page.locator("#dbv-calendar-year")).toHaveValue("2027");
 await expect(results.locator(".dbv-calendar-external-plan")).toHaveCount(4);
});


test("v150: real source archive adds historical U13/C records and removes duplicate curated cards",async({page})=>{
 const raw={
  source_key:"dbv-calendar-999991",title:"SYNTHETISCHER TEST-C-RLT U13",start_date:"2026-06-06",
  end_date:"2026-06-07",location_text:"Waiblingen",organizer:"Baden-Württemberg",
  bundesland:"Baden-Württemberg",region_scope:"state",category:"C1-Level",
  level_group:"C",age_groups:["U13"],disciplines:["Einzel"],registration_deadline:null,
  event_url:null,source_url:"https://turniere.badminton.de/"
 };
 const copy={...raw,source_key:"dbv-calendar-999992",start_date:"2026-01-17",
  end_date:"2026-01-18",location_text:"Reutlingen",title:"1. C-RLT BAW U11-U19",
  age_groups:["U11","U13","U15","U17","U19"]};
 await page.route("**/data/bw-youth-calendar-archive.json",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify({
   schemaVersion:1,scope:"historical-bw-youth-abc",source:"https://turniere.badminton.de/",
   year:2026,years:[2026],entries:[raw,copy]
  })
 }));
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await page.locator("#dbv-calendar-period").selectOption("all");
 await expect(page.locator("#dbv-calendar-status")).toContainText("4 passende Turniere");
 await expect(page.locator(".dbv-calendar-external-result")).toHaveCount(3);
 await expect(page.locator("#dbv-calendar-results")).toContainText("Waiblingen");
 await expect(page.locator("#dbv-calendar-results")).toContainText("SYNTHETISCHER TEST");
 await expect(page.locator("#dbv-calendar-results")).not.toContainText("dbv-calendar-999992");
 await expect(page.locator("#dbv-calendar-results .dbv-calendar-entry")).toHaveCount(4);
 await expect(page.locator(".dbv-calendar-entry--history .dbv-calendar-save")).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test("v151: verified BWBV plan includes Lörrach A and excludes U11 from second C",async({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2027");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("A");
 await expect(page.locator(".dbv-calendar-external-plan")).toHaveCount(2);
 await expect(page.locator("#dbv-calendar-results")).toContainText("Lörrach-Brombach");
 await expect(page.locator("#dbv-calendar-results")).toContainText("Eggenstein");
 await page.locator("#dbv-calendar-age").selectOption("U11");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await expect(page.locator(".dbv-calendar-external-plan")).toHaveCount(2);
 await expect(page.locator("#dbv-calendar-results")).not.toContainText("2. BWBV/C-RLT");
});


test("v151: iPhone reads fresh official BWBV source file, not only fallback cards",async({page})=>{
 const snapshot=JSON.parse(await readFile("data/bwbv-youth-framework-2027.json","utf8"));
 const live={...snapshot,entries:snapshot.entries.map(x=>
  x.key==="dbv-bw-a-2027-2"?{...x,title:"2. A-RLT U11/U13 · Livequelle Lörrach"}:x)};
 await page.route("**/data/bwbv-youth-framework-2027.json",route=>
  route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(live)}));
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2027");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("A");
 await expect(page.locator(".dbv-calendar-external-plan")).toHaveCount(2);
 await expect(page.locator("#dbv-calendar-results")).toContainText("Livequelle Lörrach");
 await expect(page.locator("#dbv-calendar-results")).not.toContainText("BC Lörrach-Brombach");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});


test("F06: 2027 C planning + persists locally with honest unknown venue",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2027");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("C");
 const first=page.locator(".dbv-calendar-external-plan").first();
 await expect(first.locator(".dbv-calendar-place")).toHaveText("Austragungsort noch nicht veröffentlicht");
 await first.locator("[data-framework-toggle]").click();
 await expect(first.locator("[data-framework-toggle]")).toHaveAttribute("aria-pressed","true");
 await expect(page.locator("#official-tournament-list")).toContainText("Rahmentermin · Anmeldung nicht bestätigt");
 await expect(page.locator("#official-tournament-list")).toContainText("Austragungsort noch nicht veröffentlicht");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).officialLinks);
 expect(saved.filter(t=>t.source==="bwbv-framework")).toHaveLength(1);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator(".dbv-calendar-external-plan").first().locator("[data-framework-toggle]")).toHaveAttribute("aria-pressed","true");
 await page.locator(".dbv-calendar-external-plan").first().locator("[data-framework-toggle]").click();
 await expect(page.locator("#official-tournament-list")).not.toContainText("Rahmentermin · Anmeldung nicht bestätigt");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
});

test("F06: verified 2026 Reutlingen C tournament + preserves exact source and place",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await page.locator("#dbv-calendar-year").selectOption("2026");
 await page.locator("#dbv-calendar-region").selectOption("Baden-Württemberg");
 await page.locator("#dbv-calendar-age").selectOption("U13");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await page.locator("#dbv-calendar-period").selectOption("all");
 const first=page.locator(".dbv-calendar-external-result").first();
 await expect(first).toContainText("1. C-RLT BAW Einzel/Doppel U11–U19");
 await expect(first.locator(".dbv-calendar-place")).toHaveText("Austragungsort: Reutlingen");
 await expect(first.locator('a[href*="dbv.turnier.de/tournament/"]')).toBeVisible();
 await first.locator("[data-official-toggle]").click();
 await expect(first.locator("[data-official-toggle]")).toHaveAttribute("aria-pressed","true");
 await expect(page.locator("#official-tournament-list")).toContainText("Austragungsort: Reutlingen");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).officialLinks);
 expect(saved.filter(t=>t.id==="52B3B803-279B-48CF-8143-F5078F5236DB")).toHaveLength(1);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator(".dbv-calendar-external-result").first().locator("[data-official-toggle]")).toHaveAttribute("aria-pressed","true");
 await page.locator(".dbv-calendar-external-result").first().locator("[data-official-toggle]").click();
 await expect(page.locator("#official-tournament-list")).not.toContainText("Austragungsort: Reutlingen");
});


test("F06: Home tournament cards route internally on phone and desktop; external calendar stays official",async({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>{
  const state=JSON.parse(localStorage.getItem("shuttleboard-v1"));
  state.officialLinks=[{id:"11111111-2222-4333-8444-555555555555",
   url:"https://dbv.turnier.de/tournament/11111111-2222-4333-8444-555555555555",
   name:"Synthetisches Zukunftsturnier",playerId:"05-070879",
   startDate:"2027-01-16",endDate:"2027-01-17",place:"Testhalle"}];
  localStorage.setItem("shuttleboard-v1",JSON.stringify(state));
 });
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:844});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await page.reload({waitUntil:"domcontentloaded"});
  const row=page.locator(".upcoming-tournament-row").first();
  await expect(row).toHaveAttribute("href","#turniere");
  await expect(row).toContainText("Austragungsort: Testhalle");
  await row.click();
  await expect(page).toHaveURL(/#turniere$/);
  await expect(page.locator("#official-tournament-list")).toContainText("Synthetisches Zukunftsturnier");
  await expect(page.locator('#official-tournament-list a[href*="dbv.turnier.de/tournament/"]')).toBeVisible();
  await expect(page.locator(".live-hub-official-link")).toHaveAttribute("href","https://turniere.badminton.de/");
 }
});
