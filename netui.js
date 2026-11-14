/* Moi Tracker - "Network sync" tab: live multi-device sync over WiFi / LAN cable / NetBird */
(function(){
const LAN=window.moiApp&&window.moiApp.lan;
const NT={
 en:{title:'Network sync',sub:'Use the software on two or more computers as ONE software. Live, over WiFi, LAN cable or NetBird. Works offline inside your own network too.',
  on:'Live sync is ON',off:'Live sync is OFF',nConn:(n,t)=>`${n} of ${t} device(s) connected`,none:'No other device connected',
  start:'Start',stop:'Stop',connAll:'Connect all',discAll:'Disconnect all',syncNow:'Sync now',scan:'Scan network',scanning:(d,t)=>`Scanning ${d}/${t}…`,fw:'Open Windows Firewall',
  thisDev:'This computer',devName:'Device name',port:'Port',pin:'Group PIN (same on all computers)',pinHint:'Only computers with the same PIN connect to each other. Empty = open to everyone on the network.',noPin:'No PIN set: any Moi Tracker on this network can connect.',
  listening:'Ready to accept connections',notListening:'Not accepting connections',yourIps:'Your addresses',
  autoStart:'Start automatically when the software opens',autoConnect:'Auto-connect to devices found on the network',discover:'Find devices automatically (broadcast)',
  nets:'Networks to use',mAll:'All',wifi:'WiFi',lan:'LAN cable',netbird:'NetBird',other:'Other',virtual:'Virtual',adapter:'Adapter',
  devices:'Connected devices',cName:'Device',cAddr:'Address',cNet:'Network',cStat:'Status',cPing:'Ping',cSync:'Last data',cData:'↑ sent / ↓ received',cAct:'Control',
  connected:'Connected',connecting:'Connecting…',failed:'Offline',rejected:'Rejected',paused:'Paused',idle:'Waiting',
  bConn:'Connect',bDisc:'Disconnect',bDel:'Remove',autoRe:'Auto',src_manual:'Manual',src_auto:'Auto',src_incoming:'Incoming',
  noDev:'No other device yet. Open the software on another computer in the same network (it appears here by itself), or add its IP address below.',
  add:'Add a device manually',ipPh:'IP address or name  (e.g. 192.168.1.20  or  100.64.1.5)',namePh:'Name (optional)',addBtn:'Add & connect',
  log:'Activity log',retry:s=>`retry in ${s}s`,clock:s=>`clock differs ${s}s`,clockWarn:'The clocks of the computers differ. Set the same time on all of them.',
  netbirdHelp:'NetBird: install NetBird on every computer, join the same NetBird network, then add the other computer\'s NetBird address (100.x.x.x) or name above.',
  portUse:'Port is used by another program. Change the port.',fwHint:'Cannot reach the other computer? Press "Open Windows Firewall" on both computers, then tick Moi Tracker for Private and Public networks.',
  ago:s=>s<3?'just now':s<60?`${s}s ago`:s<3600?`${Math.floor(s/60)}m ago`:`${Math.floor(s/3600)}h ago`,never:'–',
  chipOn:n=>`🟢 ${n} connected`,chipWait:'🟡 searching…',chipOff:'⚪ sync off',updated:n=>`🔄 Updated from ${n}`,added:'Device added',fwOk:'Firewall screen opened',fwNo:'Could not open',confirmDel:'Remove this device?'},
 ta:{title:'நெட்வொர்க் ஒத்திசைவு',sub:'இரண்டு அல்லது அதற்கு மேற்பட்ட கணினிகளில் ஒரே மென்பொருளாகப் பயன்படுத்துங்கள். WiFi, LAN கேபிள் அல்லது NetBird வழியாக நேரடியாக. இணையம் இல்லாமல் உங்கள் சொந்த நெட்வொர்க்கிலும் வேலை செய்யும்.',
  on:'நேரடி ஒத்திசைவு இயங்குகிறது',off:'நேரடி ஒத்திசைவு நிறுத்தப்பட்டுள்ளது',nConn:(n,t)=>`${t} கருவிகளில் ${n} இணைந்துள்ளன`,none:'வேறு கருவி இணையவில்லை',
  start:'தொடங்கு',stop:'நிறுத்து',connAll:'அனைத்தையும் இணை',discAll:'அனைத்தையும் துண்டி',syncNow:'இப்போது ஒத்திசை',scan:'நெட்வொர்க்கைத் தேடு',scanning:(d,t)=>`தேடுகிறது ${d}/${t}…`,fw:'Windows Firewall திற',
  thisDev:'இந்தக் கணினி',devName:'கருவியின் பெயர்',port:'போர்ட்',pin:'குழு PIN (எல்லா கணினிகளிலும் ஒரே மாதிரி)',pinHint:'ஒரே PIN உள்ள கணினிகள் மட்டுமே இணையும். காலியாக விட்டால் நெட்வொர்க்கில் உள்ள அனைவரும் இணையலாம்.',noPin:'PIN இல்லை: இந்த நெட்வொர்க்கில் உள்ள எந்த Moi Tracker-ம் இணையலாம்.',
  listening:'இணைப்புகளை ஏற்கத் தயார்',notListening:'இணைப்புகளை ஏற்கவில்லை',yourIps:'உங்கள் முகவரிகள்',
  autoStart:'மென்பொருள் திறந்ததும் தானாகத் தொடங்கு',autoConnect:'நெட்வொர்க்கில் கண்ட கருவிகளுடன் தானாக இணை',discover:'கருவிகளைத் தானாகத் தேடு (broadcast)',
  nets:'பயன்படுத்தும் நெட்வொர்க்',mAll:'அனைத்தும்',wifi:'WiFi',lan:'LAN கேபிள்',netbird:'NetBird',other:'மற்றவை',virtual:'மெய்நிகர்',adapter:'அடாப்டர்',
  devices:'இணைந்த கருவிகள்',cName:'கருவி',cAddr:'முகவரி',cNet:'நெட்வொர்க்',cStat:'நிலை',cPing:'பிங்',cSync:'கடைசித் தரவு',cData:'↑ அனுப்பியது / ↓ பெற்றது',cAct:'கட்டுப்பாடு',
  connected:'இணைந்தது',connecting:'இணைக்கிறது…',failed:'தொடர்பில்லை',rejected:'நிராகரிக்கப்பட்டது',paused:'நிறுத்தப்பட்டது',idle:'காத்திருக்கிறது',
  bConn:'இணை',bDisc:'துண்டி',bDel:'நீக்கு',autoRe:'தானியங்கி',src_manual:'கைமுறை',src_auto:'தானியங்கி',src_incoming:'உள்வரும்',
  noDev:'வேறு கருவி இல்லை. அதே நெட்வொர்க்கில் உள்ள மற்றொரு கணினியில் மென்பொருளைத் திறங்கள் (இங்கே தானாகத் தெரியும்), அல்லது கீழே அதன் IP முகவரியைச் சேர்க்கவும்.',
  add:'கருவியைக் கைமுறையாகச் சேர்',ipPh:'IP முகவரி அல்லது பெயர்  (எ.கா. 192.168.1.20  அல்லது  100.64.1.5)',namePh:'பெயர் (விருப்பம்)',addBtn:'சேர்த்து இணை',
  log:'செயல்பாட்டுப் பதிவு',retry:s=>`${s} விநாடியில் மீண்டும்`,clock:s=>`கடிகாரம் ${s}வி வேறுபடுகிறது`,clockWarn:'கணினிகளின் கடிகாரங்கள் வேறுபடுகின்றன. எல்லாவற்றிலும் ஒரே நேரத்தை அமைக்கவும்.',
  netbirdHelp:'NetBird: எல்லா கணினிகளிலும் NetBird நிறுவி, ஒரே NetBird நெட்வொர்க்கில் சேர்த்து, மற்ற கணினியின் NetBird முகவரியை (100.x.x.x) அல்லது பெயரை மேலே சேர்க்கவும்.',
  portUse:'இந்த போர்ட்டை வேறு நிரல் பயன்படுத்துகிறது. போர்ட்டை மாற்றவும்.',fwHint:'மற்ற கணினியை அடைய முடியவில்லையா? இரண்டு கணினிகளிலும் "Windows Firewall திற" அழுத்தி, Moi Tracker-க்கு Private மற்றும் Public இரண்டையும் டிக் செய்யவும்.',
  ago:s=>s<3?'இப்போது':s<60?`${s}வி முன்`:s<3600?`${Math.floor(s/60)}நி முன்`:`${Math.floor(s/3600)}ம முன்`,never:'–',
  chipOn:n=>`🟢 ${n} இணைந்தது`,chipWait:'🟡 தேடுகிறது…',chipOff:'⚪ ஒத்திசைவு நிறுத்தம்',updated:n=>`🔄 ${n} இலிருந்து புதுப்பிக்கப்பட்டது`,added:'கருவி சேர்க்கப்பட்டது',fwOk:'Firewall திரை திறக்கப்பட்டது',fwNo:'திறக்க முடியவில்லை',confirmDel:'இந்தக் கருவியை நீக்கவா?'}};
const nt=(k,...a)=>{const v=(NT[lang]||NT.en)[k];return typeof v==='function'?v(...a):(v===undefined?k:v)};
const VIA={wifi:'WiFi',lan:'LAN',netbird:'NetBird',other:'Other',virtual:'Virtual'};
let ST=null,built=false,builtLang=null,shown=false;

/* ---------- style ---------- */
const css=document.createElement('style');css.textContent=`
.chip{background:rgba(5,20,56,.75);border:1px solid #3d72c8;color:#eaf1ff;border-radius:999px;padding:5px 14px;cursor:pointer;font:inherit;font-size:.9rem}.chip:hover{border-color:#d9a93c}
.npanel h2{margin:4px 0 2px;color:#f5dd8f;font-size:1.35rem}.ngrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin:12px 0}
.ncard{background:var(--panel);border:1px solid #2a5bb0;border-radius:14px;padding:14px;box-shadow:0 6px 20px rgba(0,0,0,.25);margin-bottom:12px}.ngrid .ncard{margin:0}
.ncard h3{margin:0 0 10px;color:#f5dd8f;font-size:1.02rem}
.nbig{display:flex;align-items:center;gap:12px;margin-bottom:10px}.nbig .dot{width:16px;height:16px;border-radius:50%;background:#7b8aa8;flex:none}.nbig .dot.on{background:#2fd17a;box-shadow:0 0 12px #2fd17a}.nbig .dot.wait{background:#f1c04a;box-shadow:0 0 10px #f1c04a}
.nbig b{font-size:1.15rem;color:#fff}.nbig small{display:block;color:var(--muted)}
.nbtns{display:flex;flex-wrap:wrap;gap:8px}.nrow{display:grid;grid-template-columns:130px 1fr;gap:8px;align-items:center;margin:7px 0}.nrow label{color:#bcd0f4;font-size:.85rem}
.nrow input[type=text],.nrow input[type=number],.nrow input[type=password]{width:100%}
.nchk{display:flex;gap:8px;align-items:flex-start;margin:7px 0;color:#dbe7ff;font-size:.92rem;cursor:pointer}.nchk input{width:auto;margin-top:3px}
.nmodes{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.nmodes button{border:1px solid #3d72c8;background:rgba(18,58,128,.6);color:#eaf1ff;border-radius:999px;padding:5px 14px;cursor:pointer;font:inherit;font-size:.88rem}.nmodes button.on{background:linear-gradient(#f6dc8a,#d3a238);color:#10224a;font-weight:700;border-color:#f1d27f}
.nif{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1d4585;font-size:.9rem}.nif:last-child{border:0}.nif .a{flex:1;min-width:0}.nif .a span{color:var(--muted);font-size:.82rem;display:block}.nif input{width:auto}
.nv{display:inline-block;border-radius:999px;padding:0 9px;font-size:.78rem;font-weight:600;color:#10224a;background:#9db4da}.nv.wifi{background:#6cc1ff}.nv.lan{background:#8be28b}.nv.netbird{background:#f1c04a}.nv.virtual{background:#6b7fa8;color:#fff}
.nst{display:inline-block;border-radius:999px;padding:1px 10px;font-size:.8rem;font-weight:700}.nst.connected{background:#1f9d62;color:#fff}.nst.connecting{background:#d6a021;color:#10224a}.nst.failed,.nst.rejected{background:#c83a5a;color:#fff}.nst.paused,.nst.idle{background:#53648a;color:#fff}
.ntab td,.ntab th{white-space:nowrap}.ntab td.w{white-space:normal;max-width:240px}.ntab small{color:var(--muted);display:block}
.nbad{background:rgba(200,58,90,.18);border:1px solid #c83a5a;border-radius:10px;padding:8px 12px;margin:8px 0;font-size:.9rem}.nwarn{background:rgba(217,169,60,.16);border:1px solid #d9a93c;border-radius:10px;padding:8px 12px;margin:8px 0;font-size:.9rem}
.nlog{max-height:220px;overflow:auto;font-family:Consolas,monospace;font-size:.8rem;color:#cfe0ff}.nlog div{padding:2px 0;border-bottom:1px dashed #1d4585}.nlog .err{color:#ff9fb4}.nlog .warn{color:#f1c04a}.nlog .ok{color:#7ee2a8}
.nadd{display:grid;grid-template-columns:2fr 90px 1.2fr auto;gap:8px;margin-top:10px}@media(max-width:760px){.nadd{grid-template-columns:1fr 1fr}.nrow{grid-template-columns:1fr}}
`;document.head.appendChild(css);

/* ---------- data bridge: push every change, pull incoming ONE BY ONE ---------- */
let npt=null,npulling=false;
window.netPush=function(){if(!LAN)return;clearTimeout(npt);npt=setTimeout(()=>{try{LAN.push(JSON.stringify(S))}catch(e){}},150)};
async function netPull(){
  if(npulling)return;npulling=true;let from='';
  try{for(;;){const items=await LAN.take();if(!items||!items.length)break;
    for(const it of items){try{const d=JSON.parse(it.data);if(adopt(d)){save();render();from=it.from||from}}catch(e){}}}}
  catch(e){}finally{npulling=false}
  if(from)toast(nt('updated',from));
}

/* ---------- view switching ---------- */
window.netShow=function(on){const mv=$('mainv'),nv=$('netv');if(!mv||!nv)return;shown=!!on;mv.hidden=shown;nv.hidden=!shown;if(shown){build();update()}};

/* ---------- build the static skeleton once per language ---------- */
function build(){
  if(built&&builtLang===lang)return;built=true;builtLang=lang;const nv=$('netv');
  nv.innerHTML=`<div class="npanel"><h2>${esc(nt('title'))}</h2><p class="legend">${esc(nt('sub'))}</p>
  <div class="ngrid">
   <div class="ncard"><div class="nbig"><span class="dot" id="ndot"></span><div><b id="nhead"></b><small id="nsub"></small></div></div>
    <div class="nbtns"><button class="btn sm" data-a="toggle" id="ntog"></button><button class="btn alt sm" data-a="connAll">${esc(nt('connAll'))}</button><button class="btn alt sm" data-a="discAll">${esc(nt('discAll'))}</button><button class="btn alt sm" data-a="syncNow">${esc(nt('syncNow'))}</button><button class="btn alt sm" data-a="scan" id="nscan">${esc(nt('scan'))}</button><button class="btn alt sm" data-a="fw">${esc(nt('fw'))}</button></div>
    <div id="nalerts"></div></div>
   <div class="ncard"><h3>${esc(nt('thisDev'))}</h3>
    <div class="nrow"><label>${esc(nt('devName'))}</label><input type="text" id="cName" data-c="name" maxlength="40"></div>
    <div class="nrow"><label>${esc(nt('port'))}</label><input type="number" id="cPort" data-c="port" min="1024" max="65535"></div>
    <div class="nrow"><label>${esc(nt('pin'))}</label><input type="password" id="cPin" data-c="pin" maxlength="64" autocomplete="off"></div>
    <div class="legend" style="margin:0 0 6px">${esc(nt('pinHint'))}</div>
    <label class="nchk"><input type="checkbox" id="cEn" data-c="enabled"><span>${esc(nt('autoStart'))}</span></label>
    <label class="nchk"><input type="checkbox" id="cAuto" data-c="autoConnect"><span>${esc(nt('autoConnect'))}</span></label>
    <label class="nchk"><input type="checkbox" id="cDisc" data-c="discover"><span>${esc(nt('discover'))}</span></label></div>
   <div class="ncard"><h3>${esc(nt('nets'))}</h3><div class="nmodes" id="nmodes"></div><div id="nifs"></div><div class="legend" style="margin-top:8px">${esc(nt('netbirdHelp'))}</div></div>
  </div>
  <div class="ncard"><h3>${esc(nt('devices'))}</h3><div class="tw"><table class="ntab"><thead><tr><th>${esc(nt('cName'))}</th><th>${esc(nt('cAddr'))}</th><th>${esc(nt('cNet'))}</th><th>${esc(nt('cStat'))}</th><th class="a">${esc(nt('cPing'))}</th><th>${esc(nt('cSync'))}</th><th>${esc(nt('cData'))}</th><th>${esc(nt('cAct'))}</th></tr></thead><tbody id="npeers"></tbody></table></div>
   <div id="nempty" class="empty" style="margin-top:10px"></div>
   <h3 style="margin-top:14px">${esc(nt('add'))}</h3>
   <div class="nadd"><input type="text" id="aIp" placeholder="${esc(nt('ipPh'))}"><input type="number" id="aPort" placeholder="port" min="1" max="65535"><input type="text" id="aName" placeholder="${esc(nt('namePh'))}" maxlength="40"><button class="btn" data-a="add">${esc(nt('addBtn'))}</button></div></div>
  <details class="ncard"><summary style="cursor:pointer;color:#f5dd8f;font-weight:700">${esc(nt('log'))}</summary><div class="nlog" id="nlog" style="margin-top:8px"></div></details></div>`;
}
const setVal=(id,v)=>{const el=$(id);if(el&&document.activeElement!==el&&el.value!==String(v))el.value=v};
const setChk=(id,v)=>{const el=$(id);if(el&&document.activeElement!==el)el.checked=!!v};
function modeOf(c){const u=c.use,on=k=>u[k]!==false;if(Object.keys(c.ov||{}).length)return '';
  if(on('wifi')&&on('lan')&&on('netbird')&&on('other'))return 'all';if(on('wifi')&&!on('lan')&&!on('netbird')&&!on('other'))return 'wifi';if(!on('wifi')&&on('lan')&&!on('netbird')&&!on('other'))return 'lan';if(!on('wifi')&&!on('lan')&&on('netbird')&&!on('other'))return 'netbird';return ''}
const time=ms=>new Date(ms).toLocaleTimeString();
const agoOf=ms=>ms?nt('ago',Math.max(0,Math.round((Date.now()-ms)/1000))):nt('never');

/* ---------- refresh the dynamic parts ---------- */
function update(){
  const st=ST;chip();if(!shown||!built||!st)return;
  const c=st.cfg,n=st.connected,total=st.peers.length;
  $('ndot').className='dot '+(st.running?(n?'on':'wait'):'');
  $('nhead').textContent=st.running?nt('on'):nt('off');
  $('nsub').textContent=st.running?(n?nt('nConn',n,total):nt('none')):'';
  $('ntog').textContent=st.running?nt('stop'):nt('start');
  const sc=st.scan;$('nscan').textContent=sc&&sc.running?nt('scanning',sc.done,sc.total):nt('scan');$('nscan').disabled=!!(sc&&sc.running);
  let al='';
  if(st.running&&st.serverErr)al+=`<div class="nbad">⚠ ${esc(st.serverErr)}. ${esc(nt('portUse'))}</div>`;
  if(st.running&&!c.pin)al+=`<div class="nwarn">${esc(nt('noPin'))}</div>`;
  const skew=st.peers.filter(p=>p.state==='connected'&&p.clock!==null&&Math.abs(p.clock)>2000);
  if(skew.length)al+=`<div class="nwarn">⏱ ${esc(nt('clockWarn'))} (${skew.map(p=>esc(p.name)+' '+Math.round(p.clock/1000)+'s').join(', ')})</div>`;
  if(st.running&&st.peers.some(p=>p.state==='failed'&&/refused|timeout|No answer/i.test(p.err||'')))al+=`<div class="nwarn">🛡 ${esc(nt('fwHint'))}</div>`;
  $('nalerts').innerHTML=al;
  setVal('cName',c.name||st.host||'');setVal('cPort',c.port);setVal('cPin',c.pin||'');setChk('cEn',c.enabled);setChk('cAuto',c.autoConnect);setChk('cDisc',c.discover);
  const m=modeOf(c);
  $('nmodes').innerHTML=[['all','mAll'],['wifi','wifi'],['lan','lan'],['netbird','netbird']].map(([k,l])=>`<button type="button" data-a="mode" data-v="${k}" class="${m===k?'on':''}">${esc(nt(l))}</button>`).join('');
  $('nifs').innerHTML=st.ifaces.length?st.ifaces.map(f=>`<label class="nif"><input type="checkbox" data-a="ifc" data-n="${esc(f.name)}" ${f.enabled?'checked':''}><div class="a">${esc(f.name)}<span>${esc(f.address)}/${f.bits}</span></div><span class="nv ${f.cls}">${esc(VIA[f.cls]||f.cls)}</span></label>`).join(''):`<div class="legend">–</div>`;
  const order={connected:0,connecting:1,failed:2,rejected:3,idle:4,paused:5};
  const ps=st.peers.slice().sort((a,b)=>(order[a.state]-order[b.state])||String(a.name).localeCompare(b.name));
  $('npeers').innerHTML=ps.map(p=>{
    const live=p.state==='connected',sub=live?(p.clock!==null&&Math.abs(p.clock)>2000?'⏱ '+nt('clock',Math.round(p.clock/1000)):''):(p.state==='failed'||p.state==='rejected')?(p.err||'')+(p.nextIn?' · '+nt('retry',p.nextIn):''):'';
    const act=(p.src==='incoming')?'':`${live||p.state==='connecting'?`<button class="btn alt sm" data-a="disc" data-k="${esc(p.key)}">${esc(nt('bDisc'))}</button>`:`<button class="btn sm" data-a="conn" data-k="${esc(p.key)}">${esc(nt('bConn'))}</button>`}
      <label class="nchk" style="display:inline-flex;margin:0 0 0 6px" title="${esc(nt('autoRe'))}"><input type="checkbox" data-a="pauto" data-k="${esc(p.key)}" ${p.auto?'checked':''}><span>${esc(nt('autoRe'))}</span></label>
      ${p.src==='manual'?`<button class="btn alt sm" data-a="del" data-k="${esc(p.key)}">✕</button>`:''}`;
    return `<tr><td class="w"><b>${esc(p.name)}</b><small>${esc(nt('src_'+p.src))}${p.id?' · '+esc(p.id.slice(0,6)):''}</small></td><td>${esc(p.ip)}:${p.port||''}</td><td><span class="nv ${p.via}">${esc(VIA[p.via]||p.via)}</span>${p.iface?`<small>${esc(p.iface)}</small>`:''}</td><td class="w"><span class="nst ${p.state}">${esc(nt(p.state))}</span>${sub?`<small>${esc(sub)}</small>`:''}</td><td class="a">${live&&p.rtt!==null?p.rtt+' ms':'–'}</td><td>${live?esc(agoOf(p.lastSync)):'–'}</td><td>${live?`↑ ${p.sent} / ↓ ${p.recv}`:'–'}</td><td>${act}</td></tr>`}).join('');
  const ne=$('nempty');ne.hidden=ps.length>0;ne.textContent=nt('noDev');
  $('nlog').innerHTML=st.logs.slice().reverse().map(l=>`<div class="${l.l}">${esc(time(l.t))} · ${esc(l.m)}</div>`).join('');
}
function chip(){const el=$('netchip');if(!el)return;if(!LAN){el.hidden=true;return}el.hidden=false;const st=ST;
  el.textContent=!st?nt('chipWait'):!st.running?nt('chipOff'):st.connected?nt('chipOn',st.connected):nt('chipWait');
  el.title=st&&st.running?(st.ifaces.filter(f=>f.enabled).map(f=>f.address).join('  '))||'':''}

/* ---------- actions ---------- */
async function act(fn){try{const r=await fn();return r}catch(e){return null}}
document.addEventListener('click',async ev=>{
  const chipEl=ev.target.closest('#netchip');if(chipEl){const b=document.querySelector('#nav [data-n=net]');if(b)b.click();return}
  const b=ev.target.closest('#netv [data-a]');if(!b||!LAN||b.tagName==='INPUT')return;const a=b.dataset.a,k=b.dataset.k;
  if(a==='toggle')await act(()=>LAN.cfg({enabled:!ST.running}));
  else if(a==='connAll')await act(()=>LAN.connectAll());
  else if(a==='discAll')await act(()=>LAN.disconnectAll());
  else if(a==='syncNow'){await act(()=>LAN.push(JSON.stringify(S)));await act(()=>LAN.syncNow())}
  else if(a==='scan')await act(()=>LAN.scan());
  else if(a==='fw'){const r=await act(()=>LAN.firewall());toast(r&&r.ok?nt('fwOk'):nt('fwNo'))}
  else if(a==='conn')await act(()=>LAN.connect(k));
  else if(a==='disc')await act(()=>LAN.disconnect(k));
  else if(a==='del'){if(await ask(nt('confirmDel')))await act(()=>LAN.remove(k))}
  else if(a==='mode'){const v=b.dataset.v,u={wifi:false,lan:false,netbird:false,other:false};if(v==='all')Object.keys(u).forEach(x=>u[x]=true);else u[v]=true;await act(()=>LAN.cfg({use:u,ov:{}}))}
  else if(a==='add'){const ip=$('aIp').value.trim();if(!ip)return;const r=await act(()=>LAN.add({ip,port:+$('aPort').value||undefined,name:$('aName').value.trim()}));
    if(r&&r.ok){$('aIp').value='';$('aName').value='';$('aPort').value='';toast('✔ '+nt('added'))}else toast('⚠ '+(r&&r.err||'error'))}
  refresh();
});
document.addEventListener('change',async ev=>{
  const el=ev.target;if(!LAN||!el.closest('#netv'))return;
  if(el.dataset.c){const k=el.dataset.c,v=el.type==='checkbox'?el.checked:el.value;await act(()=>LAN.cfg({[k]:k==='port'?+v:v}))}
  else if(el.dataset.a==='ifc'){const ov=Object.assign({},ST.cfg.ov||{});ov[el.dataset.n]=el.checked;await act(()=>LAN.cfg({ov}))}
  else if(el.dataset.a==='pauto')await act(()=>LAN.peerAuto(el.dataset.k,el.checked));
  refresh();
});
document.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.closest&&ev.target.closest('.nadd')){ev.preventDefault();const b=document.querySelector('#netv [data-a=add]');b&&b.click()}});
async function refresh(){try{ST=await LAN.status();update()}catch(e){}}

/* ---------- start ---------- */
if(!LAN){const b=document.querySelector('#nav [data-n=net]');if(b)b.hidden=true;chip();return}
const _render=render;render=function(){_render();if(shown){built=false;build()}update()};
LAN.onStatus(s=>{ST=s;update()});LAN.onInbox(()=>netPull());
setInterval(()=>{if(shown&&ST)update()},1000);
refresh();netPush();netPull();
})();
