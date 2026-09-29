/* No private document caching: content remains behind server authentication. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data.json();}catch{}e.waitUntil(self.registration.showNotification(d.title||'IDEA VAULT',{body:d.body||'오늘의 제안이 도착했어요.',icon:'/icon.svg',badge:'/icon.svg',tag:d.tag||'daily-pitch',data:{url:d.url||'/'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const u=new URL(e.notification.data?.url||'/',self.location.origin);if(u.origin!==self.location.origin)return;e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async cs=>{for(const c of cs){if(new URL(c.url).origin===u.origin){await c.navigate(u.href);return c.focus();}}return self.clients.openWindow(u.href);}));});
