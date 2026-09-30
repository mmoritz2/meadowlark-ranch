"""Build the approved WildMesh western horse's anatomical game foundation.

Usage: python3 tools/asset-gen/build-wildmesh-western-game.py

The registered source/receipt stay unchanged. Source geometry is baked from its
actual glTF joint pose, then original weight ownership is merged by source joint
semantics into the game's 40-joint anatomy contract. Body, eyes, alpha groom,
western saddle, bridle and reins retain original topology, UVs and embedded PNGs.
The supported zero-specular legacy materials receive equivalent modern PBR.
Motion clips are appended separately by bake-wildmesh-western-motion.cjs using
the unchanged live artist motion solver, with numerical and visual review.
"""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE = 'wildmesh-white-western'
EXPECTED_SHA = '743fd70ec937dde1aa550afde17eeb506ca538933e291eca41d2fa8d5ffb20ea'
SG = 'KHR_materials_pbrSpecularGlossiness'


def trusted(filename, name):
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        sys.dont_write_bytecode = previous


def append(doc, binary, values, component, kind, target=None):
    values = np.asarray(values, dtype={5123: '<u2', 5126: '<f4'}[component])
    binary.extend(b'\0' * (-len(binary) % 4))
    view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes}
    if target is not None:
        view['target'] = target
    vi = len(doc['bufferViews'])
    doc['bufferViews'].append(view)
    binary.extend(values.tobytes())
    accessor = {'bufferView': vi, 'componentType': component, 'count': len(values), 'type': kind}
    if kind == 'VEC3':
        accessor.update(min=values.min(axis=0).astype(float).tolist(), max=values.max(axis=0).astype(float).tolist())
    ai = len(doc['accessors'])
    doc['accessors'].append(accessor)
    return ai


def modern_materials(doc):
    converted = []
    for material in doc['materials']:
        extension = material.get('extensions', {}).get(SG)
        if not extension or extension.get('specularFactor') != [0, 0, 0] or 'specularGlossinessTexture' in extension:
            raise ValueError('Source material no longer matches the reviewed zero-specular case')
        material['pbrMetallicRoughness'] = {
            'baseColorFactor': extension.get('diffuseFactor', [1, 1, 1, 1]),
            'metallicFactor': 0, 'roughnessFactor': 1 - extension.get('glossinessFactor', 1)}
        if 'diffuseTexture' in extension:
            material['pbrMetallicRoughness']['baseColorTexture'] = copy.deepcopy(extension['diffuseTexture'])
        material['extensions'].pop(SG)
        material['extensions']['KHR_materials_specular'] = {'specularFactor': 0}
        converted.append({'material': material['name'], 'diffuseMapPreserved': True,
                          'specularFactor': 0, 'roughnessFactor': material['pbrMetallicRoughness']['roughnessFactor'],
                          'alphaMode': material.get('alphaMode', 'OPAQUE'),
                          'alphaCutoff': material.get('alphaCutoff')})
    doc['extensionsUsed'] = sorted((set(doc.get('extensionsUsed', [])) - {SG}) | {'KHR_materials_specular'})
    doc['extensionsRequired'] = [x for x in doc.get('extensionsRequired', []) if x != SG]
    return converted


def build():
    paths = trusted('extract-horse-import.py', 'horse_registered_source')
    glb = trusted('rig_hero_horse.py', 'horse_glb_tools')
    candidate, source, receipt = paths.registered_source(CANDIDATE)
    if receipt['sha256'] != EXPECTED_SHA or paths.file_digest(source) != (EXPECTED_SHA, receipt['bytes']):
        raise ValueError('Original approved WildMesh source hash changed')
    receipt_bytes = (source.parent / 'receipt.json').read_bytes()
    source_doc, binary = glb.read_glb(source)
    if len(source_doc['skins']) != 1 or len(source_doc['meshes']) != 5:
        raise ValueError('Unexpected source skin/mesh layout')
    worlds, source_parents = glb.node_worlds(source_doc)
    source_skin = source_doc['skins'][0]
    source_joint_nodes = source_skin['joints']
    source_names = [source_doc['nodes'][i]['name'] for i in source_joint_nodes]
    stems = [re.sub(r'_0\d+$', '', name) for name in source_names]
    by_stem = {name: index for index, name in enumerate(stems)}
    ib = glb.accessor(source_doc, binary, source_skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    matrices = np.array([worlds[index] for index in source_joint_nodes]) @ ib
    source_points, source_normals, source_indices, source_weights = [], [], [], []
    for mesh in source_doc['meshes']:
        if len(mesh['primitives']) != 1:
            raise ValueError('Unexpected multi-primitive source mesh')
        attributes = mesh['primitives'][0]['attributes']
        vertices = glb.accessor(source_doc, binary, attributes['POSITION'])
        joints = glb.accessor(source_doc, binary, attributes['JOINTS_0'])
        weights = glb.accessor(source_doc, binary, attributes['WEIGHTS_0'])
        if not np.isfinite(weights).all() or np.max(np.abs(weights.sum(1) - 1)) > 2e-5:
            raise ValueError('Invalid source skin weights')
        # GLTFLoader binds with identity: authoritative world deformation is
        # jointWorld * inverseBind * position, summed across four influences.
        points = np.einsum('nwij,nj,nw->ni', matrices[joints], np.c_[vertices, np.ones(len(vertices))], weights)[:, :3]
        normals = glb.accessor(source_doc, binary, attributes['NORMAL'])
        normals = np.einsum('nwij,nj,nw->ni', matrices[joints, :3, :3], normals, weights)
        normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], 1e-12)
        source_points.append(points)
        source_normals.append(normals)
        source_indices.append(joints)
        source_weights.append(weights)
    ground = float(source_points[0][:, 1].min())
    center_z = float(worlds[source_joint_nodes[by_stem['saddle']]][2, 3])
    offset = np.array([0, -ground, -center_z])
    points = [value + offset for value in source_points]

    # Parent-before-child order is required by the game's FK and IK solver.
    definitions = [
        ('ROOT', None, None), ('pelvis', 'ROOT', 'pelvis'),
        ('spine', 'pelvis', 'spine_02'), ('chest', 'spine', 'spine_04'),
        ('neck.lower', 'chest', 'neckOff_01'), ('neck.upper', 'neck.lower', 'neck_03'),
        ('head', 'neck.upper', 'head'), ('jaw', 'head', 'jaw'),
        ('ear.L', 'head', 'ear_01_r'), ('ear.R', 'head', 'ear_01_l'),
        ('tail.1', 'pelvis', 'tail_01'), ('tail.2', 'tail.1', 'tail_04'),
        ('tail.3', 'tail.2', 'dyn_tail_06'), ('tail.4', 'tail.3', 'dyn_tail_08')]
    # The game's canonical L side is -X. WildMesh's source l label is +X;
    # preserve anatomy in place while recording that naming convention reversal.
    for label, side in [('L', 'r'), ('R', 'l')]:
        previous = 'chest'
        for suffix, source_name in zip(['scapula', 'upperarm', 'forearm', 'cannon', 'pastern', 'hoof'],
                                       ['clavicle', 'upperarm', 'lowerarm', 'hand', 'fingers_01', 'fingers_02']):
            name = 'F' + label + '.' + suffix
            definitions.append((name, previous, source_name + '_' + side))
            previous = name
    for label, side in [('L', 'r'), ('R', 'l')]:
        previous = 'pelvis'
        for suffix, source_name in zip(['thigh', 'shin', 'cannon', 'pastern', 'hoof'],
                                       ['upperleg', 'lowerleg', 'foot', 'toes_01', 'toes_02']):
            name = 'H' + label + '.' + suffix
            definitions.append((name, previous, source_name + '_' + side))
            previous = name
    for leg in ['FL', 'FR', 'HL', 'HR']:
        definitions.append((leg + '.IK', 'ROOT', None))
    assert len(definitions) == 40
    names = [item[0] for item in definitions]
    ids = {name: i for i, name in enumerate(names)}
    heads = np.zeros((40, 3), dtype=float)
    for index, (name, parent, stem) in enumerate(definitions):
        if stem:
            heads[index] = worlds[source_joint_nodes[by_stem[stem]]][:3, 3] + offset
        elif name.endswith('.IK'):
            heads[index] = heads[ids[name[:2] + '.pastern']]
        if parent and parent != 'ROOT' and np.linalg.norm(heads[index] - heads[ids[parent]]) < .005:
            raise ValueError('Degenerate anatomical joint ' + name)

    direct = {stem: name for name, _, stem in definitions if stem}
    direct.update({'root': 'ROOT', '_rootJoint': 'ROOT', 'hips': 'pelvis',
                   'spine_01': 'spine', 'spine_03': 'spine',
                   'neck_01': 'neck.lower', 'neck_02': 'neck.upper',
                   'neck_04': 'neck.upper', 'neck_05': 'neck.upper', 'saddle': 'spine'})
    tail_ids = [ids['tail.' + str(i)] for i in range(1, 5)]
    for stem in stems:
        if re.fullmatch(r'(?:tail|dyn_tail)_\d+', stem):
            position = worlds[source_joint_nodes[by_stem[stem]]][:3, 3] + offset
            direct[stem] = names[min(tail_ids, key=lambda i: np.linalg.norm(position - heads[i]))]
    node_to_joint = {node: index for index, node in enumerate(source_joint_nodes)}
    mapping = []
    for index, node in enumerate(source_joint_nodes):
        ancestor, seen = node, set()
        while ancestor in node_to_joint and stems[node_to_joint[ancestor]] not in direct:
            if ancestor in seen:
                raise ValueError('Source joint hierarchy cycle')
            seen.add(ancestor)
            ancestor = source_parents.get(ancestor, -1)
        target = direct.get(stems[node_to_joint[ancestor]], 'ROOT') if ancestor in node_to_joint else 'ROOT'
        mapping.append(ids[target])
    mapping = np.array(mapping, dtype=np.uint16)

    doc = copy.deepcopy(source_doc)
    materials = modern_materials(doc)
    doc['nodes'] = []
    for index, (name, parent, stem) in enumerate(definitions):
        doc['nodes'].append({'name': name,
                             'translation': (heads[index] - (heads[ids[parent]] if parent else 0)).tolist(),
                             'rotation': [0, 0, 0, 1]})
        if parent:
            doc['nodes'][ids[parent]].setdefault('children', []).append(index)
    inverse = np.tile(np.eye(4), (40, 1, 1))
    inverse[:, :3, 3] = -heads
    inverse_accessor = append(doc, binary, inverse.transpose(0, 2, 1).reshape(40, 16), 5126, 'MAT4')
    doc['skins'] = [{'name': 'WildMesh anatomical game rig', 'joints': list(range(40)),
                     'skeleton': 0, 'inverseBindMatrices': inverse_accessor}]
    mesh_names = ['HorseBody', 'HorseEyes', 'HorseGroom', 'HorseWesternTack', 'HorseWesternSaddle']
    weight_reports, sole_reports = [], []
    for mesh_index, mesh in enumerate(doc['meshes']):
        primitive = mesh['primitives'][0]
        old_attributes = primitive['attributes']
        ownership = np.zeros((len(points[mesh_index]), 40), dtype=float)
        mapped = mapping[source_indices[mesh_index]]
        for column in range(4):
            np.add.at(ownership, (np.arange(len(ownership)), mapped[:, column]), source_weights[mesh_index][:, column])
        keep = np.argsort(ownership, axis=1)[:, -4:][:, ::-1]
        weights = np.take_along_axis(ownership, keep, axis=1)
        weights /= np.maximum(weights.sum(1)[:, None], 1e-12)
        if not np.isfinite(weights).all() or weights.sum(1).min() < .999999:
            raise ValueError('Invalid merged weights')
        primitive['attributes'] = {**old_attributes,
            'POSITION': append(doc, binary, points[mesh_index], 5126, 'VEC3', 34962),
            'NORMAL': append(doc, binary, source_normals[mesh_index], 5126, 'VEC3', 34962),
            'JOINTS_0': append(doc, binary, keep, 5123, 'VEC4', 34962),
            'WEIGHTS_0': append(doc, binary, weights, 5126, 'VEC4', 34962)}
        mesh['name'] = mesh_names[mesh_index]
        doc['nodes'].append({'name': mesh_names[mesh_index], 'mesh': mesh_index, 'skin': 0})
        weight_reports.append({'mesh': mesh_names[mesh_index], 'vertices': len(ownership),
                               'maxWeightError': float(np.max(np.abs(weights.sum(1) - 1))),
                               'maxInfluences': int((weights > 1e-7).sum(1).max()),
                               'restPoseBakingMaxFloatError': float(np.max(np.abs(points[mesh_index].astype('<f4').astype(float) - points[mesh_index])))})
        if mesh_index == 0:
            for leg in ['FL', 'FR', 'HL', 'HR']:
                chain = [ids[name] for name in names if name.startswith(leg + '.') and not name.endswith('.IK')]
                foot = heads[ids[leg + '.hoof']]
                owner = ownership[:, chain].sum(1)
                mask = (owner > .75) & (points[0][:, 1] <= foot[1] + .01) & (np.linalg.norm(points[0][:, [0, 2]] - foot[[0, 2]], axis=1) < .15)
                if mask.sum() < 12:
                    raise ValueError('Insufficient anatomically owned hoof vertices for ' + leg)
                sole_reports.append({'leg': leg, 'samples': int(mask.sum()), 'minY': float(points[0][mask, 1].min()),
                                     'maxOwnership': float(owner[mask].max())})
    doc['scenes'] = [{'name': 'WildMesh western game foundation', 'nodes': [0, *range(40, 45)]}]
    doc['scene'] = 0
    doc.pop('animations', None)
    body = points[0]
    withers_mask = (np.abs(body[:, 0]) < .07) & (body[:, 2] > 1.96 - center_z) & (body[:, 2] < 2.10 - center_z)
    withers = float(body[withers_mask, 1].max())
    saddle = np.array([0, 0, 0], dtype=float)
    seat_mask = (np.abs(points[4][:, 0]) < .055) & (np.abs(points[4][:, 2]) < .045)
    if seat_mask.sum() < 5:
        raise ValueError('Cannot measure original saddle seat')
    saddle[1] = float(np.percentile(points[4][seat_mask, 1], 95)) + .018
    head = heads[ids['head']]
    jaw_end = worlds[source_joint_nodes[by_stem['jaw_end']]][:3, 3] + offset
    eyes = [np.mean(points[1][points[1][:, 0] < -.04], axis=0).tolist(),
            np.mean(points[1][points[1][:, 0] >= -.04], axis=0).tolist()]
    anchors = {'saddle': [saddle.tolist()], 'withers': [[0, withers, float(np.mean(body[withers_mask, 2]))]],
               'head': [head.tolist()], 'poll': [head.tolist()], 'muzzle': [jaw_end.tolist()],
               'crest': [heads[ids['neck.upper']].tolist()], 'tail': [heads[ids['tail.1']].tolist()], 'eyes': eyes,
               'nostrils': [(jaw_end + np.array([side * .052, .042, -.035])).tolist() for side in (-1, 1)]}
    output = paths.checked_path(candidate / 'game', ROOT, directory=True, create=True)
    path = paths.checked_path(output / 'white-western.glb', ROOT)
    doc['asset'].setdefault('extras', {})['gameDerivative'] = 'Canonical anatomical 40-joint rig; source pose and materials preserved; weights merged by source semantics.'
    glb.write_glb(path, doc, binary)
    profile = {'id': 'white-western', 'name': 'White western horse', 'file': 'white-western.glb',
        'artistBreed': True, 'bodyMesh': 'HorseBody', 'hairMesh': 'HorseGroom',
        'withersM': withers, 'heightM': float(body[:, 1].max()), 'fitScale': 1.45 / withers, 'fitY': 0,
        'anchors': anchors, 'preserveSourceTack': True, 'preserveSaddleAnchor': True,
        'sourceTackMeshes': mesh_names[3:], 'preserveSourceMaterials': True, 'preserveSourceGroom': True,
        'sourceSha256': EXPECTED_SHA, 'sha256': paths.file_digest(path)[0],
        'creator': 'WildMesh 3D', 'license': 'CC BY-NC 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by-nc/4.0/',
        'sourceUrl': receipt.get('sourceUrl') or source_doc['asset']['extras']['source'],
        'family': 'riding', 'jointCount': 40, 'triangles': receipt['inspection']['trianglesFromAccessorCounts'],
        'clips': [], 'gaitImplementation': 'assets/artist-horse-motion.js, baked clips appended separately'}
    report = {'schemaVersion': 1, 'candidateId': CANDIDATE, 'status': 'anatomical-rig-built-motion-review-pending',
        'sourceSha256': EXPECTED_SHA, 'gameSha256': profile['sha256'], 'originalSourcePreserved': True,
        'sourceReceiptPreserved': True, 'axes': '+Z forward, +Y up', 'offset': offset.tolist(),
        'riggingMethod': 'Original default glTF skin pose baked in world space; original four weights merged by anatomical source joint ancestry. No surface replacement or geometric simplification.',
        'sourceJointCount': len(source_joint_nodes), 'gameJointCount': 40,
        'canonicalLeftAxis': '-X', 'sourceSideLabelsReversed': True,
        'canonicalJointSource': [{'joint': name, 'parent': parent, 'source': stem,
                                 'position': heads[index].tolist()} for index, (name, parent, stem) in enumerate(definitions)],
        'sourceJointOwnership': [{'source': name, 'target': names[int(mapping[index])]} for index, name in enumerate(source_names)],
        'meshWeights': weight_reports, 'hoofSoleDetection': sole_reports, 'materials': materials,
        'preserved': ['Body and eye topology', 'Every source alpha groom card', 'Western tack, saddle, bridle and reins',
                      'Original indices and both UV channels', 'All five original embedded PNG bytes', 'Original author/license/source metadata'],
        'sourceAnimationNote': 'Original source Idle/Walk clips remain in the preserved original. Game locomotion is fitted to the new anatomical rig using the actual live game solver; baked clips and QA are separate.',
        'integrationRequirements': ['Respect preserveSourceTack to avoid duplicate procedural saddle/bridle.',
                                   'Respect preserveSaddleAnchor; the native seat is above the leather saddle, not the bare body.',
                                   'Do not run geometry-spreading groom helpers over this original alpha-card groom.'],
        'motionReview': 'pending', 'visualReview': 'pending', 'comparisonToStarEquestrian': 'No exact proprietary skeleton equivalence claimed.'}
    for filename, value in [('profile.json', profile), ('build-report.json', report)]:
        target = paths.checked_path(output / filename, ROOT)
        target.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
    if paths.file_digest(source) != (EXPECTED_SHA, receipt['bytes']) or (source.parent / 'receipt.json').read_bytes() != receipt_bytes:
        raise RuntimeError('Original source or receipt changed during conversion')
    print(json.dumps({'gameFile': str(path.relative_to(ROOT)), 'sha256': profile['sha256'],
                      'withersM': withers, 'heightM': profile['heightM'], 'hoofSoles': sole_reports,
                      'status': report['status']}, indent=2))


if __name__ == '__main__':
    build()
