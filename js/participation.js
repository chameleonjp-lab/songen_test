/* Game-scoped, immutable participation snapshots. No server writes here. */
(function(root) {
  'use strict';
  const KEY = 'songen_score_receipts_v1';
  function cleanName(value) { return String(value || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 12); }
  function begin(name, mode, uuid) {
    const displayName = cleanName(name);
    let id = null; try { id = uuid(); } catch (_) {}
    return Object.freeze({ id, name: displayName, eligible: mode === 'cpu' && !!displayName, mode });
  }
  function finish(play, score, version) {
    return Object.freeze({ id: play.id, name: play.name, eligible: play.eligible, mode: play.mode,
      score: Math.trunc(score), version, status: 'pending' });
  }
  function valid(x) { return x && typeof x.id === 'string' && /^[0-9a-f-]{36}$/i.test(x.id)
    && typeof x.name === 'string' && cleanName(x.name) === x.name && !!x.name && x.eligible === true
    && x.mode === 'cpu' && Number.isFinite(x.score) && Number.isInteger(x.score)
    && typeof x.version === 'string' && ['pending','sent','failed'].includes(x.status); }
  function samePayload(a,b) { return valid(a) && valid(b) && ['id','name','eligible','mode','score','version'].every(k => a[k] === b[k]); }
  function read(storage) {
    try { const records = JSON.parse(storage.getItem(KEY) || '{}');
      if (!records || Array.isArray(records) || typeof records !== 'object') return {};
      return Object.fromEntries(Object.entries(records).filter(([id,r]) => valid(r) && id === r.id));
    } catch (_) { return {}; }
  }
  function save(storage, receipt) {
    if (!valid(receipt)) return false;
    try {
      const raw=storage.getItem(KEY); const prior=raw ? JSON.parse(raw) : {};
      // Preserve malformed entries instead of destructively dropping unknown prior data.
      if (!prior || Array.isArray(prior) || typeof prior !== 'object') return false;
      const existing=prior[receipt.id];
      if (Object.prototype.hasOwnProperty.call(prior,receipt.id) && !samePayload(existing,receipt)) return false;
      const next=existing?.status==='sent' ? {...receipt,status:'sent'} : receipt;
      const serialized=JSON.stringify({...prior, [receipt.id]:next});
      storage.setItem(KEY, serialized); return storage.getItem(KEY)===serialized;
    } catch (_) { return false; }
  }
  const api = {KEY,cleanName,begin,finish,valid,samePayload,read,save};
  if (typeof module !== 'undefined') module.exports=api; else root.SongenParticipation=api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
