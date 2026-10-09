import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildWoodlandWoodProxies, SOURCE_SHA} from './build-woodland-wood-proxies.mjs';
import {WOODLAND_WOOD_BOXES, WOODLAND_WOOD_SOURCE_HEIGHT, WOODLAND_WOOD_SOURCE_SHA,
  WOODLAND_WOOD_CELL_SIDE, WOODLAND_WOOD_PADDING} from '../assets/woodland-edge-wood-proxies.mjs';
import {buildUprightBroadleafWoodProxies} from './build-upright-broadleaf-proxies.mjs';
import {UPRIGHT_HYBRID_WOOD_BOXES, UPRIGHT_HYBRID_WOOD_SOURCE_HEIGHT,
  UPRIGHT_HYBRID_WOOD_SOURCE_FOOT, UPRIGHT_HYBRID_WOOD_SOURCE_SHA,
  UPRIGHT_HYBRID_WOOD_CELL_SIDE, UPRIGHT_HYBRID_WOOD_PADDING} from '../assets/upright-broadleaf-wood-proxies.mjs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createSolidWorld} from '../assets/solid-collisions.js';

const source = fs.readFileSync(new URL('../assets/models/world/realism/tree_small_02.glb', import.meta.url));
const sites = [
  {x:16,z:-98,height:8,yaw:.42}, {x:23,z:-104,height:10.2,yaw:1.18},
  {x:29,z:-111,height:11.2,yaw:2.1}, {x:36,z:-111,height:8.2,yaw:-1.95},
  {x:36,z:-102,height:10.4,yaw:-.24}, {x:20,z:-89,height:8.1,yaw:-.71},
  {x:29,z:-91,height:9.7,yaw:2.82}, {x:38,z:-88,height:8.3,yaw:1.61},
];
const slab = {bottom:.38, top:2.65, radius:.55};

test('resident source regenerates all 929 outward-rounded finite wood boxes', () => {
  const generated = buildWoodlandWoodProxies(source);
  assert.equal(WOODLAND_WOOD_SOURCE_SHA, SOURCE_SHA);
  assert.equal(generated.sourceSha256, WOODLAND_WOOD_SOURCE_SHA);
  assert.equal(generated.sourceHeight, WOODLAND_WOOD_SOURCE_HEIGHT);
  assert.equal(generated.triangles, 13891);
  assert.deepEqual(generated.parts.map(p => p.triangles), [6893, 6998]);
  assert.equal(WOODLAND_WOOD_BOXES.length, 929);
  assert.deepEqual(generated.boxes, WOODLAND_WOOD_BOXES);
  for (let i = 0; i < generated.boxes.length; i++) for (let a = 0; a < 3; a++) {
    const box = generated.boxes[i], exact = generated.exactBoxes[i];
    assert(Number.isFinite(box.min[a]) && Number.isFinite(box.max[a]));
    assert(box.min[a] <= exact.min[a] && box.max[a] >= exact.max[a], 'formatting cannot shrink coverage');
    assert(box.max[a] > box.min[a]);
    assert(box.max[a] - box.min[a] <= WOODLAND_WOOD_CELL_SIDE + 2 * WOODLAND_WOOD_PADDING + .0000020001);
  }
});

test('a changed source asset is rejected instead of silently producing an incompatible table', () => {
  const changed = Buffer.from(source);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => buildWoodlandWoodProxies(changed), /source SHA/);
});

function treeMatrix(t) {
  const scale = t.height / WOODLAND_WOOD_SOURCE_HEIGHT;
  // Same source minY normalization and .07 m burial as the runtime tree factory.
  return new T.Matrix4().compose(new T.Vector3(t.x, .024031998589634895 * scale - .07, t.z),
    new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0), t.yaw), new T.Vector3(scale,scale,scale));
}

test('all eight tree tables register without render resources and stay active when Low hides details', () => {
  const scene = new T.Scene(), owner = new T.Group(), detail = new T.Group();
  scene.add(owner, detail);
  owner.userData.solidParts = sites.flatMap(t => {
    const matrix = treeMatrix(t).toArray();
    return WOODLAND_WOOD_BOXES.map(b => ({min:b.min, max:b.max, matrix}));
  });
  const world = createSolidWorld({THREE:T}), original = JSON.stringify(WOODLAND_WOOD_BOXES);
  // Allocations above are explicit setup; registration and queries must not draw RNG.
  const random = Math.random;
  Math.random = () => { throw Error('Collision table registration/query drew RNG'); };
  try {
    assert.equal(world.register(owner), 7432);
    assert.equal(world.stats().parts, 7432);
    assert.equal(owner.children.length, 0, 'the contact owner needs no render children');
    const hit = visible => {
      detail.visible = visible;
      const p = new T.Vector3(sites[0].x,0,sites[0].z);
      return {contacts:world.resolve(p, slab), position:p.toArray()};
    };
    const high = hit(true), low = hit(false);
    assert(high.contacts > 0);
    assert.deepEqual(low, high, 'render LOD visibility cannot disable the persistent physical owner');
    assert.equal(JSON.stringify(WOODLAND_WOOD_BOXES), original, 'registration cannot mutate source bounds');
    world.unregister(owner);
    assert.equal(world.stats().parts, 0);
    assert.equal(world.resolve(new T.Vector3(sites[0].x,0,sites[0].z), slab), 0);
  } finally { Math.random = random; }
});

test('eight grounded approaches contact the real box solver, remain finite and clear after each small step', () => {
  // Level-ground CPU fixture; native checks cover the controller and sloped ground, not jumping.
  // Each tree is isolated so a neighbouring authored tree cannot invalidate a clear-start assertion.
  let totalContacts = 0;
  for (const t of sites) {
    const world = createSolidWorld({THREE:T}), owner = new T.Group();
    const matrix = treeMatrix(t).toArray();
    owner.userData.solidParts = WOODLAND_WOOD_BOXES.map(b => ({min:b.min, max:b.max, matrix}));
    assert.equal(world.register(owner), 929);
    const p = new T.Vector3(t.x + 2,0,t.z), check = p.clone();
    assert.equal(world.resolve(check, slab), 0, 'approach starts outside the wood');
    let contacts = 0;
    for (let tick = 0; tick < 80; tick++) {
      const previous = {x:p.x,z:p.z,bottom:slab.bottom,top:slab.top};
      const distance = Math.hypot(t.x-p.x,t.z-p.z);
      assert(distance > 0, 'a contact approach cannot pass through the trunk center');
      const step = Math.min(.071, distance);
      p.x += (t.x-p.x) / distance * step;
      p.z += (t.z-p.z) / distance * step;
      contacts += world.resolve(p, {...slab,previous});
      assert(p.toArray().every(Number.isFinite));
      assert(Math.hypot(p.x-previous.x,p.z-previous.z) <= .073001, 'small substep cannot cause a large push');
      check.copy(p);
      assert.equal(world.resolve(check, slab), 0, 'every resolved pose is clear');
      assert.deepEqual(check.toArray(), p.toArray());
    }
    assert(contacts > 0, `height ${t.height} approach must actually exercise contact`);
    totalContacts += contacts;
    world.unregister(owner);
  }
  assert(totalContacts > 8);
  // Curved wood may slide under continued steering; no stationary-tail assertion is appropriate here.
});


test('upright wood regenerates complete conservative boxes above the registry thickness cutoff', () => {
  const raw = fs.readFileSync(new URL('../assets/models/world/realism/upright_broadleaf_01.glb', import.meta.url));
  const generated = buildUprightBroadleafWoodProxies(raw);
  assert.equal(generated.sourceSha256, UPRIGHT_HYBRID_WOOD_SOURCE_SHA);
  assert.equal(generated.sourceHeight, UPRIGHT_HYBRID_WOOD_SOURCE_HEIGHT);
  assert.equal(generated.triangles, 1705);
  assert.equal(generated.parts.length, 1);
  assert.equal(UPRIGHT_HYBRID_WOOD_BOXES.length, 1060);
  assert.deepEqual(generated.boxes, UPRIGHT_HYBRID_WOOD_BOXES);
  const smallestAuthoredScale = 9.7 / UPRIGHT_HYBRID_WOOD_SOURCE_HEIGHT;
  for (let i = 0; i < generated.boxes.length; i++) {
    const box = generated.boxes[i], exact = generated.exactBoxes[i];
    for (let a = 0; a < 3; a++) {
      assert(Number.isFinite(box.min[a]) && Number.isFinite(box.max[a]));
      assert(box.min[a] <= exact.min[a] && box.max[a] >= exact.max[a], 'rounding must not shrink wood coverage');
      assert(box.max[a] > box.min[a]);
      assert(box.max[a] - box.min[a] <= UPRIGHT_HYBRID_WOOD_CELL_SIDE + 2 * UPRIGHT_HYBRID_WOOD_PADDING + .0000020001);
    }
    assert((box.max[1] - box.min[1]) * smallestAuthoredScale >= .02,
      'even the lowest authored upright scale must survive the real registry height cutoff');
  }
});

test('all 7,825 mixed-source authored wood parts register and survive High/Medium/Low detail visibility', () => {
  // Same eight authored x/z, height and yaw values as WOODLAND_EDGE_TREES.
  // Ground translation is zero in this CPU fixture; it does not affect part thickness.
  const uprightSites = new Set(['23,-104', '36,-102', '29,-91']);
  const records = sites.map(t => {
    const upright = uprightSites.has(`${t.x},${t.z}`);
    const scale = t.height / (upright ? UPRIGHT_HYBRID_WOOD_SOURCE_HEIGHT : WOODLAND_WOOD_SOURCE_HEIGHT);
    const foot = upright ? UPRIGHT_HYBRID_WOOD_SOURCE_FOOT : -.024031998589634895;
    const matrix = new T.Matrix4().compose(new T.Vector3(t.x, -foot * scale - .07, t.z),
      new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0), t.yaw), new T.Vector3(scale,scale,scale));
    return {site:t, matrix:matrix.toArray(), boxes:upright ? UPRIGHT_HYBRID_WOOD_BOXES : WOODLAND_WOOD_BOXES};
  });
  const scene = new T.Scene(), owner = new T.Group(), detailed = new T.Group(), cards = new T.Group();
  scene.add(owner, detailed, cards);
  owner.userData.solidParts = records.flatMap(({matrix, boxes}) => boxes.map(b => ({min:b.min,max:b.max,matrix})));
  const original = JSON.stringify([WOODLAND_WOOD_BOXES, UPRIGHT_HYBRID_WOOD_BOXES]);
  const world = createSolidWorld({THREE:T}), random = Math.random;
  Math.random = () => { throw Error('Mixed wood registration/query drew RNG'); };
  try {
    assert.equal(owner.userData.solidParts.length, 5 * 929 + 3 * 1060);
    assert.equal(world.register(owner), 7825, 'no near-flat upright fragment may be dropped');
    assert.equal(world.stats().parts, 7825);
    assert.equal(owner.children.length, 0, 'collision owner remains separate from render LOD');
    const query = () => records.map(({site}) => {
      const p = new T.Vector3(site.x,0,site.z), contacts = world.resolve(p, slab);
      assert(contacts > 0, `authored tree ${site.x},${site.z} must retain trunk contact`);
      assert(p.toArray().every(Number.isFinite));
      return {contacts, position:p.toArray()};
    });
    detailed.visible = true; cards.visible = false;
    const high = query();
    for (const tier of ['medium', 'low']) {
      detailed.visible = false; cards.visible = true;
      assert.deepEqual(query(), high, `${tier} render LOD cannot remove physical contacts`);
      assert.equal(world.stats().parts, 7825);
    }
    assert.equal(JSON.stringify([WOODLAND_WOOD_BOXES, UPRIGHT_HYBRID_WOOD_BOXES]), original);
    world.unregister(owner);
    assert.equal(world.stats().parts, 0);
    assert(records.every(({site}) => world.resolve(new T.Vector3(site.x,0,site.z), slab) === 0));
  } finally { Math.random = random; }
});
