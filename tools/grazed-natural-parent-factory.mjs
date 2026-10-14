// Explicit historical6e9 14-leaf model only. Current34-leaf geometry tests and
// actual mixed-sward/wind/response tests import the production module directly.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {appendArchedMeadowLeaf} from '../assets/lush-meadow-geometry.mjs?v=grass-ribbon-5';
import {meadowSwardGrazingAt} from '../assets/pastoral-fields.mjs?v=hollowpeak-cascades-1-commons-landscape-1';
import {chalkGrazingAt} from '../assets/chalk-grazing.mjs?v=chalk-grazing-1';
import {pastoralCoverAt} from '../assets/pastoral-cover.mjs?v=pastoral-cover-1-commons-landscape-1-grove-field-1';
const source=fs.readFileSync(new URL('./fixtures/grazed-natural-6e91739/grazed-sward.mjs',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),'2e548d98a4afec8c487e82595764405002b892a4b4c23312f011762990eae0ef','Whole frozen historical6e9 grazed factory');
const parent=new Function('appendArchedMeadowLeaf','meadowSwardGrazingAt','chalkGrazingAt','pastoralCoverAt',source.replace(/^import[^\n]*\n/gm,'').replaceAll('export ','')+';return {GRAZED_SWARD,createGrazedSwardGeometry,grazedSwardWeight,selectsGrazedSward};')(appendArchedMeadowLeaf,meadowSwardGrazingAt,chalkGrazingAt,pastoralCoverAt);
export const {GRAZED_SWARD,createGrazedSwardGeometry,grazedSwardWeight,selectsGrazedSward}=parent;
