import {test as base,expect} from "./supabase-isolated.fixture.mjs";
export {expect};

// Legacy application-flow specs exercise a valid invited-member browser.
// Access-denial and revocation specs continue to use base Playwright directly.
export const test=base.extend({
 page:async({page},use)=>{
  await page.addInitScript(()=>{
   const key="schmetterlinge.communitySession.v1";
   if(!localStorage.getItem(key)){
    localStorage.setItem(key,JSON.stringify({
     access_token:"playwright-member-session",
     refresh_token:"playwright-member-refresh",
     expires_at:Date.now()+3600000,
     user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"
    }));
   }
  });
  await page.route("**/*.supabase.co/rest/v1/rpc/app_access_status",route=>
   route.fulfill({status:route.request().method()==="OPTIONS"?204:200,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
     "Access-Control-Allow-Methods":"POST,OPTIONS"},
    body:route.request().method()==="OPTIONS"?"":'{"allowed":true,"owner":false}'}));
  await use(page);
 }
});
