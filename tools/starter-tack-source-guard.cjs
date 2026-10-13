const {normalizeRibbonAwardSource}=require('./ribbon-award-source-guard.cjs');
const {normalizeRidingDistanceSource}=require('./riding-distance-source-guard.cjs');
const {normalizeCoyoteCragCompositionSource}=require('./coyote-crag-composition-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=path.join(__dirname,'fixtures/starter-tack-2986289');
const changes=JSON.parse(fs.readFileSync(path.join(fixture,'source-changes.json'))),preimage=JSON.parse(fs.readFileSync(path.join(fixture,'preimage-SHA.json')));
// Cache-only edges published after the pinned crag/starter fixtures. These are
// exact literals, never a version-stripping regexp; all runtime body bytes still
// pass the original whole-source preimages. Keep the crag normalizer itself
// unchanged because its independent contract pins that file's SHA.
const publishedCaches=[
 // Final grade/confirmed award release.
 {"file":"ranch3d.html","before":"import {FEATURES} from './assets/features/index.js?v=physical-ride-1-starter-tack-2';","after":"import {FEATURES} from './assets/features/index.js?v=physical-ride-2-starter-tack-2';"},
 {"file":"assets/features/index.js","before":"import * as course from './course-engine.js?v=jump-crossing-1';","after":"import * as course from './course-engine.js?v=final-ribbon-1';"},
 {"file":"assets/features/index.js","before":"import * as breeding from './breeding.js?v=wild-bond-1';","after":"import * as breeding from './breeding.js?v=final-ribbon-1';"},
 {"file":"assets/features/index.js","before":"import * as ev2disc from './events2-disciplines.js?v=rush-recovery-1';","after":"import * as ev2disc from './events2-disciplines.js?v=final-ribbon-1';"},
 {"file":"assets/features/index.js","before":"import * as ev2ladder from './events2-ladder.js?v=event-recovery-1';","after":"import * as ev2ladder from './events2-ladder.js?v=final-ribbon-1';"},
 {"file":"assets/features/index.js","before":"import * as seEvents from './se-events.js?v=horse-choice-1';","after":"import * as seEvents from './se-events.js?v=final-ribbon-1';"},
 // Physical riding and scenery-safe race release; reverse newest cache edges first.
 {file:'ranch3d.html',before:"import {FEATURES} from './assets/features/index.js?v=story-events-1-starter-tack-2';",after:"import {FEATURES} from './assets/features/index.js?v=physical-ride-1-starter-tack-2';"},
 {file:'assets/features/index.js',before:"import * as courseGuide from './course-guide.js?v=rush-recovery-1';",after:"import * as courseGuide from './course-guide.js?v=flat-race-guide-1';"},
 {file:'assets/features/index.js',before:"import * as bond from './bond-personality-emotes.js?v=horse-life-20261009';",after:"import * as bond from './bond-personality-emotes.js?v=physical-ride-1';"},
 // 074a42157c5ca21b2d951392efd0e1ada870cd23, published on main 885e882.
 // Newest edge first so the known cache chain reverses to the pinned fixture.
 {file:'ranch3d.html',before:"'./assets/game-hero-horse.js?v=feather-sway-20261013a'",after:"'./assets/game-hero-horse.js?v=full-groom-20261013c'"},
 // 80dfb836171e9becc206cd4e9fb2c99a8d32fe9a, also on origin/main a59b76e.
 {file:'ranch3d.html',before:"'./assets/game-hero-horse.js?v=draft-feathers-20261013d'",after:"'./assets/game-hero-horse.js?v=feather-sway-20261013a'"},
 // Approved story/events release 1780193, merged by e138d34.
 {file:'ranch3d.html',before:"import {FEATURES} from './assets/features/index.js?v=starter-tack-2';",after:"import {FEATURES} from './assets/features/index.js?v=story-events-1-starter-tack-2';"},
 {file:'assets/features/index.js',before:"import * as storyGuidance from './story-guidance.js?v=ranch-rush-1';",after:"import * as storyGuidance from './story-guidance.js?v=story-witness-1';"},
 {file:'assets/features/index.js',before:"import * as seFrame from './se-frame.js?v=horse-actions-20261009';",after:"import * as seFrame from './se-frame.js?v=story-events-20261013';"},
 {file:'assets/features/index.js',before:"import * as seEvents from './se-events.js?v=event-training-1';",after:"import * as seEvents from './se-events.js?v=horse-choice-1';"},
 {file:'assets/features/index.js',before:"import * as riderJourneyUI from './rider-journey-ui.js?v=rider-journey-1';",after:"import * as riderJourneyUI from './rider-journey-ui.js?v=journey-story-1';"}
];
function normalizePublishedCacheSource(source,file){
 for(const c of publishedCaches.filter(c=>c.file===file)){
  if(!source.includes(c.after))continue; // Historical fixtures already have the before literal.
  assert.equal(source.split(c.after).length-1,1,'Exactly one declared published cache '+file+': '+c.after);
  assert.equal(source.split(c.before).length-1,0,'No mixed published cache versions '+file+': '+c.before);
  source=source.replace(c.after,c.before);
 }
 return source;
}
const markers={'ranch3d.html':'basic-riding-tack.mjs?v=starter-tack-2','assets/tack-collection-models.js':'basic-riding-tack.mjs?v=starter-tack-2','assets/features/on-foot.js':'basicLocalRiding:true','assets/features/index.js':'on-foot.js?v=starter-tack-2'};
function normalizeStarterTackSource(source,file){
 source=normalizeCoyoteCragCompositionSource(normalizePublishedCacheSource(normalizeRidingDistanceSource(normalizeRibbonAwardSource(source,file),file),file),file);
 if(!markers[file]||!source.includes(markers[file]))return source;
 for(const c of changes.toReversed().filter(c=>c.file===file)){assert.equal(source.split(c.after).length-1,c.occurrences,'Exactly declared starter visual hook '+file+': '+c.after.slice(0,80));source=source.replace(c.after,c.before);}
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),preimage[file],'Entire original298 body restored '+file);
 return source;
}
module.exports={normalizeStarterTackSource,normalizePublishedCacheSource};
