import {test,expect} from './invited-member.fixture.mjs';
const own=[{id:'99-000001',name:'Eigenes A'},{id:'99-000002',name:'Eigenes B'}];
test.beforeEach(async({page})=>{await page.addInitScript(profiles=>{
 if(!localStorage.getItem('shuttleboard-v1'))localStorage.setItem('shuttleboard-v1',JSON.stringify({
 players:profiles,friends:[{id:'98-000003',name:'Gefolgt'}],officialLinks:[],
 activeProfileId:profiles[0].id,chosen:profiles[0].id,historyProfilesInitialized:true}));
},own)});
test('F10 Pong 320px: own profiles, controls, pause and exit never publish',async({page})=>{
 await page.setViewportSize({width:320,height:700});await page.goto('/#spiele');
 await page.locator('#arcade-game').selectOption('pong');
 await expect(page.locator('#arcade-pong-shell')).toBeVisible();
 await expect(page.locator('#arcade-snake-shell')).toBeHidden();
 await expect(page.locator('#arcade-2048-shell')).toBeHidden();
 await expect(page.locator('#arcade-pong-profile option')).toHaveCount(2);
 await expect(page.locator('#arcade-pong-profile')).not.toContainText('Gefolgt');
 await expect(page.locator('#arcade-pong-time')).toHaveText('90 s');
 const rect=await page.locator('#arcade-pong-board').boundingBox();
 expect(rect.width).toBeLessThanOrEqual(320);expect(rect.height).toBeGreaterThan(100);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 await page.locator('#arcade-pong-start').click();
 await expect(page.locator('#arcade-pong-status')).toContainText('Start in');
 await expect(page.locator('#arcade-game')).toBeDisabled();
 await page.locator('#arcade-pong-pause').click();
 await expect(page.locator('#arcade-pong-status')).toContainText('Pausiert');
 const time=await page.locator('#arcade-pong-time').textContent();
 await page.waitForTimeout(350);expect(await page.locator('#arcade-pong-time').textContent()).toBe(time);
 await page.locator('#arcade-pong-resume').click();
 await page.locator('#arcade-pong-exit').click();
 await expect(page.locator('#view-turniere')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('schmetterlinge-arcade-pong-v1'))).toBeNull();
});
test('F10 Pong: private profile records stay separate from Snake and 2048',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('schmetterlinge-arcade-pong-v1',JSON.stringify({version:1,records:[
 {profileId:'99-000001',arcadeId:'11111111-1111-4111-8111-111111111111',best:17,modeVersion:1},
 {profileId:'99-000002',arcadeId:'22222222-2222-4222-8222-222222222222',best:9,modeVersion:1}]})));
 await page.goto('/#spiele');await page.locator('#arcade-game').selectOption('pong');
 await expect(page.locator('#arcade-pong-best')).toHaveText('17');
 await page.locator('#arcade-pong-profile').selectOption('99-000002');
 await expect(page.locator('#arcade-pong-best')).toHaveText('9');
 await page.locator('#arcade-game').selectOption('2048');
 await expect(page.locator('#arcade-pong-shell')).toBeHidden();
 await expect(page.locator('#arcade-2048-best')).toHaveText('0');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shuttleboard-v1')).players)).toEqual(own);
});
