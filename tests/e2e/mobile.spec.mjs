import {test,expect} from "@playwright/test";

const PLAYER="05-070879";
const FRIEND="05-061350";
const ROOT="http://127.0.0.1:4173";
const sourceRecord={
  dbv_id:PLAYER,source_key:"mobile-e2e:match-1",source_name:"Badhub",
  source_kind:"third-party-match-card",category:"tournament",
  competition:"Öffentlich belegtes Jugendturnier",competition_id:"551",
  event:"ME U11",discipline:"Einzel",round_label:"Finale",
  match_date:"2026-10-08",match_year:2026,player_side:1,winning_side:1,
  opponent_names:["Beispiel Gegner"],partner_names:[],
  games:[[21,18],[21,13]],
  source_url:"https://badhub.de/bwbv/turnier.php?id=551"
};
function ownStore(){
 return JSON.stringify({
  players:[
   {id:PLAYER,name:"Philipp Metzger",birthYear:2016,club:"SpVgg Mössingen"},
   {id:"05-071969",name:"Charlotte Metzger",birthYear:2014,club:"SpVgg Mössingen"}
  ],
  friends:[{id:FRIEND,name:"Sarah Storz",club:"SpVgg Mössingen"}],
  officialLinks:[],activeProfileId:PLAYER,chosen:PLAYER,historyProfilesInitialized:true
 });
}
const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS",
 "Content-Type":"application/json"
};
test.beforeEach(async ({page})=>{
 await page.addInitScript(data=>localStorage.setItem("shuttleboard-v1",data),ownStore());
 await page.route("**/*",async route=>{
  const request=route.request();
  const url=new URL(request.url());
  if(url.origin===ROOT)return route.continue();
  if(request.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(url.hostname.endsWith(".supabase.co")){
   let data=[];
   if(url.pathname.endsWith("/player_external_match_facts") &&
      url.searchParams.get("dbv_id")==="eq."+PLAYER)data=[sourceRecord];
   if(url.pathname.endsWith("/player_external_match_imports") &&
      url.searchParams.get("dbv_id")==="eq."+PLAYER){
    data=[{dbv_id:PLAYER,status:"complete",cursor_offset:1,verified_count:1,rejected_count:0}];
   }
   if(url.pathname.endsWith("/player_live_snapshots")){
    const id=(url.searchParams.get("dbv_id")||"").replace(/^eq\./,"");
    data=[{
     dbv_id:id,provider:"Badhub",
     source_url:"https://badhub.de/spieler/"+id+"/live",
     checked_at:new Date().toISOString(),
     payload:{tournament:null,running:null,next:null,hero:null,upcoming:[],past:[],entries:[]}
    }];
   }
   if(url.pathname.includes("/functions/v1/"))
    return route.fulfill({status:200,headers,body:'{"queued":false,"reason":"already_present"}'});
   return route.fulfill({status:200,headers,body:JSON.stringify(data)});
  }
  // The app must remain usable without a real third-party server during QA.
  return route.fulfill({status:200,headers,body:"[]"});
 });
});

test("Home shows individual sourced matches and fits the small viewport",async ({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#first-run-dialog")).not.toBeVisible();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Philipp");
 const mainTabs=page.locator(".bottom-nav a");
 await expect(mainTabs).toHaveCount(4);
 await expect(page.locator("#match-stats-source")).toContainText("Badhub");
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
 await expect(page.locator("#match-stats-values .match-stat.wins strong")).toHaveText("1");
 await expect(page.locator("#match-stats-values .match-stat.losses strong")).toHaveText("0");
 await expect(page.locator("#match-stats-values .match-stat.rate strong")).toContainText("100");
 const viewport=await page.evaluate(()=>({
  excess:document.documentElement.scrollWidth-window.innerWidth,
  nav:[...document.querySelectorAll(".bottom-nav a")].map(x=>{
   const r=x.getBoundingClientRect();
   return {w:r.width,h:r.height,label:x.innerText.trim()};
  })
 }));
 expect(viewport.excess).toBeLessThanOrEqual(2);
 for(const tab of viewport.nav){
  expect(tab.w,tab.label+" width").toBeGreaterThanOrEqual(44);
  expect(tab.h,tab.label+" height").toBeGreaterThanOrEqual(44);
  expect(tab.label.length).toBeGreaterThan(1);
 }
});

test("Friend viewing never changes which own profile Home returns to",async ({page})=>{
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-spieler")).toBeVisible();
 await page.locator('[data-view-friend="'+FRIEND+'"]').click();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Sarah Storz");
 // The user intentionally remains on Home while viewing a friend.
 await page.locator('.bottom-nav a[data-page="start"]').click();
 await expect(page.locator(".focused-profile")).toContainText("Philipp Metzger");
 await expect(page.locator(".focused-profile")).not.toContainText("Sarah Storz");
 await expect(page.locator(".bottom-nav a[aria-current='page']")).toHaveCount(1);
 await expect(page.locator("#view-start")).toBeVisible();
});

test("Turniertag is task-first; source-free status is calm and history is reachable",async ({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-turniere")).toBeVisible();
 await expect(page.locator("#live-player-select")).toBeVisible();
 await expect(page.locator("#live-radar-content")).toContainText("Derzeit kein Turniertag gemeldet");
 await expect(page.locator("#live-radar-content")).not.toContainText("Live-Abgleich veraltet");
 await page.locator("#live-player-select").selectOption(FRIEND);
 await expect(page.locator(".focused-profile")).toContainText("Sarah Storz");
 await expect(page.locator("#view-turniere")).toBeVisible();
 await page.locator('#view-turniere a[href="#historie"]:visible').first().click();
 await expect(page.locator("#view-historie")).toBeVisible();
 await expect(page.locator('.bottom-nav a[data-page="turniere"]')).toHaveAttribute("aria-current","page");
 await expect(page).toHaveTitle(/Turnierhistorie/);
});

test("Search is empty before criteria and modal remains dismissible",async ({page})=>{
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#library-results")).toContainText("Spieler suchen");
 await expect(page.locator("#library-count")).toContainText(/Suche starten|Spieler suchen/);
 await page.locator("#add-player").click();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await expect(page.locator("#cancel-dialog")).toBeVisible();
 await page.locator("#cancel-dialog").click();
 await expect(page.locator("#player-dialog")).not.toBeVisible();
});

test("Offline hint is informative and clears on reconnection",async ({page,context})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#connection-status")).toBeHidden();
 await context.setOffline(true);
 await expect(page.locator("#connection-status")).toBeVisible();
 await expect(page.locator("#connection-status")).toContainText("Keine Verbindung");
 await context.setOffline(false);
 await expect(page.locator("#connection-status")).toBeHidden();
});
