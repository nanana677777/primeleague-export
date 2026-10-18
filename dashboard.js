const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const n=v=>+v||0, pct=v=>v==null?'–':(v*100).toFixed(1)+'%', f1=v=>v==null?'–':v.toFixed(1);
const S={side:'All',role:'All',view:'champ',sort:'pres',dir:-1};
let D=null,ICONS={},AL={};
// A player is identified by account id (falls back to the in-game name). Every name seen is kept; the most recent one is the current name.
const baseKey=p=>String(p['Account ID']||'')||('n:'+String(p.Player).toLowerCase());
let LINKS=[],USER_LINKS=[],PAR={};
const find=k=>{while(PAR[k]!==undefined&&PAR[k]!==k)k=PAR[k];return k};
const pkey=p=>find(baseKey(p));
// Names the user (or aliases.json) declared to be the same player are merged, even when no account id is known.
function buildLinks(){PAR={};const nk={};
  D.players.forEach(p=>{const l=String(p.Player).toLowerCase();(nk[l]=nk[l]||new Set()).add(baseKey(p))});
  const keysOf=nm=>[...(nk[String(nm).toLowerCase()]||['n:'+String(nm).toLowerCase()])];
  const uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)PAR[b]=a};
  LINKS.forEach(([a,b])=>{const ka=keysOf(a),kb=keysOf(b);[...ka.slice(1),...kb].forEach(k=>uni(ka[0],k))})}
async function loadLinks(){let a=[];
  try{a=await (await fetch('aliases.json')).json()}catch(e){}
  try{USER_LINKS=(await chrome.storage.local.get('links')).links||[]}catch(e){USER_LINKS=[]}
  LINKS=[...(Array.isArray(a)?a:[]),...USER_LINKS]}
async function saveLinks(){await chrome.storage.local.set({links:USER_LINKS});LINKS=LINKS.filter(x=>!USER_LINKS.includes(x));await loadLinks();buildLinks();buildAlias();render();if(S.team)openTeam(S.team)}
const pname=p=>(AL[pkey(p)]||{cur:p.Player}).cur;
const akas=k=>{const o=AL[k];return o?Object.entries(o.names).sort((a,b)=>b[1]-a[1]).map(e=>e[0]).filter(x=>x!==o.cur):[]};
function buildAlias(){AL={};buildLinks();const md=s=>+((/\d+/.exec(s||'')||[0])[0]);
  D.players.forEach(p=>{const k=pkey(p),o=AL[k]||(AL[k]={names:{},cur:'',best:-1}),ord=md(p.Matchday)*100+n(p.Game);
    if(!(p.Player in o.names)||ord>o.names[p.Player])o.names[p.Player]=ord;
    if(ord>=o.best){o.best=ord;o.cur=p.Player}})}
const hue=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))%360,7);
const ini=s=>s.replace(/[^A-Za-z0-9 ]/g,'').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?';
const av=(s,c='')=>ICONS[s]?`<img class="av ${c}" alt="" src="${esc(ICONS[s])}">`:`<span class="av ${c}" style="--h:${hue(s)}">${esc(ini(s))}</span>`;

function champRows(){
  const N=D.games.length||1, dur={}, m={};
  D.games.forEach(g=>dur[g.Match+'|'+g.Game]=n(g['Duration (min)']));
  const get=c=>m[c]||(m[c]={c,picks:0,bans:0,wins:0,k:0,d:0,a:0,cs:0,gold:0,min:0,pl:{}});
  const est=S.role!=='All';
  // Bans carry no role in the data: split each ban across roles by how often the champion is picked in each role.
  const rs={};
  D.players.forEach(p=>{const o=rs[p.Champion]||(rs[p.Champion]={t:0});o.t++;o[p['Role (by row)']]=(o[p['Role (by row)']]||0)+1});
  D.draft.forEach(r=>{if(r.Type!=='Ban'||(S.side!=='All'&&r.Side!==S.side))return;
    if(!est){get(r.Champion).bans++;return}
    const o=rs[r.Champion];if(o&&o[S.role])get(r.Champion).bans+=o[S.role]/o.t});
  D.players.forEach(p=>{
    if(S.side!=='All'&&p.Side!==S.side)return;
    if(S.role!=='All'&&p['Role (by row)']!==S.role)return;
    const o=get(p.Champion);o.picks++;if(p.Result==='Win')o.wins++;
    o.k+=n(p.Kills);o.d+=n(p.Deaths);o.a+=n(p.Assists);o.cs+=n(p.CS);o.gold+=n(p.Gold);o.min+=dur[p.Match+'|'+p.Game]||0;
    const pn=pname(p);o.pl[pn]=(o.pl[pn]||0)+1;
  });
  return Object.values(m).filter(o=>o.picks+o.bans>0.001).map(o=>{
    const top=Object.entries(o.pl).sort((a,b)=>b[1]-a[1])[0];
    return{c:o.c,pres:(o.picks+o.bans)/N,picks:o.picks,bans:est?Math.round(o.bans*10)/10:o.bans,
      wr:o.picks?o.wins/o.picks:null,kda:o.picks?(o.k+o.a)/Math.max(o.d,1):null,
      csm:o.min?o.cs/o.min:null,gold:o.picks?o.gold/o.picks:null,wins:o.wins,ak:o.picks?o.k/o.picks:null,ad:o.picks?o.d/o.picks:null,aa:o.picks?o.a/o.picks:null,acs:o.picks?o.cs/o.picks:null,top:top?`${top[0]} (${top[1]})`:'–'}});
}
function teamRows(){
  const m={};
  D.tg.filter(r=>S.side==='All'||r.Side===S.side).forEach(r=>{
    const o=m[r.Team]||(m[r.Team]={t:r.Team,g:0,w:0,k:0,d:0,a:0,gold:0,tw:0,dr:0,ba:0,he:0,min:0,inh:0,bg:0,bw:0,rg:0,rw:0});
    o.g++;if(r.Result==='Win')o.w++;
    o.k+=n(r.Kills);o.d+=n(r.Deaths);o.a+=n(r.Assists);o.gold+=n(r.Gold);o.tw+=n(r.Towers);
    o.dr+=n(r.Dragons);o.ba+=n(r.Barons);o.he+=n(r.Heralds);o.min+=n(r['Duration (min)']);o.inh+=n(r.Inhibitors);const bl=r.Side==='Blue';(bl?o.bg++:o.rg++);if(r.Result==='Win')(bl?o.bw++:o.rw++);
  });
  const pk={};
  D.players.forEach(p=>{if(S.side!=='All'&&p.Side!==S.side)return;const t=pk[p.Team]||(pk[p.Team]={});t[p.Champion]=(t[p.Champion]||0)+1});
  const tops=t=>Object.entries(pk[t]||{}).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3).map(([c,k])=>`${c} (${k})`);
  return Object.values(m).map(o=>{const tp=tops(o.t);return({t:o.t,p1:tp[0]||'–',p2:tp[1]||'–',p3:tp[2]||'–',g:o.g,w:o.w,l:o.g-o.w,wr:o.g?o.w/o.g:null,k:o.k/o.g,d:o.d/o.g,a:o.a/o.g,
    gold:o.gold/o.g,tw:o.tw/o.g,dr:o.dr/o.g,ba:o.ba/o.g,he:o.he/o.g,min:o.min/o.g,inh:o.inh/o.g,bwr:o.bg?o.bw/o.bg:null,rwr:o.rg?o.rw/o.rg:null})});
}
const CH=[
 {k:'c',l:'Champion',cls:'l',h:(v)=>`<div class="ch">${av(v)}${esc(v)}</div>`},
 {k:'pres',l:'Pres',f:pct,cls:'b'},{k:'picks',l:'Picks'},{k:'bans',l:'Bans',f:v=>v==null?'–':(S.role!=='All'&&v?'~':'')+(Number.isInteger(v)?v:v.toFixed(1))},
 {k:'wr',l:'Win %',f:pct,wr:1},{k:'kda',l:'KDA',f:f1},{k:'csm',l:'CSM',f:f1},
 {k:'gold',l:'Avg gold',f:v=>v==null?'–':(v/1000).toFixed(1)+'k'},{k:'wins',l:'Wins',f:v=>v==null?'–':v,off:1},{k:'ak',l:'Avg kills',f:f1,off:1},{k:'ad',l:'Avg deaths',f:f1,off:1},{k:'aa',l:'Avg assists',f:f1,off:1},{k:'acs',l:'Avg CS',f:f1,off:1},{k:'top',l:'Most played by',cls:'mut'}];
const TM=[
 {k:'t',l:'Team',cls:'l',h:v=>`<div class="ch">${av(v)}${esc(v)}</div>`},
 {k:'g',l:'Games'},{k:'w',l:'W-L',h:(v,r)=>`${r.w}-${r.l}`},{k:'wr',l:'Win %',f:pct,wr:1,cls:'b'},{k:'p1',l:'Most picked #1',pk:1},{k:'p2',l:'Most picked #2',pk:2},{k:'p3',l:'Most picked #3',pk:3},
 {k:'k',l:'Kills',f:f1},{k:'d',l:'Deaths',f:f1},{k:'a',l:'Assists',f:f1},
 {k:'gold',l:'Gold',f:v=>(v/1000).toFixed(1)+'k'},{k:'tw',l:'Towers',f:f1},{k:'dr',l:'Dragons',f:f1},
 {k:'ba',l:'Barons',f:f1},{k:'he',l:'Heralds',f:f1},{k:'min',l:'Length (min)',f:f1},{k:'inh',l:'Inhibitors',f:f1,off:1},{k:'bwr',l:'Blue win %',f:pct,off:1},{k:'rwr',l:'Red win %',f:pct,off:1}];

const KEY='plstats.v1';
const defCols=()=>({champ:CH.filter(c=>!c.off).map(c=>c.k),team:TM.filter(c=>!c.off).map(c=>c.k)});
S.cols=defCols();
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){['side','role','view','sort','dir'].forEach(k=>{if(s[k]!=null)S[k]=s[k]});
 ['champ','team'].forEach(v=>{if(s.cols&&Array.isArray(s.cols[v]))S.cols[v]=s.cols[v].filter(k=>(v==='champ'?CH:TM).some(c=>c.k===k))});if(!(s.ver>=2))S.cols.team=[...new Set([...S.cols.team,'p1','p2','p3'])]}}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({side:S.side,role:S.role,view:S.view,sort:S.sort,dir:S.dir,cols:S.cols,ver:2}))}catch(e){}};
const topN=()=>S.side==='All'?3:S.side==='Blue'?1:2,ok=c=>!c.pk||c.pk<=topN();
function syncUI(){setActive('#tabs','v',S.view);setActive('#side','s',S.side);setActive('#role','r',S.role)}
function cards(rows){
  if(S.view!=='champ'){const t=[...rows].sort((a,b)=>b.wr-a.wr)[0];
    $('#cards').innerHTML=t?`<div class="panel card"><div><small>Best win rate</small><b>${pct(t.wr)}</b><span class="n">${esc(t.t)}</span></div>${av(t.t)}</div>`:'';return}
  const best=(k,min)=>[...rows].filter(r=>r[k]!=null&&r.picks>=min).sort((a,b)=>b[k]-a[k])[0];
  const defs=[['Most picked',best('picks',1),r=>r.picks,r=>r.c],['Most banned'+(S.role!=='All'?' (est.)':''),best('bans',0),r=>r.bans,r=>r.c],
   ['Best win rate (2+ picks)',best('wr',2),r=>pct(r.wr),r=>r.c],['Best KDA (2+ picks)',best('kda',2),r=>f1(r.kda),r=>r.c]];
  $('#cards').innerHTML=defs.map(([l,r,v,nm])=>r?`<div class="panel card"><div><small>${l}</small><b>${v(r)}</b><span class="n">${esc(nm(r))}</span></div>${av(nm(r))}</div>`:'').join('');
}
function render(){
  if(!D)return;
  const all=S.view==='champ'?CH:TM,vis=S.cols[S.view];
  const cols=all.filter((c,i)=>i===0||(vis.includes(c.k)&&ok(c)));
  const rows=(S.view==='champ'?champRows():teamRows());
  const col=cols.find(c=>c.k===S.sort)||cols[1]||cols[0];
  rows.sort((a,b)=>{const x=a[col.k],y=b[col.k];
    if(typeof x==='string'||typeof y==='string')return String(x).localeCompare(String(y))*S.dir;
    return((x==null?-1:x)-(y==null?-1:y))*S.dir});
  cards(rows);
  $('#role').classList.toggle('hide',S.view!=='champ');
  $('#t').innerHTML='<thead><tr><th class="rk">#</th>'+cols.map(c=>`<th tabindex="0" data-k="${c.k}" class="${c.cls==='l'?'l ':''}${c.k===col.k?'s':''}">${c.l}${c.k===col.k?(S.dir<0?' ↓':' ↑'):''}</th>`).join('')+'</tr></thead><tbody>'+
   rows.map((r,i)=>`<tr${S.view==='team'?` data-team="${esc(r.t)}" class="clk" title="Open team details"`:''}><td class="rk">${i+1}</td>`+cols.map(c=>{
     const v=r[c.k];
     if(c.wr)return`<td class="wr ${v==null?'':v>=.5?'pos':'neg'} ${c.cls||''}">${pct(v)}${v==null?'':`<i><u style="width:${v*100}%"></u></i>`}</td>`;
     const out=c.h?c.h(v,r):(c.f?c.f(v):esc(v));
     return`<td class="${c.cls||''}">${out}</td>`}).join('')+'</tr>').join('')+'</tbody>';save();
}
function setActive(sel,attr,val){document.querySelectorAll(sel+' button').forEach(b=>b.classList.toggle('on',b.dataset[attr]===val))}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.view=b.dataset.v;S.sort=S.view==='champ'?'pres':'wr';S.dir=-1;setActive('#tabs','v',S.view);render()};
$('#side').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.side=b.dataset.s;setActive('#side','s',S.side);render()};
$('#role').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.role=b.dataset.r;setActive('#role','r',S.role);render()};
$('#t').onclick=e=>{const th=e.target.closest('th[data-k]');if(!th)return;const k=th.dataset.k;
  if(S.sort===k)S.dir*=-1;else{S.sort=k;S.dir=(k==='c'||k==='t'||k==='top'||/^p\d$/.test(k))?1:-1}render()};
$('#t').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const th=e.target.closest('th[data-k]');if(th){e.preventDefault();th.click()}}};

function menu(){
  const all=S.view==='champ'?CH:TM,vis=S.cols[S.view];
  $('#cm').innerHTML=all.slice(1).filter(ok).map(c=>`<label><input type="checkbox" data-k="${c.k}" ${vis.includes(c.k)?'checked':''}>${c.l}</label>`).join('')+'<hr><button id="rs">Reset columns</button>';
}
$('#cb').onclick=e=>{e.stopPropagation();menu();$('#cm').classList.toggle('hide')};
$('#cm').onclick=e=>{e.stopPropagation();const i=e.target.closest('input[data-k]');
  if(i){const all=S.view==='champ'?CH:TM,v=S.cols[S.view];S.cols[S.view]=all.filter(c=>c.k===i.dataset.k?i.checked:v.includes(c.k)).map(c=>c.k);render()}
  else if(e.target.id==='rs'){S.cols=defCols();menu();render()}};
document.addEventListener('click',()=>$('#cm').classList.add('hide'));
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#cm').classList.add('hide')});
$('#tabs').addEventListener('click',()=>$('#cm').classList.add('hide'));
const RO=['Top','Jungle','Mid','Bot','Support'];
const mmss=x=>{if(x==null||isNaN(x))return'–';const s=Math.round(x*60);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const mday=s=>+((/\d+/.exec(s||'')||[0])[0]);
const topOf=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
function closeTeam(){S.team=null;$('#ov').classList.add('hide')}
function openTeam(t){S.team=t;
  const TG=D.tg.filter(r=>r.Team===t),PL=D.players.filter(p=>p.Team===t),gn=TG.length||1;
  const w=TG.filter(r=>r.Result==='Win').length,sum=k=>TG.reduce((a,r)=>a+n(r[k]),0);
  const K=sum('Kills'),Dd=sum('Deaths'),A=sum('Assists');
  const cells=[['Games',TG.length],['Wins',w],['Losses',TG.length-w],['Win %',pct(w/gn)],['KDA',((K+A)/Math.max(Dd,1)).toFixed(2)],['Kills',K],['Deaths',Dd],['Assists',A],['Avg gold',(sum('Gold')/gn/1000).toFixed(1)+'k'],['Avg length',mmss(sum('Duration (min)')/gn)]];
  const pm={};
  PL.forEach(p=>{const k=pkey(p),o=pm[k]||(pm[k]={acc:k,p:pname(p),g:0,w:0,k:0,d:0,a:0,ro:{},ch:{}}),r=p['Role (by row)'];
    o.g++;if(p.Result==='Win')o.w++;o.k+=n(p.Kills);o.d+=n(p.Deaths);o.a+=n(p.Assists);o.ro[r]=(o.ro[r]||0)+1;o.ch[p.Champion]=(o.ch[p.Champion]||0)+1});
  const pl=Object.values(pm).map(o=>({...o,role:(topOf(o.ro)[0]||[''])[0]})).sort((a,b)=>RO.indexOf(a.role)-RO.indexOf(b.role)||b.g-a.g);
  const lnk=o=>`<select class="lk" data-k="${esc(o.acc)}" title="Link this player to another name (same person, renamed account)"><option value="">Same person as…</option>${pl.filter(x=>x.acc!==o.acc).map(x=>`<option value="${esc(x.acc)}">${esc(x.p)}</option>`).join('')}</select>`+(USER_LINKS.some(([a,b])=>[a,b].some(nm=>(AL[o.acc]||{names:{}}).names[nm]!==undefined))?` <button class="ul" data-k="${esc(o.acc)}" title="Remove the manual links of this player">unlink</button>`:'');
  const prow=o=>`<tr><td class="l"><b>${esc(o.p)}</b>${akas(o.acc).length?`<span class="aka" title="Other names used by this account">aka ${akas(o.acc).map(esc).join(', ')}</span>`:''}<span class="aka">${lnk(o)}</span></td><td>${esc(o.role)}</td><td>${o.g}</td><td>${o.k}</td><td>${o.d}</td><td>${o.a}</td><td>${((o.k+o.a)/Math.max(o.d,1)).toFixed(1)}</td><td><div class="ics">${topOf(o.ch).slice(0,3).map(([c,k])=>`<span title="${esc(c)} ×${k}">${av(c,'sm')}</span>`).join('')}</div></td><td class="${o.w/o.g>=.5?'pos':'neg'}">${pct(o.w/o.g)}</td></tr>`;
  const bk={};D.players.forEach(p=>{const k=p.Match+'|'+p.Game;(bk[k]=bk[k]||[]).push(p)});
  const ic=(g,tm)=>(bk[g.Match+'|'+g.Game]||[]).filter(p=>p.Team===tm).sort((a,b)=>RO.indexOf(a['Role (by row)'])-RO.indexOf(b['Role (by row)'])).map(p=>`<span title="${esc(pname(p))} · ${esc(p.Champion)}">${av(p.Champion,'sm')}</span>`).join('');
  const gs=D.games.filter(g=>g['Blue side']===t||g['Red side']===t).sort((a,b)=>mday(b.Matchday)-mday(a.Matchday)||b.Game-a.Game);
  const card=g=>{const blue=g['Blue side']===t,opp=blue?g['Red side']:g['Blue side'],win=g.Winner===t;
    const side=(tm,res,sd,self)=>`<div class="side"><b class="${self?'':'lnk'}"${self?'':` data-team="${esc(tm)}"`}>${esc(tm)}</b><span class="res">${res} · ${sd}</span><div class="ic">${ic(g,tm)}</div></div>`;
    return`<div class="gm ${win?'w':'l'}">${side(t,win?'Win':'Loss',blue?'Blue':'Red',1)}<div class="mid"><small>GAME ${esc(g.Game)}</small><b>${mmss(g['Duration (min)'])}</b><small>${esc(g.Matchday)}</small><small>${esc(g.Date)}</small></div>${side(opp,win?'Loss':'Win',blue?'Red':'Blue',0)}</div>`};
  $('#ov').innerHTML=`<div class="md panel" role="dialog" aria-modal="true"><button class="x" id="mx" aria-label="Close">×</button><h2>${esc(t)}<small>${esc((D.games[0]||{}).Group||'')}</small></h2><div class="mg"><div><div class="sum">${cells.map(([l,v])=>`<div><small>${l}</small><b>${v}</b></div>`).join('')}</div><div class="panel tw"><table class="pt"><thead><tr><th class="l">Player</th><th>Role</th><th>Games</th><th>K</th><th>D</th><th>A</th><th>KDA</th><th>Most played</th><th>Win %</th></tr></thead><tbody>${pl.map(prow).join('')}</tbody></table></div></div><div class="gl">${gs.map(card).join('')}</div></div></div>`;
  $('#ov').classList.remove('hide');$('#ov').scrollTop=0;$('#mx').focus();
}
$('#t').addEventListener('click',e=>{const tr=e.target.closest('tr[data-team]');if(tr)openTeam(tr.dataset.team)});
$('#ov').addEventListener('change',e=>{const s=e.target.closest('select.lk');if(!s||!s.value)return;
  const a=(AL[s.dataset.k]||{}).cur,b=(AL[s.value]||{}).cur;if(a&&b){USER_LINKS.push([a,b]);saveLinks()}});
$('#ov').addEventListener('click',e=>{const u=e.target.closest('button.ul');if(!u)return;
  const nm=Object.keys((AL[u.dataset.k]||{names:{}}).names).map(x=>x.toLowerCase());
  USER_LINKS=USER_LINKS.filter(([a,b])=>!nm.includes(a.toLowerCase())&&!nm.includes(b.toLowerCase()));saveLinks()});
$('#ov').addEventListener('click',e=>{if(e.target.id==='ov'||e.target.id==='mx')return closeTeam();const l=e.target.closest('[data-team]');if(l)openTeam(l.dataset.team)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTeam()});
function setData(d,icons,label){
  if(!d.draft.length||!d.players.length)throw new Error('Sheets Draft, Players, TeamGames and Games were not found. Use a file exported by the extension or the Python script.');
  D=d;ICONS=icons||{};buildAlias();
  const matches=new Set(d.games.map(x=>x.Match)).size,grp=d.games[0]&&d.games[0].Group||'';
  $('#sub').textContent=`${grp} · ${matches} matches · ${d.games.length} games · ${label}`;
  $('#drop').classList.add('hide');$('#app').classList.remove('hide');
  $('#pick').textContent='Import another file';
  syncUI();render();
}
function load(file){
  $('#err').textContent='';
  const r=new FileReader();
  r.onload=ev=>{try{
    const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
    const g=nm=>wb.Sheets[nm]?XLSX.utils.sheet_to_json(wb.Sheets[nm],{defval:''}):[];
    const icons={};g('Icons').forEach(r=>{if(r.Champion&&String(r.Image).startsWith('data:image/'))icons[r.Champion]=r.Image});
    setData({draft:g('Draft'),players:g('Players'),tg:g('TeamGames'),games:g('Games')},icons,file.name);
  }catch(e){$('#err').textContent=e.message;$('#drop').classList.remove('hide')}};
  r.readAsArrayBuffer(file);
}
function fromStore(){
  loadLinks().then(()=>chrome.storage.local.get('dash')).then(({dash})=>{
    if(dash&&dash.draft)try{setData(dash,dash.icons,'export of '+new Date(dash.ts).toLocaleString())}catch(e){}
  });
}
fromStore();
chrome.storage.onChanged.addListener(c=>{if(c.dash)fromStore()});
const fi=$('#file');
$('#pick').onclick=$('#pick2').onclick=()=>fi.click();
fi.onchange=()=>fi.files[0]&&load(fi.files[0]);
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)load(f)});
