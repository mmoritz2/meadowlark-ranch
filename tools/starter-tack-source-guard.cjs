const {normalizeCoyoteCragCompositionSource}=require('./coyote-crag-composition-source-guard.cjs');
const {normalizeGrassArchSource}=require('./grass-arch-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=path.join(__dirname,'fixtures/starter-tack-2986289');
const changes=JSON.parse(fs.readFileSync(path.join(fixture,'source-changes.json'))),preimage=JSON.parse(fs.readFileSync(path.join(fixture,'preimage-SHA.json')));
const markers={'ranch3d.html':'basic-riding-tack.mjs?v=starter-tack-2','assets/tack-collection-models.js':'basic-riding-tack.mjs?v=starter-tack-2','assets/features/on-foot.js':'basicLocalRiding:true','assets/features/index.js':'on-foot.js?v=starter-tack-2'};
function normalizeStarterTackSource(source,file){
 try{source=normalizeGrassArchSource(source,file);}catch(error){error.message='Entire original298 body restoration requires the approved grass/camera preimage: '+error.message;throw error;}
 source=normalizeCoyoteCragCompositionSource(source,file);
 if(!markers[file]||!source.includes(markers[file]))return source;
 for(const c of changes.toReversed().filter(c=>c.file===file)){assert.equal(source.split(c.after).length-1,c.occurrences,'Exactly declared starter visual hook '+file+': '+c.after.slice(0,80));source=source.replace(c.after,c.before);}
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),preimage[file],'Entire original298 body restored '+file);
 return source;
}
module.exports={normalizeStarterTackSource};
