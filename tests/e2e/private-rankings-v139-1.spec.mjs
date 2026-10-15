import {test,expect} from "./invited-member.fixture.mjs";

const FIRST="05-123456",SECOND="05-987654",SARAH="05-061350";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
test.beforeEach(async({page})=>{
 await page.addInitScript(id=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[{id,name:"Testspieler",birthYear:2016,club:"Testverein"}],
  friends:[],officialLinks:[],activeProfileId:id,chosen:id,historyProfilesInitialized:true
 })),FIRST);
 await page.route("**/*",route=>{
  const url=new URL(route.request().url()),method=route.request().method();
  if(url.hostname==="127.0.0.1"||url.hostname==="localhost")return route.continue();
  if(method==="OPTIONS")return route.fulfill({status:204,headers});
  if(url.pathname.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,contentType:"application/json",headers,body:'{"allowed":true,"owner":false}'});
  if(url.pathname.endsWith("/rpc/app_access_rankings_read")){
   const id=JSON.parse(route.request().postData()||"{}").p_player_dbv_id;
   const disciplines=id===FIRST?{
    HE:{ageClass:"U11",birthYear:2016,points:2670,tournaments:13,ageClassRank:43,bwAgeClassRank:4},
    HD:{ageClass:"U11",birthYear:2016,points:1322,tournaments:3,ageClassRank:118,bwAgeClassRank:9},
    HM:{ageClass:"U11",birthYear:2016,points:1469,tournaments:2,ageClassRank:21,bwAgeClassRank:1}
   }:id===SECOND?{DE:{ageClass:"U13",birthYear:2014,points:611,tournaments:2,ageClassRank:469,bwAgeClassRank:60}}:id===SARAH?{DE:{ageClass:"U17",birthYear:2010,points:61077,tournaments:13,ageClassRank:null,bwAgeClassRank:null,nationalYouthOverallRank:42},DD:{ageClass:"U17",birthYear:2010,points:67117,tournaments:11,ageClassRank:null,bwAgeClassRank:null,nationalYouthOverallRank:68},DM:{ageClass:"U17",birthYear:2010,points:44521,tournaments:11,ageClassRank:null,bwAgeClassRank:null,nationalYouthOverallRank:77}}:null;
   return route.fulfill({status:200,contentType:"application/json",headers,body:JSON.stringify(disciplines
    ?{player_dbv_id:id,status:"available",current:{year:2026,week:id===SARAH?42:41,url:"https://turniere.badminton.de/ranking"},disciplines}
    :{player_dbv_id:id,status:"no_verified_ranking"})});
  }
  if(url.pathname.endsWith("/rpc/search_dbv_player_identity"))
   return route.fulfill({status:200,contentType:"application/json",headers,
    body:JSON.stringify([{dbv_id:SECOND,name:"Muster Spieler",club:"Testverein",age_class:"U13",association:"BAW-Baden-Württemberg"}])});
  return route.fulfill({status:200,contentType:"application/json",headers,body:"[]"});
 });
});

test("v140: official member rankings replace three empty placeholders on a small iPhone",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#dashboard-week")).toHaveText("KW 41 / 2026");
 await expect(page.locator("#dashboard-rankings .ranking-tile")).toHaveCount(3);
 await expect(page.locator("#dashboard-rankings")).toContainText("2.670");
 await expect(page.locator("#dashboard-rankings")).toContainText("1.322");
 await expect(page.locator("#dashboard-rankings")).toContainText("1.469");
 await expect(page.locator("#dashboard-rankings")).toContainText("#4");
 await expect(page.locator("#dashboard-rankings")).toContainText("#9");
 await expect(page.locator("#dashboard-rankings")).toContainText("#1");
 await expect(page.locator("#app-version-badge")).toContainText("v151");
 await expect(page.locator("#player-data-status")).toHaveCount(0);
 await expect(page.locator("#match-stats .home-stats-link")).toHaveAttribute("href","#historie");
 await expect(page.locator("#match-stats-age-summary")).toHaveCount(0);
 await expect(page.locator("body")).not.toContainText("Niederlagen nach gespielter AK");
 const bounds=await page.locator(".topbar").boundingBox();
 expect(bounds).toBeTruthy();
 expect(bounds.x+bounds.width).toBeLessThanOrEqual(322);
});

test("v140: only verified disciplines are shown, with a compact empty state",async({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#dashboard-rankings .ranking-tile")).toHaveCount(3);
 await page.evaluate(id=>window.renderDashboard(id,[{id,name:"Muster Spieler",birthYear:2014,club:"Testverein"}],[],{}),SECOND);
 await expect(page.locator("#dashboard-rankings .ranking-tile")).toHaveCount(1);
 await expect(page.locator("#dashboard-rankings")).toContainText("611");
 await expect(page.locator("#dashboard-rankings")).not.toContainText("Mixed");
 await page.evaluate(()=>window.renderDashboard("05-444444",[{id:"05-444444",name:"Unbekannt",birthYear:2015}],[],{}));
 await expect(page.locator("#dashboard-rankings .ranking-tile")).toHaveCount(0);
 await expect(page.locator("#dashboard-rankings .dashboard-empty-tile")).toHaveCount(1);
 await expect(page.locator("#dashboard-rankings")).toContainText("kein offiziell belegter Ranglistenstand");
});

test("v140: player search shows a verified name instead of repeating GitHub fallback",async({page})=>{
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator("#player-add-open").click();
 await expect(page.locator("#player-discover")).toBeVisible();
 await page.locator("#library-search").fill("Muster");
 await expect(page.locator("#library-results .library-player")).toHaveCount(1);
 await expect(page.locator("#library-results")).toContainText("Muster Spieler");
 await expect(page.locator("#library-results")).toContainText(SECOND);
 await expect(page.locator("#library-source")).toContainText("Gezielte offizielle DBV-Identitätssuche");
 await expect(page.locator("#library-source")).not.toContainText("GitHub-Ausfallsicherung");
});

test("v144: followed Sarah shows verified Jugend overall ranks without invented U17 or BW places",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.evaluate(id=>window.renderDashboard(id,[],[],{mode:"friend"}),SARAH);
 await expect(page.locator("#dashboard-week")).toHaveText("KW 42 / 2026");
 await expect(page.locator("#dashboard-rankings .ranking-tile")).toHaveCount(3);
 await expect(page.locator("#dashboard-rankings")).toContainText("61.077");
 await expect(page.locator("#dashboard-rankings")).toContainText("67.117");
 await expect(page.locator("#dashboard-rankings")).toContainText("44.521");
 await expect(page.locator("#dashboard-rankings")).toContainText("DE Jugend gesamt");
 await expect(page.locator("#dashboard-rankings")).toContainText("#42");
 await expect(page.locator("#dashboard-rankings")).toContainText("#68");
 await expect(page.locator("#dashboard-rankings")).toContainText("#77");
 await expect(page.locator("#dashboard-rankings .ranking-bw-row strong")).toHaveText(["–","–","–"]);
 await page.locator('#dashboard-rankings [data-rank-discipline="DE"]').click();
 await expect(page.locator("#ranking-detail-content")).toContainText("Nicht U17-spezifisch");
 await expect(page.locator("#ranking-detail-content")).toContainText("BW-U17-Platz");
 const width=await page.evaluate(()=>document.documentElement.scrollWidth);
 expect(width).toBeLessThanOrEqual(322);
});
