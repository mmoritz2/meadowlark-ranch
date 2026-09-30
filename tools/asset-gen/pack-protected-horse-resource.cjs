/* Offline .mkr packer. No unpack CLI, remote fetch, downloaded code execution,
 * or license-compliance claim. Runtime keys in the descriptor are discoverable.
 * Usage: node ... --input model.glb --output private/model.mkr
 * Optional --key-file contains a 32-byte base64 key. Generated keys otherwise.
 * Stage all buffer/image paths below the input's folder; URI traversal and
 * symlinks are rejected. Optional --neutral-coat embeds an additional local
 * custom-coat image as a glTF texture; the descriptor gives its texture index. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MAGIC=Buffer.from([77,82,72,80,65,67,75,0]),HEADER=64,AAD=48,VERSION=1;
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const align=n=>(n+3)&~3;
function check(condition,message){if(!condition)throw Error('Protected horse packer: '+message);}
function readRegular(file,maxBytes){const stat=fs.lstatSync(file);check(stat.isFile()&&!stat.isSymbolicLink(),'regular input file required');check(stat.size<=maxBytes,'resource limit');return fs.readFileSync(file);}
function parseGLB(data){
 check(data.length>=20&&data.toString('ascii',0,4)==='glTF'&&data.readUInt32LE(4)===2&&data.readUInt32LE(8)===data.length,'complete GLB 2.0 required');
 let offset=12,doc,bin=Buffer.alloc(0),seen=new Set();
 while(offset<data.length){check(offset+8<=data.length,'truncated chunk');const length=data.readUInt32LE(offset),kind=data.readUInt32LE(offset+4);offset+=8;check(length%4===0&&offset+length<=data.length&&!seen.has(kind)&&(!seen.size?kind===0x4e4f534a:true),'invalid chunk');seen.add(kind);
  if(kind===0x4e4f534a){check(length<=4*1024*1024,'metadata limit');doc=JSON.parse(data.toString('utf8',offset,offset+length));}
  else if(kind===0x004e4942)bin=data.subarray(offset,offset+length);else check(false,'unsupported chunk');offset+=length;
 }
 check(doc?.asset?.version==='2.0','glTF 2.0 metadata required');return {doc,bin};
}
function makeGLB(doc,bin){
 const json=Buffer.from(JSON.stringify(doc)),j=Buffer.alloc(align(json.length),0x20);json.copy(j);
 const b=Buffer.alloc(align(bin.length));bin.copy(b);const result=Buffer.alloc(12+8+j.length+(b.length?8+b.length:0));
 result.write('glTF');result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(j.length,12);result.writeUInt32LE(0x4e4f534a,16);j.copy(result,20);
 if(b.length){const offset=20+j.length;result.writeUInt32LE(b.length,offset);result.writeUInt32LE(0x004e4942,offset+4);b.copy(result,offset+8);}return result;
}
function imageMime(data,declared){
 let actual='';if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))actual='image/png';else if(data[0]===255&&data[1]===216&&data[2]===255)actual='image/jpeg';else if(data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP')actual='image/webp';else if(data.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(data.toString('ascii',8,32)))actual='image/avif';
 check(actual&&(!declared||declared===actual),'unsupported or mismatched image MIME');return actual;
}
function embedLocalModel(inputPath,{maxBytes=256*1024*1024,maxResources=4096,neutralCoatPath}={}){
 check(Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=1024*1024*1024,'invalid resource limit');
 check(Number.isSafeInteger(maxResources)&&maxResources>0&&maxResources<=16384,'invalid resource count limit');
 const input=path.resolve(inputPath),folder=fs.realpathSync(path.dirname(input)),original=readRegular(input,maxBytes),extension=path.extname(input).toLowerCase();
 check(['.glb','.gltf'].includes(extension),'input must be GLB or glTF');
 const parsed=extension==='.glb'?parseGLB(original):{doc:JSON.parse(original.toString('utf8')),bin:Buffer.alloc(0)},doc=parsed.doc;
 check(doc?.asset?.version==='2.0','glTF 2.0 required');
 const allowedURIs=new Set([...(doc.buffers||[]).map((_,i)=>'buffers.'+i+'.uri'),...(doc.images||[]).map((_,i)=>'images.'+i+'.uri')]);
 function inspect(value,at=''){if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){const here=at?at+'.'+key:key;if(key==='uri')check(allowedURIs.has(here),'unsupported URI outside buffers/images');inspect(item,here);}}
 inspect(doc);let total=0,count=0;const resources=[];
 function resource(uri){
  check(typeof uri==='string'&&uri.length<=8192,'invalid resource URI');let data,label=uri;
  if(uri.startsWith('data:')){const match=/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp|avif));base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);check(match&&match[1].length%4===0,'binary base64 data URI required');data=Buffer.from(match[1],'base64');check(data.toString('base64')===match[1],'noncanonical data URI');label='embedded-data-uri';}
  else{
   let decoded;try{decoded=decodeURIComponent(uri);}catch{check(false,'invalid URI encoding');}
   check(decoded&&!/[\\\0:?#%]/.test(decoded)&&!path.isAbsolute(decoded)&&!decoded.split('/').some(part=>part==='..'||part===''),'nonlocal/traversal URI rejected');
   const resolved=path.resolve(folder,decoded);check(resolved.startsWith(folder+path.sep),'resource outside input folder');
   let partial=folder;for(const part of decoded.split('/')){partial=path.join(partial,part);check(!fs.lstatSync(partial).isSymbolicLink(),'resource symlink rejected');}
   check(fs.realpathSync(resolved).startsWith(folder+path.sep),'resolved resource escapes input folder');data=readRegular(resolved,maxBytes);
  }
  total+=data.length;check(++count<=maxResources&&total<=maxBytes,'resource budget exceeded');resources.push({resource:label,bytes:data.length,sha256:sha(data)});return data;
 }
 const buffers=(doc.buffers||[]).map((buffer,i)=>{check(Number.isSafeInteger(buffer.byteLength)&&buffer.byteLength>=0,'invalid buffer byteLength');const data=buffer.uri!==undefined?resource(buffer.uri):(check(extension==='.glb'&&i===0,'buffer URI required'),parsed.bin);check(data.length>=buffer.byteLength&&data.length-buffer.byteLength<=3,'buffer length mismatch');return data.subarray(0,buffer.byteLength);});
 const parts=[],offsets=[];let length=0;
 function append(data){const offset=length;parts.push(data);length+=data.length;const padding=align(length)-length;if(padding)parts.push(Buffer.alloc(padding));length+=padding;check(length<=maxBytes,'embedded resource limit');return offset;}
 for(const data of buffers)offsets.push(append(data));
 for(const view of doc.bufferViews||[]){const start=view.byteOffset||0;check(Number.isSafeInteger(view.buffer)&&buffers[view.buffer]&&Number.isSafeInteger(start)&&start>=0&&Number.isSafeInteger(view.byteLength)&&view.byteLength>=0&&start+view.byteLength<=buffers[view.buffer].length,'bufferView outside source buffer');view.byteOffset=offsets[view.buffer]+start;view.buffer=0;}
 let changed=extension!=='.glb'||(doc.buffers||[]).some(buffer=>buffer.uri!==undefined),imageCount=0;
 for(const image of doc.images||[]){if(image.uri!==undefined){const data=resource(image.uri),mime=imageMime(data,image.mimeType),offset=append(data);doc.bufferViews||(doc.bufferViews=[]);image.bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length});image.mimeType=mime;delete image.uri;changed=true;imageCount++;}else check(Number.isSafeInteger(image.bufferView)&&doc.bufferViews?.[image.bufferView],'embedded image bufferView required');}
 let neutralCoatTexture,neutralCoatSha256;
 if(neutralCoatPath!==undefined){
  const data=resource(neutralCoatPath),mime=imageMime(data),offset=append(data);
  doc.bufferViews||(doc.bufferViews=[]);const bufferView=doc.bufferViews.length;
  doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length});
  doc.images||(doc.images=[]);const source=doc.images.length;
  doc.images.push({name:'MeadowlarkNeutralCoat',bufferView,mimeType:mime});
  doc.textures||(doc.textures=[]);neutralCoatTexture=doc.textures.length;
  doc.textures.push({name:'MeadowlarkNeutralCoat',source});neutralCoatSha256=sha(data);changed=true;imageCount++;
 }
 const bin=Buffer.concat(parts,length);doc.buffers=length?[{byteLength:length}]:[];
 const embedded=changed?makeGLB(doc,bin):original;check(embedded.length<=maxBytes,'complete embedded GLB limit');
 return {bytes:embedded,report:{input:path.basename(input),sourceSha256:sha(original),embeddedSha256:sha(embedded),originalBytes:original.length,embeddedBytes:embedded.length,packagingChangedJSON:changed,embeddedExternalImageCount:imageCount,resources,sourceBufferSha256:buffers.map(sha),preservation:'Existing bufferView bytes and image file bytes are retained; buffer offsets/URIs and container metadata are adapted only when embedding resources.',neutralCoatTexture,neutralCoatSha256,neutralCoatEmbedded:neutralCoatPath!==undefined}};
}
function packProtectedHorseResource({inputPath,keyBase64,maxBytes,maxResources,neutralCoatPath}){
 const embedded=embedLocalModel(inputPath,{maxBytes,maxResources,neutralCoatPath}),key=keyBase64?Buffer.from(keyBase64,'base64'):crypto.randomBytes(32);
 check(key.length===32&&(!keyBase64||key.toString('base64')===keyBase64),'canonical 32-byte base64 key required');
 const header=Buffer.alloc(HEADER);MAGIC.copy(header);header.writeUInt16LE(VERSION,8);header.writeUInt16LE(1,10);header.writeUInt16LE(HEADER,12);header.writeBigUInt64LE(BigInt(embedded.bytes.length),16);crypto.randomBytes(12).copy(header,24);
 const cipher=crypto.createCipheriv('aes-256-gcm',key,header.subarray(24,36));cipher.setAAD(header.subarray(0,AAD));const ciphertext=Buffer.concat([cipher.update(embedded.bytes),cipher.final()]);cipher.getAuthTag().copy(header,AAD);
 const bytes=Buffer.concat([header,ciphertext]),descriptor={format:'meadowlark-protected-horse',version:VERSION,cipher:'AES-256-GCM',bytes:bytes.length,sha256:sha(bytes),embeddedGlbSha256:sha(embedded.bytes),keyBase64:key.toString('base64'),keyDiscoverability:'This static-game runtime key is discoverable; this envelope is not strong client DRM or a license compliance certification.',neutralCoatTexture:embedded.report.neutralCoatTexture,neutralCoatSha256:embedded.report.neutralCoatSha256,neutralCoatEmbedded:embedded.report.neutralCoatEmbedded};key.fill(0);
 return {bytes,descriptor,packingReport:embedded.report};
}
module.exports={packProtectedHorseResource,embedLocalModel,parseGLB,makeGLB};
if(require.main===module){try{
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){check(['--input','--output','--descriptor','--key-file','--neutral-coat','--max-bytes','--max-resources'].includes(args[i])&&args[i+1],'invalid CLI argument');options[args[i]]=args[i+1];}
 check(options['--input']&&options['--output'],'--input and --output required');const output=path.resolve(options['--output']),descriptorPath=path.resolve(options['--descriptor']||output+'.json');check(path.extname(output)==='.mkr','output extension must be .mkr');check(output!==descriptorPath&&!fs.existsSync(output)&&!fs.existsSync(descriptorPath),'output already exists');
 const packed=packProtectedHorseResource({inputPath:options['--input'],neutralCoatPath:options['--neutral-coat'],keyBase64:options['--key-file']?readRegular(options['--key-file'],4096).toString('utf8').trim():undefined,maxBytes:options['--max-bytes']?Number(options['--max-bytes']):undefined,maxResources:options['--max-resources']?Number(options['--max-resources']):undefined});
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.mkdirSync(path.dirname(descriptorPath),{recursive:true});fs.writeFileSync(output,packed.bytes,{flag:'wx'});fs.writeFileSync(descriptorPath,JSON.stringify({...packed.descriptor,file:path.basename(output),packingReport:packed.packingReport},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({file:output,descriptor:descriptorPath,bytes:packed.bytes.length,sha256:packed.descriptor.sha256}));
}catch(error){console.error(error.message);process.exitCode=1;}}
