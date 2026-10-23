import {test,expect} from "./supabase-isolated.fixture.mjs";

// F03 #227/#187: synthetic v2 grants. The fixture and Playwright's local-only
// proxy prohibit any real Supabase Auth, REST or RPC traffic.
const PLAYER="99-000001",OTHER="99-000002";
const INVITE="11111111-2222-4333-8444-555555555555";
const HEADERS={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
 "Content-Type":"application/json"
};
const MATCH={
 dbv_id:PLAYER,source_key:"synthetic:f03:match:1",category:"tournament",
 competition:"Fiktives Turnier",event:"JE U13",discipline:"Einzel",
 match_date:"2026-07-11",match_year:2026,player_side:1,winning_side:1,
 opponent_names:["Fiktiver Gegner"],partner_names:[],games:[[15,9],[15,11]],
 source_name:"Synthetische Quelle",source_kind:"test-fixture",
 source_url:"https://example.org/synthetic-evidence"
};
const TROPHY={
 id:"synthetic-f03-trophy",playerId:PLAYER,verified:true,place:3,
 date:"2026-07-11",event:"Fiktives Turnier",discipline:"Einzel",
 source:{url:"https://example.org/synthetic-evidence"}
};
async function setup(page,{scope="v2",revoked=false,session=true}={}){
 await page.addInitScript(({player,invite,session})=>{
  if(session)localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"synthetic-f03-jwt",refresh_token:"synthetic-f03-refresh",
   expires_at:Date.now()+3600000,
   user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  }));
  localStorage.setItem("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify([invite]));
  localStorage.setItem("schmetterlinge.acceptedPlayerInviteBindings.v1",JSON.stringify({[invite]:player}));
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[],friends:[{id:player,name:"Fiktive Person",club:"Testverein"}],
   viewingFriendId:player,activeProfileId:player,officialLinks:[]
  }));
 },{player:PLAYER,invite:INVITE,session});
 const calls=[];
 await page.route("**/*.supabase.co/**",route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()==="OPTIONS")
   return route.fulfill({status:204,headers:HEADERS,body:""});
  calls.push({path,body:request.postDataJSON?.()??null});
  const json=(value,status=200)=>route.fulfill({
   status,headers:HEADERS,body:JSON.stringify(value)
  });
  if(path.endsWith("/rpc/app_access_status"))
   return json({allowed:false,owner:false});
  if(path.endsWith("/rpc/private_player_access_read"))
   return json(revoked?null:{player:{dbv_id:PLAYER,name:"Fiktive Person"}});
  if(path.endsWith("/rpc/private_player_archive_read")){
   const input=request.postDataJSON();
   if(revoked||scope!=="v2"||input.p_invitation_id!==INVITE)return json(null);
   return json({dbv_id:PLAYER,kind:"match_card",scope_version:2,
    offset:input.p_offset,total:1,entries:input.p_offset===0?[MATCH]:[]});
  }
  if(path.endsWith("/rpc/private_player_trophies_read")){
   const input=request.postDataJSON();
   if(revoked||scope!=="v2"||input.p_invitation_id!==INVITE)return json(null);
   return json({player_dbv_id:PLAYER,scope:"player_grant",results:[TROPHY]});
  }
  // Neither an accepted player link nor a local follow is owner membership.
  if(path.endsWith("/rpc/private_owner_trophies_read")||
     path.endsWith("/rpc/private_player_owner_archive_read"))
   return json({message:"not owner"},403);
  return json({message:"not permitted"},403);
 });
 return calls;
}
async function readScopes(page,id){
 return page.evaluate(async player=>{
  const matches=await import("/scripts/private-match-source.mjs");
  const trophies=await import("/scripts/private-trophy-source.mjs");
  await Promise.all([
   matches.requestPrivateMatches(player,{force:true}),
   trophies.requestPrivateTrophies(player,{force:true})
  ]);
  return {matches:matches.matchArchiveSnapshot(player),
   trophies:trophies.trophySnapshot(player),
   broadMember:window.badmintonAppAccess.allowed,
   broadToken:window.badmintonAppAccess.accessToken};
 },id);
}
test("accepted v2 link reads only its own scoped matches and trophies, never global membership",async({page})=>{
 const calls=await setup(page);
 await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 const own=await readScopes(page,PLAYER);
 expect(own.broadMember).toBe(false);
 expect(own.broadToken).toBeNull();
 expect(own.matches.state).toBe("ready");
 expect(own.matches.rows).toEqual([MATCH]);
 expect(own.trophies.state).toBe("ready");
 expect(own.trophies.results).toEqual([TROPHY]);
 const foreign=await readScopes(page,OTHER);
 expect(foreign.matches.state).toBe("protected");
 expect(foreign.matches.rows).toEqual([]);
 expect(foreign.trophies.state).toBe("protected");
 expect(foreign.trophies.results).toEqual([]);
 expect(calls.some(c=>c.path.endsWith("/player_external_match_facts"))).toBe(false);
 expect(calls.filter(c=>c.path.endsWith("/rpc/private_player_archive_read"))
  .every(c=>c.body.p_invitation_id===INVITE)).toBe(true);
 expect(calls.filter(c=>c.path.endsWith("/rpc/private_player_trophies_read"))
  .every(c=>c.body.p_invitation_id===INVITE)).toBe(true);
});
test("legacy v1 link may open a narrow shell but cannot acquire v2 matches or trophies",async({page})=>{
 const calls=await setup(page,{scope:"v1"});
 await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 const result=await readScopes(page,PLAYER);
 expect(result.broadMember).toBe(false);
 expect(result.matches.state).toBe("protected");
 expect(result.matches.rows).toEqual([]);
 expect(result.trophies.state).toBe("protected");
 expect(result.trophies.results).toEqual([]);
 expect(calls.some(c=>c.path.endsWith("/rpc/private_player_archive_read"))).toBe(true);
 expect(calls.some(c=>c.path.endsWith("/rpc/private_player_trophies_read"))).toBe(true);
});
test("revoked server link cannot unlock the shell or return scoped content",async({page})=>{
 await setup(page,{revoked:true});
 await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeVisible();
 await expect(page.locator("body > .app")).toBeHidden();
 const result=await readScopes(page,PLAYER);
 expect(result.matches.state).toBe("protected");
 expect(result.trophies.state).toBe("protected");
 expect(result.broadMember).toBe(false);
});
test("an invitation id on a fresh browser without its accepted session grants nothing",async({page})=>{
 const calls=await setup(page,{session:false});
 await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeVisible();
 await expect(page.locator("body > .app")).toBeHidden();
 const result=await readScopes(page,PLAYER);
 expect(result.matches.state).toBe("protected");
 expect(result.trophies.state).toBe("protected");
 expect(calls.some(c=>c.path.endsWith("/rpc/private_player_archive_read"))).toBe(false);
 expect(calls.some(c=>c.path.endsWith("/rpc/private_player_trophies_read"))).toBe(false);
});
