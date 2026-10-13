const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=path.join(__dirname,'fixtures/course-turf-blades-3944c9e'),load=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const contract=load('contract.json'),changes=load('source-changes.json'),adapters=load('test-adapter-changes.json'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function reverse(source,file,rows,label){
 for(const c of rows.toReversed().filter(c=>c.file===file)){
  const count=s=>source.split(s).length-1;
  assert.equal(count(c.after),c.occurrences||1,'One exact accepted '+label+' '+file);
  assert.equal(source.replace(c.after,'').split(c.before).length-1,0,'No mixed original/accepted '+label+' '+file);
  source=source.replace(c.after,c.before);
 }return source;
}
// Lower historical source layers receive unchanged earlier bodies when no
// precise new addition exists. Every public full source gate below still pins
// a complete prior owner; unknown versions and body drift are never discarded.
function undoCourseTurfBladesSource(source,file){
 const rows=changes.filter(c=>c.file===file);if(!rows.length)return source;
 if(!rows.some(c=>source.includes(c.after)))return source;
 return reverse(source,file,changes,'course turf/blade source');
}
function normalizeCourseTurfBladesTestSource(source,file){
 const hash=contract.testAdapterPreimages[file];if(!hash)return source;
 if(sha(source)===hash||(contract.historicalTestSHA256[file]||[]).includes(sha(source)))return source;
 source=reverse(source,file,adapters,'course turf/blade observer');
 assert.equal(sha(source),hash,'Entire original3944 observer restored '+file);return source;
}
for(const[file,hash]of Object.entries(contract.dependencySHA256))assert.equal(sha(normalizeCourseTurfBladesTestSource(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),file)),hash,'Exact3944 prior source dependency '+file);
function normalizeCourseTurfBladesSource(source,file){
 const row=contract.files[file];if(!row)return source;
 if(row.new){assert.equal(sha(source),row.candidateSHA256,'Complete new original course turf owner '+file);return source;}
 source=undoCourseTurfBladesSource(source,file);
 if(sha(source)!==row.rawSHA256){
  // Lazy loading avoids Reviewed/Grass initialization cycles. Its entries
  // call only the literal undo, never this complete-owner projection again.
  const prior=require('./grass-arch-source-guard.cjs').normalizeGrassArchSource(source,file);
  assert.equal(sha(prior),row.priorProjectionSHA256,'Entire3944 prior body through unchanged historical guards '+file);
 }return source;
}
function normalizeCourseTurfBladesFixtureChanges(diff,baseline){
 assert.equal(baseline,contract.fixtureDiffBaseline,'Exact prior activity fixture baseline');
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate own fixture diff rows');
 const own='tools/fixtures/course-turf-blades-3944c9e/contract.json',allowed={...contract.approvedAddedFixtureSHA256,[own]:sha(fs.readFileSync(path.join(dir,'contract.json')))};
 const remaining=rows.filter(file=>{if(!Object.hasOwn(allowed,file))return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),allowed[file],'Exact declared added own fixture '+file);return false;});
 return remaining.length?remaining.join('\n')+'\n':'';
}
module.exports={undoCourseTurfBladesSource,normalizeCourseTurfBladesSource,normalizeCourseTurfBladesTestSource,normalizeCourseTurfBladesFixtureChanges};
