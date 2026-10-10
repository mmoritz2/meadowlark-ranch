// Appended inside production Studio; experimental attachment is local and opt-in.
import {applyNativeCollarAttachment} from '/assets/native-collar-attachment.js';
import {validateNativeGroomRig} from '/assets/native-groom-layer.mjs';
const qaRoot=document.createElement('div');qaRoot.id='draftReview';qaRoot.innerHTML=`<h1>Draft front check</h1><p>Production loader, native skeleton and motion. Fixed phase snapshots; no save or multiplayer.</p><label>Horse<select id="qaBreed"><option value="shire">Shire</option><option value="percheron">Percheron</option><option value="clyde">Clydesdale</option></select></label><label>Attachment<select id="qaAttachment"><option value="released">Current build</option><option value="candidate">Candidate (local only)</option></select></label><label>View<select id="qaView"><option value="front">Front</option><option value="quarter">Front quarter</option><option value="quarterRight">Opposite front quarter</option></select></label><label>Motion<select id="qaMotion"><option value="rest">Rest</option><option value="walk">Walk</option><option value="trot">Trot</option><option value="canter">Canter</option><option value="gallop">Gallop</option><option value="jump">Jump</option></select></label><label>Lead<select id="qaLead"><option value="left">Left</option><option value="right">Right</option></select></label><label>Surface<select id="qaSurface"><option value="coat">Natural coat</option><option value="clay">High-contrast clay</option><option value="clay-tack">Clay body, natural tack</option></select></label><label>Clip phase <output id="qaPhaseLabel">0%</output><input id="qaPhase" type="range" min="0" max="99" step="1" value="0"></label><div class="qa-phases">${[0,25,50,75,95].map(n=>`<button data-phase="${n}">${n}%</button>`).join('')}</div><button id="qaCapture">Refresh snapshot report</button><p id="qaStatus" role="status">Loading production Shire…</p><pre id="qaReport">Preparing native rig…</pre>`;document.querySelector('aside').prepend(qaRoot);
const qaErrors=[];let qaBusy=false,qaSimulatedSeconds=0,qaPhaseRequested=0,qaNaturalTack=[],qaPreview=null;
window.addEventListener('error',e=>{qaErrors.push(String(e.error?.message||e.message));$('qaStatus').textContent=qaErrors.at(-1);});window.addEventListener('unhandledrejection',e=>{qaErrors.push(String(e.reason?.message||e.reason));$('qaStatus').textContent=qaErrors.at(-1);});
function qaView(){headView=false;headTracking=null;controls.autoRotate=false;controls.resetMotion();const direction=$('qaView').value==='front'?new THREE.Vector3(0,.10,1):new THREE.Vector3($('qaView').value==='quarterRight'?.72:-.72,.13,.69);fitBodyCamera(direction);}
function qaSurface(){
 const mode=$('qaSurface').value,clay=mode!=='coat';$('surface').value=clay?'clay':'coat';clayMaterial.color.set('#8e9aa2');clayMaterial.roughness=.78;scene.background.set(clay?'#35404a':'#d8d9d2');scene.fog.color.copy(scene.background);floor.material.color.set(clay?'#596570':'#b4b8aa');surface();
 qaNaturalTack=[];if(mode==='clay-tack'){
  const profile=instance.profile,names=new Set((profile.nativeVariant?.meshes||[]).filter(r=>r.meshIndex===3||r.meshIndex===4||r.vertexCount===profile.tackVertexCount).map(r=>r.name));
  for(const [mesh,material]of originals)if(names.has(mesh.name)||mesh.geometry?.attributes.position?.count===profile.tackVertexCount){mesh.material=material;qaNaturalTack.push(mesh.name);}
 }
 document.querySelector('.caption').style.color=clay?'#eef2e9':'#22352d';for(const e of document.querySelectorAll('.caption .eyebrow,#traits'))e.style.color=clay?'#d4ded5':'#59665c';
}
function qaReport(){
 if(!horse||loading)return;const check=window.breedStudioInspect(),variant=instance?.profile?.nativeVariant;
 let loadedCollar=null;instance?.nativeRoot?.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.userData.nativeCollarAttachment)loadedCollar=o.geometry.userData.nativeCollarAttachment;});
 const report={productionAttachment:loadedCollar,source:'Production breeds.html with fixture-only UI and deterministic native motion sampling',studioSourceSha256:QA_STUDIO_SOURCE_SHA,breed:selectedKey,attachment:qaPreview,view:$('qaView').value,surface:$('qaSurface').value,naturalTackMeshes:qaNaturalTack,motion:$('qaMotion').value,lead:$('qaLead').value,requestedPhase01:qaPhaseRequested,snapshotTimeS:qaSimulatedSeconds,paused,animation:check.animation,finite:check.finite,bones:check.bones,vertices:check.vertices,bounds:check.bounds,variant:{file:variant?.file,sha256:variant?.sha256,coatSha256:variant?.coat?.sha256,geometryHash:assetInfo?.geometryHash,sourceSha256:assetInfo?.sha256},camera:{position:camera.position.toArray(),target:controls.target.toArray()},errors:[...qaErrors]};
 $('qaReport').textContent=JSON.stringify(report,null,2);$('qaStatus').textContent=(check.finite?'Finite native pose':'NON-FINITE pose')+' · '+check.bones+' bones · '+selectedKey+' · '+$('qaMotion').value+' '+Math.round(qaPhaseRequested*100)+'%';
}
function qaPose(){
 if(qaBusy||loading||!motion)return;setPaused(true);studioRepeatArmed=false;$('repeat-action').setAttribute('aria-pressed','false');$('playback').value='1';const mode=$('qaMotion').value,lead=$('qaLead').value,profile=instance.profile;
 motion.reset();motion.set(mode,{lead});
 // Settle the production transition at clip time zero, then sample its own update path.
 motion.update(.25,{rate:0});groom?.update(.25,motion.state);qaPhaseRequested=Number($('qaPhase').value)/100;$('qaPhaseLabel').textContent=Math.round(qaPhaseRequested*100)+'%';
 const duration=mode==='rest'?0:mode==='jump'?profile.nativeJump.durationS:profile.nativeGaits[['canter','gallop'].includes(mode)?mode+(lead==='right'?'Right':'Left'):mode].durationS;
 qaSimulatedSeconds=duration*qaPhaseRequested;for(let remaining=qaSimulatedSeconds;remaining>1e-8;){const dt=Math.min(remaining,1/120);simulate(dt);remaining-=dt;}
 if(horse)horse.position.y=(motion.state.bodyLiftM||0)*(instance.scene.getWorldScale(new THREE.Vector3()).y||1);horse.updateMatrixWorld(true);qaSurface();qaView();draw();qaReport();
}
async function qaSelect(){
 if(qaBusy)return;qaBusy=true;setPaused(true);for(const e of qaRoot.querySelectorAll('button,select,input'))e.disabled=true;
 try{await select($('qaBreed').value);if(loading||selectedKey!==$('qaBreed').value)throw Error('Production horse load did not complete.');setPaused(true);qaPreview=null;
  if($('qaAttachment').value==='candidate'){
   const prefix='/review/draft-front-check/attachment-preview/'+selectedKey,metaResponse=await fetch(prefix+'.json',{cache:'no-store'});if(!metaResponse.ok)throw Error('No local candidate packed for '+selectedKey);const meta=await metaResponse.json();
   const response=await fetch(prefix+'.bin',{cache:'no-store'});if(!response.ok)throw Error('Missing local candidate binary');if(meta.baselineSha256!==instance.profile.nativeVariant.sha256)throw Error('Candidate baseline differs from this production model; review current production instead.');const binary=await response.arrayBuffer();let tack;instance.nativeRoot.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count===13895)tack=o;});
   const diagnostic=applyNativeCollarAttachment({THREE,mesh:tack,record:meta.record,binary,profile:instance.profile}),groomCheck=validateNativeGroomRig({nativeRoot:instance.nativeRoot,profile:instance.profile});if(!groomCheck.eligible)throw Error('Candidate breaks native groom: '+groomCheck.reason);
   qaPreview={...diagnostic,candidate:meta.candidate,previewSha256:meta.previewSha256,baselineSha256:meta.baselineSha256,groomEligible:groomCheck.eligible};
  }
 }
 catch(e){qaErrors.push(String(e?.message||e));$('qaStatus').textContent='Load failed: '+String(e?.message||e);}
 finally{qaBusy=false;for(const e of qaRoot.querySelectorAll('button,select,input'))e.disabled=false;qaPose();}
}
$('qaBreed').onchange=qaSelect;$('qaAttachment').onchange=qaSelect;for(const id of ['qaView','qaMotion','qaLead','qaSurface'])$(id).onchange=qaPose;
$('qaPhase').oninput=()=>{$('qaPhaseLabel').textContent=$('qaPhase').value+'%';};$('qaPhase').onchange=qaPose;qaRoot.querySelectorAll('[data-phase]').forEach(b=>{b.onclick=()=>{$('qaPhase').value=b.dataset.phase;qaPose();};});$('qaCapture').onclick=()=>{draw();qaReport();};
await catalog;await qaSelect();
