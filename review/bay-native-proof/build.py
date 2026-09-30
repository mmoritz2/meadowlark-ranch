"""Private full-native-rig Bay deformation experiment; no roster integration."""
from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/asset-gen'))
import rig_hero_horse as glb  # noqa: E402

GAME = ROOT / 'assets/models/horse-imports/wildmesh-white-western/game'
SOURCE = GAME / 'native-candidate/native-white-western-candidate.glb'
BAY = GAME / 'breeds/bay/rig.glb'
OUT = ROOT / 'output/native-bay-proof/native-bay-prototype.glb'


def add_accessor(doc, binary, values, kind):
    values = np.asarray(values, dtype='<f4')
    binary.extend(b'\0' * (-len(binary) % 4))
    view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes, 'target': 34962}
    vi = len(doc['bufferViews'])
    doc['bufferViews'].append(view)
    binary.extend(values.tobytes())
    acc = {'bufferView': vi, 'componentType': 5126, 'count': len(values), 'type': kind,
           'min': values.min(0).tolist(), 'max': values.max(0).tolist()}
    ai = len(doc['accessors'])
    doc['accessors'].append(acc)
    return ai


def append_image(doc, binary, png):
    binary.extend(b'\0' * (-len(binary) % 4))
    vi = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(png)})
    binary.extend(png)
    doc['images'][0]['bufferView'] = vi
    doc['images'][0]['mimeType'] = 'image/png'
    doc['images'][0].pop('uri', None)


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == 'fd18d9b9b22e00dc30a6fa1cfe2e135bb20f7c871df0a976706aaea2f4dff655'
    doc, binary = glb.read_glb(SOURCE)
    bay, baybin = glb.read_glb(BAY)
    assert len(doc['skins'][0]['joints']) == 677 and len(doc['animations']) == 2
    assert len(doc['meshes']) == len(bay['meshes']) == 5
    worlds, _ = glb.node_worlds(doc)
    skin = doc['skins'][0]
    inverse = glb.accessor(doc, binary, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    joint_skin = np.array([worlds[i] for i in skin['joints']]) @ inverse
    # Bay is 1.52 m at the withers. Scaling the entire authored animation
    # uniformly preserves its native joint curves and per-influence bind offsets.
    factor = 1.52 / 1.7869539753502213
    source_attr = doc['meshes'][0]['primitives'][0]['attributes']
    body_source = glb.accessor(doc, binary, source_attr['POSITION']).astype(float)
    body_joints = glb.accessor(doc, binary, source_attr['JOINTS_0'])
    body_weights = glb.accessor(doc, binary, source_attr['WEIGHTS_0']).astype(float)
    body_point = np.einsum('nwij,nj,nw->ni', joint_skin[body_joints],
                           np.c_[body_source, np.ones(len(body_source))], body_weights)[:, :3]
    ground = float(body_point[:, 1].min())
    saddle = next(i for i in skin['joints'] if doc['nodes'][i]['name'].startswith('saddle_'))
    center_z = float(worlds[saddle][2, 3])
    translate = np.array([0., -factor * ground, -factor * center_z])
    reports = []
    for mi in range(5):
        native = doc['meshes'][mi]['primitives'][0]
        target = bay['meshes'][mi]['primitives'][0]
        attrs = native['attributes']
        base = glb.accessor(doc, binary, attrs['POSITION']).astype(float)
        joints = glb.accessor(doc, binary, attrs['JOINTS_0'])
        weights = glb.accessor(doc, binary, attrs['WEIGHTS_0']).astype(float)
        target_position = glb.accessor(bay, baybin, target['attributes']['POSITION']).astype(float)
        target_normal = glb.accessor(bay, baybin, target['attributes']['NORMAL']).astype(float)
        assert len(base) == len(target_position)
        assert np.array_equal(glb.accessor(doc, binary, native['indices']), glb.accessor(bay, baybin, target['indices']))
        weighted = np.einsum('nw,nwij->nij', weights, joint_skin[joints])
        linear = weighted[:, :3, :3]
        rhs = (target_position - translate) / factor - weighted[:, :3, 3]
        raw = np.linalg.solve(linear, rhs[..., None])[..., 0]
        raw_normal = np.linalg.solve(linear, target_normal[..., None])[..., 0]
        raw_normal /= np.maximum(np.linalg.norm(raw_normal, axis=1)[:, None], 1e-12)
        position = factor * np.einsum('nij,nj->ni', linear, raw) + factor * weighted[:, :3, 3] + translate
        error = np.linalg.norm(position - target_position, axis=1)
        assert float(error.max()) < 1e-8
        attrs['POSITION'] = add_accessor(doc, binary, raw, 'VEC3')
        attrs['NORMAL'] = add_accessor(doc, binary, raw_normal, 'VEC3')
        reports.append({'mesh': doc['meshes'][mi]['name'], 'vertices': len(raw),
                        'restRmsErrorM': float(np.sqrt(np.mean(error**2))),
                        'restMaxErrorM': float(error.max()),
                        'rawDisplacementP95Units': float(np.quantile(np.linalg.norm(raw-base, axis=1), .95)),
                        'weightedSkinConditionMax': float(np.linalg.cond(linear).max())})
    # An extra scene parent scales and grounds the complete native hierarchy.
    original_scene = doc['scenes'][doc['scene']]['nodes']
    doc['nodes'].append({'name': 'BayReviewNativeScale', 'children': original_scene,
                         'translation': translate.tolist(), 'scale': [factor] * 3})
    doc['scenes'][doc['scene']]['nodes'] = [len(doc['nodes']) - 1]
    image_uri = bay['images'][0]['uri']
    coat = (BAY.parent / image_uri).resolve().read_bytes()
    append_image(doc, binary, coat)
    doc['materials'][2]['pbrMetallicRoughness']['baseColorFactor'] = copy.deepcopy(
        bay['materials'][2]['pbrMetallicRoughness']['baseColorFactor'])
    doc.setdefault('extras', {})['reviewStatus'] = 'Private Bay full-rig prototype; creator Idle/Walk only; not released'
    glb.write_glb(OUT, doc, binary)
    report = {'sourceCandidate': str(SOURCE), 'bay40Reference': str(BAY), 'output': str(OUT),
              'outputSha256': hashlib.sha256(OUT.read_bytes()).hexdigest(), 'scale': factor,
              'translation': translate.tolist(), '677JointNativeRigPreserved': True,
              'nativeClips': [a['name'] for a in doc['animations']],
              'meshReports': reports, 'reviewStatus': 'Unverified browser visual prototype'}
    OUT.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__': main()
