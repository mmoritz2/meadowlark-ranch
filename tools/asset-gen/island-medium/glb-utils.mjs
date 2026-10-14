import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

export const SOURCE_SHA='04a80fe9c2584bbea686cf9637009dd03b48905b229773c17a8cc611e8d21b58';
export const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const types={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
export function readGLB(file){
 const bytes=fs.readFileSync(file);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 let json,bin;
 for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),type=bytes.readUInt32LE(p+4);assert(p+8+n<=bytes.length);if(type===0x4e4f534a)json=JSON.parse(bytes.subarray(p+8,p+8+n));if(type===0x004e4942)bin=bytes.subarray(p+8,p+8+n);p+=8+n;}
 assert(json&&bin);return {json,bin,bytes,file,sha256:sha(bytes)};
}
export function readAccessor(doc,index){
 const a=doc.json.accessors[index],v=doc.json.bufferViews[a.bufferView],Type=types[a.componentType],width=widths[a.type];assert(Type&&width&&!a.sparse&&v.buffer===0);
 const start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||width*Type.BYTES_PER_ELEMENT,array=new Type(a.count*width);
 for(let i=0;i<a.count;i++){const chunk=doc.bin.subarray(start+i*stride,start+i*stride+width*Type.BYTES_PER_ELEMENT);Buffer.from(array.buffer,array.byteOffset+i*width*Type.BYTES_PER_ELEMENT,width*Type.BYTES_PER_ELEMENT).set(chunk);}
 return {array,type:a.type,componentType:a.componentType,normalized:a.normalized||false};
}
export function floatAttribute(attr){
 if(!attr.normalized)return Float32Array.from(attr.array);
 const signed=attr.componentType===5120||attr.componentType===5122,div=attr.componentType===5120?127:attr.componentType===5121?255:attr.componentType===5122?32767:65535;
 return Float32Array.from(attr.array,x=>signed?Math.max(-1,x/div):x/div);
}
export function primitiveData(doc,p){return {materialIndex:p.material,material:doc.json.materials[p.material].name,attributes:Object.fromEntries(Object.entries(p.attributes).map(([s,a])=>[s,readAccessor(doc,a)])),indices:Uint32Array.from(readAccessor(doc,p.indices).array)};}
export function boundsOf(position,indices){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],ids=indices||Array.from({length:position.length/3},(_,i)=>i);
 for(const i of ids)for(let k=0;k<3;k++){const p=position[i*3+k];assert(Number.isFinite(p));min[k]=Math.min(min[k],p);max[k]=Math.max(max[k],p);}return {min,max};
}
export function serializePart(part){return {...part,indices:Array.from(part.indices),attributes:Object.fromEntries(Object.entries(part.attributes).map(([s,a])=>[s,{...a,array:Array.from(a.array)}]))};}
export function deserializePart(part){return {...part,indices:Uint32Array.from(part.indices),attributes:Object.fromEntries(Object.entries(part.attributes).map(([s,a])=>[s,{...a,array:types[a.componentType].from(a.array)}]))};}

// Source image/material copier preserves embedded original wood maps byte-for-byte.
// The new leaf UV atlas deliberately does not inherit the incompatible old ARM UVs.
export function assembleGLB({source,woodParts,leafGeometry,atlasColor,atlasNormal,output,extras={}}){
 assert.equal(source.sha256,SOURCE_SHA);assert(source.json.nodes.every(n=>!n.matrix&&!n.translation&&!n.rotation&&!n.scale));
 const chunks=[],j={asset:{version:'2.0',generator:'Island Tree01 source-preserving medium canopy CPU assembly'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Island Tree01 medium source frame',mesh:0}],meshes:[{primitives:[]}],accessors:[],bufferViews:[],buffers:[],materials:[],images:[],textures:[],samplers:structuredClone(source.json.samplers||[]),extensionsUsed:['EXT_texture_webp'],extensionsRequired:['EXT_texture_webp'],extras};let offset=0;
 function blob(bytes,target){const pad=(-offset)&3;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}const row={buffer:0,byteOffset:offset,byteLength:bytes.length};if(target)row.target=target;j.bufferViews.push(row);chunks.push(bytes);offset+=bytes.length;return j.bufferViews.length-1;}
 function accessor(attr,target=34962){const width=widths[attr.type];assert(attr.array.length%width===0);const data=Buffer.from(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength),row={bufferView:blob(data,target),componentType:attr.componentType,count:attr.array.length/width,type:attr.type};if(attr.normalized)row.normalized=true;if(attr.type==='VEC3'&&target===34962){const b=boundsOf(attr.array);row.min=b.min;row.max=b.max;}j.accessors.push(row);return j.accessors.length-1;}
 const textureMap=new Map(),imageMap=new Map(),materialMap=new Map();
 function image(id){if(imageMap.has(id))return imageMap.get(id);const old=source.json.images[id];assert(old.bufferView!==undefined&&!old.uri);const view=source.json.bufferViews[old.bufferView],bytes=source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);const row={...structuredClone(old),bufferView:blob(bytes)};j.images.push(row);const n=j.images.length-1;imageMap.set(id,n);return n;}
 function texture(id){if(textureMap.has(id))return textureMap.get(id);const row=structuredClone(source.json.textures[id]);if(row.source!==undefined)row.source=image(row.source);for(const e of Object.values(row.extensions||{}))if(e.source!==undefined)e.source=image(e.source);j.textures.push(row);const n=j.textures.length-1;textureMap.set(id,n);return n;}
 function remapTextures(value){if(!value||typeof value!=='object')return;for(const [key,v]of Object.entries(value)){if(key.endsWith('Texture')&&v&&typeof v==='object'&&v.index!==undefined)v.index=texture(v.index);else remapTextures(v);}}
 function material(id){if(materialMap.has(id))return materialMap.get(id);const row=structuredClone(source.json.materials[id]);remapTextures(row);j.materials.push(row);const n=j.materials.length-1;materialMap.set(id,n);return n;}
 function addPart(part,mat){const attributes={};for(const[s,a]of Object.entries(part.attributes))attributes[s]=accessor(a);const indexType=part.attributes.POSITION.array.length/3<65536?5123:5125,indices=indexType===5123?Uint16Array.from(part.indices):Uint32Array.from(part.indices);j.meshes[0].primitives.push({attributes,indices:accessor({array:indices,type:'SCALAR',componentType:indexType},34963),material:mat,mode:4});}
 for(const p of woodParts)addPart(p,material(p.materialIndex));
 if(leafGeometry){
  assert(atlasColor&&atlasNormal);function atlas(file,name){const bytes=fs.readFileSync(file),png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';assert(png||webp,'Atlas must be exact PNG or WebP');j.images.push({name,mimeType:png?'image/png':'image/webp',bufferView:blob(bytes)});const source=j.images.length-1,sampler=j.samplers.push({magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071})-1;j.textures.push(png?{sampler,source}:{sampler,extensions:{EXT_texture_webp:{source}}});return j.textures.length-1;}
  const color=atlas(atlasColor,'Island medium raw cluster albedo'),normal=atlas(atlasNormal,'Island medium pre-upblend tangent normals');
  const mat={name:'island_tree_01_leaves',doubleSided:true,alphaMode:'MASK',alphaCutoff:.22,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],baseColorTexture:{index:color},metallicFactor:0,roughnessFactor:1},normalTexture:{index:normal,scale:1/.55},extras:{mediumCanopy:true,rawAtlasNoSummerPigmentOrCanopyShade:true,canopyShadeAttribute:'_CANOPY_SHADE',normalBake:'Pre-canopy-up tangent; atlasVdown B=-V; configure normalScale*.55 once',skipSourceGrowth:true,skipPrepareCanopyShade:true}};
  j.materials.push(mat);const attrs={};for(const [s,a]of Object.entries(leafGeometry.attributes)){const type=s==='TEXCOORD_0'?'VEC2':s==='TANGENT'?'VEC4':s==='_CANOPY_SHADE'?'SCALAR':'VEC3';attrs[s]={array:Float32Array.from(a),type,componentType:5126};}
  assert(attrs._CANOPY_SHADE,'Target-cell shade must accompany raw representative atlas');assert(attrs.POSITION&&attrs.NORMAL&&attrs.TEXCOORD_0);addPart({attributes:attrs,indices:Uint32Array.from(leafGeometry.indices)},j.materials.length-1);
 }
 const pad=(-offset)&3;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}j.buffers=[{byteLength:offset}];const bin=Buffer.concat(chunks),raw=Buffer.from(JSON.stringify(j)),json=Buffer.concat([raw,Buffer.alloc((-raw.length)&3,32)]),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);const result=Buffer.concat([header,jh,json,bh,bin]);fs.writeFileSync(output,result);return {file:output,sha256:sha(result),bytes:result.length,json:j};
}
