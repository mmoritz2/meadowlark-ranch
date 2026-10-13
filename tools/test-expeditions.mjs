import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EXPEDITIONS} from '../assets/expeditions.mjs';
import {POST_DEFINITION,isSoloPostRide} from '../assets/features/cottonwood-post-rules.mjs';

test('extracted catalogue preserves every published expedition field, coordinate and reward',()=>{
 // JSON hash of the six authored records in social-play.js at published df065bd.
 // This guards the extraction without maintaining a second route catalogue.
 assert.equal(createHash('sha256').update(JSON.stringify(EXPEDITIONS)).digest('hex'),'ccc5eb17b241672c61433168193d650198eb8a95087e7ee06395b687ca823453');
 assert.equal(EXPEDITIONS.length,6);assert.equal(new Set(EXPEDITIONS.map(e=>e.id)).size,6);
});
test('the shared Cottonwood definition is exactly the managed mission route and reward',()=>{
 const e=EXPEDITIONS.find(e=>e.id===POST_DEFINITION.id);
 assert.equal(e.name,POST_DEFINITION.name);assert.deepEqual(e.r,POST_DEFINITION.reward);
 assert.deepEqual(e.stops.map(p=>p.slice(1)),POST_DEFINITION.stops);
 const ride={pts:e.stops.map(p=>p.slice()),exped:e.id,soloExpedition:true};
 assert.equal(isSoloPostRide(ride),true);
 assert.equal(isSoloPostRide({...ride,clubRideId:'shared-ride'}),false,'shared rides remain on their existing owner');
 ride.pts[1][1]++;assert.equal(isSoloPostRide(ride),false,'a route with the same label is not an authored expedition');
 assert.equal(e.stops[1][1],POST_DEFINITION.pines.x,'per-ride copies cannot change the definition');
});
