"""Assemble the approved real CGCookie long-feather wing into a paired game rig.

Original ZIP, extracted Blend, receipts and review mesh remain read only. The
review's real48 source feather instances are rigidly attached to the source wing
anatomy and receive individual fan joints; no replacement feather mesh is made.
Missing original image maps and unverified down strands remain explicit.
"""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'assets/models/horse-imports/cgcookie-wings'
PREVIEW = BASE/'review/model.glb'
PREVIEW_SHA = '32dd148f6da8fabf04ff2f33ec6694299265d5338f95583408ce860fdc17b5c2'
SOURCE = BASE/'source/CGC Classic Feathery Wing.zip'
SOURCE_SHA = 'cf713fa956ec331b5c7e63425e38f7a4666e8a5e9754b2d5d4bd1c778ae2aecb'
BLEND = BASE/'work/extracted/wing_042810.blend'
BLEND_SHA = 'f43fd99185b2e0d3877dc5b42c4c8004a6071ac420cb774d4d466ffd3fe0e258'
spec = importlib.util.spec_from_file_location('numeric_glb', Path(__file__).with_name('rig-imported-dragon.py'))
glb = importlib.util.module_from_spec(spec); spec.loader.exec_module(glb)


def build():
    for p, expected in [(SOURCE, SOURCE_SHA), (BLEND, BLEND_SHA), (PREVIEW, PREVIEW_SHA)]:
        if hashlib.sha256(p.read_bytes()).hexdigest() != expected:
            raise ValueError('Registered source hash mismatch: '+str(p))
    receipt = (BASE/'source/receipt.json').read_bytes()
    d, binary = glb.glb(PREVIEW); world, _ = glb.worlds(d)
    source_joints = d['skins'][0]['joints']; bone_positions = np.stack([world[i][:3, 3] for i in source_joints])
    inverses = glb.accessor(d, binary, d['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    transforms = np.stack([world[i]@inverse for i, inverse in zip(source_joints, inverses)])
    feather_p, body_p = [m['primitives'][0] for m in d['meshes']]
    feathers = glb.accessor(d, binary, feather_p['attributes']['POSITION'])
    body = glb.accessor(d, binary, body_p['attributes']['POSITION'])
    skin_indices = glb.accessor(d, binary, body_p['attributes']['JOINTS_0']).astype(int)
    skin_weights = glb.accessor(d, binary, body_p['attributes']['WEIGHTS_0']).astype(float); skin_weights /= skin_weights.sum(1)[:, None]
    blend = sum(transforms[skin_indices[:, k]]*skin_weights[:, k, None, None] for k in range(4))
    body = np.einsum('nij,nj->ni', blend, np.c_[body, np.ones(len(body))])[:, :3]
    body_normals = glb.accessor(d, binary, body_p['attributes']['NORMAL'])
    body_normals = np.einsum('nij,nj->ni', blend[:, :3, :3], body_normals); body_normals /= np.linalg.norm(body_normals, axis=1)[:, None]
    feather_normals = glb.accessor(d, binary, feather_p['attributes']['NORMAL'])
    feather_indices = glb.accessor(d, binary, feather_p['indices']).astype(int).ravel()
    if len(feather_indices) != 48*32*3:
        raise ValueError('Expected48 exact source feather instances')
    origin = bone_positions[0]
    scale = 2.65/(max(feathers[:, 0].max(), body[:, 0].max())-origin[0])
    # Source feather wing lies in XY. Rotate it to the horse's XZ plane, with
    # the long feathers trailing backward and the wing root outside the torso.
    basis = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0.]])
    mount = np.array([.39, -.10, -.12])
    def points(a, side=1):
        result = (a-origin)@basis.T*scale+mount
        result[:, 0] *= side
        return result
    def normals(a, side=1):
        result = a@basis.T; result[:, 0] *= side
        return result
    writer = glb.Writer(); out = writer.d
    out['asset']['generator'] = 'Meadowlark approved CGCookie paired feather wing conversion'
    out['asset']['extras'] = {'sourceZipSha256': SOURCE_SHA, 'sourceBlendSha256': BLEND_SHA,
                             'sourcePreviewSha256': PREVIEW_SHA, 'generativeToolsUsed': False}
    out['scenes'][0]['name'] = 'Real CGCookie articulated wing pair'; out['scenes'][0]['nodes'] = [0]
    out['materials'] = [{'name': 'Neutral source feathers, original maps unavailable', 'doubleSided': True,
                         'pbrMetallicRoughness': {'baseColorFactor': [.83, .85, .82, 1], 'metallicFactor': 0, 'roughnessFactor': .82}}]
    names, positions, parents = [], [], []
    def joint(name, position, parent):
        i = len(names); names.append(name); positions.append(np.asarray(position)); parents.append(parent)
        node = {'name': name, 'translation': (position-(positions[parent] if parent >= 0 else 0)).tolist()}
        out['nodes'].append(node)
        if parent >= 0: out['nodes'][parent].setdefault('children', []).append(i)
        return i
    root = joint('featherWing.ROOT', np.zeros(3), -1)
    bone_profile, feather_profile, meshes = {}, {}, []
    source_points = points(bone_positions)
    for side, sign in [('L', 1), ('R', -1)]:
        source_points = points(bone_positions, sign); chain = []
        for i, label in enumerate(['shoulder', 'elbow', 'wrist', 'tip']):
            chain.append(joint('featherWing.'+side+'.'+label, source_points[i], chain[-1] if chain else root))
        bone_profile[side] = [names[j] for j in chain]; feather_profile[side] = []
        ids = np.array(chain)[skin_indices]
        attributes = {'POSITION': writer.acc(points(body, sign), 'VEC3'), 'NORMAL': writer.acc(normals(body_normals, sign), 'VEC3'),
                      'JOINTS_0': writer.acc(ids, 'VEC4', 5123), 'WEIGHTS_0': writer.acc(skin_weights, 'VEC4')}
        if 'TEXCOORD_0' in body_p['attributes']: attributes['TEXCOORD_0'] = writer.acc(glb.accessor(d, binary, body_p['attributes']['TEXCOORD_0']), 'VEC2')
        indices = glb.accessor(d, binary, body_p['indices']).astype(int).reshape(-1, 3)
        if sign < 0: indices = indices[:, [0, 2, 1]]
        meshes.append({'name': 'RealWingBody.'+side, 'primitives': [{'attributes': attributes, 'indices': writer.acc(indices.ravel()[:, None], 'SCALAR', 5123), 'material': 0}]})
        all_positions, all_normals, all_ids, all_weights, all_indices = [], [], [], [], []
        for feather in range(48):
            old = feather_indices[feather*96:(feather+1)*96]; unique, mapped = np.unique(old, return_inverse=True)
            source = feathers[unique]
            # The basal feather vertices sit closest to the original wing body.
            # Attach rigid feathers there; do not shear their real flat geometry.
            distance = ((source[:, None, :]-body[None, :, :])**2).sum(2)
            basal = np.argmin(distance.min(1)); nearest = int(np.argmin(distance[basal]))
            parent_joint = int(skin_indices[nearest, np.argmax(skin_weights[nearest])])
            base_point = source[basal:basal+1]
            fan = joint('featherWing.'+side+'.feather.'+str(feather), points(base_point, sign)[0], chain[parent_joint])
            axis = source[np.argmax(np.linalg.norm(source-source[basal], axis=1))]-source[basal]
            axis = axis@basis.T; axis[0] *= sign; axis /= np.linalg.norm(axis)
            feather_profile[side].append({'name': names[fan], 'parent': names[chain[parent_joint]], 'index': feather, 'fanAxis': axis.tolist()})
            offset = len(all_positions); all_positions.extend(points(source, sign)); all_normals.extend(normals(feather_normals[unique], sign))
            all_ids.extend([[fan, 0, 0, 0]]*len(unique)); all_weights.extend([[1, 0, 0, 0]]*len(unique))
            triangles = mapped.reshape(-1, 3)
            if sign < 0: triangles = triangles[:, [0, 2, 1]]
            all_indices.extend((triangles+offset).ravel())
        attributes = {'POSITION': writer.acc(all_positions, 'VEC3'), 'NORMAL': writer.acc(all_normals, 'VEC3'),
                      'JOINTS_0': writer.acc(all_ids, 'VEC4', 5123), 'WEIGHTS_0': writer.acc(all_weights, 'VEC4')}
        meshes.append({'name': 'RealLongFeathers.'+side, 'primitives': [{'attributes': attributes, 'indices': writer.acc(np.asarray(all_indices)[:, None], 'SCALAR', 5123), 'material': 0}]})
    out['meshes'] = meshes
    for i, mesh in enumerate(meshes):
        out['nodes'].append({'name': mesh['name'], 'mesh': i, 'skin': 0}); out['scenes'][0]['nodes'].append(len(out['nodes'])-1)
    inverse = np.repeat(np.eye(4)[None], len(positions), axis=0); inverse[:, :3, 3] = -np.stack(positions)
    out['skins'] = [{'name': 'Real feather wing pair with individual fanning joints', 'joints': list(range(len(positions))),
                     'inverseBindMatrices': writer.acc(inverse.transpose(0, 2, 1).reshape(-1, 16), 'MAT4')}]
    rig = {'version': 1, 'chains': bone_profile, 'feathers': feather_profile,
           'fold': {'tip': .1, 'shoulder': .5, 'elbow': 1.8040366243191712, 'wrist': 2.4820536457938283,
                    'shoulderRoll': -.8, 'elbowRoll': .22963289678006396, 'wristRoll': .027288037216170458,
                    'shoulderPitch': .07520668829006222, 'elbowPitch': -.1641033142837761, 'wristPitch': .6068108591322788}}
    out['extras'] = {'featherWingRig': rig}; game = BASE/'game'; sha = writer.save(game/'wings.glb')
    profile = {'id': 'cgcookie-wings', 'file': 'wings.glb', 'sha256': sha, 'componentKind': 'paired-articulated-source-feather-wings',
               'creator': 'CG Cookie / David Ward', 'license': 'CC BY3.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/3.0/',
               'sourceCandidateId': 'cgcookie-wings', 'sourceSha256': SOURCE_SHA, 'jointCount': len(positions), 'featherInstances': 96,
               'triangles': 6496, 'coordinateSystem': '+Z forward,+Y up,metres', 'halfSpanM': 3.04,
               'mountOrigin': [0, 0, 0], 'mountReference': 'horse raw withers anchor, followed through chest bind transform',
               'referenceWithersM': 1.7869539753502213, 'physicalScale': True, 'featherWingRig': rig,
               'limitations': ['Original wing color/alpha maps unavailable; neutral feather material is used.',
                               'Unverified legacy down strands omitted; the genuine48 long-feather instances are preserved per side.',
                               'Original long-feather preview has no texture coordinates; no new source texture fidelity is claimed.'],
               'clips': [], 'gameCompatibility': 'awaiting-motion-and-mounted-host-review'}
    report = {'sourceZipSha256': SOURCE_SHA, 'sourceBlendSha256': BLEND_SHA, 'sourcePreviewSha256': PREVIEW_SHA, 'gameSha256': sha,
              'scale': scale, 'basis': basis.tolist(), 'sourceWingRoot': origin.tolist(), 'mountingRoot': mount.tolist(),
              'sourceWingTrianglesPerSide': 3248, 'sourceLongFeathersPerSide': 48, 'sourceLongFeatherTopologyPreserved': True,
              'sourceWingBodySkinOwnershipPreserved': True, 'sourceLongFeatherBinding': 'rigid individual feather joints attached to nearest basal source-wing dominant skin joint',
              'jointCount': len(positions), 'missingMaps': ['wing_alphamap.png', 'wing_texturemap.jpg'], 'omittedDownStrands': 1000,
              'generativeToolsUsed': False, 'originalSourcePreserved': hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA,
              'originalBlendPreserved': hashlib.sha256(BLEND.read_bytes()).hexdigest() == BLEND_SHA,
              'originalReceiptPreserved': (BASE/'source/receipt.json').read_bytes() == receipt, 'gameIntegration': 'pending'}
    for name, value in [('profile.json', profile), ('conversion.json', report)]: (game/name).write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'file': str(game/'wings.glb'), 'sha256': sha, 'joints': len(positions), 'triangles': profile['triangles']}))

if __name__ == '__main__': build()
