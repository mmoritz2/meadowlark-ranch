import * as THREE from '../../assets/vendor/three/build/three.module.js';
import {createGeology} from '../../assets/geology.js';
import {mkdirSync,writeFileSync} from 'node:fs';
const floor=(x,z)=>x*.03+Math.sin(z*.1)*.5;
const factory=createGeology({THREE,loadTextures:false,groundH:floor});
const mesa=factory.makeMesa(10,18,26),copy=factory.makeMesa(10,18,26);
const hoodoo=factory.makeHoodoo(1.8,10,68),boulder=factory.makeBoulder(1.8,74);
const report={passed:true,forms:[]};
for(const g of[mesa,hoodoo,boulder]){
  g.updateMatrixWorld(true);let finite=true;
  g.traverse(m=>{if(m.geometry)for(const a of Object.values(m.geometry.attributes))
    finite&&=Array.from(a.array).every(Number.isFinite);});
  const height=g.userData.geology.height||2;
  const top=new THREE.Raycaster(new THREE.Vector3(0,height+5,0),new THREE.Vector3(0,-1,0)).intersectObject(g,true)[0];
  const topVisible=!!top&&top.face.normal.y>.10;
  report.forms.push({...g.userData.geology,finite,topVisible,topY:top?.point.y});
  report.passed&&=finite&&topVisible;
}
const a=mesa.children[0].geometry.attributes.position.array,b=copy.children[0].geometry.attributes.position.array;
report.deterministic=a.length===b.length&&a.every((v,i)=>v===b[i]);report.passed&&=report.deterministic;
factory.groundAt(mesa,24,-37);
const mesh=mesa.children[0],p=mesh.geometry.attributes.position,original=mesh.geometry.userData.groundReference;
let maxGap=-Infinity,samples=0;
for(let i=0;i<p.count;i++)if(original[i*3+1]<0){
  const x=p.getX(i)+24,z=p.getZ(i)-37,y=p.getY(i)+mesa.position.y;
  maxGap=Math.max(maxGap,y-floor(x,z));samples++;
}
const before=new Float32Array(p.array);factory.groundAt(mesa,24,-37);
report.terrainConforming=samples>0&&maxGap<=.001;
report.groundingIdempotent=before.every((v,i)=>v===p.array[i]);
report.maximumBaseGap=maxGap;report.baseSamples=samples;
report.passed&&=report.terrainConforming&&report.groundingIdempotent;
const arch=factory.makeArch(6413);arch.updateMatrixWorld(true);
const front=new THREE.Raycaster(new THREE.Vector3(0,9.8,20),new THREE.Vector3(0,0,-1),0,40).intersectObject(arch,true)[0];
const back=new THREE.Raycaster(new THREE.Vector3(0,9.8,-20),new THREE.Vector3(0,0,1),0,40).intersectObject(arch,true)[0];
report.archFacesOutward=!!front&&!!back&&front.point.z>2&&front.face.normal.z>.5&&back.point.z<-2&&back.face.normal.z<-.5;
report.archPassageOpen=[1,2.65,4].every(y=>new THREE.Raycaster(new THREE.Vector3(0,y,20),new THREE.Vector3(0,0,-1),0,40).intersectObject(arch,true).length===0);
report.passed&&=report.archFacesOutward&&report.archPassageOpen;
mkdirSync('output/geology-review',{recursive:true});writeFileSync('output/geology-review/validation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
