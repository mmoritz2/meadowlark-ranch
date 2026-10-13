const assert=require('node:assert/strict');
// Camera reversal precedes GrassArch's whole-body d5b9441 source check.
// Only this reviewed import cache is removed; all other body bytes remain.
const before="'./assets/follow-camera.js?v=riding-stability-1'";
const after="'./assets/follow-camera.js?v=camera-authored-parts-4'";
function normalizeAuthoredCameraSource(source,file){
 if(file!=='ranch3d.html')return source;
 const count=literal=>source.split(literal).length-1;
 if(source.includes(after)){
  assert.equal(count(after),1,'Exactly one reviewed authored-parts camera import');
  assert.equal(count(before),0,'No duplicate legacy camera import beside the reviewed import');
  return source.replace(after,before);
 }
 if(source.includes("'./assets/follow-camera.js?v="))assert.equal(count(before),1,'Only the exact original camera cache may bypass reversal');
 return source;
}
module.exports={normalizeAuthoredCameraSource};
