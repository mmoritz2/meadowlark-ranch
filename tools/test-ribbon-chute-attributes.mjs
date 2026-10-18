import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const dep=process.env.RIBBON_CHUTE_DEPENDENCY_ROOT||fileURLToPath(new URL('../',import.meta.url));
const T=await import(pathToFileURL(path.join(dep,'assets/vendor/three/build/three.module.js')).href);
const {createWaterfallArt}=await import(pathToFileURL(path.join(dep,'assets/waterfall-art.js')).href);
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/ribbon-chute-cd4b62d/native-state.json',import.meta.url)));
const recipe=JSON.parse(fs.readFileSync(new URL('./fixtures/ribbon-chute-cd4b62d/source-edits.json',import.meta.url)))['assets/features/world-water.js'];
const source=fs.readFileSync(new URL('../assets/features/world-water.js',import.meta.url),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
let parent=source;for(const e of [...recipe.changes].reverse()){assert.equal(parent.split(e.after).length-1,e.occurrences);parent=parent.replace(e.after,e.before);}
const vendor=fs.readFileSync(path.join(dep,'assets/vendor/three/build/three.module.js'),'utf8'),waterSource=fs.readFileSync(path.join(dep,'assets/waterfall-art.js'),'utf8');
const start=vendor.indexOf('function WebGLBindingStates('),end=vendor.indexOf('\nfunction WebGLBufferRenderer(',start);assert(start>=0&&end>start);
const bindingSource=vendor.slice(start,end),WebGLBindingStates=new Function('IntType',bindingSource+';return WebGLBindingStates;')(T.IntType);
const tileBytes=fs.readFileSync(path.join(dep,fixture.terrainFixture.file));assert.equal(sha(tileBytes),fixture.terrainFixture.sha256);const tile=JSON.parse(tileBytes);
const terrain=(x,z)=>{const gx=(x-tile.origin)/tile.step-tile.ix0,gz=(z-tile.origin)/tile.step-tile.iz0,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*tile.nx+ix;assert(ix>=0&&iz>=0&&ix+1<tile.nx&&iz+1<tile.nz);const a=tile.heights[i],d=tile.heights[i+1],b=tile.heights[i+tile.nx],c=tile.heights[i+tile.nx+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);};
function makeChute(text){
 const bandStart=text.indexOf(' function band(rows,cols,mat,name){'),bandEnd=text.indexOf('\n\n /* ================= 1.',bandStart);assert(bandStart>=0&&bandEnd>bandStart);
 const band=new Function('THREE','scene',text.slice(bandStart,bandEnd)+';return band;')(T,{add(){}});
 const begin=text.indexOf('   const rows=[];',text.indexOf('/* below the shelf')),end=text.indexOf('   const oldRockStarts=',begin);assert(begin>=0&&end>begin);
 const P={},art=createWaterfallArt({THREE:T});new Function('THREE','P','band','W','groundH','FALL_X','SHELF_Z','TOE_Z',text.slice(begin,end))(T,P,band,{waterfallArt:art},terrain,342,67.9,76);
 return {mesh:P.chute,geometry:P.chute.geometry,material:art.material};
}
function controlled(make){const saved=Math.random;let calls=0,state=0x341ab9;Math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};try{const result=make(),at=calls,future=Array.from({length:24},()=>Math.random());return{...result,calls:at,future};}finally{Math.random=saved;}}
const baseline=controlled(()=>makeChute(parent)),candidate=controlled(()=>makeChute(source));
const dispose=o=>{o.geometry.dispose();o.material.dispose();};
function fakeContext(){
 let vao=null,bound=null,next=0;const generic=new Map(),states=new Map(),events=[],current=()=>states.get(vao);
 const gl={MAX_VERTEX_ATTRIBS:1,ARRAY_BUFFER:2,ELEMENT_ARRAY_BUFFER:3,FLOAT:4,INT:5,UNSIGNED_INT:6,getParameter(){return 16;},createVertexArray(){const id=++next;states.set(id,{enabled:new Set(),pointers:new Map()});return id;},bindVertexArray(id){vao=id;},enableVertexAttribArray(i){current().enabled.add(i);},disableVertexAttribArray(i){current().enabled.delete(i);},vertexAttribDivisor(){},bindBuffer(target,b){if(target===2)bound=b;},vertexAttribPointer(i,size,type,normalized,stride,offset){current().pointers.set(i,{buffer:bound,size,stride,offset});},vertexAttribIPointer(){throw Error('Unexpected integer pointer');},vertexAttrib1fv(i,v){generic.set(i,Array.from(v));events.push([i,...v]);},vertexAttrib2fv(i,v){generic.set(i,Array.from(v));events.push([i,...v]);},vertexAttrib3fv(i,v){generic.set(i,Array.from(v));events.push([i,...v]);},vertexAttrib4fv(i,v){generic.set(i,Array.from(v));events.push([i,...v]);},deleteVertexArray(){}};
 return{gl,events,value(i,vertex=0){const s=current();if(s.enabled.has(i)){const p=s.pointers.get(i);return p.buffer.array[vertex*p.stride/4+p.offset/4];}return(generic.get(i)||[0])[0];},attributes:{update(){},get(a){return{buffer:a,type:4,bytesPerElement:4};}}};
}
const attrib=location=>({location,locationSize:1}),actualLocations=fixture.trace[0].attributes,program={id:fixture.trace[0].programID,getAttributes:()=>({position:attrib(0),uv:attrib(1),normal:attrib(2),...Object.fromEntries(Object.entries(actualLocations).map(([name,a])=>[name,attrib(a.location)]))})};
function sequence(target){
 const c=fakeContext(),binding=WebGLBindingStates(c.gl,{},c.attributes,{isWebGL2:true}),g=target.geometry;
 binding.setup(target.mesh,target.material,program,g,g.index);const first=Object.fromEntries(Object.entries(actualLocations).map(([name,a])=>[name,c.value(a.location)]));
 // Actual native speed/across values and locations drive this controlled collision.
 // It demonstrates the cache hazard without claiming which native program wrote them.
 const bad=fixture.trace.find(r=>r.attributes.cascadeAcross.currentVertexAttrib[0]===0),other=new T.BufferGeometry();other.setAttribute('position',new T.Float32BufferAttribute([0,0,0],3));
 const defaults={atSpeed:bad.attributes.cascadeSpeed.currentVertexAttrib.slice(0,1),atAcross:bad.attributes.cascadeAcross.currentVertexAttrib.slice(0,1)},p={id:program.id+1,getAttributes:()=>({position:attrib(0),atSpeed:attrib(actualLocations.cascadeSpeed.location),atAcross:attrib(actualLocations.cascadeAcross.location)})};
 binding.setup({}, {defaultAttributeValues:defaults},p,other,null);const at=c.events.length;binding.setup(target.mesh,target.material,program,g,g.index);
 const after=Object.fromEntries(Object.entries(actualLocations).map(([name,a])=>[name,c.value(a.location)])),allRows=Array.from({length:g.attributes.position.count},(_,i)=>Object.fromEntries(Object.entries(actualLocations).map(([name,a])=>[name,c.value(a.location,i)])));other.dispose();return{first,after,newDefaultCalls:c.events.length-at,allRows};
}

test('one counted source addition preserves exact parent body and current waterfall/vendor dependencies',()=>{
 assert.equal(sha(source),recipe.afterSHA256);assert.equal(sha(parent),recipe.beforeSHA256);assert.equal(recipe.changes.length,1);assert.equal(recipe.beforeSHA256,fixture.dependencySHA256['assets/features/world-water.js']);
 for(const rel of ['assets/waterfall-art.js','assets/vendor/three/build/three.module.js'])assert.equal(sha(fs.readFileSync(path.join(dep,rel))),fixture.dependencySHA256[rel]);
 assert(source.startsWith("import {remodelRibbonFallsCliff} from '../ribbon-falls-landform.mjs?v=ribbon-falls-2';"));
 const addition=recipe.changes[0].after.replace(recipe.changes[0].before,'');assert(!/new\s+(?:THREE|T)\.(?:Mesh|BufferGeometry|\w*Material)|Math\.random|groundH\(/.test(addition));
});

test('actual passive trace confirms same compiled chute owner with changed missing-default generic values',()=>{
 const trace=fixture.trace,first=trace[0];assert.equal(trace.length,4);assert.equal(first.geometry,fixture.originalChute.geometry);assert.equal(first.attributes.cascadeAcross.currentVertexAttrib[0],-1);assert.equal(first.attributes.cascadeSpeed.currentVertexAttrib[0],Math.fround(.6));
 for(const r of trace){assert.equal(r.owner,first.owner);assert.equal(r.geometry,first.geometry);assert.equal(r.programID,first.programID);assert.equal(r.actualProgramMatchesCompiled,true);assert.equal(r.geometryTriangles,384);for(const[name,a]of Object.entries(r.attributes)){assert.equal(a.geometryAttribute,null);assert.equal(a.arrayEnabled,false);assert.equal(a.arrayBufferBound,false);assert.deepEqual(a.materialDefault,first.attributes[name].materialDefault);}}
 for(const r of trace.slice(1)){assert.equal(r.attributes.cascadeAcross.currentVertexAttrib[0],0);assert.equal(r.attributes.cascadeSpeed.currentVertexAttrib[0],-1);}
});

test('actual current chute source produces225 vertices384 faces with all four old typed buffers and index exact to captured native',()=>{
 const g=candidate.geometry,b=baseline.geometry;assert.equal(g.attributes.position.count,225);assert.equal(g.index.count/3,384);assert.equal(Object.keys(b.attributes).length,4);
 for(const[name,a]of Object.entries(b.attributes)){assert.equal(sha(bytes(a.array)),fixture.originalChute.attributes[name].sha256);assert.deepEqual(g.attributes[name].array,a.array);assert.equal(g.attributes[name].itemSize,a.itemSize);assert.equal(g.attributes[name].normalized,a.normalized);}
 assert.equal(sha(bytes(b.index.array)),fixture.originalChute.index.sha256);assert.deepEqual(g.index.array,b.index.array);assert.deepEqual(g.boundingSphere,b.boundingSphere);assert.deepEqual(candidate.mesh.matrix.elements,baseline.mesh.matrix.elements);
 assert.equal(candidate.mesh.material,candidate.material);assert.equal(candidate.material.name,baseline.material.name);assert.deepEqual(candidate.material.defaultAttributeValues,baseline.material.defaultAttributeValues);assert.equal(candidate.mesh.renderOrder,baseline.mesh.renderOrder);
 assert.equal(candidate.calls,baseline.calls);assert.deepEqual(candidate.future,baseline.future,'no added UUID or placement/global-random draw');
});

test('explicit full scalar schema costs3600 bytes and matches every source vertex with no ground displacement',()=>{
 let added=0;for(const[name,value]of [['cascadePhase',0],['cascadeSpeed',Math.fround(.6)],['cascadeAcross',-1],['cascadeMotion',0]]){const a=candidate.geometry.attributes[name];assert(a.array instanceof Float32Array);assert.equal(a.itemSize,1);assert.equal(a.count,225);assert.equal(a.normalized,false);assert(a.array.every(v=>v===value));added+=a.array.byteLength;}
 assert.equal(added,3600);assert.equal(Object.keys(candidate.geometry.attributes).length,8);assert(candidate.geometry.attributes.cascadeMotion.array.every(v=>v===0));
});

test('actual resident cached-VAO path reproduces measured bad values on parent and reads stable full vertex buffers on current source',()=>{
 const old=sequence(baseline),now=sequence(candidate);assert.equal(old.first.cascadeAcross,-1);assert.equal(old.first.cascadeSpeed,.6);assert.equal(old.after.cascadeAcross,0);assert.equal(old.after.cascadeSpeed,-1);assert.equal(old.newDefaultCalls,0);
 assert.equal(now.newDefaultCalls,0);for(const r of [now.first,now.after,...now.allRows]){assert.equal(r.cascadePhase,0);assert.equal(r.cascadeSpeed,Math.fround(.6));assert.equal(r.cascadeAcross,-1);assert.equal(r.cascadeMotion,0);}
});

test('unchanged shader branch makes measured acrosszero fully transparent and explicit negative across follow lateral UV',()=>{
 assert(waterSource.includes('cascadeWholeAcross=cascadeAcross>=0.0?cascadeAcross:uv.x;cascadeChute=cascadeAcross<0.0?1.0:0.0;'));assert(waterSource.includes('if(cascadeMotion>0.0)'));assert(waterSource.includes('smoothstep(0.0,.008,fx)*smoothstep(0.0,.008,1.0-fx)'));
 const smooth=(a,b,x)=>{const q=Math.max(0,Math.min(1,(x-a)/(b-a)));return q*q*(3-2*q);},edge=(across,u)=>{const x=across>=0?across:u;return smooth(0,.008,x)*smooth(0,.008,1-x);};
 for(let i=0;i<225;i++){const u=candidate.geometry.attributes.uv.getX(i);assert.equal(edge(0,u),0);assert.equal(edge(candidate.geometry.attributes.cascadeAcross.getX(i),u),i%9===0||i%9===8?0:1);}
 dispose(candidate);dispose(baseline);
});
