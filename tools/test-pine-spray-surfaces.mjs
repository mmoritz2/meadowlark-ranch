import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as T from '../assets/vendor/three/build/three.module.js';
import {PINE_SPRAY_SOURCE_SHA,PINE_SPRAY_ROWS,isPineSprayCorner,withinPineSprayIsland,pineSprayCornerStats,patchPineSprayCutout,applyPineSprayCutout} from '../assets/pine-spray-surfaces.mjs';
const source=new URL('../assets/models/world/realism/pine_tree_01.glb',import.meta.url);
const bytes=fs.readFileSync(source),jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength)),start=28+jsonLength;
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function accessor(i){const a=gltf.accessors[i],v=gltf.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3}[a.type],type={5120:Int8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType],out=new type(a.count*size),step=v.byteStride||size*out.BYTES_PER_ELEMENT;for(let n=0;n<a.count;n++)for(let c=0;c<size;c++){const offset=start+(v.byteOffset||0)+(a.byteOffset||0)+n*step+c*out.BYTES_PER_ELEMENT;out[n*size+c]=a.componentType===5120?bytes.readInt8(offset):a.componentType===5123?bytes.readUInt16LE(offset):a.componentType===5125?bytes.readUInt32LE(offset):bytes.readFloatLE(offset);}return new T.BufferAttribute(out,size,!!a.normalized);}
function geometry(p){const g=new T.BufferGeometry();for(const [k,name]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])g.setAttribute(name,accessor(p.attributes[k]));g.setIndex(accessor(p.indices));return g;}
const geo=geometry(gltf.meshes[0].primitives[2]);
const snapshot=()=>Object.fromEntries([...Object.entries(geo.attributes),['index',geo.index]].map(([k,a])=>[k,{count:a.count,type:a.array.constructor.name,hash:digest(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))}]));
test('pinned source has exactly the generated corner vertices with no retained or mixed triangle marker',()=>{assert.equal(digest(bytes),PINE_SPRAY_SOURCE_SHA);assert.deepEqual(pineSprayCornerStats(geo),{corners:38360,triangles:19180,mixed:0});const uv=geo.attributes.uv;let distance=1;for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);if(!isPineSprayCorner(u,v))distance=Math.min(distance,...[.002929732204165713,.24492256046387426].flatMap(a=>[.001953154802777142,.45812161440451665].map(b=>Math.hypot(u-a,v-b))));}assert(distance>.00001);});
test('author photo-alpha texels survive while opaque neighbouring atlas extrusion is removed',()=>{
 const python=`import json,struct,io,sys\nfrom PIL import Image\nb=open(sys.argv[1],'rb').read();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);x=next(x for x in d['images'] if x['name']=='pine_tree_01_twig_diff');v=d['bufferViews'][x['bufferView']];p=28+n+v['byteOffset'];im=Image.open(io.BytesIO(b[p:p+v['byteLength']]));a=im.getchannel('A');data=a.load();rows=[]\nfor y in range(2,469):\n clear=[x for x in range(260) if data[x,y]<5];lo=min(clear) if clear else 1e6;hi=max(clear) if clear else -1\n for x in range(3,251):\n  if data[x,y]>=.38*255:rows.append([x,y,lo<=x<=hi])\nprint(json.dumps(rows))`;
 const samples=JSON.parse(execFileSync('python3',['-c',python,source.pathname],{encoding:'utf8',maxBuffer:3000000}));let photographed=0,retained=0,bleed=0,acceptedBleed=0;
 for(const [x,y,originalPhoto]of samples){const accepted=withinPineSprayIsland(x/1024,y/1024);if(originalPhoto){photographed++;if(accepted)retained++;}else{bleed++;if(accepted)acceptedBleed++;}}
 assert(photographed>21000);assert.equal(retained,photographed);assert(bleed>15000);assert.equal(acceptedBleed,0);
});
test('surface install preserves every geometry byte, map, alpha threshold, depth material, material identity and RNG',()=>{
 const before=snapshot(),m=new T.MeshPhysicalMaterial({name:'pine_tree_01_twig',map:new T.Texture(),normalMap:new T.Texture(),alphaTest:.38}),depth=new T.MeshDepthMaterial({map:m.map,alphaTest:m.alphaTest});m.userData.scanDepth=depth;
 const old={uuid:m.uuid,map:m.map,normalMap:m.normalMap,alpha:m.alphaTest,depth:m.userData.scanDepth,scale:m.normalScale.toArray(),side:m.side},random=Math.random;
 try{Math.random=()=>{throw Error('unexpected RNG draw');};assert(applyPineSprayCutout(m));assert(applyPineSprayCutout(depth));assert(!applyPineSprayCutout(m));assert.deepEqual(pineSprayCornerStats(geo),{corners:38360,triangles:19180,mixed:0});}finally{Math.random=random;}
 assert.deepEqual(snapshot(),before);assert.deepEqual({uuid:m.uuid,map:m.map,normalMap:m.normalMap,alpha:m.alphaTest,depth:m.userData.scanDepth,scale:m.normalScale.toArray(),side:m.side},old);
});
test('color, shadow depth and custom normal bake use identical vertex marker and island discard',()=>{
 const shaders=['standard','depth'].map(k=>({...T.ShaderLib[k],uniforms:{}}));shaders.push({vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){gl_FragColor=vec4(vUv,0.,1.);}'});
 for(const sh of shaders){const v=sh.vertexShader,f=sh.fragmentShader;assert(patchPineSprayCutout(sh));assert(!patchPineSprayCutout(sh));assert(sh.vertexShader.includes('pineSprayUV=uv;'));assert(sh.fragmentShader.includes('if(pineSprayPatch>.5&&!withinPinePhotoIsland(pineSprayUV))discard;'));assert(sh.vertexShader.endsWith(v.slice(v.indexOf('{',v.indexOf('void main'))+1)));assert(sh.fragmentShader.endsWith(f.slice(f.indexOf('{',f.indexOf('void main'))+1)));assert(sh.fragmentShader.includes('void main'));assert(sh.fragmentShader.length>f.length);}
 const end='return false;\n }\n';const headers=shaders.map(sh=>sh.fragmentShader.slice(0,sh.fragmentShader.indexOf(end)+end.length));assert.equal(headers[0],headers[1]);assert.equal(headers[1],headers[2]);
});
test('existing compiler hooks run first, remain active and receive a separate source-mask cache binding',()=>{
 const m=new T.MeshStandardMaterial();let calls=0;m.onBeforeCompile=sh=>{calls++;sh.vertexShader='#define RETAINED_WIND\n'+sh.vertexShader;sh.fragmentShader='#define RETAINED_COVERAGE\n'+sh.fragmentShader;};m.customProgramCacheKey=()=> 'original-source-program';applyPineSprayCutout(m);const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sh);assert.equal(calls,1);assert(sh.vertexShader.includes('RETAINED_WIND'));assert(sh.fragmentShader.includes('RETAINED_COVERAGE'));assert.equal(m.customProgramCacheKey(),'original-source-program:pine-photo-island-1');
});
test('runtime integration changes only the generated twig program binding; source placement and instance producers remain exact',()=>{
 const candidate=fs.readFileSync(new URL('../assets/world-photoscans.js',import.meta.url),'utf8');
 const stripped=candidate.replace("import {applyPineSprayCutout} from './pine-spray-surfaces.mjs?v=pine-spray-surfaces-1';\n",'').replace("      if(id==='pine_tree_01'&&mat.name==='pine_tree_01_twig'){\n        applyPineSprayCutout(mat);applyPineSprayCutout(mat.userData.scanDepth);\n      }\n",'');assert.equal(digest(Buffer.from(stripped.replace('tree-impostors.json?v=pine-photo-island-1','tree-impostors.json?v=summer-canopy-surfaces-1').replace("enabled=!renderer.xr.isPresenting;","enabled=tier!=='low'&&!renderer.xr.isPresenting;").replace("range=tier==='high'?58:tier==='low'?26:40,budget=tier==='high'?12:tier==='low'?4:6;","range=tier==='high'?58:40,budget=tier==='high'?12:6;"))),'32d70fd24d685c225527fb5a750a29492c3753080255708d2835309291763f05');
 const helper=fs.readFileSync(new URL('../assets/pine-spray-surfaces.mjs',import.meta.url),'utf8');assert(!/Math\.random|new\s+.*(?:Geometry|Material|Texture|Mesh)\(|fetch\(/.test(helper));
 const baker=fs.readFileSync(new URL('./asset-gen/bake-world-tree.cjs',import.meta.url),'utf8');assert(baker.includes("if(source==='pine_tree_01'&&old.name==='pine_tree_01_twig')applyPineSprayCutout(o.material)"));assert(baker.includes('Pine island correction requires an initial full-channel bake'));assert(baker.includes('sourceGLBSha256'));assert.equal(PINE_SPRAY_ROWS.length,14);
});
