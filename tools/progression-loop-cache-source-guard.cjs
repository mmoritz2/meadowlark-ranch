const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {normalizeActivityRuntimeSource}=require('./activity-runtime-source-guard.cjs');
const {changes}=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/progression-loop-243dbfb/contract.json'),'utf8'));
// Reverse only the four reviewed import literals. Older subjects and unknown
// versions are left intact for the existing exact-import/whole-body guards;
// no generic version stripping or runtime-source projection is performed here.
function normalizeProgressionLoopCacheSource(source,file){
 source=normalizeActivityRuntimeSource(source,file);
 for(const c of changes.filter(c=>c.file===file)){
  const count=value=>source.split(value).length-1;
  if(!source.includes(c.after))continue;
  assert.equal(count(c.after),c.occurrences,'Exactly one reviewed progression-loop import '+file);
  assert.equal(count(c.before),0,'No mixed original/reviewed progression-loop import '+file);
  source=source.replace(c.after,c.before);
 }
 return source;
}
module.exports={normalizeProgressionLoopCacheSource};
