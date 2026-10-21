// These preservation suites deliberately exercise the retained Adult98 source
// unit. Portrait99 has a different topology and a separate actual-asset suite.
// Only the old head recipe and its source scene are pinned here; every original
// complexion/normal/lifetime assertion and the remaining production kit run.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {register} from 'node:module';import {fileURLToPath,pathToFileURL} from 'node:url';
const runtime=path.resolve(process.env.RIDER_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url))),prefix=pathToFileURL(runtime+'/').href;
if(fs.readFileSync(new URL('assets/rider-heads.js',prefix),'utf8').includes('preparePortrait99')){
 const fixture=fs.readFileSync(new URL('./fixtures/rider-portrait99/legacy-rider-heads.js.txt',import.meta.url),'utf8');
 if(createHash('sha256').update(fixture).digest('hex')!=='e0892733039bb063fabe08b717a818716639812c910ca281f4988900ea0cf95e')throw Error('Pinned Adult98 fixture drift');
 const source=fixture.replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_all,_q,s)=>'from '+JSON.stringify(new URL('assets/'+s.slice(2),prefix).href));
 register('data:text/javascript,'+encodeURIComponent(`import fs from 'node:fs';export async function load(u,c,n){const p=new URL(u);if(p.href.startsWith(${JSON.stringify(prefix)})&&p.pathname.endsWith('/assets/rider-heads.js'))return{format:'module',source:${JSON.stringify(source)},shortCircuit:true};if(p.href.startsWith(${JSON.stringify(prefix)})&&p.pathname.endsWith('/assets/rider-model-base.js')){let s=fs.readFileSync(p,'utf8'),a='prepareRiderHead(THREE,skin,eyes,brows,gPortrait.scene';if(s.split(a).length!==2)throw Error('Legacy98 source scene seam changed');s=s.replace(a,'prepareRiderHead(THREE,skin,eyes,brows,gHead.scene');return{format:'module',source:s,shortCircuit:true};}return n(u,c);}`));
}
