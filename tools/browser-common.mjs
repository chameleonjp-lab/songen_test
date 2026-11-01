// Isolated real-browser UI regression. Production requests never leave this process.
// Completion fixtures call existing game callbacks; this is not a full battle or device acceptance.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright';
const root=resolve(new URL('..',import.meta.url).pathname);
const hook=`;window.testApi={state,finishBattle,collectSettings,sendReceipt,loadResultRanking,get active(){return activePlay},get last(){return lastResult}};`;
const server=http.createServer(async(req,res)=>{try{const path=resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+'/'))throw Error('path');let body=await readFile(path);if(path.endsWith('/index.html'))body=body.toString().replace(/<\/script>\s*<\/body>/,hook+'</script></body>');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript'})[extname(path)]||'text/plain');res.end(body)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const engine=process.env.BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch();
const context=await browser.newContext({viewport:{width:402,height:874},locale:'ja-JP'});
const cors={'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, apikey, authorization'};
const calls=[],errors=[],blocked=[];let ackMode='ok',rankMode='ok';
const rankRows=Array.from({length:30},(_,i)=>({display_name:i<2?'同名':`人${i}`,score:100-i,rank_no:i<2?1:i+1}));
await context.route('**/*',async route=>{const request=route.request(),url=request.url();if(url.startsWith(origin+'/'))return route.continue();if(url.includes('/rest/v1/rpc/')){if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});const rpc=url.split('/').at(-1),payload=request.postDataJSON();calls.push({rpc,payload});if(rpc==='submit_score_once_shared_v1'){
 if(ackMode==='lost')return route.abort();
 const row={accepted:true,result_normalized_name:payload.p_display_name,result_display_name:payload.p_display_name,result_first_score:payload.p_score,result_best_score:payload.p_score,result_play_count:1,is_first_play:true,is_new_best:true,was_duplicate:false};
 return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(ackMode==='malformed'?{accepted:true}:ackMode==='wrong-name'?[{...row,result_display_name:'別人'}]:[row])});
 }if(rpc==='get_best_score_ranking')return route.fulfill({status:rankMode==='failure'?503:200,headers:cors,contentType:'application/json',body:JSON.stringify(rankMode==='empty'?[]:rankMode==='invalid'?[{}]:rankRows)});
 throw Error('Unexpected RPC '+rpc);
 }blocked.push(url);await route.abort();});
await context.addInitScript(()=>{window.opened=[];window.open=(url)=>{window.opened.push(url);return null};window.originalSetItem=Storage.prototype.setItem;window.storageMode='ok';Storage.prototype.setItem=function(k,v){if(k==='songen_score_receipts_v1'){if(window.storageMode==='quota')throw Error('quota');if(window.storageMode==='silent')return;}return window.originalSetItem.call(this,k,v)};});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const sends=()=>calls.filter(c=>c.rpc==='submit_score_once_shared_v1');
async function home(){await page.goto(origin);await page.waitForFunction(()=>window.testApi&&window.SongenI18n);}
async function start(name='',mode='cpu'){await page.fill('#playerNameInput',name);await page.click(mode==='local2p'?'#homeLocal2pBtn':'#homeCpuBtn');await page.click('#setupStartBtn');await page.waitForFunction(()=>testApi.state.running&&!testApi.state.ended);assert.ok(await page.locator('#battleScreen').isVisible());}
async function finish(){await page.evaluate(()=>testApi.finishBattle('loss',5));await page.click('#outcomeResultBtn');await page.waitForFunction(()=>document.querySelector('#resultRankingContent li')||document.querySelector('#resultRankingContent').textContent===SongenI18n.t('m092'));await page.waitForFunction(()=>!testApi.last.receipt.eligible||document.querySelector('#sendStatus').textContent!==SongenI18n.t('m048'));}
try{
 await home();const locales=await page.evaluate(()=>SongenI18n.options);
 for(const lang of locales){await page.selectOption('#languageSelect',lang);assert.equal(await page.getAttribute('html','lang'),lang);assert.ok((await page.textContent('#nameDisclosure')).trim());assert.equal(await page.locator('.ranking-link').count(),2);for(const href of await page.locator('.ranking-link').evaluateAll(a=>a.map(x=>x.href)))assert.equal(href,'https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html?game=songen_wo_kakeyouka');
 await page.click('#homeShareBtn');const shared=await page.inputValue('#shareFallbackText');assert.ok(shared.includes('https://chameleonjp.codeberg.page/songen_wo_kakeyouka/'));await page.click('#closeShareBtn');
 const before=sends().length;await start('   ');const id=await page.evaluate(()=>testApi.active.id);await page.evaluate(()=>{const time=testApi.state.simulationTimeMs;SongenI18n.set(SongenI18n.language);if(testApi.state.simulationTimeMs!==time)throw Error('clock reset')});assert.equal(await page.evaluate(()=>testApi.active.id),id);await finish();assert.equal(sends().length,before);assert.equal(await page.locator('#resultRankingContent li').count(),30);assert.deepEqual(await page.locator('#resultRankingContent li').evaluateAll(a=>a.slice(0,2).map(x=>x.value)),[1,1]);await page.click('#resultShareBtn');assert.ok((await page.inputValue('#shareFallbackText')).includes('https://chameleonjp.codeberg.page/songen_wo_kakeyouka/'));await page.click('#closeShareBtn');await page.click('#resultLabBtn');}
 await page.selectOption('#languageSelect','ja');await start('開始名');const id=await page.evaluate(()=>testApi.active.id);await page.evaluate(()=>{document.querySelector('#playerNameInput').value='後の名'});await finish();await page.waitForFunction(()=>Object.values(SongenParticipation.read(localStorage)).some(r=>r.status==='sent'));
 assert.equal(sends().at(-1).payload.p_display_name,'開始名');assert.equal(sends().at(-1).payload.p_submission_id,id);const count=sends().length;await page.evaluate(()=>testApi.sendReceipt(testApi.last.receipt));assert.equal(sends().length,count);await home();assert.equal(await page.locator('#submissionRetryBtn').isVisible(),false);
 // local2p is existing non-ranking play; online is only the existing in-page mock lobby.
 await start('ローカル','local2p');await finish();assert.equal(sends().length,count);await page.click('#resultLabBtn');await page.click('#homeOnlineBtn');assert.equal(await page.locator('#onlineLobbyScreen').isVisible(),true);await page.click('#onlineBackBtn');
 // Actual muted/volume-zero controls and reload persistence.
 await page.click('#soundToggle');await page.locator('#soundVolume').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))});await home();assert.equal(await page.getAttribute('#soundToggle','aria-pressed'),'false');assert.equal(await page.inputValue('#soundVolume'),'0');
 // Both thrown and silent storage failures must stop public submission.
 for(const mode of ['quota','silent']){await start('保存確認');await page.evaluate(m=>window.storageMode=m,mode);const before=sends().length;await finish();assert.equal(sends().length,before);assert.equal(await page.textContent('#sendStatus'),await page.evaluate(()=>SongenI18n.t('m093')));await page.evaluate(()=>{window.storageMode='ok'});assert.equal(await page.locator('#submissionRetryBtn').isVisible(),true);await page.click('#submissionRetryBtn');await page.waitForFunction(()=>document.querySelector('#sendStatus').textContent===SongenI18n.t('m094'));assert.equal(sends().length,before+1);await page.click('#resultLabBtn');}
 // Lost/invalid ACK keeps exactly the original ID and payload for explicit retry.
 for(const mode of ['lost','malformed','wrong-name']){ackMode=mode;await start('再送名');await finish();const first=sends().at(-1);await page.waitForFunction(()=>Object.values(SongenParticipation.read(localStorage)).some(r=>r.status==='failed'));ackMode='ok';await page.click('#submissionRetryBtn');await page.waitForFunction(()=>Object.values(SongenParticipation.read(localStorage)).every(r=>r.status==='sent'));assert.deepEqual(sends().at(-1).payload,first.payload);await page.click('#resultLabBtn');}
 // Real retry UI preserves malformed sibling bytes and submits two independent pending UUIDs.
 await start('');await finish();const seeded=await page.evaluate(()=>{const p=SongenParticipation,ids=[crypto.randomUUID(),crypto.randomUUID()];const records=p.read(localStorage);records.unknown={keep:'old uncertain payload'};for(const id of ids)records[id]=p.finish(p.begin('保留名','cpu',()=>id),42,'browser-fixture');localStorage.setItem(p.KEY,JSON.stringify(records));return ids});
 await home();await start('');await finish();const pendingBefore=sends().length;await page.click('#submissionRetryBtn');await page.waitForFunction(ids=>ids.every(id=>SongenParticipation.read(localStorage)[id]?.status==='sent'),seeded);assert.equal(sends().length,pendingBefore+2);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem(SongenParticipation.KEY)).unknown),{keep:'old uncertain payload'});
 const conflictBefore=sends().length;const conflict=await page.evaluate(async id=>{const p=SongenParticipation,r=p.read(localStorage)[id],raw=localStorage.getItem(p.KEY);await testApi.sendReceipt({...r,score:r.score+1});return raw===localStorage.getItem(p.KEY)},seeded[0]);assert.equal(conflict,true);assert.equal(sends().length,conflictBefore);
 await page.click('#resultLabBtn');
 // Safe text, unavailable/empty/invalid reads remain distinct, no test data sent.
 await start('');await finish();for(const mode of ['empty','failure','invalid','ok']){rankMode=mode;await page.evaluate(()=>testApi.loadResultRanking());if(mode==='ok')assert.equal(await page.locator('#resultRankingContent li').count(),30);else assert.equal(await page.locator('#resultRankingContent li').count(),0)}
 for(const size of [{width:320,height:568},{width:874,height:402}]){await page.setViewportSize(size);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#resultShareBtn').scrollIntoViewIfNeeded();assert.equal(await page.locator('#resultShareBtn').isVisible(),true)}
 assert.ok(calls.filter(c=>c.rpc==='get_best_score_ranking').every(c=>c.payload.p_limit===30));assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/${engine.name()}-result.png`,fullPage:true});console.log(`${engine.name()}: all15 real UI, actual CPU/local2p startup, result callback fixtures, online mock lobby, name/guest/quota/ACK/retry/ranking/share/off0 passed; production requests blocked`);
}finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
