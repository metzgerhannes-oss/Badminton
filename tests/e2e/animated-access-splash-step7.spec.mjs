import {test,expect} from "./supabase-isolated.fixture.mjs";

/* U7 / #286: only synthetic sessions and intercepted Supabase responses.
   No requests are ever permitted to reach the productive backend. */
const API="https://yadexibmjmnjfmfabrug.supabase.co";
const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json"
};
async function withExistingSession(page){
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"synthetic-access-token",refresh_token:"synthetic-refresh-token",
   expires_at:Date.now()+3600000,user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"
  }));
 });
}
test("checking uses original club logo and animated shuttle without visible text or invitation controls",async({page},testInfo)=>{
 await withExistingSession(page);
 // Keep the synthetic RPC in flight until all visual assertions have completed.
 // A fixed 3.5s delay raced with slow WebKit screenshot/layout evaluation.
 let finishCheck;
 const checking=new Promise(resolve=>{finishCheck=resolve});
 await page.route(API+"/rest/v1/rpc/app_access_status",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  await checking;
  await route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
 });
 // Always release the intercepted synthetic RPC, including when an assertion
 // fails. Otherwise a pending Playwright route can stall WebKit teardown and
 // hide the real assertion failure behind a workflow timeout.
 try {
 await page.setViewportSize({width:320,height:640});
 await page.goto("/",{waitUntil:"commit"});
 await expect(page.locator("#app-access-splash")).toBeVisible();
 await expect(page.locator(".app-access-panel")).toBeHidden();
 await expect(page.locator("body > .app")).toBeHidden();
 await expect(page.locator(".app-access-splash-emblem img")).toHaveAttribute("src","./assets/spvgg-schmetterlinge-splash.svg");
 await expect(page.locator(".app-access-splash-emblem img")).toHaveCSS("mix-blend-mode","multiply");
 await expect(page.locator(".app-access-shuttle")).toHaveAttribute("src","./assets/shuttlecock-splash.svg");
 await expect(page.locator("#app-access-splash .app-access-visually-hidden")).toContainText("Zugang wird geprüft");
 await expect(page.locator(".app-access-shuttle")).toHaveCSS("animation-name","app-access-shuttle-flight");
 const actual=await page.locator("#app-access-splash").evaluate(el=>({
  display:getComputedStyle(el).display,
  artWidth:el.querySelector(".app-access-splash-art").getBoundingClientRect().width,
  logoWidth:el.querySelector(".app-access-splash-emblem").getBoundingClientRect().width,
  duration:getComputedStyle(el.querySelector(".app-access-shuttle")).animationDuration
 }));
 expect(actual.display).toBe("grid");
 expect(actual.artWidth).toBeGreaterThan(100);
 expect(actual.logoWidth).toBeGreaterThan(100);
 expect(actual.duration).toBe("2.5s");

 // Validate visual choreography in the actual browser rather than only
 // checking that some animation-name exists. This caught the 27.10 iPhone report.
 const trajectory=await page.locator(".app-access-shuttle").evaluate(img=>{
  const animation=img.getAnimations().find(a=>a.effect?.getKeyframes);
  return (animation?.effect?.getKeyframes()||[]).filter(frame=>frame.transform)
   .map(frame=>{const matrix=new DOMMatrix(frame.transform);return {x:matrix.m41,y:matrix.m42};});
 });
 expect(trajectory.length).toBeGreaterThanOrEqual(5);
 expect(trajectory[0].x).toBeGreaterThan(140);
 expect(trajectory[0].y).toBeLessThan(-150);
 expect(trajectory.some(({x,y})=>x>=80&&x<=100&&y>=-30&&y<=60)).toBe(true);
 expect(trajectory.at(-1).x).toBeLessThan(50);
 expect(trajectory.at(-1).y).toBeGreaterThan(140);

 // Short cold starts must show more than a one-pixel glimpse on a 320px phone.
 // Freeze this synthetic frame after 0.8s: do not add a longer login delay.
 const earlyFlight=await page.locator(".app-access-shuttle").evaluate(img=>{
  const animation=img.getAnimations().find(a=>a.effect?.getKeyframes);
  if(!animation)return null;
  animation.pause();
  animation.currentTime=800;
  const stage=img.closest(".app-access-splash-art").getBoundingClientRect();
  const badge=img.parentElement.querySelector(".app-access-splash-emblem").getBoundingClientRect();
  const frame=img.getBoundingClientRect();
  const info={visibleWidth:Math.max(0,Math.min(frame.right,innerWidth)-Math.max(frame.left,0)),
   clearsBadge:frame.left>=badge.right-2, badgeRight:badge.right,
   viewport:innerWidth,stageWidth:stage.width,visibleRight:frame.right};
  animation.play();
  return info;
 });
 expect(earlyFlight).not.toBeNull();
 expect(earlyFlight.viewport).toBe(320);
 expect(earlyFlight.visibleWidth).toBeGreaterThan(55);
 expect(earlyFlight.visibleRight).toBeLessThanOrEqual(324);
 expect(earlyFlight.clearsBadge).toBe(true);

 // Preserve reproducible 320px Chromium AND iPhone-WebKit visual evidence.
 // Synthetic session only; never screenshot a real player's private data.
 // Freeze at exact times, rather than relying on nondeterministic screenshot timing.
 const shuttle=page.locator(".app-access-shuttle");
 for(const [ms,label] of [[800,"entry-800ms"],[1650,"descent-1650ms"],[2250,"exit-2250ms"]]){
  await shuttle.evaluate((img,time)=>{
   const animation=img.getAnimations().find(a=>a.effect?.getKeyframes);
   if(!animation)throw Error("Missing shuttle animation for visual evidence");
   animation.pause();
   animation.currentTime=time;
  },ms);
  await testInfo.attach("splash-"+label+"-"+testInfo.project.name,{
   body:await page.screenshot({fullPage:false,animations:"allow"}),
   contentType:"image/png"
  });
 }
 await shuttle.evaluate(img=>img.getAnimations().forEach(animation=>animation.play()));

 const screenReaderOnly=await page.locator(".app-access-visually-hidden").evaluate(el=>({
  width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,
  clip:getComputedStyle(el).clip
 }));
 expect(screenReaderOnly.width).toBeLessThanOrEqual(1);
 expect(screenReaderOnly.height).toBeLessThanOrEqual(1);
 expect(screenReaderOnly.clip).not.toBe("auto");

 // Finish access only after checking-state measurements, then verify cleanup.
 } finally {
  finishCheck();
 }
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("body > .app")).toBeVisible();
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 // Verify the actual SVG finishes decoding and contains 16 feathers AFTER
 // granting access. WebKit can defer image decode until page load; waiting for
 // naturalWidth while the RPC is held artificially triggers the real auth
 // timeout and incorrectly switches the splash to the denied/error panel.
 await expect(page.locator(".app-access-shuttle")).toHaveJSProperty("naturalWidth",96);
 const svg=await page.evaluate(async()=>{
  const r=await fetch("./assets/shuttlecock-splash.svg");
  return r.ok?await r.text():"";
 });
 expect(svg.match(/class="feather"/g)).toHaveLength(16);
 const stored=await page.evaluate(()=>localStorage.getItem("schmetterlinge.communitySession.v1"));
 expect(stored).toContain("synthetic-access-token");
});

// Responsive visual contract: the shuttle is visible AND does not cross the logo.
// The full 320px screenshot test above also checks the invitation/access lifecycle.
for(const width of [351,390,430]){
 test("responsive shuttle keeps clear of badge at "+width+"px",async({page})=>{
  await withExistingSession(page);
  let release;
  const pending=new Promise(resolve=>{release=resolve});
  await page.route(API+"/rest/v1/rpc/app_access_status",async route=>{
   if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
   await pending;
   await route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
  });
  try{
   await page.setViewportSize({width,height:780});
   await page.goto("/",{waitUntil:"commit"});
   await expect(page.locator("#app-access-splash")).toBeVisible();
   // waitUntil:commit can race the stylesheet download on cold WebKit.
   // Do not weaken the position assertions; measure only after CSS is loaded.
   await expect(page.locator(".app-access-shuttle")).toHaveCSS("animation-name","app-access-shuttle-flight");
   await expect.poll(()=>page.locator(".app-access-shuttle").evaluate(img=>
    img.getAnimations().some(a=>a.effect?.getKeyframes)),{timeout:10000}).toBe(true);
   const frame=await page.locator(".app-access-shuttle").evaluate(img=>{
    const a=img.getAnimations().find(a=>a.effect?.getKeyframes);
    if(!a)return null;
    a.pause();a.currentTime=800;
    const bird=img.getBoundingClientRect();
    const badge=img.parentElement.querySelector(".app-access-splash-emblem").getBoundingClientRect();
    return {left:bird.left,right:bird.right,badgeRight:badge.right,viewport:innerWidth};
   });
   expect(frame).not.toBeNull();
   expect(frame.left).toBeGreaterThanOrEqual(frame.badgeRight-2);
   expect(frame.right).toBeLessThanOrEqual(frame.viewport+2);
  }finally{release();}
  await expect(page.locator("#app-access-gate")).toBeHidden();
 });
}
test("v221 fast successful cold launch shows intro for 0.8s; warm navigation never restarts splash",async({page})=>{
 await withExistingSession(page);
 await page.route(API+"/rest/v1/rpc/app_access_status",route=>
  route.request().method()==="OPTIONS"
   ?route.fulfill({status:204,headers,body:""})
   :route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'}));
 await page.goto("/",{waitUntil:"commit"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted",{timeout:12000});
 // Navigation-relative clock: the fast synthetic membership RPC cannot cut
 // the intro short. Slow asset loads can legitimately make total time longer.
 expect(await page.evaluate(()=>performance.now())).toBeGreaterThanOrEqual(780);
 await page.evaluate(()=>{location.hash="#spieler"});
 await expect(page.locator("#view-spieler")).toBeVisible();
 await expect(page.locator("#app-access-splash")).toBeHidden();
 await page.evaluate(()=>{location.hash="#start"});
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator("#app-access-splash")).toBeHidden();
});

test("a failed status check offers a working retry instead of trapping the user in animation",async({page})=>{
 await withExistingSession(page);
 let recovered=false;
 await page.route(API+"/rest/v1/rpc/app_access_status",route=>
  route.request().method()==="OPTIONS"
   ?route.fulfill({status:204,headers,body:""})
   :recovered
    ?route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'})
    :route.fulfill({status:503,headers,body:'{"message":"offline"}'}));
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","denied");
 await expect(page.locator("#app-access-splash")).toBeHidden();
 await expect(page.locator(".app-access-panel")).toBeVisible();
 await expect(page.locator("#app-access-status")).toContainText("Zugangsdienst nicht erreichbar");
 await expect(page.locator("#app-access-code")).toBeVisible();
 await expect(page.locator("#app-access-retry")).toBeVisible();
 await expect(page.locator("body > .app")).toBeHidden();
 recovered=true;
 await page.locator("#app-access-retry").click();
 await expect(page.locator("#app-access-retry")).toBeHidden();
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("body > .app")).toBeVisible();
});
test("reduced motion keeps the shuttle static while a session is being checked",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 await withExistingSession(page);
 await page.route(API+"/rest/v1/rpc/app_access_status",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  await new Promise(resolve=>setTimeout(resolve,650));
  await route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto("/",{waitUntil:"commit"});
 await expect(page.locator("#app-access-splash")).toBeVisible();
 await expect(page.locator(".app-access-shuttle")).toHaveCSS("animation-name","none");

 await expect(page.locator("#app-access-gate")).toBeHidden({timeout:12000});
});

test("splash-specific club logo actually has transparent white corners",async({page})=>{
 await page.goto("/",{waitUntil:"domcontentloaded"});
 const corners=await page.evaluate(async()=>{
  const image=new Image();
  image.src="./assets/spvgg-schmetterlinge-splash.svg";
  await image.decode();
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=192;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(image,0,0,192,192);
  return [[0,0],[191,0],[0,191],[191,191]].map(([x,y])=>
   ctx.getImageData(x,y,1,1).data[3]);
 });
 expect(Math.max(...corners),"The original photo's white square must be removed, not merely covered").toBeLessThan(40);
});
