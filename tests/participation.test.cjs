const test=require('node:test'); const assert=require('node:assert/strict');const p=require('../js/participation.js');
const id='00000000-0000-4000-8000-000000000001';
const storage=()=>({data:{},getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=v}});
test('empty and whitespace names never become public; local2p stays excluded',()=>{
 for(const name of ['', ' \t ']) assert.equal(p.begin(name,'cpu',()=>id).eligible,false);
 assert.equal(p.begin('名','local2p',()=>id).eligible,false);
});
test('start name and eligibility cannot be changed later',()=>{
 let name='甲';const play=p.begin(name,'cpu',()=>id);name='乙';const r=p.finish(play,12.9,'v');
 assert.equal(r.name,'甲');assert.equal(r.id,id);assert.equal(r.score,12);assert.equal(Object.isFrozen(play),true);
 const guest=p.finish(p.begin('','cpu',()=>id),20,'v');assert.equal(guest.eligible,false);
});
test('pending A and B coexist; same receipt uses the same id and payload',()=>{
 const s=storage();const a=p.finish(p.begin('甲','cpu',()=>id),7,'v');const b=p.finish(p.begin('乙','cpu',()=>id.slice(0,-1)+'2'),8,'v');
 assert.equal(p.save(s,a),true);assert.equal(p.save(s,b),true);assert.equal(Object.keys(p.read(s)).length,2);
 p.save(s,{...a,status:'sent'});assert.equal(p.read(s)[id].score,7);assert.equal(Object.keys(p.read(s)).length,2);
});
test('storage denial and malformed records do not break play or discard unknown records',()=>{
 const bad={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};assert.deepEqual(p.read(bad),{});
 const r=p.finish(p.begin('甲','cpu',()=>id),1,'v');assert.equal(p.save(bad,r),false);
 const s=storage();s.data[p.KEY]='{"unknown":{"old":true}}';assert.equal(p.save(s,r),true);
 assert.deepEqual(JSON.parse(s.data[p.KEY]).unknown,{old:true});assert.equal(Object.keys(p.read(s)).length,1);
});
