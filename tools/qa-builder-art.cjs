/* Render every catalogue replacement; exercise real place/move/save paths separately
 * with qa-ranch.cjs. This isolated browser context never touches the player's save. */
const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/builder-art');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text().slice(0,500));}});
  await page.route('**/ranch3d.html*',async route=>{const response=await route.fetch(),html=await response.text();await route.fulfill({response,body:html.replace('const MERGE_STATS=mergeStatics();',`window.__builderQA={THREE,G,scene,renderer,camera,composer,player,groundH,ranchBuilderArt,quality:applyQuality,day(t){dayT=t;weather.mode='clear';weather.timer=99999;}};const MERGE_STATS=mergeStatics();`)});});
  await page.goto(QA.BASE+'/ranch3d.html?qa=builder-art',{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__builderQA?.G.horse.RIG?.ready||window.__builderQA&&window.render_game_to_text&&JSON.parse(render_game_to_text()).graphics.horseReady,null,{timeout:150000});
  await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:120000});
  await page.evaluate(async()=>{const q=__builderQA;q.G.wardrobe?.closeChar();q.G.hidePanels();q.G.save.sync(s=>s.qualityLocked=true);q.quality('high');await q.ranchBuilderArt.ready;});
  await page.waitForLoadState('networkidle',{timeout:60000}).catch(()=>{});await page.evaluate(()=>{__builderQA.day(.37);advanceTime(500);});
  const report=await page.evaluate(()=>{
   const q=__builderQA,T=q.THREE,A=q.ranchBuilderArt;const rows=[];
   for(const type of [...Object.keys(q.G.tables.DECOR_CAT),'paddock','ring','well']){
    const model=q.G.world.buildDecorMesh(type,false),ghost=q.G.world.buildDecorMesh(type,true);if(!model||!ghost){rows.push({type,missing:true});continue;}
    const bounds=new T.Box3().setFromObject(model),gb=new T.Box3().setFromObject(ghost);let triangles=0,draws=0,mapped=0,finite=true,opaque=true,shadows=true,sameGeometry=true;
    const meshes=[],preview=[];model.traverse(o=>{if(o.isMesh){meshes.push(o);draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;if(o.material.map||o.material.normalMap)mapped++;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)if(!Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)))finite=false;}});ghost.traverse(o=>{if(o.isMesh){preview.push(o);if(!o.material.transparent||o.material.opacity>.48)opaque=false;if(o.castShadow)shadows=false;}});
    sameGeometry=meshes.length===preview.length&&meshes.every((m,i)=>m.geometry===preview[i].geometry&&m.material!==preview[i].material);
    rows.push({type,art:!!model.userData.builderArt,scanned:!!model.userData.builderArt?.scanned,size:bounds.getSize(new T.Vector3()).toArray(),bottom:bounds.min.y,triangles,draws,mapped,finite,ghostCorrect:opaque&&shadows&&sameGeometry&&bounds.min.distanceTo(gb.min)<1e-6&&bounds.max.distanceTo(gb.max)<1e-6});
   }
   return {rows,assetErrors:A.errors,models:A.models,featureErrors:q.G.errors};
  });
  // Real lighting and ground in a small catalogue inspection scene.
  await page.evaluate(()=>{
   const q=__builderQA,T=q.THREE;const s=new T.Scene();s.background=new T.Color('#d8ded6');s.environment=q.scene.environment;
   const ambient=new T.HemisphereLight('#e4edf4','#777563',1.4);s.add(ambient);
   const sun=new T.DirectionalLight('#fff0d7',3.1);sun.position.set(-5,8,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:30});sun.shadow.normalBias=.02;sun.shadow.bias=-.0001;s.add(sun);
   const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#acb1a1',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;s.add(floor);
   const c=new T.PerspectiveCamera(38,1200/900,.05,150);q.gallery={scene:s,camera:c,root:null};q.renderer.toneMapping=T.ACESFilmicToneMapping;q.renderer.toneMappingExposure=1;q.renderer.setSize(1200,900,false);
   q.inspect=(types,angle=.65)=>{if(q.gallery.root)s.remove(q.gallery.root);const g=new T.Group();let x=0;for(const type of types){const m=q.ranchBuilderArt.create(type);m.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(m),size=bb.getSize(new T.Vector3());m.position.x=x+size.x/2;m.position.y=-bb.min.y;g.add(m);x+=size.x+.22;}g.position.x=-x/2;s.add(g);q.gallery.root=g;g.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(g),center=bb.getCenter(new T.Vector3()),size=bb.getSize(new T.Vector3()),r=Math.max(size.x*.73,size.y*.96,size.z*.78,1.0);c.position.set(center.x+Math.sin(angle)*r*2.3,center.y+r*1.05,center.z+Math.cos(angle)*r*2.4);c.lookAt(center.x,center.y*.85,center.z);q.renderer.render(s,c);return {draws:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};};
  });
  const capture=async(name,types,angle=.65)=>{await page.evaluate(({types,angle})=>__builderQA.inspect(types,angle),{types,angle});const data=await page.evaluate(()=>__builderQA.renderer.domElement.toDataURL().split(',')[1]);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));};
  await capture('stable-yard',['haybale','trough','barrel','stand'],.45);
  await capture('timber-furniture',['bench','planter','lantern'],.52);
  await capture('field-shelter',['stall'],.72);
  await capture('garden',['birdbath','fountain','pond'],.65);
  await capture('indoor',['bed','shelf','chair','table'],.4);
  await capture('joinery',['wall','door','fence'],.7);
  await capture('stone-well',['well'],.5);
  await capture('scanned-picnic-table',['picnic_table','stump'],.65);
  await capture('seasonal',['pumpkin_pile','harvest_wagon','snowman'],.5);
  await capture('dragon',['dragon_statue','dragon_banner','scale_arch'],.5);
  await capture('trees',['sapling','frost_tree','hedge','blossom_tree'],.35);
  report.lod=await page.evaluate(()=>{
   const q=__builderQA;q.inspect(['sapling']);let lod=null;q.gallery.root.traverse(o=>{if(o.isLOD)lod=o;});
   q.gallery.camera.position.set(24,6,38);q.gallery.camera.lookAt(0,1.2,0);q.renderer.render(q.gallery.scene,q.gallery.camera);
   const far=lod?.levels[1].object.visible,nearHidden=!lod?.levels[0].object.visible;
   q.gallery.camera.position.set(3,2,5);q.gallery.camera.lookAt(0,1.2,0);q.renderer.render(q.gallery.scene,q.gallery.camera);
   return {far,nearHidden,near:lod?.levels[0].object.visible,farHidden:!lod?.levels[1].object.visible};
  });
  await page.evaluate(()=>{const q=__builderQA;q.inspect(['stall']);const root=q.gallery.root;root.clear();root.add(q.ranchBuilderArt.create('stall',true));root.position.set(0,0,0);q.gallery.camera.position.set(6,4,7);q.gallery.camera.lookAt(0,1.2,0);q.renderer.render(q.gallery.scene,q.gallery.camera);});
  fs.writeFileSync(path.join(out,'placement-preview.png'),Buffer.from(await page.evaluate(()=>__builderQA.renderer.domElement.toDataURL().split(',')[1]),'base64'));
  // Test actual terrain placement and persisted rebuilding, including async boot.
  report.lifecycle=await page.evaluate(()=>{
   const q=__builderQA,G=q.G,R=G.ranchSys;G.save.sync(s=>{s.coins=50000;s.gems=100;});
   const results=[];
   for(const type of ['barrel','stall','bench','planter','fence','sapling']){
    let placed=false,position=null;
    for(let x=-108;x<-34&&!placed;x+=7)for(let z=35;z<94&&!placed;z+=7){if(R.decorOk(type,x,z))continue;R.startPlace(type);R.build.rot=.78;placed=R.placeAt(x,z);position=[x,z];R.endBuild();}
    const obj=R.decorObjs.find(o=>o.d.t===type);results.push({type,placed,position,art:!!obj?.g.userData.builderArt,ground:obj?Math.abs(obj.g.position.y-q.groundH(obj.d.x,obj.d.z))<1e-6:false,rotation:obj?.g.rotation.y,id:obj?.d.id});
   }
   return results;
  });
  // Put the renderer back under the real game compositor for a placed-world view.
  await page.evaluate(()=>{const q=__builderQA;const o=q.G.ranchSys.decorObjs.find(o=>o.d.t==='stall');q.player.pos.set(o.d.x+6,0,o.d.z+8);q.day(.36);advanceTime(600);q.camera.position.set(o.d.x+6,q.groundH(o.d.x,o.d.z)+3.0,o.d.z+7);q.camera.lookAt(o.d.x,q.groundH(o.d.x,o.d.z)+1.3,o.d.z);q.composer.render();});
  fs.writeFileSync(path.join(out,'placed-world.png'),Buffer.from(await page.evaluate(()=>__builderQA.renderer.domElement.toDataURL().split(',')[1]),'base64'));
  await page.reload({waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__builderQA&&window.render_game_to_text&&JSON.parse(render_game_to_text()).graphics.horseReady,null,{timeout:150000});
  await page.evaluate(async()=>{await __builderQA.ranchBuilderArt.ready;});await page.waitForTimeout(5000);
  report.reload=await page.evaluate(()=>__builderQA.G.ranchSys.decorObjs.map(o=>({id:o.d.id,type:o.d.t,art:!!o.g.userData.builderArt,position:[o.g.position.x,o.g.position.z],rotation:o.g.rotation.y})));
  report.errors=errors;
  report.checks={allCatalogueDetailed:report.rows.every(r=>r.art),finiteGeometry:report.rows.every(r=>r.finite&&r.size.every(v=>Number.isFinite(v)&&v>0)),matchingPreviews:report.rows.every(r=>r.ghostCorrect),treeDetailLevels:Object.values(report.lod).every(Boolean),noAssetErrors:!report.assetErrors.length,noBrowserErrors:!errors.length,noFeatureErrors:!report.featureErrors.length,placedOnTerrain:report.lifecycle.every(r=>r.placed&&r.art&&r.ground&&r.rotation===.78),reloadArtworkAndTransform:report.lifecycle.every(r=>report.reload.some(o=>o.id===r.id&&o.art&&o.rotation===r.rotation&&o.position.every((v,i)=>v===r.position[i])))};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.checks,null,2));console.log('Catalogue:',report.rows.length,'pieces; output:',out);if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=2;});
