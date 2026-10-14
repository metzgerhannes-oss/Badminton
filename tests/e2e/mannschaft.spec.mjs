import {test,expect} from "./invited-member.fixture.mjs";
const own={players:[{id:"05-070879",name:"Testprofil",club:"SpVgg Mössingen"}],
 friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",historyProfilesInitialized:true};
const source="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10777";
const teams=[
 {id:"nuliga:10777:2026-27:1",follow_key:"nuliga:10777:1",club_id:"10777",club_name:"SpVgg. Mössingen",team_label:"I",league_name:"Regionalliga",season:"2026/27",position:1,points_for:4,points_against:0,source_url:source,source_checked_at:"2026-10-12T10:45:00Z"},
 {id:"nuliga:10777:2026-27:2",follow_key:"nuliga:10777:2",club_id:"10777",club_name:"SpVgg. Mössingen",team_label:"II",league_name:"Württemberg-Liga",season:"2026/27",position:5,points_for:0,points_against:0,source_url:source,source_checked_at:"2026-10-12T10:45:00Z"},
 {id:"nuliga:10892:2026-27:4",follow_key:"nuliga:10892:4",club_id:"10892",club_name:"TSG Heilbronn",team_label:"IV",league_name:"Bezirksliga",season:"2026/27",position:7,points_for:0,points_against:0,source_url:"https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10892",source_checked_at:"2026-10-12T10:45:00Z"}
];
test.beforeEach(async ({page})=>{
 await page.addInitScript(state=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify(state));
 },own);
 await page.route("**/*.supabase.co/**",route=>{
  const path=new URL(route.request().url()).pathname;
  let data=[];
   if(path.endsWith("/rpc/app_access_status"))data={allowed:true,owner:false};
  if(path.endsWith("/league_teams"))data=teams;
  if(path.endsWith("/league_clubs"))data=[
   {id:"10777",name:"SpVgg. Mössingen",region:"Bezirk Südwürttemberg",source_url:source,import_state:"imported"},
   {id:"10858",name:"TSV Gomaringen",region:"Bezirk Südwürttemberg",
    source_url:"https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10858",import_state:"not_imported"}
  ];
  if(path.endsWith("/league_fixtures"))data=[{id:"a",match_date:"2026-10-17T16:00:00+02:00",home_team:"SpVgg. Mössingen II",away_team:"TSG Heilbronn IV",status:"scheduled",home_score:null,away_score:null,source_url:source}];
  if(path.endsWith("/league_table_rows"))data=[{position:1,club_team:"Gäste I",played:2,won:2,drawn:0,lost:0,points_for:4,points_against:0}];
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data),
   headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
 });
});
test("Mannschaft has its own mobile tab, persistent following, fixtures and official table",async ({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#mannschaft");
 await expect(page.locator("#view-mannschaft")).toBeVisible();
 await expect(page.locator(".bottom-nav a:visible")).toHaveCount(5);
 await expect(page.locator(".bottom-nav a[data-page=mannschaft]")).toHaveAttribute("aria-current","page");
 await expect(page.locator("#team-discover")).toBeHidden();
  await expect(page.locator("#team-results .team-card")).toHaveCount(0);
  await page.locator("#team-add-open").click();
  await expect(page.locator("#team-discover")).toBeVisible();
 await page.locator("#team-search").fill("mossingen");
 await expect(page.locator("#team-results .team-card")).toHaveCount(2);
 await page.locator("#team-search").fill("heilbronn");
 await expect(page.locator("#team-results .team-card")).toHaveCount(1);
 await page.locator("#team-search").fill("mossingen");
 await page.locator('#team-results [data-team-toggle="nuliga:10777:2"]').click();
 await expect(page.locator("#team-followed .team-card")).toHaveCount(1);
 await page.locator('#team-followed [data-team-open="nuliga:10777:2026-27:2"]').click();
  await expect(page.locator("#team-discover")).toBeHidden();
 await expect(page.locator("#team-detail")).toBeVisible();
 await expect(page.locator("#team-detail-games")).toContainText("TSG Heilbronn IV");
 await expect(page.locator("#team-detail-games")).toContainText("Angesetzt");
 await page.locator('[data-team-tab="table"]').click();
 await expect(page.locator("#team-detail-table")).toContainText("Gäste I");
 await expect(page.locator("#team-detail-summary")).toContainText("0:0");
 await expect(page.locator("#team-source-link")).toHaveAttribute("href",source);
 await page.reload();
 await expect(page.locator("#team-followed .team-card")).toHaveCount(1);
 for(const tab of await page.locator(".bottom-nav a:visible").all()){
  const box=await tab.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
 }
});
test("A source outage is not presented as zero known teams",async ({page})=>{
 await page.route("**/*.supabase.co/rest/v1/league_teams?*",route=>route.fulfill({
  status:503,contentType:"application/json",body:'{"error":"source unavailable"}',
  headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}
 }));
 await page.goto("/#mannschaft");
 await expect(page.locator("#team-directory-status")).toContainText("nicht erreichbar");
 await page.locator("#team-add-open").click();
  await expect(page.locator("#team-results")).toContainText("nicht erreichbar");
});

test("BWBV directory finds new clubs without inventing teams",async ({page})=>{
 await page.goto("/#mannschaft");
 await page.locator("#team-add-open").click();
  await page.locator("#team-search").fill("Gomaringen");
 await expect(page.locator("#team-results .team-card")).toHaveCount(0);
 await expect(page.locator("#team-clubs-results")).toContainText("TSV Gomaringen");
 await expect(page.locator("#team-clubs-results")).toContainText("Import ausstehend");
 await expect(page.locator('#team-clubs-results a[href*="club=10858"]')).toHaveCount(1);
 await page.locator("#team-search").fill("Mössingen");
 await expect(page.locator("#team-clubs-results")).toContainText("Mannschaften verfügbar");
 await expect(page.locator('#team-clubs-results [data-team-club-filter="SpVgg. Mössingen"]')).toHaveCount(1);
});
