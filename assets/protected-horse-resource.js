/* Protected-resource delivery prototype, not client DRM or a license decision.
 * Static runtime keys are discoverable. Decrypted geometry remains inspectable
 * in memory. No plaintext GLB URL or export API is created here. GLTFLoader may
 * use its own transient, revoked blob URLs for embedded images.
 * Custom neutral coats must be embedded by the packer and accessed through the
 * returned glTF parser; external neutralCoatFile URLs remain unsupported. */
export const PROTECTED_HORSE_RESOURCE_VERSION=1;
const MAGIC=[77,82,72,80,65,67,75,0],HEADER=64,AAD=48;
const DEFAULT_LIMIT=256*1024*1024;

function fail(message){throw new Error('Protected horse resource: '+message);}
function embeddedGLB(buffer,maxBytes){
 const view=new DataView(buffer),bytes=new Uint8Array(buffer);
 if(buffer.byteLength>maxBytes||buffer.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)fail('invalid embedded GLB');
 let offset=12,doc=null,binLength=0,seen=new Set();
 while(offset<buffer.byteLength){
  if(offset+8>buffer.byteLength)fail('truncated GLB');
  const length=view.getUint32(offset,true),kind=view.getUint32(offset+4,true);offset+=8;
  if(length%4||offset+length>buffer.byteLength||seen.has(kind)||(!seen.size&&kind!==0x4e4f534a))fail('invalid GLB chunk');
  seen.add(kind);
  if(kind===0x4e4f534a){if(length>4*1024*1024)fail('GLB metadata limit');doc=JSON.parse(new TextDecoder().decode(bytes.subarray(offset,offset+length)));}
  else if(kind===0x004e4942)binLength=length;else fail('unsupported GLB chunk');
  offset+=length;
 }
 if(doc?.asset?.version!=='2.0'||(doc.buffers||[]).length>1)fail('expected one embedded glTF 2.0 buffer');
 const inspect=value=>{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(key==='uri')fail('external resource URI');inspect(item);}};
 inspect(doc);
 const length=doc.buffers?.[0]?.byteLength||0;
 if(!Number.isSafeInteger(length)||length<0||length>binLength||binLength-length>3)fail('invalid embedded buffer length');
 for(const resource of doc.bufferViews||[]){const start=resource.byteOffset||0;if(resource.buffer!==0||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(resource.byteLength)||resource.byteLength<0||start+resource.byteLength>length)fail('invalid embedded buffer view');}
 return buffer;
}

/** Fetch .mkr, authenticate and decrypt in memory, then use the supplied glTF
 * loader's normal parseAsync. keyBase64 belongs in runtime configuration, never
 * in the URL. The caller retains normal glTF/texture/geometry lifetime duties. */
export async function loadProtectedHorseResource({loader,url,keyBase64,expectedSha256,maxBytes=DEFAULT_LIMIT,signal,fetchOptions={}}){
 if(!loader||typeof loader.parseAsync!=='function')fail('parseAsync loader required');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>1024*1024*1024)fail('invalid resource limit');
 if(typeof keyBase64!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(keyBase64))fail('32-byte base64 key required');
 if(expectedSha256!==undefined&&!/^[a-f0-9]{64}$/.test(expectedSha256))fail('invalid expected SHA-256');
 if(!globalThis.crypto?.subtle)fail('Web Crypto secure context required');
 const response=await fetch(url,{...fetchOptions,signal});if(!response.ok)fail('HTTP '+response.status);
 const stated=Number(response.headers.get('Content-Length'));
 if(Number.isFinite(stated)&&stated>maxBytes+HEADER)fail('encrypted resource limit');
 const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer);
 if(buffer.byteLength<HEADER||buffer.byteLength>maxBytes+HEADER)fail('encrypted resource size');
 if(expectedSha256){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));if([...digest].map(b=>b.toString(16).padStart(2,'0')).join('')!==expectedSha256)fail('encrypted SHA-256 mismatch');}
 if(MAGIC.some((byte,i)=>bytes[i]!==byte))fail('invalid envelope magic');
 const view=new DataView(buffer);
 if(view.getUint16(8,true)!==PROTECTED_HORSE_RESOURCE_VERSION)fail('unsupported envelope version');
 if(view.getUint16(10,true)!==1||view.getUint16(12,true)!==HEADER||view.getUint16(14,true)!==0||bytes.subarray(36,AAD).some(Boolean))fail('unsupported envelope parameters');
 const length=view.getBigUint64(16,true);
 if(length>BigInt(maxBytes)||length!==BigInt(buffer.byteLength-HEADER))fail('invalid authenticated payload length');
 const rawKey=Uint8Array.from(atob(keyBase64),character=>character.charCodeAt(0));
 if(rawKey.length!==32)fail('32-byte key required');
 let key;try{key=await crypto.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']);}finally{rawKey.fill(0);}
 const ciphertext=new Uint8Array(Number(length)+16);ciphertext.set(bytes.subarray(HEADER));ciphertext.set(bytes.subarray(AAD,HEADER),Number(length));
 let plain;
 try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(24,36),additionalData:bytes.subarray(0,AAD),tagLength:128},key,ciphertext);}
 catch{fail('authentication failed');}
 // GLTFLoader/accessor arrays can retain this buffer; wiping it would corrupt
 // the horse. No network-visible plaintext or downloadable GLB is produced.
 return loader.parseAsync(embeddedGLB(plain,maxBytes),'');
}
