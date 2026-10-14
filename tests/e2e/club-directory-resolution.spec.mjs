import {test,expect} from "@playwright/test";

const HEADERS={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json"
};
test.beforeEach(async ({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Testprofil",club:"SpVgg. Mössingen"}],
   activeProfileId:"05-070879",chosen:"05-070879",
   friends:[],officialLinks:[],historyProfilesInitialized:true
  }));
 });
});
test("Scoped name and club search shows at most 12 verified DBV identities without reading player roster",async ({page})=>{
 const queries=[],forbidden=[];
 await page.route("**/*.supabase.co/**",route=>{
  const url=new URL(route.request().url());
  if(url.pathname==="/rest/v1/players"||url.pathname==="/rest/v1/clubs")forbidden.push(url.pathname);
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:HEADERS});
  if(url.pathname==="/rest/v1/rpc/search_dbv_player_identity"){
   const args=JSON.parse(route.request().postData()||"{}");queries.push(args);
   const rows=Array.from({length:12},(_,index)=>({
    dbv_id:"05-"+String(71000+index).padStart(6,"0"),
    name:"Mössinger Spieler "+String(index+1).padStart(2,"0"),
    age_class:"U13",club:"SpVgg. Mössingen",association:"BAW-Baden-Württemberg"
   }));
   return route.fulfill({status:200,headers:HEADERS,body:JSON.stringify(rows)});
  }
  return route.fulfill({status:200,headers:HEADERS,body:"[]"});
 });
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator("#player-add-open").click();
 await page.locator("#library-club").fill("SpVgg. Mössingen");
 await page.locator("#library-search").fill("Mössinger");
 await expect(page.locator("#library-count")).toContainText("12 passende Spieler");
 await expect(page.locator(".library-player")).toHaveCount(12);
 await expect(page.locator("#library-more")).toBeHidden();
 expect(queries.some(q=>q.p_query==="Mössinger"&&q.p_club==="SpVgg. Mössingen")).toBe(true);
 expect(forbidden).toEqual([]);
});
test("No name or zero verified results means no silent bulk club export",async ({page})=>{
 const queries=[];
 await page.route("**/*.supabase.co/**",route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:HEADERS});
  if(url.pathname==="/rest/v1/rpc/search_dbv_player_identity")
   queries.push(JSON.parse(route.request().postData()||"{}"));
  return route.fulfill({status:200,headers:HEADERS,body:"[]"});
 });
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator("#player-add-open").click();
 await page.locator("#library-club").fill("Nirgendwo FC");
 await expect(page.locator("#library-more")).toBeHidden();
 expect(queries).toHaveLength(0);
 await page.locator("#library-search").fill("Nichtvorhanden");
 await expect(page.locator("#library-count")).toContainText("0 passende Spieler");
 await expect(page.locator("#library-more")).toBeHidden();
 expect(queries).toHaveLength(1);
});
