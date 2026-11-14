const {contextBridge,ipcRenderer}=require('electron');
const call=(c,...a)=>ipcRenderer.invoke(c,...a);
contextBridge.exposeInMainWorld('moiApp',{
  savePDF:(h,n)=>call('savePDF',h,n),
  backup:j=>call('backup',j),
  lan:{status:()=>call('lan:status'),cfg:p=>call('lan:cfg',p),add:o=>call('lan:add',o),remove:k=>call('lan:remove',k),connect:k=>call('lan:connect',k),disconnect:k=>call('lan:disconnect',k),
       peerAuto:(k,v)=>call('lan:peerAuto',k,v),connectAll:()=>call('lan:connectAll'),disconnectAll:()=>call('lan:disconnectAll'),scan:()=>call('lan:scan'),syncNow:()=>call('lan:syncNow'),
       push:(s,d)=>call('lan:push',s,d),start:()=>call('lan:start'),stop:()=>call('lan:stop'),take:()=>call('lan:take'),firewall:()=>call('lan:firewall'),
       onStatus:cb=>{ipcRenderer.on('lan:status',(e,s)=>cb(s))},onInbox:cb=>{ipcRenderer.on('lan:inbox',()=>cb())}},pics:()=>call('pics'),
  sync:{info:()=>call('sync:info'),create:()=>call('sync:create'),open:()=>call('sync:open'),read:()=>call('sync:read'),
        write:t=>call('sync:write',t),stat:()=>call('sync:stat'),folder:()=>call('sync:folder'),off:()=>call('sync:off')}
});
