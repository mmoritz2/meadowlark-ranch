import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {overviewHorseGroups,createOverviewVisibility} from '../assets/features/care-visibility.js';
const group=(x,z,visible=true)=>({position:{x,z},visible,parent:null});

test('The prologue filly and exposed horse sources are collected once without scenery',()=>{
 const filly=group(3,0),pasture=group(5,0),wild=group(100,0),remote=group(2,0),barn=group(8,0);
 const G={storyQuests:{foal:()=>({group:filly})},horse:{herd:()=>[{parts:{group:pasture}}]},
  wild:{get:()=>({parts:{group:wild}})},worldPkg:{herds:[{members:[{parts:{group:wild}}]}]},
  ranch:{standing:()=>[{parts:{group:barn}}]},ranchSys:{barnHorses:()=>[]},net:{remotes:{r:{parts:{group:remote}}}}};
 assert.deepEqual(new Set(overviewHorseGroups(G)),new Set([filly,pasture,wild,remote,barn]));
 assert.deepEqual(overviewHorseGroups({}),[]);
});

test('Only nearby background horses hide, and every original visibility returns exactly',()=>{
 const view=createOverviewVisibility(),filly=group(2.8,0),alreadyHidden=group(4,0,false),distant=group(90,0);
 view.update([filly,alreadyHidden,distant],{x:0,z:0});
 assert.equal(filly.visible,false);assert.equal(alreadyHidden.visible,false);assert.equal(distant.visible,true);
 filly.visible=true;view.update([filly,alreadyHidden,distant],{x:0,z:0});
 assert.equal(filly.visible,false,'story tick cannot put the filly back into the overview');
 view.restore();assert.equal(filly.visible,true);assert.equal(alreadyHidden.visible,false);assert.equal(distant.visible,true);
 view.restore();assert.equal(filly.visible,true,'repeated close is harmless');
});

test('Mounted horse, parked on-foot horse and their containers remain protected',()=>{
 const view=createOverviewVisibility(),mount=group(0,0,false),parked=group(1,0),container=group(1,0),child=group(0,0),other=group(3,0);
 parked.parent=container;child.parent=mount;
 view.update([mount,parked,container,child,other],{x:1,z:0,protectedGroups:[mount,parked]});
 assert.equal(mount.visible,false,'hidden mount stays hidden while on foot');
 assert.equal(parked.visible,true);assert.equal(container.visible,true);assert.equal(child.visible,true);assert.equal(other.visible,false);
 view.restore();assert.equal(other.visible,true);
});

test('Horse switches, departures and newly arriving horses preserve their own state',()=>{
 const view=createOverviewVisibility(),first=group(1,0),second=group(2,0),arriving=group(3,0,false);
 view.update([first,second],{x:0,z:0,protectedGroups:[first]});assert.equal(second.visible,false);
 view.update([first,second,arriving],{x:0,z:0,protectedGroups:[second]});
 assert.equal(second.visible,true,'newly selected horse is restored');assert.equal(first.visible,false);assert.equal(arriving.visible,false);
 first.position.x=50;view.update([first,second,arriving],{x:0,z:0,protectedGroups:[second]});assert.equal(first.visible,true);
 view.update([],{x:0,z:0});assert.equal(arriving.visible,false,'an originally hidden removed horse stays hidden');
 view.restore();assert.equal(second.visible,true);
});

test('Overview applies visibility both on open and after actor ticks, and restores on close',async()=>{
 const src=await readFile(new URL('../assets/features/se-care.js',import.meta.url),'utf8');
 const open=src.slice(src.indexOf(' function open(tab,'),src.indexOf(' const later='));
 assert.match(open,/clearHorseView\(\)/);assert.match(open,/overviewVisibility\.restore\(\)/);
 const camera=src.slice(src.indexOf(" G.on('camera',"),src.indexOf(' /* ?overview'));
 assert.match(camera,/if\(!ST.open\)return false[\s\S]*clearHorseView\(\)/);
});
