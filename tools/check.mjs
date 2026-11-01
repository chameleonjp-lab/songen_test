import {readFileSync,readdirSync} from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8');for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
for(const file of readdirSync('js'))new vm.Script(readFileSync('js/'+file,'utf8'));
assert.ok(html.includes('p_limit: 30'));assert.ok(!html.includes('/rpc/submit_score`'));assert.ok(html.includes('songen_wo_kakeyouka'));
const context={};vm.runInNewContext(readFileSync('js/messages.js','utf8'),context);
const keys=Object.keys(context.SongenMessages.ja);const locales=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
for(const locale of locales){const d=context.SongenMessages[locale];assert.ok(d,'missing locale '+locale);assert.deepEqual(Object.keys(d).sort(),keys.slice().sort());for(const key of keys){assert.equal(typeof d[key],'string');assert.ok(d[key].trim());assert.deepEqual((d[key].match(/\{p\d+\}/g)||[]).sort(),(context.SongenMessages.ja[key].match(/\{p\d+\}/g)||[]).sort(),locale+' '+key)}}
console.log('Syntax, score endpoint, 30-row request, 15 complete locale key/placeholder checks passed. Native language quality remains separate.');
