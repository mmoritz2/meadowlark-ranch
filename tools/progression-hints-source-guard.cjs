const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {change}=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/progression-hints-243dbfb/contract.json'),'utf8'));
// This compatibility seam changes only which existing completed-race ledger
// permits optional hints. All downstream whole-body source pins remain intact.
function normalizeProgressionHintsSource(source,file){
 if(file!=='ranch3d.html')return source;
 const before=source.split(change.before).length-1,after=source.split(change.after).length-1;
 assert.equal(before+after,1,'Exactly one original or reviewed progression-hint predicate');
 return after?source.replace(change.after,change.before):source;
}
module.exports={normalizeProgressionHintsSource};
