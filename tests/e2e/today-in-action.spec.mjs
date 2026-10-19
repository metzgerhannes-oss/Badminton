import {test,expect} from "./invited-member.fixture.mjs";

const SOURCE="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupPage?championship=2026";
test("Today info shows ONLY kickoff and pairing; tap opens original nuLiga",async({page})=>{
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
 const card=home.locator(".today-match-row");
 await expect(card).toBeVisible({timeout:15000});
 await expect(card).toContainText("Anpfiff");
 await expect(card).toContainText("Synthetischer Verein 1 – Fiktive Gäste 1");
 await expect(card).toHaveAttribute("href",SOURCE);
 await expect(card).toHaveAttribute("target","_blank");
 // No badges, dates of provider verification, scores, controls or disclaimers.
 for(const word of ["Heute angesetzt","Aktualisieren","Originalquelle","Mannschaften",
  "Quelle geprüft","Spielt gerade","Nur belegte Ergebnisse"]){
  await expect(home).not.toContainText(word);
 }
 await expect(home.locator("button,small,h2,h3")).toHaveCount(0);
 await expect(home.locator(".today-match-row")).toHaveCount(1);
 await expect(page.locator("#live-nav-tab")).toBeVisible();
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const tour=page.locator("#today-tournament");
 await expect(tour.locator(".today-match-row")).toBeVisible();
 await expect(tour.locator(".today-match-row")).toContainText("Anpfiff");
 await expect(tour).not.toContainText("Quelle geprüft");
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.setViewportSize({width:1440,height:900});
 await expect(tour.locator(".today-match-row")).toBeVisible();
 await page.screenshot({path:"test-results/heute-kompakt-desktop.png",animations:"disabled"});
});
test("Today info is absent if no confirmed scheduled pairing is present",async({page})=>{
 await page.setViewportSize({width:320,height:667});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#today-home")).toBeHidden({timeout:15000});
 await expect(page.locator("#live-nav-tab")).toBeHidden();
});
test("Today info never invents an Anpfiff for a Badhub-only live player",async({page})=>{
 const now=Date.parse("2026-10-19T11:00:00.000Z"),id="05-070879";
 await page.clock.install({time:new Date(now)});
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Synthetisches Spielerprofil",club:"Testverein"}],
   friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
   historyProfilesInitialized:true
  }));
 });
 await page.route("**/rest/v1/player_live_snapshots?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   dbv_id:id,provider:"Badhub",source_url:"https://badhub.de/spieler/"+id+"/live",
   checked_at:new Date(now-30000).toISOString(),
   payload:{upcoming:[],past:[],entries:[],tournament:{name:"Synthetisches Turnier"},
    running:{court:"Feld 1",sets:[[21,19]]}}
  }])
 }));
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#live-nav-tab")).toBeVisible({timeout:15000});
 await expect(page.locator("#today-home")).toBeHidden();
 await page.clock.fastForward(93000);
 await expect(page.locator("#live-nav-tab")).toBeHidden();
 await expect(page.locator("#today-home")).toBeHidden();
});
