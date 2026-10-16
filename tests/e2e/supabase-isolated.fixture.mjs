/** CI/browser QA must never generate real Supabase API/Auth/Edge requests.
 * Specific page.route mocks registered by individual specs override this fallback.
 * A missing mock fails closed; it never falls back to production.
 * Browser service workers are blocked in playwright.config.mjs.
 */
import {test as base,expect} from "@playwright/test";
export {expect};
const SUPABASE=/^https:\/\/[a-z0-9-]+\.supabase\.co\//i;
const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer,x-client-info",
 "Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS",
 "Content-Type":"application/json",
 "X-Schmetterlinge-Mock":"browser-qa-no-live-supabase"
};
export const test=base.extend({
 context:async({context},use)=>{
  // context.route covers all pages opened from this browser context.
  // Page-specific mocks take precedence, including invitation/RLS contracts.
  await context.route(SUPABASE,route=>{
   if(route.request().method()==="OPTIONS")
    return route.fulfill({status:204,headers,body:""});
   const path=new URL(route.request().url()).pathname;
   if(path==="/rest/v1/rpc/app_access_status")
    return route.fulfill({status:200,headers,body:'{"allowed":false,"owner":false}'});
   return route.fulfill({status:401,headers,body:'{"message":"Browser QA: non-mocked Supabase request blocked"}'});
  });
  await use(context);
 }
});
