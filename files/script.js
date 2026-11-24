const CATS=[["cafe","Café","☕"],["almoco","Almoço","🍴"],["janta","Janta","🍽️"],["turistico","Local turístico","📍"],["samba","Samba","🎶"]];
const catName=k=>(CATS.find(c=>c[0]===k)||[])[1]||k;
const catIcon=k=>(CATS.find(c=>c[0]===k)||[])[2]||"📍";
const $=id=>document.getElementById(id);
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid=()=>Date.now()+""+Math.random().toString(36).slice(2,6);
const mapQ=n=>encodeURIComponent(n+", Rio de Janeiro");
const mapLink=n=>`https://www.google.com/maps/search/?api=1&query=${mapQ(n)}`;

let days=[], places=[], filter="todos", mode="local", saveTimer=null;

/* ---------- Persistência: data.json ---------- */
function setStatus(text,cls){const s=$("status");s.textContent=text;s.className="status "+(cls||"")}
async function loadState(){
  // 1) servidor Node: lê data.json pela API
  try{
    const r=await fetch("/api/data",{cache:"no-store"});
    if(r.ok){const d=await r.json();if(Array.isArray(d.days)){mode="server";days=d.days;places=d.places||[];setStatus("Salvando em data.json","ok");return}}
  }catch(e){}
  // 2) sem servidor: usa o salvamento do navegador, ou o data.json como ponto de partida
  mode="local";
  try{const t=localStorage.getItem("rio-state");if(t){const d=JSON.parse(t);days=d.days;places=d.places||[];setStatus("Sem servidor: salvo só neste navegador","warn");return}}catch(e){}
  try{const d=await (await fetch("data.json")).json();days=d.days;places=d.places||[];setStatus("Sem servidor: salvo só neste navegador","warn");return}catch(e){}
  days=["Dia 1","Dia 2","Dia 3"].map(t=>({t,s:"",items:[]}));
  setStatus("Abra com node server.js para carregar o roteiro","warn");
}
function persist(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    const state={days,places};
    if(mode==="server"){
      try{const r=await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(state)});
        setStatus(r.ok?"Salvo em data.json":"Erro ao salvar em data.json",r.ok?"ok":"warn")}
      catch(e){setStatus("Servidor fora do ar: alterações não salvas","warn")}
    }else{try{localStorage.setItem("rio-state",JSON.stringify(state))}catch(e){}}
  },250);
}
$("export").addEventListener("click",()=>{
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify({days,places},null,2)],{type:"application/json"}));
  a.download="data.json";a.click();URL.revokeObjectURL(a.href);
});
$("import").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const d=JSON.parse(await f.text());if(!Array.isArray(d.days))throw 0;days=d.days;places=d.places||[];renderAll();persist()}
  catch(err){setStatus("Arquivo JSON inválido","warn")}
  e.target.value="";
});

/* ---------- Roteiro ---------- */
function routeLink(d){
  const s=d.items.filter(i=>!i.nomap);if(s.length<2)return "";
  const mid=s.slice(1,-1).slice(0,9).map(i=>mapQ(i.name)).join("%7C");
  return `https://www.google.com/maps/dir/?api=1&origin=${mapQ(s[0].name)}&destination=${mapQ(s[s.length-1].name)}${mid?`&waypoints=${mid}`:""}`;
}
function renderDays(){
  $("days").innerHTML=days.map((d,di)=>{
    const r=routeLink(d);
    return `<article class="day">
     <h3>${esc(d.t)}<small>${esc(d.s||"")}</small></h3>
     ${r?`<a class="route" href="${r}" target="_blank" rel="noopener">🗺️ Ver rota no Google Maps</a>`:""}
     <ul class="stops" data-day="${di}">
     ${d.items.map(it=>`
       <li class="${it.done?"done":""}" draggable="true" data-id="${it.id}"><div class="card">
         <span class="grip" aria-hidden="true">⋮⋮</span>
         <span class="ico" aria-hidden="true">${it.icon}</span>
         <div class="info"><label><input type="checkbox" data-done="${it.id}" ${it.done?"checked":""}><b>${esc(it.name)}</b></label>
           ${it.note?`<small class="note">${esc(it.note)}</small>`:""}
           <div class="row"><span class="chip">${catName(it.cat)}</span>${it.nomap?"":`<a href="${mapLink(it.name)}" target="_blank" rel="noopener">Abrir no Maps</a>`}</div></div>
         <div class="ctl"><button type="button" data-a="up" aria-label="Subir ${esc(it.name)}">↑</button><button type="button" data-a="down" aria-label="Descer ${esc(it.name)}">↓</button><button type="button" class="del" data-a="del" aria-label="Remover ${esc(it.name)}">✕</button></div>
       </div></li>`).join("")}
       <li class="add"><form data-add="${di}">
         <input type="text" name="n" placeholder="Adicionar local ao ${esc(d.t)}" aria-label="Novo local do ${esc(d.t)}" required maxlength="80">
         <select name="c" aria-label="Categoria">${CATS.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join("")}</select>
         <button class="btn" type="submit">Adicionar</button>
       </form></li>
     </ul>
   </article>`}).join("");
  const all=days.flatMap(d=>d.items),n=all.filter(i=>i.done).length;
  $("progress").textContent=`${n} de ${all.length} paradas visitadas`;
}
function find(id){for(let d=0;d<days.length;d++){const i=days[d].items.findIndex(x=>x.id===id);if(i>-1)return [d,i]}}
function moveItem(id,toDay,beforeId){
  const [d,i]=find(id),it=days[d].items.splice(i,1)[0],list=days[toDay].items;
  const at=beforeId?list.findIndex(x=>x.id===beforeId):-1;
  at>-1?list.splice(at,0,it):list.push(it);
}
const dz=$("days");
dz.addEventListener("change",e=>{const id=e.target.dataset.done;if(!id)return;const [d,i]=find(id);days[d].items[i].done=e.target.checked;renderDays();persist()});
dz.addEventListener("submit",e=>{
  e.preventDefault();const f=e.target,di=+f.dataset.add,name=f.n.value.trim();if(!name)return;
  days[di].items.push({id:uid(),icon:catIcon(f.c.value),name,cat:f.c.value,nomap:false,done:false});
  renderDays();persist();document.querySelector(`[data-add="${di}"] input`).focus();
});
dz.addEventListener("click",e=>{
  const b=e.target.closest("button[data-a]");if(!b)return;
  const id=b.closest("li").dataset.id,[d,i]=find(id),L=days[d].items;
  if(b.dataset.a==="del")L.splice(i,1);
  else if(b.dataset.a==="up"&&i>0)moveItem(id,d,L[i-1].id);
  else if(b.dataset.a==="down"&&i<L.length-1)moveItem(id,d,L[i+2]?L[i+2].id:null);
  renderDays();persist();
});
let dragId=null;
dz.addEventListener("dragstart",e=>{const li=e.target.closest("li[data-id]");if(!li)return;dragId=li.dataset.id;li.classList.add("drag");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",dragId)});
dz.addEventListener("dragend",()=>{dragId=null;renderDays()});
dz.addEventListener("dragover",e=>{
  if(!dragId)return;const ul=e.target.closest("ul.stops");if(!ul)return;e.preventDefault();
  dz.querySelectorAll(".over").forEach(x=>x.classList.remove("over"));
  const li=e.target.closest("li[data-id]");if(li&&li.dataset.id!==dragId)li.classList.add("over");
});
dz.addEventListener("drop",e=>{
  if(!dragId)return;const ul=e.target.closest("ul.stops");if(!ul)return;e.preventDefault();
  const li=e.target.closest("li[data-id]");
  moveItem(dragId,+ul.dataset.day,li&&li.dataset.id!==dragId?li.dataset.id:null);
  dragId=null;renderDays();persist();
});

/* ---------- Meus lugares ---------- */
$("cat").innerHTML=CATS.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join("");
function renderTabs(){
  const count=k=>k==="todos"?places.length:places.filter(p=>p.cat===k).length;
  $("tabs").innerHTML=[["todos","Todos"],...CATS].map(c=>`<button type="button" data-k="${c[0]}" aria-pressed="${filter===c[0]}">${c[1]}<i>${count(c[0])}</i></button>`).join("");
}
function renderList(){
  const list=places.filter(p=>filter==="todos"||p.cat===filter);
  if(!list.length){$("rank").innerHTML=`<div class="empty">${filter==="todos"?"Nenhum lugar salvo ainda. Digite um nome acima e escolha a categoria.":`Nada em ${catName(filter)} ainda. Salve um lugar nessa categoria para começar o ranking.`}</div>`;return}
  $("rank").innerHTML=list.map(p=>`
    <li draggable="true" data-id="${p.id}">
      <div class="txt"><b>${esc(p.name)}<span class="chip">${catName(p.cat)}</span></b>${p.note?`<small>${esc(p.note)}</small>`:""}</div>
      <div class="ctl">
        <button type="button" data-a="up" aria-label="Subir ${esc(p.name)}">↑</button>
        <button type="button" data-a="down" aria-label="Descer ${esc(p.name)}">↓</button>
        <button type="button" class="del" data-a="del" aria-label="Remover ${esc(p.name)}">✕</button>
      </div></li>`).join("");
}
function renderPlaces(){renderTabs();renderList()}
$("form").addEventListener("submit",e=>{
  e.preventDefault();const name=$("name").value.trim();if(!name)return;
  places.push({id:uid(),name,cat:$("cat").value,note:$("note").value.trim()});
  $("name").value="";$("note").value="";$("name").focus();renderPlaces();persist();
});
$("tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;filter=b.dataset.k;renderPlaces()});
const visibleIds=()=>places.filter(p=>filter==="todos"||p.cat===filter).map(p=>p.id);
function moveBefore(id,targetId){
  const item=places.find(p=>p.id===id);places=places.filter(p=>p.id!==id);
  targetId===null?places.push(item):places.splice(places.findIndex(p=>p.id===targetId),0,item);
}
$("rank").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  const id=b.closest("li").dataset.id,v=visibleIds(),i=v.indexOf(id);
  if(b.dataset.a==="del")places=places.filter(p=>p.id!==id);
  else if(b.dataset.a==="up"&&i>0)moveBefore(id,v[i-1]);
  else if(b.dataset.a==="down"&&i<v.length-1)moveBefore(id,v[i+2]??null);
  renderPlaces();persist();
});
let pDrag=null;
$("rank").addEventListener("dragstart",e=>{const li=e.target.closest("li");if(!li)return;pDrag=li.dataset.id;li.classList.add("drag");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",pDrag)});
$("rank").addEventListener("dragend",()=>{pDrag=null;renderList()});
$("rank").addEventListener("dragover",e=>{const li=e.target.closest("li");if(!li||!pDrag)return;e.preventDefault();document.querySelectorAll("#rank .over").forEach(x=>x.classList.remove("over"));li.classList.add("over")});
$("rank").addEventListener("drop",e=>{const li=e.target.closest("li");if(!li||!pDrag)return;e.preventDefault();if(li.dataset.id!==pDrag)moveBefore(pDrag,li.dataset.id);pDrag=null;renderPlaces();persist()});

function renderAll(){renderDays();renderPlaces()}
loadState().then(renderAll);
