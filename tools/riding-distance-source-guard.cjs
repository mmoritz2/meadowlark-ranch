const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const changes=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/riding-distance-8733008/source-changes.json')));
// Reverse only the six independently reviewed physical-distance seams. The
// existing cache/crag/starter adapters still verify the original whole bodies.
function normalizeRidingDistanceSource(source,file){
 if(file!=='ranch3d.html'||!source.includes('ridingTravelStart')&&!source.includes('riding-distance.mjs'))return source;
 for(const change of changes.toReversed()){
  assert.equal(source.split(change.after).length-1,change.occurrences,'Exactly declared riding-distance seam '+change.after.slice(0,100));
  source=source.replace(change.after,change.before);
 }
 return source;
}
module.exports={normalizeRidingDistanceSource};
