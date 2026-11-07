import {test,expect} from "./invited-member.fixture.mjs";
import {VERIFIED_PLAYER_EVENTS} from "../../scripts/verified-player-events.mjs";

// No real DBV/Badhub or Supabase requests: all provider facts are synthetic.
// Use the same official UUID as the verified announcement from the checked-out
// merge commit; a concurrent correction of the DBV source must not silently
// invalidate this synthetic matched-event test.
const PLAYER="05-067866";
const VERIFIED_EVENT=VERIFIED_PLAYER_EVENTS.find(e=>e.playerId===PLAYER && e.startDate==="2026-11-07");
if(!VERIFIED_EVENT)throw new Error("Verified tournament announcement missing for fixture");
const EVENT=VERIFIED_EVENT.tournamentId;
const INTERNAL="6baff258-0fb5-4a2a-9a0d-78f5eea47012";
const MATCH="bcf6d3be-1fde-4e61-a12d-392200ff216a";
const NOW=Date.parse("2026-11-07T08:10:00+01:00");
async function setup(page,{games=true,matchReadFails=false}={}){
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
  status:matchReadFails?503:200,contentType:"application/json",
  body:JSON.stringify(games?[{
   id:MATCH,tournament_id:INTERNAL,status:"called",court:"2",
   scheduled_at:"2026-11-07T08:55:00+01:00",
   source_url:"https://dbv.turnier.de/tournament/"+EVENT,
   last_synced_at:new Date(NOW-15000).toISOString(),
   events:{title:"ME U15"},match_participants:[
    {side:1,player_position:1,players:{dbv_id:PLAYER,name:"Synthetische Léona"}},
    {side:2,player_position:1,players:{dbv_id:"05-000001",name:"Synthetische Gegnerin"}}
   ],match_games:[]
  },{
   id:"bcf6d3be-1fde-4e61-a12d-392200ff216b",
   tournament_id:INTERNAL,status:"finished",court:"5",
   scheduled_at:"2026-11-07T07:30:00+01:00",
   source_url:"https://dbv.turnier.de/tournament/"+EVENT,
   last_synced_at:new Date(NOW-15000).toISOString(),
   events:{title:"MX U15"},match_participants:[
    {side:1,player_position:1,players:{dbv_id:"05-000002",name:"Synthetischer Gegner"}},
    {side:2,player_position:1,players:{dbv_id:PLAYER,name:"Synthetische Léona"}}
   ],
   match_games:[{game_number:1,side1_points:19,side2_points:21,finished:true},
    {game_number:2,side1_points:22,side2_points:24,finished:true}]
  },{
   id:"bcf6d3be-1fde-4e61-a12d-392200ff216c",
   tournament_id:INTERNAL,status:"finished",court:"7",
   source_url:"https://dbv.turnier.de/tournament/"+EVENT,
   last_synced_at:new Date(NOW-15000).toISOString(),
   events:{title:"ME U15"},match_participants:[
    {side:1,player_position:1,players:{dbv_id:"05-000002",name:"Fremde Spielerin"}},
    {side:2,player_position:1,players:{dbv_id:"05-000003",name:"Fremde Gegnerin"}}
   ],
   match_games:[{game_number:1,side1_points:21,side2_points:10,finished:true}]
  },{
   id:"bcf6d3be-1fde-4e61-a12d-392200ff216d",
   tournament_id:INTERNAL,status:"scheduled",court:null,
   scheduled_at:"2026-11-08T10:00:00+01:00",
   source_url:"https://dbv.turnier.de/tournament/"+EVENT,
   last_synced_at:new Date(NOW-15000).toISOString(),
   events:{title:"MD U15"},match_participants:[
    {side:1,player_position:1,players:{dbv_id:PLAYER,name:"Synthetische Léona"}},
    {side:1,player_position:2,players:{dbv_id:"05-000004",name:"Doppelpartnerin"}},
    {side:2,player_position:1,players:{dbv_id:"05-000005",name:"Gegnerteam 1"}},
    {side:2,player_position:2,players:{dbv_id:"05-000006",name:"Gegnerteam 2"}}
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
 await page.route("**/functions/v1/dbv-matchday-sync",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify({ok:true,checked:0,stored:0,next_check_minutes:5})
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
 await expect(panel.locator(".today-games-heading").first()).toHaveText("Meine Spiele");
 await expect(panel).toContainText("Offizieller DBV-Import");
 await expect(panel).toContainText("Synthetische Gegnerin");
 await expect(panel).toContainText("Feld 2");
 await expect(panel).toContainText("Mädchen-Einzel U15");
 await expect(panel).toContainText("08:55 Uhr");
 await expect(panel).toContainText("Aufgerufen");
 await expect(panel).toContainText("Weitere Spieler-Spiele · Badhub");
 await expect(panel).toContainText("Badhub Testgegnerin");
 await expect(panel).toContainText("21:17");
 await expect(panel).toContainText("Zuordnung zu diesem DBV-Turnier nicht bestätigt");
 await expect(panel).toHaveAttribute("href","https://dbv.turnier.de/tournament/"+EVENT);
 await expect(panel.locator(".today-game-group-heading[data-day='finished']")).toContainText("BEREITS GESPIELT");
 await expect(panel).toContainText("Gegner: Synthetischer Gegner");
 await expect(panel).toContainText("Mixed U15");
 await expect(panel).toContainText("07:30 Uhr");
 await expect(panel).toContainText("Feld 5");
 await expect(panel).toContainText("21:19 · 24:22");
 await expect(panel).not.toContainText("Fremde Spielerin");
 await expect(panel.locator(".today-game-line")).toHaveCount(4);
 await expect(panel.locator(".today-game-group-heading[data-day='today']")).toContainText("HEUTE");
 await expect(panel.locator(".today-game-group-heading[data-day='tomorrow']")).toContainText("MORGEN");
 await expect(panel.locator(".today-game-group-heading[data-day='tomorrow']")).toContainText("08.11.");
 await expect(panel).toContainText("Mädchen-Doppel U15");
 await expect(panel.locator(".today-game-line[data-category='upcoming']").filter({hasText:"Mädchen-Doppel U15"})).toContainText("Gegnerteam 1 / Gegnerteam 2");
 await expect(panel.locator(".today-game-line[data-next='true']")).toContainText("NÄCHSTES SPIEL");
 await expect(panel.locator(".today-game-line[data-next='true']")).toContainText("Mädchen-Einzel U15");
 await expect(panel.locator(".today-game-line[data-compact='true']")).toHaveCount(1);

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

test("v249: a rejected official match read is not misreported as no published games",async({page})=>{
 await setup(page,{matchReadFails:true});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const panel=page.locator("#today-tournament .today-match-row[data-kind='announced']");
 await expect(panel).toBeVisible({timeout:20000});
 await expect(panel).toContainText("Offizielle Spieldaten konnten nicht geladen werden");
 await expect(panel.locator(".today-game-group-heading[data-day='finished']")).toHaveCount(0);
 await expect(panel).not.toContainText("Synthetischer Gegner");
});
