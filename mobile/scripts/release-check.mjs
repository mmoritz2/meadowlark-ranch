import {readFile} from 'node:fs/promises';
const status=JSON.parse(await readFile(new URL('../release-status.json',import.meta.url),'utf8'));
const open=Object.entries(status.gates).filter(([,passed])=>passed!==true).map(([name])=>name);
if(open.length){console.error('Release blocked. Development staging remains available.\n'+open.map(s=>' - '+s).join('\n'));process.exitCode=1;}
else console.log('Recorded readiness gates passed. Apple review and approval remain separate.');
