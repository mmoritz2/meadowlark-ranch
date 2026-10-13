import fs from 'node:fs';
import {normalizeGrassRibbonSource} from './grass-ribbon-source-guard.cjs';
// Explicit historical d9 physical crease factories. Complete d9 source bodies
// are pinned before evaluation; current ribbon tests import production assets.
export const historicalRibbonSource=file=>normalizeGrassRibbonSource(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),file);
const lush=historicalRibbonSource('assets/lush-meadow-geometry.mjs');
const physical=new Function(lush.replaceAll('export function','function')+'\nreturn {createLushMeadowGeometry,appendArchedMeadowLeaf};')();
export const createLushMeadowGeometry=physical.createLushMeadowGeometry;
const strip=source=>source.replace(/^import[^\n]*\n/gm,'').replaceAll('export ','');
const grazed=new Function('appendArchedMeadowLeaf',strip(historicalRibbonSource('assets/grazed-sward.mjs'))+'\nreturn {GRAZED_SWARD,createGrazedSwardGeometry};')(physical.appendArchedMeadowLeaf);
export const GRAZED_SWARD=grazed.GRAZED_SWARD;
export const createGrazedSwardGeometry=grazed.createGrazedSwardGeometry;
const family=new Function('createLushMeadowGeometry',strip(historicalRibbonSource('assets/grass-families.mjs'))+'\nreturn {GRASS_FAMILIES,createGrassFamilyGeometry};')(createLushMeadowGeometry);
export const GRASS_FAMILIES=family.GRASS_FAMILIES;
export const createGrassFamilyGeometry=family.createGrassFamilyGeometry;
const cover=historicalRibbonSource('assets/meadow-cover.js'),start=cover.indexOf('function createMiddleCoverGeometry'),end=cover.indexOf('// Smooth world-space');
if(start<0||end<=start)throw Error('Pinned historical d9 near/middle factory absent');
export const createGrassTuftGeometry=new Function('createLushMeadowGeometry',cover.slice(start,end).replaceAll('export function','function')+'\nreturn createGrassTuftGeometry;')(createLushMeadowGeometry);
const mixed=historicalRibbonSource('assets/mixed-sward.mjs'),metadata=mixed.match(/export const MIXED_SWARD\s*=\s*Object\.freeze\([\s\S]*?\);/);
if(!metadata)throw Error('Pinned historical d9 resource metadata absent');
export const MIXED_SWARD=new Function(metadata[0].replace('export ','')+'\nreturn MIXED_SWARD;')();
