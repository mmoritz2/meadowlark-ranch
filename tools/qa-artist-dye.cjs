// Exercise actual paid grooming UI and saved inheritance in a separate browser.
// No connection to the user's browser, account, or localStorage is made.
const {chromium}=require('C:/Users/msmor/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const out=path.resolve(process.argv[2]||'output/artist-dye');fs.mkdirSync(out,{recursive:true});
const injection=`window.__artistDyeQA={
 fixture(){
  syncSave(s=>{const original=JSON.parse(JSON.stringify(s.horses[0]));const b=BREEDS3.find(b=>b[0]==='pinto');
   const make=(id,name)=>({...JSON.parse(JSON.stringify(original)),id,name,breed:'pinto',colors:{body:b[5],mane:b[6]},horn:false,wings:false,dragon:false,rainbow:false,coat:null,foal:false,tack:null,out:true,bareback:false,mark:undefined,markCol:undefined,tailCol:null});
   const a=make(9001,'Dye target'),n=make(9002,'Unchanged neighbor'),f=make(9003,'Inherited foal');
   f.foal=true;f.born=Date.now();f.colors={body:'#8d719b',mane:'#e8b4c8'};f.tailCol='#3b6fd6';f.mark='leopard';f.markCol='#3a2a1e';
   s.horses=[a,n,f];s.coins=5000;s.nextId=9004;s.ridingHorseId=9001;
  });rideIdx=0;reloadHorses();refreshWallet();
 },
 ready(expected='pinto'){return RIG.ready&&!RIG.loadingBreed&&RIG.modelKey===expected&&herd.length===2&&herd.every(a=>a.rig&&a.rig.skin);},
 patternFixture(){syncSave(s=>{const b=BREEDS3.find(b=>b[0]==='chestnut');s.horses.forEach((h,i)=>{h.breed='chestnut';h.colors={body:b[5],mane:b[6]};h.tailCol=null;delete h.mark;delete h.markCol;h.foal=i===1;h.born=i===1?Date.now():undefined;});s.horses[1].mark='roan';s.horses[1].markCol=b[7].markCol;});rideIdx=0;reloadHorses();},
 fantasyFixture(){syncSave(s=>{const b=BREEDS3.find(b=>b[0]==='aether');s.horses.forEach((h,i)=>{h.breed='aether';h.colors={body:b[5],mane:b[6]};h.coat='galaxy';h.tailCol=null;delete h.mark;delete h.markCol;h.foal=i===1;h.born=i===1?Date.now():undefined;});s.horses[1].mark='none';});rideIdx=0;reloadHorses();},
 settle(){advanceTime(0);hidePanels();dayT=.34;weather.mode='clear';weather.timer=9999;player.speed=0;player.y=0;player.vy=0;player.heading=0;player.mesh.rotation.set(0,0,0);RIG.heroMotion?.set('rest');for(const a of herd)a.rig?.heroMotion?.set('rest');},
 horse(id){if(myHorses[rideIdx]?.id===id)return{rig:RIG,group:player.mesh,h:myHorses[rideIdx]};const a=herd.find(a=>myHorses[a.idx]?.id===id);return a?{rig:a.rig,group:a.parts.group,h:myHorses[a.idx]}:null;},
 material(m){
  const primitive=(v,depth=0)=>{if(v==null||typeof v==='boolean'||typeof v==='number'||typeof v==='string')return v;if(v.isColor)return '#'+v.getHexString();if(v.isVector2||v.isVector3||v.isVector4)return v.toArray();if(depth>3)return null;if(Array.isArray(v)&&v.length<20)return v.map(x=>primitive(x,depth+1));if(typeof v==='object'&&!v.isTexture){const r={};for(const[k,x]of Object.entries(v)){if(['shader','uniforms','material','map','normalMap'].includes(k))continue;const a=primitive(x,depth+1);if(a!==null)r[k]=a;}return r;}return null;};
  const uniform={};for(const[k,u]of Object.entries(m.userData.shader?.uniforms||{}))if(/coat|dye|mark|tail|mane|personal|baseLum|uTint|uBlend/i.test(k))uniform[k]=primitive(u.value);
  return{name:m.name,color:'#'+m.color.getHexString(),data:primitive(m.userData),uniform};
 },
 state(id){const item=this.horse(id);if(!item)return null;const {rig,group,h}=item;const hair=[];rig.scene.traverse(o=>{if(o.isMesh&&(/groom|feather/i.test(o.name)||/groom/i.test(o.parent?.name||'')))for(const m of Array.isArray(o.material)?o.material:[o.material])hair.push(this.material(m));});
  const neighbor=this.horse(9002);return{horse:JSON.parse(JSON.stringify(h)),body:this.material(rig.skin.material),hair,fantasy:{hasCustomCoat:!!rig.coatMat,theme:rig.fantasyAppearance?.theme||null,usesFantasyMaterial:rig.skin.material===rig.fantasyAppearance?.material||rig.skin.material===rig.fantasyMaterial,animated:typeof rig.skin.material.userData.update==='function'},bodyMaterialUUID:rig.skin.material.uuid,privateFromNeighbor:id===9002||rig.skin.material!==neighbor?.rig.skin.material,scale:group.scale.toArray(),finite:rig.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};
 },
 async render(id){
  this.settle();const item=this.horse(id);if(!item)throw Error('Missing fixture horse '+id);const {rig,group}=item;
  const originalGroupPosition=group.position.clone(),originalGroupQuaternion=group.quaternion.clone();group.position.set(-3,0,-3);group.quaternion.identity();scene.updateMatrixWorld(true);rig.heroMotion?.set('rest');scene.updateMatrixWorld(true);rig.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const bounds=new THREE.Box3().setFromObject(rig.scene,true),center=bounds.getCenter(new THREE.Vector3()),height=bounds.getSize(new THREE.Vector3()).y;
  const visible=[];scene.traverse(o=>{if(o.isMesh||o.isSprite||o.isPoints){visible.push([o,o.visible]);let q=o,inside=false;while(q){if(q===rig.scene){inside=true;break;}q=q.parent;}o.visible=inside&&o.visible;}});
  const background=scene.background,fog=scene.fog,position=camera.position.clone(),quaternion=camera.quaternion.clone();scene.background=new THREE.Color('#d9dedb');scene.fog=null;
  const inverse=new THREE.Quaternion();group.getWorldQuaternion(inverse);const offset=new THREE.Vector3(-1.5*height,.24*height,.99*height).applyQuaternion(inverse);camera.position.copy(center).add(offset);camera.lookAt(center);camera.updateMatrixWorld(true);renderer.render(scene,camera);
  const url=renderer.domElement.toDataURL('image/png');for(const[o,v]of visible)o.visible=v;scene.background=background;scene.fog=fog;camera.position.copy(position);camera.quaternion.copy(quaternion);group.position.copy(originalGroupPosition);group.quaternion.copy(originalGroupQuaternion);scene.updateMatrixWorld(true);return url;
 },
 style(){openShop('style');},saved(){return freshSave();}
};const MERGE_STATS=mergeStatics();`;

async function diff(a,b){const pa=await sharp(a).removeAlpha().raw().toBuffer({resolveWithObject:true}),pb=await sharp(b).removeAlpha().raw().toBuffer({resolveWithObject:true});if(pa.data.length!==pb.data.length)throw Error('Different capture sizes');let changed=0,sum=0;for(let i=0;i<pa.data.length;i+=3){let d=0;for(let j=0;j<3;j++)d+=Math.abs(pa.data[i+j]-pb.data[i+j]);sum+=d;if(d>24)changed++;}return{changedPixels:changed,meanChannelDifference:sum/pa.data.length,pixels:pa.data.length/3};}
function comparable(state){const body=structuredClone(state.body);if(body.data?.bodyAxes)delete body.data.bodyAxes.report;return JSON.stringify({body,hair:state.hair,colors:state.horse.colors,mark:state.horse.mark,markCol:state.horse.markCol,tailCol:state.horse.tailCol});}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});const checks={},errors=[],states=[],payments=[],report={checks,errors,states,payments};
 await page.addInitScript(()=>addEventListener('error',e=>{window.__dyeRuntimeError=e.message;}));
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/ranch3d.html*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('ranch3d.html','utf8').replace('const MERGE_STATS=mergeStatics();',injection)}));
 const ready=async(expected='pinto')=>{await page.evaluate(()=>resumeGame());await page.waitForFunction(k=>window.__artistDyeQA?.ready(k),expected,{timeout:120000});await page.waitForTimeout(100);await page.evaluate(()=>__artistDyeQA.settle());};
 const capture=async(name,id=9001)=>{const data=await page.evaluate(id=>__artistDyeQA.render(id),id),file=path.join(out,name+'.png');fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'));return file;};
 const state=async(id=9001)=>page.evaluate(id=>__artistDyeQA.state(id),id);
 try{
  await page.goto('http://127.0.0.1:8431/ranch3d.html?qa=artist-dye',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__dyeRuntimeError||(window.__artistDyeQA&&window.render_game_to_text&&JSON.parse(render_game_to_text()).graphics.horseReady),null,{timeout:120000});const startupError=await page.evaluate(()=>window.__dyeRuntimeError);if(startupError)throw Error(startupError);
  await page.evaluate(()=>__artistDyeQA.fixture());await ready();
  const baseline=await capture('00-pinto-default'),repeat=await capture('00-pinto-repeat');report.repeatDiff=await diff(baseline,repeat);checks.deterministicCapture=report.repeatDiff.changedPixels===0;
  const neighborImage=await capture('00-neighbor-default',9002),foalImage=await capture('00-inherited-foal',9003);
  const before=await state(),neighborBefore=await state(9002),foalBefore=await state(9003);states.push({stage:'before',selected:before,neighbor:neighborBefore,foal:foalBefore});
  checks.privateClonedMaterials=before.privateFromNeighbor&&foalBefore.privateFromNeighbor;checks.foalSmaller=foalBefore.scale[0]<before.scale[0]*.7;checks.foalCustomBody=JSON.stringify(foalBefore.body).includes('#8d719b');checks.foalInheritedMark=JSON.stringify(foalBefore.body).includes('6')&&foalBefore.horse.mark==='leopard';
  let previous=baseline,index=0;
  for(const [what,value]of [['body','#26262e'],['mane','#e8b4c8'],['tail','#3b6fd6'],['mark','#ffd9a0']]){
   await page.evaluate(()=>__artistDyeQA.style());const coinsBefore=await page.evaluate(()=>__artistDyeQA.saved().coins);
   await page.locator('[data-dye="'+what+':'+value+'"]').click();await ready();const coinsAfter=await page.evaluate(()=>__artistDyeQA.saved().coins);
   const file=await capture(String(++index).padStart(2,'0')+'-'+what),selected=await state(),neighbor=await state(9002),foal=await state(9003),difference=await diff(previous,file);
   payments.push({what,value,coinsBefore,coinsAfter,charge:coinsBefore-coinsAfter,difference});states.push({stage:what,selected,neighbor,foal});
   checks[what+'Exact120Charge']=coinsBefore-coinsAfter===120;checks[what+'VisiblePixelChange']=difference.changedPixels>200&&difference.meanChannelDifference>.03;checks[what+'NeighborUnchanged']=comparable(neighbor)===comparable(neighborBefore);checks[what+'FoalUnchanged']=comparable(foal)===comparable(foalBefore);checks[what+'Finite']=selected.finite;
   const active=what==='body'?selected.body:what==='mark'?selected.body:selected.hair;checks[what+'UniformChanged']=JSON.stringify(active).includes(value);
   previous=file;console.log(what,JSON.stringify(payments.at(-1)));
  }
  report.savedAfter=await page.evaluate(()=>__artistDyeQA.saved());const finalBeforeReload=await state();
  checks.savedExpectedColors=report.savedAfter.horses[0].colors.body==='#26262e'&&report.savedAfter.horses[0].colors.mane==='#e8b4c8'&&report.savedAfter.horses[0].tailCol==='#3b6fd6'&&report.savedAfter.horses[0].markCol==='#ffd9a0';checks.total480Charge=report.savedAfter.coins===4520;
  await page.reload({waitUntil:'load',timeout:120000});await ready();const reloaded=await capture('05-reloaded'),reloadState=await state();states.push({stage:'reloaded',selected:reloadState,neighbor:await state(9002),foal:await state(9003)});
  report.reloadDiff=await diff(previous,reloaded);checks.reloadKeepsUniforms=comparable(reloadState)===comparable(finalBeforeReload);checks.reloadKeepsVisuals=report.reloadDiff.meanChannelDifference<1.5;checks.reloadCoinsUnchanged=(await page.evaluate(()=>__artistDyeQA.saved().coins))===4520;
  const neighborAfter=await capture('05-neighbor-unchanged',9002);report.neighborDiff=await diff(neighborImage,neighborAfter);checks.neighborPixelsUnchanged=report.neighborDiff.meanChannelDifference<1.5;
  // Explicit inheritance must apply even when the saved mark equals the older
  // catalog default but differs from the newly authored coat (Shetland roan).
  await page.evaluate(()=>__artistDyeQA.patternFixture());await ready('chestnut');
  const defaultShetlandImage=await capture('06-shetland-default',9001),roanShetlandImage=await capture('06-shetland-inherited-roan',9002),duplicateShetlandImage=await capture('06-shetland-default-neighbor',9003);
  const defaultShetland=await state(9001),roanShetland=await state(9002),duplicateShetland=await state(9003);report.explicitMark={default:defaultShetland,foal:roanShetland,duplicate:duplicateShetland,difference:await diff(defaultShetlandImage,roanShetlandImage),defaultDifference:await diff(defaultShetlandImage,duplicateShetlandImage)};
  checks.defaultShetlandKeepsAuthoredMaterial=defaultShetland.body.data.artist!==true&&duplicateShetland.body.data.artist!==true;
  checks.explicitMatchingCatalogRoanApplied=roanShetland.horse.foal&&roanShetland.horse.mark==='roan'&&roanShetland.body.data.mark===4&&roanShetland.body.uniform.uMark===4;
  checks.explicitRoanVisible=report.explicitMark.difference.changedPixels>1000;
  checks.unmarkedShetlandsMatch=report.explicitMark.defaultDifference.meanChannelDifference<1.5;
  await page.evaluate(()=>__artistDyeQA.fantasyFixture());await ready('aether');await capture('07-aether-foal-no-ordinary-mark',9002);report.fantasyFoal={adult:await state(9001),foal:await state(9002)};
  checks.fantasyFoalNoneKeepsMagic=report.fantasyFoal.foal.horse.mark==='none'&&report.fantasyFoal.foal.fantasy.theme==='galaxy'&&report.fantasyFoal.foal.fantasy.usesFantasyMaterial&&report.fantasyFoal.foal.fantasy.animated&&!report.fantasyFoal.foal.fantasy.hasCustomCoat;
  checks.noErrors=errors.length===0;
 }catch(error){report.failure=error.stack;checks.completed=false;console.error(error);}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({checks,errors}));if(Object.values(checks).some(v=>!v))process.exitCode=1;
})();
