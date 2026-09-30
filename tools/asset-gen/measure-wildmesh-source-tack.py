"""Measure original Western contact geometry and fit it through each breed cage.

Run after shape generation/baking. Changes candidate profiles and an evidence
report only; it does not edit source models, animation bytes or the game.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import sys
import numpy as np

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/models/horse-imports/wildmesh-white-western/game'
OUT = BASE / 'breeds'
spec = importlib.util.spec_from_file_location('wildmesh_batch', Path(__file__).with_name('build-wildmesh-breed-batch.py'))
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)
glb = batch.trusted('rig_hero_horse.py', 'wildmesh_tack_glb')
doc, binary = glb.read_glb(BASE / 'white-western.glb')
profile = json.loads((BASE / 'profile.json').read_text())
build = json.loads((BASE / 'build-report.json').read_text())
if hashlib.sha256((BASE / 'white-western.glb').read_bytes()).hexdigest() != build['gameSha256']:
    raise ValueError('Verified canonical source model changed')
primitive = doc['meshes'][3]['primitives'][0]
if doc['meshes'][3]['name'] != 'HorseWesternTack':
    raise ValueError('Unexpected original equipment mesh')
points = glb.accessor(doc, binary, primitive['attributes']['POSITION'])
indices = glb.accessor(doc, binary, primitive['indices']).reshape(-1)
joints = glb.accessor(doc, binary, primitive['attributes']['JOINTS_0'])
weights = glb.accessor(doc, binary, primitive['attributes']['WEIGHTS_0'])
components = batch.components(indices, len(points))
names = [doc['nodes'][index]['name'] for index in doc['skins'][0]['joints']]
evidence = []


def contact(component_id, label, top=False):
    ids = components[component_id]
    low, high = points[ids].min(0), points[ids].max(0)
    center = (low + high) / 2
    if top:
        center[1] = high[1]
    ownership = {}
    for joint in np.unique(joints[ids]):
        amount = float(np.sum(weights[ids] * (joints[ids] == joint)) / len(ids))
        if amount > .001:
            ownership[names[int(joint)]] = amount
    evidence.append({'label': label, 'mesh': 'HorseWesternTack', 'indexedComponent': component_id,
                     'vertexCount': len(ids), 'bounds': [low.tolist(), high.tolist()],
                     'point': center.tolist(), 'meanSkinOwnership': ownership,
                     'method': 'Bounding-box centre at tread top' if top else 'Thin circular ring bounding-box centre'})
    return center.tolist()


anchors = {'saddleSeat': np.asarray(profile['anchors']['saddle']).reshape(3).tolist(),
           'stirrups': [contact(91, 'leftStirrupTread', True), contact(89, 'rightStirrupTread', True)],
           'bit': [contact(209, 'leftBitRing'), contact(205, 'rightBitRing')]}
profile['sourceTackAnchors'] = anchors
(BASE / 'profile.json').write_text(json.dumps(profile, indent=2) + '\n')
body_primitive = doc['meshes'][0]['primitives'][0]
body = glb.accessor(doc, binary, body_primitive['attributes']['POSITION'])
heads = np.asarray([row['position'] for row in build['canonicalJointSource']])
withers = profile['withersM']
withers_mask = (np.abs(body[:, 0]) < .07) & (body[:, 2] > .285) & (body[:, 2] < .426)
manifest = json.loads((OUT / 'manifest.json').read_text())
derived = []
for id in manifest['expectedShapeIds']:
    file = OUT / id / 'profile.json'
    breed = json.loads(file.read_text())
    sculpt = breed['sculptTargets']
    raw = batch.cage(body, sculpt, id, withers, heads)
    ground = float(raw[:, 1].min())
    factor = breed['withersM'] / (float(raw[withers_mask, 1].max()) - ground)
    fitted = {}
    for key, value in anchors.items():
        point = batch.cage(np.asarray(value), sculpt, id, withers, heads)
        point[..., 1] -= ground
        fitted[key] = (point * factor).tolist()
    breed['sourceTackAnchors'] = fitted
    file.write_text(json.dumps(breed, indent=2) + '\n')
    derived.append({'id': id, 'modelSha256': breed['sha256'], 'sourceTackAnchors': fitted})
report = {'method': 'Original indexed source geometry in canonical raw model coordinates; L=negative X, R=positive X. Exact same regional cage/ground calibration/physical metre scaling as body, rig, tack and saddle anchor.',
          'sourceSha256': batch.SOURCE_SHA, 'canonicalBaseSha256': build['gameSha256'],
          'sourceEquipmentClassification': {'HorseWesternTack': 'Mixed bridling, breast collar/girth, stirrup leather and metal hardware; hide whole mesh with source saddle for a replacement English/bareback/wild kit.',
                                            'HorseWesternSaddle': 'Separate Western saddle, seat, skirt and stirrup leather geometry.'},
          'saddleSeatBasis': 'Previously measured centre leather seat point from source saddle; excludes tall horn/pommel.',
          'sourceTackAnchors': anchors, 'components': evidence, 'breeds': derived,
          'limitations': 'Static author pose is asymmetric. Tread contact is an approximate top-surface centre; this is source geometry evidence, not a mounted rider IK certification.'}
(BASE / 'source-tack-anchor-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'sourceTackAnchors': anchors, 'physicalDerivatives': len(derived), 'sourceModelsUnchanged': True}))
