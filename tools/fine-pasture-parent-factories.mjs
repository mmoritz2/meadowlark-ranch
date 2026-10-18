// Exact cd4 factory view for retained old morphology assertions; never used by new behavior tests.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{normalizeFinePastureSource}from'./fine-pasture-source-guard.cjs';
const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/fine-pasture-cd4b62d/source-contract.json',import.meta.url))),sha=s=>createHash('sha256').update(s).digest('hex');
const parent=f=>{const s=normalizeFinePastureSource(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),f);assert.equal(sha(s),contract.files[f].beforeSHA256,'Exact published cd4 factory '+f);return s;};
export const createLushMeadowGeometry=new Function(parent('assets/lush-meadow-geometry.mjs').replaceAll('export function','function')+';return createLushMeadowGeometry;')();
const family=new Function('createLushMeadowGeometry',parent('assets/grass-families.mjs').replace(/^import[^\n]*\n/gm,'').replaceAll('export ','')+';return {createGrassFamilyGeometry,GRASS_FAMILIES};')(createLushMeadowGeometry);
export const createGrassFamilyGeometry=family.createGrassFamilyGeometry;export const GRASS_FAMILIES=family.GRASS_FAMILIES;
const cover=parent('assets/meadow-cover.js'),a=cover.indexOf('function createMiddleCoverGeometry'),b=cover.indexOf('// Smooth world-space',a);assert(a>=0&&b>a);
export const createGrassTuftGeometry=new Function('createLushMeadowGeometry',cover.slice(a,b).replaceAll('export function','function')+';return createGrassTuftGeometry;')(createLushMeadowGeometry);
const mixed=parent('assets/mixed-sward.mjs').split('\n').find(s=>s.startsWith('export const MIXED_SWARD ='));
export const MIXED_SWARD=new Function(mixed.replace('export ','')+';return MIXED_SWARD;')();
