const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/published-world-885e882/import-changes.json')));
// Only exact published import literals are restored. Grouping the native
// historical/current cache aliases rejects unknown, deleted, duplicate and
// mixed declarations before the unchanged complete-body preimages run.
function normalizePublishedCacheSource(source,file){
 const groups=new Map();
 for(const c of [...contract.currentChanges,...contract.historicalAliases]){
  if(c.file!==file)continue;
  const values=groups.get(c.before)||new Set([c.before]);values.add(c.after);groups.set(c.before,values);
 }
 for(const [before,values]of groups){
  const counts=[...values].map(value=>({value,count:source.split(value).length-1}));
  assert.equal(counts.reduce((n,c)=>n+c.count,0),1,'Exactly one original or declared published import '+file+': '+before);
  const found=counts.find(c=>c.count===1).value;
  if(found!==before)source=source.replace(found,before);
 }
 return source;
}
module.exports={normalizePublishedCacheSource};
