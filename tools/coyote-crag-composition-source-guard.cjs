const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const changes=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/coyote-crag-7009c41/source-changes.json')));
// Only the four frozen central-rock composition/cache literals may be reversed.
// Earlier whole-source hashes still validate every other owner and runtime body.
function normalizeCoyoteCragCompositionSource(source,file){
 const marker=file==='ranch3d.html'?'world-photoscans.js?v=coyote-scan-composition-2':file==='assets/world-photoscans.js'?'shoulderOffset:.43':null;
 if(!marker||!source.includes(marker))return source;
 for(const c of changes.toReversed().filter(c=>c.file===file)){
  assert.equal(source.split(c.after).length-1,c.occurrences,'Exactly declared Coyote rock composition '+file+': '+c.after.slice(0,90));
  source=source.replace(c.after,c.before);
 }
 return source;
}
module.exports={normalizeCoyoteCragCompositionSource};
