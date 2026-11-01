"""Build the claude.ai version of the SAP-C02 trainer.

Input : web/src/shell.html  page code (questions are NOT in it; they live in the database)
        web/src/map.html    AWS Service Mind Map (opened inside the trainer)
        web/src/loader.js, extra.js, extra.css   claude.ai additions
Output: dist/trainer.html   the published page
        dist/map.html       published next to it

Run from anywhere:  python3 web/build.py
"""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'web', 'src')
OUT = os.path.join(ROOT, 'dist')
P = lambda *a: os.path.join(SRC, *a)
src = open(P('shell.html'), encoding='utf-8').read()
os.makedirs(OUT, exist_ok=True)


def rep(s, a, b, n=1):
    c = s.count(a)
    assert c == n, (c, a[:120])
    return s.replace(a, b)


def drop_block(s, bid):
    m = re.search(r'<script id="%s" type="application/json">.*?</script>\n?' % bid, s, re.S)
    return s[:m.start()] + s[m.end():] if m else s


# ---------- 1. remove data that now lives in the database ----------
for bid in ('qdata', 'pattern-map', 'pattern-meta'):
    src = drop_block(src, bid)

# ---------- 2. main script becomes a start function ----------
m = re.search(r'<script>\n?\(function\(\)\{\n"use strict";', src)
assert m, 'main start'
main_start = m.start()
main_end = src.find('</script>', main_start)
js = src[main_start + len('<script>'):main_end]

js = rep(js, '(function(){\n"use strict";',
         'window.__startTrainer=function(DATA,PATMETA_IN,PATAUTO_IN,CTX){\n"use strict";')
js = rep(js, "const DATA=JSON.parse(document.getElementById('qdata').textContent);\n", '')
js = rep(js, "const PATMETA=JSON.parse(document.getElementById('pattern-meta').textContent);",
         'const PATMETA=PATMETA_IN;')
js = rep(js, "const PATAUTO=JSON.parse(document.getElementById('pattern-map').textContent);",
         'const PATAUTO=PATAUTO_IN;')
assert js.rstrip().endswith('})();'), js[-40:]
js = js.rstrip()[:-len('})();')]

# progress: private per-viewer document, one write at a time
old_sync_start = js.index('let db=null, dref=null, saveT=null;')
old_sync_end = js.index('/* ---------- derived ---------- */')
js = js[:old_sync_start] + r'''let db=CTX.db, dref=null, saveT=null, saving=false, again=false;
function save(){S.u=Date.now();lsSave();if(dref){clearTimeout(saveT);saveT=setTimeout(flush,1500)}}
async function flush(){if(!dref)return;if(saving){again=true;return}saving=true;
  try{let body=JSON.parse(JSON.stringify(S));if(JSON.stringify(body).length>230000){body.log=(body.log||[]).slice(-100);}
    await dref.set(body);setSync('saved to your account')}
  catch(e){setSync(e&&e.code==='quota_exceeded'?'not saved: the database is full':'not saved to your account yet, kept in this browser')}
  saving=false;if(again){again=false;flush()}}
window.addEventListener('pagehide',()=>{if(saveT){clearTimeout(saveT);saveT=null;flush()}});
function setSync(t){$('#sync').textContent='progress: '+t}
(async()=>{
  try{
    const u=CTX.user; if(!db||!u){setSync('saved in this browser only');return}
    const id=await u.id(); if(!id){setSync('saved in this browser only');return}
    dref=db.doc('data/users/'+id+'/progress');
    const snap=await dref.get();
    if(snap.exists){S=merge(S,JSON.parse(JSON.stringify(snap.data())));lsSave();}
    setSync('synced to your account');
    if(ls)save();
    render();showImport();
  }catch(e){setSync('saved in this browser only')}
})();

''' + js[old_sync_end:]

# render dispatch: Edit view
js = rep(js, "else if(view==='rules')renderRules();else renderBrowse();",
         "else if(view==='rules')renderRules();else if(view==='edit')renderEdit();else renderBrowse();")

js = rep(js, '<span class="muted">(keep both files in the same folder)</span>',
         '${CTX.canEdit?`<button type="button" class="btn small" data-editq="${q.i}">Edit this question</button>`:\'\'}')

# backup download through the downloads capability (plain download links are blocked)
js = rep(js, "$('#pmBackup').onclick=()=>{const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});const uri=URL.createObjectURL(blob);const a=document.createElement('a');a.href=uri;a.download='sap-c02-study-progress.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),1000)};",
         "$('#pmBackup').onclick=()=>downloadBackup();")
js = rep(js, "Backup / restore your study progress when switching HTML files</summary><p>Saved progress uses the existing <code>sapc02-trainer-v1</code> browser storage key. Some browsers may isolate local HTML files from one another. Export a backup before switching files, or paste JSON previously exported from a trainer into this box. Import <b>merges</b> with current progress rather than resetting answers.</p>",
         "Backup / restore your study progress</summary><p>Your progress is saved to your account, so it follows you on any device. You can still download a backup, or paste JSON exported from the old trainer file into this box. Import <b>merges</b> with current progress rather than resetting answers.</p>")

js += open(P('extra.js'), encoding='utf-8').read() + '\n};\n'
src = src[:main_start] + '<script>' + js + src[main_end:]

# ---------- 3. markup: loading state, Edit tab, map button, import banner ----------
src = rep(src, '<section class="view" id="v-home"></section>',
          '<section class="view" id="v-home"><div class="panel" id="boot" role="status" aria-live="polite">Loading the question bank…</div></section>')
src = rep(src, '<section class="view" id="v-rules" hidden></section>',
          '<section class="view" id="v-rules" hidden></section>\n  <section class="view" id="v-edit" hidden></section>')
src = rep(src, '<button role="tab" data-view="rules" aria-selected="false">My rules</button>',
          '<button role="tab" data-view="rules" aria-selected="false">My rules</button>')
src = rep(src, '<span class="sync" id="sync">progress: this browser</span></div>',
          '<span class="hdact"><span class="sync" id="sync">progress: loading…</span>'
          '<button type="button" class="btn small" id="tabEdit" hidden>Edit questions</button>'
          '<button type="button" class="btn small" id="openMap">Mind map ↗</button></span></div>')
src = rep(src, '<main>', '<div id="importBar" hidden></div>\n<main>')

# ---------- 4. loader + styles ----------
loader = open(P('loader.js'), encoding='utf-8').read()
css = open(P('extra.css'), encoding='utf-8').read()
src = src.replace('</style>', css + '\n</style>', 1)
end2 = src.find('</script>', main_start) + len('</script>')
src = src[:end2] + '\n<script>\n' + loader + '\n</script>' + src[end2:]

open(os.path.join(OUT, 'trainer.html'), 'w', encoding='utf-8').write(src)

# ---------- 5. map ----------
mp = open(P('map.html'), encoding='utf-8').read()
open(os.path.join(OUT, 'map.html'), 'w', encoding='utf-8').write(mp)
print('trainer', len(src), 'map', len(mp))
