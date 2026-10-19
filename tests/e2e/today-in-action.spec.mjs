import {test,expect} from "./invited-member.fixture.mjs";

const SOURCE="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupPage?championship=2026";
test("Heute im Einsatz: source-backed scheduled team, never invented running state",async({page})=>{
 const now=new Date().toISOString();
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge-followed-teams-v1",JSON.stringify(["nuliga:10777:1"]));
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Synthetischer Spieler",club:"Testverein"}],
   friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
   historyProfilesInitialized:true
  }));
 });
 await page.route("**/rest/v1/league_teams?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   id:"nuliga:10777:2026-27:1",follow_key:"nuliga:10777:1",club_id:"10777",
   club_name:"Synthetischer Verein",team_label:"1",league_name:"Testliga",
   season:"2026/27",source_url:SOURCE,source_checked_at:now
  }])
 }));
 await page.route("**/rest/v1/league_clubs?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:"[]"
 }));
 await page.route("**/rest/v1/league_fixtures?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   id:"synthetic-fixture",team_id:"nuliga:10777:2026-27:1",match_date:now,
   home_team:"Synthetischer Verein 1",away_team:"Fiktive Gäste 1",
   status:"scheduled",home_score:null,away_score:null,
   source_url:SOURCE,source_checked_at:now
  }])
 }));
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 const home=page.locator("#today-home");
 await expect(home).toBeVisible();
 await expect(home).toContainText("Heute im Einsatz");
 await expect(home).toContainText("Heute angesetzt",{timeout:15000});
 await expect(home).not.toContainText("Mannschaftsspiel läuft");
 await expect(home.locator("a.today-entry-original")).toHaveAttribute("href",SOURCE);
 await page.locator("#today-home [data-today-refresh]").click();
 await expect(home).toContainText("Heute angesetzt");
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#today-tournament")).toBeVisible();
 await expect(page.locator("#today-tournament")).toContainText("Heute angesetzt");
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});
test("Heute im Einsatz: no evidence gives neutral state, no invented LIVE label",async({page})=>{
 await page.setViewportSize({width:320,height:667});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#today-home")).toBeVisible();
 await expect(page.locator("#today-home")).not.toContainText("Mannschaftsspiel läuft");
 await expect(page.locator("#today-home [data-today-status]")).toContainText(
  /keine bestätigten Einsätze|Quellen momentan nicht erreichbar|Ein Teil der Quellen/,
  {timeout:15000}
 );
});
