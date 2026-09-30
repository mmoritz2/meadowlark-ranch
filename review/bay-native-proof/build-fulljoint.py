"""Experimental Bay 677-joint cage fit using the creator's source hierarchy/clips."""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/asset-gen'))
import rig_hero_horse as glb  # noqa: E402

GAME = ROOT / 'assets/models/horse-imports/wildmesh-white-western/game'
SOURCE = GAME / 'native-candidate/native-white-western-candidate.glb'
PILOT = ROOT / 'output/native-bay-proof/native-bay-prototype.glb'
OUT = ROOT / 'output/native-bay-proof/native-bay-fulljoint.glb'


def imported_batch():
    spec = importlib.util.spec_from_file_location('wildmesh_bay_cage', ROOT / 'tools/asset-gen/build-wildmesh-breed-batch.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def append_matrices(doc, binary, values):
    values = np.asarray(values, dtype='<f4').transpose(0, 2, 1).reshape(-1, 16)
    binary.extend(b'\0' * (-len(binary) % 4))
    vi = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
    binary.extend(values.tobytes())
    ai = len(doc['accessors'])
    doc['accessors'].append({'bufferView': vi, 'componentType': 5126, 'count': len(values), 'type': 'MAT4'})
    return ai


def patch_vec3_accessor(doc, binary, ai, values):
    a = doc['accessors'][ai]
    assert a['type'] == 'VEC3' and a['componentType'] == 5126 and not a.get('sparse')
    v = doc['bufferViews'][a['bufferView']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    target = np.ndarray((a['count'], 3), dtype='<f4', buffer=binary, offset=off,
                        strides=(v.get('byteStride', 12), 4))
    assert target.shape == values.shape
    target[:] = values
    if 'min' in a: a['min'] = np.min(values, axis=0).tolist()
    if 'max' in a: a['max'] = np.max(values, axis=0).tolist()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    source, original_binary = glb.read_glb(SOURCE)
    doc, binary = glb.read_glb(PILOT)
    assert len(source['skins'][0]['joints']) == len(doc['skins'][0]['joints']) == 677
    original_world, parents = glb.node_worlds(source)
    joint_ids = source['skins'][0]['joints']
    original_bind = glb.accessor(source, original_binary, source['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)

    attr = source['meshes'][0]['primitives'][0]['attributes']
    base = glb.accessor(source, original_binary, attr['POSITION']).astype(float)
    ji = glb.accessor(source, original_binary, attr['JOINTS_0'])
    wt = glb.accessor(source, original_binary, attr['WEIGHTS_0'])
    source_m = np.array([original_world[i] for i in joint_ids]) @ original_bind
    surface = np.einsum('nwij,nj,nw->ni', source_m[ji], np.c_[base, np.ones(len(base))], wt)[:, :3]
    source_ground = float(surface[:, 1].min())
    saddle = next(i for i in joint_ids if source['nodes'][i]['name'].startswith('saddle_'))
    offset = np.array([0., -source_ground, -original_world[saddle][2, 3]])
    original_frame_body = surface + offset

    base_profile = json.loads((GAME / 'profile.json').read_text())
    bay_profile = json.loads((GAME / 'breeds/bay/profile.json').read_text())
    build = json.loads((GAME / 'build-report.json').read_text())
    heads = np.asarray([row['position'] for row in build['canonicalJointSource']], float)
    sculpt = bay_profile['sculptTargets']
    cage = imported_batch().cage
    withers = base_profile['withersM']
    mask = (np.abs(original_frame_body[:, 0]) < .07) & (original_frame_body[:, 2] > .285) & (original_frame_body[:, 2] < .426)
    raw = cage(original_frame_body, sculpt, 'bay', withers, heads)
    ground = float(raw[:, 1].min())
    cage_factor = 1.52 / (float(raw[mask, 1].max()) - ground)
    def warp(points):
        q = cage(points + offset, sculpt, 'bay', withers, heads)
        q[..., 1] -= ground
        return q * cage_factor

    pilot_info = json.loads(PILOT.with_suffix('.json').read_text())
    preview_scale = float(pilot_info['scale'])
    preview_translation = np.asarray(pilot_info['translation'], float)
    original_joint_heads = np.array([original_world[i][:3, 3] for i in joint_ids])
    target_world_game = warp(original_joint_heads)
    target_world_source = (target_world_game - preview_translation) / preview_scale
    target_by_id = {i: p for i, p in zip(joint_ids, target_world_source)}
    new_local_by_id = {}
    for i in joint_ids:
        parent = parents[i]
        parent_head = target_by_id[parent] if parent in target_by_id else original_world[parent][:3, 3]
        local = np.linalg.solve(original_world[parent][:3, :3], target_by_id[i] - parent_head)
        old = np.asarray(source['nodes'][i].get('translation', [0, 0, 0]), float)
        new_local_by_id[i] = local
        doc['nodes'][i]['translation'] = local.tolist()
        assert np.isfinite(local).all()

    # Preserve *each joint's original default-pose skin operator*, including
    # artist-authored per-influence bind offsets, after moving its rest pivot.
    new_world = []
    new_bind = []
    for i, b in zip(joint_ids, original_bind):
        j_old = original_world[i]
        j_new = j_old.copy()
        j_new[:3, 3] = target_by_id[i]
        new_world.append(j_new)
        new_bind.append(np.linalg.inv(j_new) @ j_old @ b)
    new_world, new_bind = np.asarray(new_world), np.asarray(new_bind)
    rest_error = np.abs(new_world @ new_bind - source_m).max()
    assert rest_error < 1e-8, rest_error
    doc['skins'][0]['inverseBindMatrices'] = append_matrices(doc, binary, new_bind)

    changed_channels = 0
    for animation in doc['animations']:
        used_outputs = set()
        for channel in animation['channels']:
            if channel['target']['path'] != 'translation': continue
            node = channel['target']['node']
            assert node in new_local_by_id
            sampler = animation['samplers'][channel['sampler']]
            output = sampler['output']
            assert output not in used_outputs
            used_outputs.add(output)
            original_values = glb.accessor(source, original_binary, output).astype(float)
            delta = new_local_by_id[node] - np.asarray(source['nodes'][node].get('translation', [0, 0, 0]), float)
            patch_vec3_accessor(doc, binary, output, original_values + delta)
            changed_channels += 1
    assert changed_channels == 1092

    # Recompute the unwrapped hierarchy to check all 677 target joint heads.
    check_doc = copy.deepcopy(doc)
    check_doc['nodes'].pop()  # Only the private scale wrapper is appended.
    check_doc['scenes'][check_doc['scene']]['nodes'] = [0]
    checked, _ = glb.node_worlds(check_doc)
    hierarchy_error = max(float(np.linalg.norm(checked[i][:3, 3] - target_by_id[i])) for i in joint_ids)
    assert hierarchy_error < 1e-7, hierarchy_error
    doc.setdefault('extras', {})['reviewStatus'] = 'Private Bay full-joint cage pilot; creator Walk remains too low; not released'
    glb.write_glb(OUT, doc, binary)
    report = {'path': str(OUT), 'restSkinMatrixMaxError': float(rest_error),
              'jointHeadMaxErrorM': hierarchy_error, 'translationChannelsShifted': changed_channels,
              'cageScale': cage_factor, 'previewScale': preview_scale,
              'jointPivotShiftFromUniformCm': {'median': float(np.median(np.linalg.norm(target_world_game - (preview_scale * original_joint_heads + preview_translation), axis=1)) * 100),
                                               'max': float(np.max(np.linalg.norm(target_world_game - (preview_scale * original_joint_heads + preview_translation), axis=1)) * 100)},
              'status': 'Unapproved private experiment; visual QA pending; creator Walk crouch remains a known blocker'}
    OUT.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__': main()
