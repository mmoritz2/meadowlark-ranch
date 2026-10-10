import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createGrassTuftGeometry,createMeadowDistance} from '../assets/meadow-cover.js';

for(const blades of [4,6,8])test(`${blades*2} middle leaves cover gaps within the retained triangle tier`,()=>{
 const g=createGrassTuftGeometry(T,{bladeCount:blades,segments:2,profile:'middle-natural-v1'}),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,c=g.attributes.color;
 try{
  assert.equal(g.index.count/3,blades*3);assert.equal(p.count,blades*7);
  const leaves=g.userData.middleCover.leafRanges;assert.equal(leaves.length,blades*2);
  assert.equal(leaves.filter(l=>l.bent).length,blades/2);
  for(const a of Object.values(g.attributes)){assert.equal(a.count,p.count);assert(Array.from(a.array).every(Number.isFinite));}
  let projected=0,minDot=1,maxRadius=0;
  for(let i=0;i<p.count;i++){maxRadius=Math.max(maxRadius,Math.hypot(p.getX(i),p.getZ(i)));assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);}
  for(let i=0;i<g.index.count;i+=3){
   const ids=Array.from(g.index.array.subarray(i,i+3));assert(ids.every(j=>j>=0&&j<p.count));
   const[a,b,c]=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j)),f=b.sub(a).cross(c.sub(a));assert(f.length()>1e-8);
   projected+=Math.abs(f.y)*.5;f.normalize();for(const j of ids)minDot=Math.min(minDot,f.dot(new T.Vector3().fromBufferAttribute(n,j)));
  }
  assert(minDot>0,'No vertex normal points through its actual leaf surface');
  assert(projected>blades*.013&&projected<blades*.017,'Long slender leaves supply real horizontal cover within a bounded footprint');
  assert(maxRadius<=.60&&maxRadius>.50);assert.equal(g.boundingBox.min.y,0);assert(g.boundingBox.max.y>=.45&&g.boundingBox.max.y<=.65);
  for(const {vertexStart:s,vertexCount:count} of leaves){
   const tip=s+count-1;assert.equal(p.getY(s),0);assert.equal(p.getY(s+1),0);
   assert(Math.hypot(p.getX(s),p.getZ(s))<.07&&Math.hypot(p.getX(s+1),p.getZ(s+1))<.07,'Every root stays beside the unchanged parent root');
   const width=new T.Vector3().fromBufferAttribute(p,s).distanceTo(new T.Vector3().fromBufferAttribute(p,s+1));assert(width>=.026&&width<=.037);
   assert.equal(uv.getY(s),0);assert.equal(uv.getY(tip),1);assert.equal(uv.getX(tip),.5);assert(p.getY(tip)>0);assert(c.getY(s)<.30&&c.getY(tip)>.90);
  }
 }finally{g.dispose();}
});

test('grass-only shader fade keeps original support and opaque lighting hooks',()=>{
 const html=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
 const match=html.match(/const windy=(\(mat,sway,grassAreaFade=false\)=>[\s\S]*?);\n \/\* ===== ground cover/);assert(match,'actual shared wind owner');
 const windy=new Function('nearU','NG_R','return '+match[1])({uTime:{value:0},uPlayer:{value:new T.Vector3()}},42);
 const compile=(grass)=>{const m=new T.MeshStandardMaterial();windy(m,.24,grass);const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sh);m.dispose();return sh;};
 const near=compile(true),flora=compile(false);
 assert(near.vertexShader.includes('smoothstep(25.2,39.5,'));assert(near.vertexShader.includes('transformed.xz*=sqrt(fade);transformed.y*=fade;'));
 assert(flora.vertexShader.includes('transformed*=fade;'));assert(!flora.vertexShader.includes('sqrt(fade)'));
 assert.equal(near.fragmentShader,T.ShaderLib.standard.fragmentShader);assert.equal(flora.fragmentShader,near.fragmentShader);
 assert(html.includes('windy(nearMat,0.24,true)'));assert.equal((html.match(/windy\([^;]*,true\)/g)||[]).length,1);
 const scene=new T.Scene(),f=createMeadowDistance({THREE:T,scene,canGrow:()=>false,heightAt:()=>0,managedAt:()=>0});
 const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};f.mesh.material.onBeforeCompile(sh,{});
 assert(sh.vertexShader.includes('smoothstep(15.0,29.0,distanceToRider)*(1.0-smoothstep(78.0,102.0,distanceToRider))'));
 assert(sh.vertexShader.includes('transformed.xz*=sqrt(grow);transformed.y*=grow;'));assert(sh.fragmentShader.includes('RE_Direct_Pasture'));
 assert.equal(f.mesh.material.transparent,false);assert.equal(f.mesh.material.alphaTest,0);assert.equal(f.mesh.material.depthWrite,true);assert.equal(f.mesh.receiveShadow,true);
 f.mesh.geometry.dispose();f.mesh.material.dispose();f.mesh.removeFromParent();
});

test('quality changes retain root rows, clear sites and stable recycled cells',()=>{
 const scene=new T.Scene();let quality='high';
 const f=createMeadowDistance({THREE:T,scene,canGrow:(x,z)=>Math.abs(x)>3,heightAt:(x,z)=>.02*x-.01*z,managedAt:()=>.6,getQuality:()=>quality});
 f.tick(0,0,0);const rows=f.mesh.instanceMatrix.array.slice(),colors=f.mesh.instanceColor.array.slice();assert.equal(f.mesh.count,18*18*120);
 let live=0,clear=0;for(let i=0;i<f.mesh.count;i++){const k=i*16,x=rows[k+12];if(Math.abs(x)<=3){assert.equal(rows[k+5],0);clear++;}else{assert(rows[k+5]>0);live++;}}
 assert(live>10000&&clear>100);
 for(const [q,tris] of [['low',12],['medium',18],['high',24]]){quality=q;f.tick(1,0,0);assert.equal(f.mesh.geometry.index.count/3,tris);assert.deepEqual(f.mesh.instanceMatrix.array,rows);assert.deepEqual(f.mesh.instanceColor.array,colors);}
 f.tick(2,60,48);f.tick(3,0,0);assert.deepEqual(f.mesh.instanceMatrix.array,rows);assert.deepEqual(f.mesh.instanceColor.array,colors);
 f.mesh.geometry.dispose();f.mesh.material.dispose();f.mesh.removeFromParent();
});

test('anisotropic retirement normals match independently deformed triangle crosses and remain finite at zero',()=>{
 const html=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),match=html.match(/const windy=(\(mat,sway,grassAreaFade=false\)=>[\s\S]*?);\n \/\* ===== ground cover/);
 const windy=new Function('nearU','NG_R','return '+match[1])({uTime:{value:0},uPlayer:{value:new T.Vector3()}},42);
 const nearMat=new T.MeshStandardMaterial();windy(nearMat,.24,true);
 const f=createMeadowDistance({THREE:T,scene:new T.Scene(),canGrow:()=>false,heightAt:()=>0,managedAt:()=>0});
 for(const [material,key] of [[nearMat,'nearNormalFade'],[f.mesh.material,'middleNormalFade']]){
  const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(sh,{});
  const correction=sh.vertexShader.match(/objectNormal\.xz\*=([^;]+);/);assert(correction);
  assert(sh.vertexShader.indexOf(correction[0])<sh.vertexShader.indexOf('#include <defaultnormal_vertex>'),'correction precedes Three instance normal scaling');
  assert.equal((sh.vertexShader.match(/objectNormal\.xz\*=/g)||[]).length,1);
  const factor=new Function(key,'sqrt','max','return '+correction[1]);
  for(const fade of [0,.001,.1,.25,.75,1]){
   const k=factor(fade,Math.sqrt,Math.max);assert(Number.isFinite(k)&&k>0&&k<=1);if(fade===1)assert.equal(k,1);
   for(const n of [[1,0,0],[0,1,0],[0,0,1]])assert(new T.Vector3(n[0]*k,n[1],n[2]*k).normalize().toArray().every(Number.isFinite));
   if(fade===0)continue; // Retired geometry has no area; only finiteness applies.
   for(const bladeCount of [4,6,8]){
    const g=createGrassTuftGeometry(T,{bladeCount,segments:2,profile:'middle-natural-v1'}),p=g.attributes.position,n=g.attributes.normal,sum=new Float64Array(p.count*3),reach=Math.sqrt(fade);
    for(let i=0;i<g.index.count;i+=3){
     const ids=Array.from(g.index.array.subarray(i,i+3));
     const[a,b,c]=ids.map(j=>new T.Vector3(p.getX(j)*reach,p.getY(j)*fade,p.getZ(j)*reach)),cross=b.sub(a).cross(c.sub(a));
     for(const j of ids){sum[j*3]+=cross.x;sum[j*3+1]+=cross.y;sum[j*3+2]+=cross.z;}
    }
    for(let i=0;i<p.count;i++){
     const expected=new T.Vector3().fromArray(sum,i*3).normalize(),actual=new T.Vector3(n.getX(i)*k,n.getY(i),n.getZ(i)*k).normalize();
     assert(actual.distanceTo(expected)<2e-6,'shader normal tracks the real flattened leaf');
    }
    g.dispose();
   }
  }
 }
 nearMat.dispose();f.mesh.geometry.dispose();f.mesh.material.dispose();f.mesh.removeFromParent();
});
