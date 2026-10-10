import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../breeds.html',import.meta.url),'utf8');
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g,'');
// Evaluate the actual simple width/height media rules and declaration order.
// This is a cascade fixture, not a browser layout or screenshot substitute.
function rules(text,conditions=[]){
 const result=[];let cursor=0;
 while(cursor<text.length){const open=text.indexOf('{',cursor);if(open<0)break;const selector=text.slice(cursor,open).trim();let depth=1,end=open+1;for(;end<text.length&&depth;end++){if(text[end]==='{')depth++;if(text[end]==='}')depth--;}
  const body=text.slice(open+1,end-1);cursor=end;
  if(selector.startsWith('@media'))result.push(...rules(body,[...conditions,selector.slice(6)]));
  else result.push({selectors:selector.split(',').map(s=>s.trim()),conditions,declarations:Object.fromEntries(body.split(';').map(row=>{const i=row.indexOf(':');return i<0?null:[row.slice(0,i).trim(),row.slice(i+1).trim()];}).filter(Boolean))});
 }
 return result;
}
const parsed=rules(css);
function matches(condition,width,height){return condition.split(',').some(query=>[...query.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)].every(([,kind,axis,n])=>kind==='max'?(axis==='width'?width:height)<=Number(n):(axis==='width'?width:height)>=Number(n)));}
function style(selector,width,height){return Object.assign({},...parsed.filter(rule=>rule.selectors.includes(selector)&&rule.conditions.every(condition=>matches(condition,width,height))).map(rule=>rule.declarations));}

test('The 721×937 user viewport and tall tablets receive the complete compact layout',()=>{
 for(const [width,height]of [[721,937],[768,1024],[900,937],[900,541]]){
  assert.equal(style('main',width,height)['grid-template-columns'],'1fr');assert.equal(style('main',width,height)['grid-template-rows'],'128px minmax(0,1fr)');
  assert.equal(style('#list',width,height).display,'flex');assert.equal(style('#list',width,height).overflow,'auto');assert.equal(style('#breed-search',width,height).display,'none');
  assert.equal(style('.controls button',width,height)['font-size'],'14px');assert.equal(style('.controls button',width,height)['min-height'],'44px');
 }
});
test('Existing 320/390/700px layouts retain their horizontal breed rail and44px controls',()=>{
 for(const [width,height]of [[320,844],[390,844],[700,844],[390,390]]){
  assert.equal(style('main',width,height)['grid-template-columns'],'1fr');assert.equal(style('main',width,height)['grid-template-rows'],'128px minmax(0,1fr)');assert.equal(style('#list',width,height).display,'flex');assert.equal(style('.controls button',width,height)['min-height'],'44px');assert.equal(style('.controls button',width,height)['font-size'],'14px');
 }
});
test('Short landscape and wide desktop preserve the sidebar, search and appropriate toolbar height',()=>{
 for(const [width,height]of [[721,540],[844,390],[900,540],[901,937],[1280,720]]){
  assert.equal(style('main',width,height)['grid-template-columns'],'300px 1fr');assert.equal(style('#list',width,height).display,'grid');assert.notEqual(style('#breed-search',width,height).display,'none');
 }
 assert.equal(style('.controls',844,390)['max-height'],'62%');assert.equal(style('.controls',1280,720)['max-height'],'52%');
});
