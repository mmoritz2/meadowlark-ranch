import * as THREE from '../../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../../assets/ranch-architecture.js';
import {writeFileSync,mkdirSync} from 'node:fs';

const panes=[];
const factory=createRanchArchitecture({THREE,loadTextures:false,glowPanes:panes});
const buildings=[factory.buildBarn(),factory.buildCottage()];
const report={passed:true,glowingMaterialRegistered:panes.length===1,buildings:[]};
for(const g of buildings) {
  g.updateMatrixWorld(true);
  let finite=true;
  g.traverse(o=>{if(o.geometry)for(const a of Object.values(o.geometry.attributes))
    finite&&=Array.from(a.array).every(Number.isFinite);});
  const barn=g.userData.architecture.kind==='barn';
  const z=g.userData.architecture.depth/2;
  // Probe a point within a glazing quadrant (away from cross mullions).
  const ray=new THREE.Raycaster(new THREE.Vector3(barn?2.49:1.21,barn?2.4:1.61,z+2),new THREE.Vector3(0,0,-1));
  const hit=ray.intersectObject(g,true)[0];
  const windowRecess=!!hit&&hit.object.material.name==='Ranch | window glass'&&hit.point.z<z;
  const wallray=new THREE.Raycaster(new THREE.Vector3(barn?2.49:1.21,.4,z+2),new THREE.Vector3(0,0,-1));
  const wall=wallray.intersectObject(g,true)[0];
  const solidWall=!!wall&&wall.point.z>z;
  const entry={...g.userData.architecture,finiteGeometry:finite,windowRecess,solidWall,
    windowDepth:hit?Number((z-hit.point.z).toFixed(4)):null};
  report.buildings.push(entry);report.passed&&=finite&&windowRecess&&solidWall;
}
const shelter=new THREE.Group(),first=factory.detailRunIn(shelter);
report.shelterAdditionsIdempotent=factory.detailRunIn(shelter)===first&&shelter.children.length===1;
report.passed&&=report.shelterAdditionsIdempotent&&report.glowingMaterialRegistered;
mkdirSync('output/architecture-review',{recursive:true});
writeFileSync('output/architecture-review/validation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
