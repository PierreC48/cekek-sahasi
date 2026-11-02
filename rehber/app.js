/* Tekne Mürettebat & Telefon Rehberi — veriler yalnızca tarayıcıda saklanır. */
(function () {
'use strict';
const KEY='tekne_rehberi_v1';
const $=id=>document.getElementById(id);
let contacts=[];let draftFile=null;let draftImage=null;let paper={x:0,y:0,w:1,h:1};let activeEdit=null;let worker=null;let trocr=null;let processing=false;let toastTimer=0;
const nowISO=()=>new Date().toISOString();
const uid=()=>globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);

const CLOUD_ENDPOINT='https://cxepumcfugqnxixznvir.supabase.co/functions/v1/crew-directory';
const PUBLIC_KEY='sb_publishable_80esJnSeEstFkWVztcCgdg_VGXC5yO0';
let accessKey='',cloudReady=false,cloudBusy=false;
function statusCloud(value){const el=$('cloudStatus');if(el)el.textContent=value;}
function oldRecords(){try{const v=JSON.parse(localStorage.getItem(KEY));return Array.isArray(v)?v:[];}catch{return [];}}
function updateTransferButton(){const b=$('syncLocal');if(b){const n=oldRecords().length;b.hidden=!cloudReady||!n;b.textContent=n+' eski cihaz kaydını ortak rehbere aktar';}}
async function cloudRequest(action,data={}){
 if(!accessKey)throw new Error('Erişim anahtarı gerekli.');
 const resp=await fetch(CLOUD_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','apikey':PUBLIC_KEY},body:JSON.stringify({action,key:accessKey,...data}),cache:'no-store'});
 const payload=await resp.json().catch(()=>({}));
 if(!resp.ok)throw new Error(payload.error||'Ortak rehbere erişilemiyor (HTTP '+resp.status+').');
 return payload;
}
function setRemote(payload){
 if(!payload||!Array.isArray(payload.contacts))throw new Error('Rehber yanıtı geçersiz.');
 contacts=payload.contacts;refresh();
 statusCloud('● Ortak rehber aktif · '+contacts.length+' kayıt');
}
async function unlockCloud(key){
 accessKey=String(key||'').trim();
 $('unlockSubmit').disabled=true;
 $('unlockStatus').textContent='Güvenli bağlantı kuruluyor…';
 try{
  const data=await cloudRequest('login');
  cloudReady=true;setRemote(data);
  try{sessionStorage.setItem('crew-shared-access',accessKey);}catch(e){}
  $('cloudLock').hidden=true;
  $('unlockStatus').textContent='';
  updateTransferButton();
  return true;
 }catch(e){cloudReady=false;accessKey='';contacts=[];refresh();statusCloud('🔒 Rehber kilitli');
  $('unlockStatus').textContent=e.message||String(e);return false;
 }finally{$('unlockSubmit').disabled=false;}
}
function lockCloud(){
 cloudReady=false;accessKey='';contacts=[];refresh();
 try{sessionStorage.removeItem('crew-shared-access');}catch(e){}
 $('cloudLock').hidden=false;$('accessCode').value='';
 statusCloud('🔒 Rehber kilitli');updateTransferButton();
}
function initCloud(){
 $('cloudLock').hidden=false;
 $('unlockForm').addEventListener('submit',async e=>{e.preventDefault();await unlockCloud($('accessCode').value);});
 $('cloudLogout').addEventListener('click',lockCloud);
 $('syncLocal').addEventListener('click',async()=>{
  if(!cloudReady)return;
  const records=oldRecords();
  if(!records.length)return updateTransferButton();
  if(!confirm(records.length+' eski cihaz kaydı ortak rehbere aktarılsın mı? Bunlar yetkili diğer telefonlarda görünür.'))return;
  try{
   let total=0,skipped=0;
   for(let i=0;i<records.length;i+=150){
     const out=await cloudRequest('import',{contacts:records.slice(i,i+150).map(c=>({
       id:/^[a-zA-Z0-9_-]{6,100}$/.test(String(c.id||''))?String(c.id):uid(),
       boat:c.boat,first:c.first,last:c.last,role:c.role,phone:cleanPhone(c.phone),
       note:c.note,date:c.date
     }))});
     total+=out.added||0;skipped+=out.skipped||0;setRemote(out);
   }
   toast(total+' kişi buluta aktarıldı'+(skipped?'; '+skipped+' tekrar kaydı atlandı.':'.'));
   // Yerel kayıtlar silinmez: kullanıcı isterse JSON/Excel yedeği de alabilir.
  }catch(e){toast('Aktarım başarısız: '+e.message);}
 });
 let saved='';try{saved=sessionStorage.getItem('crew-shared-access')||'';}catch(e){}
 if(saved){$('accessCode').value=saved;unlockCloud(saved);}
 window.addEventListener('focus',()=>{if(cloudReady)pollCloud();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudReady)pollCloud();});
 setInterval(()=>{if(cloudReady&&!document.hidden)pollCloud();},12000);
}
async function pollCloud(){
 if(!cloudReady||cloudBusy)return;
 cloudBusy=true;
 try{const data=await cloudRequest('list');if(!document.getElementById('editModal').hidden)return;setRemote(data);}
 catch(e){statusCloud('⚠ Ortak rehber bağlantısı: '+(e.message||String(e)));}
 finally{cloudBusy=false;}
}
async function cloudSave(action,body){
 if(!cloudReady)throw new Error('Önce ortak rehberin kilidini açın.');
 const result=await cloudRequest(action,body);setRemote(result);return result;
}

function toast(message){const n=$('toast');n.textContent=message;n.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,4000);}
function load(){contacts=[];refresh();initCloud();}
function persist(){return true;}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').toLocaleLowerCase('tr').trim();}
function cleanPhone(v){let digits=String(v||'').replace(/[^0-9+]/g,'');if(digits.startsWith('0090'))digits='0'+digits.slice(4);else if(digits.startsWith('+90'))digits='0'+digits.slice(3);else if(digits.length===10&&digits.startsWith('5'))digits='0'+digits;return digits;}
function phoneDisplay(s){const p=cleanPhone(s);return p.length===11&&p.startsWith('0')?p.slice(0,4)+' '+p.slice(4,7)+' '+p.slice(7,9)+' '+p.slice(9):p||'—';}
function isPhone(s){const p=cleanPhone(s);return /^0[1-9][0-9]{9}$/.test(p)||/^\+[0-9]{9,15}$/.test(p);}
function make(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n;}
function actionButton(label,fn,className=''){const b=make('button',className,label);b.type='button';b.addEventListener('click',fn);return b;}
function switchTab(tab){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab').forEach(n=>n.classList.toggle('visible',n.id==='tab-'+tab));window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
$('quickScan').onclick=$('emptyScan').onclick=()=>switchTab('scan');
$('exportTop').onclick=$('exportDirectory').onclick=exportExcel;
$('backupBtn').onclick=()=>download(new Blob([JSON.stringify({version:1,exported_at:nowISO(),contacts},null,2)],{type:'application/json'}),'tekne-rehberi-yedek.json');

$('importBackup').addEventListener('change',async function(){
 const f=this.files?.[0];this.value='';if(!f)return;
 if(!cloudReady){toast('Önce ortak rehberi açın.');return;}
 try{
  const d=JSON.parse(await f.text());
  if(!Array.isArray(d.contacts))throw Error('Geçerli rehber yedeği değil.');
  if(!confirm(d.contacts.length+' kişi ortak rehbere eklensin mi?'))return;
  let total=0,duplicate=0;
  for(let i=0;i<d.contacts.length;i+=150){
   const rows=d.contacts.slice(i,i+150).filter(c=>c&&typeof c==='object').map(c=>({
     id:/^[a-zA-Z0-9_-]{6,100}$/.test(String(c.id||''))?String(c.id):uid(),
     boat:c.boat,first:c.first,last:c.last,role:c.role,phone:cleanPhone(c.phone),note:c.note,date:c.date
   }));
   if(!rows.length)continue;
   const result=await cloudSave('import',{contacts:rows});
   total+=result.added||0;duplicate+=result.skipped||0;
  }
  toast(total+' kayıt eklendi'+(duplicate?'; '+duplicate+' tekrar atlandı.':'.'));
 }catch(e){toast('Yedek aktarılamadı: '+(e.message||String(e)));}
});
$('search').oninput=renderDirectory;$('boatFilter').onchange=renderDirectory;
function refresh(){const boats=[...new Set(contacts.map(x=>x.boat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));$('statContacts').textContent=contacts.length;$('statBoats').textContent=boats.length;$('statPhones').textContent=contacts.filter(x=>isPhone(x.phone)).length;const s=$('boatFilter'),old=s.value;s.replaceChildren(new Option('Tüm tekneler',''));boats.forEach(x=>s.add(new Option(x,x)));s.value=boats.includes(old)?old:'';renderDirectory();renderBoats();}
function renderDirectory(){const q=norm($('search').value),bf=$('boatFilter').value;
const filtered=contacts.filter(c=>(!bf||c.boat===bf)&&(!q||norm([c.first,c.last,c.boat,c.role,c.phone,cleanPhone(c.phone)].join(' ')).includes(q))).sort((a,b)=>a.boat.localeCompare(b.boat,'tr')||a.first.localeCompare(b.first,'tr'));
const body=$('directoryBody');body.replaceChildren();for(const c of filtered){const tr=document.createElement('tr');const name=make('td');name.append(make('strong',null,[c.first,c.last].filter(Boolean).join(' ')||'İsimsiz'));tr.append(name);const bt=make('td');bt.append(make('span','boat-chip',c.boat||'Tekne yok'));tr.append(bt);tr.append(make('td',null,c.role||'—'));const phone=make('td');if(isPhone(c.phone)){const a=make('a','phone-link',phoneDisplay(c.phone));a.href='tel:'+cleanPhone(c.phone);phone.append(a);}else phone.textContent=phoneDisplay(c.phone);tr.append(phone);const actions=make('td','row-actions');actions.append(actionButton('Düzenle',()=>openEdit(c.id)),actionButton('Sil',()=>deleteContact(c.id),'danger'));tr.append(actions);body.append(tr);}
$('directoryEmpty').hidden=contacts.length>0;if(contacts.length&&filtered.length===0){const tr=document.createElement('tr');const td=make('td',null,'Arama sonucunda eşleşen kayıt yok.');td.colSpan=5;td.style.textAlign='center';tr.append(td);body.append(tr);}
}
function renderBoats(){const wrap=$('boatsList');wrap.replaceChildren();const map=new Map();for(const c of contacts){const key=c.boat||'Tekne adı belirtilmedi';map.set(key,(map.get(key)||0)+1);}if(!map.size){const empty=make('p','', 'Henüz kayıtlı tekne yok. Form yükleyerek başlayın.');empty.style.color='#8194a1';wrap.append(empty);return;}for(const [name,count] of [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],'tr'))){const box=make('article','boat-card'),info=make('div');info.append(make('strong',null,'⛵ '+name),make('small',null,count+' kişi kayıtlı'));const btn=actionButton('Rehberde Gör',()=>{$('boatFilter').value=name==='Tekne adı belirtilmedi'?'':name;$('search').value='';switchTab('directory');renderDirectory();});box.append(info,btn);wrap.append(box);}}
async function deleteContact(id){
 const c=contacts.find(x=>x.id===id);
 if(!c)return;
 if(!confirm([c.first,c.last].join(' ')+' adlı kişiyi ORTAK rehberden silmek istiyor musunuz?'))return;
 try{await cloudSave('delete',{id});toast('Kişi ortak rehberden silindi.');}
 catch(e){toast('Silinemedi: '+e.message);}
}
$('addManual').onclick=()=>openEdit();$('closeEdit').onclick=$('cancelEdit').onclick=()=>{$('editModal').hidden=true;};$('editModal').addEventListener('click',e=>{if(e.target===$('editModal'))$('editModal').hidden=true;});
function openEdit(id){activeEdit=id||null;const c=id?contacts.find(x=>x.id===id):null;$('editTitle').textContent=c?'Kişiyi Düzenle':'Yeni Kişi';$('editBoat').value=c?.boat||'';$('editFirst').value=c?.first||'';$('editLast').value=c?.last||'';$('editRole').value=c?.role||'';$('editPhone').value=c?.phone||'';$('editNote').value=c?.note||'';$('editModal').hidden=false;}

$('editForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!cloudReady){toast('Ortak rehberi açın.');return;}
 const phone=cleanPhone($('editPhone').value);
 if(phone&&!isPhone(phone)&&!confirm('Telefon numarası standart görünmüyor. Yine de kaydedilsin mi?'))return;
 const row={id:activeEdit||uid(),boat:$('editBoat').value.trim(),first:$('editFirst').value.trim(),
 last:$('editLast').value.trim(),role:$('editRole').value.trim(),phone,note:$('editNote').value.trim()};
 try{
  await cloudSave(activeEdit?'update':'create',{contact:row});
  $('editModal').hidden=true;toast('Kişi ortak rehbere kaydedildi.');
 }catch(err){toast('Kaydedilemedi: '+err.message);}
});
function download(blob,name){const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),80000);}
function csvExport(){const headers=['Tekne','Ad','Soyad','Görev','Telefon','Not','Form Tarihi'];const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';const lines=[headers.map(quote).join(';')].concat(contacts.map(c=>[c.boat,c.first,c.last,c.role,c.phone,c.note,c.date].map(quote).join(';')));download(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),'tekne-rehberi.csv');toast('Excel kütüphanesine erişilemedi; CSV indirildi.');}
function exportExcel(){if(!contacts.length){toast('Önce rehbere bir kişi ekleyin.');return;}if(!window.XLSX){csvExport();return;}try{const wb=XLSX.utils.book_new();const col=['Tekne','Ad','Soyad','Görev','Telefon','Not','Form Tarihi'];const sorted=[...contacts].sort((a,b)=>a.boat.localeCompare(b.boat,'tr')||a.first.localeCompare(b.first,'tr'));const data=sorted.map(c=>[c.boat,c.first,c.last,c.role,c.phone,c.note,c.date]);const ws=XLSX.utils.aoa_to_sheet([col,...data]);ws['!cols']=[{wch:25},{wch:20},{wch:22},{wch:20},{wch:22},{wch:40},{wch:18}];for(let i=2;i<=data.length+1;i++){const cell=ws['E'+i];if(cell){cell.t='s';cell.v=String(cell.v||'');cell.z='@';}}XLSX.utils.book_append_sheet(wb,ws,'Telefon Rehberi');const boats=[...new Set(contacts.map(c=>c.boat))].sort((a,b)=>a.localeCompare(b,'tr'));const sum=XLSX.utils.aoa_to_sheet([['Tekne','Kişi Sayısı','Telefonlu Kişi'],...boats.map(b=>[b,contacts.filter(c=>c.boat===b).length,contacts.filter(c=>c.boat===b&&isPhone(c.phone)).length])]);sum['!cols']=[{wch:27},{wch:18},{wch:18}];XLSX.utils.book_append_sheet(wb,sum,'Tekneler');XLSX.writeFile(wb,'tekne-murettebat-rehberi.xlsx');toast('Excel rehberi indirildi.');}catch(e){console.error(e);toast('Excel oluşturulamadı, CSV hazırlanıyor.');csvExport();}}
// Şablonun baskın beyaz sayfa alanını belirle; dosya bilgisini veya fotoğrafı sunucuya gönderme.
function detectPaper(img){const c=document.createElement('canvas');const w=300,h=Math.max(200,Math.round(img.naturalHeight*(300/img.naturalWidth)));c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;const valid=(x,y)=>{const i=(y*w+x)*4;const r=data[i],g=data[i+1],b=data[i+2];return r>135&&g>140&&b>137&&Math.max(r,g,b)-Math.min(r,g,b)<85;};let minx=w,miny=h,maxx=0,maxy=0;const rowCount=new Int32Array(h),colCount=new Int32Array(w);for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){if(valid(x,y)){rowCount[y]++;colCount[x]++;}}
for(let y=0;y<h;y+=2)if(rowCount[y]>w*.12){miny=Math.min(miny,y);maxy=Math.max(maxy,y);}for(let x=0;x<w;x+=2)if(colCount[x]>h*.12){minx=Math.min(minx,x);maxx=Math.max(maxx,x);}if(maxx-minx<w*.4||maxy-miny<h*.4)return{x:0,y:0,w:img.naturalWidth,h:img.naturalHeight};return{x:Math.max(0,minx-2)*img.naturalWidth/w,y:Math.max(0,miny-2)*img.naturalHeight/h,w:(Math.min(w,maxx+4)-Math.max(0,minx-2))*img.naturalWidth/w,h:(Math.min(h,maxy+4)-Math.max(0,miny-2))*img.naturalHeight/h};}
// SeturMarinas Mürettebat Bilgi Formu: dört köşeden düzeltilmiş örnek yerleşim. Alanların konumu fotoğraf türüne göre değişebilir.
const REGIONS=[{id:'fBoat',box:[.405,.166,.88,.200],label:'Tekne adı'}, {id:'fTitle',box:[.40,.194,.72,.22],label:'Ünvan'}, {id:'fOwnerName',box:[.40,.213,.70,.233],label:'Sorumlu adı'}, {id:'fOwnerSurname',box:[.40,.233,.71,.255],label:'Sorumlu soyadı'}, {id:'crewFirst',box:[.075,.306,.31,.350],label:'Mürettebat adı'}, {id:'crewLast',box:[.29,.305,.57,.35],label:'Mürettebat soyadı'}, {id:'crewRole',box:[.57,.307,.93,.347],label:'Görevi'}, {id:'crewPhone',box:[.52,.345,.92,.379],label:'Telefon'}, {id:'fDate',box:[.52,.845,.89,.930],label:'Tarih'}];
function cropField(region){const img=draftImage;const b=region.box;const p=paper;const x=Math.max(0,p.x+p.w*b[0]),y=Math.max(0,p.y+p.h*b[1]),w=Math.min(img.naturalWidth-x,p.w*(b[2]-b[0])),h=Math.min(img.naturalHeight-y,p.h*(b[3]-b[1]));const canvas=document.createElement('canvas');const s=Math.min(3,Math.max(1,700/w));canvas.width=Math.max(32,Math.round(w*s));canvas.height=Math.max(30,Math.round(h*s));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,x,y,w,h,0,0,canvas.width,canvas.height);return canvas;}
function parseDate(s){const m=String(s||'').match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(20\d\d)/);if(!m)return'';const dd=m[1].padStart(2,'0'),mm=m[2].padStart(2,'0');if(+dd>31||+mm>12)return'';return m[3]+'-'+mm+'-'+dd;}
function fieldFromOCR(id,text){const value=String(text||'').replace(/[\r\n]+/g,' ').replace(/\s{2,}/g,' ').trim();if(!value)return;if(id==='crewFirst'||id==='crewLast'||id==='crewRole'||id==='crewPhone'){if(!$('crewRows').children.length)addCrew();const first=$('crewRows').firstElementChild;const i={crewFirst:0,crewLast:1,crewRole:2,crewPhone:3}[id];const input=first.querySelectorAll('input')[i];input.value=id==='crewPhone'?cleanPhone(value.replace(/[Oo]/g,'0').replace(/[Il]/g,'1')):value;input.dataset.ocr='1';return;}if(id==='fDate'){$('fDate').value=parseDate(value);return;}$(id).value=value;$(id).dataset.ocr='1';}
function setProgress(label,progress){$('ocrProgress').hidden=false;$('progressText').textContent=label;$('progressPct').textContent=progress==null?'':Math.round(progress)+'%';$('progressFill').style.width=(progress==null?8:Math.max(4,Math.min(100,progress)))+'%';}
async function choosePhoto(file){if(!file)return;if(!file.type.startsWith('image/')){toast('Lütfen JPG, PNG veya WEBP görseli seçin.');return;}if(file.size>18*1024*1024){toast('Fotoğraf 18 MB sınırını aşıyor.');return;}draftFile=file;const u=URL.createObjectURL(file);const im=new Image();im.onload=()=>{if(draftImage?.dataset?.objectUrl)URL.revokeObjectURL(draftImage.dataset.objectUrl);im.dataset.objectUrl=u;draftImage=im;paper=detectPaper(im);$('formPreview').src=u;$('dropzone').hidden=true;$('previewWrap').hidden=false;$('readPrint').disabled=false;$('readHand').disabled=false;$('ocrProgress').hidden=true;toast('Fotoğraf yüklendi. Tanıma yöntemini seçin.');};im.onerror=()=>{URL.revokeObjectURL(u);toast('Fotoğraf açılamadı.');};im.src=u;}
$('photoFile').addEventListener('change',e=>choosePhoto(e.target.files?.[0]));$('replacePhoto').onclick=()=>$('photoFile').click();
function addCrew(row){const n=$('crewRows').children.length+1;const box=make('div','crew-row');const head=make('div','crew-row-title');head.append(make('span',null,'Kişi '+n));head.append(actionButton('Satırı kaldır',()=>{box.remove();renumberCrew();}));box.append(head);const grid=make('div','crew-row-grid');const fields=[['Ad','first'],['Soyad','last'],['Görev','role'],['Telefon','phone']];for(const [name,key] of fields){const lbl=make('label','field',name),input=document.createElement('input');input.type=key==='phone'?'tel':'text';input.autocomplete='off';input.dataset.key=key;input.value=row?.[key]||'';if(key==='phone')input.inputMode='tel';lbl.append(input);grid.append(lbl);}box.append(grid);$('crewRows').append(box);return box;}
function renumberCrew(){$('crewRows').querySelectorAll('.crew-row-title span').forEach((n,i)=>n.textContent='Kişi '+(i+1));}
$('addCrewRow').onclick=()=>addCrew();
function clearDraft(){$('fBoat').value='';$('fOwnerName').value='';$('fOwnerSurname').value='';$('fTitle').value='';$('fDate').value='';$('fNotes').value='';$('crewRows').replaceChildren();addCrew();}
$('clearDraft').onclick=()=>{if(confirm('Formdaki taslak bilgiler temizlensin mi? Rehber kayıtları silinmeyecek.'))clearDraft();};
async function readPrinted(){if(processing||!draftImage)return;if(!window.Tesseract){toast('OCR kütüphanesi yüklenemedi. İnterneti kontrol edin.');return;}processing=true;$('readPrint').disabled=true;$('readHand').disabled=true;try{setProgress('Basılı metin modeli hazırlanıyor…',3);worker=worker||await Tesseract.createWorker('tur+eng',1,{logger:m=>{if(m.status==='recognizing text')setProgress('Alanlar okunuyor…',Math.round((m.progress||0)*10));}});for(let i=0;i<REGIONS.length;i++){const field=REGIONS[i];setProgress(field.label+' okunuyor…',(i/REGIONS.length)*100);const c=cropField(field);const result=await worker.recognize(c);const raw=result.data?.text?.trim()||'';fieldFromOCR(field.id,raw);}setProgress('Okuma tamamlandı — sonuçları kontrol edin',100);toast('Taslak hazır. El yazısı alanlarını kontrol edin.');}catch(e){console.warn(e);toast('OCR işlemi tamamlanamadı: '+e.message);}finally{processing=false;$('readPrint').disabled=false;$('readHand').disabled=false;}}
$('readPrint').onclick=readPrinted;
async function readHandwriting(){if(processing||!draftImage)return;processing=true;$('readPrint').disabled=true;$('readHand').disabled=true;try{setProgress('El yazısı modeli yükleniyor (ilk seferde büyük indirme)…',2);if(!trocr){const mod=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');trocr=await mod.pipeline('image-to-text','Xenova/trocr-small-handwritten',{quantized:true,progress_callback:x=>{if(x?.progress!=null)setProgress('El yazısı modeli indiriliyor…',Math.min(20,Math.round(x.progress*.20)));}});}for(let i=0;i<REGIONS.length;i++){const field=REGIONS[i];setProgress('El yazısı: '+field.label,(20+(i/REGIONS.length)*78));const result=await trocr(cropField(field).toDataURL('image/png'),{max_new_tokens:45});fieldFromOCR(field.id,result?.[0]?.generated_text||'');}setProgress('Bitti — tüm alanları doğrulayın',100);toast('El yazısı taslağı hazır. İsimleri ve telefonları doğrulayın.');}catch(e){console.warn(e);toast('El yazısı tanıma açılamadı. Basılı OCR veya elle düzeltme kullanılabilir.');setProgress('Model çalışmadı; alanları elle doldurabilirsiniz',0);}finally{processing=false;$('readPrint').disabled=false;$('readHand').disabled=false;}}
$('readHand').onclick=readHandwriting;
$('saveDraft').onclick=async()=>{if(!cloudReady){toast('Önce ortak rehberi açın.');return;}const boat=$('fBoat').value.trim();if(!boat){toast('Tekne adını girin.');$('fBoat').focus();return;}const people=[];const owner={boat,first:$('fOwnerName').value.trim(),last:$('fOwnerSurname').value.trim(),role:$('fTitle').value.trim()||'Sorumlu',phone:'',note:$('fNotes').value.trim(),date:$('fDate').value};if(owner.first)people.push(owner);for(const row of $('crewRows').children){const inputs=[...row.querySelectorAll('input')];const c={boat,first:inputs[0].value.trim(),last:inputs[1].value.trim(),role:inputs[2].value.trim(),phone:cleanPhone(inputs[3].value),note:$('fNotes').value.trim(),date:$('fDate').value};if(!c.first&&!c.last&&!c.phone)continue;if(c.phone&&!isPhone(c.phone)){toast('Telefon numarasını kontrol edin: '+c.phone);inputs[3].focus();return;}people.push(c);}if(!people.length){toast('En az bir kişi adı veya telefon girin.');return;}let count=0,duplicates=0;const pending=[];for(const p of people){const key=[norm(p.boat),norm(p.first),norm(p.last),cleanPhone(p.phone)].join('|');if(contacts.some(x=>[norm(x.boat),norm(x.first),norm(x.last),cleanPhone(x.phone)].join('|')===key)){duplicates++;continue;}pending.push({id:uid(),...p,created_at:nowISO()});count++;}if(!pending.length){toast('Bu kişiler zaten rehberde.');return;}try{const out=await cloudSave('import',{contacts:pending});toast((out.added||0)+' kişi ortak rehbere kaydedildi'+(out.skipped?'; '+out.skipped+' tekrar atlandı.':'.'));switchTab('directory');}catch(err){toast('Kaydedilemedi: '+err.message);}};
addCrew();load();
})();