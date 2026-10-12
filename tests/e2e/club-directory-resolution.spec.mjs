import {test,expect} from "@playwright/test";

// In the real DB, club 05-0148 is stored as "Sportvereinigung Mössingen 1904 e.V."
// but each of its 13 player rows has club="SpVgg. Mössingen".
test("official club full name resolves 13 DBV players by linked club ID",async ({page})=>{
 const requests=[];
 await page.route("**/rest/v1/clubs?*",route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get("select")==="id"){
   requests.push({kind:"club",url});
   const valid=url.searchParams.get("name")?.includes("Sportvereinigung Mössingen");
   return route.fulfill({status:200,contentType:"application/json",
    headers:{"Content-Range":valid?"0-0/1":"*/0","Access-Control-Allow-Origin":"*"},
    body:JSON.stringify(valid?[{id:"spvgg-moessingen"}]:[])});
  }
  return route.fulfill({status:200,contentType:"application/json",
   headers:{"Content-Range":"0-1/2","Access-Control-Allow-Origin":"*"},
   body:JSON.stringify([{association:"BAW-Baden-Württemberg"},{association:"BWBV"}])});
 });
 await page.route("**/rest/v1/players?*",route=>{
  const url=new URL(route.request().url());
  requests.push({kind:"players",url});
  if(url.searchParams.get("club_id")!=="in.(spvgg-moessingen)")
   return route.fulfill({status:200,contentType:"application/json",
    headers:{"Content-Range":"*/0","Access-Control-Allow-Origin":"*"},body:"[]"});
  const rows=Array.from({length:13},(_,index)=>({
   dbv_id:"05-"+String(71000+index).padStart(6,"0"),
   name:"Mössinger Spieler "+String(index+1).padStart(2,"0"),
   birth_year:2015,age_class:"U13",club:"SpVgg. Mössingen",
   association:"BAW-Baden-Württemberg",last_ranking_week:"2026-KW41"
  }));
  return route.fulfill({status:200,contentType:"application/json",
   headers:{"Content-Range":"0-12/13","Access-Control-Allow-Origin":"*"},body:JSON.stringify(rows)});
 });
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator("#library-club").fill("Sportvereinigung Mössingen 1904 e.V.");
 await expect(page.locator("#library-count")).toContainText("13 passende Spieler");
 await expect(page.locator(".library-player")).toHaveCount(13);
 expect(requests.some(r=>r.kind==="club")).toBe(true);
 expect(requests.some(r=>r.kind==="players"&&
  r.url.searchParams.get("club_id")==="in.(spvgg-moessingen)")).toBe(true);
 await expect(page.locator("#library-more")).toBeHidden();
});

test("zero results hide pagination button on mobile",async ({page})=>{
 await page.route("**/rest/v1/clubs?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:"[]",
  headers:{"Content-Range":"*/0","Access-Control-Allow-Origin":"*"}
 }));
 await page.route("**/rest/v1/players?*",route=>route.fulfill({
  status:200,contentType:"application/json",body:"[]",
  headers:{"Content-Range":"*/0","Access-Control-Allow-Origin":"*"}
 }));
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator("#library-club").fill("Nirgendwo FC");
 await expect(page.locator("#library-count")).toContainText("0 passende Spieler");
 await expect(page.locator("#library-more")).toBeHidden();
});
