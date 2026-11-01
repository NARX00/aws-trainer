
/* ---------- claude.ai version: progress import, backup, mind map, Edit tab ---------- */

if(CTX.canEdit){const t=$('#tabEdit');if(t){t.hidden=false;t.onclick=()=>go('edit');}}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-editq]');if(!b)return;
  const q=byId[+b.dataset.editq];if(!q)return;ED.sel=q.i;ED.draft=null;ED.msg='';ED.q=q.r[0];go('edit');});

/* progress import from the old local trainer file */
function showImport(){
  const bar=$('#importBar');if(!bar)return;
  if(Object.keys(S.p||{}).length||S.importDismissed){bar.hidden=true;bar.innerHTML='';return}
  bar.hidden=false;
  bar.innerHTML=`<div class="panel imp"><h3>Bring over your progress</h3>
  <p>In the old trainer file on your computer, open <b>Patterns</b> → <b>Backup / restore your study progress</b> → <b>Download progress backup</b>. Then choose that file here. Nothing is overwritten: your answers are merged.</p>
  <div class="row"><label class="btn small primary" for="impFile">Choose backup file</label><input type="file" id="impFile" accept=".json,application/json" hidden>
  <button type="button" class="btn small" id="impSkip">Start fresh</button><span class="note" id="impMsg" aria-live="polite"></span></div></div>`;
  $('#impFile').onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;
    try{const obj=JSON.parse(await f.text());
      if(!obj||typeof obj!=='object'||!obj.p||typeof obj.p!=='object'||Array.isArray(obj.p))throw Error('this file is not a trainer progress backup');
      S=merge(S,obj);save();render();
      $('#impMsg').textContent='Imported progress for '+Object.keys(obj.p).length+' questions.';
      setTimeout(()=>{bar.hidden=true;bar.innerHTML=''},3000);
    }catch(err){$('#impMsg').textContent='Could not import: '+err.message+'.'}};
  $('#impSkip').onclick=()=>{S.importDismissed=1;save();bar.hidden=true;bar.innerHTML=''};
}
showImport();

async function downloadBackup(){
  const txt=JSON.stringify(S,null,2),st=$('#pmImportStatus');
  if(CTX.downloads){
    try{await CTX.downloads.save({filename:'sap-c02-study-progress.json',data:txt});if(st)st.textContent='Backup saved.';return}
    catch(e){if(e&&e.code==='declined'){if(st)st.textContent='Download cancelled.';return}}
  }
  const ta=$('#pmRestore');if(ta){ta.value=txt;ta.select();}
  if(st)st.textContent='Downloads are not available here, so the backup is in the box above: copy it.';
}

/* mind map: opened inside this page */
let MAPSRC=null,MAPREADY=false;
async function openMap(hash){
  let ov=$('#mapOv');
  if(!ov){
    ov=document.createElement('div');ov.id='mapOv';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','AWS Service Mind Map');
    ov.innerHTML=`<div class="mapbar"><b>AWS Service Mind Map</b><span class="note" id="mapMsg" aria-live="polite"></span><button type="button" class="btn small" id="mapClose">Close map</button></div><iframe id="mapFrame" title="AWS Service Mind Map"></iframe>`;
    document.body.appendChild(ov);
    $('#mapClose').onclick=closeMap;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ov.hidden)closeMap()});
  }
  ov.hidden=false;document.documentElement.classList.add('mapopen');
  const fr=$('#mapFrame');
  const jump=()=>{try{const w=fr.contentWindow,p=new URLSearchParams((hash||'').replace(/^#/,''));
    if(p.get('svc')&&typeof w.jumpTo==='function')w.jumpTo(p.get('svc'));
    else if(p.get('task')&&typeof w.v40openTask==='function')w.v40openTask(p.get('task'));}catch(e){}};
  if(MAPREADY){jump();return}
  $('#mapMsg').textContent='Loading the map…';
  try{
    if(!MAPSRC){const r=await fetch('map.html');if(!r.ok)throw Error('it answered '+r.status);MAPSRC=await r.text();}
    fr.onload=()=>{MAPREADY=true;$('#mapMsg').textContent='';wireMap(fr);setTimeout(jump,600)};
    fr.srcdoc=MAPSRC;
  }catch(e){$('#mapMsg').textContent='Could not load the map: '+e.message+'.'}
}
function closeMap(){const ov=$('#mapOv');if(ov)ov.hidden=true;document.documentElement.classList.remove('mapopen')}
function wireMap(fr){
  try{fr.contentDocument.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[href*="SAP-C02-Trainer"]');if(!a)return;
    e.preventDefault();e.stopPropagation();closeMap();
    const p=new URLSearchParams(a.getAttribute('href').split('#')[1]||''),ts=p.get('ts');
    if(ts&&Q.some(q=>q.ts===ts))startDrill({kind:'ts',ts});
  },true)}catch(e){}
}
document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('a[href^="AWS_Service_Mind_Map"]');if(!a)return;
  e.preventDefault();openMap('#'+(a.getAttribute('href').split('#')[1]||''));
});
$('#openMap').onclick=()=>openMap('');

/* ---------- Edit tab (owner and editors) ---------- */
const ED={q:'',sel:null,draft:null,msg:'',t:null};
const LETTERS='ABCDEFGH';
function renderEdit(){
  const el=$('#v-edit');
  if(!CTX.canEdit){el.innerHTML='<div class="panel"><p>Only the page owner and editors can change questions.</p></div>';return}
  const term=ED.q.trim().toLowerCase();
  const hits=term?Q.filter(q=>q.r.some(l=>l.toLowerCase()===term)||(q.r.join(' ')+' '+q.s).toLowerCase().includes(term)).slice(0,30):[];
  const cur=ED.draft||(ED.sel!=null?byId[ED.sel]:null);
  el.innerHTML=`<div class="panel" style="display:grid;gap:10px"><h2>Edit questions</h2>
    <p class="muted">Changes go straight into the question bank and appear for everyone who opens this page. Study progress is not touched.</p>
    <div class="row"><input id="edQ" type="search" value="${esc(ED.q)}" placeholder="Label (A276) or words from the question" aria-label="Find a question" style="flex:1 1 260px;min-width:0"><button type="button" class="btn small" id="edNew">New question</button></div>
    ${term?`<div class="edhits">${hits.length?hits.map(q=>`<button type="button" class="item" data-ed="${q.i}"><span class="id">${esc(q.r.join(' · '))}</span><span class="tx">${esc(q.s.slice(0,160))}</span></button>`).join(''):'<p class="note">No question matches.</p>'}</div>`:'<p class="note">Type a label such as A276, or a few words from the question.</p>'}
  </div>${cur?edForm(cur):''}`;
  const inp=$('#edQ');
  inp.oninput=()=>{ED.q=inp.value;clearTimeout(ED.t);ED.t=setTimeout(()=>{renderEdit();const i=$('#edQ');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)};
  el.querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>{ED.sel=+b.dataset.ed;ED.draft=null;ED.msg='';renderEdit();$('#edForm').scrollIntoView({block:'start'})});
  $('#edNew').onclick=newQuestion;
  if(cur)wireForm(cur);
}
function edForm(q){
  const w=q.w||{y:'',o:{}},wo=w.o||{};
  const pt=q.pt||(PATAUTO[q.i]&&PATAUTO[q.i].p);
  const isNew=!byId[q.i];
  return `<form class="panel edform" id="edForm" novalidate>
  <div class="row" style="justify-content:space-between"><h3>${isNew?'New question':'Question '+esc(q.r.join(' · '))}</h3>${isNew?'':`<button type="button" class="btn small" id="edTry">Try it in Drill</button>`}</div>
  ${ED.msg?`<div class="edmsg" role="status">${ED.msg}</div>`:''}
  <div class="edgrid">
    <label class="f" for="edR">Labels (comma separated)<input id="edR" type="text" value="${esc(q.r.join(', '))}"></label>
    <label class="f" for="edTs">Exam task<select id="edTs">${Object.keys(TSN).map(k=>`<option value="${k}" ${q.ts===k?'selected':''}>${k} ${esc(TSN[k])}</option>`).join('')}</select></label>
    <label class="f" for="edPt">Pattern<select id="edPt">${PATMETA.map(m=>`<option value="${m.id}" ${pt===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>
  </div>
  <label class="f" for="edS">Question text<textarea id="edS" rows="8">${esc(q.s)}</textarea></label>
  <label class="f" for="edD">Deciding words (optional, e.g. LEAST operational overhead)<input id="edD" type="text" value="${esc(q.d||'')}"></label>
  <div class="edopts">${q.o.map((o,i)=>`<div class="edopt">
    <div class="row"><b>${LETTERS[i]}</b><label class="edck"><input type="checkbox" name="edA" value="${i}" ${(q.a||[]).includes(i)?'checked':''}> Correct answer</label></div>
    <textarea data-o="${i}" rows="3" aria-label="Option ${LETTERS[i]}">${esc(o)}</textarea>
    <label class="f" for="edW${i}">Why ${LETTERS[i]} is right or wrong<textarea id="edW${i}" data-w="${LETTERS[i]}" rows="2">${esc(wo[LETTERS[i]]||'')}</textarea></label>
  </div>`).join('')}</div>
  <div class="row"><button type="button" class="btn small" id="edAdd" ${q.o.length>=8?'disabled':''}>Add option</button><button type="button" class="btn small" id="edDel" ${q.o.length<=2?'disabled':''}>Remove last option</button></div>
  <label class="f" for="edY">Why (main explanation)<textarea id="edY" rows="4">${esc(w.y||'')}</textarea></label>
  <label class="f" for="edV">Answer chain: services in the right answer, in order (comma separated)<input id="edV" type="text" value="${esc((q.v||[]).join(', '))}"></label>
  <fieldset class="edtypes"><legend class="note">Scenario types</legend>${Object.keys(TYPES).map(k=>`<label class="edck"><input type="checkbox" name="edT" value="${k}" ${(q.t||[]).includes(+k)?'checked':''}> ${esc(TYPES[k])}</label>`).join('')}</fieldset>
  <details class="xb"><summary>Notes and source text</summary><div style="display:grid;gap:10px;margin-top:8px">
    <label class="f" for="edSt">Status today (a service closed or renamed)<textarea id="edSt" rows="2">${esc(q.st||'')}</textarea></label>
    <label class="f" for="edAlt">Disputed (why another answer is also argued)<textarea id="edAlt" rows="2">${esc(q.alt||'')}</textarea></label>
    <label class="f" for="edNt">Note (e.g. an image missing from the PDF)<textarea id="edNt" rows="2">${esc(q.nt||'')}</textarea></label>
    <label class="f" for="edE">Original explanation from the source<textarea id="edE" rows="4">${esc(q.e||'')}</textarea></label>
  </div></details>
  <div class="row"><button type="submit" class="btn primary" id="edSave">${isNew?'Add question':'Save changes'}</button><button type="button" class="btn" id="edCancel">Close</button></div>
  </form>`;
}
function readForm(base){
  const f=$('#edForm'),n=JSON.parse(JSON.stringify(base));
  const o=[...f.querySelectorAll('textarea[data-o]')].map(t=>t.value.trim());
  const wo={};f.querySelectorAll('textarea[data-w]').forEach(t=>{const L=t.dataset.w;if(t.value.trim()&&LETTERS.indexOf(L)<o.length)wo[L]=t.value.trim()});
  n.r=$('#edR').value.split(/[,·\s]+/).map(x=>x.trim()).filter(Boolean);
  n.ts=$('#edTs').value;n.dm=+n.ts[0];n.pt=$('#edPt').value;
  n.s=$('#edS').value.trim();n.o=o;
  n.a=[...f.querySelectorAll('input[name=edA]:checked')].map(c=>+c.value).filter(i=>i<o.length).sort();
  n.v=$('#edV').value.split(',').map(x=>x.trim()).filter(Boolean);
  n.t=[...f.querySelectorAll('input[name=edT]:checked')].map(c=>+c.value);
  const y=$('#edY').value.trim();
  if(y||Object.keys(wo).length||base.w)n.w={...(n.w||{}),y,o:wo,s:(n.w&&n.w.s)||[]};
  const opt=(k,id)=>{const v=$(id).value.trim();if(v)n[k]=v;else delete n[k]};
  opt('d','#edD');opt('st','#edSt');opt('alt','#edAlt');opt('nt','#edNt');
  n.e=$('#edE').value.trim();
  return n;
}
function checkQ(n){
  const errs=[];
  if(!n.r.length)errs.push('Add at least one label, for example N68.');
  n.r.forEach(l=>{
    if(!/^[A-Za-z0-9_.-]{1,40}$/.test(l))errs.push('Label "'+l+'" may use only letters, digits, dot, dash and underscore.');
    const o=Q.find(x=>x.i!==n.i&&x.r.includes(l));if(o)errs.push('Label '+l+' is already used by another question.');
  });
  if(n.s.length<20)errs.push('Write the question text.');
  if(n.o.length<2)errs.push('Give at least two options.');
  if(n.o.some(x=>!x))errs.push('Fill in every option, or remove the empty one.');
  if(!n.a.length)errs.push('Tick the correct answer.');
  if(!TSN[n.ts])errs.push('Pick an exam task.');
  return errs;
}
async function saveQ(cur){
  const n=readForm(cur),errs=checkQ(n);
  if(errs.length){ED.draft=n;ED.msg='<b>Not saved.</b> '+errs.map(esc).join(' ');renderEdit();return}
  const id=n._id||n.r[0],body={...n};delete body._id;
  const btn=$('#edSave');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{await CTX.db.doc('questions/'+id).set(body)}
  catch(e){ED.draft=n;ED.msg='<b>Not saved.</b> '+(e&&e.code==='invalid_argument'?'Only the owner and editors can change questions.':esc((e&&e.message)||'The database did not answer. Try again.'));renderEdit();return}
  n._id=id;
  if(byId[n.i]){const q=byId[n.i];Object.keys(q).forEach(k=>delete q[k]);Object.assign(q,n)}
  else{Q.push(n);byId[n.i]=n}
  PATAUTO[n.i]={p:n.pt,confidence:'high',source:'reviewed'};
  ED.draft=null;ED.sel=n.i;ED.msg='Saved '+esc(n.r.join(' · '))+'.';renderEdit();
}
function newQuestion(){
  const i=Math.max(...Q.map(q=>q.i))+1;
  const nmax=Math.max(0,...Q.flatMap(q=>q.r).filter(l=>/^N\d+$/.test(l)).map(l=>+l.slice(1)));
  ED.sel=null;ED.msg='';
  ED.draft={i,r:['N'+(nmax+1)],s:'',o:['','','',''],a:[],e:'',t:[],v:[],dm:1,ts:Object.keys(TSN)[0],pt:PATMETA[0]&&PATMETA[0].id,nw:1,w:{y:'',o:{},s:[]}};
  renderEdit();$('#edForm').scrollIntoView({block:'start'});
}
function wireForm(cur){
  const f=$('#edForm');
  f.onsubmit=e=>{e.preventDefault();saveQ(cur)};
  $('#edAdd').onclick=()=>{const d=readForm(cur);if(d.o.length<8)d.o.push('');ED.draft=d;ED.msg='';renderEdit()};
  $('#edDel').onclick=()=>{const d=readForm(cur);if(d.o.length>2){d.o.pop();d.a=d.a.filter(i=>i<d.o.length);if(d.w&&d.w.o)delete d.w.o[LETTERS[d.o.length]]}ED.draft=d;ED.msg='';renderEdit()};
  $('#edCancel').onclick=()=>{ED.draft=null;ED.sel=null;ED.msg='';renderEdit()};
  const tr=$('#edTry');if(tr)tr.onclick=()=>startDrill({kind:'list',ids:[cur.i],label:'Edited question'});
}
