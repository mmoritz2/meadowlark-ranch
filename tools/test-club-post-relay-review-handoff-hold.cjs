const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('review/club-post-relay/client.js','utf8');
class KeyboardEvent extends Event{constructor(type,init={}){super(type,init);this.code=init.code;}}
const gameWindow=new EventTarget(),productionKeys={},events=[],gaits=[];let tick=null,now=0;
gameWindow.addEventListener('keydown',e=>productionKeys[e.code]=true);gameWindow.addEventListener('keyup',e=>productionKeys[e.code]=false);
const w={KeyboardEvent,document:{hidden:false,activeElement:{blur(){}},dispatchEvent(e){events.push({type:e.type,code:e.code});return gameWindow.dispatchEvent(e);}}};
const player={pos:{x:0,z:-5},heading:0,speed:0,onFoot:false,flying:false,y:0};
let current={id:'real-run',status:'riding',stage:'outbound',localId:'host-real',carrierId:'host-real',route:'road',returnRoute:'road',guide:{x:0,z:15,radius:.8,label:'Pines approach'},interaction:{inReach:false,eligible:false,action:null},offer:null};
const G={clubPostRelay:{snapshot:()=>({current})},horse:{player,RIG:()=>({ready:true})},input:{blocked:()=>false},cam:{isFree:()=>false},riding:{selectGait:g=>gaits.push(g),releaseAll(){for(const code of Object.keys(productionKeys))if(productionKeys[code])gameWindow.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));}}};
const ctx=vm.createContext({w,G,Date:{now:()=>now},setInterval:(fn)=>{tick=fn;return 1;},clearInterval:()=>{},clearTimeout:()=>{},$:()=>({disabled:false}),status:()=>{},publish:()=>{},fail:e=>{throw e;}});
vm.runInContext('const held={};let booted=true,driver=null,driverSession=null,driverStatus="off",steps=0,lastAim=null,manualTimer=null,jumpTimer=null;'+source.slice(source.indexOf('function rememberReleasedKey('),source.indexOf('function sample(')),ctx);
gameWindow.addEventListener('keyup',e=>vm.runInContext('rememberReleasedKey',ctx)(e));
vm.runInContext('drive()',ctx);tick();assert.equal(productionKeys.KeyW,true,'out-of-reach driver approaches');
current.stage='passPost';current.interaction={inReach:true,eligible:true,action:'offer',label:'Offer pouch'};now+=100;tick();assert.equal(productionKeys.KeyW,false,'eligible sender stops before Offer');
const countBefore=gaits.length;current.offer={id:'offer-real',from:'host-real',to:'guest-real'};current.interaction={inReach:true,eligible:false,action:null,label:'Waiting for teammate'};
for(let i=0;i<20;i++){now+=100;tick();assert.equal(productionKeys.KeyW,false,'sender stays stopped after Offer disappears while ack is pending');}
assert.equal(gaits.length,countBefore,'waiting does not select a new pace');assert.match(vm.runInContext('driverStatus',ctx),/teammate to accept/);
current.offer=null;current.stage='deliver';current.interaction={inReach:false,eligible:false,action:null};now+=100;tick();assert.equal(productionKeys.KeyW,true,'actual acknowledged stage transition releases the wait');
current.stage='passReply';current.interaction={inReach:true,eligible:false,action:null,reason:'Teammate is still approaching'};now+=100;tick();assert.equal(productionKeys.KeyW,false,'receiver in handoff reach also stops without an enabled button');
current.interaction.inReach=false;now+=100;tick();assert.equal(productionKeys.KeyW,true,'out-of-reach receiver still approaches');
assert.equal(events.filter(e=>e.code==='Space').length,0,'handoff wait never sends unrelated gameplay input');
console.log('Extracted actual driver handoff regression passed: approach outside reach; stop before Offer; hold20 ticks through null action/pending offer; resume after acknowledged stage; stop receiver in reach. No UI clicks or mission mutation.');
