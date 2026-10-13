import {test,expect} from "@playwright/test";
const token="0123456789abcdef".repeat(4);
test("Invalid capability cannot display personal data or remain in the address bar",async({page})=>{
 await page.goto("/private-player.html#token=not-a-token",{waitUntil:"load"});
 await expect(page.locator("#player-invite-status")).toContainText("ungültig");
 await expect(page.locator("#player-invite-data")).toBeHidden();
 expect(new URL(page.url()).hash).toBe("");
});
test("Scoped capability renders bounded synthetic matches without HTML or token leakage",async({page})=>{
 const requests=[];
 await page.route("**/*.supabase.co/rest/v1/rpc/private_player_invite_read",async route=>{
  requests.push({method:route.request().method(),payload:JSON.parse(route.request().postData()||"{}"),url:route.request().url()});
  await route.fulfill({status:200,contentType:"application/json",
   headers:{"Access-Control-Allow-Origin":"*"},
   body:JSON.stringify({player:{dbv_id:"99-000001",name:"Muster <img src=x onerror=alert(1)>",club:"Musterverein",age_class:"U13"},
    matches:Array.from({length:35},(_,i)=>({match_date:"2026-10-10",discipline:"Einzel",
     competition:"Test",player_side:1,winning_side:2,source_name:"Beleg",
     source_url:i===0?"javascript:alert(1)":"https://badhub.de/spieler/99-000001"}))})
  });
 });
 await page.goto("/private-player.html#token="+token,{waitUntil:"load"});
 await expect(page.locator("#player-invite-data")).toBeVisible();
 await expect(page.locator("#player-invite-name")).toContainText("Muster <img");
 expect(await page.locator("#player-invite-name img").count()).toBe(0);
 expect(await page.locator("#player-invite-matches li").count()).toBe(30);
 expect(await page.locator("#player-invite-matches a").count()).toBe(29);
 expect(new URL(page.url()).hash).toBe("");
 expect(requests).toHaveLength(1);
 expect(requests[0].method).toBe("POST");
 expect(requests[0].payload.p_token).toBe(token);
 expect(requests[0].url).not.toContain(token);
});
