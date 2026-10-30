import {test,expect} from "./invited-member.fixture.mjs";

// F04 #198: entirely synthetic identities, no production Supabase traffic.
// Stop at the redirect so the next page cannot consume the pending-copy key
// before the assertion observes whether onboarding wrote it.
const ID="99-000001",OTHER="99-000002";
const PENDING="schmetterlinge.pendingPlayerDataCopy.v1";
const STORE="shuttleboard-v1";
const HEADERS={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json"
};
async function selectConfirmedPlayer(page,alreadySaved){
 const previous={
  players:[{id:OTHER,name:"Lea Beispiel",club:"Testverein"}],
  activeProfileId:OTHER,chosen:OTHER,friends:[],
  officialLinks:[{id:"synthetic-event",name:"Fiktives Turnier",playerId:OTHER}]
 };
 if(alreadySaved)previous.players.push({id:ID,name:"Mira Muster",club:"Testverein"});
 // Seed the browser storage exactly once. Playwright addInitScript executes on
 // every navigation, including the mocked index.html redirect; without this
 // guard it resets the just-saved family profiles and produces false failures.
 await page.addInitScript(value=>{
  if(sessionStorage.getItem("f04-fixture-seeded")!=="1"){
   localStorage.setItem("shuttleboard-v1",JSON.stringify(value));
   sessionStorage.setItem("f04-fixture-seeded","1");
  }
 },previous);
 await page.route("**/rest/v1/rpc/search_dbv_player_identity",route=>{
  if(route.request().method()==="OPTIONS")
   return route.fulfill({status:204,headers:HEADERS,body:""});
  return route.fulfill({status:200,headers:HEADERS,body:JSON.stringify([
   {dbv_id:ID,name:"Mira Muster",club:"Testverein",age_class:"U13"}
  ])});
 });
 await page.route("**/index.html",route=>route.fulfill({
  status:200,contentType:"text/html",body:"<!doctype html><title>Redirected</title>"
 }));
 await page.goto("/welcome.html?from=app",{waitUntil:"domcontentloaded"});
 const search=page.locator("#welcome-player-search");
 await expect(search).toBeVisible();
 await search.fill("Mira");
 const hit=page.locator(".welcome-search-hit",{hasText:"Mira Muster"});
 await expect(hit).toHaveCount(1);
 await hit.click();
 await page.locator("#welcome-selection-save").click();
 await expect(page).toHaveURL(/\/index\.html#start$/);
 return page.evaluate(({store,pending})=>({
  saved:JSON.parse(localStorage.getItem(store)),
  pending:localStorage.getItem(pending)
 }),{store:STORE,pending:PENDING});
}
test("reselecting an existing DBV family profile does not repeat copy consent",async({page})=>{
 const {saved,pending}=await selectConfirmedPlayer(page,true);
 expect(pending).toBeNull();
 expect(saved.players).toHaveLength(2);
 expect(saved.activeProfileId).toBe(ID);
 expect(saved.players.some(p=>p.id===OTHER)).toBe(true);
 expect(saved.officialLinks).toHaveLength(1);
});
test("a newly confirmed DBV profile still offers voluntary one-way copy",async({page})=>{
 const {saved,pending}=await selectConfirmedPlayer(page,false);
 expect(pending).toBe(ID);
 expect(saved.players).toHaveLength(2);
 expect(saved.activeProfileId).toBe(ID);
 expect(saved.players.some(p=>p.id===OTHER)).toBe(true);
});
