/* Refresh catalog thumbnails from the actual production Studio model pipeline. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const QA=require('../qa-platform.cjs'),root=path.resolve(__dirname,'../..'),out=path.join(root,'assets/breed-thumbnails');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/models/artist-breeds/manifest.json')));
const prior=JSON.parse(fs.readFileSync(path.join(out,'index.json')));
const keys=process.env.HORSE_THUMB_KEYS?.split(',')||[...new Set([...Object.keys(catalog.breeds),...prior.filter(k=>k!=='artist-study'),'white-western','bay-western','bay-sporthorse-native'])];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const injection=String.raw`
const nativeThumbnailRows=new Map();
const nativeThumbnailReady=(async()=>{
 const data=await import('./assets/features/new-breeds.js?native-roster-thumbnails=1');
 const {registerFantasyTheme,registerFantasyAppearance}=await import('./assets/equine-fantasy.js?v=artist-breeds-1');
 for(const [key,theme] of Object.entries(data.THEMES))registerFantasyTheme(key,theme.cfg,theme.fx);
 for(const row of data.ROWS){
  const flags=row[7];nativeThumbnailRows.set(row[0],row);lib.alias(row[0],flags.body,row);
  if(flags.coat)registerFantasyAppearance(row[0],{theme:flags.coat,mane:flags.maneCol||row[6],...(flags.horn?{horn:true}:{})});
 }
})();
window.nativeRosterThumbnail=async key=>{
 await nativeThumbnailReady;
 await select(key);if(loading||selectedKey!==key||!horse)throw Error('Thumbnail model missing: '+key);
 const row=nativeThumbnailRows.get(key);
 if(row){
  const {configureNativeCustomization}=await import('./assets/native-horse-customization.js?v=native-roster-1'),flags=row[7];
  configureNativeCustomization({THREE,rig:instance,defaults:row,horse:{id:'thumbnail-'+key,breed:key,colors:{body:row[5],mane:flags.maneCol||row[6]},mark:flags.mark||'none',markCol:flags.markCol,coat:flags.coat}});
 }
 paused=true;controls.autoRotate=false;controls.resetMotion();motion?.set('rest');motion?.update(0);accessories?.update(0);
 ring.visible=false;scene.fog=null;renderer.setPixelRatio(1);renderer.setSize(640,480);
 camera.aspect=640/480;camera.updateProjectionMatrix();headView=false;
 const bounds=breedStudioInspect().bounds;
 controls.target.fromArray(bounds.min).add(new THREE.Vector3().fromArray(bounds.max)).multiplyScalar(.5);
 const direction=new THREE.Vector3(-.84,.12,.55).normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
 const up=new THREE.Vector3().crossVectors(direction,right),point=new THREE.Vector3();
 const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));let distance=1.4;
 horse.updateMatrixWorld(true);
 horse.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;const positions=mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld).sub(controls.target);
   const depth=point.dot(direction);distance=Math.max(distance,depth+Math.abs(point.dot(right))/(tanV*camera.aspect*.88),depth+Math.abs(point.dot(up))/(tanV*.86));}
 });
 controls.minDistance=.1;controls.maxDistance=distance*2;camera.position.copy(controls.target).addScaledVector(direction,distance*1.025);camera.lookAt(controls.target);draw();
 const geometry=breedStudioInspect(),state=JSON.parse(render_game_to_text());
 const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/webp',.93));
 if(!blob||blob.type!=='image/webp')throw Error('WebP rendering unavailable');
 return{geometry,state,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))};
};`;
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:640,height:480},deviceScaleFactor:1}),errors=[],records=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  await page.route('**/assets/features/new-breeds.js?native-roster-thumbnails=1',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'assets/features/new-breeds.js'),'utf8')+'\nexport {ROWS,THEMES};\n'}));
  await page.route('**/breeds.html*',route=>{
   let html=fs.readFileSync(path.join(root,'breeds.html'),'utf8');
   html=html.replace('</head>','<style>main{display:block}aside,.caption,.controls,.hint,#status{display:none!important}#stage{width:640px;height:480px}</style></head>');
   html=html.replace('</script></body>',injection+'\n</script></body>');
   return route.fulfill({contentType:'text/html',body:html});
  });
  await page.goto(QA.BASE+'/breeds.html?horse=white-western',{timeout:120000});
  await page.waitForFunction(()=>window.nativeRosterThumbnail&&JSON.parse(render_game_to_text()).modelReady&&!JSON.parse(render_game_to_text()).loading,null,{timeout:120000});
  for(const key of keys){
   const r=await page.evaluate(key=>nativeRosterThumbnail(key),key),g=r.geometry,p=g.projected;
   assert(g.finite,key+' nonfinite');assert(g.bones>=677,key+' missing full native rig');
   assert(p.left>=-1.01&&p.right<=1.01&&p.top<=1.01&&p.bottom>=-1.01,key+' cropped');
   const data=Buffer.from(r.bytes);fs.writeFileSync(path.join(out,key+'.webp'),data);
   records.push({key,sha256:hash(data),bytes:data.length,bones:g.bones,vertices:g.vertices,projectedBounds:p,asset:r.state.asset});
   console.log(JSON.stringify({key,bones:g.bones,bytes:data.length}));
  }
  assert.equal(errors.length,0,errors.join('\n'));
  if(!process.env.HORSE_THUMB_KEYS)fs.writeFileSync(path.join(out,'index.json'),JSON.stringify([...new Set([...prior,...keys])],null,2)+'\n');
  fs.writeFileSync(path.join(root,'assets/models/native-roster',process.env.HORSE_THUMB_KEYS?'thumbnail-review-partial.json':'thumbnail-review.json'),JSON.stringify({render:'Actual production Breed Studio, native677 rig, source Western tack, rest pose',errors,records},null,2)+'\n');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
