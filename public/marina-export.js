
/* PDF/PNG — krokinin tamamını tekne koordinatlarıyla oluşturur. */
(function(){
  "use strict";
  const menu=document.getElementById("site-menu");
  if(!menu)return;
  let busy=false;
  function addButton(label,kind){
    const b=document.createElement("button");b.type="button";b.textContent=label;
    menu.insertBefore(b,menu.querySelector("details"));
    b.addEventListener("click",()=>{menu.hidden=true;exportPlan(kind);});
  }
  function loadImage(url){
    return new Promise((resolve,reject)=>{
      const img=new Image();img.crossOrigin="anonymous";
      const timeout=setTimeout(()=>reject(new Error("Kroki resmi yüklenemedi.")),20000);
      img.onload=()=>{clearTimeout(timeout);resolve(img);};
      img.onerror=()=>{clearTimeout(timeout);reject(new Error("Kroki resmine erişilemedi."));};
      img.src=url;
    });
  }
  async function makeCanvas(){
    if(!appState.bgImage)throw new Error("Kroki kaydı bulunamadı.");
    if(waitingWrites)await pendingWrites;
    const boats=appState.boats.map(b=>({...b}));
    const W=Math.max(1200,...boats.map(b=>Math.ceil((Number(b.left)||0)+180)));
    const H=Math.max(760,...boats.map(b=>Math.ceil((Number(b.top)||0)+130)));
    if(W>6000||H>6000)throw new Error("Bazı teknelerin koordinatları saha sınırlarının dışında görünüyor.");
    const headerH=58,footerH=44;
    const pixelScale=Math.max(1,Math.min(2,3400/W,2200/(H+headerH+footerH)));
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(W*pixelScale);
    canvas.height=Math.round((H+headerH+footerH)*pixelScale);
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Çıktı oluşturulamadı.");
    ctx.scale(pixelScale,pixelScale);
    ctx.fillStyle="#f3f7fa";ctx.fillRect(0,0,W,H+headerH+footerH);
    ctx.fillStyle="#142f43";ctx.fillRect(0,0,W,headerH);
    ctx.font="bold 22px Arial,sans-serif";ctx.fillStyle="#fff";
    ctx.fillText("ÇEKEK SAHASI YERLEŞİM PLANI",20,37);
    const img=await loadImage(appState.bgImage);
    ctx.save();ctx.translate(0,headerH);
    ctx.fillStyle="#d7e4eb";ctx.fillRect(0,0,W,H);
    const ratio=Math.min(W/img.naturalWidth,H/img.naturalHeight);
    const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;
    ctx.drawImage(img,(W-iw)/2,(H-ih)/2,iw,ih);
    for(const boat of boats){
      const x=(Number(boat.left)||0)+50,y=(Number(boat.top)||0)+20;
      const sz=Math.max(.15,Math.min(5,Number(boat.scale)||1));
      const ang=(Number(boat.rotation)||0)*Math.PI/180;
      ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.scale(sz,sz);
      ctx.beginPath();
      if(ctx.roundRect)ctx.roundRect(-50,-20,100,40,6);else ctx.rect(-50,-20,100,40);
      ctx.fillStyle="#facc15";ctx.strokeStyle="#b45309";ctx.lineWidth=2;ctx.fill();ctx.stroke();
      ctx.fillStyle="#111827";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 12px Arial,sans-serif";
      let label=String(boat.name||"");
      while(label.length>1&&ctx.measureText(label).width>94)label=label.slice(0,-2)+"…";
      ctx.fillText(label,0,1);
      ctx.restore();
    }
    ctx.restore();
    ctx.font="14px Arial,sans-serif";ctx.fillStyle="#345468";
    const now=new Intl.DateTimeFormat("tr-TR",{dateStyle:"medium",timeStyle:"short"}).format(new Date());
    ctx.fillText(now+"   •   Tekne sayısı: "+boats.length,20,headerH+H+27);
    return canvas;
  }
  async function loadPdf(){
    if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
    return new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
      script.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(new Error("PDF kütüphanesi başlatılamadı."));
      script.onerror=()=>reject(new Error("PDF kütüphanesine erişilemiyor."));
      document.head.append(script);
    });
  }
  function download(blob,filename){
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }
  async function exportPlan(type){
    if(busy)return;
    busy=true;
    try{
      const canvas=await makeCanvas();
      const name="cekek-sahasi-"+new Date().toISOString().slice(0,10);
      if(type==="png"){
        const blob=await new Promise(r=>canvas.toBlob(r,"image/png"));
        if(!blob)throw new Error("PNG oluşturulamadı.");
        download(blob,name+".png");
      }else{
        const JsPDF=await loadPdf();
        const pdf=new JsPDF({orientation:"landscape",unit:"mm",format:"a3",compress:true});
        const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight(),margin=8;
        const scale=Math.min((pw-2*margin)/canvas.width,(ph-2*margin)/canvas.height);
        const w=canvas.width*scale,h=canvas.height*scale;
        pdf.addImage(canvas.toDataURL("image/png"),"PNG",(pw-w)/2,(ph-h)/2,w,h);
        pdf.setProperties({title:"Çekek Sahası Yerleşim Planı"});
        pdf.save(name+".pdf");
      }
    }catch(err){
      showMessage("Çıktı alınamadı",err?.message||String(err));
    }finally{busy=false;}
  }
  addButton("📄 Kroki PDF İndir","pdf");
  addButton("🖼️ Kroki PNG İndir","png");
})();
