// Reviewed import aliases only. Source-art changes have a separate exact inverse.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const declaration=fs.readFileSync(path.join(__dirname,'fixtures/horse-realism-579b5cf/cache-changes.json'));
assert.equal(crypto.createHash('sha256').update(declaration).digest('hex'),'3bf9d654c90f7cbdf0614f5547b5e83ffde7bb5220e1caa6fcadbed6e6a262b6','Exact reviewed horse-realism cache declaration');
const contract=JSON.parse(declaration);
function normalizeHorseRealismCacheSource(source,file){
 const rows=contract.changes.filter(row=>row.file===file);if(!rows.length)return source;
 const buffer=Buffer.isBuffer(source);let text=buffer?source.toString('utf8'):source;
 for(const {before,after,occurrences}of rows){
  const old=text.split(before).length-1,current=text.split(after).length-1;
  assert.equal(old+current,occurrences,'One exact original or reviewed horse-realism import '+file+': '+before);
  if(current)text=text.replaceAll(after,before);
 }
 return buffer?(text===source.toString('utf8')?source:Buffer.from(text)):text;
}
module.exports={normalizeHorseRealismCacheSource};
