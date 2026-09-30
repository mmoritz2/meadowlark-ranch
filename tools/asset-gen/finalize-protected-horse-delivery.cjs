/* Package the two approved CGTrader game derivatives for incorporated game
 * delivery. Plaintext conversion files remain ignored local working data.
 * No claim of strong client DRM; runtime keys remain discoverable. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {packProtectedHorseResource}=require('./pack-protected-horse-resource.cjs');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'assets/models/horse-imports');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function check(condition,message){if(!condition)throw Error(message);}
function main(){
 const [flag,candidate,...rest]=process.argv.slice(2);
 check(flag==='--candidate'&&!rest.length&&['fjord-sculpt','pastel-unicorn'].includes(candidate),'Use --candidate fjord-sculpt or pastel-unicorn');
 const folder=path.join(base,candidate,'game'),profile=JSON.parse(fs.readFileSync(path.join(folder,'profile.json'),'utf8'));
 check(typeof profile.file==='string'&&path.basename(profile.file)===profile.file&&profile.file.endsWith('.glb'),'Expected a local converted GLB basename');
 const input=path.join(folder,profile.file),sourceBytes=fs.readFileSync(input);
 check(hash(sourceBytes)===profile.sha256,'Converted profile SHA does not match');
 const filename=profile.file.replace(/\.glb$/,'.mkr'),output=path.join(folder,filename),reportPath=path.join(folder,'protected-delivery-validation.json');
 if(fs.existsSync(reportPath)||fs.existsSync(output)){
  check(fs.existsSync(reportPath)&&fs.existsSync(output),'Incomplete existing protected delivery');
  const previous=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  check(previous.packingReport.sourceSha256===profile.sha256&&previous.sha256===hash(fs.readFileSync(output)),'Existing protected delivery differs; retain it and resolve the revision explicitly');
  if(profile.neutralCoatFile)check(previous.neutralCoatSha256===hash(fs.readFileSync(path.join(folder,profile.neutralCoatFile))),'Existing protected neutral coat differs');
  console.log(JSON.stringify({candidate,file:filename,sha256:previous.sha256,reused:true}));return;
 }
 const packed=packProtectedHorseResource({inputPath:input,neutralCoatPath:profile.neutralCoatFile});
 const report={schemaVersion:1,candidateId:candidate,file:filename,...packed.descriptor,
  packingReport:packed.packingReport,codecSha256:hash(fs.readFileSync(path.join(root,'assets/protected-horse-resource.js'))),
  packerSha256:hash(fs.readFileSync(path.join(__dirname,'pack-protected-horse-resource.cjs'))),
  actualGameDeliveryVerified:false,sourceProfileSha256:hash(fs.readFileSync(path.join(folder,'profile.json'))),
  scope:'AES-GCM proprietary resource with all model buffers, source maps and optional neutral coat embedded. Actual game rendering and deployment closure are verified separately.',
  limitations:['Static runtime keys and decrypted memory are discoverable. This is an extraction safeguard, not strong client DRM or a legal compliance certification.']};
 fs.writeFileSync(output,packed.bytes,{flag:'wx'});
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({candidate,file:filename,bytes:packed.bytes.length,sha256:packed.descriptor.sha256,reused:false}));
}
try{main();}catch(error){console.error(error.message);process.exitCode=1;}
