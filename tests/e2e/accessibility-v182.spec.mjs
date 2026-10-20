import {test,expect} from "./invited-member.fixture.mjs";
// Only synthetic UI. All Supabase traffic is mocked/denied by fixture and
// browser's loopback-only proxy; screenshots contain no personal data.
for(const width of [320,390,1280,1440,1920]){
 test("v182 contrast/readability "+width+"px",async({page},testInfo)=>{
  await page.addInitScript(()=>{
   localStorage.setItem("shuttleboard-v1",JSON.stringify({
    players:[{id:"99-000001",name:"Testprofil",club:"Testverein",birthYear:2015}],
    friends:[],officialLinks:[],activeProfileId:"99-000001",chosen:"99-000001",
    historyProfilesInitialized:true
   }));
  });
  await page.setViewportSize({width,height:850});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  await expect(page.locator("#view-start")).toBeVisible();
  // Visual-only fixture. No identity/ranking/points are written or requested.
  await page.locator("#dashboard-rankings").evaluate(root=>{
   root.innerHTML='<button type="button" class="ranking-tile ranking-compact" aria-label="synthetischer Rang"><span class="ranking-top">Einzel</span><span class="ranking-bw-title">BW · U11</span><span class="ranking-bw-row"><strong>#4</strong><span class="movement movement-up">↑ 2</span></span><span class="ranking-de-row"><span>DE</span><strong>#9</strong></span><span class="ranking-compact-points">200 <small>Pts.</small></span><span class="ranking-compact-footer">U11 · KW 42/2026 <span>›</span></span></button>';
  });
  await page.locator("#dashboard-friends").evaluate(root=>{
   root.innerHTML='<p class="friends-empty">Noch keine Freunde. Mit dem + oben kannst du Spielern folgen.</p>';
  });
  const measure=await page.evaluate(()=>{
   const el=s=>document.querySelector(s);
   const css=(s,k)=>getComputedStyle(el(s))[k];
   const toRgb=value=>{
    const a=value.match(/[\d.]+/g)?.slice(0,3).map(Number)||[0,0,0];
    return a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
   };
   const luminance=v=>toRgb(v).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
   const contrast=(a,b)=>{
    const x=luminance(a),y=luminance(b);
    return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
   };
   const pairing=(front,back)=>({ratio:contrast(css(front,"color"),css(back,"backgroundColor")),
    size:parseFloat(css(front,"fontSize"))});
   return {
    ranking:pairing(".ranking-bw-row strong",".ranking-tile"),
    de:pairing(".ranking-de-row strong",".ranking-tile"),
    footer:pairing(".ranking-compact-footer",".ranking-tile"),
    empty:pairing(".friends-empty",".friends-empty"),
    friendHeading:pairing(".dashboard-friends-section .section-heading h2",".dashboard-friends-section"),
    scrollOverflow:document.documentElement.scrollWidth-innerWidth,
    rankingBox:el(".ranking-tile").getBoundingClientRect().toJSON()
   };
  });
  expect(measure.scrollOverflow,"horizontal overflow at "+width).toBeLessThanOrEqual(2);
  if(width>=1080){
   for(const key of ["ranking","de","footer","empty","friendHeading"]){
    expect(measure[key].ratio,key+" "+width+" color contrast").toBeGreaterThanOrEqual(4.5);
   }
   expect(measure.footer.size).toBeGreaterThanOrEqual(14);
   expect(measure.ranking.size).toBeGreaterThanOrEqual(35);
  }else{
   expect(measure.footer.size).toBeGreaterThanOrEqual(11);
   expect(await page.locator(".bottom-nav .nav-icon").first().evaluate(
    n=>parseFloat(getComputedStyle(n).width))).toBeGreaterThanOrEqual(24);
   await expect(page.locator("#match-stats-values")).toBeVisible();
  }
  await testInfo.attach("v182-"+width+"px-"+testInfo.project.name,{
   body:await page.screenshot({animations:"disabled"}),
   contentType:"image/png"
  });
 });
}
