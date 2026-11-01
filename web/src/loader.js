/* Loads the question bank from the page's database, then starts the trainer. */
(function(){
  function say(html){var el=document.getElementById('boot');if(el)el.innerHTML=html;}
  function clone(o){return JSON.parse(JSON.stringify(o));}
  async function boot(){
    var db=null,user=null,downloads=null;
    try{
      if(window.claude&&window.claude.use){
        var r=await Promise.all([claude.use('db'),claude.use('user'),claude.use('downloads')]);
        db=r[0];user=r[1];downloads=r[2];
      }
    }catch(e){}
    if(!db){say('<h2>Sign in to study</h2><p class="note">The question bank lives in this page’s database. Open the page on claude.ai while signed in to load it.</p>');return;}
    var slow=setTimeout(function(){say('Still loading the question bank… If this takes long, check your connection; the page keeps trying.');},10000);
    try{
      var res=await Promise.all([db.collection('questions').limit(1000).get(),db.doc('meta/bank').get(),db.doc('meta/patterns').get()]);
      clearTimeout(slow);
      var qs=res[0],meta=res[1],pats=res[2];
      if(qs.empty||!meta.exists){say('<h2>The question bank is empty</h2><p class="note">No questions are stored yet. Ask Claude to load the question bank into this page.</p>');return;}
      var q=qs.docs.map(function(d){var o=clone(d.data());o._id=d.id;return o;}).sort(function(a,b){return a.i-b.i;});
      var data=clone(meta.data());data.q=q;
      var pm=pats.exists?(clone(pats.data()).list||[]):[];
      var pmap={};q.forEach(function(x){pmap[x.i]={p:x.pt||(pm[0]&&pm[0].id),confidence:'high',source:'reviewed'};});
      var canEdit=false;try{if(user){canEdit=!!(await user.canEdit())||!!(await user.isOwner());}}catch(e){}
      window.__startTrainer(data,pm,pmap,{db:db,user:user,downloads:downloads,canEdit:canEdit});
    }catch(e){
      clearTimeout(slow);
      say('<h2>Could not load the question bank</h2><p class="note">'+String((e&&(e.message||e.code))||e).replace(/[<>&]/g,'')+'. Reload the page to try again.</p>');
    }
  }
  boot();
})();
