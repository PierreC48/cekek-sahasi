
/* Akıllı tekne arama: eşleşen isimler, yazım toleransı ve krokiye odaklanma. */
(function(){
 "use strict";
 const search=document.getElementById("search-boat-input");
 const wrapper=document.getElementById("map-wrapper");
 const map=document.getElementById("map-container");
 const mobileInput=document.getElementById("mobile-action-name");
 if(!search||!wrapper||!map)return;
 const mobile=()=>matchMedia("(max-width:767px)").matches;
 const norm=s=>String(s||"").toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").replace(/\s+/g," ").trim();
 function editDistance(a,b){
  if(Math.abs(a.length-b.length)>2)return 9;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
   const next=[i];
   for(let j=1;j<=b.length;j++)next[j]=Math.min(prev[j]+1,next[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   prev=next;
  }
  return prev[b.length];
 }
 function findBoats(query){
  const q=norm(query);if(!q)return[];
  const all=[];
  for(const boat of appState.boats){
   const n=norm(boat.name);let score=99;
   if(n===q)score=0;
   else if(n.startsWith(q))score=1;
   else if(n.includes(q))score=2;
   else if(q.split(" ").every(part=>n.includes(part)))score=3;
   else if(q.length>=4&&n.split(" ").some(word=>editDistance(word,q)<=2))score=4;
   if(score<99)all.push({boat,score});
  }
  return all.sort((a,b)=>a.score-b.score||a.boat.name.localeCompare(b.boat.name,"tr")).map(x=>x.boat).slice(0,30);
 }
 const reset=document.createElement("button");reset.id="marina-reset-view";reset.hidden=true;reset.type="button";reset.textContent="↖ Tüm Sahayı Göster";
 reset.addEventListener("click",()=>{if(window.marinaFitAll)window.marinaFitAll();reset.hidden=true;deselectBoat();});
 document.querySelector("header").append(reset);
 function focus(boat){
  const el=document.getElementById(boat.id);
  if(!el){showMessage("Uyarı","Tekne kroki üzerinde bulunamadı.");return;}
  deselectBoat();
  el.classList.remove("highlight-pulse");void el.offsetWidth;el.classList.add("highlight-pulse");
  el.style.zIndex=String(++highestZIndex);
  if(typeof window.marinaFocusBoat==="function"){
   window.marinaFocusBoat(boat.id);
   reset.hidden=mobile();
  }
 }
 const deskParent=search.parentElement;deskParent.style.position="relative";
 const deskList=document.createElement("div");deskList.id="marina-smart-list";deskList.hidden=true;deskParent.append(deskList);
 const mobileList=document.createElement("div");mobileList.id="marina-mobile-matches";mobileList.hidden=true;
 if(mobileInput)mobileInput.insertAdjacentElement("afterend",mobileList);
 function activeMobileSearch(){
  return document.getElementById("mobile-dialog-title")?.textContent==="Tekne Ara"&&!document.getElementById("mobile-action-modal").hidden;
 }
 function showList(target,query){
  const results=findBoats(query);target.replaceChildren();target.hidden=!query.trim();
  if(target.hidden)return results;
  if(!results.length){
   const empty=document.createElement("div");empty.className="marina-search-empty";empty.textContent="Eşleşen tekne bulunamadı.";target.append(empty);return results;
  }
  for(const boat of results.slice(0,12)){
   const button=document.createElement("button");button.type="button";button.className="marina-search-item";
   const name=document.createElement("strong");name.textContent=boat.name;
   const desc=document.createElement("small");desc.textContent="Kroki üzerinde göster";
   button.append(name,desc);
   button.addEventListener("click",()=>{
    deskList.hidden=true;mobileList.hidden=true;
    if(!document.getElementById("mobile-action-modal").hidden)document.getElementById("mobile-action-cancel").click();
    focus(boat);
   });
   target.append(button);
  }
  return results;
 }
 search.addEventListener("input",()=>showList(deskList,search.value));
 search.addEventListener("focus",()=>{if(search.value.trim())showList(deskList,search.value);});
 if(mobileInput){
  mobileInput.addEventListener("input",()=>{
   if(activeMobileSearch())showList(mobileList,mobileInput.value);else mobileList.hidden=true;
  });
  mobileInput.addEventListener("focus",()=>{if(activeMobileSearch()&&mobileInput.value.trim())showList(mobileList,mobileInput.value);});
 }
 document.addEventListener("pointerdown",e=>{if(!deskParent.contains(e.target))deskList.hidden=true;});
 // Eski Ara/Bul düğmeleri de bu yeni aramayı kullanır.
 searchBoat=function(){
  const q=search.value.trim();if(!q)return;
  const results=findBoats(q);
  if(!results.length){showMessage("Bulunamadı",q+" aramasına uygun tekne bulunamadı.");return;}
  if(results.length===1){deskList.hidden=true;mobileList.hidden=true;focus(results[0]);return;}
  if(mobile()&&mobileInput){
   const modal=document.getElementById("mobile-action-modal");
   modal.hidden=false;
   document.getElementById("mobile-dialog-title").textContent="Tekne Ara";
   mobileInput.value=q;
   showList(mobileList,q);
  }else showList(deskList,q);
 };
})();
