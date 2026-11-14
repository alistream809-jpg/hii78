'use strict';
const $=s=>document.querySelector(s),yld=()=>new Promise(r=>setTimeout(r,0));
// ---- Version DB: Bedrock feature releases (verify/extend; custom x.y.z accepted) ----
const VERS=['1.16.100','1.16.200','1.16.210','1.16.220','1.17.0','1.17.10','1.17.30','1.17.40','1.18.0','1.18.10','1.18.30','1.19.0','1.19.10','1.19.20','1.19.30','1.19.40','1.19.50','1.19.60','1.19.70','1.19.80','1.20.0','1.20.10','1.20.30','1.20.40','1.20.50','1.20.60','1.20.70','1.20.80','1.21.0','1.21.20','1.21.30','1.21.40','1.21.50','1.21.60','1.21.70','1.21.80','1.21.90','1.21.100'].reverse();
const vn=v=>{const p=v.split('.').map(Number);return p[0]*1e6+p[1]*1e3+p[2]};
let target=VERS[0],jar=null,az=null,out=null,cur=null,logs=[];
const DB={get:()=>JSON.parse(localStorage.getItem('j2b')||'{"p":[],"h":[]}'),set:d=>localStorage.setItem('j2b',JSON.stringify(d))};
const log=(m,c='')=>{logs.push(m);$('#log').innerHTML+=`<div class="${c}">${m}</div>`;$('#log').scrollTop=1e9},prog=p=>$('#bar').style.width=p+'%';
const san=n=>n.toLowerCase().replace(/[^a-z0-9_.-]/g,'_');
const tm=t=>t&&t.match(/^\s*(\w+)\s*=\s*"([^"]*)"/gm)||[];
const tv=(t,k)=>{const m=t.match(new RegExp('^\\s*'+k+'\\s*=\\s*"([^"]*)"','m'));return m&&m[1]};
const rj=async p=>{const f=jar.file(p);if(!f)return null;try{return JSON.parse((await f.async('string')).replace(/^\uFEFF/,''))}catch(e){return null}};
// ---- 1. JAR ANALYZER ----
async function analyze(file){
  jar=await JSZip.loadAsync(file);const names=Object.keys(jar.files).filter(n=>!jar.files[n].dir);
  const a={loader:'Unknown',id:'',version:'',mc:'',deps:[],ns:new Set(),blocks:[],items:[],entities:[],geo:[],anim:[],tex:{block:[],item:[],entity:[]},recipes:[],loot:[],sounds:[],particles:[],classes:0,flags:{},lang:{},warn:[]};
  const has=n=>names.includes(n);
  if(has('META-INF/neoforge.mods.toml'))a.loader='NeoForge';else if(has('META-INF/mods.toml'))a.loader='Forge';else if(has('fabric.mod.json'))a.loader='Fabric';else if(has('quilt.mod.json'))a.loader='Quilt';else if(has('mcmod.info'))a.loader='Forge (legacy)';
  const tf=['META-INF/neoforge.mods.toml','META-INF/mods.toml'].find(has);
  if(tf){const t=await jar.file(tf).async('string');a.id=tv(t,'modId')||'';a.version=tv(t,'version')||'';a.name=tv(t,'displayName');a.mc=(t.match(/modId\s*=\s*"minecraft"[\s\S]*?versionRange\s*=\s*"([^"]*)"/)||[])[1]||'';a.deps=[...t.matchAll(/modId\s*=\s*"([^"]+)"/g)].map(m=>m[1]).filter(x=>!['minecraft','forge','neoforge',a.id].includes(x))}
  const fm=await rj('fabric.mod.json');if(fm){a.id=fm.id;a.version=fm.version;a.name=fm.name;a.mc=(fm.depends||{}).minecraft||'';a.deps=Object.keys(fm.depends||{}).filter(x=>!['minecraft','fabricloader','java'].includes(x))}
  const mi=await rj('mcmod.info');if(mi){const m=(mi.modList||mi)[0]||{};a.id=m.modid;a.name=m.name;a.version=m.version;a.mc=m.mcversion||''}
  const cls=[];
  for(const n of names){let m;
    if(n.endsWith('.class')){a.classes++;cls.push(n);continue}
    if(m=n.match(/^assets\/([^/]+)\/(.*)$/)){const ns=m[1],r=m[2];a.ns.add(ns);let q;
      if(q=r.match(/^textures\/(block|item|entity)\/(.+)\.png$/))a.tex[q[1]].push([n,q[2],r]);
      else if(q=r.match(/^blockstates\/([^/]+)\.json$/))a.blocks.push({ns,name:q[1]});
      else if(q=r.match(/^(?:models\/item|items)\/(.+)\.json$/))a.items.push({ns,name:q[1].split('/').pop(),p:q[1]});
      else if(r.match(/^geo\/.+\.json$/))a.geo.push(n);else if(r.match(/^animations\/.+\.json$/))a.anim.push(n);else if(r.match(/^sounds\/.+\.ogg$/))a.sounds.push(n);else if(r.match(/^particles\/.+\.json$/))a.particles.push(n);
      else if(r==='lang/en_us.json')Object.assign(a.lang,await rj(n)||{})}
    if(m=n.match(/^data\/([^/]+)\/(recipes?|loot_tables?)\/.+\.json$/)){a.ns.add(m[1]);(m[2][0]=='r'?a.recipes:a.loot).push(n)}}
  const bad=x=>['minecraft','forge','c','neoforge'].includes(x.ns);a.blocks=a.blocks.filter(x=>!bad(x));
  for(const k of Object.keys(a.lang)){const p=k.split('.');if(p.length!==3||!['item','block'].includes(p[0]))continue;const o={ns:p[1],name:p[2],p:p[2]};if(bad(o)||!names.some(x=>x.endsWith('/'+o.name+'.png')))continue;if(![...a.blocks,...a.items].some(x=>x.ns===o.ns&&x.name===o.name))(p[0]==='item'?a.items:a.blocks).push(o)}
  const seen=new Set(a.blocks.map(b=>b.ns+':'+b.name));a.items=a.items.filter((x,i,r)=>!bad(x)&&!seen.has(x.ns+':'+x.name)&&r.findIndex(y=>y.ns==x.ns&&y.name==x.name)==i);
  a.ns=[...a.ns].filter(x=>!['minecraft','forge','c','neoforge'].includes(x));a.ns0=a.id||a.ns[0]||'mod';
  a.entities=[...new Set(a.tex.entity.map(t=>t[2].replace(/^textures\/entity\//,'').replace(/\.png$/,'').split('/')[0]))];
  const sig={'Forge events':'net/minecraftforge/event','NeoForge events':'net/neoforged','Fabric API':'net/fabricmc/fabric/api','Mixins':'org/spongepowered/asm/mixin','Custom GUI/screens':'net/minecraft/client/gui','Block entities':'BlockEntity','Custom entity AI':'net/minecraft/world/entity/ai'};
  for(const c of cls.slice(0,400)){const s=await jar.file(c).async('string');for(const[k,v]of Object.entries(sig))if(s.includes(v))a.flags[k]=1}
  if(!a.blocks.length&&!a.items.length&&!a.tex.block.length&&!a.tex.item.length)a.warn.push('No Java assets found: nothing here can be converted.');
  return a}
// ---- 2. VALIDATOR ----
function validate(files,v){const w=[],n=vn(v),idre=/^[a-z0-9_.-]+:[a-z0-9_.-]+$/;
  if(n<vn('1.20.10'))w.push(['wn','Custom blocks/items may require the "Holiday Creator Features" experiment on '+v]);
  if(n<vn('1.20.50'))w.push(['wn','Pre-1.20.50 item format used (legacy icon/category components)']);
  if(n<vn('1.20.80'))w.push(['wn','Blocks use legacy texture mapping (blocks.json); no material_instances before 1.20.80']);
  let bad=0;for(const[p,d]of Object.entries(files)){if(p.endsWith('.json')){try{const o=JSON.parse(d);const id=o['minecraft:block']?.description?.identifier||o['minecraft:item']?.description?.identifier;if(id&&!idre.test(id)){bad++;w.push(['er','Invalid identifier '+id])}}catch(e){bad++;w.push(['er','Invalid JSON: '+p])}}}
  return{w,bad}}
// ---- 3. CONVERSION ENGINE / PACK GENERATOR ----
const mapId=s=>typeof s==='string'?s:(s&&(s.item||s.id))||'';
const SP=r=>{const i=r.indexOf(':');return i<0?['minecraft',r]:[r.slice(0,i),r.slice(i+1)]};
const rs=(v,T)=>{for(let i=0;i<9&&typeof v==='string'&&v[0]==='#';i++)v=T[v.slice(1)];return typeof v==='string'&&v[0]!=='#'?v:null};
const title=s=>s.replace(/[_/]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
function mapLoot(j,w){const pools=(j.pools||[]).map(p=>({rolls:typeof p.rolls==='number'?p.rolls:(p.rolls&&p.rolls.min?{min:p.rolls.min,max:p.rolls.max}:1),entries:(p.entries||[]).filter(e=>{if(e.type?.endsWith('item'))return true;w.push('Loot entry type '+e.type+' dropped');return false}).map(e=>{const o={type:'item',name:e.name,weight:e.weight||1};(e.functions||[]).forEach(f=>{if(f.function?.endsWith('set_count'))(o.functions=o.functions||[]).push({function:'set_count',count:f.count});else w.push('Loot function '+f.function+' dropped')});if(e.conditions)w.push('Loot conditions dropped (manual work)');return o})}));return{pools}}
async function model(ref,d=0){const[ns,p]=SP(ref),j=await rj(`assets/${ns}/models/${p}.json`);if(!j)return{T:{},E:null,b:p.replace(/^(block|item)\//,'')};const B=j.parent&&d<8?await model(j.parent,d+1):{T:{},E:null,b:''};return{T:{...B.T,...j.textures},E:j.elements||B.E,b:B.b}}
const CR=ang=>({from:[.8,0,8],to:[15.2,16,8],rotation:{origin:[8,8,8],axis:'y',angle:ang},faces:{north:{uv:[0,0,16,16],texture:'#cross'},south:{uv:[0,0,16,16],texture:'#cross'}}});
async function blockModel(b){const bs=await rj(`assets/${b.ns}/blockstates/${b.name}.json`),pk=v=>Array.isArray(v)?v[0]:v;let ref=null;
  if(bs?.variants){const k=Object.keys(bs.variants);ref=pk(bs.variants[k.includes('')?'':k[0]])?.model}else if(bs?.multipart)ref=pk(bs.multipart.find(x=>x.apply)?.apply)?.model;
  if(!ref)return null;const m=await model(ref),g=m.T,r=k=>rs(g[k],g),q=m.b;let E=m.E,F=null;const s6=(u,d,n,s,e,w)=>({up:u,down:d,north:n,south:s,east:e,west:w});
  if(!E){if(/^(cube_all|cube_mirrored_all)$/.test(q)){const t=r('all');F=s6(t,t,t,t,t,t)}
    else if(q==='cube')F=s6(r('up'),r('down'),r('north'),r('south'),r('east'),r('west'));
    else if(/^cube_column/.test(q)){const e=r('end'),s=r('side');F=s6(e,e,s,s,s,s)}
    else if(q==='cube_bottom_top'){const s=r('side');F=s6(r('top'),r('bottom'),s,s,s,s)}
    else if(q==='cube_top'){const s=r('side');F=s6(r('top'),s,s,s,s,s)}
    else if(/^orientable/.test(q)){const s=r('side');F=s6(r('top'),r('bottom')||r('top'),r('front'),s,s,s)}
    else if(/cross|^crop/.test(q)){E=[CR(45),CR(-45)];g.cross=g.cross||g.all||g.crop}
    else if(q==='slab'){const f=t=>({texture:t});E=[{from:[0,0,0],to:[16,8,16],faces:{north:f('#side'),south:f('#side'),east:f('#side'),west:f('#side'),up:f('#top'),down:f('#bottom')}}]}}
  let fb=false;if(!E&&!(F&&Object.values(F).some(Boolean))){const t=['all','side','top','texture','crop','0','particle'].map(k=>r(k)).find(Boolean)||Object.keys(g).map(k=>r(k)).find(Boolean);if(t){F=s6(t,t,t,t,t,t);fb=true}}
  return{T:g,E,F,fb}}
async function convert(a,v,o){
  const n=vn(v),F={},rep={ok:[],part:[],bad:[]},nm=san(o.name||a.name||a.ns0),min=v.split('.').map(Number),uBP=crypto.randomUUID(),uRP=crypto.randomUUID();
  const mf=(t,u,dep)=>JSON.stringify({format_version:2,header:{name:nm+(t=='data'?' BP':' RP'),description:'Converted from '+jar_name,uuid:u,version:[1,0,0],min_engine_version:min},modules:[{type:t,uuid:crypto.randomUUID(),version:[1,0,0]}],...(dep?{dependencies:[{uuid:dep,version:[1,0,0]}]}:{})},null,2);
  F['RP/manifest.json']=mf('resources',uRP);F['BP/manifest.json']=mf('data',uBP,uRP);log('Manifests generated for '+v);
  let phn=0;const bin=[],reg={},terrain={},itemtex={},fl=[],lg={};
  const regTex=async(ref,kind)=>{if(!ref)return null;const[ns,p]=SP(ref),f=`assets/${ns}/textures/${p}.png`;if(!jar.file(f))return null;const key=san(ns+'_'+p.replace(/^(block|item|blocks|items)\//,'')),dst=`RP/textures/${kind}/${key}.png`;
    if(!reg[dst]){reg[dst]=1;bin.push([dst,await jar.file(f).async('uint8array')]);(kind==='blocks'?terrain:itemtex)[key]={textures:`textures/${kind}/${key}`};const mc=await rj(f+'.mcmeta');if(mc?.animation&&kind==='blocks')fl.push({flipbook_texture:`textures/blocks/${key}`,atlas_tile:key,ticks_per_frame:mc.animation.frametime||1})}return key};
  const TX=Object.keys(jar.files).filter(x=>/^assets\/[^/]+\/textures\/.+\.png$/.test(x));
  const fuzzy=async(name,kind)=>{const pre=kind==='blocks'?/\/(block|blocks)\//:/\/(item|items)\//,bs=x=>x.split('/').pop().slice(0,-4);
    const f=TX.find(x=>pre.test(x)&&bs(x)===name)||TX.find(x=>pre.test(x)&&bs(x).includes(name))||TX.find(x=>bs(x)===name)||TX.find(x=>bs(x).includes(name));if(!f)return null;const m=f.match(/^assets\/([^/]+)\/textures\/(.+)\.png$/);return regTex(m[1]+':'+m[2],kind)};
  const ph=async(name,kind)=>{const key=san('ph_'+name),dst=`RP/textures/${kind}/${key}.png`;if(!reg[dst]){reg[dst]=1;const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');let h=0;for(const ch of name)h=(h*31+ch.charCodeAt(0))%360;
    x.fillStyle=`hsl(${h},45%,55%)`;x.fillRect(0,0,16,16);x.fillStyle=`hsl(${h},45%,38%)`;x.fillRect(0,0,16,2);x.fillRect(0,14,16,2);x.fillRect(0,0,2,16);x.fillRect(14,0,2,16);
    const b=await new Promise(r=>c.toBlob(r));bin.push([dst,new Uint8Array(await b.arrayBuffer())]);(kind==='blocks'?terrain:itemtex)[key]={textures:`textures/${kind}/${key}`}}return key};
  const geoId=j=>j['minecraft:geometry']?.[0]?.description?.identifier||Object.keys(j).find(k=>k.startsWith('geometry.')),geoMap={};
  for(const g of a.geo){try{const j=await rj(g),gi=j&&geoId(j);if(!gi)continue;const base=g.split('/').pop().replace(/\.json$/,'').replace(/\.geo$/,'').toLowerCase();F[`RP/models/entity/${san(g.replace(/^assets\//,'').replace(/\.json$/,''))}.json`]=JSON.stringify(j);geoMap[base]={id:gi,path:g}}catch(e){}}
  if(a.geo.length)rep.part.push(`${Object.keys(geoMap).length}/${a.geo.length} geo models copied to the resource pack`);
  // blocks
  const bj={};let nb=0,rotated=0;
  for(let bi=0;bi<a.blocks.length;bi++){const b=a.blocks[bi];prog(Math.round(bi/a.blocks.length*40));if(bi%15==0)await yld();try{
    let bm=await blockModel(b);if(!bm)bm={T:{},E:null,F:{},fb:true};let fz;const fall=async()=>fz||(fz=(await fuzzy(b.name,'blocks'))||(phn++,await ph(b.name,'blocks')));
    const fn=`${b.ns}_${san(b.name)}`,id=`${b.ns}:${san(b.name)}`,mi={},c={},D=['north','south','east','west','up','down'];let first=null,geo=null;const gm=geoMap[b.name.toLowerCase()];if(bm.fb&&gm&&n>=vn('1.20.80')){const j=await rj(gm.path);if(j&&j['minecraft:geometry']?.[0]?.description){j['minecraft:geometry'][0].description.identifier='geometry.'+fn;geo=j;bm.F=null;bm.E=null;bm.geo=1}}
    if(bm.geo){first=await fall();mi['*']={texture:first,render_method:'alpha_test'}}
    else if(bm.F){for(const d of D){const k=(await regTex(bm.F[d],'blocks'))||await fall();if(k){mi[d]={texture:k,render_method:'opaque'};first=first||k}}}
    else{const cubes=[];for(const e of (bm.E||[])){const f=e.from,t=e.to,cb={origin:[f[0]-8,f[1],f[2]-8],size:[t[0]-f[0],t[1]-f[1],t[2]-f[2]],uv:{}};
        if(e.rotation?.angle){rotated++;const p=e.rotation.origin||[8,8,8];cb.pivot=[p[0]-8,p[1],p[2]-8];cb.rotation=[0,0,0];cb.rotation[{x:0,y:1,z:2}[e.rotation.axis]]=e.rotation.angle}
        for(const d of D){const fc=e.faces?.[d];if(!fc)continue;const k=(await regTex(rs(fc.texture,bm.T),'blocks'))||await fall();first=first||k;mi[k]={texture:k,render_method:'alpha_test'};
          const u=fc.uv||({north:[f[0],16-t[1],t[0],16-f[1]],south:[f[0],16-t[1],t[0],16-f[1]],east:[f[2],16-t[1],t[2],16-f[1]],west:[f[2],16-t[1],t[2],16-f[1]],up:[f[0],f[2],t[0],t[2]],down:[f[0],f[2],t[0],t[2]]})[d];
          cb.uv[d]={uv:[u[0],u[1]],uv_size:[u[2]-u[0],u[3]-u[1]],material_instance:k}}cubes.push(cb)}
      geo={format_version:'1.12.0','minecraft:geometry':[{description:{identifier:'geometry.'+fn,texture_width:16,texture_height:16},bones:[{name:'main',pivot:[0,0,0],cubes}]}]}}
    if(!first){first=await fall();mi[first]={texture:first,render_method:'opaque'}}
    const lootP=a.loot.find(l=>l.endsWith(`/blocks/${b.name}.json`));
    if(n>=vn('1.20.80')){mi['*']=mi[first]||{texture:first,render_method:'opaque'};if(bm.F)mi['*']={texture:first,render_method:'opaque'};c['minecraft:material_instances']=mi;c['minecraft:destructible_by_mining']={seconds_to_destroy:2};
      if(geo){F[`RP/models/blocks/${fn}.geo.json`]=JSON.stringify(geo);c['minecraft:geometry']='geometry.'+fn}else c['minecraft:geometry']='minecraft:geometry.full_block';
      if(lootP)c['minecraft:loot']=`loot_tables/blocks/${fn}.json`;
      F[`BP/blocks/${fn}.json`]=JSON.stringify({format_version:'1.20.80','minecraft:block':{description:{identifier:id,menu_category:{category:'construction'}},components:c}},null,2)}
    else{bj[id]={textures:first,sound:'stone'};if(geo)rep.part.push(`Block ${id}: custom model needs 1.20.80+, shown as cube`);F[`BP/blocks/${fn}.json`]=JSON.stringify({format_version:'1.16.100','minecraft:block':{description:{identifier:id,register_to_creative_menu:true},components:{'minecraft:destroy_time':2}}},null,2)}
    if(bm.fb)rep.part.push(`Block ${id}: special shape (stairs/door/etc) shown as full cube`);lg[`tile.${id}.name`]=a.lang[`block.${b.ns}.${b.name}`]||title(b.name);nb++;rep.part.push(`Block ${id}: ${geo?'custom model converted':'textured cube'}; hardness/drops/light use defaults (defined in Java code)`);
    if(lootP){const w=[];F[`BP/loot_tables/blocks/${fn}.json`]=JSON.stringify(mapLoot(await rj(lootP),w),null,2);w.forEach(x=>rep.part.push(`Loot ${b.name}: ${x}`))}}catch(err){rep.bad.push(`Block ${b.ns}:${b.name}: ${err.message}`)}}
  if(rotated)rep.part.push(rotated+' rotated model elements converted (rotation direction not verified in-game)');
  if(n<vn('1.20.80')&&nb)F['RP/blocks.json']=JSON.stringify({format_version:[1,1,0],...bj},null,2);
  log(`Blocks converted: ${nb}/${a.blocks.length}`);
  // items
  let ni=0;const mod=n>=vn('1.20.50'),fv=n>=vn('1.21.30')?'1.21.30':'1.20.50',NF=Object.keys(jar.files);
  const AR={helmet:['head','helmet',2,'helmet_layer_visible'],chestplate:['chest','chestplate',6,'chest_layer_visible'],leggings:['legs','leggings',5,'leg_layer_visible'],boots:['feet','boots',2,'boot_layer_visible']};
  const TL={sword:[6,'sword'],axe:[7,'axe'],pickaxe:[5,'pickaxe'],shovel:[5,'shovel'],hoe:[1,'hoe'],knife:[2,'sword']};
  const FOOD=/soup|stew|pie|cake|bread|cookie|juice|salad|sandwich|roll|burger|pasta|steak|chop|bacon|egg|cheese|pizza|fries|jam|honey|sweet|berry|apple|carrot|potato|cod|salmon|chicken|beef|mutton|pork|ham|rice|noodle|cider|tea|coffee|wrap|bowl|dumpling|pancake|slice|cutlet|fillet|sausage|toast|pudding|cupcake|tart|taco|ice_cream|smoothie|cooked|roasted|fried|baked|grilled|tomato|onion|cabbage|pumpkin/,NOF=/seed|spawn|bucket|crate|bag|block|sack|ingredient|dough|raw_|rotten|spore/;
  const findArm=(ns,mat,leg)=>{for(const p of leg?[`textures/models/armor/${mat}_layer_2.png`,`textures/entity/equipment/humanoid_leggings/${mat}.png`]:[`textures/models/armor/${mat}_layer_1.png`,`textures/entity/equipment/humanoid/${mat}.png`])if(jar.file(`assets/${ns}/${p}`))return `assets/${ns}/${p}`;
    return NF.find(f=>f.startsWith(`assets/${ns}/textures/`)&&f.endsWith('.png')&&/armor|equipment/.test(f)&&f.includes(mat)&&(leg?/layer_2|leggings/.test(f):!/layer_2|leggings/.test(f)))||null};
  const IP=i=>i.p||i.name;
  const TAG={};for(const f of NF.filter(x=>/^data\/[^/]+\/tags\/(items|item)\/.+\.json$/.test(x))){const j=await rj(f),t=f.replace(/^data\/([^/]+)\/tags\/(?:items|item)\//,'$1:').replace(/\.json$/,'');TAG[t]=TAG[t]||new Set();for(const v of j?.values||[])TAG[t].add(typeof v==='string'?v:v?.id)}
  const tagType=id=>{for(const[k,v]of Object.entries(TAG))if(v.has(id)){const m=k.match(/sword|pickaxe|shovel|hoe|axe|helmet|head_armor|chestplate|chest_armor|leggings|leg_armor|boots|foot_armor/);if(m)return{head_armor:'helmet',chest_armor:'chestplate',leg_armor:'leggings',foot_armor:'boots'}[m[0]]||m[0]}return null};
  const NT={sword:'sword',saber:'sword',katana:'sword',blade:'sword',rapier:'sword',dagger:'sword',knife:'sword',cutlass:'sword',pickaxe:'pickaxe',axe:'axe',shovel:'shovel',hoe:'hoe',helmet:'helmet',chestplate:'chestplate',leggings:'leggings',boots:'boots'};
  const nameType=n=>{for(const w of n.split('_').reverse())if(NT[w])return NT[w];return null};
  const tierOf=n=>(n.match(/netherite|diamond|gold|iron|steel|stone|wood|leather|chain/)||['iron'])[0].replace('steel','iron'),
    ARMP={leather:[1,3,2,1],chain:[2,5,4,1],iron:[2,6,5,2],gold:[2,5,3,1],diamond:[3,8,6,3],netherite:[3,8,6,3],wood:[1,3,2,1],stone:[2,5,4,1]},ARMD={leather:5,chain:15,iron:15,gold:7,diamond:33,netherite:37,wood:5,stone:15},DM={helmet:11,chestplate:16,leggings:15,boots:13},
    TOOLD={wood:59,stone:131,iron:250,gold:32,diamond:1561,netherite:2031,leather:59,chain:250},TOOLS={wood:2,stone:4,iron:6,gold:12,diamond:8,netherite:9},AXE={wood:7,stone:9,iron:9,gold:7,diamond:9,netherite:10};
  for(const i of a.items){try{let ref=`${i.ns}:item/${IP(i)}`;const d=await rj(`assets/${i.ns}/items/${IP(i)}.json`),fm=o=>{if(!o||typeof o!=='object')return null;if(typeof o.model==='string')return o.model;for(const k in o){const r=fm(o[k]);if(r)return r}return null};
    const mr=(d&&fm(d))||ref,m=await model(mr);let key=await regTex(rs(m.T.layer0,m.T),'items');if(!key)key=await regTex(ref,'items');
    if(!key)key=await fuzzy(i.name,'items')||(phn++,await ph(i.name,'items'));
    const id=`${i.ns}:${san(i.name)}`,fn=`${i.ns}_${san(i.name)}`,cm={'minecraft:max_stack_size':64};let cat={category:'items'},kind='basic';
    if(m.E&&m.E.length&&!/(helmet|chestplate|leggings|boots)$/.test(i.name)){const tk=(await regTex(rs(Object.values(m.E[0].faces||{})[0]?.texture,m.T),'items'))||key,sw={east:'west',west:'east'};
      const cubes=m.E.map(e=>{const f=e.from,t=e.to,cb={origin:[8-t[0],f[1],f[2]-8],size:[t[0]-f[0],t[1]-f[1],t[2]-f[2]],uv:{}};
        for(const d of ['north','south','east','west','up','down']){const fc=e.faces?.[d];if(!fc)continue;const u=fc.uv||({north:[f[0],16-t[1],t[0],16-f[1]],south:[f[0],16-t[1],t[0],16-f[1]],east:[f[2],16-t[1],t[2],16-f[1]],west:[f[2],16-t[1],t[2],16-f[1]],up:[f[0],f[2],t[0],t[2]],down:[f[0],f[2],t[0],t[2]]})[d];cb.uv[sw[d]||d]={uv:[u[0],u[1]],uv_size:[u[2]-u[0],u[3]-u[1]]}}
        if(e.rotation?.angle){const p=e.rotation.origin||[8,8,8];cb.pivot=[8-p[0],p[1],p[2]-8];cb.rotation=[0,0,0];cb.rotation[{x:0,y:1,z:2}[e.rotation.axis]]=e.rotation.angle*(e.rotation.axis==='y'?-1:1)}return cb});
      F[`RP/models/entity/${fn}_item.geo.json`]=JSON.stringify({format_version:'1.12.0','minecraft:geometry':[{description:{identifier:`geometry.${fn}_item`,texture_width:16,texture_height:16},bones:[{name:'main',pivot:[0,0,0],cubes}]}]});
      F[`RP/attachables/${fn}.json`]=JSON.stringify({format_version:'1.10.0','minecraft:attachable':{description:{identifier:id,materials:{default:'entity_alphatest',enchanted:'entity_alphatest_glint'},textures:{default:`textures/items/${tk}`,enchanted:'textures/misc/enchanted_item_glint'},geometry:{default:`geometry.${fn}_item`},render_controllers:['controller.render.item_default']}}},null,2);kind='3d-held-model'}

    const ty=tagType(i.ns+':'+i.name)||nameType(i.name),mt=ty?[0,i.name.replace(/_?(helmet|chestplate|leggings|boots|sword|pickaxe|axe|shovel|hoe|knife)$/,''),ty]:null;
    if(mt&&AR[mt[2]]){const[,mat,k]=mt,[sl,gr,pr,vr]=AR[k],leg=k==='leggings',af=findArm(i.ns,mat||i.name,leg);kind='armor';cat={category:'equipment',group:'itemGroup.name.'+gr};
      const T=tierOf(i.name);Object.assign(cm,{'minecraft:max_stack_size':1,'minecraft:durability':{max_durability:ARMD[T]*DM[k]},'minecraft:wearable':{slot:'slot.armor.'+sl,protection:ARMP[T][{helmet:0,chestplate:1,leggings:2,boots:3}[k]]}});
      if(af){const dst=`RP/textures/models/armor/${i.ns}_${san(mat||i.name)}_${leg?2:1}.png`;if(!reg[dst]){reg[dst]=1;bin.push([dst,await jar.file(af).async('uint8array')])}
        F[`RP/attachables/${fn}.json`]=JSON.stringify({format_version:'1.10.0','minecraft:attachable':{description:{identifier:id,materials:{default:'armor',enchanted:'armor_enchanted'},textures:{default:dst.slice(3,-4),enchanted:'textures/misc/enchanted_item_glint'},geometry:{default:'geometry.humanoid.armor.'+gr},scripts:{parent_setup:`variable.${vr} = 0.0;`},render_controllers:['controller.render.armor']}}},null,2)}
      else rep.part.push(`Armor ${id}: worn-model texture not found, can be equipped but looks invisible`)}
    else if(mt&&TL[mt[2]]){const k=mt[2];kind='tool';cat={category:'equipment',group:'itemGroup.name.'+TL[k][1]};const T=tierOf(i.name),tb={wood:0,gold:0,stone:1,iron:2,diamond:3,netherite:4,leather:0,chain:2}[T],dmg={sword:4+tb,axe:AXE[T]||9,pickaxe:2+tb,shovel:2+tb,hoe:1,knife:2}[k];Object.assign(cm,{'minecraft:max_stack_size':1,'minecraft:durability':{max_durability:TOOLD[T]},'minecraft:hand_equipped':true,'minecraft:damage':dmg});
      if(mod&&['pickaxe','axe','shovel','hoe'].includes(k))cm['minecraft:digger']={use_efficiency:true,destroy_speeds:[{block:{tags:`q.any_tag('minecraft:is_${k}_item_destructible')`},speed:TOOLS[T]||6}]}}
    else if(FOOD.test(i.name)&&!NOF.test(i.name)){kind='food';cm['minecraft:food']={nutrition:4,saturation_modifier:'normal',can_always_eat:false};if(n>=vn('1.20.80'))cm['minecraft:use_modifiers']={use_duration:1.6,movement_modifier:0.35}}
    F[`BP/items/${fn}.json`]=JSON.stringify({format_version:mod?fv:'1.16.100','minecraft:item':{description:mod?{identifier:id,menu_category:cat}:{identifier:id,category:cat.category},components:{'minecraft:icon':!mod?key:n>=vn('1.21.30')?{textures:{default:key}}:{texture:key},...cm}}},null,2);ni++;
    lg[`item.${id}`]=a.lang[`item.${i.ns}.${i.name}`]||title(i.name);rep.part.push(`Item ${id}: ${kind} (category from the mod's own item tags; protection/damage/durability are ESTIMATED from the material name because the real values are compiled Java code)`)}catch(err){rep.bad.push(`Item ${i.name}: ${err.message}`)}}
  if(phn)rep.part.push(`${phn} blocks/items use a generated placeholder texture: the JAR has no texture for them (the mod loads them from external packs or code, e.g. TacZ gun packs)`);
  prog(50);log('Items converted: '+ni+'/'+a.items.length);
  F['RP/textures/terrain_texture.json']=JSON.stringify({resource_pack_name:nm,texture_name:'atlas.terrain',padding:8,num_mip_levels:4,texture_data:terrain},null,2);
  F['RP/textures/item_texture.json']=JSON.stringify({resource_pack_name:nm,texture_name:'atlas.items',texture_data:itemtex},null,2);
  if(fl.length)F['RP/textures/flipbook_textures.json']=JSON.stringify(fl,null,2);
  log(`Textures packed: ${Object.keys(terrain).length} block, ${Object.keys(itemtex).length} item, ${fl.length} animated`);
  for(const[src,,r]of a.tex.entity)bin.push([`RP/textures/entity/${san(a.ns0)}/`+san(r.replace(/^textures\/entity\//,'').replace(/\.png$/,''))+'.png',await jar.file(src).async('uint8array')]);
  // entities, animations
  const doneE=new Set();let ne=0;
  const bb=j=>{let X=.6,Y=.6;try{for(const b of j['minecraft:geometry'][0].bones||[])for(const c of b.cubes||[]){X=Math.max(X,(Math.abs(c.origin[0])+c.size[0])/8,(Math.abs(c.origin[2])+c.size[2])/8);Y=Math.max(Y,(c.origin[1]+c.size[1])/16)}}catch(e){}return[Math.min(X,4),Math.min(Y,6)]};
  for(const e of a.entities){try{const gm=geoMap[e.toLowerCase()],tk=a.tex.entity.find(t=>t[2].replace(/^textures\/entity\//,'').replace(/\.png$/,'').split('/')[0]===e);if(!gm||!tk)continue;
    const en=san(e),id=`${san(a.ns0)}:${en}`,rel=san(tk[2].replace(/^textures\/entity\//,'').replace(/\.png$/,'')),[w,h]=bb(await rj(gm.path));
    F[`RP/entity/${en}.entity.json`]=JSON.stringify({format_version:'1.10.0','minecraft:client_entity':{description:{identifier:id,materials:{default:'entity_alphatest'},textures:{default:`textures/entity/${san(a.ns0)}/${rel}`},geometry:{default:gm.id},render_controllers:['controller.render.default'],spawn_egg:{base_color:'#7a7a7a',overlay_color:'#333333'}}}},null,2);
    F[`BP/entities/${en}.json`]=JSON.stringify({format_version:'1.12.0','minecraft:entity':{description:{identifier:id,is_spawnable:true,is_summonable:true,is_experimental:false},components:{'minecraft:type_family':{family:[en]},'minecraft:health':{value:20,max:20},'minecraft:collision_box':{width:+w.toFixed(2),height:+h.toFixed(2)},'minecraft:physics':{},'minecraft:pushable':{is_pushable:true,is_pushable_by_piston:true},'minecraft:movement':{value:0.2}}}},null,2);
    lg[`entity.${id}.name`]=a.lang[`entity.${a.ns0}.${e}`]||title(e);lg[`item.spawn_egg.entity.${id}.name`]=(lg[`entity.${id}.name`])+' Spawn Egg';doneE.add(e);ne++}catch(err){rep.bad.push(`Entity ${e}: ${err.message}`)}}
  if(ne)rep.part.push(`${ne} entities with 3D models converted (use /summon ${san(a.ns0)}:name or spawn egg); AI, animations wiring and behavior are not converted`);
  for(const p of a.anim){try{const j=await rj(p);if(j)F['RP/animations/'+san(p.replace(/^assets\//,'').replace(/\.json$/,''))+'.json']=JSON.stringify(j)}catch(e){}}
  if(a.anim.length)rep.part.push(a.anim.length+' animation files copied (not yet attached to entities)');
  // recipes
  let nr=0;for(const r of a.recipes){const j=await rj(r);if(!j)continue;const t=(j.type||'').replace('minecraft:',''),nmr=san(r.replace(/^data\/[^/]+\/recipes?\//,'').replace(/\.json$/,'')),res=j.result;
    const ing=x=>{const k=Array.isArray(x)?x[0]:x;return typeof k==='string'?(k[0]==='#'?{tag:k.slice(1)}:{item:k}):k.tag?{tag:k.tag}:{item:mapId(k)}};const rid=`${a.ns0}:r_${nmr}`,cnt=res?.count||1;let o;
    try{if(t==='crafting_shaped'){const key={};for(const[k,v2]of Object.entries(j.key))key[k]=ing(v2);o={'minecraft:recipe_shaped':{description:{identifier:rid},tags:['crafting_table'],pattern:j.pattern,key,result:{item:mapId(res),count:cnt}}}}
      else if(t==='crafting_shapeless'){o={'minecraft:recipe_shapeless':{description:{identifier:rid},tags:['crafting_table'],ingredients:j.ingredients.map(ing),result:{item:mapId(res),count:cnt}}}}
      else if(t==='smelting'){o={'minecraft:recipe_furnace':{description:{identifier:rid},tags:['furnace'],input:ing(j.ingredient).item,output:mapId(res)}}}
      else{rep.bad.push(`Recipe ${nmr}: type ${t} unsupported`);continue}
      F[`BP/recipes/${nmr}.json`]=JSON.stringify({format_version:'1.20.10',...o},null,2);nr++}catch(e){rep.bad.push(`Recipe ${nmr}: malformed (${e.message})`)}}
  if(nr)rep.part.push(`${nr} recipes converted (vanilla item names not verified against Bedrock)`);log('Recipes: '+nr);prog(60);
  // sounds
  const sd={};for(const s of a.sounds){const p=s.replace(/^assets\/[^/]+\/sounds\//,'').replace(/\.ogg$/,''),q=san(p);bin.push([`RP/sounds/${san(a.ns0)}/${q}.ogg`,await jar.file(s).async('uint8array')]);sd[`${san(a.ns0)}.${q.replace(/\//g,'.')}`]={category:'neutral',sounds:[{name:`sounds/${san(a.ns0)}/${q}`}]}}
  if(a.sounds.length){F['RP/sounds/sound_definitions.json']=JSON.stringify({format_version:'1.14.0',sound_definitions:sd},null,2);rep.part.push(a.sounds.length+' sounds copied; event mapping (sounds.json) not translated')}
  const L=Object.entries(lg).map(e=>e.join('=')).join('\n');if(L){F['RP/texts/en_US.lang']=L;F['RP/texts/languages.json']='["en_US"]'}
  {const ue=a.entities.filter(e=>!doneE.has(e));if(ue.length)rep.bad.push(`Entities without a geo model in the JAR (${ue.join(', ')}): cannot be rendered, models are Java code`)}
  if(a.particles.length)rep.bad.push(a.particles.length+' particle definitions: not converted');
  for(const f of Object.keys(a.flags))rep.bad.push(`${f} detected: needs manual rewrite`);
  rep.bad.push('Java gameplay logic, GUIs and entity AI are not converted');
  prog(70);const V=validate(F,v);V.w.forEach(x=>log(x[1],x[0]));log(V.bad?V.bad+' validation errors':'Validation passed',V.bad?'er':'ok');
  return{F,bin,rep,V,nm}}
async function pack(r,fmt){const z=new JSZip(),pre=fmt==='mcaddon'?null:fmt.toUpperCase()+'/';
  const put=(p,d)=>{if(fmt==='mcaddon'){z.file(p.replace(/^(BP|RP)\//,(m,k)=>`${r.nm}_${k}/`),d)}else if(p.startsWith(pre))z.file(p.slice(3),d)};
  Object.entries(r.F).forEach(([p,d])=>put(p,d));r.bin.forEach(([p,d])=>put(p,d));
  if(!Object.keys(z.files).length)throw new Error('Nothing to package for this output type');
  return z.generateAsync({type:'uint8array',compression:'DEFLATE'},m=>prog(70+m.percent*.3))}
// ---- UI ----
const esc=s=>String(s).replace(/</g,'&lt;');
function showRep(a){$('#analysis').hidden=false;$('#report').innerHTML=`<p><b>${esc(a.name||a.ns0)}</b> ${esc(a.version)}<br>Loader: ${a.loader} · MC: ${esc(a.mc||'unknown')}</p><p>Blocks ${a.blocks.length} · Items ${a.items.length} · Entities ${a.entities.length}<br>Textures ${a.tex.block.length+a.tex.item.length+a.tex.entity.length} · Recipes ${a.recipes.length} · Loot ${a.loot.length} · Sounds ${a.sounds.length}<br>Java classes ${a.classes} · Deps: ${a.deps.join(', ')||'none'}</p>${Object.keys(a.flags).map(f=>`<div class="wn">Incompatible: ${f}</div>`).join('')}${a.warn.map(w=>`<div class="er">${w}</div>`).join('')}`}
let jar_name='';
$('#pick').onclick=()=>$('#file').click();
const openJar=async f=>{jar_name=f.name;$('#sel').textContent=`${f.name} (${(f.size/1048576).toFixed(2)} MB)`;$('#log').innerHTML='';logs=[];out=null;$('#exp').hidden=true;
  try{prog(0);log('Analyzing…');az=await analyze(f);showRep(az);$('#go').disabled=!(az.blocks.length||az.items.length||az.tex.block.length||az.tex.item.length);
    const d=DB.get();cur={id:Date.now(),name:az.name||f.name,jar:f.name,loader:az.loader,created:new Date().toLocaleString(),exports:[],errors:[],analysis:$('#report').innerHTML};d.p.unshift(cur);DB.set(d);log('Analysis complete','ok')}
  catch(err){az=null;$('#go').disabled=true;log('Not a valid JAR/ZIP: '+err.message,'er')}};
$('#file').onchange=e=>{const f=e.target.files[0];if(f)openJar(f)};
$('#go').onclick=async()=>{$('#go').disabled=true;$('#log').innerHTML='';try{out=await convert(az,target,{name:$('#pname').value});
  const{rep}=out;log(`<b>Report</b>: ${rep.part.length} partial, ${rep.bad.length} unsupported`);rep.bad.forEach(x=>log('✗ '+esc(x),'er'));rep.part.forEach(x=>log('~ '+esc(x),'wn'));
  if(out.V.bad)throw new Error('Validation failed, no add-on generated');
  const fmt=$('#fmt').value;out.data=await pack(out,fmt);out.ext=fmt==='mcaddon'?'mcaddon':'mcpack';prog(100);log(`Packaged ${(out.data.length/1024).toFixed(1)} KB .${out.ext}`,'ok');$('#exp').hidden=false;
  if(cur){cur.errors=rep.bad;const d=DB.get(),p=d.p.find(x=>x.id===cur.id);if(p){p.errors=rep.bad;p.log=logs;DB.set(d)}}}
  catch(e){log('Conversion failed: '+esc(e.message),'er')}$('#go').disabled=false};
$('#exp').onclick=async()=>{const fn=`${out.nm}.${out.ext}`,C=window.Capacitor?.Plugins;try{
  if(C?.Filesystem&&C?.Share){let s='';for(let i=0;i<out.data.length;i+=8192)s+=String.fromCharCode.apply(null,out.data.subarray(i,i+8192));
    const r=await C.Filesystem.writeFile({path:fn,data:btoa(s),directory:'CACHE'});await C.Share.share({title:fn,url:r.uri})}
  else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out.data]));a.download=fn;a.click()}
  const d=DB.get();d.h.unshift({file:fn,size:out.data.length,ver:target,time:new Date().toLocaleString()});const p=d.p.find(x=>cur&&x.id===cur.id);if(p)p.exports.push(fn);DB.set(d);log('Exported '+fn,'ok')}catch(e){log('Export failed: '+esc(e.message),'er')}};
// version sheet
const rv=q=>{let l=VERS.filter(v=>v.includes(q));if(/^\d+\.\d+\.\d+$/.test(q)&&!VERS.includes(q))l=[q+' (custom)'].concat(l);$('#vl').innerHTML=l.map(v=>`<div class="vi" data-v="${v.split(' ')[0]}"><span>${v}</span><span>${v==target?'✓':''}</span></div>`).join('')||'<p class="muted">No match</p>'};
const setV=()=>$('#vbtn').textContent='Bedrock '+target;setV();
$('#vbtn').onclick=()=>{$('#sheet').hidden=false;$('#vq').value='';rv('')};$('#vx').onclick=()=>$('#sheet').hidden=true;$('#vq').oninput=e=>rv(e.target.value.trim());
$('#vl').onclick=e=>{const i=e.target.closest('.vi');if(i){target=i.dataset.v;setV();$('#sheet').hidden=true}};
// projects/history/tabs
function render(){const d=DB.get();$('#plist').innerHTML=d.p.map(p=>`<div class="glass"><b>${esc(p.name)}</b><div class="muted">${esc(p.jar)} · ${p.loader} · ${p.created}</div><div class="muted">Exports: ${p.exports.length} · Unsupported: ${p.errors.length}</div><div class="row"><button data-a="o" data-i="${p.id}">Open</button><button data-a="r" data-i="${p.id}">Rename</button><button data-a="d" data-i="${p.id}">Delete</button></div></div>`).join('')||'<p class="muted">No projects yet. Choose a JAR on the Convert tab.</p>';
  $('#hlist').innerHTML=d.h.map(h=>`<div class="glass">${esc(h.file)}<div class="muted">${h.ver} · ${(h.size/1024).toFixed(1)} KB · ${h.time}</div></div>`).join('')||'<p class="muted">No exports yet.</p>'}
$('#plist').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=DB.get(),p=d.p.find(x=>x.id==b.dataset.i);
  if(b.dataset.a==='d'&&confirm('Delete project?'))d.p=d.p.filter(x=>x!==p);if(b.dataset.a==='r'){const n=prompt('Project name',p.name);if(n)p.name=n}
  if(b.dataset.a==='o'){$('#analysis').hidden=false;$('#report').innerHTML=p.analysis;$('#log').innerHTML=(p.log||p.errors.map(x=>'✗ '+x)).map(x=>`<div>${esc(x)}</div>`).join('');$('#sel').textContent=p.jar+' (saved report; re-select the JAR to convert again)';tab('convert')}
  DB.set(d);render()};
$('#clr').onclick=()=>{const d=DB.get();d.p.forEach(p=>{p.errors=[];p.log=[]});DB.set(d);render()};
function tab(v){document.querySelectorAll('.view,.tabs a').forEach(e=>e.classList.remove('on'));$('#v-'+v).classList.add('on');document.querySelector(`.tabs [data-v=${v}]`).classList.add('on');render()}
document.querySelectorAll('.tabs a').forEach(a=>a.onclick=()=>tab(a.dataset.v));render();
