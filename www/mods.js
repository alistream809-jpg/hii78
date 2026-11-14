'use strict';
let src='mr',off=0,seq=0,dbt;
const fmtN=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':n,CFH=()=>({'x-api-key':localStorage.getItem('cfkey')||'',Accept:'application/json'}),LD=()=>$('#ml').value,CFL={forge:1,fabric:4,neoforge:6};
const card=m=>`<div class="glass mc"><div class="mh"><img src="${m.icon||''}" onerror="this.style.visibility='hidden'"><div><b>${esc(m.title)}</b><div class="muted">${esc(m.author)} · ⬇ ${fmtN(m.dl)}</div></div></div><p>${esc(m.desc||'')}</p>${m.shots.length?`<div class="shots">${m.shots.slice(0,4).map(u=>`<img loading="lazy" src="${u}">`).join('')}</div>`:''}<div class="muted">${esc((m.cats||[]).slice(0,4).join(' · '))}</div><button class="btn" data-s="${m.s}" data-id="${m.id}">Download &amp; convert</button></div>`;
async function mrSearch(q,o){const fac=[['project_type:mod']];if(LD())fac.push(['categories:'+LD()]);
  const r=await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&facets=${encodeURIComponent(JSON.stringify(fac))}&limit=20&offset=${o}&index=${q?'relevance':'downloads'}`);if(!r.ok)throw new Error('Modrinth '+r.status);
  return (await r.json()).hits.map(h=>({s:'mr',id:h.project_id,title:h.title,author:h.author,dl:h.downloads,desc:h.description,icon:h.icon_url,cats:h.display_categories||h.categories,shots:(h.gallery||[]).slice(0,4)}))}
async function cfSearch(q,o){if(!localStorage.getItem('cfkey'))throw new Error('Paste your free CurseForge API key in the box above.');
  const r=await fetch(`https://api.curseforge.com/v1/mods/search?gameId=432&classId=6&searchFilter=${encodeURIComponent(q)}&sortField=2&sortOrder=desc&pageSize=20&index=${o}${CFL[LD()]?'&modLoaderType='+CFL[LD()]:''}`,{headers:CFH()});
  if(!r.ok)throw new Error('CurseForge '+r.status+' (check API key)');
  return (await r.json()).data.map(m=>({s:'cf',id:m.id,title:m.name,author:m.authors?.[0]?.name||'',dl:m.downloadCount,desc:m.summary,icon:m.logo?.thumbnailUrl,cats:m.categories.map(c=>c.name),shots:(m.screenshots||[]).map(x=>x.thumbnailUrl)}))}
async function load(reset){const my=++seq;if(reset){off=0;$('#mlist').innerHTML=''}$('#mmore').hidden=true;$('#mlist').insertAdjacentHTML('beforeend','<p class="muted" id="mld">Loading…</p>');
  try{const r=await(src==='mr'?mrSearch:cfSearch)($('#mq').value.trim(),off);if(my!==seq)return;off+=20;$('#mld')?.remove();$('#mlist').insertAdjacentHTML('beforeend',r.map(card).join('')||'<p class="muted">No results</p>');$('#mmore').hidden=r.length<20}
  catch(e){if(my!==seq)return;$('#mld')?.remove();$('#mlist').insertAdjacentHTML('beforeend',`<p class="er">${esc(e.message)}</p>`)}}
async function dlMod(s,id,btn){const t=btn.innerHTML;btn.disabled=true;btn.textContent='Downloading…';
  try{let url,name;
    if(s==='mr'){const r=await(await fetch(`https://api.modrinth.com/v2/project/${id}/version${LD()?'?loaders='+encodeURIComponent(JSON.stringify([LD()])):''}`)).json(),v=r[0];if(!v)throw new Error('No version found for this loader filter');const f=v.files.find(x=>x.primary)||v.files[0];url=f.url;name=f.filename}
    else{const r=await(await fetch(`https://api.curseforge.com/v1/mods/${id}/files?pageSize=20${CFL[LD()]?'&modLoaderType='+CFL[LD()]:''}`,{headers:CFH()})).json(),f=(r.data||[]).find(x=>x.downloadUrl&&/\.jar$/.test(x.fileName));if(!f)throw new Error('The author disabled third-party downloads for this mod, or no JAR was found.');url=f.downloadUrl;name=f.fileName}
    const b=await(await fetch(url)).blob();tab('convert');await openJar(new File([b],name))}
  catch(e){alert(e.message)}btn.disabled=false;btn.innerHTML=t}
document.querySelectorAll('.seg a').forEach(a=>a.onclick=()=>{document.querySelectorAll('.seg a').forEach(x=>x.classList.remove('on'));a.classList.add('on');src=a.dataset.s;$('#cfk').hidden=src!=='cf';load(1)});
$('#cfk').value=localStorage.getItem('cfkey')||'';$('#cfk').onchange=e=>{localStorage.setItem('cfkey',e.target.value.trim());load(1)};
$('#mq').oninput=()=>{clearTimeout(dbt);dbt=setTimeout(()=>load(1),500)};$('#ml').onchange=()=>load(1);$('#mmore').onclick=()=>load(0);
$('#mlist').onclick=e=>{const b=e.target.closest('button[data-id]');if(b)dlMod(b.dataset.s,b.dataset.id,b)};
document.querySelector('.tabs [data-v=mods]').addEventListener('click',()=>{if(!$('#mlist').children.length)load(1)});
