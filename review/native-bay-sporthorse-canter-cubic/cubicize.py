"""Repack the already solved Sporthorse Canter keys with periodic cubic tangents.

No joint target, keyed rotation, keyed translation, timing, tack or skin changes.
The independently solved (uncopied) loop closure is gated before repacking.
"""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import numpy as np
from scipy.spatial.transform import Rotation as R

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE = ROOT / 'review/native-bay-sporthorse-canter/model.glb'
BASE_SHA = 'dde4b71c76c7dbaf80c8d5ca9b06f7cbffaad85d500672d5ae4e5bbf73949e03'
REST = ROOT / 'review/native-breed-targets/bay-sporthorse/rest.glb'
REST_SHA = '8f7f83e9669dc063dcb38455f8658369774ec0ce9b9eb81c2e7742e7d013d6a8'
assert hashlib.sha256(BASE.read_bytes()).hexdigest() == BASE_SHA
assert hashlib.sha256(REST.read_bytes()).hexdigest() == REST_SHA
spec = importlib.util.spec_from_file_location('g', ROOT / 'tools/asset-gen/rig_hero_horse.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
doc, original_blob = g.read_glb(BASE)
original_doc = copy.deepcopy(doc)
blob = bytearray(original_blob)
authored = json.loads((ROOT / 'output/native-bay-sporthorse-canter/build-report.json').read_text()) if (ROOT / 'output/native-bay-sporthorse-canter/build-report.json').exists() else None
frozen = json.loads((ROOT / 'review/native-bay-sporthorse-canter/build-summary.json').read_text())
assert all(frozen['leads'][lead]['uncopiedClosureMaxDegrees'] < .0001 for lead in ['Left', 'Right'])
assert authored is None or all(authored['leads'][lead]['uncopiedClosureMaxDegrees'] < .0001 for lead in ['Left', 'Right'])

def append(values, kind):
    values = np.asarray(values, dtype='<f4')
    blob.extend(b'\0' * (-len(blob) % 4))
    offset = len(blob)
    blob.extend(values.tobytes())
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': values.nbytes})
    index = len(doc['accessors'])
    doc['accessors'].append({'bufferView': view, 'componentType': 5126,
                             'count': len(values), 'type': kind})
    return index

reports = {}
for clip in doc['animations']:
    assert clip['name'] in ['Target Native Canter Left', 'Target Native Canter Right']
    cname = clip['name']
    channels = {c['sampler']: c for c in clip['channels']}
    assert len(channels) == len(clip['samplers']) == 82
    report = {'tracks': [], 'originalKeyPoseBytesExact': True, 'allSamplerTangentsPeriodic': True,
              'uncopiedClosureMaxDegrees': frozen['leads'][cname.split()[-1]]['uncopiedClosureMaxDegrees']}
    for sampler_index, sampler in enumerate(clip['samplers']):
        assert sampler['interpolation'] == 'LINEAR'
        times = g.accessor(doc, original_blob, sampler['input']).reshape(-1).astype(float)
        keys = g.accessor(doc, original_blob, sampler['output'])
        assert len(times) == len(keys) == 129
        assert abs(times[0]) < 1e-9 and abs(times[-1] - .64) < 1e-7
        assert np.allclose(np.diff(times), .005, atol=1e-7)
        target = channels[sampler_index]['target']
        kind = 'VEC4' if target['path'] == 'rotation' else 'VEC3'
        assert keys.shape[1] == (4 if kind == 'VEC4' else 3)
        if kind == 'VEC4':
            adjacent = np.sum(keys[:-1] * keys[1:], axis=1)
            assert np.all(adjacent > 0), (cname, sampler_index, adjacent.min())
            closure = float(np.rad2deg((R.from_quat(keys[0]).inv() * R.from_quat(keys[-1])).magnitude()))
            assert closure < .0001, (cname, sampler_index, closure)
        else:
            closure = float(np.linalg.norm(keys[-1] - keys[0]))
            assert closure < 1e-5, (cname, sampler_index, closure)
        # Exact source value rows stay between the two tangent rows. For the
        # closed derivative the first/last tangent is one shared float32 row;
        # neither endpoint pose is overwritten with a copied first frame.
        cycle = keys[:-1].astype(float)
        dt = float(times[1] - times[0])
        tangent = (np.roll(cycle, -1, axis=0) - np.roll(cycle, 1, axis=0)) / (2 * dt)
        if kind == 'VEC4':
            tangent -= cycle * np.sum(cycle * tangent, axis=1)[:, None] / np.sum(cycle * cycle, axis=1)[:, None]
        tangent = np.vstack([tangent, tangent[0]]).astype('<f4')
        triplets = np.stack([tangent, keys, tangent], axis=1).reshape(-1, keys.shape[1]).astype('<f4')
        assert np.array_equal(triplets[1::3], keys)
        assert np.array_equal(triplets[0], triplets[-1])
        sampler['output'] = append(triplets, kind)
        sampler['interpolation'] = 'CUBICSPLINE'
        report['tracks'].append({'node': target['node'], 'path': target['path'],
                                 'sourceKeyCount': len(keys), 'keyRowsBitExact': True,
                                 'endpointValueDifference': closure,
                                 'endpointTangentDifference': 0.0,
                                 'maximumTangentNormPerS': float(np.linalg.norm(tangent, axis=1).max())})
    reports[cname] = report

doc['asset'].setdefault('extras', {})['privateSporthorseCanterCubic'] = 'Tangent-only repack of independently recurrent target-native left/right Canter; original key poses and static source preserved.'
out = HERE / 'model.glb'
g.write_glb(out, doc, blob)
check, check_blob = g.read_glb(out)
assert bytes(check_blob[:len(original_blob)]) == bytes(original_blob)
assert all(check.get(k) == original_doc.get(k) for k in ['nodes', 'meshes', 'skins', 'materials', 'images', 'textures', 'scenes'])
assert all(len(a['samplers']) == 82 for a in check['animations'])
for a_old, a_new in zip(original_doc['animations'], check['animations']):
    for s_old, s_new in zip(a_old['samplers'], a_new['samplers']):
        old = g.accessor(original_doc, original_blob, s_old['output'])
        new = g.accessor(check, check_blob, s_new['output'])
        assert np.array_equal(new.reshape(-1, 3, old.shape[1])[:, 1], old)
summary = {'status': 'Tangent-only private candidate; browser contact and rate tests pending',
           'sourceRestSha256': REST_SHA, 'sourceCanterSha256': BASE_SHA,
           'candidateSha256': hashlib.sha256(out.read_bytes()).hexdigest(),
           'originalBinaryPrefixIdentical': True, 'staticSourceArraysIdentical': True,
           'allOriginalKeyedPoseRowsBitExact': True, 'loopRecurrenceWasVerifiedBeforeCubic': True,
           'tangentsUseCenteredPeriodicDifferenceAndQuaternionTangentProjection': True,
           'clips': reports}
(HERE / 'cubic-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({'candidateSha256': summary['candidateSha256'],
                  'clips': {k: {'channels': len(v['tracks']), 'uncopiedClosureMaxDegrees': v['uncopiedClosureMaxDegrees']} for k,v in reports.items()}}, indent=2))
