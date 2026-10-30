
/* Silinen tekneleri eski koordinatları ve ölçüleriyle geri yükleme. */
(function(){
 "use strict";
 const menu=document.getElementById("site-menu");
 if(!menu)return;
 const button=document.createElement("button");
 button.type="button";button.textContent="♻️ Silinen Tekneler / Geri Al";
 menu.insertBefore(button,menu.querySelector("details"));
 const overlay=document.createElement("div");
 overlay.id="marina-trash-overlay";overlay.hidden=true;
 overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label","Silinen tekneler");
 overlay.innerHTML='<div id="marina-trash-dialog"><div id="marina-trash-head"><h2>♻️ Silinen Tekneler</h2><button id="marina-trash-close" type="button" aria-label="Kapat">×</button></div><div id="marina-trash-items"></div></div>';
 document.body.append(overlay);
 const items=overlay.querySelector("#marina-trash-items");
 const close=()=>overlay.hidden=true;
 overlay.querySelector("#marina-trash-close").addEventListener("click",close);
 overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)close();});
 async function reload(){
  if(!cloudLoaded){items.textContent="Ortak kayıt bağlantısı henüz hazır değil.";return;}
  items.textContent="Silinen kayıtlar yükleniyor…";
  try{
   const rows=await apiCall("marina_deleted_boats?select=id,boat_id,data,deleted_at&order=deleted_at.desc&limit=100");
   items.replaceChildren();
   if(!rows?.length){items.textContent="Geri yüklenebilecek silinmiş tekne bulunmuyor.";return;}
   for(const row of rows){
    const div=document.createElement("div");div.className="marina-trash-row";
    const info=document.createElement("div");
    const name=document.createElement("strong");name.textContent=row.data?.name||"İsimsiz tekne";
    const when=document.createElement("small");
    let date="";try{date=new Intl.DateTimeFormat("tr-TR",{dateStyle:"short",timeStyle:"short"}).format(new Date(row.deleted_at));}catch{}
    when.textContent="Silinme: "+date+" • Eski konum: "+Math.round(Number(row.data?.left)||0)+", "+Math.round(Number(row.data?.top)||0);
    info.append(name,when);
    const restore=document.createElement("button");restore.type="button";restore.textContent="Geri Yükle";
    restore.addEventListener("click",()=>{
     showConfirm("Tekneyi Geri Yükle",'"'+name.textContent+'" eski konumuyla geri yüklensin mi?',()=>{
      restore.disabled=true;restore.textContent="Yükleniyor…";
      (async()=>{
        await pendingWrites;
        await apiCall("rpc/marina_restore_deleted_boat",{method:"POST",body:JSON.stringify({p_archive_id:Number(row.id)})});
        await refreshCloudState();
        await reload();
        showMessage("Geri Yüklendi",'"'+name.textContent+'" eski konumu, boyutu ve açısıyla tekrar sahada.');
      })().catch(err=>{restore.disabled=false;restore.textContent="Geri Yükle";showMessage("Geri yükleme hatası",err.message||String(err));});
     });
    });
    div.append(info,restore);items.append(div);
   }
  }catch(err){items.textContent="Kayıtlar okunamadı: "+(err.message||String(err));}
 }
 button.addEventListener("click",()=>{menu.hidden=true;overlay.hidden=false;reload();});
})();
