/* Geometry-only release contract: a new library (as on document navigation)
 * refetches the manifest, keys binary requests by its digest, and gives real
 * feature aliases the same new shape. No runtime import cache changes needed.
 * Usage: node tools/test-native-sculpt-cache.mjs --baseline-dir=/tmp/fixed-before */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),baselineDir=process.argv.find(s=>s.startsWith('--baseline-dir='))?.slice(15);
assert(baselineDir,'Supply the fixed pre-sculpt snapshot; do not silently rebaseline');
const before=JSON.parse(fs.readFileSync(resolve(baselineDir,'manifest.json'))),after=JSON.parse(fs.readFileSync(new URL('assets/models/native-roster/manifest.json',root))),hash=a=>createHash('sha256').update(a).digest('hex');
const oldBytes=fs.readFileSync(resolve(baselineDir,'percheron.bin'));
assert.equal(hash(oldBytes),before.breeds.percheron.sha256,'Fixed baseline file agrees with its original digest');
assert.equal(hash(fs.readFileSync(new URL('assets/'+after.breeds.percheron.file,root))),after.breeds.percheron.sha256,'New binary agrees with new manifest digest');
assert.notEqual(before.breeds.percheron.sha256,after.breeds.percheron.sha256,'This release test must exercise an actual changed binary');
const threeURL=new URL('assets/vendor/three/build/three.module.js',root).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`));
const THREE=await import(threeURL),{GLTFLoader}=await import(new URL('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js',root)),{clone}=await import(new URL('assets/vendor/three/examples/jsm/utils/SkeletonUtils.js',root));
const {createBreedLibrary}=await import(new URL('assets/breed-models.js',root)),{EXPANSION_HORSE_BREEDS}=await import(new URL('assets/expansion-horses.js',root)),{registerNewBreedPreviews}=await import(new URL('assets/features/new-breeds.js',root)),{registerRosterPreviews}=await import(new URL('assets/features/horse-roster.js',root));
const requests=[],sources=[],textures=[];let current=before;
const originalFetch=global.fetch;
global.fetch=async(input,init)=>{const url=new URL(input);assert.equal(url.protocol,'file:','No network in this regression');requests.push({url,cache:init?.cache});if(url.pathname.endsWith('/models/native-roster/manifest.json'))return new Response(JSON.stringify(current));return new Response(url.searchParams.get('build')===before.breeds.percheron.sha256?oldBytes:fs.readFileSync(fileURLToPath(url)));};
class SourceLoader extends GLTFLoader {constructor(manager){super(manager);this.register(()=>({name:'CPU_TEXTURE_ONLY',loadTexture(){return Promise.resolve(new THREE.Texture());}}));}async loadAsync(input){const url=new URL(input);assert.equal(url.protocol,'file:');sources.push(url.href);const b=fs.readFileSync(fileURLToPath(url));return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}}
const cpuTHREE={...THREE,TextureLoader:class{async loadAsync(url){textures.push(String(url));return new THREE.Texture();}}};
const bodyHash=asset=>hash(Buffer.from(asset.skin.geometry.attributes.position.array.buffer));
try {
 const oldLibrary=createBreedLibrary({THREE:cpuTHREE,GLTFLoader:SourceLoader,clone});await oldLibrary.manifestReady;const oldAsset=await oldLibrary.load('percheron'),oldShape=bodyHash(oldAsset);
 current=after;
 const freshLibrary=createBreedLibrary({THREE:cpuTHREE,GLTFLoader:SourceLoader,clone});
 const belgian=EXPANSION_HORSE_BREEDS.find(row=>row[0]==='belgian');freshLibrary.alias(belgian[0],belgian[7].body,belgian); // Real row, registered before asynchronous catalog completion.
 await freshLibrary.manifestReady;registerNewBreedPreviews(freshLibrary);registerRosterPreviews(freshLibrary); // Also cover registration after completion.
 const assets=await Promise.all(['percheron','belgian','suffolk','rimewalker'].map(id=>freshLibrary.load(id)));
 const newShape=bodyHash(assets[0]);assert.notEqual(newShape,oldShape,'Fresh library renders changed positions, not merely new metadata');
 for(let i=0;i<assets.length;i++){assert.equal(assets[i].profile.nativeVariant.sha256,after.breeds.percheron.sha256,'Alias inherits current foundation revision');assert.equal(bodyHash(assets[i]),newShape,'Alias receives identical sculpted geometry');}
 assert.equal(assets[1].profile.id,'belgian');assert.equal(assets[1].profile.nativeRosterColors.body,belgian[5],'Belgian retains its distinct appearance');assert.equal(assets[3].profile.nativeRosterAppearance.coat,'ice','Fantasy alias retains its own theme');
 assert.equal(await oldLibrary.load('percheron'),oldAsset,'Existing live library intentionally keeps prepared actors stable');assert.equal(bodyHash(oldAsset),oldShape,'Fresh-library load does not mutate old prepared geometry');
 const manifests=requests.filter(r=>r.url.pathname.endsWith('/manifest.json'));assert.equal(manifests.length,4);assert(manifests.every(r=>r.cache==='no-store'),'Both library manifests bypass stale HTTP caches');
 const shapes=requests.filter(r=>r.url.pathname.endsWith('/percheron.bin'));assert.equal(shapes.length,2,'One shape fetch per library, shared by all four aliases');assert.deepEqual(shapes.map(r=>r.url.searchParams.get('build')),[before.breeds.percheron.sha256,after.breeds.percheron.sha256],'Same path fetches a distinct SHA-keyed URL after release');
 assert(sources.every(url=>new URL(url).searchParams.has('build')),'Source assets retain explicit revision keys');assert.equal(sources.length,4,'Each library loads the shared source and approved motion GLBs once');assert.deepEqual(sources.slice(0,2).sort(),sources.slice(2).sort(),'Unchanged source and motion GLBs do not need new revisions');assert.equal(new Set(sources).size,2,'Aliases reuse both native files');
 assert.equal(textures.length,2,'Coat shared by aliases within each library');assert.equal(textures[0],textures[1],'Unchanged coat remains keyed to its own digest');
 console.log(JSON.stringify({pass:true,aliases:assets.map(a=>a.key),manifestsNoStore:manifests.length,binaryRequests:shapes.map(r=>r.url.href),oldShape,newShape,limitation:'Already-open documents retain prepared actors until navigation/reload; offline service-worker fallback may retain old assets.'},null,2));
} finally {global.fetch=originalFetch;}
