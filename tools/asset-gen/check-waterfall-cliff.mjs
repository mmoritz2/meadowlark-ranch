import * as THREE from '../../assets/vendor/three/build/three.module.js';
import {createGeology} from '../../assets/geology.js';
import {mkdirSync,writeFileSync} from 'node:fs';
const geology=createGeology({THREE,loadTextures:false});
const cliff=geology.makeWaterfallCliff({width:34,lip:15,foot:0,seed:9031});cliff.updateMatrixWorld(true);
const report={passed:true,...cliff.userData.geology,finite:true,waterSamples:0,waterOcclusions:[]};
cliff.traverse(m=>{if(m.geometry)for(const a of Object.values(m.geometry.attributes))report.finite&&=Array.from(a.array).every(Number.isFinite);});
for(let k=0;k<=18;k++){
  const v=.025+k*.95/18,y=14.3-14.5*v,z=.45+v*v*2.4;
  for(const across of[-1,-.5,0,.5,1]){
    const x=across*2.9*(1+v*.4),hit=new THREE.Raycaster(new THREE.Vector3(x,y,30),new THREE.Vector3(0,0,-1)).intersectObject(cliff,true)[0];
    if(hit&&hit.point.z>=z-.015)report.waterOcclusions.push({x,y,z,rockZ:hit.point.z});report.waterSamples++;
  }
}
const front=new THREE.Raycaster(new THREE.Vector3(11,6,30),new THREE.Vector3(0,0,-1)).intersectObject(cliff,true)[0];
const back=new THREE.Raycaster(new THREE.Vector3(11,6,-30),new THREE.Vector3(0,0,1)).intersectObject(cliff,true)[0];
const top=new THREE.Raycaster(new THREE.Vector3(10,25,-3),new THREE.Vector3(0,-1,0)).intersectObject(cliff,true)[0];
report.solidDepth=front&&back?front.point.z-back.point.z:null;
report.frontNormalZ=front?.face.normal.z;report.backNormalZ=back?.face.normal.z;
report.closedTop=!!top&&top.face.normal.y>0;
report.passed=report.finite&&report.waterOcclusions.length===0&&report.solidDepth>4&&report.frontNormalZ>0&&report.backNormalZ<0&&report.closedTop&&report.triangles<30000;
mkdirSync('output/waterfall-review',{recursive:true});writeFileSync('output/waterfall-review/validation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
