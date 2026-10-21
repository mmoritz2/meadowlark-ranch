// Staged runtime payload: one compact canonical rectangle, not a second floor.
export const HOLLOWPEAK_CANONICAL_FIELD_PROFILE='hollowpeak-connected-field-1';
export const HOLLOWPEAK_CANONICAL_FIELD=Object.freeze({segments:512,originX:-500,originZ:-500,step:1000/512,ix0:116,iz0:45,nx:124,nz:102,nodes:12648,byteLength:50656});
export function decodeHollowpeakCanonicalField(bytes){
 if(!(bytes instanceof ArrayBuffer))throw new TypeError('Canonical field ArrayBuffer required');
 const C=HOLLOWPEAK_CANONICAL_FIELD;
 if(bytes.byteLength!==C.byteLength)throw Error('Incomplete Hollowpeak canonical field');
 const view=new DataView(bytes),magic=String.fromCharCode(...new Uint8Array(bytes,0,8));
 if(magic!=='HPR23F32'||view.getUint32(8,true)!==1||view.getUint32(36,true)!==0)throw Error('Unsupported Hollowpeak canonical field header');
 for(const[offset,value]of[[12,C.segments],[16,C.ix0],[20,C.iz0],[24,C.nx],[28,C.nz],[32,C.nodes]])if(view.getUint32(offset,true)!==value)throw Error('Hollowpeak canonical field bounds changed');
 for(const[offset,value]of[[40,C.originX],[48,C.originZ],[56,C.step]])if(view.getFloat64(offset,true)!==value)throw Error('Hollowpeak canonical field grid changed');
 const heights=new Float32Array(C.nodes);
 for(let i=0;i<heights.length;i++){const y=view.getFloat32(64+i*4,true);if(!Number.isFinite(y))throw Error('Nonfinite Hollowpeak canonical field value');heights[i]=y;}
 return heights;
}
export function applyHollowpeakCanonicalField(heights,bytes){
 const C=HOLLOWPEAK_CANONICAL_FIELD,stride=C.segments+1;
 if(!(heights instanceof Float32Array)||heights.length!==stride*stride)throw new TypeError('Complete canonical513 squared Float32 field required');
 // Decode completely before mutation, so invalid or truncated payloads cannot
 // partially change the sole physical/rendered terrain owner.
 const patch=decodeHollowpeakCanonicalField(bytes);
 for(let z=0;z<C.nz;z++)heights.set(patch.subarray(z*C.nx,(z+1)*C.nx),(C.iz0+z)*stride+C.ix0);
 return{profile:HOLLOWPEAK_CANONICAL_FIELD_PROFILE,nodes:C.nodes,grid:C,additionalGroundSurfaces:0};
}
export async function loadHollowpeakCanonicalField({fetchImpl=globalThis.fetch,signal}={}){
 const response=await fetchImpl(new URL('./hollowpeak-connected-field-1.bin',import.meta.url),{signal});
 if(!response.ok)throw Error('Hollowpeak landscape could not load');
 const bytes=await response.arrayBuffer();decodeHollowpeakCanonicalField(bytes);return bytes;
}
