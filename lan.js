'use strict';
/* Moi Tracker - live multi-device sync engine (WiFi / LAN cable / NetBird).
   Pure Node (net + dgram + zlib). The renderer owns the data; this module only moves snapshots between devices.
   - one TCP link per remote device (duplicates are resolved deterministically)
   - UDP broadcast discovery + manual IP list + optional subnet scan
   - heartbeat, auto-reconnect with back-off, PIN (group key), per-network on/off
   - incoming snapshots are queued per device (latest wins) and handed to the app ONE AT A TIME */
const net=require('net'),dgram=require('dgram'),os=require('os'),crypto=require('crypto'),zlib=require('zlib'),fs=require('fs'),path=require('path');
const {EventEmitter}=require('events');

const PROTO=1,MAXMSG=256*1024*1024,UDP_PORT=45874,HB_EVERY=4000,HB_DEAD=13000;
const DEF={enabled:true,autoConnect:true,discover:true,port:45873,name:'',pin:'',use:{wifi:true,lan:true,netbird:true,other:true,virtual:false},ov:{},peers:[],known:{}};
const now=()=>Date.now();
const ip2n=ip=>ip.split('.').reduce((a,b)=>a*256+(+b),0);
const isIPv4=s=>/^\d{1,3}(\.\d{1,3}){3}$/.test(s)&&s.split('.').every(n=>+n<=255);
const inRange=(ip,base,bits)=>{const m=bits===0?0:(0xFFFFFFFF<<(32-bits))>>>0;return ((ip2n(ip)&m)>>>0)===((ip2n(base)&m)>>>0)};
const sha=s=>crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,24);
const classify=(name,addr)=>{
  if(/vethernet|vmware|virtualbox|vbox|hyper-v|docker|^veth|^br-|bluetooth|wsl|vmnet|loopback/i.test(name))return 'virtual';
  if(/netbird|^wt\d|wireguard|^wg\d|tailscale|zerotier|^utun/i.test(name)||inRange(addr,'100.64.0.0',10))return 'netbird';
  if(/wi-?fi|wlan|wireless|^wl|airport/i.test(name))return 'wifi';
  if(/ethernet|^eth|^en\d|^enp|^eno|^ens|local area|\blan\b/i.test(name))return 'lan';
  return 'other';
};

class Lan extends EventEmitter{
  constructor(o){
    super();o=o||{};
    this.dir=o.dir;this.hostname=o.hostname||os.hostname();this.allowLoopback=!!o.allowLoopback;this.udpPort=o.udpPort||UDP_PORT;
    this.file=this.dir?path.join(this.dir,'moi-lan.json'):null;
    this.cfg=this._load();
    if(!this.cfg.id){this.cfg.id=crypto.randomBytes(6).toString('hex');this._saveNow()}
    this.id=this.cfg.id;
    this.targets=new Map();this.links=new Map();this.inbox=new Map();this.logs=[];
    this.lastState='';this.running=false;this.listening=false;this.serverErr='';this.scanInfo=null;
    this._ifc=null;this._ifcAt=0;
  }
  /* ---------------- config ---------------- */
  _load(){let c={};try{c=JSON.parse(fs.readFileSync(this.file,'utf8'))}catch(e){}
    const cfg=Object.assign({},DEF,c);cfg.use=Object.assign({},DEF.use,c.use||{});cfg.ov=c.ov&&typeof c.ov==='object'?c.ov:{};
    cfg.peers=Array.isArray(c.peers)?c.peers:[];cfg.known=c.known&&typeof c.known==='object'?c.known:{};return cfg}
  _saveNow(){if(!this.file)return;try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(this.cfg,null,1))}catch(e){}}
  _save(){clearTimeout(this._st);this._st=setTimeout(()=>this._saveNow(),300)}
  get name(){return(this.cfg.name||this.hostname||'Moi PC').slice(0,40)}
  grp(){return sha('moi|'+(this.cfg.pin||''))}
  log(level,msg){this.logs.push({t:now(),l:level,m:msg});if(this.logs.length>120)this.logs.shift();this.touch()}
  touch(){if(this._tt)return;this._tt=setTimeout(()=>{this._tt=null;this.emit('status')},250)}

  setCfg(p){
    p=p||{};const c=this.cfg;let restart=false,drop=false,rescan=false;
    ['enabled','autoConnect','discover'].forEach(k=>{if(typeof p[k]==='boolean'&&p[k]!==c[k]){c[k]=p[k];if(k==='enabled')restart=true;if(k==='discover')rescan=true}});
    if(p.port!==undefined){const n=Math.round(+p.port);if(n>=1024&&n<=65535&&n!==c.port){c.port=n;restart=true}}
    if(typeof p.name==='string'&&p.name.trim()!==c.name){c.name=p.name.trim().slice(0,40);this._announceSoon()}
    if(typeof p.pin==='string'&&p.pin.slice(0,64)!==c.pin){c.pin=p.pin.slice(0,64);drop=true}
    if(p.use&&typeof p.use==='object'){Object.keys(DEF.use).forEach(k=>{if(typeof p.use[k]==='boolean')c.use[k]=p.use[k]});drop=true}
    if(p.ov&&typeof p.ov==='object'){c.ov=p.ov;drop=true}
    this._save();
    if(restart){this.stop();if(c.enabled)this.start()}
    else{if(drop)this._dropDisallowed(drop&&typeof p.pin==='string');if(rescan&&this.running){this._udpStop();if(c.discover)this._udpStart()}}
    this.log('info','Settings changed');this.touch();
  }
  /* ---------------- network interfaces ---------------- */
  ifaces(){
    if(this._ifc&&now()-this._ifcAt<2500)return this._ifc;
    const out=[],all=os.networkInterfaces();
    Object.keys(all).forEach(name=>(all[name]||[]).forEach(a=>{
      if(!(a.family==='IPv4'||a.family===4))return;
      if(a.internal&&!this.allowLoopback)return;
      const cls=a.internal?'lan':classify(name,a.address),bits=ip2n(a.netmask).toString(2).split('1').length-1;
      const ov=this.cfg.ov[name];
      out.push({name,address:a.address,netmask:a.netmask,bits,cls,enabled:ov!==undefined?!!ov:this.cfg.use[cls]!==false});
    }));
    this._ifc=out;this._ifcAt=now();return out;
  }
  /* which network does this remote address belong to */
  netOf(ip){
    if(!isIPv4(ip))return {cls:'other',iface:null,enabled:this.cfg.use.netbird!==false||this.cfg.use.other!==false};
    if(/^127\./.test(ip))return {cls:'lan',iface:'loopback',enabled:this.allowLoopback&&this.cfg.use.lan!==false&&this.cfg.ov.lo!==false};
    for(const f of this.ifaces()){if(inRange(ip,f.address,f.bits))return {cls:f.cls,iface:f.name,enabled:f.enabled}}
    const cls=inRange(ip,'100.64.0.0',10)?'netbird':'other';return {cls,iface:null,enabled:this.cfg.use[cls]!==false};
  }
  allowedIp(ip){return this.netOf(ip).enabled}
  _dropDisallowed(all){this.links.forEach(c=>{if(all||!this.allowedIp(c.ip)){c.drop=true;this._kill(c,all?'Group PIN changed':'Network disabled')}})}

  /* ---------------- lifecycle ---------------- */
  start(){
    if(this.running)return;this.running=true;
    this.targets.clear();
    (this.cfg.peers||[]).forEach(p=>this._addTarget({ip:p.ip,port:p.port,name:p.name,src:'manual',auto:p.auto!==false,paused:!!p.paused}));
    Object.keys(this.cfg.known||{}).forEach(id=>{const k=this.cfg.known[id];if(k&&k.ip)this._addTarget({ip:k.ip,port:k.port,name:k.name,src:'auto',devId:id,auto:true,paused:!!k.paused,seen:k.last||0})});
    this._startServer();if(this.cfg.discover)this._udpStart();
    this._tick=setInterval(()=>this._tickFn(),1000);this._tick.unref&&this._tick.unref();
    this.log('info','Live sync started (device '+this.name+')');this.touch();
  }
  stop(){
    if(!this.running&&!this.server)return;this.running=false;
    clearInterval(this._tick);clearTimeout(this._srvRetry);this._udpStop();
    try{this.server&&this.server.close()}catch(e){}this.server=null;this.listening=false;
    this.links.forEach(c=>{c.drop=true;this._kill(c,'Stopped')});
    this.targets.forEach(t=>{try{t.sock&&t.sock.destroy()}catch(e){}t.sock=null;t.state='idle'});
    this.links.clear();this.log('info','Live sync stopped');this.touch();
  }
  _startServer(){
    if(!this.running)return;
    const s=net.createServer(sock=>{try{this._onIncoming(sock)}catch(e){try{sock.destroy()}catch(x){}}});
    this.server=s;
    s.on('error',e=>{this.listening=false;this.serverErr=e.code==='EADDRINUSE'?'Port '+this.cfg.port+' is used by another program':(e.code||e.message);this.log('err','Server: '+this.serverErr);
      try{s.close()}catch(x){}if(this.server===s)this.server=null;clearTimeout(this._srvRetry);if(this.running)this._srvRetry=setTimeout(()=>this._startServer(),5000)});
    s.listen(this.cfg.port,'0.0.0.0',()=>{this.listening=true;this.serverErr='';this.log('info','Listening on port '+this.cfg.port);this.touch()});
  }
  /* ---------------- targets (who we try to reach) ---------------- */
  _key(ip,port){return ip+':'+port}
  _addTarget(o){
    const port=+o.port||this.cfg.port,key=this._key(o.ip,port);let t=this.targets.get(key);
    if(!t){t={key,ip:o.ip,port,name:o.name||'',src:o.src||'manual',auto:o.auto!==false,paused:!!o.paused,devId:o.devId||null,state:'idle',err:'',tries:0,nextAt:0,sock:null,seen:o.seen||0};this.targets.set(key,t)}
    else{if(o.name&&!t.name)t.name=o.name;if(o.devId)t.devId=o.devId}
    return t;
  }
  _findTarget(id,ip,port){
    for(const t of this.targets.values()){if(id&&t.devId===id)return t}
    if(ip&&port){const t=this.targets.get(this._key(ip,port));if(t)return t}
    return null;
  }
  addPeer(o){
    const ip=String(o&&o.ip||'').trim(),port=Math.round(+(o&&o.port)||this.cfg.port);
    if(!/^[A-Za-z0-9._-]{1,100}$/.test(ip))return {ok:false,err:'Invalid IP / host name'};
    if(port<1||port>65535)return {ok:false,err:'Invalid port'};
    const key=this._key(ip,port);
    if(!(this.cfg.peers||[]).some(p=>this._key(p.ip,p.port)===key))this.cfg.peers.push({ip,port,name:String(o.name||'').slice(0,40),auto:true,paused:false});
    const ex=this.targets.get(key);if(ex&&ex.src!=='manual'){ex.src='manual'}
    const t=this._addTarget({ip,port,name:o.name,src:'manual',auto:true});t.src='manual';t.paused=false;t.nextAt=0;t.tries=0;
    this._save();this.log('info','Device added: '+key);if(this.running)this._connect(t);this.touch();return {ok:true,key};
  }
  removePeer(key){
    const t=this.targets.get(key);if(!t)return {ok:false};
    this.cfg.peers=(this.cfg.peers||[]).filter(p=>this._key(p.ip,p.port)!==key);
    if(t.devId&&this.cfg.known[t.devId]){delete this.cfg.known[t.devId]}
    const l=t.devId&&this.links.get(t.devId);if(l){l.drop=true;this._kill(l,'Removed')}
    try{t.sock&&t.sock.destroy()}catch(e){}this.targets.delete(key);this._save();this.log('info','Device removed: '+key);this.touch();return {ok:true};
  }
  connect(key){const t=this.targets.get(key);if(!t)return {ok:false};t.paused=false;t.nextAt=0;t.tries=0;t.err='';this._persistPeer(t);if(this.running)this._connect(t);this.touch();return {ok:true}}
  disconnect(key){const t=this.targets.get(key);if(!t)return {ok:false};t.paused=true;t.state='idle';this._persistPeer(t);
    const l=t.devId&&this.links.get(t.devId);if(l){l.drop=true;this._kill(l,'Disconnected by user')}try{t.sock&&t.sock.destroy()}catch(e){}this.log('info','Disconnected: '+(t.name||key));this.touch();return {ok:true}}
  setPeerAuto(key,v){const t=this.targets.get(key);if(!t)return {ok:false};t.auto=!!v;this._persistPeer(t);this.touch();return {ok:true}}
  _persistPeer(t){
    if(t.src==='manual'){const p=(this.cfg.peers||[]).find(p=>this._key(p.ip,p.port)===t.key);if(p){p.auto=t.auto;p.paused=t.paused}}
    else if(t.devId&&this.cfg.known[t.devId])this.cfg.known[t.devId].paused=t.paused;
    this._save();
  }
  connectAll(){this.targets.forEach(t=>{if(t.paused||t.state!=='connected'){t.paused=false;t.nextAt=0;t.tries=0;this._persistPeer(t);if(this.running)this._connect(t)}});this.touch();return {ok:true}}
  disconnectAll(){this.targets.forEach(t=>{t.paused=true;t.state='idle';this._persistPeer(t)});this.links.forEach(l=>{l.drop=true;this._kill(l,'Disconnected by user')});this.touch();return {ok:true}}

  /* ---------------- connecting ---------------- */
  _linkAlive(t){const l=t.devId&&this.links.get(t.devId);return !!(l&&l.hello&&!l.dead)}
  _connect(t){
    if(!this.running||t.paused||t.sock||this._linkAlive(t))return;
    if(!this.netOf(t.ip).enabled){t.state='idle';t.err='Network disabled';return}
    t.state='connecting';t.err='';
    const opt={host:t.ip,port:t.port};
    const f=this.ifaces().find(f=>f.enabled&&isIPv4(t.ip)&&inRange(t.ip,f.address,f.bits)&&!/^127\./.test(f.address));if(f)opt.localAddress=f.address;
    let sock;try{sock=net.connect(opt)}catch(e){this._failed(t,e.message);return}
    t.sock=sock;
    const to=setTimeout(()=>{try{sock.destroy(new Error('Timeout'))}catch(e){}},6000);
    sock.once('connect',()=>clearTimeout(to));sock.once('close',()=>clearTimeout(to));
    this._attach(sock,{initiator:true,target:t,ip:t.ip,port:t.port});
    this.touch();
  }
  _failed(t,err){t.state='failed';t.err=err||'';t.tries=Math.min(t.tries+1,12);t.nextAt=now()+Math.min(30000,800*Math.pow(1.8,t.tries))+Math.random()*500;this.touch()}
  _onIncoming(sock){
    const ip=String(sock.remoteAddress||'').replace('::ffff:','');
    if(!this.running||!this.allowedIp(ip)){sock.destroy();return}
    this._attach(sock,{initiator:false,ip,port:null});
  }
  _attach(sock,info){
    const c={sock,initiator:info.initiator,target:info.target||null,ip:info.ip,port:info.port,chunks:[],have:0,need:0,hello:false,dead:false,id:null,name:'',born:now(),lastRx:now(),lastPing:0,rtt:null,sent:0,recv:0,lastSync:0,clock:0,sending:false,dirty:false,err:''};
    sock.setNoDelay(true);sock.setKeepAlive(true,5000);
    sock.on('data',d=>{try{this._onData(c,d)}catch(e){this._kill(c,'Bad data')}});
    sock.on('error',e=>{c.err=e.code||e.message});
    sock.on('close',()=>this._onClose(c));
    c.hsTimer=setTimeout(()=>{if(!c.hello)this._kill(c,'Handshake timeout')},8000);
    if(info.initiator)sock.once('connect',()=>this._hello(c));else this._hello(c);
    return c;
  }
  _hello(c){this._send(c,{t:'hello',v:PROTO,id:this.id,name:this.name,grp:this.grp(),port:this.cfg.port,time:now(),host:this.hostname})}
  /* frame = 4 byte length + 1 byte flags (1 = gzip) + payload */
  _frame(obj){
    let p=Buffer.from(typeof obj==='string'?obj:JSON.stringify(obj),'utf8'),fl=0;
    if(p.length>1024){try{p=zlib.gzipSync(p,{level:3});fl=1}catch(e){}}
    const h=Buffer.alloc(5);h.writeUInt32BE(p.length,0);h[4]=fl;return Buffer.concat([h,p]);
  }
  _send(c,obj){if(c.dead||c.sock.destroyed)return;try{c.sock.write(this._frame(obj))}catch(e){}}
  _onData(c,d){
    c.chunks.push(d);c.have+=d.length;c.lastRx=now();
    for(;;){
      if(c.need===0){
        if(c.have<5)return;
        const b=Buffer.concat(c.chunks);c.chunks=[b];const len=b.readUInt32BE(0);
        if(len>MAXMSG){this._kill(c,'Message too large');return}
        c.need=5+len;c.flag=b[4];
      }
      if(c.have<c.need)return;
      const b=Buffer.concat(c.chunks),body=b.subarray(5,c.need),rest=b.subarray(c.need);
      c.chunks=rest.length?[rest]:[];c.have=rest.length;c.need=0;
      let m;try{m=JSON.parse((c.flag&1?zlib.gunzipSync(body):body).toString('utf8'))}catch(e){this._kill(c,'Bad message');return}
      this._onMsg(c,m);if(c.dead)return;
    }
  }
  _lowInit(c){return (c.initiator&&this.id<c.id)||(!c.initiator&&c.id<this.id)}
  _onMsg(c,m){
    if(!m||typeof m!=='object')return;
    if(!c.hello){
      if(m.t==='bye'){c.bye=m.r;if(c.target){c.target.state='rejected';c.target.err=m.r==='pin'?'PIN does not match':String(m.r||'Rejected');c.target.nextAt=now()+30000}this._kill(c,'Rejected: '+m.r);return}
      if(m.t!=='hello'||typeof m.id!=='string'){this._kill(c,'Not a Moi Tracker device');return}
      if(m.grp!==this.grp()){this._send(c,{t:'bye',r:'pin'});if(c.target){c.target.state='rejected';c.target.err='PIN does not match';c.target.nextAt=now()+30000}this.log('warn','PIN mismatch with '+(m.name||c.ip));setTimeout(()=>this._kill(c,'PIN mismatch'),200);return}
      if(m.id===this.id){if(c.target){this.targets.delete(c.target.key);this.cfg.peers=(this.cfg.peers||[]).filter(p=>this._key(p.ip,p.port)!==c.target.key);this._save()}c.drop=true;this._kill(c,'This device itself');return}
      c.id=m.id;c.name=String(m.name||m.host||c.ip).slice(0,40);c.peerPort=+m.port||this.cfg.port;c.clock=(+m.time||now())-now();
      const old=this.links.get(c.id);
      if(old&&!old.dead){
        const oldGood=this._lowInit(old),newGood=this._lowInit(c),stale=now()-old.lastRx>HB_DEAD*0.8;
        if((newGood&&!oldGood)||(stale&&!(!newGood&&oldGood))){old.drop=true;this._kill(old,'Replaced by newer link')}
        else{c.drop=true;this._kill(c,'Duplicate link');return}
      }
      c.hello=true;clearTimeout(c.hsTimer);this.links.set(c.id,c);
      let t=c.target||this._findTarget(c.id,c.ip,c.peerPort);
      if(!t&&isIPv4(c.ip)){t=this._addTarget({ip:c.ip,port:c.peerPort,name:c.name,src:'auto',devId:c.id,auto:this.cfg.autoConnect});}
      if(t){t.devId=c.id;t.name=t.name||c.name;t.state='connected';t.err='';t.tries=0;t.seen=now();c.target=t;if(t.sock&&t.sock!==c.sock&&t!==c.target){}}
      if(t&&t.src!=='manual'){this.cfg.known[c.id]={ip:t.ip,port:t.port,name:c.name,last:now(),paused:!!t.paused};this._save()}
      this.log('ok','Connected: '+c.name+' ('+c.ip+') via '+this.netOf(c.ip).cls.toUpperCase()+(c.initiator?'':' (incoming)'));
      c.lastPing=0;this.sendState(c);this.touch();return;
    }
    switch(m.t){
      case 'state':if(typeof m.d==='string'){this.inbox.set(c.id,{id:c.id,from:c.name,data:m.d,at:now()});c.recv++;c.lastSync=now();this.emit('inbox');this.touch()}break;
      case 'req':c.dirty=false;this.sendState(c,true);break;
      case 'ping':this._send(c,{t:'pong',ts:m.ts,now:now()});break;
      case 'pong':if(typeof m.ts==='number'){c.rtt=Math.max(0,now()-m.ts);if(typeof m.now==='number')c.clock=m.now-(now()-c.rtt/2);this.touch()}break;
      case 'bye':c.bye=m.r;c.drop=m.r==='pin'?false:c.drop;this._kill(c,'Closed by '+c.name);break;
    }
  }
  _kill(c,why){
    if(c.dead)return;c.dead=true;c.why=why;clearTimeout(c.hsTimer);
    if(this.links.get(c.id)===c)this.links.delete(c.id);
    try{c.sock.destroy()}catch(e){}this._onClose(c,true);
  }
  _onClose(c,fromKill){
    if(!fromKill&&!c.dead){c.dead=true;if(this.links.get(c.id)===c)this.links.delete(c.id)}
    if(c.closedHandled)return;c.closedHandled=true;clearTimeout(c.hsTimer);
    const t=c.target;
    if(c.hello&&!c.drop)this.log('warn','Disconnected: '+c.name+(c.why?' ('+c.why+')':c.err?' ('+c.err+')':''));
    if(t){
      if(t.sock===c.sock)t.sock=null;
      const alive=t.devId&&this.links.get(t.devId);
      if(alive){t.state='connected'}
      else if(t.state!=='rejected'){
        if(c.hello&&!c.drop){t.state='failed';t.err=c.why||c.err||'Connection lost';t.tries=0;t.nextAt=now()+1000}
        else if(!c.hello&&!c.drop){this._failed(t,c.err==='ECONNREFUSED'?'Connection refused (is the app running there? firewall?)':c.err==='ETIMEDOUT'||c.why==='Handshake timeout'||c.err==='Timeout'?'No answer (timeout)':c.err==='EHOSTUNREACH'||c.err==='ENETUNREACH'?'Network unreachable':c.err||c.why||'Failed')}
        else if(c.drop)t.state=t.paused?'idle':t.state==='connecting'?'idle':t.state;
      }
    }
    this.touch();
  }
  /* ---------------- ticking: reconnects + heartbeat ---------------- */
  _tickFn(){
    const n=now();
    this.links.forEach(c=>{
      if(!c.hello)return;
      if(!this.allowedIp(c.ip)){c.drop=true;this._kill(c,'Network disabled');return}
      if(n-c.lastRx>HB_DEAD){this._kill(c,'No answer (timeout)');return}
      if(n-c.lastPing>=HB_EVERY){c.lastPing=n;this._send(c,{t:'ping',ts:n})}
    });
    this.targets.forEach(t=>{
      if(t.paused||t.sock||this._linkAlive(t))return;
      if(t.src!=='manual'&&!this.cfg.autoConnect)return;
      if(t.src==='manual'?!t.auto:t.auto===false)return;
      if(t.state==='rejected'&&n<t.nextAt)return;
      if(n>=t.nextAt)this._connect(t);
    });
    // discovered devices that vanished: hide after 10 minutes
    this.targets.forEach((t,k)=>{if(t.src==='auto'&&!this._linkAlive(t)&&!t.sock&&t.seen&&n-t.seen>600000&&!this.cfg.known[t.devId]){this.targets.delete(k)}});
    if(n%4>=0&&this.udp&&n-(this._lastAnn||0)>=HB_EVERY)this._announce();
    this.touch();
  }
  /* ---------------- data ---------------- */
  push(str){this.lastState=String(str||'');clearTimeout(this._pt);this._pt=setTimeout(()=>this.flush(),120)}
  flush(){this.links.forEach(c=>{if(c.hello)this.sendState(c)})}
  sendState(c,force){
    if(!this.lastState||c.dead||c.sock.destroyed)return;
    if(c.sending){c.dirty=true;return}
    if(!force&&c.lastOut===this.lastState)return;
    c.sending=true;const data=this.lastState;
    if(!this._fc||this._fc.data!==data)this._fc={data,buf:this._frame({t:'state',d:data})};
    try{c.sock.write(this._fc.buf,()=>{c.sending=false;c.sent++;c.lastOut=data;c.lastOutAt=now();this.touch();if(c.dirty){c.dirty=false;this.sendState(c)}})}catch(e){c.sending=false}
  }
  take(){const a=[...this.inbox.values()];this.inbox.clear();return a}
  syncNow(){this.links.forEach(c=>{if(c.hello){this.sendState(c,true);this._send(c,{t:'req'})}});return {ok:true}}

  /* ---------------- discovery (UDP broadcast) ---------------- */
  _udpStart(){
    if(this.udp||!this.running)return;
    let s;try{s=dgram.createSocket({type:'udp4',reuseAddr:true})}catch(e){this.log('err','UDP: '+e.message);return}
    this.udp=s;
    s.on('error',e=>{this.log('warn','Discovery: '+(e.code||e.message));try{s.close()}catch(x){}if(this.udp===s)this.udp=null});
    s.on('message',(b,r)=>{try{this._onAnnounce(b,r)}catch(e){}});
    s.bind(this.udpPort,'0.0.0.0',()=>{try{s.setBroadcast(true)}catch(e){}this._announce()});
  }
  _udpStop(){try{this.udp&&this.udp.close()}catch(e){}this.udp=null}
  _announceSoon(){if(this.udp)setTimeout(()=>this._announce(),200)}
  _announce(){
    if(!this.udp)return;this._lastAnn=now();
    const msg=Buffer.from(JSON.stringify({moi:1,id:this.id,name:this.name,port:this.cfg.port,grp:this.grp()}));
    const sent=new Set();
    this.ifaces().forEach(f=>{
      if(!f.enabled||f.cls==='netbird')return;
      const bc=f.bits>=31?null:((ip2n(f.address)|(~ip2n(f.netmask)>>>0))>>>0);if(bc===null)return;
      const addr=[bc>>>24,(bc>>>16)&255,(bc>>>8)&255,bc&255].join('.');if(sent.has(addr))return;sent.add(addr);
      try{this.udp.send(msg,this.udpPort,addr,()=>{})}catch(e){}
    });
  }
  _onAnnounce(b,r){
    let m;try{m=JSON.parse(b.toString('utf8'))}catch(e){return}
    if(!m||m.moi!==1||typeof m.id!=='string'||m.id===this.id||m.grp!==this.grp())return;
    const ip=r.address;if(!this.allowedIp(ip))return;
    const port=+m.port||this.cfg.port;let t=this._findTarget(m.id,ip,port);
    if(!t){t=this._addTarget({ip,port,name:m.name,src:'auto',devId:m.id,auto:this.cfg.autoConnect});this.log('info','Found device: '+(m.name||ip)+' ('+ip+')');
      if(this.running&&this.cfg.autoConnect)this._connect(t)}
    else{ if(t.src!=='manual'&&(t.ip!==ip||t.port!==port)){this.targets.delete(t.key);t.ip=ip;t.port=port;t.key=this._key(ip,port);this.targets.set(t.key,t);t.nextAt=0}
          t.devId=m.id;if(m.name)t.name=m.name}
    t.seen=now();this.touch();
  }
  /* ---------------- scan (when broadcast is blocked) ---------------- */
  scan(){
    if(this.scanInfo&&this.scanInfo.running)return {ok:true};
    const hosts=[];
    this.ifaces().forEach(f=>{
      if(!f.enabled||f.cls==='netbird'||f.bits<22||f.bits>30||/^127\./.test(f.address))return;
      const base=(ip2n(f.address)&(ip2n(f.netmask)))>>>0,size=Math.pow(2,32-f.bits);
      for(let i=1;i<size-1;i++){const n=(base+i)>>>0,ip=[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');if(ip!==f.address)hosts.push({ip,f:f.address})}
    });
    const info=this.scanInfo={running:true,done:0,total:hosts.length,found:0};this.log('info','Scanning '+hosts.length+' addresses on port '+this.cfg.port);
    let idx=0,active=0;
    const next=()=>{
      while(active<64&&idx<hosts.length){
        const h=hosts[idx++];active++;
        const s=net.connect({host:h.ip,port:this.cfg.port,localAddress:h.f});let done=false;
        const fin=ok=>{if(done)return;done=true;clearTimeout(to);try{s.destroy()}catch(e){}active--;info.done++;
          if(ok&&!this._findTarget(null,h.ip,this.cfg.port)){this._addTarget({ip:h.ip,port:this.cfg.port,src:'auto',auto:this.cfg.autoConnect});info.found++;this.log('info','Scan found '+h.ip)}
          if(info.done>=info.total){info.running=false;this.log('info','Scan finished: '+info.found+' device(s)')}
          this.touch();next()};
        const to=setTimeout(()=>fin(false),450);
        s.once('connect',()=>fin(true));s.once('error',()=>fin(false));
      }
      if(!hosts.length&&info.running){info.running=false}
    };
    next();return {ok:true,total:hosts.length};
  }
  /* ---------------- status for the UI ---------------- */
  status(){
    const n=now(),peers=[];const seen=new Set();
    const mk=(t,l)=>{
      const net=this.netOf(t.ip);
      const live=l&&l.hello&&!l.dead;
      let state=live?'connected':t.paused?'paused':t.state==='idle'&&!t.auto&&t.src==='manual'?'idle':t.state;
      if(!live&&state==='connected')state='failed';
      return {key:t.key,id:(l&&l.id)||t.devId||'',name:(l&&l.name)||t.name||t.ip,ip:t.ip,port:t.port,src:t.src,auto:t.src==='manual'?!!t.auto:(t.auto!==false&&this.cfg.autoConnect),state,err:live?'':t.err,
        via:net.cls,iface:net.iface||'',rtt:live?l.rtt:null,sent:l?l.sent:0,recv:l?l.recv:0,lastSync:l?l.lastSync:0,lastOut:l?l.lastOutAt||0:0,clock:live?Math.round(l.clock):null,
        since:live?l.born:0,initiator:live?l.initiator:null,paused:!!t.paused,nextIn:(!live&&!t.paused&&t.nextAt>n)?Math.round((t.nextAt-n)/1000):0,tries:t.tries,seen:t.seen||0};
    };
    this.targets.forEach(t=>{const l=t.devId?this.links.get(t.devId):null;if(l)seen.add(l.id);peers.push(mk(t,l))});
    this.links.forEach(l=>{if(!l.hello||seen.has(l.id))return;
      const net=this.netOf(l.ip);peers.push({key:'in:'+l.id,id:l.id,name:l.name,ip:l.ip,port:l.peerPort,src:'incoming',auto:false,state:'connected',err:'',via:net.cls,iface:net.iface||'',rtt:l.rtt,sent:l.sent,recv:l.recv,lastSync:l.lastSync,lastOut:l.lastOutAt||0,clock:Math.round(l.clock),since:l.born,initiator:false,paused:false,nextIn:0,tries:0,seen:n})});
    const c=this.cfg;
    return {running:this.running,listening:this.listening,serverErr:this.serverErr,id:this.id,name:this.name,host:this.hostname,port:c.port,time:n,
      cfg:{enabled:c.enabled,autoConnect:c.autoConnect,discover:c.discover,port:c.port,name:c.name,pin:c.pin,use:c.use,ov:c.ov},
      udp:!!this.udp,ifaces:this.ifaces(),peers,connected:peers.filter(p=>p.state==='connected').length,scan:this.scanInfo,logs:this.logs.slice(-60)};
  }
}
module.exports=Lan;
