// Lossless little-endian transfer of the authored geometry packet. This codec
// grants no art, physics or runtime admission; the installer owns those checks.
const MAGIC='MLARCH01',VERSION=1,HEADER=32,MAX_BYTES=16*1024*1024;
const TYPES=new Map([[5126,Float32Array],[5123,Uint16Array],[5125,Uint32Array]]);
const NAMES=['position','normal','uv','color'];
const aligned=n=>Math.ceil(n/4)*4;
function fail(message){throw Error('Arch geometry transfer: '+message);}
function count(n){if(!Number.isSafeInteger(n)||n<1||n>2_000_000)fail('invalid element count');return n;}
function littleEndian(){if(new Uint16Array(new Uint8Array([1,0]).buffer)[0]!==1)fail('little-endian typed arrays required');}

export function encodeGeometryPacket(packet){
 littleEndian();const blocks=[],meta={...packet,attributes:{},index:null};let length=0;
 function add(record,itemSize){
  const Type=TYPES.get(record.componentType);if(!Type||!Array.isArray(record.array))fail('unsupported source array');
  const array=new Type(record.array);count(array.length);
  if(!record.array.every(Number.isFinite)||record.array.some((v,i)=>array[i]!==v&&!(Object.is(array[i],-0)&&Object.is(v,0))))fail('source array is not exactly representable');
  if(itemSize&&array.length%itemSize!==0)fail('incomplete source attribute');
  const offset=aligned(length),description={...record,array:undefined,offset,elements:array.length,bytes:array.byteLength};
  blocks.push({array,offset});length=offset+array.byteLength;return description;
 }
 if(Object.keys(packet.attributes).length!==4)fail('four authored attributes required');
 for(const name of NAMES){const a=packet.attributes[name];if(!a||a.componentType!==5126||a.itemSize!==(name==='uv'?2:3))fail('unexpected attribute layout');meta.attributes[name]=add(a,a.itemSize);}
 meta.index=add(packet.index,1);const json=new TextEncoder().encode(JSON.stringify(meta)),start=aligned(HEADER+json.length),total=start+length;
 if(total>MAX_BYTES)fail('transfer size exceeds cap');
 const buffer=new ArrayBuffer(total),view=new DataView(buffer),bytes=new Uint8Array(buffer);
 bytes.set(new TextEncoder().encode(MAGIC),0);view.setUint32(8,VERSION,true);view.setUint32(12,json.length,true);view.setUint32(16,total,true);view.setUint32(20,4,true);view.setUint32(24,packet.vertices,true);view.setUint32(28,packet.index.array.length,true);bytes.set(json,HEADER);
 for(const {array,offset}of blocks)bytes.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),start+offset);
 return buffer;
}

export function decodeGeometryPacket(buffer){
 littleEndian();if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<HEADER||buffer.byteLength>MAX_BYTES)fail('invalid buffer size');
 const view=new DataView(buffer),bytes=new Uint8Array(buffer);
 if(new TextDecoder().decode(bytes.subarray(0,8))!==MAGIC||view.getUint32(8,true)!==VERSION)fail('invalid header');
 const jsonLength=count(view.getUint32(12,true)),total=view.getUint32(16,true),start=aligned(HEADER+jsonLength),vertices=count(view.getUint32(24,true)),indices=count(view.getUint32(28,true));
 if(total!==buffer.byteLength||start>=total||view.getUint32(20,true)!==4||indices%3)fail('inconsistent header');
 const meta=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(HEADER,HEADER+jsonLength)));
 if(meta.vertices!==vertices||meta.triangles!==indices/3||Object.keys(meta.attributes??{}).length!==4)fail('inconsistent metadata');
 let expectedOffset=0;
 function read(record,itemSize){
  const Type=TYPES.get(record?.componentType),elements=count(record?.elements);
  if(!Type||record.offset!==aligned(expectedOffset)||record.bytes!==elements*Type.BYTES_PER_ELEMENT||start+record.offset+record.bytes>total)fail('invalid array range');
  if(itemSize&&(record.itemSize!==itemSize||elements!==vertices*itemSize||record.componentType!==5126))fail('invalid attribute layout');
  const array=new Type(buffer,start+record.offset,elements);expectedOffset=record.offset+record.bytes;return{...record,array};
 }
 const attributes={};for(const name of NAMES)attributes[name]=read(meta.attributes[name],name==='uv'?2:3);
 const index=read(meta.index,0);
 if(![5123,5125].includes(index.componentType)||index.array.length!==indices||start+expectedOffset!==total)fail('invalid index layout');
 for(const record of Object.values(attributes))for(const value of record.array)if(!Number.isFinite(value))fail('nonfinite attribute');
 for(const value of index.array)if(value>=vertices)fail('index outside vertices');
 return{...meta,attributes,index};
}
