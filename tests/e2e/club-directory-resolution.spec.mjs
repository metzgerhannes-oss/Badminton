import {test,expect} from "@playwright/test";

/** The public DBV ranking contains 13 players linked to the full club record;
 * individual player records abbreviate it as "SpVgg. Mössingen". */
async function mockDirectory(page,{empty=false}={}){
 await page.addInitScript(({empty})=>{
  window.__libraryReads=[];
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,options)=>{
   const url=new URL(typeof input==="string"?input:input.url,location.href);
   if(url.hostname!=="yadexibmjmnjfmfabrug.supabase.co"||
      !url.pathname.startsWith("/rest/v1/"))return originalFetch(input,options);
   window.__libraryReads.push(url.href);
   const json=(rows,range)=>new Response(JSON.stringify(rows),{
    status:200,headers:{"Content-Type":"application/json","Content-Range":range}
   });
   if(url.pathname.endsWith("/clubs")){
    if(url.searchParams.get("select")==="id"){
     const isOfficial=url.searchParams.get("name")?.includes("Sportvereinigung Mössingen");
     return json(!empty&&isOfficial?[{id:"spvgg-moessingen"}]:[],empty?"*/0":"0-0/1");
    }
    return json([{association:"BAW-Baden-Württemberg"},{association:"BWBV"}],"0-1/2");
   }
   if(url.pathname.endsWith("/players")){
    if(empty||url.searchParams.get("club_id")!=="in.(spvgg-moessingen)")return json([],"*/0");
    return json(Array.from({length:13},(_,n)=>({
     dbv_id:"05-"+String(71000+n).padStart(6,"0"),
     name:"Mössinger Spieler "+(n+1),birth_year:2015,age_class:"U13",
     club:"SpVgg. Mössingen",association:"BAW-Baden-Württemberg",
     last_ranking_week:"2026-KW41"
    })),"0-12/13");
   }
   return originalFetch(input,options);
  };
 },{empty});
}

test("full official club name returns 13 connected DBV players",async ({page})=>{
 await mockDirectory(page);
 await page.goto("/#spieler");
 const club=page.locator("#library-club");
 await expect(club).toBeVisible();
 await club.fill("Sportvereinigung Mössingen 1904 e.V.");
 await expect(page.locator("#library-count")).toContainText("13 passende Spieler");
 await expect(page.locator(".library-player")).toHaveCount(13);
 const urls=await page.evaluate(()=>window.__libraryReads);
 expect(urls.some(raw=>new URL(raw).pathname.endsWith("/clubs")&&
  new URL(raw).searchParams.get("select")==="id")).toBe(true);
 expect(urls.some(raw=>new URL(raw).pathname.endsWith("/players")&&
  new URL(raw).searchParams.get("club_id")==="in.(spvgg-moessingen)")).toBe(true);
 await expect(page.locator("#library-more")).toBeHidden();
});

test("empty match set hides pagination on narrow screens",async ({page})=>{
 await mockDirectory(page,{empty:true});
 await page.goto("/#spieler");
 await page.locator("#library-club").fill("Nirgendwo FC");
 await expect(page.locator("#library-count")).toContainText("0 passende Spieler");
 await expect(page.locator("#library-more")).toBeHidden();
});
