const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/character-cache-a0f3837/contract.json'),'utf8'));
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
// Outer leaf: restore only the complete reserved cache group to its literal
// a0f3837 owner. Historical subjects continue to the unchanged older guards.
function normalizeCharacterCacheSource(source,file){
 const expected=contract.ownerBeforeSHA256[file];if(!expected)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 if(sha(source)===expected||!text.includes(contract.version))return source;
 let parent=text;
 for(const c of contract.changes.filter(c=>c.file===file)){
  assert.equal(parent.split(c.after).length-1,c.occurrences,'One exact Character98 cache import '+file);
  assert.equal(parent.split(c.before).length-1,0,'No mixed previous/Character98 cache import '+file);
  parent=parent.replace(c.after,c.before);
 }
 assert.equal(sha(parent),expected,'Entire literal a0f3837 Character98 cache owner restored '+file);
 return buffer?Buffer.from(parent):parent;
}
function assertCharacterCacheCurrent(source,file){
 const expected=contract.ownerAfterSHA256[file];assert(expected,'Declared Character98 cache owner '+file);
 assert.equal(sha(source),expected,'Whole current Character98 cache owner '+file);
 for(const c of contract.changes.filter(c=>c.file===file))assert.equal(source.toString().split(c.after).length-1,c.occurrences,'Current exact Character98 declaration '+file);
 return true;
}
// The narrow read seam for preservation callers: apply this before any older
// source inverse. It never edits those guard modules, fixtures or assertions.
const characterCacheRead=read=>file=>normalizeCharacterCacheSource(read(file),file);
module.exports={normalizeCharacterCacheSource,assertCharacterCacheCurrent,characterCacheRead};
