import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/* Review files are explicitly prepared, self-contained GLBs. Nothing here
 * imports an archive, opens Blender, adapts a rig, or changes the ranch manifest.
 * Optional assets/models/horse-imports/review.json:
 * {schemaVersion:1,models:[{candidateId,file,sourceSha256,label,notes}]}
 * file must be assets/models/horse-imports/<candidateId>/review/<name>.glb.
 * sourceSha256 must match that candidate's sanitized public provenance.json.
 * Private registration receipts and raw originals are never fetched here.
 */
const $=id=>document.getElementById(id);
const base=new URL('../',import.meta.url);
const importsPath='assets/models/horse-imports/';
const viewVectors={quarter:new THREE.Vector3(-1,.35,1.15),side:new THREE.Vector3(-1,.12,0),front:new THREE.Vector3(0,.12,1)};

// The repository's existing review pages use local orbit controls; the vendored
// Three subset does not include the addon. Keep this controller self-contained.
class ReviewOrbitControls {
  constructor(camera,element){
    this.camera=camera;this.target=new THREE.Vector3();this.minDistance=.1;this.maxDistance=100;
    const pointers=new Map();
    element.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});element.setPointerCapture(event.pointerId);});
    element.addEventListener('pointermove',event=>{
      const old=pointers.get(event.pointerId);if(!old)return;
      const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(this.target));
      if(pointers.size===1){spherical.theta-=(event.clientX-old.x)*.007;spherical.phi=THREE.MathUtils.clamp(spherical.phi+(event.clientY-old.y)*.005,.1,Math.PI-.1);}
      else{
        const other=[...pointers.entries()].find(([id])=>id!==event.pointerId)?.[1];
        if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(event.clientX-other.x,event.clientY-other.y);if(after>1)spherical.radius=THREE.MathUtils.clamp(spherical.radius*before/after,this.minDistance,this.maxDistance);}
      }
      camera.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(spherical));pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});this.update();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,event=>pointers.delete(event.pointerId));
    element.addEventListener('wheel',event=>{event.preventDefault();const offset=camera.position.clone().sub(this.target),distance=THREE.MathUtils.clamp(offset.length()*Math.exp(THREE.MathUtils.clamp(event.deltaY,-150,150)*.0015),this.minDistance,this.maxDistance);camera.position.copy(this.target).add(offset.setLength(distance));this.update();},{passive:false});
  }
  update(){this.camera.lookAt(this.target);}
}

let renderer,scene,camera,controls,model,wrapper,mixer,action,helper;
let rows=[],clips=[],requestId=0,refreshId=0,selected=null,loading=false,error=null,paused=false,manual=false,view='quarter';
let restBounds=null,materialCache=new Map(),catalogError=null;
const clay=new THREE.MeshStandardMaterial({color:0xafa898,roughness:.75});
const wire=new THREE.MeshBasicMaterial({color:0x335740,wireframe:true});

function reviewLoader(){
  const loader=new GLTFLoader();
  // r160 removed the legacy specular/glossiness loader. This acquired demo uses
  // zero RGB specular factors and no specular/glossiness textures throughout.
  // Preserve its diffuse maps, cutout alpha and glossiness without rewriting
  // the original GLB. Other legacy material variants require separate review.
  loader.register(parser=>({
    name:'KHR_materials_pbrSpecularGlossiness',
    getMaterialType(index){return parser.json.materials[index].extensions?.[this.name]?THREE.MeshPhysicalMaterial:null;},
    extendMaterialParams(index,params){
      const extension=parser.json.materials[index].extensions?.[this.name];if(!extension)return Promise.resolve();
      const specular=extension.specularFactor||[1,1,1];
      if(extension.specularGlossinessTexture||specular.length!==3||specular.some(value=>value!==0))throw new Error('This legacy material needs a specular/glossiness conversion before faithful review.');
      const diffuse=extension.diffuseFactor||[1,1,1,1],glossiness=extension.glossinessFactor??1;
      if(diffuse.length!==4||!diffuse.every(Number.isFinite)||!Number.isFinite(glossiness)||glossiness<0||glossiness>1)throw new Error('Invalid legacy diffuse or glossiness factor.');
      params.color=new THREE.Color().setRGB(diffuse[0],diffuse[1],diffuse[2],THREE.LinearSRGBColorSpace);params.opacity=diffuse[3];
      params.metalness=0;params.roughness=1-glossiness;params.specularColor=new THREE.Color(0,0,0);params.specularIntensity=1;
      params.userData={reviewMaterialAdapter:'zero-specular-glossiness-review-v1'};
      return extension.diffuseTexture?parser.assignTexture(params,'map',extension.diffuseTexture,THREE.SRGBColorSpace):Promise.resolve();
    }
  }));
  return loader;
}

function initializeStudio(){
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.domElement.setAttribute('aria-label','Interactive imported model preview');$('stage').prepend(renderer.domElement);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  scene=new THREE.Scene();scene.background=new THREE.Color('#e2e6dc');
  camera=new THREE.PerspectiveCamera(35,1,.01,100);camera.position.set(-5,2.5,5);controls=new ReviewOrbitControls(camera,renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xf2f6ff,0x89816b,2));
  const key=new THREE.DirectionalLight(0xfff4e4,3);key.position.set(-4,7,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0xe1edff,1.2);fill.position.set(5,3,-4);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xbcc5b5,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=new THREE.Scene();environment.background=new THREE.Color(.65,.68,.7);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshBasicMaterial({color:0xffffff}));panel.position.set(-4,5,3);panel.lookAt(0,0,0);environment.add(panel);
  const map=pmrem.fromScene(environment);scene.environment=map.texture;pmrem.dispose();panel.geometry.dispose();panel.material.dispose();
  new ResizeObserver(()=>{const rect=$('stage').getBoundingClientRect();camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);if(model)frame(view);}).observe($('stage'));
  let last=performance.now();renderer.setAnimationLoop(now=>{update(manual?0:Math.min(.1,(now-last)/1000));last=now;});
}

function link(parent,label,url){
  if(!url)return;
  let checked;try{checked=new URL(url);}catch{return;}
  if(!['http:','https:'].includes(checked.protocol))return;
  const anchor=document.createElement('a');anchor.textContent=label;anchor.href=checked.href;anchor.target='_blank';anchor.rel='noopener noreferrer';parent.append(anchor);
}

async function jsonAt(path,optional=false){
  const response=await fetch(new URL(path,base),{cache:'no-store'});
  if(optional&&response.status===404)return null;
  if(!response.ok)throw new Error(`Could not read ${path} (${response.status}).`);
  return response.json();
}

function reviewURL(id,file){
  if(typeof file!=='string'||!file||file.includes('\\')||file.includes('%')||file.includes('?')||file.includes('#')||file.split('/').includes('..'))throw new Error('Review file must be a safe local GLB path.');
  const prefix=`${importsPath}${id}/review/`,url=new URL(file,base);
  if(!file.startsWith(prefix)||!file.toLowerCase().endsWith('.glb')||url.origin!==base.origin||!url.pathname.startsWith(new URL(prefix,base).pathname))throw new Error('Review file must be inside this candidate’s review folder.');
  return url;
}

async function candidateRow(candidate,descriptors){
  const row={candidate,receipt:null,review:null,reviewURL:null,ready:false,note:''};
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(candidate.id)){row.note='Invalid candidate ID.';return row;}
  try{
    const acquired=candidate.acquiredSource,receipt=acquired?await jsonAt(`${importsPath}${candidate.id}/provenance.json`,true):null;
    if(receipt){
      if(receipt.schemaVersion!==1||receipt.candidateId!==candidate.id||receipt.status!=='source-acquired'||!/^[a-f0-9]{64}$/.test(receipt.sha256)||!Number.isSafeInteger(receipt.bytes)||receipt.bytes<=0||typeof receipt.filename!=='string'||!receipt.filename||/[\\/]/.test(receipt.filename)||receipt.filename==='.'||receipt.filename==='..'||!acquired||receipt.sha256!==acquired.sha256||receipt.bytes!==acquired.bytes||receipt.filename!==acquired.filename||receipt.sourceUrl!==candidate.sourceUrl||receipt.creator!==candidate.creator||receipt.license!==candidate.license||receipt.licenseUrl!==candidate.licenseUrl)throw new Error('Public provenance does not match the approved source catalog.');
      row.receipt=receipt;
    }
  }catch(exc){row.note=exc.message;}
  const matches=descriptors.filter(entry=>entry?.candidateId===candidate.id);
  if(matches.length>1){row.note='Multiple preview descriptors need review.';return row;}
  if(!matches.length)return row;
  row.review=matches[0];
  try{
    const url=reviewURL(candidate.id,row.review.file);
    if(!row.receipt)throw new Error(row.note||'Verified public source provenance is required before previewing.');
    if(row.review.sourceSha256!==row.receipt.sha256)throw new Error('Preview source hash does not match the acquired source.');
    const response=await fetch(url,{method:'HEAD',cache:'no-store'});
    if(!response.ok)throw new Error('Prepared preview file is unavailable.');
    row.reviewURL=url;row.ready=true;
  }catch(exc){row.note=exc.message;}
  return row;
}

function renderCandidates(){
  $('candidates').replaceChildren();
  for(const row of rows){
    const {candidate}=row,card=document.createElement('article');card.className='candidate';card.dataset.candidate=candidate.id;card.dataset.selected=String(selected===candidate.id);
    const heading=document.createElement('h2');heading.textContent=candidate.name;card.append(heading);
    const credit=document.createElement('p');credit.className='credit';credit.textContent=`${candidate.creator||'Creator'} · ${candidate.license||'License unverified'}`;card.append(credit);
    const stages=document.createElement('div');stages.className='stages';
    for(const [text,kind] of [[row.receipt?'Source acquired':'Awaiting source',row.receipt?'acquired':''],[candidate.gamePreviewIdentity?'Game adaptation':row.ready?'Preview ready':'Preview pending',candidate.gamePreviewIdentity||row.ready?'ready':'']]){const tag=document.createElement('span');tag.className=`tag ${kind}`;tag.textContent=text;stages.append(tag);}card.append(stages);
    if(row.note){const note=document.createElement('p');note.className='note';note.textContent=row.note;card.append(note);}
    const actions=document.createElement('div');actions.className='actions';link(actions,'Creator’s page',candidate.sourceUrl);if(row.receipt)link(actions,'Provenance',new URL(`${importsPath}${candidate.id}/provenance.json`,base).href);
    if(candidate.gamePreviewIdentity&&/^[a-z0-9-]+$/.test(candidate.gamePreviewIdentity))link(actions,'View horse',new URL('breeds.html?horse='+candidate.gamePreviewIdentity,base).href);
    if(candidate.id==='wildmesh-white-western')link(actions,'White Western portrait',new URL(`${importsPath}thumbnails/white-western.webp`,base).href);
    if(row.ready){const button=document.createElement('button');button.textContent='Original preview';button.disabled=!renderer;button.dataset.open=candidate.id;button.onclick=()=>select(candidate.id);actions.append(button);}
    card.append(actions);$('candidates').append(card);
  }
  $('acquired-count').textContent=`Sources: ${rows.filter(row=>row.receipt).length} / ${rows.length}`;
  $('review-count').textContent=`Game previews: ${rows.filter(row=>row.candidate.gamePreviewIdentity).length}`;
  $('catalog-note').textContent=catalogError||'Creator pages show the originals. View horse opens the adapted, rigged model in the Breed Studio. Original files and diagnostic previews are retained locally.';
}

async function refresh(){
  const ticket=++refreshId;$('reload').disabled=true;catalogError=null;
  try{
    const catalog=await jsonAt(`${importsPath}catalog.json`);
    if(catalog.schemaVersion!==1||!Array.isArray(catalog.candidates))throw new Error('The approved source catalog has an unsupported format.');
    let descriptors=[];
    try{const review=await jsonAt(`${importsPath}review.json`,true);if(review){if(review.schemaVersion!==1||!Array.isArray(review.models))throw new Error('Preview descriptor has an unsupported format.');descriptors=review.models;}}catch(exc){catalogError=exc.message;}
    const next=await Promise.all(catalog.candidates.map(candidate=>candidateRow(candidate,descriptors)));
    if(ticket!==refreshId)return;rows=next;renderCandidates();document.documentElement.dataset.sourceOverview=String(!rows.some(row=>row.ready));
    if(!model){$('empty-message').textContent=renderer?(rows.some(row=>row.ready)?'Choose “View model” to inspect an available preview.':'No prepared previews yet. Source files will appear as acquired after their original files are registered.'):'3D previews require WebGL. Source and preview status remain available here.';}
  }catch(exc){if(ticket!==refreshId)return;catalogError=exc.message;error=exc.message;$('catalog-note').textContent=exc.message;$('empty-message').textContent='The model catalog could not be loaded. Serve this page through the local preview server and refresh.';}
  finally{if(ticket===refreshId)$('reload').disabled=false;}
}

function glbDocument(data){
  const bytes=new Uint8Array(data),header=new DataView(data);
  if(data.byteLength<20||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==data.byteLength)throw new Error('Prepared preview is not a valid GLB 2.0 file.');
  let offset=12,doc=null,first=true;
  while(offset<data.byteLength){
    if(offset+8>data.byteLength)throw new Error('Truncated GLB chunk.');
    const length=header.getUint32(offset,true),type=header.getUint32(offset+4,true);offset+=8;
    if(length%4||offset+length>data.byteLength||(first&&type!==0x4e4f534a))throw new Error('Invalid GLB chunk layout.');
    if(type===0x4e4f534a){if(doc)throw new Error('Duplicate GLB JSON chunk.');doc=JSON.parse(new TextDecoder().decode(bytes.subarray(offset,offset+length)));}
    offset+=length;first=false;
  }
  if(doc?.asset?.version!=='2.0')throw new Error('Prepared preview must contain a glTF 2.0 asset.');
  for(const entry of [...(doc.buffers||[]),...(doc.images||[])])if(entry.uri&&!entry.uri.startsWith('data:'))throw new Error('Preview must embed its buffers and textures; external dependencies are not loaded.');
  return doc;
}

function release(root){
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root?.traverse(node=>{if(!node.isMesh)return;geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);const saved=materialCache.get(node)||node.material;for(const material of Array.isArray(saved)?saved:[saved])if(material&&material!==clay&&material!==wire)materials.add(material);});
  for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
  for(const texture of textures)texture.dispose();for(const geometry of geometries)geometry.dispose();for(const skeleton of skeletons)skeleton.dispose?.();
}

function clearModel(){
  mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);if(wrapper)scene.remove(wrapper);release(model);
  if(helper){scene.remove(helper);helper.geometry.dispose();helper.material.dispose();}
  model=null;wrapper=null;mixer=null;action=null;helper=null;clips=[];restBounds=null;materialCache.clear();selected=null;
  for(const element of document.querySelectorAll('.inspect button,.inspect select,.inspect input'))element.disabled=true;
  $('clip').replaceChildren(new Option('Original pose',''));$('timeline').value='0';$('time').textContent='0.00 / 0.00 s';
}

async function select(id){
  const row=rows.find(entry=>entry.candidate.id===id);if(!row?.ready||!renderer)return;
  const ticket=++requestId;clearModel();loading=true;error=null;$('empty').hidden=false;$('empty-message').textContent='Loading prepared preview…';$('status').textContent='';
  try{
    const response=await fetch(row.reviewURL,{cache:'no-store'});if(!response.ok)throw new Error(`Preview request failed (${response.status}).`);
    const data=await response.arrayBuffer();glbDocument(data);
    const loaded=await reviewLoader().parseAsync(data,'');
    if(ticket!==requestId){release(loaded.scene);return;}
    loaded.scene.updateMatrixWorld(true);const originalBounds=new THREE.Box3().setFromObject(loaded.scene),size=originalBounds.getSize(new THREE.Vector3());
    if(originalBounds.isEmpty()||!size.toArray().every(Number.isFinite)||Math.max(...size.toArray())<=0){release(loaded.scene);throw new Error('Preview has no finite visible geometry.');}
    model=loaded.scene;wrapper=new THREE.Group();wrapper.add(model);const scale=3/Math.max(...size.toArray()),center=originalBounds.getCenter(new THREE.Vector3());wrapper.scale.setScalar(scale);wrapper.position.set(-center.x*scale,-originalBounds.min.y*scale,-center.z*scale);scene.add(wrapper);wrapper.updateMatrixWorld(true);
    model.traverse(node=>{if(node.isMesh){materialCache.set(node,node.material);node.frustumCulled=false;}});
    restBounds=new THREE.Box3().setFromObject(wrapper);clips=loaded.animations||[];mixer=clips.length?new THREE.AnimationMixer(model):null;helper=new THREE.SkeletonHelper(model);helper.visible=false;helper.material.depthTest=false;helper.renderOrder=2;scene.add(helper);
    selected=id;paused=false;$('surface').value='original';$('bones').setAttribute('aria-pressed','false');$('play').textContent='Pause';$('play').setAttribute('aria-pressed','false');$('speed').value='1';
    $('clip').replaceChildren(new Option(clips.length?'Original pose':'No animation clips',''));clips.forEach((clip,index)=>$('clip').add(new Option(`${clip.name||`Clip ${index+1}`} (${clip.duration.toFixed(2)} s)`,String(index))));
    for(const element of document.querySelectorAll('.views button,.views select'))element.disabled=false;
    $('clip').disabled=!clips.length;
    $('model-name').textContent=row.review.label||row.candidate.name;$('model-description').textContent=row.review.notes||'Original materials, rig and animation clips shown independently of the ranch movement system.';
    const meshCount=[...materialCache].length,joints=new Set();model.traverse(node=>{if(node.skeleton)for(const bone of node.skeleton.bones)joints.add(bone);});
    $('details').replaceChildren(document.createTextNode(`${row.candidate.creator} · ${row.candidate.license} · ${meshCount} meshes · ${joints.size} skin joints · ${clips.length} original clips · `));link($('details'),'Source',row.candidate.sourceUrl);if(row.candidate.licenseUrl){$('details').append(document.createTextNode(' · '));link($('details'),'License',row.candidate.licenseUrl);}$('details').append(document.createTextNode(' · Source preview; adapted game rigs are reviewed separately.'));
    loading=false;$('empty').hidden=true;renderCandidates();frame('quarter');
  }catch(exc){if(ticket!==requestId)return;loading=false;error=exc.message;clearModel();$('empty').hidden=false;$('empty-message').textContent=`Preview unavailable: ${exc.message}`;renderCandidates();}
}

function frame(kind=view){
  if(!wrapper)return;view=kind;wrapper.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(wrapper);
  const size=bounds.getSize(new THREE.Vector3()),target=bounds.getCenter(new THREE.Vector3()),radius=Math.max(size.length()/2,.05);
  const vertical=THREE.MathUtils.degToRad(camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect),distance=radius/Math.sin(Math.min(vertical,horizontal)/2)*1.15;
  controls.target.copy(target);controls.minDistance=radius*.3;controls.maxDistance=Math.max(distance*8,10);camera.near=Math.max(.001,distance/1000);camera.far=Math.max(100,distance*30);camera.updateProjectionMatrix();camera.position.copy(target).add(viewVectors[kind].clone().normalize().multiplyScalar(distance));controls.update();
  for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===kind));
}

function chooseClip(){
  mixer?.stopAllAction();const value=$('clip').value,clip=value===''?null:clips[Number(value)];action=clip?mixer.clipAction(clip).reset().setLoop(THREE.LoopRepeat,Infinity).play():null;mixer?.update(0);paused=false;$('play').textContent='Pause';$('play').setAttribute('aria-pressed','false');
  for(const id of ['play','reset','speed','timeline'])$(id).disabled=!action;$('timeline').max=String(Math.max(clip?.duration||0,.001));syncTimeline();
}

function syncTimeline(){const duration=action?.getClip().duration||0,time=action?.time||0;$('timeline').value=String(time);$('time').textContent=`${time.toFixed(2)} / ${duration.toFixed(2)} s`;}
function update(dt){if(!renderer||document.documentElement.dataset.sourceOverview==='true')return;if(action&&!paused)mixer.update(dt*Number($('speed').value));helper?.updateMatrixWorld(true);syncTimeline();renderer.render(scene,camera);}

$('reload').onclick=refresh;for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>frame(button.dataset.view);$('fit').onclick=()=>frame(view);
$('surface').onchange=()=>{for(const [mesh,original] of materialCache)mesh.material=$('surface').value==='clay'?clay:$('surface').value==='wire'?wire:original;};
$('bones').onclick=()=>{if(!helper)return;helper.visible=!helper.visible;$('bones').setAttribute('aria-pressed',String(helper.visible));};
$('clip').onchange=chooseClip;$('play').onclick=()=>{paused=!paused;$('play').textContent=paused?'Play':'Pause';$('play').setAttribute('aria-pressed',String(paused));};
$('reset').onclick=()=>{action?.reset().play();mixer?.update(0);syncTimeline();};$('timeline').oninput=()=>{if(!action)return;action.time=Number($('timeline').value);mixer.update(0);paused=true;$('play').textContent='Play';$('play').setAttribute('aria-pressed','true');syncTimeline();};

try{initializeStudio();}catch(exc){error=exc.message;$('empty-message').textContent='3D previews require WebGL. Source and preview status remain available here.';}
window.advanceTime=ms=>{manual=true;update(ms/1000);};
window.render_game_to_text=()=>JSON.stringify({mode:'imported model review',selected,loading,modelReady:!!model,error,catalogError,view,surface:$('surface').value,skeletonVisible:!!helper?.visible,animations:clips.map(clip=>({name:clip.name,duration:clip.duration})),animationIndex:action?clips.indexOf(action.getClip()):null,animationTime:action?.time||0,paused,speed:Number($('speed').value),candidates:rows.map(row=>({id:row.candidate.id,sourceAcquired:!!row.receipt,reviewReady:row.ready,gamePreviewIdentity:row.candidate.gamePreviewIdentity||null,note:row.note})),bounds:restBounds?[restBounds.min.toArray(),restBounds.max.toArray()]:null,camera:camera?.position.toArray(),target:controls?.target.toArray(),triangles:renderer?.info.render.triangles||0,previewScope:rows.some(row=>row.ready)?'original-source':'source-overview-with-game-links',gameCompatibility:'separate-derivative-reports'});
window.horseImportReview={select,refresh,frame,get scene(){return scene;},get model(){return model;},get renderer(){return renderer;}};
await refresh();
const initialCandidate=new URLSearchParams(location.search).get('candidate');
if(initialCandidate)await select(initialCandidate);
