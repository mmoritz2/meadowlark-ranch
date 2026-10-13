// One bounded CPU-only command. No browser, server, GPU, network or save writes.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const args of [
 ['--test','tools/test-basic-riding-tack.mjs'],
 ['--test','tools/test-starter-tack-catalog-preservation.mjs'],
 ['tools/qa-native-tack-integration.cjs'],
]){
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',timeout:30000});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
