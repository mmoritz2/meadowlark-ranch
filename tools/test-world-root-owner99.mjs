import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyHollowpeakTreeCohort} from '../assets/hollowpeak-tree-cohort.mjs?v=character-foundation99-20261021';
const triangle=[[-.1,0,-.1],[.1,0,-.1],[0,.1,.1]],parts=[{name:'source wood',geo:{attributes:{position:{count:3,getX:i=>triangle[i][0],getY:i=>triangle[i][1],getZ:i=>triangle[i][2]}},index:[0,1,2]}}];
const matrix=(x,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,0,z,1];
function world(){let invalidations=0;return{world:{colliders:[],forestPoints:[],fallsLandscape:{ownedQueries:{affectsFootprint:()=>true,ecologyAt:()=>({wet:true,fall:false}),heightAt:()=>0,derivativesAt:()=>({grade:0})}},solidWorld:{register(){throw Error('Unexpected source wood registration');},unregister(){throw Error('Unexpected source wood unregistration');}}},scene:{getObjectByName:()=>null},followCam:{invalidateTrees(){invalidations++;}},invalidations:()=>invalidations};}
function rootTree(G,writer='snowfield-pines',x=-140.50130113878163,z=-229.24749159154496){
 const collider={x,z,r:.75,...(writer==='barn-treeline'?{height:9.7}:{})},owner={kind:'natural-pine-root',writer,collider,forestPoint:{x,z,s:1.3},forestPointDomain:'natural-root-traversal'},root={scale:{x:1.3},userData:{hollowpeakRootOwner:owner}};
 G.world.colliders.push(collider);G.world.forestPoints.push(owner.forestPoint);return{x,z,root,rootOwner:owner,kind:'pine',source:{key:'mature-pine',parts},matrix:{fromArray(e){this.elements=e.slice();},elements:matrix(x,z)},hollowpeakActualNominalMatrix:matrix(x,z)};
}
const preview=(G,trees)=>applyHollowpeakTreeCohort(G,trees,{commit:false});
test('both literal natural-pine writer domains retire only their exact original collider and later forest-point object, once',()=>{
 const G=world(),trees=[rootTree(G,'snowfield-pines'),rootTree(G,'barn-treeline',-145,-231)],unrelated={x:77,z:99,r:3},point={x:77,z:99,s:2};G.world.colliders.push(unrelated);G.world.forestPoints.push(point);
 const p=preview(G,trees);assert.equal(p.status,'ready-to-commit');assert.equal(p.members.length,2);assert(p.members.every(m=>m.plan.action==='retire'));assert.equal(G.world.colliders.length,3);assert.equal(G.invalidations(),0);
 const out=applyHollowpeakTreeCohort(G,trees,{prepared:p});assert.equal(out.status,'applied');assert.equal(out.retired,2);assert(out.members.every(m=>m.ownerKind==='natural-root'));assert.deepEqual(G.world.colliders,[unrelated]);assert.deepEqual(G.world.forestPoints,[point]);assert(trees.every(t=>t.rootOwner.hollowpeakContactRetired===true));assert.equal(G.invalidations(),1);
 assert.throws(()=>applyHollowpeakTreeCohort(G,trees,{prepared:p}),/must run once/);assert.deepEqual(G.world.colliders,[unrelated]);assert.deepEqual(G.world.forestPoints,[point]);
});
test('missing, duplicate, copied, wrong-kind and shared root owners fail before mutation; commit rechecks ownership',()=>{
 const mutations=[
  (G,t)=>{G.world.colliders.length=0;},
  (G,t)=>{G.world.colliders.push(t.rootOwner.collider);},
  (G,t)=>{t.rootOwner.collider={...t.rootOwner.collider};},
  (G,t)=>{t.root.userData.hollowpeakRootOwner={...t.rootOwner};},
  (G,t)=>{t.rootOwner.kind='generic-root';},
  (G,t)=>{t.rootOwner.writer='other-world-tree';},
  (G,t)=>{delete t.rootOwner.forestPointDomain;},
  (G,t)=>{G.world.forestPoints.length=0;},
  (G,t)=>{G.world.forestPoints.push(t.rootOwner.forestPoint);},
  (G,t)=>{t.rootOwner.forestPoint=null;},
  (G,t)=>{t.rootOwner.forestPointDomain='absent';},
  (G,t)=>{t.rootOwner.forestPoint={...t.rootOwner.forestPoint};},
  (G,t)=>{t.rootOwner.collider.r=.8;},
  (G,t)=>{t.rootOwner.collider.wildcard=true;},
 ];
 for(const mutate of mutations){const G=world(),t=rootTree(G);mutate(G,t);const before=[...G.world.colliders],p=preview(G,[t]);assert.equal(p.status,'blocked-before-mutation');assert(p.blocked.length);assert.deepEqual(G.world.colliders,before);assert.equal(t.hollowpeakCohort,undefined);}
 {const G=world(),a=rootTree(G),b=rootTree(G);G.world.colliders.pop();b.rootOwner.collider=a.rootOwner.collider;const p=preview(G,[a,b]);assert.equal(p.status,'blocked-before-mutation');assert(p.blocked.some(x=>x.reason==='shared collider or forest-point retirement owner'));assert.equal(G.world.colliders.length,1);}
 {const G=world(),t=rootTree(G),trees=[t],p=preview(G,trees);G.world.colliders.push(t.rootOwner.collider);assert.throws(()=>applyHollowpeakTreeCohort(G,trees,{prepared:p}),/physical ownership changed/);assert.equal(G.world.colliders.length,2);assert.equal(t.hollowpeakCohort,undefined);}
});
test('existing flora and seed ownership still require exact collider and forest point, with unchanged valid retirement',()=>{
 for(const kind of ['flora','seed'])for(const broken of [false,true]){
  const G=world(),x=-140,z=-229,point={x,z,s:1.5},collider={x,z,r:kind==='seed'?.8:.65,height:kind==='seed'?1.5*7.4:8},t={x,z,kind:'pine',source:{key:'mature-pine',parts},matrix:{fromArray(e){this.elements=e.slice();},elements:matrix(x,z)},hollowpeakActualNominalMatrix:matrix(x,z)};
  G.world.colliders.push(collider);G.world.forestPoints.push(point);
  if(kind==='flora')t.floraOwner={collider,forestPoint:point};else{t.stem={userData:{treePoints:[point]}};t.index=0;}
  if(broken)G.world.forestPoints.length=0;const trees=[t],p=preview(G,trees);
  if(broken){assert.equal(p.status,'blocked-before-mutation');assert.equal(G.world.colliders.length,1);}else{assert.equal(p.status,'ready-to-commit');const out=applyHollowpeakTreeCohort(G,trees,{prepared:p});assert.equal(out.members[0].ownerKind,kind);assert.equal(G.world.colliders.length,0);assert.equal(G.world.forestPoints.length,0);}
 }
 const G=world(),t={x:-140,z:-229,source:{key:'mature-pine',parts},matrix:{fromArray(){}},hollowpeakActualNominalMatrix:matrix(-140,-229)};assert.equal(preview(G,[t]).status,'blocked-before-mutation','ordinary unlinked tree is never waived');
});
