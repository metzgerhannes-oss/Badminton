/** Deterministic local/browser-only baseline, not production or physical iPhone timing.
 * Exactly five isolated cold browser contexts + five in-context warm navigations
 * per engine, with an artificial valid member status and ALL remote calls blocked.
 * For real Cloudflare Access/OTP timing use a separately approved device session.
 */
import {test,expect} from "@playwright/test";

const RUNS=5;
const api=/^https:\/\/[a-z0-9-]+\.supabase\.co\//i;
const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer,x-client-info",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
 "Content-Type":"application/json",
 "X-Schmetterlinge-Mock":"baseline-offline-only"
};
const round=n=>Number.isFinite(n)?Math.round(n*10)/10:null;
const median=xs=>{const valid=xs.filter(Number.isFinite).sort((a,b)=>a-b);return valid.length?round(valid[Math.floor(valid.length/2)]):null};

async function setup(browser,project){
 const use=project.use;
 const context=await browser.newContext({
  baseURL:"http://127.0.0.1:4173",
  viewport:use.viewport||{width:375,height:667},
  deviceScaleFactor:use.deviceScaleFactor||1,
  isMobile:Boolean(use.isMobile),
  hasTouch:Boolean(use.hasTouch),
  locale:"de-DE",timezoneId:"Europe/Berlin",reducedMotion:"reduce",
  serviceWorkers:"block",
  proxy:{server:"http://127.0.0.1:1",bypass:"127.0.0.1,localhost"}
 });
 // No real API call can escape the browser, including accidental asset URLs.
 await context.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(url.hostname==="127.0.0.1"||url.hostname==="localhost")return route.continue();
  if(!api.test(url.href))return route.abort();
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(url.pathname==="/rest/v1/rpc/app_access_status")
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
  return route.fulfill({status:401,headers,body:'{"message":"Offline baseline: private endpoint blocked"}'});
 });
 await context.addInitScript(()=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"synthetic-member",refresh_token:"synthetic-refresh",
   expires_at:Date.now()+3600000,user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"
  }));
  const measure={grantAt:null,interactiveAt:null,lcp:null,longTasks:0};
  window.__appstartProbe=measure;
  if(typeof PerformanceObserver==="function"){
   try{new PerformanceObserver(list=>{
    for(const e of list.getEntries())measure.lcp=e.startTime;
   }).observe({type:"largest-contentful-paint",buffered:true})}catch{}
   try{new PerformanceObserver(list=>{
    measure.longTasks+=list.getEntries().length;
   }).observe({type:"longtask",buffered:true})}catch{}
  }
  window.addEventListener("badminton:app-access-granted",()=>{
   measure.grantAt=performance.now();
   requestAnimationFrame(()=>{measure.interactiveAt=performance.now()});
  },{once:true});
 });
 return context;
}
async function collect(page,{reload=false}={}){
 if(reload)await page.reload({waitUntil:"domcontentloaded"});
 else await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted",{timeout:16000});
 await expect(page.locator("body > .app")).toBeVisible();
 await page.waitForFunction(()=>Number.isFinite(window.__appstartProbe?.interactiveAt));
 return page.evaluate(()=>{
  const p=window.__appstartProbe;
  const nav=performance.getEntriesByType("navigation")[0];
  const resources=performance.getEntriesByType("resource");
  const paints=performance.getEntriesByType("paint");
  return {
   grantMs:p.grantAt,firstInteractiveMs:p.interactiveAt,
   domContentLoadedMs:nav?.domContentLoadedEventEnd??null,
   fcpMs:paints.find(p=>p.name==="first-contentful-paint")?.startTime??null,
   lcpMs:p.lcp,
   resources:resources.length,
   transferBytes:resources.reduce((total,x)=>total+(x.transferSize||0),0),
   longTasks:p.longTasks
  };
 });
}
test("five isolated cold and five warm starts with synthetic approved access",async({browser},info)=>{
 const cold=[],warm=[];
 for(let i=0;i<RUNS;i++){
  const context=await setup(browser,info.project);
  try{
   const page=await context.newPage();
   cold.push(await collect(page));
   warm.push(await collect(page,{reload:true}));
  }finally{await context.close()}
 }
 const metric=k=>({cold:median(cold.map(x=>x[k])),warm:median(warm.map(x=>x[k]))});
 const output={
  schemaVersion:1,
  environment:"local http.server + synthetic allowed RPC + outbound blocked",
  project:info.project.name,
  measuredAt:new Date().toISOString(),
  samples:RUNS,
  caveats:[
   "This does NOT measure Cloudflare Access login, OTP, production, real devices, or installed iOS PWA.",
   "Warm run uses the same browser context but re-navigates; cold run uses an isolated context.",
   "Proxy/Playwright/browser cache and host CPU affect all results. No user data or tokens were fetched."
  ],
  medianMs:{
   accessGranted:metric("grantMs"),
   firstInteractive:metric("firstInteractiveMs"),
   domContentLoaded:metric("domContentLoadedMs"),
   fcp:metric("fcpMs"),
   lcp:metric("lcpMs")
  },
  medianResources:metric("resources"),
  medianTransferBytes:metric("transferBytes"),
  medianLongTasks:metric("longTasks"),
  samplesRaw:{cold,warm}
 };
 await info.attach("appstart-baseline-"+info.project.name,{
  body:Buffer.from(JSON.stringify(output,null,2)),contentType:"application/json"
 });
 console.log("APPSTART_BASELINE "+JSON.stringify({
  project:output.project,medianMs:output.medianMs,
  medianResources:output.medianResources,
  medianTransferBytes:output.medianTransferBytes
 }));
 expect(output.medianMs.firstInteractive.cold).not.toBeNull();
 expect(output.medianMs.firstInteractive.warm).not.toBeNull();
});
