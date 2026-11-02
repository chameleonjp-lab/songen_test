import {chromium,webkit} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {inspectShareTarget} from './share-visibility.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),origin='https://songen.test',official='https://chameleonjp.codeberg.page/songen_wo_kakeyouka/';
const locales=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
const allowed=new Set(['index.html','js/messages.js','js/i18n.js','js/audio.js','js/participation.js','assets/social-card.png']);
const engine=process.env.BROWSER||'chromium';assert.ok(['chromium','webkit'].includes(engine));
const out=path.join(root,'test-results/share-visible');fs.mkdirSync(out,{recursive:true});const receipts=[];
const browser=await ({chromium,webkit})[engine].launch({headless:true});
try{
 for(const lang of locales)for(const orientation of ['portrait',...(['ja','en','de'].includes(lang)?['landscape']:[])]){
  const context=await browser.newContext({viewport:orientation==='portrait'?{width:393,height:852}:{width:852,height:393},hasTouch:true,locale:lang,serviceWorkers:'block'}),forbidden=[],errors=[];let popupExpected=null;const popupRequests=[];
  await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());
   if(popupExpected&&r.url()===popupExpected&&r.method()==='GET'){popupRequests.push(r.url());return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated X composer target</title><p>Network-isolated popup boundary</p>'})}
   if(u.origin==='https://mlpnjgezrnhdxsxolyzj.supabase.co'&&u.pathname==='/rest/v1/rpc/get_best_score_ranking'&&r.method()==='POST')return route.fulfill({json:[]});
   const relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
   if(u.origin!==origin||!['GET','HEAD'].includes(r.method())||!allowed.has(relative)){forbidden.push({method:r.method(),origin:u.origin,path:u.pathname});return route.abort('blockedbyclient')}
   return route.fulfill({contentType:relative.endsWith('.html')?'text/html':relative.endsWith('.png')?'image/png':'application/javascript',body:r.method()==='HEAD'?Buffer.alloc(0):fs.readFileSync(path.join(root,relative))});
  });
  await context.routeWebSocket('**/*',ws=>{forbidden.push({webSocket:true});ws.close()});
  await context.addInitScript(language=>{localStorage.setItem('songen_language',language);localStorage.setItem('songen_sound','off');localStorage.setItem('songen_volume','0');window.__activeScreenObservation=()=>{const known=['homeScreen','setupScreen','battleScreen','outcomeScreen','resultScreen','onlineLobbyScreen'];const active=[...document.querySelectorAll('.screen.active')];return {ids:active.map(x=>x.id).filter(id=>known.includes(id)),unknown:active.some(x=>!known.includes(x.id))}};window.__navEvents=[];for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event=>{const target=event.target?.closest?.('button')?.id;const allowed=['outcomeResultBtn','resultLabBtn','retryBtn','resultShareBtn'];if(!allowed.includes(target))return;const entry={type,target,at:performance.now(),before:window.__activeScreenObservation()};window.__navEvents.push(entry);queueMicrotask(()=>{entry.microtaskAfter=window.__activeScreenObservation()})},true);window.__intents=[];window.__copied=[];window.__nativeOpen=window.open;window.open=url=>{window.__intents.push(url);return null};Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copied.push(text)}});},lang);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);assert.equal(await page.locator('#languageSelect').inputValue(),lang);
  async function share(screen,expected){
   const button=page.locator(screen==='home'?'#homeShareBtn':'#resultShareBtn');await button.scrollIntoViewIfNeeded();const geometry=await button.evaluate(inspectShareTarget);
   for(const k of ['visible','viewport','unclipped','hit','fits'])assert.equal(geometry[k],true,`${lang} ${orientation} ${screen} ${k} ${JSON.stringify(geometry)}`);assert.ok(geometry.width>=44&&geometry.height>=44);
   assert.equal(await button.textContent(),await page.evaluate(()=>SongenI18n.t('m008')));assert.deepEqual(await button.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})),{background:'rgb(0, 0, 0)',color:'rgb(255, 255, 255)'});
   if(['ja','en','de'].includes(lang))await page.screenshot({path:path.join(out,`${engine}-${lang}-${orientation}-${screen}.png`)});
   const count=await page.evaluate(()=>__intents.length);await button.tap();const intents=await page.evaluate(()=>__intents);assert.equal(intents.length,count+1);const intent=new URL(intents.at(-1));assert.equal(intent.origin,'https://twitter.com');assert.equal(intent.pathname,'/intent/tweet');assert.equal(intent.searchParams.get('text'),expected);assert.ok(expected.endsWith('\n#尊厳を賭けようか #ゲーム制作'));
   // Existing noopener/popup fallback remains usable; this is not an ordinary standalone share-copy UI.
   assert.equal(await page.locator('#shareFallbackText').inputValue(),expected);assert.equal(await page.locator('#copyShareBtn').isVisible(),true);await page.locator('#closeShareBtn').click();return geometry;
  }
  const home=await share('home',await page.evaluate(url=>SongenI18n.t('m121',{p0:GAME.title,p1:url}),official));
  if(lang==='ja'&&orientation==='portrait'){
   // Separate guarded page: native popup is its first gesture, not a tap inside the real 250ms debounce window.
   const nativePage=await context.newPage();nativePage.on('pageerror',e=>errors.push(e.message));await nativePage.goto(origin);assert.equal(await nativePage.locator('#languageSelect').inputValue(),lang);assert.equal(await nativePage.locator('#playerNameInput').inputValue(),'');assert.equal(await nativePage.evaluate(()=>Object.keys(SongenParticipation.read(localStorage)).length),0);
   const expected=await nativePage.evaluate(url=>SongenI18n.t('m121',{p0:GAME.title,p1:url}),official);popupExpected='https://twitter.com/intent/tweet?text='+encodeURIComponent(expected);
   await nativePage.evaluate(()=>{window.__stubOpen=window.open;window.__nativeAttempts=[];window.open=(...args)=>{window.__nativeAttempts.push({active:!!navigator.userActivation?.isActive});return window.__nativeOpen.apply(window,args)}});
   const popupPromise=context.waitForEvent('page');await nativePage.locator('#homeShareBtn').tap();let popup;try{popup=await popupPromise}catch(error){fs.writeFileSync(path.join(out,`${engine}-native-popup-failure.json`),JSON.stringify({attempts:await nativePage.evaluate(()=>__nativeAttempts),requestCount:popupRequests.length,forbiddenCount:forbidden.length,errorCount:errors.length},null,2));throw error}assert.equal(await nativePage.evaluate(()=>__nativeAttempts.length),1);await popup.waitForURL(popupExpected);assert.equal(await popup.title(),'Isolated X composer target');assert.deepEqual(popupRequests,[popupExpected]);
   assert.equal(await nativePage.locator('#shareFallbackText').inputValue(),expected);await popup.close();await nativePage.locator('#closeShareBtn').click();await nativePage.close();popupExpected=null;
   fs.writeFileSync(path.join(out,`${engine}-native-popup.json`),JSON.stringify({realWindowOpen:true,realPopup:true,firstGestureOnSeparatePage:true,nativeCalls:1,requests:popupRequests.length,upstreamRequests:0,fallbackPreserved:true},null,2));
  }
  await page.locator('#playerNameInput').fill('');await page.locator('#homeCpuBtn').tap();await page.locator('#setupStartBtn').tap();await page.waitForFunction(()=>state.running&&!state.ended);await page.locator('#retireBtn').tap();await page.locator('#outcomeScreen.active').waitFor();await page.locator('#outcomeResultBtn').tap();try{await page.locator('#resultScreen.active').waitFor()}catch(error){const diagnostic=await page.evaluate(()=>({events:__navEvents,active:window.__activeScreenObservation(),resultExists:!!lastResult,ended:state.ended}));fs.writeFileSync(path.join(out,`${engine}-${lang}-${orientation}-result-transition-failure.json`),JSON.stringify(diagnostic,null,2));await page.screenshot({path:path.join(out,`${engine}-${lang}-${orientation}-result-transition-failure.png`)});throw error}
  const before=await page.evaluate(()=>JSON.stringify(lastResult));assert.equal(await page.evaluate(()=>activePlay.name),'');const result=await share('result',await page.evaluate(()=>makeShareText(lastResult)));assert.equal(await page.evaluate(()=>JSON.stringify(lastResult)),before);
  assert.equal(await page.evaluate(()=>Object.keys(SongenParticipation.read(localStorage)).length),0);assert.equal(await page.evaluate(()=>localStorage.getItem('songen_sound')),'off');assert.equal(await page.evaluate(()=>localStorage.getItem('songen_volume')),'0');assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
  receipts.push({lang,orientation,home,result,anonymous:true,score:JSON.parse(before).score,productionWrites:0});await context.close();
 }
 fs.writeFileSync(path.join(out,`${engine}-receipt.json`),JSON.stringify(receipts,null,2));console.log(JSON.stringify({engine,cases:receipts.length,homeResult:true,productionWrites:0}));
}finally{await browser.close()}
