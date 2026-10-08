/* Small ZIP STORE writer. WebP is already compressed; no external dependency. */
const encoder=new TextEncoder(),table=Uint32Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
export function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=table[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
export function safeArchivePath(name){return typeof name==='string'&&/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(name)&&name.split('/').every(part=>part!=='.'&&part!=='..');}
export function createStoreZip(entries){
 if(!Array.isArray(entries)||entries.length>65535)throw Error('Invalid ZIP entry count');
 const chunks=[],directory=[],seen=new Set();let offset=0;
 for(const entry of entries){
  if(!safeArchivePath(entry.name)||seen.has(entry.name))throw Error('Unsafe or duplicate archive path: '+entry.name);seen.add(entry.name);
  const name=encoder.encode(entry.name),data=typeof entry.data==='string'?encoder.encode(entry.data):entry.data;
  if(!(data instanceof Uint8Array)||name.length>65535||data.length>0xffffffff)throw Error('Invalid ZIP entry');
  const crc=crc32(data),header=new Uint8Array(30),view=new DataView(header.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint16(12,33,true);
  view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,name.length,true);
  chunks.push(header,name,data);
  const central=new Uint8Array(46),cv=new DataView(central.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);
  cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);
  directory.push(central,name);offset+=header.length+name.length+data.length;
  if(offset>0xffffffff)throw Error('ZIP exceeds classic format size');
 }
 const directorySize=directory.reduce((sum,part)=>sum+part.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
 ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,directorySize,true);ev.setUint32(16,offset,true);
 return new Blob([...chunks,...directory,end],{type:'application/zip'});
}
