/* Portraits follow the active model catalog. Imported identities require their
 * own verified render; the earlier catalog keeps its existing display aliases. */
const LEGACY_DIR=new URL('./breed-thumbnails/',import.meta.url);
const IMPORT_DIR=new URL('./models/horse-imports/thumbnails/',import.meta.url);
const slug=value=>String(value??'').trim().toLowerCase().replace(/[\s_]+/g,'-').replace(/[^a-z0-9-]/g,'');
const ALIAS={thoroughbred:'thoro',thorobred:'thoro',clydesdale:'clyde',gypsy:'vanner','gypsy-vanner':'vanner',
 'akhal-teke':'akhal',lipizzaner:'lipiz',icelandic:'iceland','icelandic-horse':'iceland',
 'quarter-horse':'stock',shetland:'chestnut','shetland-pony':'chestnut','sport-horse':'sport',
 'bay-sport':'bay-sporthorse',starter:'bay-sporthorse',hero:'bay-sporthorse',
 unicorn3:'unicorn',pegasus3:'pegasus','dapple-grey':'grey','grey-andalusian':'grey'};

export function createBreedPortraits({manifestReady,bodyOf=()=>''}){
 let manifest=null,keys=null,records=null;
 const portraits={
  url(value){
   if(!keys)return null;
   const key=slug(value);if(!key)return null;
   if(manifest.requireExplicitMapping){
    const source=manifest.breeds?.[key],record=records.get(key);
    if(!source?.available||!record||record.modelSha256!==source.sha256)return null;
    const url=new URL(record.file,IMPORT_DIR);url.searchParams.set('build',record.sha256);return url.href;
   }
   let file=keys.has(key)?key:keys.has(ALIAS[key])?ALIAS[key]:keys.has(bodyOf(key))?bodyOf(key):'';
   if(!file){
    for(const candidate of keys)if((key.startsWith(candidate)||candidate.startsWith(key))&&candidate.length>file.length)file=candidate;
    if(!file&&keys.has(key.split('-')[0]))file=key.split('-')[0];
   }
   if(!file)return null;
   const url=new URL(file+'.webp',LEGACY_DIR);url.searchParams.set('v','artist-breeds-1');return url.href;
  }
 };
 portraits.ready=Promise.resolve(manifestReady).then(async active=>{
  manifest=active;
  const imported=!!manifest.requireExplicitMapping;
  const response=await fetch(new URL(imported?'render-validation.json':'index.json',imported?IMPORT_DIR:LEGACY_DIR),{cache:'no-store'});
  if(!response.ok)throw new Error('Horse portrait catalog HTTP '+response.status);
  const data=await response.json();
  if(imported){
   if(!Array.isArray(data.records)||!data.completeAvailableCatalog||data.errors?.length||data.blockedExternalRequests?.length)throw new Error('Imported horse portraits are incomplete');
   records=new Map(data.records.filter(row=>row.file===row.key+'.webp'&&/^[a-f0-9]{64}$/.test(row.sha256||'')).map(row=>[row.key,row]));
   keys=new Set(records.keys());
  }else{
   if(!Array.isArray(data))throw new Error('Invalid horse portrait catalog');
   keys=new Set(data.map(slug));
  }
  return portraits;
 });
 portraits.ready.catch(()=>{});
 return portraits;
}
