// Evaluate the scalar sandy share emitted by the real terrain shader.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/terrain-realism.js',import.meta.url),'utf8');
const begin=source.indexOf('float soilWeight=0.0;'),end=source.indexOf('soilWeight*=soilReady;',begin);
assert(begin>0&&end>begin,'Ordered sandy material blend required');
const block=source.slice(begin,end+'soilWeight*=soilReady;'.length).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
function emittedBlend(outer){
 let enabled=true;const stack=[],lines=[];
 for(const raw of block.split('\n')){
  const line=raw.trim(),flag=line.match(/^#(ifdef|ifndef) OUTER_LANDSCAPE$/);
  if(flag){const branch=flag[1]==='ifdef'?outer:!outer;stack.push({enabled,branch});enabled=enabled&&branch;continue;}
  if(line==='#else'){const f=stack.at(-1);enabled=f.enabled&&!f.branch;continue;}
  if(line==='#endif'){enabled=stack.pop().enabled;continue;}
  if(!enabled)continue;
  if(line.includes('soilWeight')||/^if\(.+\)\{$/.test(line)||line==='}')lines.push(line.replace('float soilWeight','let soilWeight'));
 }
 assert.equal(stack.length,0);
 return Function('v','mix','max','smoothstep',
  'const {bank,wet,wear,rocky,scree,stone,canyon,thawLitter,snow,quarters,amber,marsh,tundra,ochre,grade,soilReady}=v;'+lines.join('\n')+';return soilWeight;');
}
const defaults={bank:0,wet:0,wear:0,rocky:0,scree:0,stone:0,canyon:0,thawLitter:0,snow:0,quarters:0,amber:0,marsh:0,tundra:0,ochre:0,grade:0,soilReady:1};
const mix=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const inner=emittedBlend(false),outer=emittedBlend(true);
const share=(v,fn=inner)=>fn({...defaults,...v},mix,Math.max,smoothstep);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} differs from ${b}`);
test('rock covering a bank suppresses sand detail to the surviving color share',()=>{
 near(share({bank:1}),.95);
 near(share({bank:1,rocky:1,scree:1,stone:1}),.03648);
 near(share({bank:1,wet:1}),0);
 near(share({bank:1,wear:1}),.209);
});
test('snow and litter remove underlying sand; ochre is composited afterward',()=>{
 near(share({bank:1,snow:1}),0);
 near(share({bank:1,snow:1},outer),.019);
 near(share({bank:1,thawLitter:1}),.304);
 near(share({bank:1,snow:1,quarters:1,ochre:1}),.94);
 near(share({bank:1,snow:1,quarters:1,ochre:1,stone:1}),0);
});
test('detail waits for its texture and all regional mixtures stay bounded',()=>{
 for(let i=0;i<1200;i++){
  const v={};let k=0;for(const key of Object.keys(defaults))v[key]=(Math.sin(i*.43+k++*1.7)+1)/2;
  v.soilReady=1;
  for(const fn of [inner,outer]){const w=share(v,fn);assert(Number.isFinite(w)&&w>=0&&w<=1);near(share({...v,soilReady:0},fn),0);}
 }
});
