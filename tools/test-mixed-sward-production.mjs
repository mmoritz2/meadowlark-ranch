import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createGrassTuftGeometry} from '../assets/meadow-cover.js';
import {
  MIXED_SWARD, prepareSwardRows, planMixedSward, readSwardSpecimens,
  createBasalSwardGeometry, installMixedSward, swardFamilyAt,
} from '../assets/mixed-sward.mjs';

const asset = fs.readFileSync(new URL('../assets/models/world/grass_medium_02_specimens.glb',import.meta.url));
const assetBuffer = asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const geometryBytes = g => Object.values(g.attributes).reduce((sum, a) => sum + a.array.byteLength, 0) + (g.index?.array.byteLength || 0);
const triangles = g => (g.index?.count || g.attributes.position.count) / 3;
const totalRoots = cells => cells.reduce((n, c) => n + c.count, 0);

// Flat synthetic source cells isolate selection/cache behavior from world eligibility.
function sourceCells() {
  const result = [];
  for (let z = -7; z < 7; z++) for (let x = -7; x < 7; x++) {
    const count = 40, matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
    for (let row = 0; row < count; row++) {
      const at = row * 16, yaw = row * .713, scale = .9 + (row % 7) * .04;
      matrices[at] = Math.cos(yaw) * scale;
      matrices[at + 2] = -Math.sin(yaw) * scale;
      matrices[at + 5] = .9 + (row % 5) * .04;
      matrices[at + 8] = Math.sin(yaw) * scale;
      matrices[at + 10] = Math.cos(yaw) * scale;
      matrices[at + 12] = x * 6 + (row % 8 + .5) * .75;
      matrices[at + 13] = -.02;
      matrices[at + 14] = z * 6 + (Math.floor(row / 8) + .5) * 1.2;
      matrices[at + 15] = 1;
      colors.set([.15 + (row % 3) * .01, .3, .08], row * 3);
    }
    result.push({count, version: 0, matrices, colors});
  }
  return result;
}
const sourceDigest = cells => digest(Buffer.concat(cells.flatMap(c => [Buffer.from(c.matrices.buffer), Buffer.from(c.colors.buffer)])));

function assertBudget(plan) {
  const actual = plan.near.length * MIXED_SWARD.sourceTriangles
    + plan.basal.length * MIXED_SWARD.richTriangles
    + plan.scans.reduce((sum, r) => sum + MIXED_SWARD.variantTriangles[r.variant], 0);
  assert.equal(actual, plan.stats.submittedTriangles);
  assert(actual <= plan.stats.budgetMaxTriangles);
  assert(plan.scans.length <= plan.stats.scanCap);
}

test('installed CC0 specimen library matches its declared source contract and rejects invalid data', () => {
  assert.equal(digest(asset), MIXED_SWARD.assetSha256);
  const specimens = readSwardSpecimens(assetBuffer);
  assert.deepEqual(specimens.map(s => s.triangles), Array.from(MIXED_SWARD.variantTriangles));
  assert.deepEqual(specimens.map(s => s.positions.length / 3), Array.from(MIXED_SWARD.variantVertices));
  assert.equal(specimens.reduce((n, s) => n + s.sourceComponents, 0), 191);
  for (const s of specimens) {
    assert([...s.positions, ...s.normals, ...s.uvs].every(Number.isFinite));
    assert(s.indices.every(i => i < s.positions.length / 3));
    const heights = Array.from(s.positions).filter((_, i) => i % 3 === 1);
    assert.equal(Math.min(...heights), 0);
    assert(Math.abs(Math.max(...heights) - s.sourceHeight) < 1e-7);
  }
  const wrong = assetBuffer.slice(0);
  new DataView(wrong).setUint32(0, 0, true);
  assert.throws(() => readSwardSpecimens(wrong));
  assert.throws(() => readSwardSpecimens(assetBuffer.slice(0, assetBuffer.byteLength - 4)));
});

test('three rich families have grounded tapered leaves, valid actual normals and the shared triangle budget', () => {
  const heights=[], hashes=[];
  for(let family=0;family<3;family++){
    const g=createBasalSwardGeometry(THREE,family),again=createBasalSwardGeometry(THREE,family);
    try{
      const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
      assert.equal(triangles(g),MIXED_SWARD.richTriangles);
      for(const a of Object.values(g.attributes)){assert(a.array instanceof Float32Array);assert(Array.from(a.array).every(Number.isFinite));assert.equal(a.count,p.count);}
      assert.deepEqual(g.index.array,again.index.array);
      for(const key of Object.keys(g.attributes))assert.deepEqual(g.attributes[key].array,again.attributes[key].array);
      assert(Array.from(uv.array).every(v=>v>=0&&v<=1));
      for(let i=0;i<n.count;i++)assert(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);
      for(let i=0;i<g.index.count;i+=3){const ids=Array.from(g.index.array.subarray(i,i+3));assert(ids.every(j=>Number.isInteger(j)&&j>=0&&j<p.count));const[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),face=new THREE.Vector3().crossVectors(b.sub(a),c.sub(a));assert(face.length()>1e-8);face.normalize();for(const id of ids)assert(face.dot(new THREE.Vector3().fromBufferAttribute(n,id))>0);}
      assert.equal(g.boundingBox.min.y,0);assert(g.boundingBox.max.y<=.95);heights.push(g.boundingBox.max.y);hashes.push(digest(Buffer.from(p.array.buffer)));
      for(let i=0;i<p.count;i++)assert(Math.hypot(p.getX(i),p.getZ(i))<.5);
      const leafCount=family===2?6:10;
      for(let leaf=0;leaf<leafCount;leaf++){const at=leaf*9;assert.equal(p.getY(at),0);assert.equal(p.getY(at+1),0);assert.equal(uv.getY(at),0);assert.equal(uv.getY(at+8),1);assert.equal(uv.getX(at+8),.5);assert(p.getY(at+6)>p.getY(at+8));}
      const normals=n.array.slice();g.computeVertexNormals();assert.deepEqual(n.array,normals);
    }finally{g.dispose();again.dispose();}
  }
  assert.equal(new Set(hashes).size,3);assert(heights[0]>heights[1]*2);assert(heights[2]>heights[0]*1.3);
});

test('selection is deterministic, respects budgets/exclusions and never mutates source rows or consumes placement RNG', () => {
  const cells = sourceCells(), before = sourceDigest(cells), random = Math.random;
  try {
    Math.random = () => { throw Error('Placement RNG used'); };
    const first = planMixedSward(cells, {x: 0, z: 0});
    assert.deepEqual(first, planMixedSward(cells, {x: 0, z: 0}));
    for (const quality of ['high', 'medium', 'low', 'unknown']) {
      const plan = planMixedSward(cells, {x: 0, z: 0, quality});
      assertBudget(plan);
      if (quality === 'low' || quality === 'unknown') {
        assert.equal(plan.scans.length, 0);
        assert.equal(plan.basal.length, 0);
        assert.equal(plan.retired.length, 0);
        assert.equal(plan.stats.triangleDelta, 0);
      }
    }
    const guarded = planMixedSward(cells, {x: 0, z: 0, canBasal: x => x < 0, canAccent: () => false});
    assert.equal(guarded.scans.length, 0);
    assert(guarded.basal.every(r => r.x < 0));
    assert(guarded.near.some(r => r.x >= 0));
    const vr = planMixedSward(cells, {x: 0, z: 0, vr: true});
    assert.equal(vr.near.length, Math.floor(totalRoots(cells) / 2));
    assert.equal(vr.basal.length, 0);
    assert.equal(vr.scans.length, 0);
    assertBudget(vr);
    assert.equal(sourceDigest(cells), before);
  } finally { Math.random = random; }
});

test('only zero-faded rows are reclaimed; rich fallback uses its actual triangle difference without erasing visible roots', () => {
  const cells = sourceCells(), plan = planMixedSward(cells, {x: 0, z: 0});
  for (const r of plan.retired) {
    assert(Math.hypot(r.x, r.z) >= MIXED_SWARD.retireRadius);
    for (let a = 0; a < 12; a++) {
      assert(Math.hypot(r.x - Math.cos(a) * 1.25, r.z - Math.sin(a) * 1.25) > MIXED_SWARD.fadeZeroRadius);
    }
  }
  const compact = cells.slice(0, 1).map(c => ({...c, matrices: c.matrices.slice(), colors: c.colors.slice()}));
  for (let i = 0; i < compact[0].count; i++) {
    compact[0].matrices[i * 16 + 12] = (i % 8) * .1;
    compact[0].matrices[i * 16 + 14] = Math.floor(i / 8) * .1;
  }
  const metadata = prepareSwardRows(compact), eligible = metadata.rows.filter(r => r.richEligible).length;
  const extra = MIXED_SWARD.richTriangles - MIXED_SWARD.sourceTriangles;
  const base = totalRoots(compact) * MIXED_SWARD.sourceTriangles;
  const max = Math.floor(base * MIXED_SWARD.maxTriangleRatio);
  assert(extra > 0);
  const expectedFallback = Math.max(0, Math.ceil((base + eligible * extra - max) / extra));
  const fallback = planMixedSward(compact, {x: 0, z: 0, metadata, canAccent: () => false});
  assert.equal(fallback.stats.richFallbackRoots, expectedFallback);
  assert.equal(fallback.retired.length, 0);
  assert.equal(fallback.near.length + fallback.basal.length, totalRoots(compact));
  assert.equal(fallback.stats.submittedTriangles, base + (eligible - expectedFallback) * extra);
  assertBudget(fallback);
});

test('per-cell versions classify only refilled cells; live accent clearance is rechecked without static refill', () => {
  const cells = sourceCells(), cellCache = new WeakMap();
  let basalChecks = 0, accentChecks = 0;
  const canBasal = () => { basalChecks++; return true; };
  let metadata = prepareSwardRows(cells, {canBasal, cellCache});
  const count = totalRoots(cells);
  assert.equal(basalChecks, count);
  assert.equal(metadata.classifiedRoots, count);
  const clear = planMixedSward(cells, {x: 0, z: 0, metadata, canAccent: () => { accentChecks++; return true; }});
  assert(clear.scans.length > 0, 'Fixture exercises actual accent candidates');
  const checked = accentChecks;
  const blocked = planMixedSward(cells, {x: .1, z: 0, metadata, canAccent: () => { accentChecks++; return false; }});
  assert.equal(blocked.scans.length, 0);
  assert(accentChecks > checked);
  assert.equal(basalChecks, count);
  cells[57].version++;
  metadata = prepareSwardRows(cells, {canBasal, cellCache});
  assert.equal(metadata.classifiedRoots, cells[57].count);
  assert.equal(metadata.reusedRoots, count - cells[57].count);
  assert.equal(basalChecks, count + cells[57].count);
  assert(planMixedSward(cells, {x: 0, z: 0, metadata, canAccent: () => true}).scans.length > 0);
});

function world(initialQuality = 'high') {
  let quality = initialQuality, version = 1, vr = false, sharedDisposed = 0;
  const cells = sourceCells(), capacity = totalRoots(cells), scene = new THREE.Scene(), hooks = new Map();
  const checks = {basal: 0, accent: 0, query: 0};
  const nearMaterial = new THREE.MeshStandardMaterial({vertexColors: true});
  const scanMaterial = new THREE.MeshStandardMaterial({name: 'Trail edge | scanned meadow grass'});
  scanMaterial.map = new THREE.Texture();
  for (const resource of [nearMaterial, scanMaterial, scanMaterial.map]) resource.addEventListener('dispose', () => sharedDisposed++);
  const near = new THREE.InstancedMesh(createGrassTuftGeometry(THREE, {profile: 'near-folded-v1'}), nearMaterial, capacity);
  assert.equal(triangles(near.geometry), MIXED_SWARD.sourceTriangles);
  near.setColorAt(0, new THREE.Color());
  const resident = new THREE.Mesh(new THREE.BufferGeometry(), scanMaterial);
  scene.add(near, resident);
  let unlock;
  const readiness = new Promise(resolve => { unlock = resolve; });
  const source = {
    cells, key: () => version, vr: () => vr,
    canBasal: () => { checks.basal++; return true; },
    canAccent: () => { checks.accent++; return true; },
    beginAccentQuery: () => { checks.query++; },
  };
  const G = {
    THREE, scene, world: {nearGroundCover: {near, swardSource: source}, ranchBuilderArt: {ready: readiness}},
    worldDetails: {ready: readiness}, worldPaths: {roadsideReady: readiness},
    gfx: {get: () => quality}, horse: {player: {pos: {x: 0, z: 0}}},
    on: (name, callback) => hooks.set(name, callback),
    off: (name, callback) => { if (hooks.get(name) === callback) hooks.delete(name); },
  };
  function repackOriginal() {
    near.instanceMatrix.array.fill(0);
    near.instanceColor.array.fill(0);
    const limit = vr ? Math.floor(totalRoots(cells) / 2) : totalRoots(cells);
    let used = 0;
    for (const c of cells) {
      const take = Math.min(c.count, limit - used);
      if (take <= 0) break;
      near.instanceMatrix.array.set(c.matrices.subarray(0, take * 16), used * 16);
      near.instanceColor.array.set(c.colors.subarray(0, take * 3), used * 3);
      used += take;
    }
    near.count = used;
    near.instanceMatrix.needsUpdate = near.instanceColor.needsUpdate = true;
  }
  repackOriginal();
  return {
    G, near, cells, hooks, checks, unlock, repackOriginal, nearMaterial, scanMaterial,
    sharedDisposed: () => sharedDisposed, quality: q => { quality = q; }, vr: value => { vr = value; },
    version: () => { version++; }, tick: () => hooks.get('tick')?.(1 / 60, 120),
  };
}
function originalRows(w) {
  const matrices = [], colors = [];
  let remaining = w.near.count;
  for (const c of w.cells) {
    const take = Math.min(c.count, remaining);
    matrices.push(...c.matrices.subarray(0, take * 16));
    colors.push(...c.colors.subarray(0, take * 3));
    remaining -= take;
  }
  assert.equal(remaining, 0);
  assert.deepEqual(w.near.instanceMatrix.array.subarray(0, w.near.count * 16), new Float32Array(matrices));
  assert.deepEqual(w.near.instanceColor.array.subarray(0, w.near.count * 3), new Float32Array(colors));
}
const fetchAsset = async () => ({ok: true, arrayBuffer: async () => assetBuffer});
function actualBudget(w, state) {
  const actual = w.near.count * triangles(w.near.geometry)
    + state.basalMeshes.reduce((sum,m) => sum + m.count * triangles(m.geometry), 0)
    + state.meshes.reduce((sum, m) => sum + m.count * triangles(m.geometry), 0);
  assert.equal(actual, state.stats.submittedTriangles);
  assert(actual <= state.stats.budgetMaxTriangles);
  assert.deepEqual(state.stats.familyCounts,state.basalMeshes.map(m=>m.count));
  assert.equal(state.stats.familyCounts.reduce((a,b)=>a+b,0),state.stats.basalRoots);
  assert.equal(state.stats.instanceBytes,[...state.basalMeshes,...state.meshes].reduce((sum,m)=>sum+m.instanceMatrix.array.byteLength+(m.instanceColor?.array.byteLength||0),0));
  assert.equal(state.stats.geometryBytes,[...state.basalMeshes,...state.meshes].reduce((sum,m)=>sum+geometryBytes(m.geometry),0));
}

test('deferred installation, High→Low→VR→High and disposal preserve original owners and counted rows', async () => {
  const w = world(), originalHash = sourceDigest(w.cells);
  let fetched = false;
  const state = installMixedSward(w.G, {fetchAsset: async () => { fetched = true; return fetchAsset(); }});
  await Promise.resolve();
  assert.equal(fetched, false);
  assert.equal(w.G.scene.children.length, 2);
  assert.equal(state.basal, null);
  w.unlock();
  await state.ready;
  assert.deepEqual(state.errors, []);
  assert(state.stats.basalRoots > 0);
  assert(state.stats.scanRoots > 0);
  assert.equal(state.basalMeshes.length, 3);
  assert.equal(state.basal, state.basalMeshes[0]);
  assert(state.basalMeshes.every(m => m.material === w.nearMaterial && !m.castShadow && m.receiveShadow));
  assert(state.meshes.every(m => m.material === w.scanMaterial && !m.castShadow && m.receiveShadow));
  assert.equal(state.stats.addedMaterialCount, 0);
  assert.equal(state.stats.addedTextureCount, 0);
  assert.equal(state.stats.geometryBytes, [...state.basalMeshes,...state.meshes].reduce((sum, m) => sum + geometryBytes(m.geometry), 0));
  exactFamilyRows(w,state);
  actualBudget(w, state);
  w.quality('low'); w.tick();
  originalRows(w); actualBudget(w, state);
  assert(state.basalMeshes.every(m => m.count === 0));
  assert.deepEqual(state.stats.familyCounts,[0,0,0]);
  assert(state.meshes.every(m => m.count === 0));
  const checks = {...w.checks}, builds = state.stats.timing.rebuilds;
  const matrixVersion = w.near.instanceMatrix.version;
  w.G.horse.player.pos.x = 12; w.tick();
  assert.deepEqual(w.checks, checks);
  assert.equal(state.stats.timing.rebuilds, builds);
  assert.equal(w.near.instanceMatrix.version, matrixVersion);
  // This reproduces the production order: original nearGrass repacks before G's tick hook.
  w.cells[0].count -= 3; w.cells[0].version++; w.version(); w.repackOriginal(); w.tick();
  assert.deepEqual(w.checks, checks);
  assert.equal(state.stats.classifiedRoots, 0);
  originalRows(w); actualBudget(w, state);
  w.vr(true); w.tick();
  assert.equal(w.near.count, Math.floor(totalRoots(w.cells) / 2));
  originalRows(w); actualBudget(w, state);
  w.quality('high'); w.tick();
  assert.deepEqual(w.checks, checks, 'VR stays on the cheap path despite High preference');
  w.vr(false); w.tick();
  assert(state.stats.basalRoots > 0);
  exactFamilyRows(w,state);
  actualBudget(w, state);
  const ownedMeshes=[...state.basalMeshes,...state.meshes];
  const owned = [...ownedMeshes, ...ownedMeshes.map(m => m.geometry)];
  let disposed = 0;
  for (const resource of owned) resource.addEventListener('dispose', () => disposed++);
  state.dispose(); state.dispose();
  assert.equal(disposed, owned.length, 'Owned resources disposed exactly once');
  assert.equal(w.near.count, totalRoots(w.cells));
  originalRows(w);
  assert.equal(w.sharedDisposed(), 0);
  assert.equal(w.G.scene.children.length, 2);
  assert.equal(w.hooks.size, 0);
  assert.equal(sourceDigest(w.cells), originalHash, 'Count changes do not alter source array bytes');
});

test('Low boot and refills skip all eligibility and accent planning', async () => {
  const w = world('low'); w.unlock();
  const state = installMixedSward(w.G, {fetchAsset});
  await state.ready;
  assert.deepEqual(state.errors, []);
  for (const vr of [false, true]) {
    w.vr(vr); w.tick();
    const builds = state.stats.timing.rebuilds;
    for (const x of [6, 12, 18]) {
      w.G.horse.player.pos.x = x; w.tick();
      assert.equal(state.stats.timing.rebuilds, builds);
    }
    w.cells[1].version++; w.version(); w.repackOriginal(); w.tick();
    assert.deepEqual(w.checks, {basal: 0, accent: 0, query: 0});
    assert.equal(state.stats.timing.eligibilityMs, 0);
    assert.equal(state.stats.timing.selectionMs, 0);
    originalRows(w); actualBudget(w, state);
  }
  state.dispose();
  assert.equal(w.sharedDisposed(), 0);
});

test('early cancellation and failed asset loading leave original source resources and rows intact', async () => {
  const w = world(); let fetched = false;
  const cancelled = installMixedSward(w.G, {fetchAsset: async () => { fetched = true; return fetchAsset(); }});
  cancelled.dispose(); w.unlock(); await cancelled.ready;
  assert.equal(fetched, false);
  assert.equal(w.G.scene.children.length, 2);
  originalRows(w);
  for (const loader of [async () => ({ok: false, status: 404}), async () => { throw Error('network failure'); }]) {
    const failed = world(); failed.unlock();
    const warn = console.warn;
    let state;
    try {
      console.warn = () => {};
      state = installMixedSward(failed.G, {fetchAsset: loader});
      await state.ready;
    } finally { console.warn = warn; }
    assert(state.disposed);
    assert.equal(state.errors.length, 1);
    assert.equal(failed.G.scene.children.length, 2);
    assert.equal(failed.hooks.size, 0);
    assert.equal(failed.sharedDisposed(), 0);
    originalRows(failed);
  }
});

function exactFamilyRows(w,state){
 const rows=new Map();
 for(const cell of w.cells)for(let i=0;i<cell.count;i++){const matrix=cell.matrices.subarray(i*16,i*16+16),color=cell.colors.subarray(i*3,i*3+3),key=[matrix[12],matrix[13],matrix[14]].join(',');assert(!rows.has(key));rows.set(key,{matrix,color});}
 const seen=new Set(),assignments=new Map();
 for(const mesh of [w.near,...state.basalMeshes]){
  for(let i=0;i<mesh.count;i++){
   const matrix=mesh.instanceMatrix.array.subarray(i*16,i*16+16),color=mesh.instanceColor.array.subarray(i*3,i*3+3),key=[matrix[12],matrix[13],matrix[14]].join(','),source=rows.get(key);
   assert(source,'Every draw originates at a counted source root');assert(!seen.has(key),'No root duplicated between source and family draws');seen.add(key);
   assert.deepEqual(matrix,source.matrix,'Full original basis, yaw, scale and translation preserved');assert.deepEqual(color,source.color,'Full source color preserved');
   if(mesh!==w.near){const family=state.basalMeshes.indexOf(mesh);assert.equal(family,swardFamilyAt(matrix[12],matrix[14]));assert.equal(mesh.userData.grassFamily,family);assignments.set(key,family);}
  }
 }
 assert.equal(seen.size,state.stats.nearRoots+state.stats.basalRoots);
 assert.equal(rows.size-seen.size,state.stats.retiredRoots);
 return assignments;
}

test('families keep exact source matrices/colors and assignment through return journeys and cell refills',async()=>{
 const w=world();w.unlock();const state=installMixedSward(w.G,{fetchAsset});await state.ready;
 assert.deepEqual(state.errors,[]);const initial=exactFamilyRows(w,state);assert.equal(new Set(initial.values()).size,3);
 const original=sourceDigest(w.cells),geometryRefs=state.basalMeshes.map(m=>m.geometry),meshRefs=state.basalMeshes.slice(),memory=state.stats.geometryBytes;
 for(const x of [12,24,12,0]){w.G.horse.player.pos.x=x;w.tick();const current=exactFamilyRows(w,state);for(const[key,family]of current)if(initial.has(key))assert.equal(family,initial.get(key));actualBudget(w,state);}
 assert.deepEqual(exactFamilyRows(w,state),initial);
 const stable=exactFamilyRows(w,state);w.cells[41].version++;w.version();w.repackOriginal();w.tick();assert.deepEqual(exactFamilyRows(w,state),stable);assert.equal(state.stats.classifiedRoots,w.cells[41].count);
 for(const quality of ['medium','high','medium','high']){w.quality(quality);w.tick();exactFamilyRows(w,state);actualBudget(w,state);}
 assert.deepEqual(state.basalMeshes,meshRefs);assert.deepEqual(state.basalMeshes.map(m=>m.geometry),geometryRefs);assert.equal(state.stats.geometryBytes,memory);assert.equal(sourceDigest(w.cells),original);
 state.dispose();assert.equal(state.basalMeshes.length,0);assert.equal(state.meshes.length,0);assert.equal(state.sources.length,0);assert.equal(state.basal,null);assert.equal(w.sharedDisposed(),0);
});

test('a failed second family allocation releases partial owned geometry/mesh and keeps the original draw',async()=>{
 const w=world();w.unlock();const allocated=[],meshes=[];let instances=0,disposed=0;
 class TrackedGeometry extends THREE.BufferGeometry{
  constructor(){super();allocated.push(this);this.addEventListener('dispose',()=>disposed++);}
 }
 class FailingInstancedMesh extends THREE.InstancedMesh{
  constructor(...args){if(++instances===2)throw Error('Injected second family allocation failure');super(...args);meshes.push(this);this.addEventListener('dispose',()=>disposed++);}
 }
 w.G.THREE={...THREE,BufferGeometry:TrackedGeometry,InstancedMesh:FailingInstancedMesh};
 const beforeMatrix=w.near.instanceMatrix.array.slice(),beforeColor=w.near.instanceColor.array.slice(),warn=console.warn;let state;
 try{console.warn=()=>{};state=installMixedSward(w.G,{fetchAsset});await state.ready;}finally{console.warn=warn;}
 assert(state.disposed);assert.deepEqual(state.errors,['Injected second family allocation failure']);assert.equal(allocated.length,2);assert.equal(meshes.length,1);assert.equal(disposed,3);
 state.dispose();assert.equal(disposed,3);assert.equal(w.G.scene.children.length,2);assert.equal(w.hooks.size,0);assert.equal(w.sharedDisposed(),0);assert.equal(state.basalMeshes.length,0);assert.equal(state.meshes.length,0);assert.equal(state.basal,null);
 assert.deepEqual(w.near.instanceMatrix.array,beforeMatrix);assert.deepEqual(w.near.instanceColor.array,beforeColor);originalRows(w);
});

test('active-prefix updates replace pending ranges, preserve unused capacity and leave source uploads unrestricted',async()=>{
 const w=world();w.unlock();const state=installMixedSward(w.G,{fetchAsset});await state.ready;
 const rangeCheck=()=>{
  assert.deepEqual(w.near.instanceMatrix.updateRanges,[],'Shared original matrix upload cannot inherit a clipped prefix');
  assert.deepEqual(w.near.instanceColor.updateRanges,[],'Shared original color upload cannot inherit a clipped prefix');
  for(const mesh of state.basalMeshes){assert.deepEqual(mesh.instanceMatrix.updateRanges,mesh.count?[{start:0,count:mesh.count*16}]:[]);assert.deepEqual(mesh.instanceColor.updateRanges,mesh.count?[{start:0,count:mesh.count*3}]:[]);}
 };
 rangeCheck();
 const sentinels=state.basalMeshes.map(mesh=>{
  assert(mesh.count<mesh.instanceMatrix.count);mesh.instanceMatrix.array[mesh.instanceMatrix.array.length-1]=123.25;mesh.instanceColor.array[mesh.instanceColor.array.length-1]=.8125;return [123.25,.8125];
 });
 // Several repacks without a renderer upload must replace, not accumulate, pending ranges.
 for(const x of [12,0,18,0]){w.G.horse.player.pos.x=x;w.tick();rangeCheck();exactFamilyRows(w,state);}
 state.basalMeshes.forEach((mesh,i)=>{assert.equal(mesh.instanceMatrix.array.at(-1),sentinels[i][0]);assert.equal(mesh.instanceColor.array.at(-1),sentinels[i][1]);});
 const versions=state.basalMeshes.map(mesh=>[mesh.instanceMatrix.version,mesh.instanceColor.version]);
 const canBasal=w.G.world.nearGroundCover.swardSource.canBasal;w.G.world.nearGroundCover.swardSource.canBasal=()=>false;state.refreshEligibility();state.tick(0,0,0,true);
 rangeCheck();state.basalMeshes.forEach((mesh,i)=>{assert.equal(mesh.count,0);assert.equal(mesh.instanceMatrix.version,versions[i][0]);assert.equal(mesh.instanceColor.version,versions[i][1]);});
 w.G.world.nearGroundCover.swardSource.canBasal=canBasal;state.refreshEligibility();state.tick(0,0,0,true);rangeCheck();exactFamilyRows(w,state);actualBudget(w,state);
 state.dispose();assert.deepEqual(w.near.instanceMatrix.updateRanges,[]);assert.deepEqual(w.near.instanceColor.updateRanges,[]);originalRows(w);
});

test('Low initial draw and source growth cannot retain a smaller pending upload range',async()=>{
 const w=world('low');w.cells[0].count-=7;w.cells[0].version++;w.version();w.repackOriginal();w.unlock();const state=installMixedSward(w.G,{fetchAsset});await state.ready;
 // Vendored Three creates a full buffer without clearing pending updateRanges. The source
 // owner later uses needsUpdate only, so originalNear must have no prefix range to retain.
 assert.deepEqual(w.near.instanceMatrix.updateRanges,[]);assert.deepEqual(w.near.instanceColor.updateRanges,[]);
 w.cells[0].count+=7;w.cells[0].version++;w.version();w.repackOriginal();w.tick();assert.equal(w.near.count,totalRoots(w.cells));originalRows(w);actualBudget(w,state);
 assert.deepEqual(w.near.instanceMatrix.updateRanges,[]);assert.deepEqual(w.near.instanceColor.updateRanges,[]);assert.deepEqual(w.checks,{basal:0,accent:0,query:0});state.dispose();
});
