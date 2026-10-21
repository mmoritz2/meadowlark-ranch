// Structural decoder only: it does not authenticate the manifest's asserted
// identities or block hashes. Runtime installation must use the authenticated
// loader below and require its authenticated===true result before application.
export const HOLLOWPEAK_COHORT_PAYLOAD_PROFILE='hollowpeak-owned-runtime-payload-1';
export const HOLLOWPEAK_COHORT_PAYLOAD_SHA256='3f534442e40657a8bba1b46d3e3973f1cc427e9697e217f330dd30c76bd8b418';
const need=(condition,message)=>{if(!condition)throw Error(message);};
export function decodeHollowpeakCohortPayload(bytes){
 need(bytes instanceof ArrayBuffer&&bytes.byteLength>=16&&bytes.byteLength<2_000_000,'Invalid Hollowpeak landscape payload size');
 const view=new DataView(bytes),magic=String.fromCharCode(...new Uint8Array(bytes,0,8));need(magic==='HPWORLD1','Invalid Hollowpeak landscape payload header');
 const jsonLength=view.getUint32(8,true),payloadLength=view.getUint32(12,true),offset=(16+jsonLength+3)&~3;
 need(jsonLength>0&&jsonLength<16000&&offset+payloadLength===bytes.byteLength,'Incomplete Hollowpeak landscape payload');
 const manifest=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,16,jsonLength)));
 need(manifest.profile===HOLLOWPEAK_COHORT_PAYLOAD_PROFILE&&manifest.canonicalSHA256==='e11fd7647db59d06d0cc357f1898ea40da7373c7ae5724297fb74d3b277facd0'&&manifest.constructionReferenceSHA256==='59b9537a0846282f73b5baa5f2fec0b1f6eed2af3fcd865f6a826effdb35ca8d','Unreviewed Hollowpeak landscape cohort');
 need(Array.isArray(manifest.blocks)&&manifest.blocks.length===12&&Array.isArray(manifest.waters)&&manifest.waters.length===4,'Incomplete Hollowpeak landscape blocks');
 const blocks=new Map();let end=0;
 for(const b of manifest.blocks){
  const stride={u8:1,u16:2,f32:4}[b.type];need(stride&&typeof b.id==='string'&&!blocks.has(b.id)&&Number.isInteger(b.offset)&&b.offset>=end&&b.offset%4===0&&Number.isInteger(b.count)&&b.count>0&&b.count<400000&&b.bytes===b.count*stride&&b.offset+b.bytes<=payloadLength,'Invalid Hollowpeak landscape block');
  let a;if(b.type==='u8')a=new Uint8Array(bytes.slice(offset+b.offset,offset+b.offset+b.bytes));
  else {a=b.type==='f32'?new Float32Array(b.count):new Uint16Array(b.count);for(let i=0;i<a.length;i++){a[i]=b.type==='f32'?view.getFloat32(offset+b.offset+i*4,true):view.getUint16(offset+b.offset+i*2,true);need(Number.isFinite(a[i]),'Nonfinite Hollowpeak landscape vertex');}}
  blocks.set(b.id,a);end=b.offset+b.bytes;
 }
 need(end===payloadLength,'Trailing or missing Hollowpeak landscape blocks');
 function geometry(g,id){
  need(g&&g.index==='sequential-u32'&&Number.isInteger(g.triangles)&&g.triangles>0&&g.triangles<12000&&g.position===id+'/position'&&g.owners===id+'/owners','Invalid Hollowpeak geometry descriptor');
  const position=blocks.get(g.position),owners=blocks.get(g.owners),count=g.triangles*3;
  need(position instanceof Float32Array&&position.length===count*3&&owners instanceof Uint16Array&&owners.length===count,'Incomplete Hollowpeak geometry arrays');
  const index=new Uint32Array(count);for(let i=0;i<count;i++){index[i]=i;need(owners[i]<(i%3===2?2:512),'Invalid Hollowpeak canonical triangle owner');}
  return{position,index,owners};
 }
 const expected=[['upper-tarn','tarn',2754],['plunge-pool','pool',3414],['upper-cleft','channel',1356],['lower-source','channel',830]],waters=[],waterTriangles=[];
 for(let n=0;n<expected.length;n++){
  const[id,kind,count]=expected[n],g=manifest.waters[n];need(g.id===id&&g.kind===kind&&g.triangles===count,'Unreviewed Hollowpeak water batch');
  const arrays=geometry(g,id);waters.push({id,kind,...arrays});
  for(let i=0;i<arrays.index.length;i+=3){const p=arrays.position;waterTriangles.push({id,kind,a:Array.from(p.subarray(i*3,i*3+3)),b:Array.from(p.subarray(i*3+3,i*3+6)),c:Array.from(p.subarray(i*3+6,i*3+9)),swimmable:true});}
 }
 need(manifest.shore?.triangles===6352,'Unreviewed Hollowpeak shore cohort');const shoreGeometry=geometry(manifest.shore,'shore');
 const field=blocks.get('canonical-patch'),reference=blocks.get('construction-patch');need(field instanceof Uint8Array&&field.length===50656&&reference instanceof Uint8Array&&reference.length===50656,'Incomplete Hollowpeak canonical data');
 return{authenticated:false,profile:manifest.profile,finalFieldSHA256:manifest.canonicalSHA256,constructionReferenceSHA256:manifest.constructionReferenceSHA256,fieldBytes:field.buffer,constructionBytes:reference.buffer,waters,waterTriangles,shoreGeometry};
}
export async function loadHollowpeakCohortPayload({fetchImpl=globalThis.fetch,signal,cryptoImpl=globalThis.crypto}={}){
 const url=new URL('./hollowpeak-cohort-1.bin',import.meta.url);url.searchParams.set('v',HOLLOWPEAK_COHORT_PAYLOAD_SHA256);
 const response=await fetchImpl(url,{signal});
 if(!response.ok)throw Error('Hollowpeak landscape could not load');
 const bytes=await response.arrayBuffer();
 need(bytes instanceof ArrayBuffer&&bytes.byteLength>=16&&bytes.byteLength<2_000_000,'Invalid Hollowpeak landscape payload size');
 need(typeof cryptoImpl?.subtle?.digest==='function','Hollowpeak landscape authentication requires WebCrypto');
 const digest=await cryptoImpl.subtle.digest('SHA-256',bytes);
 const actual=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 need(actual===HOLLOWPEAK_COHORT_PAYLOAD_SHA256,'Hollowpeak landscape payload integrity mismatch');
 const payload=decodeHollowpeakCohortPayload(bytes);
 return{...payload,authenticated:true,payloadSHA256:actual};
}
