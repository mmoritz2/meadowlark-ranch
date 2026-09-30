// CPU-only motion refinement: fresh Akhal rig, exact same command times, smaller
// timesteps. A large single-frame displacement is a diagnostic, not by itself
// evidence of a discontinuity. Uses the live solver without modifying it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const repo = path.resolve(__dirname, '../..');
const folder = path.join(repo, 'assets/models/horse-imports/wildmesh-white-western/game/breeds');
const output = process.argv[2] || path.join(folder, 'motion-convergence-validation.json');
const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const motionSource = fs.readFileSync(path.join(repo, 'assets/artist-horse-motion.js'), 'utf8');
const rates = [120, 240, 480, 960];

(async () => {
  const threeUrl = pathToFileURL(path.join(repo, 'assets/vendor/three/build/three.module.js')).href;
  const THREE = await import(threeUrl);
  const utilsUrl = moduleUrl(fs.readFileSync(path.join(repo, 'assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js'), 'utf8').replace("from 'three'", `from '${threeUrl}'`));
  const loaderUrl = moduleUrl(fs.readFileSync(path.join(repo, 'assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'), 'utf8').replace("from 'three'", `from '${threeUrl}'`).replace("from '../utils/BufferGeometryUtils.js'", `from '${utilsUrl}'`));
  const {GLTFLoader} = await import(loaderUrl);
  const {createArtistMotion} = await import(moduleUrl(motionSource));
  const profile = JSON.parse(fs.readFileSync(path.join(folder, 'akhal/profile.json')));
  const original = fs.readFileSync(path.join(folder, 'akhal', profile.file));
  const jsonBytes = original.readUInt32LE(12);
  const document = JSON.parse(original.subarray(20, 20 + jsonBytes));
  // Geometry-only local copy avoids browser image APIs. The source file is not
  // changed; all topology, skin matrices, animation and accessor bytes remain.
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const text = Buffer.from(JSON.stringify(document));
  const json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
  text.copy(json);
  const binary = original.subarray(28 + jsonBytes);
  const glb = Buffer.alloc(28 + json.length + binary.length);
  glb.writeUInt32LE(0x46546c67); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  glb.writeUInt32LE(binary.length, 20 + json.length); glb.writeUInt32LE(0x004e4942, 24 + json.length); binary.copy(glb, 28 + json.length);
  const scenarios = [
    {id: 'steady-gallop-left', commands: [['gallop', 'left', 5]], measureAfter: 1},
    {id: 'rapid-commands', commands: [['walk', 'left', .5], ['trot', 'left', .5], ['canter', 'left', .5], ['canter', 'right', .5], ['gallop', 'left', .5], ['gallop', 'right', .5]], measureAfter: 0},
    {id: 'gallop-left-to-right-transition', commands: [['walk', 'left', .5], ['trot', 'left', .5], ['canter', 'left', .5], ['canter', 'right', .5], ['gallop', 'left', .5], ['gallop', 'right', .5]], measureAfter: 2.5},
    {id: 'interrupted-crossfade', commands: [['gallop', 'left', .05], ['trot', 'left', .05], ['canter', 'right', .05], ['walk', 'left', .05], ['gallop', 'right', .5]], measureAfter: 0}
  ];
  const results = [];
  for (const scenario of scenarios) {
    const row = {id: scenario.id, rates: [], matching120HzSamples: []};
    let previousSamples;
    for (const rate of rates) {
      const imported = await new Promise((resolve, reject) => new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '', resolve, reject));
      const skin = imported.scene.getObjectByName('HorseBody');
      imported.scene.updateMatrixWorld(true);
      const names = skin.skeleton.bones.map(bone => bone.name);
      const rootIndex = names.indexOf('ROOT');
      const motion = createArtistMotion({THREE, root: imported.scene, skin, heightM: profile.heightM});
      const summary = {rateHz: rate, timestepS: 1 / rate, maxJointStepM: 0, peakJointSpeedMps: 0, maxRootStepM: 0, peakRootSpeedMps: 0, maxLocalRotationStepRad: 0, peakLocalAngularSpeedRadps: 0, minSoleY: Infinity, maxReachErrorM: 0, allFinite: true, commandBoundaries: []};
      const samples = [];
      let last, frame = 0;
      for (const [gait, lead, seconds] of scenario.commands) {
        const beforeCommand = motion.snapshot(), commandFrom = beforeCommand.gait;
        motion.set(gait, {lead});
        for (let i = 0; i < Math.round(seconds * rate); i++) {
          motion.update(1 / rate); frame++;
          const snapshot = motion.snapshot();
          if (i === 0) {
            let maxSecondaryStepM = 0, joint;
            for (let j = 0; j < names.length; j++) if (/^(tail|neck|head|ear)/i.test(names[j])) {
              const distance = Math.hypot(...snapshot.bonePositions[j].map((value, k) => value - beforeCommand.bonePositions[j][k]));
              if (distance > maxSecondaryStepM) {maxSecondaryStepM = distance; joint = names[j];}
            }
            summary.commandBoundaries.push({commandFrom, commandTo: gait, lead, sceneTimeS: frame / rate, maxSecondaryStepM, joint});
          }
          summary.allFinite &&= snapshot.localPositions.flat().concat(snapshot.localQuaternions.flat()).every(Number.isFinite);
          for (const foot of snapshot.feet) {
            summary.minSoleY = Math.min(summary.minSoleY, foot.soleMinY);
            summary.maxReachErrorM = Math.max(summary.maxReachErrorM, foot.reachError);
          }
          if (last && frame / rate > scenario.measureAfter) {
            for (let j = 0; j < names.length; j++) {
              const distance = Math.hypot(...snapshot.bonePositions[j].map((value, k) => value - last.bonePositions[j][k]));
              if (distance > summary.maxJointStepM) {
                summary.maxJointStepM = distance;
                summary.peakJointSpeedMps = distance * rate;
                summary.worstJointStep = {joint: names[j], sceneTimeS: frame / rate, commandFrom, commandTo: gait, lead, phase: snapshot.phase01, age: snapshot.age, transitioning: snapshot.transitioning, boneNames: names, beforeSnapshot: last, afterSnapshot: snapshot};
              }
              const a = last.localQuaternions[j], b = snapshot.localQuaternions[j];
              const angle = 2 * Math.acos(Math.min(1, Math.abs(a.reduce((sum, value, k) => sum + value * b[k], 0))));
              if (angle > summary.maxLocalRotationStepRad) {
                summary.maxLocalRotationStepRad = angle;
                summary.peakLocalAngularSpeedRadps = angle * rate;
                summary.worstLocalRotation = {joint: names[j], sceneTimeS: frame / rate, phase: snapshot.phase01, age: snapshot.age};
              }
            }
            const rootDistance = Math.hypot(...snapshot.bonePositions[rootIndex].map((value, k) => value - last.bonePositions[rootIndex][k]));
            summary.maxRootStepM = Math.max(summary.maxRootStepM, rootDistance);
            summary.peakRootSpeedMps = summary.maxRootStepM * rate;
          }
          if (frame % (rate / 120) === 0) samples.push(snapshot.bonePositions);
          last = snapshot;
        }
      }
      if (previousSamples) {
        let error = 0;
        for (let i = 0; i < samples.length; i++) for (let j = 0; j < names.length; j++) error = Math.max(error, Math.hypot(...samples[i][j].map((value, k) => value - previousSamples[i][j][k])));
        row.matching120HzSamples.push({coarserRateHz: rate / 2, finerRateHz: rate, maxJointPositionDifferenceM: error});
      }
      previousSamples = samples;
      row.rates.push(summary);
    }
    results.push(row);
  }
  const report = {method: 'Fresh imported Akhal at 120/240/480/960Hz, identical steady 1–5s gallop and exact rapid command times; distances are scene-space metres and quaternion angles are bone-local. No clips played. Peak frame velocity is a finite-difference diagnostic.', motionModuleSha256: crypto.createHash('sha256').update(motionSource).digest('hex'), modelSha256: crypto.createHash('sha256').update(original).digest('hex'), scenarios: results, checks: {allFinite: results.every(row => row.rates.every(rate => rate.allFinite)), soleGroundTolerance4mm: results.every(row => row.rates.every(rate => rate.minSoleY > -.004)), reachTolerance6mm: results.every(row => row.rates.every(rate => rate.maxReachErrorM < .006))}};
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({output, motionModuleSha256: report.motionModuleSha256, checks: report.checks, scenarios: results.map(row => ({id: row.id, rates: row.rates.map(({rateHz, maxJointStepM, peakJointSpeedMps, maxRootStepM, peakRootSpeedMps, maxLocalRotationStepRad, peakLocalAngularSpeedRadps, worstJointStep}) => ({rateHz, maxJointStepM, peakJointSpeedMps, maxRootStepM, peakRootSpeedMps, maxLocalRotationStepRad, peakLocalAngularSpeedRadps, worstJoint: worstJointStep.joint, worstTimeS: worstJointStep.sceneTimeS})), matching120HzSamples: row.matching120HzSamples}))}));
  if (!Object.values(report.checks).every(Boolean)) throw Error('Motion validity checks failed');
})().catch(error => {console.error(error); process.exitCode = 1;});
