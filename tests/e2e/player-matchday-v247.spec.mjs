import {test,expect} from "./invited-member.fixture.mjs";

// No real DBV/Badhub or Supabase requests: all provider facts are synthetic.
const PLAYER="05-067866",EVENT="FCBE16EF-D5A9-493A-9935-B6FF78669F6C";
const INTERNAL="6baff258-0fb5-4a2a-9a0d-78f5eea47012";
const MATCH="bcf6d3be-1fde-4e61-a12d-392200ff216a";
const NOW=Date.parse("2026-11-07T08:10:00+01:00");
async function setup(page,{games=true}={}){
 await page.clock.setFixedTime(new Date(NOW));
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Eigenes Testprofil"}],
   friends:[{id:"05-067866",name:"Léona Plaisant",club:"SpVgg. Mössingen"}],
   activeProfileId:"05-070879",chosen:"05-070879",
   officialLinks:[],historyProfilesInitialized:true
  }));
 });
 await page.route("**/rest/v1/league_fixtures?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:"[]"
 }));
 await page.route("**/rest/v1/tournaments?*",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify(games?[{id:INTERNAL,name:"Südostdeutsche Meisterschaften U13–U19",
   source_url:"https://dbv.turnier.de/tournament/"+EVENT}]:[])
 }));
 await page.route("**/rest/v1/matches?*",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify(games?[{
   id:MATCH,tournament_id:INTERNAL,status:"called",court:"2",
   scheduled_at:"2026-11-07T08:55:00+01:00",
   source_url:"https://dbv.turnier.de/tournament/"+EVENT,
   last_synced_at:new Date(NOW-15000).toISOString(),
   events:{title:"ME U15"},match_participants:[
    {side:1,player_position:1,players:{dbv_id:PLAYER,name:"Synthetische Léona"}},
    {side:2,player_position:1,players:{dbv_id:"05-000001",name:"Synthetische Gegnerin"}}
   ],match_games:[]
  }]:[])
 }));
 await page.route("**/rest/v1/player_live_snapshots?*",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify(games?[{
   dbv_id:PLAYER,provider:"Badhub",
   source_url:"https://badhub.de/spieler/"+PLAYER+"/live",
   checked_at:new Date(NOW-15000).toISOString(),
   payload:{tournament:{name:"Synthetisches Badhub-Turnier"},
    entries:[],next:{queue_position:1},
    running:{id:"m1",class:"ME U15",court:"3",
     lineup:{opponents:[{name:"Badhub Testgegnerin"}]},sets:[[21,17]],is_team1:true},
    upcoming:[],past:[]}
  }]:[])
 }));
 await page.route("**/rest/v1/player_live_watches",route=>route.fulfill({
  status:201,contentType:"application/json",body:""
 }));
}
test("v247: source-backed player games appear directly below Turniertag with court and reported time",async({page})=>{
 await setup(page);
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const panel=page.locator("#today-tournament .today-match-row[data-kind='announced']");
 await expect(panel).toBeVisible({timeout:20000});
 await expect(panel).toContainText("Léona Plaisant");
 await expect(panel).toContainText("Einzelspiele · offizieller DBV-Import");
 await expect(panel).toContainText("Synthetische Gegnerin");
 await expect(panel).toContainText("Feld 2");
 await expect(panel).toContainText("Geplant 08:55 Uhr");
 await expect(panel).toContainText("Aufgerufen");
 await expect(panel).toContainText("Weitere Spieler-Spiele · Badhub");
 await expect(panel).toContainText("Badhub Testgegnerin");
 await expect(panel).toContainText("Sätze 21:17");
 await expect(panel).toContainText("Zuordnung zu diesem DBV-Turnier nicht bestätigt");
 await expect(panel).toHaveAttribute("href","https://dbv.turnier.de/tournament/"+EVENT);
 await expect(page.locator("#today-tournament .today-game-line")).toHaveCount(2);
 // An announcement alone is never the red verified-match shortcut.
 await expect(page.locator("#today-tournament .today-match-row[data-kind='announced'] .today-game-status").first()).toHaveText("Aufgerufen");
});
test("v247: absence of matches never invents a start time, court or result",async({page})=>{
 await setup(page,{games:false});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const panel=page.locator("#today-tournament .today-match-row[data-kind='announced']");
 await expect(panel).toBeVisible({timeout:20000});
 await expect(panel).toContainText("Noch keine belegten Einzelspiele");
 await expect(panel.locator(".today-game-line")).toHaveCount(0);
 await expect(panel).not.toContainText("Spielt gerade");
 await expect(panel).not.toContainText("Feld 2");
 await expect(panel).not.toContainText("08:55 Uhr");
});
