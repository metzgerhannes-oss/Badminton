/** Synthetic public nuLiga fixture for red Heute-tab browser QA.
 * Inherited supabase-isolated.fixture.mjs blocks all non-mocked production reads.
 */
export async function mockVerifiedTodayTeam(page){
 const SOURCE="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupPage?championship=2026";
 const TEAM="nuliga:10777:2026-27:1";
 const FOLLOW="nuliga:10777:1";
 await page.addInitScript(key=>{
  localStorage.setItem("schmetterlinge-followed-teams-v1",JSON.stringify([key]));
 },FOLLOW);
 await page.route("**/rest/v1/league_teams?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   id:TEAM,follow_key:FOLLOW,club_id:"10777",
   club_name:"Testverein",team_label:"1",league_name:"Testliga",season:"2026/27",
   source_url:SOURCE,source_checked_at:new Date().toISOString()
  }])
 }));
 await page.route("**/rest/v1/league_clubs?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:"[]"
 }));
 await page.route("**/rest/v1/league_fixtures?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify([{
   id:"fixture-today-test",team_id:TEAM,match_date:new Date().toISOString(),
   home_team:"Testverein 1",away_team:"Testgäste 1",
   status:"scheduled",home_score:null,away_score:null,
   source_url:SOURCE,source_checked_at:new Date().toISOString()
  }])
 }));
}
