import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{createHash}from'node:crypto';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=process.env.ACTOR_LABEL_RUNTIME_ROOT||path.resolve(HERE,'..'),SOURCE=process.env.ACTOR_LABEL_SOURCE_ROOT||path.resolve(HERE,'..'),COHORT=process.env.ACTOR_LABEL_COHORT_ROOT||ROOT;
const text=f=>fs.readFileSync(f,'utf8'),sha=s=>createHash('sha256').update(s).digest('hex'),fixture=JSON.parse(text(path.join(HERE,'fixtures/wild-actor-label-2f27e76/baseline.json'))),fileFor={world:'assets/features/world.js',guard:'assets/label-visibility.js',html:'ranch3d.html'};
function replaceOnce(s,a,b){assert.equal(s.split(a).length,2,'One exact source edge: '+a);return s.replace(a,b);}
function rewrite(s,key,inverse=false){for(const[a,b]of inverse?[...fixture.edges[key]].reverse():fixture.edges[key])s=replaceOnce(s,inverse?b:a,inverse?a:b);return s;}
function recover(s,key){assert(fixture.edges[key].every(([,after])=>s.includes(after)),'Missing scoped '+key+' source edges');s=rewrite(s,key,true);assert.equal(sha(s),fixture.preimages[fileFor[key]],'Complete '+key+' preimage mismatch');return s;}
function established(s,key){return sha(s)===fixture.preimages[fileFor[key]]?s:recover(s,key);}
const T=await import(pathToFileURL(path.join(ROOT,'assets/vendor/three/build/three.module.js'))),H=await import(pathToFileURL(path.join(SOURCE,'assets/wild-actor-labels.mjs')));
const oldWorld=established(text(path.join(COHORT,fileFor.world)),'world'),newWorld=text(path.join(SOURCE,fileFor.world)),oldGuard=text(path.join(HERE,'fixtures/wild-actor-label-2f27e76/label-visibility.js')),newGuard=text(path.join(SOURCE,fileFor.guard));
assert.equal(sha(oldGuard),fixture.preimages[fileFor.guard]);
const loadGuard=s=>new Function(s.replace('export function','function')+';return guardFloatingLabel;')(),guardA=loadGuard(oldGuard),guardB=loadGuard(newGuard);
function renderer({cssHeight=900,bufferHeight=1800,viewportHeight=bufferHeight,targetHeight=null}={}){return{domElement:{clientHeight:cssHeight},getCurrentViewport:o=>o.set(0,0,1440,viewportHeight),getDrawingBufferSize:o=>o.set(2880,bufferHeight),getSize:o=>o.set(1440,cssHeight),getRenderTarget:()=>targetHeight?{height:targetHeight}:null,capabilities:{getMaxAnisotropy:()=>8}};}
function makeSprite(aspect=304/128){const texture=new T.Texture({width:aspect*128,height:128}),m=new T.SpriteMaterial({name:'World | floating label',map:texture,transparent:true,depthWrite:false,toneMapped:false});return new T.Sprite(m);}
function camera(fov=52){const c=new T.PerspectiveCamera(fov,1.6,.08,5000);c.position.set(0,0,0);c.lookAt(0,0,-1);c.updateProjectionMatrix();c.updateMatrixWorld(true);return c;}
function render(sp,c,r){sp.onBeforeRender(r,null,c,sp.geometry,sp.material,null);}
// Independently replay actual Three Sprite vertex geometry, including material
// rotation, real matrix column lengths and full projection. Do not call layout.
function spriteBounds(sp,c,cssHeight){
 sp.updateWorldMatrix(true,false);const mv=new T.Vector4(0,0,0,1).applyMatrix4(sp.matrixWorld).applyMatrix4(c.matrixWorldInverse),e=sp.matrixWorld.elements,attenuation=sp.material.sizeAttenuation===false&&c.isPerspectiveCamera?-mv.z:1,sx=Math.hypot(e[0],e[1],e[2])*attenuation,sy=Math.hypot(e[4],e[5],e[6])*attenuation,rotation=sp.material.rotation,co=Math.cos(rotation),sn=Math.sin(rotation),p=sp.geometry.attributes.position,out=[];
 for(let i=0;i<p.count;i++){const x=(p.getX(i)-(sp.center.x-.5))*sx,y=(p.getY(i)-(sp.center.y-.5))*sy,v=new T.Vector4(mv.x+co*x-sn*y,mv.y+sn*x+co*y,mv.z,1).applyMatrix4(c.projectionMatrix);out.push([v.x/v.w,v.y/v.w]);}
 const ys=out.map(v=>(1-v[1])*cssHeight/2);return{height:Math.max(...ys)-Math.min(...ys),anchor:sp.getWorldPosition(new T.Vector3()).toArray()};
}
function shader(guard,width,role=null){const sp=makeSprite();sp.scale.set(width,.6,1);guard(sp,{role});const s={uniforms:{},vertexShader:T.ShaderLib.sprite.vertexShader,fragmentShader:T.ShaderLib.sprite.fragmentShader};sp.material.onBeforeCompile(s,null);return{vertex:s.vertexShader,fragment:s.fragmentShader,near:s.uniforms.labelNear.value,safe:s.uniforms.labelSafe.value,cache:sp.material.customProgramCacheKey()};}

test('only explicit wild actors opt into the name near-guard; all default permanent shader bytes and uniforms remain exact',()=>{
 for(const width of[.85,1.425,1.6,2.6,4.2])assert.deepEqual(shader(guardB,width),shader(guardA,width));
 const short=shader(guardB,.855,H.WILD_ACTOR_LABEL_ROLE);assert.equal(short.near,2.6);assert.equal(short.safe,5.4);assert.equal(shader(guardB,.855).near,1.5);assert.equal(short.fragment,shader(guardA,2.6).fragment);assert.equal(short.vertex,shader(guardA,2.6).vertex);
});

test('current-render-view cap holds for actual projected corners across FOV, rotation, parent shear/nonuniform scale and DPR/viewport sizes',t=>{
 let cases=0,maxHeight=0;for(const fov of[25,52,85])for(const angle of[0,.31,Math.PI/2])for(const spec of[{cssHeight:900,bufferHeight:900},{cssHeight:900,bufferHeight:1800},{cssHeight:900,bufferHeight:1800,viewportHeight:900},{cssHeight:600,bufferHeight:1200,targetHeight:300,viewportHeight:300}]){
  const root=new T.Group(),parent=new T.Group(),sp=makeSprite(752/128),c=camera(fov),r=renderer(spec);root.add(parent);parent.add(sp);root.rotation.set(.13,.3,-.12);root.scale.set(1.3,.75,1.1);parent.rotation.set(-.2,.5,.7);parent.scale.set(.45,2.8,1.3);sp.quaternion.setFromEuler(new T.Euler(.4,-.15,.2));sp.material.rotation=angle;
  sp.position.set(.3,.7,-4);H.configureWildActorLabel({THREE:T,sprite:sp});root.updateMatrixWorld(true);const anchor=sp.getWorldPosition(new T.Vector3()).toArray(),local=sp.position.toArray(),center=sp.center.toArray();render(sp,c,r);
  const cssView=spec.viewportHeight===undefined?spec.cssHeight:spec.viewportHeight*spec.cssHeight/(spec.targetHeight||spec.bufferHeight),bounds=spriteBounds(sp,c,cssView);
  assert(bounds.height<=36+1e-10);assert(bounds.height>0);maxHeight=Math.max(maxHeight,bounds.height);assert.deepEqual(bounds.anchor,anchor);assert.deepEqual(sp.position.toArray(),local);assert.deepEqual(sp.center.toArray(),center);assert.equal(sp.material.transparent,true);assert.equal(sp.material.depthWrite,false);assert.equal(sp.material.depthTest,true);assert.equal(sp.material.toneMapped,false);cases++;
 }
 t.diagnostic(JSON.stringify({actualSpriteProjectionCases:cases,maximumCssHeight:maxHeight}));
});

test('repeated composer passes and camera changes without ticks never compound shrink and regrow from the same producer dimensions',()=>{
 const sp=makeSprite(),parent=new T.Group(),r=renderer(),a=camera(52),b=camera(85);parent.add(sp);sp.position.z=-6;H.configureWildActorLabel({THREE:T,sprite:sp});
 const goal={...sp.userData.actorLabelPolicy};render(sp,a,r);const first=sp.scale.toArray();for(let i=0;i<8;i++){render(sp,a,r);assert.deepEqual(sp.scale.toArray(),first);}
 a.position.z=-3;a.updateMatrixWorld(true);render(sp,a,r);assert(sp.scale.y<first[1]);assert(spriteBounds(sp,a,900).height<=36+1e-10);
 a.position.z=0;a.updateMatrixWorld(true);render(sp,a,r);assert.deepEqual(sp.scale.toArray(),first);
 render(sp,b,r);assert(spriteBounds(sp,b,900).height<=36+1e-10);render(sp,a,r);assert.deepEqual(sp.scale.toArray(),first);
 a.position.z=20;a.updateMatrixWorld(true);render(sp,a,r);assert(Math.abs(sp.scale.x-goal.baseWidth)<1e-14);assert(Math.abs(sp.scale.y-goal.baseHeight)<1e-14);
 assert.equal(sp.userData.actorLabelPolicy.baseWidth,goal.baseWidth);assert.equal(sp.userData.actorLabelPolicy.baseHeight,goal.baseHeight);
});

test('orthographic views, dynamic parent scale and refreshed image aspect use the same finite bounded role owner',()=>{
 const sp=makeSprite(),p=new T.Group(),c=new T.OrthographicCamera(-3,3,2,-2,.1,100),r=renderer();p.add(sp);sp.position.set(.1,.3,-10);let producerCalls=0;sp.onBeforeRender=()=>producerCalls++;H.configureWildActorLabel({THREE:T,sprite:sp});const callback=sp.onBeforeRender;c.updateMatrixWorld(true);render(sp,c,r);assert(spriteBounds(sp,c,900).height<=36+1e-10);
 p.scale.set(3,.25,2);p.rotation.z=.7;render(sp,c,r);assert(spriteBounds(sp,c,900).height<=36+1e-10);assert.equal(producerCalls,2);
 sp.material.map.image={width:752,height:128};H.configureWildActorLabel({THREE:T,sprite:sp});assert.equal(sp.onBeforeRender,callback);assert.equal(sp.userData.actorLabelPolicy.baseWidth,.36*752/128);render(sp,c,r);assert(spriteBounds(sp,c,900).height<=36+1e-10);assert.equal(producerCalls,3);
 p.scale.y=0;render(sp,c,r);assert(Number.isFinite(sp.scale.x)&&Number.isFinite(sp.scale.y));
});

test('nonattenuated perspective sprites follow the real Sprite depth multiplier and regrow across view/FOV changes without ticks',()=>{
 const sp=makeSprite(752/128),p=new T.Group(),c=camera(52),r=renderer();p.add(sp);p.scale.set(2,.3,1.5);p.rotation.set(.1,.25,-.45);sp.position.z=-8;sp.material.sizeAttenuation=false;sp.material.rotation=.2;H.configureWildActorLabel({THREE:T,sprite:sp});render(sp,c,r);const first=sp.scale.toArray();assert(spriteBounds(sp,c,900).height<=36+1e-10);
 for(const z of[2,-2,0]){c.position.z=z;c.updateMatrixWorld(true);render(sp,c,r);assert(spriteBounds(sp,c,900).height<=36+1e-10);}assert.deepEqual(sp.scale.toArray(),first);
 c.fov=25;c.updateProjectionMatrix();render(sp,c,r);assert(sp.scale.y<first[1]);assert(spriteBounds(sp,c,900).height<=36+1e-10);c.fov=52;c.updateProjectionMatrix();render(sp,c,r);assert.deepEqual(sp.scale.toArray(),first);
 const ortho=new T.OrthographicCamera(-3,3,2,-2,.1,100);ortho.updateMatrixWorld(true);render(sp,ortho,r);assert(spriteBounds(sp,ortho,900).height<=36+1e-10);
});

test('configuring, refreshing and drawing the role creates no new material/texture/geometry and makes no ambient random calls',()=>{
 const sp=makeSprite(),c=camera(),r=renderer(),geo=sp.geometry,mat=sp.material,map=sp.material.map;sp.position.z=-8;const prior=Math.random;Math.random=()=>{throw Error('Actor label must not shift world RNG');};try{
  H.configureWildActorLabel({THREE:T,sprite:sp});const callback=sp.onBeforeRender;for(let i=0;i<5;i++){H.configureWildActorLabel({THREE:T,sprite:sp});render(sp,c,r);assert.equal(sp.onBeforeRender,callback);assert.equal(sp.geometry,geo);assert.equal(sp.material,mat);assert.equal(sp.material.map,map);}
 }finally{Math.random=prior;}
});

test('a previous capped bound cannot cull an actor before a later current-view regrowth at the frame edge',()=>{
 const sp=makeSprite(752/128),c=camera(52),r=renderer(),permanent=makeSprite();H.configureWildActorLabel({THREE:T,sprite:sp});assert.equal(sp.frustumCulled,false);assert.equal(permanent.frustumCulled,true);
 const z=20,edge=Math.tan(26*Math.PI/180)*c.aspect*z;sp.position.set(edge+1.1,0,-z);sp.scale.set(.001,.001,1);sp.updateMatrixWorld(true);const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));assert.equal(frustum.intersectsSprite(sp),false,'Negative control: stale capped bound would skip onBeforeRender');
 render(sp,c,r);assert.equal(frustum.intersectsSprite(sp),true,'Restored producer dimensions actually intersect this view');assert(spriteBounds(sp,c,900).height<=36+1e-10);
});

function canvasDocument(){return{createElement(){const ctx={font:'',measureText:s=>({width:s==='✨ wild'?180:s.includes('Snowline Fjord')?630:s.length*25}),fillStyle:'',lineWidth:0,strokeStyle:'',beginPath(){},roundRect(){},fill(){},stroke(){},strokeText(){},fillText(){}};return{width:0,height:0,getContext:()=>ctx};}};}
function manager(s,guard){
 const scene=new T.Scene(),G={camera:camera(),renderer:renderer(),time:{dayT:()=>.34}},start=s.indexOf(' const LABELS=[];'),end=s.indexOf(' function building(',start),mstart=s.indexOf(' function isPlate('),mend=s.indexOf(' /* The people get their names back.',mstart);
 assert(start>0&&end>start&&mstart>0&&mend>mstart);
 const factory=new Function('THREE','G','scene','document','guardFloatingLabel','configureWildActorLabel','WILD_ACTOR_LABEL_ROLE',s.slice(start,end)+s.slice(mstart,mend)+';return{plate,redress,scanLabels,tickLabels,LABELS};');
 return{scene,G,...factory(T,G,scene,canvasDocument(),guard,H.configureWildActorLabel,H.WILD_ACTOR_LABEL_ROLE)};
}
function state(m){return m.LABELS.map(L=>({bx:L.bx,by:L.by,op:L.op,hid:L.hid,role:L.role,scale:L.sp.scale.toArray(),visible:L.sp.visible,opacity:L.sp.material.opacity,color:L.sp.material.color.toArray(),position:L.sp.position.toArray()}));}

test('actual permanent manager behavior remains equal for arena numbers and short/wide signage across near/far ticks and redress',()=>{
 const a=manager(oldWorld,guardA),b=manager(newWorld,guardB);
 for(const m of[a,b]){for(const[text,width,height]of[['A',.85,.3],['Home pen',2.4,.6],['A very long permanent sign with many words',4.2,1.05]]){const parent=new T.Group(),sp=m.plate(text);parent.add(sp);parent.position.set(0,0,-12);sp.scale.set(width,height,1);m.scene.add(parent);}m.scene.updateMatrixWorld(true);m.scanLabels();}
 for(const z of[0,-9,-11,-12,20,60,0])for(let i=0;i<4;i++){for(const m of[a,b]){m.G.camera.position.z=z;m.G.camera.updateMatrixWorld(true);m.scene.updateMatrixWorld(true);m.tickLabels(1/30);}assert.deepEqual(state(b),state(a));}
 a.redress(a.LABELS[1].sp,'A repainted permanent sign');b.redress(b.LABELS[1].sp,'A repainted permanent sign');for(const m of[a,b])m.tickLabels(.1);assert.deepEqual(state(b),state(a));
});

test('actual registry/redress/tick seams retain explicit actor role and producer dimensions even when scanning after a capped render',()=>{
 const m=manager(newWorld,guardB),parent=new T.Group(),sp=m.plate('✨ wild',H.WILD_ACTOR_LABEL_ROLE);parent.add(sp);parent.position.z=-6;m.scene.add(parent);m.scene.updateMatrixWorld(true);render(sp,m.G.camera,m.G.renderer);assert(sp.scale.y<.36);m.scanLabels();const L=m.LABELS[0];assert.equal(L.role,H.WILD_ACTOR_LABEL_ROLE);assert.equal(L.by,.36);assert.equal(L.bx,.36*304/128);m.tickLabels(1/6);assert.equal(L.op,1);
 parent.position.z=-40;m.scene.updateMatrixWorld(true);m.tickLabels(1/6);assert.equal(L.op,0,'Actor range30m applies even to narrow text');
 m.redress(sp,'✨ wild · Snowline Fjord');assert.equal(L.role,H.WILD_ACTOR_LABEL_ROLE);assert.equal(L.by,.36);assert.equal(L.bx,.36*752/128);assert.equal(sp.userData.actorLabelPolicy.baseWidth,L.bx);assert.equal(sp.material.userData.cameraSafeLabel.near,2.6);assert.equal(sp.material.userData.cameraSafeLabel.far,5.4);
});

test('only explicit actor-role ownership selects order3 before sorting; permanent/default producer orders remain untouched',()=>{
 const m=manager(newWorld,guardB),actor=m.plate('✨ wild',H.WILD_ACTOR_LABEL_ROLE),number=m.plate('A'),sign=m.plate('A permanent sign');number.scale.set(.85,.3,1);sign.renderOrder=7;
 for(const sp of[actor,number,sign]){const parent=new T.Group();parent.position.z=-14;parent.add(sp);m.scene.add(parent);}m.scene.updateMatrixWorld(true);m.scanLabels();
 assert.equal(actor.renderOrder,3);assert.equal(number.renderOrder,0);assert.equal(sign.renderOrder,7);const position=actor.position.toArray(),center=actor.center.toArray();m.tickLabels(.1);render(actor,m.G.camera,m.G.renderer);
 assert.equal(actor.renderOrder,3);assert.equal(number.renderOrder,0);assert.equal(sign.renderOrder,7);assert.deepEqual(actor.position.toArray(),position);assert.deepEqual(actor.center.toArray(),center);assert.equal(actor.material.depthTest,true);assert.equal(actor.material.depthWrite,false);
});

test('the actual bundled Three transparent sorter reproduces the order0 negative control and draws the actor after orders1/2 with order3',()=>{
 const three=text(path.join(ROOT,'assets/vendor/three/build/three.module.js')),start=three.indexOf('function reversePainterSortStable( a, b ) {'),end=three.indexOf('function WebGLRenderList()',start);assert(start>0&&end>start);const sort=new Function(three.slice(start,end)+';return reversePainterSortStable;')();
 const actor=makeSprite(),rock=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({transparent:true})),water=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({transparent:true}));rock.renderOrder=1;water.renderOrder=2;
 const order=()=>[actor,rock,water].map((object,i)=>({object,id:object.id,groupOrder:0,renderOrder:object.renderOrder,material:object.material,z:6-i})).sort(sort).map(r=>r.object);
 assert.deepEqual(order(),[actor,rock,water],'Negative control: transparent order0 submits actor before later orders1/2');H.configureWildActorLabel({THREE:T,sprite:actor});assert.deepEqual(order(),[rock,water,actor]);assert.equal(rock.renderOrder,1);assert.equal(water.renderOrder,2);assert.equal(actor.material.depthTest,true);assert.equal(actor.material.depthWrite,false);
 rock.geometry.dispose();rock.material.dispose();water.geometry.dispose();water.material.dispose();actor.material.map.dispose();actor.material.dispose();
});

test('complete source inverses and one direct cache alias preserve the accepted feature, guard, entry and every existing import-map edge',()=>{
 assert.equal(recover(newWorld,'world'),oldWorld);assert.equal(recover(newGuard,'guard'),oldGuard);const html=text(path.join(SOURCE,fileFor.html)),before=established(text(path.join(COHORT,fileFor.html)),'html');assert.equal(recover(html,'html'),before);
 assert.throws(()=>recover(newWorld+'\n// unknown edit','world'),/preimage mismatch/);assert.throws(()=>recover(newGuard.replace("role==='wild-actor'","role==='permanent'"),'guard'),/Missing scoped/);
 for(const[key,file]of Object.entries(fileFor)){assert.equal(sha(text(path.join(SOURCE,file))),fixture.candidateSourceSHA256[file]);assert.equal(text(path.join(SOURCE,file)),rewrite(established(text(path.join(COHORT,file)),key),key));}
 const helper=text(path.join(SOURCE,'assets/wild-actor-labels.mjs')),edge=fixture.helperOrderEdge;assert.equal(sha(helper),fixture.candidateSourceSHA256['assets/wild-actor-labels.mjs']);assert.equal(sha(replaceOnce(helper,edge.after,edge.before)),edge.preimageSHA256,'Whole accepted capped helper exact after sole role-owner order edge');
 const imports=s=>JSON.parse(s.split('<script type="importmap">')[1].split('</script>')[0]).imports,a=imports(before),b=imports(html);assert.equal(b[fixture.worldOldURL],fixture.worldURL);delete b[fixture.worldOldURL];assert.deepEqual(b,a);assert(newWorld.includes("plate('✨ wild'+(wb.variant?' · '+wb.variant:''),WILD_ACTOR_LABEL_ROLE)"));
});
