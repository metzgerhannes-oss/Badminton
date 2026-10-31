import {test,expect} from "./invited-member.fixture.mjs";

const SOURCE="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupPage?championship=2026";
test("Today separates a scheduled team match from live scores and rejects schedule-page links",async({page})=>{
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
 await expect(card).not.toHaveAttribute("href",/.+/);
 await expect(card).toHaveAttribute("aria-label",/Noch kein offizieller Spielbericht veröffentlicht/);
 await expect(home.locator("a.today-match-row")).toHaveCount(0);
 await expect(card).toHaveAttribute("data-entity","team");
 await expect(card.locator(".today-match-entity")).toHaveText("Synthetischer Verein 1");
 await expect(card.locator(".today-match-status")).toHaveText("Heute angesetzt");
 await expect(card.locator(".today-match-row-score")).toHaveCount(0);
 // An appointment is never represented as a currently running match.
 for(const word of ["Aktualisieren","Originalquelle","Quelle geprüft",
  "Spielt gerade","Nur belegte Ergebnisse"]){
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
test("Direct official nuLiga match report opens once it is published",async({page})=>{
 const now=new Date().toISOString();
 const REPORT="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupMeetingReport?meeting=384845&championship=SW+26%2F27&group=40175";
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge-followed-teams-v1",JSON.stringify(["nuliga:10777:1"]));
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Synthetisches Profil",club:"Testverein"}],
   friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
   historyProfilesInitialized:true
  }));
 });
 await page.route("**/rest/v1/league_teams?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   id:"nuliga:10777:2026-27:1",follow_key:"nuliga:10777:1",
   club_id:"10777",club_name:"Synthetischer Verein",team_label:"1",
   season:"2026/27",source_url:SOURCE,source_checked_at:now
  }])
 }));
 // Real team-directory reads BOTH team and club rows. The isolated QA network
 // intentionally blocks unmocked Supabase calls, so mock both endpoints.
 await page.route("**/rest/v1/league_clubs?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:"[]"
 }));
 await page.route("**/rest/v1/league_fixtures?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   id:"synthetic-report",team_id:"nuliga:10777:2026-27:1",match_date:now,
   home_team:"Synthetischer Verein 1",away_team:"Fiktive Gäste 1",
   status:"finished",home_score:5,away_score:3,source_url:REPORT,source_checked_at:now
  }])
 }));
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 const report=page.locator("#today-home a.today-match-row");
 await expect(report).toBeVisible({timeout:15000});
 await expect(report).toHaveAttribute("href",REPORT);
 await expect(report).toHaveAttribute("target","_blank");
 await expect(report).toContainText("Anpfiff");
 // A kickoff like 15:37 contains the substring 5:3; compare the exact visible fields instead.
 await expect(report.locator(".today-match-kickoff")).toHaveText(/^Anpfiff (?:[01]?\d|2[0-3]):[0-5]\d Uhr$/);
 await expect(report.locator(".today-match-pairing")).toHaveText("Synthetischer Verein 1 – Fiktive Gäste 1");
 await expect(report.locator(".today-match-status")).toHaveText("Ergebnis veröffentlicht");
 await expect(report.locator(".today-match-row-score")).toHaveText("Ergebnis 5:3");
 await expect(report.locator(".match-score, .team-score")).toHaveCount(0);
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
 const playerCard=page.locator("#today-home .today-match-row[data-entity='player']");
 await expect(playerCard).toBeVisible();
 await expect(playerCard.locator(".today-match-status")).toHaveText("Spielt gerade");
 await expect(playerCard.locator(".today-match-pairing")).toHaveText("Synthetisches Spielerprofil");
 await expect(playerCard.locator(".today-match-kickoff")).toHaveCount(0);
 await expect(playerCard.locator(".today-match-row-score")).toHaveCount(0);
 await expect(playerCard).not.toContainText("Anpfiff");
 await expect(playerCard).toHaveAttribute("href","https://badhub.de/spieler/"+id+"/live");
 // A suspended tab must drop the expired provider claim without a fresh fetch.
 await page.clock.fastForward(93000);
 await expect(page.locator("#live-nav-tab")).toBeHidden();
 await expect(page.locator("#today-home")).toBeHidden();
});


test("Today Home shows verified players before fixtures and all items on Turniertag",async({page})=>{
 const now=Date.parse("2026-10-19T11:00:00.000Z");
 await page.clock.install({time:new Date(now)});
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge-followed-teams-v1",JSON.stringify(["nuliga:10777:1"]));
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Synthetische Spielerin",club:"Testverein"}],
   friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
   historyProfilesInitialized:true
  }));
 });
 await page.route("**/rest/v1/league_teams?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   id:"nuliga:10777:2026-27:1",follow_key:"nuliga:10777:1",club_id:"10777",
   club_name:"Synthetischer Verein",team_label:"1",season:"2026/27",
   source_url:SOURCE,source_checked_at:new Date(now).toISOString()
  }])
 }));
 await page.route("**/rest/v1/league_clubs?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:"[]"
 }));
 await page.route("**/rest/v1/league_fixtures?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   id:"synthetic-game",team_id:"nuliga:10777:2026-27:1",
   match_date:new Date(now+3600000).toISOString(),
   home_team:"Synthetischer Verein 1",away_team:"Fiktive Gäste 1",
   status:"scheduled",home_score:null,away_score:null,
   source_url:SOURCE,source_checked_at:new Date(now).toISOString()
  }])
 }));
 await page.route("**/rest/v1/player_live_snapshots?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   dbv_id:"05-070879",provider:"Badhub",
   source_url:"https://badhub.de/spieler/05-070879/live",
   checked_at:new Date(now-15000).toISOString(),
   payload:{upcoming:[],past:[],entries:[],tournament:{name:"Synthetisches Turnier"},
    running:{court:"Feld 1",sets:[[21,19]]}}
  }])
 }));
 await page.setViewportSize({width:320,height:700});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 const home=page.locator("#today-home");
 await expect(home.locator(".today-match-row")).toHaveCount(2,{timeout:15000});
 await expect(home.locator(".today-match-row").first()).toHaveAttribute("data-entity","player");
 await expect(home.locator(".today-match-row").nth(1)).toHaveAttribute("data-entity","team");
 await expect(home.locator(".today-match-row[data-entity='player'] .today-match-status")).toHaveText("Spielt gerade");
 await expect(home.locator(".today-match-row[data-entity='team'] .today-match-status")).toHaveText("Heute angesetzt");
 await expect(home.locator(".today-match-row[data-entity='player'] .today-match-kickoff")).toHaveCount(0);
 await expect(home.locator("a.today-match-row[data-entity='team']")).toHaveCount(0);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#today-tournament .today-match-row")).toHaveCount(2);
});
