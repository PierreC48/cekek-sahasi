/* Çekek Sahası web bildirimleri. Site içeriğini önbelleğe almaz. */
self.addEventListener('push',event=>{
 let d={};try{d=event.data?event.data.json():{};}catch{d={};}
 event.waitUntil(self.registration.showNotification(d.title||'Çekek Sahası',{
  body:d.body||'Saha planında değişiklik yapıldı.',tag:d.tag||'marina',
  renotify:true,badge:'/icon.svg',icon:'/icon.svg',
  data:{url:'https://cekeksahasiyerlesim.onrender.com'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url='https://cekeksahasiyerlesim.onrender.com';
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
   if(client.url.startsWith(url)&&'focus' in client)return client.focus();
  }
  return self.clients.openWindow(url);
 })());
});