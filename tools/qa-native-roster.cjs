/* Actual game roster coverage, material isolation, saved coat edits, and rigged
 * mount swaps. Runs in a temporary browser save, never the player's session. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[],report={};
 fs.mkdirSync(path.join(__dirname,'../review/native-roster'),{recursive:true});
 page.on('pageerror',error=>{errors.push(error.message);console.error('Page error:',error.message);});
 page.on('console',message=>{if(message.type()==='error'&&/Shader Error|VALIDATE_STATUS|ERROR: 0:/.test(message.text()))errors.push(message.text());});
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=native-roster',{timeout:120000});
  await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&__features.horse.RIG().ready,null,{timeout:120000});
  report.roster=await page.evaluate(async()=>{
   const G=__features,library=G.horse.breedModels;await library.manifestReady;
   return G.tables.BREEDS3.map(row=>{const p=library.profile(row[0]);return {key:row[0],resolved:library.resolve(row[0]),id:p?.id,native:!!p?.nativeBreed,kind:p?.nativeKind,joints:p?.jointCount,roster:!!p?.nativeRoster,gaits:Object.keys(p?.nativeGaits||{}),jump:!!p?.nativeJump};});
  });
  assert(report.roster.length>=85,'Feature-added breeds must remain in the real roster');
  for(const row of report.roster){
   assert(row.native,row.key+' still uses an old horse model');
   assert.equal(row.id,row.key,row.key+' profile identity');
   assert.equal(row.resolved,row.key,row.key+' must not silently resolve to a different breed');
   if(['black-dragon-native','european-dragon'].includes(row.key))continue;
   assert.equal(row.joints,677,row.key+' skeleton');assert(row.jump,row.key+' jump');
   for(const gait of ['walk','trot','canterLeft','canterRight','gallopLeft','gallopRight'])assert(row.gaits.includes(gait),row.key+' missing '+gait);
  }
  console.log('Native roster coverage:',report.roster.length);
  report.mounts=[];
  for(const key of (process.env.QA_HORSES?.split(',')||['bay','chestnut','shire','pegasus','opaline','firefly','lumen','larksong'])){
   const index=await page.evaluate(key=>{
    const G=__features;G.save.sync(save=>G.horse.grantHorse(save,key,{name:'Roster QA'}));G.horse.reloadHorses();G.horse.rebuildAll();G.hidePanels();return G.horse.myHorses.findIndex(horse=>horse.breed===key);
   },key);
   await page.selectOption('#horseSel',String(index),{force:true});
   await page.waitForFunction(key=>{const G=__features,r=G.horse.RIG();return r.requestedBreed===key&&!r.loadingBreed&&r.ready&&r.attachedTo===G.horse.player.mesh;},key,{timeout:90000});
   const row=await page.evaluate(()=>{
    const G=__features,r=G.horse.RIG();advanceTime(200);
    return {key:r.requestedBreed,model:r.modelKey,native:!!r.profile.nativeBreed,bones:r.bones.length,finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),seat:G.horse.nativeRiderInspect?.(),material:r.skin.material.name,appearance:r.nativeCustomization?.applied};
   });
   assert(row.native);assert.equal(row.bones,677,key);assert(row.finite,key);assert(row.seat?.contact?.seat.every(Number.isFinite),key+' rider seat');
   report.mounts.push(row);console.log('Mounted',key);
  }
  report.customization=await page.evaluate(async()=>{
   const G=__features,r=G.horse.RIG(),THREE=G.THREE;
   const {configureNativeCustomization}=await import('/assets/native-horse-customization.js');
   const row=G.tables.BREEDS3.find(b=>b[0]===r.requestedBreed),defaults={id:515,breed:row[0],colors:{body:row[5],mane:row[7]?.maneCol||row[6]},mark:row[7]?.mark||'none',markCol:row[7]?.markCol||'#f2ece0'};
   const before=r.skin.geometry.attributes.position.array.slice(),bones=r.bones.map(b=>b.quaternion.toArray()),base=r.baseMat,map=base.map;
   const normal=configureNativeCustomization({THREE,rig:r,horse:defaults,defaults:row});
   const alias=!!r.profile.nativeRosterAlias&&!r.fantasyAppearance;
   const unchanged=alias?(normal.applied.body&&normal.applied.mane&&normal.material?.userData.nativeRosterCoat.nrCoat.value.getHexString()===new THREE.Color(row[5]).getHexString()):(!normal.applied.body&&!normal.applied.mane&&!normal.applied.tail);
   const customized={...defaults,colors:{body:'#7c452b',mane:'#e0ba72'},mark:'pinto',mark2:'stockings',markCol:'#eee4d5',tailCol:'#322318'};
   const custom=configureNativeCustomization({THREE,rig:r,horse:customized,defaults:row});
   const matrixUntouched=r.bones.every((b,i)=>b.quaternion.toArray().every((v,j)=>v===bones[i][j]));
   const positionsUntouched=before.every((v,i)=>v===r.skin.geometry.attributes.position.array[i]);
   const isolated=r.skin.material!==base&&base.map===map;
   const hair=custom.hair.map(entry=>({tailMaskRange:[Math.min(...entry.mesh.geometry.attributes.nativeTailDye.array),Math.max(...entry.mesh.geometry.attributes.nativeTailDye.array)],uniforms:entry.materials.map(material=>{const u=material.userData.nativeRosterHair;return{mane:u.nrMane.value.getHexString(),tail:u.nrTail.value.getHexString(),maneOn:u.nrManeOn.value,tailOn:u.nrTailOn.value};})}));
   advanceTime(20);
   return {unchanged,matrixUntouched,positionsUntouched,isolated,hair,applied:custom.applied};
  });
  for(const key of ['unchanged','matrixUntouched','positionsUntouched','isolated'])assert(report.customization[key],key);
  assert(report.customization.hair.length,'Native hair mesh found');
  assert(report.customization.hair.every(h=>h.tailMaskRange[0]===0&&h.tailMaskRange[1]>.95),'Mane and tail have separate skin regions');
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(__dirname,'../review/native-roster/customization.png')});
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Saved coat/marks, separate mane/tail, immutable rig and material isolation passed.');
 }finally{
  const dir=path.join(__dirname,'../review/native-roster');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,process.env.QA_REPORT||'runtime-report.json'),JSON.stringify({...report,errors},null,2));await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
