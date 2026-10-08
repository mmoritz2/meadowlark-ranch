// Actual controller fixtures: no browser, GPU, network, account or persisted save.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('../assets/tack-studio.js'),'utf8');
let checks=0;function check(value,message){assert(value,message);checks++;}
function fixture(){
 const nodes=new Map(),buttons=['idle','walk','gallop','jump'].map(gait=>({dataset:{gait},disabled:false}));
 function node(id){if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',value:'',attrs:{},classes:new Set(),setAttribute(k,v){this.attrs[k]=v;},classList:{toggle(k,v){if(v)nodes.get(id).classes.add(k);else nodes.get(id).classes.delete(k);}}});return nodes.get(id);}
 const context=vm.createContext({$:node,document:{querySelectorAll:()=>buttons},location:{reload(){context.reloads++;}},reloads:0,Math,console});
 vm.runInContext(source.slice(source.indexOf('let retryPreview='),source.indexOf('async function initializeStudio')),context);
 return {context,node,nodes,buttons};
}
const zoomCode=source.slice(source.indexOf('export function studioZoom'),source.indexOf('const $=id=>')).replace('export ','');
const z=vm.runInNewContext(zoomCode+';studioZoom;');
check(z(1,.15)===1.15&&z(1,-.15)===.85,'both zoom controls change the actual magnification');
check(z(.75,-1)===.75&&z(1.8,1)===1.8,'zoom stops at defined useful limits');
check(z(NaN,Infinity)===1&&z(1.15,NaN)===1.15,'malformed zoom inputs cannot poison the camera');
const applyCode=source.slice(source.indexOf('function applyLook(){'),source.indexOf('function selectCollection('));
const horseCode=source.slice(source.indexOf('async function chooseHorse('),source.indexOf('function setZoom('));
(async()=>{
 const f=fixture();let fail=true,painted=0;
 Object.assign(f.context,{state:{ready:true,error:null,equipped:{saddle:{id:'tc_fern_saddle'}},kit:{apply(){if(fail)throw Error('temporary geometry failure');},update(){}}},paintInfo(){painted++;},updateDetailBounds(){},health(){},render(){}});
 vm.runInContext(applyCode+';applyLook();',f.context);
 check(!f.node('status').hidden&&!f.node('studio-retry').hidden&&f.context.state.error==='temporary geometry failure','a look error shows actionable retry');
 fail=false;f.node('studio-retry').onclick();
 check(f.node('status').hidden&&f.node('studio-retry').hidden&&!f.context.state.error,'successful retry clears the stale failure overlay');
 check(f.context.state.equipped.saddle.id==='tc_fern_saddle'&&painted===2,'retry preserves the exact selected tack');
 f.context.state.ready=false;vm.runInContext("setStudioStatus('Fitting your tack…',{loading:true});applyLook();",f.context);
 check(!f.node('status').hidden&&f.node('status').classes.has('is-loading')&&f.node('stage').attrs['aria-busy']==='true','changing a look during model loading cannot prematurely dismiss loading');
 // Real async horse-selection logic: retain selection, retry the failed model,
 // and ignore a stale response after the player has changed horses again.
 const h=fixture(),loads=[],mounted=[];let disposed=0;
 const makeRig=key=>({key,scene:{updateMatrixWorld(){}},profile:{},heroMotion:{}});
 Object.assign(h.context,{THREE:{},state:{ready:false,error:null,equipped:{pad:{id:'tc_fern_pad'}},kit:null,rig:null},serial:0,horseOptions:[{key:'bay'},{key:'white'}],previewRows:new Map(),
  library:{resolve:k=>k,load:key=>new Promise((resolve,reject)=>loads.push({key,resolve,reject})),instantiate:asset=>makeRig(asset.key)},mount:{position:{y:0},remove(){},add:scene=>mounted.push(scene)},disposeMountedRig(){disposed++;},initGameHero(){},tickGameHero(){},finishNativeHorseGrooms(){},baseBounds:{setFromObject(){}},createTackCollection:()=>({update(){},dispose(){}}),getNativeHorseCapabilities:()=>({}),studioSupportsGait:()=>true,paintHorseCredit(){},gait(){},updateDetailBounds(){},paintInfo(){},health(){},render(){}});
 vm.runInContext(horseCode,h.context);
 const first=h.context.chooseHorse('bay');loads[0].reject(Error('offline'));await first;
 check(h.context.state.error==='offline'&&!h.node('studio-retry').hidden,'failed native model load offers a retry');
 const retry=h.node('studio-retry').onclick();
 check(loads.length===2&&loads[1].key==='bay'&&h.node('studio-retry').hidden,'retry requests the same model only once and hides itself while loading');
 loads[1].resolve({key:'bay',profile:{}});await new Promise(resolve=>setImmediate(resolve));
 check(h.context.state.ready&&h.context.state.horse==='bay'&&h.node('status').hidden,'retried model becomes ready and removes loading/error UI');
 check(h.context.state.equipped.pad.id==='tc_fern_pad','model retry never resets the selected look');
 const slow=h.context.chooseHorse('bay'),latest=h.context.chooseHorse('white');
 loads[3].resolve({key:'white',profile:{}});await latest;const disposalCount=disposed;
 loads[2].resolve({key:'bay',profile:{}});await slow;
 check(h.context.state.horse==='white'&&disposed===disposalCount&&h.node('horse').value==='white','a stale model response cannot replace or dispose the latest horse');
 const before=loads.length;await h.context.chooseHorse('dragon');
 check(loads.length===before&&h.context.state.horse==='white'&&!h.node('horse-notice').hidden,'unknown/unsupported horses never silently load a fallback');
 // Full bootstrap with WebGL explicitly unavailable: the actual top-level
 // catch must replace an endless spinner with recovery and a working button.
 const g=fixture();g.context=vm.createContext({console,reloads:0});g.context.window={};g.context.URLSearchParams=URLSearchParams;g.context.location={search:'',hostname:'localhost',reload:()=>g.context.reloads++};
 g.context.document={getElementById:g.node,body:{classList:{add(){}}}};
 g.context.THREE={WebGLRenderer:class{constructor(){throw Error('WebGL unavailable');}}};
 vm.runInContext(source.replace(/^import .*;\n/gm,'').replace(/^export /gm,''),g.context);
 await new Promise(resolve=>setImmediate(resolve));
 check(!g.node('status').hidden&&!g.node('studio-retry').hidden&&!g.node('status').classes.has('is-loading'),'WebGL failure is recoverable instead of an endless preparing screen');
 check(g.node('status-text').textContent.includes('3D view could not start')&&g.node('stage').attrs['aria-busy']==='false','startup failure gives clear guidance and ends aria-busy');
 g.node('studio-retry').onclick();check(g.context.reloads===1,'graphics retry is explicit and invokes a fresh page setup');
 const html=fs.readFileSync(require.resolve('../tack-studio.html'),'utf8'),store=fs.readFileSync(require.resolve('../store.html'),'utf8');
 for(const text of [html,store])check(text.includes('aria-label="Ranch destinations"')&&text.includes('>Store</a>')&&text.includes('>Fitting room</a>')&&text.includes('>Boutique</a>'),'standalone pages provide the same three named destinations');
 check(html.includes('id="zoom-in" aria-label="Zoom in"')&&html.includes('id="zoom-out" aria-label="Zoom out"'),'zoom buttons have specific accessible names');
 check(html.includes('id="preview-controls" hidden')&&html.includes('aria-controls="preview-controls"'),'secondary inspect/gait controls begin collapsed with an accessible toggle');
 console.log(`Standalone polish QA passed: ${checks} checks; real zoom, retry, stale model response, WebGL failure and shared navigation.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
