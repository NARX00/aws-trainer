(()=>{const STORE=window.__MOCKSTORE||{};window.__writes=[];
const snap=(path)=>{const d=STORE[path];return{id:path.split('/').pop(),exists:!!d,data:()=>d?JSON.parse(JSON.stringify(d)):undefined,metadata:{fromCache:false,hasPendingWrites:false}}};
const delay=v=>new Promise(r=>setTimeout(()=>r(v),20));
const docRef=p=>({id:p.split('/').pop(),path:p,get:()=>delay(snap(p)),set:d=>{STORE[p]=JSON.parse(JSON.stringify(d));window.__writes.push(['set',p]);return delay()},update:d=>{if(!STORE[p])return Promise.reject({code:'invalid_argument'});Object.assign(STORE[p],d);return delay()},delete:()=>{delete STORE[p];return delay()}});
const coll=(p,lim=1000)=>({path:p,doc:id=>docRef(p+'/'+id),limit:n=>coll(p,n),get:()=>{const docs=Object.keys(STORE).filter(k=>k.startsWith(p+'/')&&k.split('/').length===p.split('/').length+1).sort().slice(0,lim).map(snap);return delay({docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false}})}});
const db={doc:docRef,collection:p=>coll(p)};
const user={id:async()=>'u1',canEdit:async()=>true,isOwner:async()=>true,can:async()=>true};
window.claude={use:name=>delay(name==='db'?db:name==='user'?user:null)};window.__STORE=STORE;})();
