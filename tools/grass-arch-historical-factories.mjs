import fs from 'node:fs';
import {normalizeGrassArchSource} from './grass-arch-source-guard.cjs';
// Historical needle-profile assertions retain their exact original thresholds.
// This helper restores only the frozen reviewed changes and pins complete d5
// source bodies before executing those original factories. Current arched-model
// behavior is checked separately against the actual imported production helpers.
export const historicalSource=file=>normalizeGrassArchSource(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),file);
const lush=historicalSource('assets/lush-meadow-geometry.mjs');
export const createLushMeadowGeometry=new Function(lush.replaceAll('export function','function')+'\nreturn createLushMeadowGeometry;')();
const grazed=historicalSource('assets/grazed-sward.mjs').replace(/^import[^\n]*\n/gm,'').replaceAll('export ','');
const turf=new Function(grazed+'\nreturn {GRAZED_SWARD,createGrazedSwardGeometry};')();
export const GRAZED_SWARD=turf.GRAZED_SWARD;
export const createGrazedSwardGeometry=turf.createGrazedSwardGeometry;
const families=historicalSource('assets/grass-families.mjs').replace(/^import[^\n]*\n/gm,'').replaceAll('export ','');
const family=new Function('createLushMeadowGeometry',families+'\nreturn {GRASS_FAMILIES,createGrassFamilyGeometry};')(createLushMeadowGeometry);
export const GRASS_FAMILIES=family.GRASS_FAMILIES;
export const createGrassFamilyGeometry=family.createGrassFamilyGeometry;
const cover=historicalSource('assets/meadow-cover.js'),start=cover.indexOf('function createMiddleCoverGeometry'),end=cover.indexOf('// Smooth world-space');
if(start<0||end<=start)throw Error('Pinned historical near/middle geometry factory absent');
export const createGrassTuftGeometry=new Function('createLushMeadowGeometry',cover.slice(start,end).replaceAll('export function','function')+'\nreturn createGrassTuftGeometry;')(createLushMeadowGeometry);
