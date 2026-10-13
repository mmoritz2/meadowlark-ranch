const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const changes=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ribbon-award-8733008/source-changes.json')));
// Keep the final-award repair separate from the six physical-distance literals.
// Subsequent adapters still restore the original whole runtime bodies/hashes.
function normalizeRibbonAwardSource(source,file){
 if(file!=='ranch3d.html'||!source.includes('ribbon-awards.mjs')&&!source.includes('ribbonsAwarded'))return source;
 for(const change of changes.toReversed()){
  assert.equal(source.split(change.after).length-1,change.occurrences,'Exactly declared final-ribbon seam '+change.after.slice(0,100));
  source=source.replace(change.after,change.before);
 }
 return source;
}
module.exports={normalizeRibbonAwardSource};
