const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('review/club-post-relay/client.js','utf8');
const scheduler=source.slice(source.indexOf('function scheduleAutomatic('),source.indexOf('function publish('));
let now=0,seq=0;const timers=new Map(),automatic=[];
const ctx=vm.createContext({Date:{now:()=>now},setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{at:now+ms,fn});return id;},publish:({automatic:yes})=>{assert.equal(yes,true);automatic.push(now);}});
vm.runInContext('const reporting={automaticRequests:0,triggerCounts:{}};let reportTimer=null,lastAutomaticAt=0;'+scheduler,ctx);
function advance(to){while(true){const next=[...timers.entries()].filter(([,t])=>t.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=to;}
for(let t=0;t<6000;t+=150){advance(t);vm.runInContext("scheduleAutomatic('clubPostRelayChanged')",ctx);if(t%600===0)vm.runInContext("scheduleAutomatic('tick')",ctx);}
advance(6500);assert.equal(automatic.length,6);for(let i=1;i<automatic.length;i++)assert.ok(automatic[i]-automatic[i-1]>=1000);
assert.equal(vm.runInContext('reporting.automaticRequests',ctx),50);assert.equal(vm.runInContext('reporting.triggerCounts.clubPostRelayChanged',ctx),40);
const reports=[];const reportElement={textContent:''};let sampleAt=20000;
const payloadCtx=vm.createContext({Date:{now:()=>sampleAt},TextEncoder,parent:{postMessage:(m)=>reports.push(JSON.parse(JSON.stringify(m)))},window:{},$:()=>reportElement,sample:()=>({at:sampleAt,relay:{current:{id:'real-run',status:'riding',stage:'passPost',carrierId:'host-real',interaction:{eligible:true,label:'Offer pouch',action:'offer'}}},player:{x:10,z:-22,speed:0},driver:{active:false}}),copy:v=>v==null?v:JSON.parse(JSON.stringify(v)),status:()=>{throw Error('Unexpected report failure');},token:'relay-1234567890123456',role:'host',parentOrigin:'http://127.0.0.1:18820',lastCommand:null});
vm.runInContext("const reporting={automaticRequests:50,automaticPublications:0,explicitPublications:0,fullDiagnosticPublications:0,triggerCounts:{},lastSentBytes:0,totalSentBytes:0,lastRegularBytes:0,maxRegularBytes:0,totalRegularBytes:0,lastFullBytes:0,totalFullBytes:0};const history=Array.from({length:300},(_,i)=>({at:i,stage:'outbound',player:{x:i,z:-22,speed:2}}));const transitions=Array.from({length:120},(_,i)=>({at:i,stage:'outbound',player:{x:i,z:-22,speed:2}}));let lastTraceKey='',lastTraceAt=0,lastSample=null;"+source.slice(source.indexOf('function transitionSummary('),source.indexOf('function scheduleAutomatic('))+source.slice(source.indexOf('function publish('),source.indexOf("// This getter")),payloadCtx);
vm.runInContext('publish({automatic:true})',payloadCtx);
assert.equal(reports.length,1);assert.equal('trace' in reports[0].report,false);assert.equal('transitions' in reports[0].report,false);assert.equal(reports[0].report.traceSummary.recent.length,12);assert.equal(reports[0].report.traceSummary.samples,300);assert.equal(JSON.parse(reportElement.textContent).trace,undefined);
sampleAt+=500;vm.runInContext("publish({full:true,requestId:'diagnostic-one'})",payloadCtx);
assert.equal(reports[1].full,true);assert.equal(reports[1].requestId,'diagnostic-one');assert.equal(reports[1].report.trace.length,300);assert.equal(reports[1].report.transitions.length,120);assert.equal(JSON.parse(reportElement.textContent).trace,undefined);
assert.equal(vm.runInContext('reporting.lastFullBytes',payloadCtx),new TextEncoder().encode(JSON.stringify(reports[1])).byteLength);
assert.ok(vm.runInContext('reporting.lastFullBytes>reporting.lastRegularBytes',payloadCtx));
console.log('Scheduler:50 automatic requests coalesced to6 publications, at least1s apart. Compact/full payload and exact byte-counter checks passed. Synthetic payload sizes are test diagnostics, not a runtime benchmark.');
