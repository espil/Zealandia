/* Zealandia party play (Han, 2026-10-23).
   Zealandia is a SINGLE-PLAYER world, and its users can party up and
   play TOGETHER: any user can create a party, any user can join one,
   and members are peers (a party leader keeps the code, nobody owns
   anyone's world). This module is the client: party state, party
   codes, roster UI and the join flow.

   Transport note: real-time co-presence rides the thin server relay
   (login/session + presence) from the client-carried distribution
   principle. Until that server opens, party state and party codes are
   created and saved on this device, and the panel says so plainly.
   The seam is window.__zpartyTransport: 'local' now, the relay later
   slots in behind the same state shape. */
(function(){
  'use strict';
  var LS_KEY='espil_zparty_v1';
  var ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function username(){
    try{ return localStorage.getItem('espil_username')||'You'; }catch(e){ return 'You'; }
  }
  function load(){
    try{
      var raw=localStorage.getItem(LS_KEY);
      if(raw){ var s=JSON.parse(raw); if(s&&s.mode){
        /* normalize the first build's host/guest wording to peers */
        if(s.mode==='host')s.mode='leader';
        if(s.mode==='guest')s.mode='member';
        (s.members||[]).forEach(function(m){ if(m.role==='host')m.role='leader'; if(m.role==='guest')m.role='member'; });
        return s;
      } }
    }catch(e){}
    return { mode:'solo', code:null, members:[], ts:0 };
  }
  function save(s){
    s.ts=Date.now();
    try{ localStorage.setItem(LS_KEY, JSON.stringify(s)); }catch(e){}
    render();
  }
  function genCode(){
    var out='ZL-';
    for(var i=0;i<6;i++)out+=ALPHABET[Math.floor(Math.random()*ALPHABET.length)];
    return out;
  }

  var P={
    state: load(),
    transport: 'local',
    create: function(){
      var s={ mode:'leader', code:genCode(), members:[{ name:username(), role:'leader', status:'here' }], ts:0 };
      save(s); P.state=s; return s;
    },
    join: function(code){
      code=String(code||'').toUpperCase().replace(/\s+/g,'');
      if(!/^ZL-[A-Z0-9]{6}$/.test(code))return null;
      var s={ mode:'member', code:code, members:[
        { name:'Party leader', role:'leader', status:'link pending' },
        { name:username(), role:'member', status:'here' }
      ], ts:0 };
      save(s); P.state=s; return s;
    },
    leave: function(){
      var s={ mode:'solo', code:null, members:[], ts:0 };
      save(s); P.state=s; return s;
    },
    getState: function(){ return P.state; }
  };
  window.__zparty=P;
  window.__zpartyTransport='local';

  /* ---------- UI ---------- */
  var chipEl=null, panelEl=null, open=false;
  function styles(){
    if(document.getElementById('zparty-style'))return;
    var st=document.createElement('style');
    st.id='zparty-style';
    st.textContent=
      '#zparty-chip{position:fixed;right:14px;bottom:14px;z-index:9200;padding:8px 14px;border-radius:999px;'+
      'border:1px solid rgba(134,238,228,.55);background:linear-gradient(180deg,rgba(10,34,44,.92),rgba(4,16,22,.92));'+
      'color:#bff3ea;font-size:13px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.45)}'+
      '#zparty-panel{position:fixed;right:14px;bottom:58px;z-index:9201;width:300px;max-width:88vw;border-radius:12px;'+
      'border:1px solid rgba(134,238,228,.55);background:linear-gradient(180deg,rgba(10,34,44,.97),rgba(4,16,22,.97));'+
      'color:#dff7f2;padding:14px 14px 12px;box-shadow:0 10px 34px rgba(0,0,0,.55);font-size:13px;line-height:1.5}'+
      '#zparty-panel h4{margin:0 0 6px;font-size:14px;letter-spacing:.03em;color:#bff3ea}'+
      '#zparty-panel .zp-row{display:flex;justify-content:space-between;gap:8px;padding:3px 0}'+
      '#zparty-panel .zp-dim{opacity:.75;font-size:12px}'+
      '#zparty-panel button{border:1px solid rgba(134,238,228,.7);background:rgba(14,48,56,.9);color:#bff3ea;'+
      'border-radius:7px;padding:6px 10px;font-size:12px;cursor:pointer}'+
      '#zparty-panel input{flex:1;background:rgba(0,0,0,.35);border:1px solid rgba(134,238,228,.35);'+
      'border-radius:7px;color:#dff7f2;padding:6px 8px;font-size:12px;text-transform:uppercase}'+
      '#zparty-panel .zp-code{font-size:16px;letter-spacing:.12em;color:#ffe9a8}';
    document.head.appendChild(st);
  }
  function inZealandia(){
    return typeof window.__espilCityKey!=='undefined'&&window.__espilCityKey==='zealandia';
  }
  function build(){
    styles();
    if(!chipEl){
      chipEl=document.createElement('button');
      chipEl.id='zparty-chip'; chipEl.type='button';
      chipEl.addEventListener('click',function(){ open=!open; render(); });
      document.body.appendChild(chipEl);
    }
    if(!panelEl){
      panelEl=document.createElement('div');
      panelEl.id='zparty-panel';
      document.body.appendChild(panelEl);
    }
  }
  function render(){
    if(!chipEl)return;
    var s=P.state;
    chipEl.textContent = s.mode==='solo' ? 'Party · Solo' : 'Party · '+s.members.length+' in party';
    chipEl.style.display = inZealandia() ? 'block' : 'none';
    panelEl.style.display = (open&&inZealandia()) ? 'block' : 'none';
    if(!open)return;
    var h='<h4>Party</h4>';
    h+='<div class="zp-dim">Zealandia is a single-player world, and users can party up and play together. Create a party and share its code with friends, or join theirs.</div>';
    if(s.mode==='solo'){
      h+='<div class="zp-row" style="margin-top:8px"><button id="zp-create" type="button">Create party</button></div>';
      h+='<div class="zp-row"><input id="zp-code-in" maxlength="9" placeholder="ZL-XXXXXX"><button id="zp-join" type="button">Join</button></div>';
    } else {
      h+='<div class="zp-row"><span>Party code</span><span class="zp-code">'+s.code+'</span></div>';
      s.members.forEach(function(m){
        h+='<div class="zp-row"><span>'+m.name+(m.role==='leader'?' (leader)':'')+'</span><span class="zp-dim">'+m.status+'</span></div>';
      });
      h+='<div class="zp-row" style="margin-top:6px">'
        +'<button id="zp-copy" type="button">Copy party code</button>'
        +'<button id="zp-leave" type="button">'+(s.mode==='leader'?'Disband party':'Leave party')+'</button></div>';
    }
    h+='<div class="zp-dim" style="margin-top:8px">Server link: pending. Party codes are saved on this device and parties link up live when the game server opens.</div>';
    panelEl.innerHTML=h;
    var b;
    if((b=document.getElementById('zp-create')))b.addEventListener('click',function(){ P.create(); });
    if((b=document.getElementById('zp-join')))b.addEventListener('click',function(){
      var inp=document.getElementById('zp-code-in');
      if(inp&&!P.join(inp.value))inp.style.borderColor='#ff9a9a';
    });
    if((b=document.getElementById('zp-copy')))b.addEventListener('click',function(){
      var text='Party up with me in Zealandia - party code '+P.state.code;
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text);
      else window.prompt('Copy your party code', text);
    });
    if((b=document.getElementById('zp-leave')))b.addEventListener('click',function(){ P.leave(); });
  }
  function tick(){
    if(!document.body)return;
    if(inZealandia()){
      if(!chipEl){ build(); }
      render();
    } else if(chipEl){
      chipEl.style.display='none';
      if(panelEl)panelEl.style.display='none';
    }
  }
  setInterval(tick,1200);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);
  else tick();
})();
