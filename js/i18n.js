(function(root){
 'use strict';
 const options=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
 function resolve(value){
  if(options.includes(value))return value;
  const v=String(value||'').toLowerCase();
  if(v.startsWith('zh'))return /hant|tw|hk|mo/.test(v)?'zh-Hant':'zh-Hans';
  if(v.startsWith('pt'))return 'pt-BR';
  return options.find(x=>x.toLowerCase()===v.split('-')[0])||null;
 }
 function stored(){try{return localStorage.getItem('songen_language')}catch(_){return null}}
 let language=resolve(stored())||(navigator.languages||[navigator.language]).map(resolve).find(Boolean)||'en';
 function t(key,values={}){const text=root.SongenMessages?.[language]?.[key]??root.SongenMessages?.en?.[key]??root.SongenMessages?.ja?.[key]??key;return text.replace(/\{(p\d+)\}/g,(_,k)=>String(values[k]??''));}
 function apply(){
  document.documentElement.lang=language;
  document.querySelectorAll('[data-i18n]').forEach(el=>{if(!el.dataset.dynamic)el.textContent=t(el.dataset.i18n)});
  for(const attr of ['placeholder','aria-label'])document.querySelectorAll(`[data-i18n-${attr}]`).forEach(el=>el.setAttribute(attr,t(el.getAttribute(`data-i18n-${attr}`))));
 }
 function set(value){if(!options.includes(value))return;language=value;try{localStorage.setItem('songen_language',value)}catch(_){}apply();document.dispatchEvent(new Event('songenlanguagechange'));}
 root.SongenI18n={t,apply,set,resolve,options,get language(){return language}};
})(globalThis);
