"""Prepare a static 677-joint Bay retarget target from the private cage fit.

Only unreachable animation accessors/views are dropped. Mesh, skin, bind,
material, texture, node, and hierarchy data are retained byte-for-byte or
JSON-identically. The creator Walk is deliberately absent from this target.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'output/native-bay-preparation'
HERE.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools/asset-gen'))
import rig_hero_horse as glb  # noqa: E402

SOURCE = ROOT / 'output/native-bay-proof/native-bay-fulljoint.glb'
ORIGINAL = ROOT / 'assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb'
OUT = HERE / 'native-bay-rest.glb'
PROOF = ROOT / 'output/native-bay-proof/review-fulljoint.html'
LICENSE = ROOT / 'assets/models/horse-imports/wildmesh-white-western/provenance.json'

CHAINS = {
    'frontLeft': ['clavicle_r_0269', 'upperarm_r_0270', 'lowerarm_r_0271', 'hand_r_0272', 'fingers_01_r_0273', 'fingers_02_r_0274'],
    'frontRight': ['clavicle_l_0203', 'upperarm_l_0204', 'lowerarm_l_0205', 'hand_l_0206', 'fingers_01_l_0187', 'fingers_02_l_0208'],
    'hindLeft': ['upperleg_r_0474', 'lowerleg_r_0475', 'foot_r_0476', 'toes_01_r_0477', 'toes_02_r_0478'],
    'hindRight': ['upperleg_l_0405', 'lowerleg_l_0406', 'foot_l_0407', 'toes_01_l_0408', 'toes_02_l_0409'],
}


def sha(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def retained_accessors(doc):
    keep = set()
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            keep.update(primitive['attributes'].values())
            if 'indices' in primitive:
                keep.add(primitive['indices'])
            for target in primitive.get('targets', []):
                keep.update(target.values())
    for skin in doc['skins']:
        if 'inverseBindMatrices' in skin:
            keep.add(skin['inverseBindMatrices'])
    return sorted(keep)


def compact_static(source, binary):
    doc = copy.deepcopy(source)
    removed_clips = [a['name'] for a in doc.pop('animations', [])]
    used_accessors = retained_accessors(doc)
    accessor_map = {old: new for new, old in enumerate(used_accessors)}
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            primitive['attributes'] = {name: accessor_map[a] for name, a in primitive['attributes'].items()}
            if 'indices' in primitive:
                primitive['indices'] = accessor_map[primitive['indices']]
            for target in primitive.get('targets', []):
                for key in target:
                    target[key] = accessor_map[target[key]]
    for skin in doc['skins']:
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = accessor_map[skin['inverseBindMatrices']]
    doc['accessors'] = [copy.deepcopy(source['accessors'][i]) for i in used_accessors]
    keep_views = {a['bufferView'] for a in doc['accessors']}
    for image in doc.get('images', []):
        if 'bufferView' in image:
            keep_views.add(image['bufferView'])
    used_views = sorted(keep_views)
    view_map = {old: new for new, old in enumerate(used_views)}
    out_binary = bytearray()
    views = []
    for old in used_views:
        view = copy.deepcopy(source['bufferViews'][old])
        out_binary.extend(b'\0' * (-len(out_binary) % 4))
        start = view.get('byteOffset', 0)
        length = view['byteLength']
        view['byteOffset'] = len(out_binary)
        out_binary.extend(binary[start:start+length])
        views.append(view)
    doc['bufferViews'] = views
    for accessor in doc['accessors']:
        accessor['bufferView'] = view_map[accessor['bufferView']]
    for image in doc.get('images', []):
        if 'bufferView' in image:
            image['bufferView'] = view_map[image['bufferView']]
    doc.setdefault('extras', {}).update({
        'reviewStatus': 'Private static Bay retarget target; no approved gait; not released',
        'removedCreatorClips': removed_clips,
        'sourceLicense': 'WildMesh 3D CC BY-NC 4.0',
    })
    for old, new in accessor_map.items():
        assert np.array_equal(glb.accessor(source, binary, old), glb.accessor(doc, out_binary, new)), old
    assert doc['nodes'] == source['nodes']
    assert doc['meshes'][0]['name'] == source['meshes'][0]['name']
    assert doc['materials'] == source['materials']
    assert doc['skins'][0]['joints'] == source['skins'][0]['joints']
    assert not doc.get('animations')
    return doc, out_binary, used_accessors, used_views, removed_clips


def masks():
    proof = PROOF.read_text()
    match = re.search(r'const bayHoofVertexIds=(\{.*?\});', proof)
    assert match, 'Hoof masks missing in original private proof'
    return json.loads(match.group(1))


def skinned_body(doc, binary):
    worlds, parents = glb.node_worlds(doc)
    skin = doc['skins'][0]
    joint_ids = skin['joints']
    inverse = glb.accessor(doc, binary, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    operators = np.array([worlds[i] for i in joint_ids]) @ inverse
    attrs = doc['meshes'][0]['primitives'][0]['attributes']
    position = glb.accessor(doc, binary, attrs['POSITION']).astype(float)
    joint_index = glb.accessor(doc, binary, attrs['JOINTS_0']).astype(int)
    weights = glb.accessor(doc, binary, attrs['WEIGHTS_0']).astype(float)
    point = np.einsum('nwij,nj,nw->ni', operators[joint_index], np.c_[position, np.ones(len(position))], weights)[:, :3]
    return point, worlds, parents, joint_ids, joint_index, weights


def names_to_nodes(doc):
    return {n.get('name'): i for i, n in enumerate(doc['nodes'])}


def point_report(doc, point, worlds, joint_ids, joint_index, weights):
    hoof_masks = masks()
    body_min = point.min(axis=0)
    body_max = point.max(axis=0)
    center_xz = (body_min[[0, 2]] + body_max[[0, 2]]) / 2
    offset = np.array([-center_xz[0], -body_min[1], -center_xz[1]])
    names = names_to_nodes(doc)
    hoof = {}
    for label, ids in hoof_masks.items():
        ids = np.asarray(ids, int)
        patch = point[ids]
        low = float(patch[:, 1].min())
        near = patch[patch[:, 1] <= low + .01]
        bottom_id = int(ids[np.argmin(patch[:, 1])])
        chain = CHAINS[label]
        pivots = np.array([worlds[names[name]][:3, 3] for name in chain])
        influences = [(doc['nodes'][joint_ids[int(j)]]['name'], float(w)) for j, w in zip(joint_index[bottom_id], weights[bottom_id]) if w > .001]
        hoof[label] = {
            'vertexCount': int(len(ids)),
            'lowestVertexId': bottom_id,
            'lowestVertexSourceSpaceM': point[bottom_id].tolist(),
            'lowestVertexFloorAlignedM': (point[bottom_id] + offset).tolist(),
            'soleMinYSourceSpaceM': low,
            'soleMinYFloorAlignedM': low + offset[1],
            'solePatchCenterSourceSpaceM': np.median(near, axis=0).tolist(),
            'solePatchCenterFloorAlignedM': (np.median(near, axis=0) + offset).tolist(),
            'solePatchToeSourceSpaceM': near[np.argmax(near[:, 2])].tolist(),
            'solePatchHeelSourceSpaceM': near[np.argmin(near[:, 2])].tolist(),
            'lowestVertexInfluences': influences,
            'jointChain': chain,
            'jointPivotsSourceSpaceM': pivots.tolist(),
            'jointPivotsFloorAlignedM': (pivots + offset).tolist(),
            'segmentLengthsM': np.linalg.norm(np.diff(pivots, axis=0), axis=1).tolist(),
        }
    marker_id = 1998
    influences = [(doc['nodes'][joint_ids[int(j)]]['name'], float(w)) for j, w in zip(joint_index[marker_id], weights[marker_id]) if w > .001]
    return {
        'coordinateSystem': '+Y up, +Z forward, +X anatomical lateral; metres',
        'sourceSpaceBoundsM': {'min': body_min.tolist(), 'max': body_max.tolist()},
        'floorAlignmentOffsetM': offset.tolist(),
        'trunkComparisonMarker': {'vertexId': marker_id, 'sourceSpaceM': point[marker_id].tolist(),
                                  'floorAlignedM': (point[marker_id] + offset).tolist(),
                                  'influences': influences,
                                  'note': 'Spine-weighted trunk comparison point, not verified anatomical withers.'},
        'hooves': hoof,
    }


def main():
    source, binary = glb.read_glb(SOURCE)
    prepared, packed, kept_accessors, kept_views, removed = compact_static(source, binary)
    glb.write_glb(OUT, prepared, packed)
    saved, saved_binary = glb.read_glb(OUT)
    assert saved == prepared
    points, worlds, parents, joint_ids, joint_index, weights = skinned_body(saved, saved_binary)
    assert len(joint_ids) == 677
    geometry = point_report(saved, points, worlds, joint_ids, joint_index, weights)
    name_nodes = names_to_nodes(saved)
    joint_names = [saved['nodes'][i]['name'] for i in joint_ids]
    report = {
        'status': 'PRIVATE STATIC TARGET ONLY; no approved Walk or faster gait',
        'source': {'path': str(SOURCE), 'sha256': sha(SOURCE.read_bytes()), 'bytes': SOURCE.stat().st_size,
                   'originalWhiteCandidate': str(ORIGINAL), 'originalWhiteCandidateSha256': sha(ORIGINAL.read_bytes()),
                   'creator': 'WildMesh 3D', 'license': 'CC BY-NC 4.0',
                   'sourceUrl': json.loads(LICENSE.read_text())['sourceUrl']},
        'prepared': {'path': str(OUT), 'sha256': sha(OUT.read_bytes()), 'bytes': OUT.stat().st_size,
                     'animationCount': len(saved.get('animations', [])), 'removedCreatorClips': removed,
                     'meshCount': len(saved['meshes']), 'materialCount': len(saved['materials']),
                     'imageCount': len(saved['images']), 'jointCount': len(joint_ids),
                     'keptAccessors': len(kept_accessors), 'keptBufferViews': len(kept_views)},
        'preservation': {'allRetainedAccessorArraysEqual': True, 'nodesIdentical': True,
                         'materialsIdentical': True, 'jointIdsIdentical': True,
                         'originalPerVertexWeightsAndInverseBindsPreserved': True},
        'scale': {'previewWrapperScale': float(json.loads((SOURCE.with_suffix('.json')).read_text())['previewScale']),
                  'bayCageScaleFactor': float(json.loads((SOURCE.with_suffix('.json')).read_text())['cageScale'])},
        'geometry': geometry,
        'jointIndexByName': {name: joint_names.index(name) for chain in CHAINS.values() for name in chain},
        'jointNodeByName': {name: name_nodes[name] for chain in CHAINS.values() for name in chain},
    }
    (HERE / 'rest-summary.json').write_text(json.dumps(report, indent=2) + '\n')
    (HERE / 'hoof-masks.json').write_text(json.dumps(masks(), separators=(',', ':')) + '\n')
    print(json.dumps({'preparedBytes': report['prepared']['bytes'], 'sourceBytes': report['source']['bytes'],
                      'joints': len(joint_ids), 'bodyMinY': geometry['sourceSpaceBoundsM']['min'][1],
                      'hoofMinYs': {k: v['soleMinYFloorAlignedM'] for k, v in geometry['hooves'].items()}}, indent=2))


if __name__ == '__main__':
    main()
