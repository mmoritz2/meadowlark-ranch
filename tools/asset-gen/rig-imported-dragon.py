"""Build the approved dragon from its exact glTF scene/skin appearance.

This is an ordinary numerical asset conversion, not an AI image workflow. The
registered original is read only. Positions are first baked with the same
normalized-weight skinning as the vendored Three loader, avoiding the observed
Blender import pose mismatch. UVs, topology, material definitions and source wing
ownership are preserved. Only the decorative ground and unused control rig are
removed from this derived game asset.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import struct

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/models/horse-imports/black-dragon'
SOURCE = BASE / 'source/black_dragon_with_idle_animation.glb'
EXPECTED = '3abf7ed79e40406236d8b0e365f4690174daf8cfec39b32bfb2ab3ba48d5a1e7'


def glb(path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', data)
    if (magic, version, total) != (b'glTF', 2, len(data)):
        raise ValueError('Invalid GLB')
    offset = 12
    doc, binary = None, None
    while offset < len(data):
        size, kind = struct.unpack_from('<II', data, offset)
        block = data[offset + 8:offset + 8 + size]
        if kind == 0x4e4f534a:
            doc = json.loads(block)
        elif kind == 0x004e4942:
            binary = block
        offset += size + 8
    return doc, binary


def accessor(d, b, i):
    a = d['accessors'][i]
    v = d['bufferViews'][a['bufferView']]
    if a.get('sparse') or v.get('buffer', 0):
        raise ValueError('Unsupported source accessor')
    typ = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']]
    cols = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    size = np.dtype(typ).itemsize
    out = np.ndarray((a['count'], cols), dtype=typ, buffer=b,
                     offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                     strides=(v.get('byteStride', cols * size), size)).copy()
    if a.get('normalized'):
        out = out.astype(float) / np.iinfo(np.dtype(typ)).max
    return out


def matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    r = np.array([[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w, 0],
                  [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w, 0],
                  [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y, 0], [0, 0, 0, 1.]])
    r[:3, :3] *= np.array(n.get('scale', [1, 1, 1]))[None, :]
    r[:3, 3] = n.get('translation', [0, 0, 0])
    return r


def worlds(d):
    parents = {c: i for i, n in enumerate(d['nodes']) for c in n.get('children', [])}
    out = {}
    def at(i):
        if i not in out:
            out[i] = (at(parents[i]) if i in parents else np.eye(4)) @ matrix(d['nodes'][i])
        return out[i]
    for i in range(len(d['nodes'])):
        at(i)
    return out, parents


class Writer:
    def __init__(self):
        self.bin = bytearray()
        self.d = {'asset': {'version': '2.0', 'generator': 'Meadowlark approved dragon conversion'},
                  'scene': 0, 'scenes': [{'name': 'Actual dragon game rig', 'nodes': []}],
                  'buffers': [{}], 'bufferViews': [], 'accessors': [], 'nodes': [], 'meshes': []}
    def view(self, data):
        self.bin.extend(b'\0' * (-len(self.bin) % 4))
        self.d['bufferViews'].append({'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)})
        self.bin.extend(data)
        return len(self.d['bufferViews'])-1
    def acc(self, data, kind, component=5126):
        dt = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[component]
        arr = np.ascontiguousarray(data, dtype=dt)
        entry = {'bufferView': self.view(arr.tobytes()), 'componentType': component,
                 'count': len(arr), 'type': kind}
        if kind == 'VEC3':
            entry.update(min=arr.min(0).tolist(), max=arr.max(0).tolist())
        self.d['accessors'].append(entry)
        return len(self.d['accessors'])-1
    def save(self, path):
        self.bin.extend(b'\0' * (-len(self.bin) % 4))
        self.d['buffers'][0]['byteLength'] = len(self.bin)
        js = json.dumps(self.d, separators=(',', ':'), allow_nan=False).encode()
        js += b' ' * (-len(js) % 4)
        data = struct.pack('<4sII', b'glTF', 2, 28+len(js)+len(self.bin))
        data += struct.pack('<II', len(js), 0x4e4f534a)+js
        data += struct.pack('<II', len(self.bin), 0x004e4942)+self.bin
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix('.glb.tmp')
        temp.write_bytes(data)
        temp.replace(path)
        return hashlib.sha256(data).hexdigest()


def measure_stirrup_clearance(points, torso_ownership, indices, saddle):
    """Keep generated English tread height/reach; clear only the real torso."""
    station = np.array([saddle[1]-.512, saddle[2]+.200])
    crossings = []
    for ids in np.asarray(indices).reshape(-1, 3):
        if min(torso_ownership[ids]) <= .55:
            continue
        tri = points[ids]
        yz = tri[:, [1, 2]]
        plane = np.column_stack([yz[1]-yz[0], yz[2]-yz[0]])
        if abs(np.linalg.det(plane)) < 1e-10:
            continue
        uv = np.linalg.solve(plane, station-yz[0])
        barycentric = np.array([1-uv.sum(), *uv])
        if min(barycentric) >= -1e-6:
            crossings.append(float(barycentric@tri[:, 0]))
    if len(crossings) < 2:
        raise ValueError('Dragon bilateral torso surface missing at English tread plane')
    left, right = min(crossings), max(crossings)
    anchors = [[min(-.270, left-.035), *station],
               [max(.270, right+.035), *station]]
    return {'method': 'Exact horizontal ray through source torso triangles; all three vertices have source pelvis/spine/chest ownership greater than .55; preserve English saddle tread Y/Z at seatY-.512,seatZ+.200; X clears source surface by at least .035m',
            'barrelStationYZ': station.tolist(), 'barrelSurfaceMinMaxX': [left, right],
            'torsoWidthM': right-left, 'minimumSideClearanceM': .035,
            'defaultStirrupX': [-.270, .270],
            'defaultSideClearanceM': [left-(-.270), .270-right],
            'stirrupAnchors': anchors,
            'selectedSideClearanceM': [left-anchors[0][0], anchors[1][0]-right],
            'intersections': crossings}


def convert(texture_size):
    original = SOURCE.read_bytes()
    if hashlib.sha256(original).hexdigest() != EXPECTED:
        raise ValueError('Registered original hash mismatch')
    receipt_bytes = (SOURCE.parent / 'receipt.json').read_bytes()
    receipt = json.loads(receipt_bytes)
    if receipt['sha256'] != EXPECTED:
        raise ValueError('Receipt mismatch')
    d, b = glb(SOURCE)
    world, source_parents = worlds(d)
    source_ids = d['skins'][0]['joints']
    names = {i: d['nodes'][i]['name'] for i in source_ids}
    ib = accessor(d, b, d['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    transforms = np.stack([world[i] @ inverse for i, inverse in zip(source_ids, ib)])
    baked = []
    for mesh in d['meshes'][1:]:
        p = mesh['primitives'][0]
        points = accessor(d, b, p['attributes']['POSITION'])
        joints = accessor(d, b, p['attributes']['JOINTS_0']).astype(int)
        weights = accessor(d, b, p['attributes']['WEIGHTS_0']).astype(float)
        weights /= weights.sum(1)[:, None]
        blend = sum(transforms[joints[:, k]] * weights[:, k, None, None] for k in range(4))
        result = np.einsum('nij,nj->ni', blend, np.c_[points, np.ones(len(points))])[:, :3]
        baked.append({'primitive': p, 'positions': result, 'blend': blend,
                      'sourceIndices': joints, 'sourceWeights': weights})
    all_points = np.concatenate([a['positions'] for a in baked])
    body = baked[-1]['positions']
    source_low, source_high = all_points.min(0), all_points.max(0)
    # Verify against the independent vendored Three source audit before using it.
    verified = np.array([26.77513, 5.70416, 17.42008])
    if np.max(abs(source_high-source_low-verified)) > .00003:
        raise ValueError('Baked source pose does not match verified Three bounds')
    body_data = baked[-1]
    torso_ownership = np.sum(np.isin(np.array(source_ids)[body_data['sourceIndices']],
                                    [13, 31, 32, 33, 34])*body_data['sourceWeights'], axis=1)
    # Horns and wing fingers extend over the back. Use source torso skin
    # ownership to keep those appendages out of withers and seat measurements.
    back = body[(np.abs(body[:, 0]) < .45) & (body[:, 2] > -.12) & (body[:, 2] < .8) &
                (body[:, 1] > 2.5) & (torso_ownership > .6)]
    if len(back) < 3:
        raise ValueError('Withers surface sample missing')
    withers_source = float(np.percentile(back[:, 1], 95))
    ground = float(source_low[1])
    withers = 1.85
    scale = withers / (withers_source-ground)
    offset = np.array([0., -ground*scale, 0.])
    normalized = lambda point: np.asarray(point)*scale+offset
    at = lambda i: normalized(world[i][:3, 3])
    positions, parents, bone_names = [], [], []
    def joint(name, pos, parent=None):
        if name in bone_names:
            raise ValueError('Duplicate dragon joint')
        idx = len(bone_names)
        bone_names.append(name); positions.append(np.asarray(pos)); parents.append(parent)
        return idx
    # Same core hierarchy as the live site's 40-joint anatomical horse contract.
    root = joint('ROOT', at(13))
    feet = {}
    for leg, foot_id in [('FL', 193), ('FR', 151), ('HL', 130), ('HR', 172)]:
        foot = world[foot_id][:3, 3]
        near = body[(np.abs(body[:, 0]-foot[0]) < .43) &
                    (np.abs(body[:, 2]-foot[2]) < 1.3) & (body[:, 1] < .18)]
        sole = near[near[:, 1] < np.percentile(near[:, 1], 12)+.018]
        if not len(sole):
            raise ValueError('Dragon claw sole missing: '+leg)
        point = np.median(sole, axis=0); point[1] = np.min(sole[:, 1])+.04
        feet[leg] = normalized(point)
        joint(leg+'.IK', feet[leg], root)
    pelvis = joint('pelvis', at(13), root)
    for leg, hip, knee, ankle in [('HL', 19, 20, 130), ('HR', 25, 26, 172)]:
        thigh = joint(leg+'.thigh', at(hip), pelvis)
        shin = joint(leg+'.shin', at(knee), thigh)
        cannon = joint(leg+'.cannon', at(ankle), shin)
        h = feet[leg]; pa = h.copy(); pa[1] += .095; pa[2] -= .075
        pastern = joint(leg+'.pastern', pa, cannon)
        joint(leg+'.hoof', h, pastern)
    spine = joint('spine', at(32), pelvis)
    chest = joint('chest', at(33), spine)
    for leg, upper, lower, hand in [('FL', 90, 91, 193), ('FR', 93, 94, 151)]:
        sc = at(upper); sc[1] += .34
        scapula = joint(leg+'.scapula', sc, chest)
        upperarm = joint(leg+'.upperarm', at(upper), scapula)
        forearm = joint(leg+'.forearm', at(lower), upperarm)
        cannon_p = at(lower)*.55+at(hand)*.45
        cannon = joint(leg+'.cannon', cannon_p, forearm)
        pa = feet[leg].copy(); pa[1] += .075; pa[2] -= .05
        pastern = joint(leg+'.pastern', pa, cannon)
        joint(leg+'.hoof', feet[leg], pastern)
    necklower = joint('neck.lower', at(36), chest)
    neckupper = joint('neck.upper', at(38), necklower)
    head = joint('head', at(40), neckupper)
    joint('ear.L', at(40)+np.array([.10, .24, -.11]), head)
    joint('ear.R', at(40)+np.array([-.10, .24, -.11]), head)
    jaw = joint('jaw', at(42), head)
    tail_parent = pelvis
    for number, source_id in enumerate([14, 15, 16, 17], 1):
        tail_parent = joint('tail.'+str(number), at(source_id), tail_parent)
    if len(bone_names) != 40:
        raise ValueError('Anatomical core is not40 joints')
    wing_map = {}
    wing_profile = {}
    for side, source_root, branch_roots in [('L', 97, [98, 103, 107]), ('R', 112, [113, 118, 122])]:
        wing_root = joint('wing.'+side, at(source_root), chest)
        wing_map[source_root] = wing_root
        wing_profile[side] = {'root': 'wing.'+side, 'branches': []}
        for number, source_root_id in enumerate(branch_roots):
            branch = []
            def descend(i, parent):
                name = 'wing.'+side+'.'+str(number)+'.'+str(len(branch))
                new = joint(name, at(i), parent); wing_map[i] = new; branch.append(name)
                for c in d['nodes'][i].get('children', []):
                    if c in source_ids:
                        descend(c, new)
            descend(source_root_id, wing_root)
            wing_profile[side]['branches'].append(branch)
    name_to_new = {n: i for i, n in enumerate(bone_names)}
    direct = {13: 'pelvis', 31: 'spine', 32: 'spine', 33: 'chest', 34: 'chest',
              36: 'neck.lower', 37: 'neck.lower', 38: 'neck.upper', 39: 'neck.upper',
              40: 'head', 41: 'head', 42: 'jaw', 43: 'jaw', 45: 'jaw', 46: 'jaw', 47: 'jaw',
              14: 'tail.1', 15: 'tail.2', 16: 'tail.3', 17: 'tail.4',
              19: 'HL.thigh', 20: 'HL.shin', 21: 'HL.shin', 23: 'HL.cannon',
              25: 'HR.thigh', 26: 'HR.shin', 27: 'HR.shin', 29: 'HR.cannon',
              90: 'FL.upperarm', 91: 'FL.forearm', 93: 'FR.upperarm', 94: 'FR.forearm',
              130: 'HL.cannon', 172: 'HR.cannon', 151: 'FR.pastern', 193: 'FL.pastern'}
    def mapped(i):
        if i in wing_map:
            return wing_map[i]
        if i in direct:
            return name_to_new[direct[i]]
        nm = names.get(i, '')
        if re.match('front_', nm):
            return name_to_new[('FL' if '_L_' in nm else 'FR')+'.hoof']
        if re.match('back_', nm):
            return name_to_new[('HL' if '_L_' in nm else 'HR')+'.hoof']
        # Facial branches preserve the head/jaw region inherited from the source.
        if i in source_parents and source_parents[i] in source_ids:
            return mapped(source_parents[i])
        return root
    old_to_new = np.array([mapped(i) for i in source_ids])
    writer = Writer(); out = writer.d
    for key in ['materials', 'textures', 'samplers', 'extensionsUsed', 'extensionsRequired']:
        if key in d:
            out[key] = copy.deepcopy(d[key])
    # Source ground material remains unused; preserving numeric material indices
    # avoids altering source dragon material/texture definitions.
    image_report = []
    out['images'] = []
    for image in d['images']:
        view = d['bufferViews'][image['bufferView']]
        raw = b[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']]
        decoded = Image.open(io.BytesIO(raw)); before = decoded.size
        if max(before) > texture_size:
            decoded.thumbnail((texture_size, texture_size), Image.Resampling.LANCZOS)
            encoded = io.BytesIO()
            decoded.save(encoded, format='PNG' if image['mimeType'] == 'image/png' else 'JPEG',
                         **({'compress_level': 9} if image['mimeType'] == 'image/png' else {'quality': 94}))
            raw = encoded.getvalue()
        out['images'].append({**{k: copy.deepcopy(v) for k, v in image.items() if k != 'bufferView'},
                              'bufferView': writer.view(raw)})
        image_report.append({'name': image.get('name'), 'sourceSize': list(before),
                             'gameSize': list(decoded.size), 'encoding': image['mimeType']})
    for idx, (nm, pos, parent) in enumerate(zip(bone_names, positions, parents)):
        local = pos - (positions[parent] if parent is not None else np.zeros(3))
        n = {'name': nm, 'translation': local.tolist()}
        if parent is not None:
            out['nodes'][parent].setdefault('children', []).append(idx)
        out['nodes'].append(n)
    out['scenes'][0]['nodes'] = [0]
    inverse = np.repeat(np.eye(4)[None], len(positions), axis=0)
    inverse[:, :3, 3] = -np.array(positions)
    inverse_accessor = writer.acc(inverse.transpose(0, 2, 1).reshape(-1, 16), 'MAT4')
    out['skins'] = [{'name': 'Actual dragon anatomical core and source wing skin',
                     'inverseBindMatrices': inverse_accessor, 'joints': list(range(len(positions))), 'skeleton': 0}]
    validation = []; body_hash = None; claw_weight_adaptation = []
    for mi, data in enumerate(baked):
        p = data['primitive']; point = normalized(data['positions'])
        attributes = {'POSITION': writer.acc(point, 'VEC3')}
        for attribute, acc_id in p['attributes'].items():
            if attribute in ['POSITION', 'JOINTS_0', 'WEIGHTS_0']:
                continue
            values = accessor(d, b, acc_id)
            if attribute == 'NORMAL':
                values = np.einsum('nij,nj->ni', data['blend'][:, :3, :3], values)
                values /= np.linalg.norm(values, axis=1)[:, None]
            elif attribute == 'TANGENT':
                values[:, :3] = np.einsum('nij,nj->ni', data['blend'][:, :3, :3], values[:, :3])
                values[:, :3] /= np.linalg.norm(values[:, :3], axis=1)[:, None]
            attributes[attribute] = writer.acc(values, d['accessors'][acc_id]['type'])
        collapsed = np.zeros((len(point), len(positions)))
        indices = old_to_new[data['sourceIndices']]
        for k in range(4):
            np.add.at(collapsed, (np.arange(len(point)), indices[:, k]), data['sourceWeights'][:, k])
        if mi == 2:
            # The source ankle root also influences the lowest hind palm. Its
            # game anatomical cannon is intentionally above the distal claw;
            # let the genuine low claw surface follow the terminal while a
            # smooth band preserves the higher soft ankle/root deformation.
            for leg in ['FL', 'FR', 'HL', 'HR']:
                limb_ids = [i for i, name in enumerate(bone_names)
                            if name.startswith(leg+'.') and not name.endswith('IK')]
                ownership = collapsed[:, limb_ids].sum(1)
                terminal = positions[name_to_new[leg+'.hoof']]
                radius = np.linalg.norm(point[:, [0, 2]]-terminal[[0, 2]], axis=1)
                distal = (ownership >= .75) & (radius <= .65) & (point[:, 1] <= terminal[1]+.14)
                low = float(point[distal, 1].min())
                u = np.clip((point[:, 1]-low-.06)/.10, 0, 1)
                factor = (1-u*u*u*(10+u*(-15+6*u))) * distal
                original = collapsed.copy()
                collapsed[:, limb_ids] *= (1-factor[:, None])
                collapsed[:, name_to_new[leg+'.hoof']] += ownership*factor
                changed = np.max(abs(collapsed-original), axis=1) > 1e-9
                claw_weight_adaptation.append({'leg': leg, 'changedVertices': int(changed.sum()),
                    'fullyRigidLowClawVertices': int(((factor >= 1-1e-9) & changed).sum()),
                    'lowestSourceSurfaceY': low, 'rigidBandAboveLowestM': .06,
                    'smoothTaperEndAboveLowestM': .16, 'candidateRadiusM': .65,
                    'candidateAboveTerminalM': .14, 'terminalJoint': leg+'.hoof'})
        ids = np.argsort(collapsed, axis=1)[:, -4:][:, ::-1]
        weight = np.take_along_axis(collapsed, ids, axis=1)
        weight /= weight.sum(1)[:, None]
        attributes['JOINTS_0'] = writer.acc(ids, 'VEC4', 5123)
        attributes['WEIGHTS_0'] = writer.acc(weight, 'VEC4')
        newp = {**{k: v for k, v in p.items() if k not in ['attributes', 'indices']}, 'attributes': attributes}
        if 'indices' in p:
            newp['indices'] = writer.acc(accessor(d, b, p['indices']), 'SCALAR', d['accessors'][p['indices']]['componentType'])
        mesh_name = ['DragonEyes', 'DragonWingMembrane', 'HorseBody'][mi]
        out['meshes'].append({'name': mesh_name, 'primitives': [newp]})
        out['nodes'].append({'name': mesh_name, 'mesh': mi, 'skin': 0})
        out['scenes'][0]['nodes'].append(len(out['nodes'])-1)
        validation.append({'mesh': mesh_name, 'vertices': len(point),
                           'triangles': len(accessor(d, b, p['indices']))//3,
                           'maxWeightError': float(abs(weight.sum(1)-1).max()),
                           'maxInfluences': int((weight > 1e-7).sum(1).max()), 'finite': bool(np.isfinite(point).all())})
        if mi == 2:
            body_hash = hashlib.sha256(point.astype('<f4').tobytes()).hexdigest()
    saddle_z = -.85
    seat_points = body[(abs(body[:, 0]) < .38) & (abs(body[:, 2]-saddle_z) < .25) & (torso_ownership > .6)]
    # Place the saddle on the actual central torso surface. A vertex-only strip
    # misses this sparse curved surface; intersect the source torso triangles.
    torso_primitive = d['meshes'][3]['primitives'][0]
    seat_surface = []
    for tri in accessor(d, b, torso_primitive['indices']).reshape(-1, 3):
        if min(torso_ownership[tri]) < .8:
            continue
        points = body[tri]; xz = points[:, [0, 2]]
        plane = np.column_stack([xz[1]-xz[0], xz[2]-xz[0]])
        if abs(np.linalg.det(plane)) < 1e-8:
            continue
        uv = np.linalg.solve(plane, np.array([0, saddle_z])-xz[0])
        barycentric = np.array([1-uv.sum(), *uv])
        if min(barycentric) >= -1e-5:
            seat_surface.append(float(barycentric@points[:, 1]))
    if not seat_surface:
        raise ValueError('Dragon central saddle surface unavailable')
    seat_y = max(seat_surface)+.025/scale
    anchors = {'saddle': [normalized([0, seat_y, saddle_z]).tolist()],
               'withers': [normalized([0, withers_source, .45]).tolist()],
               'head': [at(40).tolist()], 'poll': [normalized([0, 5.1, 2.4]).tolist()],
               'muzzle': [normalized([0, 4.73, 3.4]).tolist()],
               'crest': [normalized([0, 4.0, 1.7]).tolist()], 'tail': [at(14).tolist()],
               'eyes': [at(56).tolist(), at(63).tolist()], 'nostrils': [at(86).tolist(), at(88).tolist()]}
    stirrup_fit = measure_stirrup_clearance(normalized(body), torso_ownership,
        accessor(d, b, torso_primitive['indices']), anchors['saddle'][0])
    anchors['stirrups'] = stirrup_fit['stirrupAnchors']
    extras = copy.deepcopy(d['asset'].get('extras', {}))
    extras.update({'derivedBy': 'Meadowlark Ranch', 'conversion': 'exact source glTF scene skin bake;40 anatomical joints plus source wing branches',
                   'sourceSha256': EXPECTED, 'noAI': True, 'generativeToolsUsed': False})
    out['asset']['extras'] = extras
    out['extras'] = {'dragonRig': {'version': 1, 'wings': wing_profile, 'canonicalCoreJoints': 40,
                                  'sourcePose': 'original glTF default scene skin semantics; not native Blender import',
                                  'fold': {'webScale': 1, 'shoulder': 2.1160317121915955, 'elbow': 2.5878754825035997,
                                           'wrist': 1.237091709814144, 'shoulderRoll': -.7, 'elbowRoll': .14390268481728435,
                                           'wristRoll': .32970605418991084, 'shoulderPitch': -.15316450394461312,
                                           'elbowPitch': .36459493044733066, 'wristPitch': -.5432451953405588}}}
    game = BASE / 'game'; sha = writer.save(game/'dragon.glb')
    height = float((source_high[1]-ground)*scale)
    profile = {'id': 'black-dragon', 'name': 'Black Dragon', 'label': 'Black Dragon', 'file': 'dragon.glb',
               'artistBreed': True, 'bodyMesh': 'HorseBody', 'withersM': withers, 'heightM': height,
               'fitScale': 1, 'fitY': 0, 'physicalScale': True,
               'normalization': 'Torso-owned withers measured excluding wing fingers and horns; original glTF scene pose uniformly normalized to1.85m withers and groundY0', 'anchors': anchors, 'family': 'fantasy',
               'sourceBasis': 'Actual3DHaupt dragon, CC BY-NC4.0 + NoAI, source pose baked before anatomical rig adaptation',
               'sourceCandidateId': 'black-dragon', 'sourceSha256': EXPECTED, 'creator': '3DHaupt',
               'license': 'CC BY-NC4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-nc/4.0/',
               'sourceUrl': 'https://sketchfab.com/3d-models/black-dragon-with-idle-animation-fb0053a2e59b43868e934c239bf4eb36',
               'noAI': True, 'generativeToolsUsed': False, 'motionKind': 'dragon',
               'contactEnvelope': {'radiusM': .65, 'aboveTerminalM': .14, 'bottomBandM': .009,
                                   'sampleAllCandidates': True, 'skinnedCorrection': True}, 'dragonRig': out['extras']['dragonRig'],
               'nativeWings': True, 'nativeDragonBody': True, 'preserveSaddleAnchor': True,
               'preserveSourceGroom': True, 'jointCount': len(positions), 'sha256': sha,
               'bodyGeometrySha256': body_hash, 'clawWeightAdaptation': claw_weight_adaptation,
               'stirrupFitValidation': 'stirrup-fit.json', 'clips': [], 'validation': validation}
    report = {'schemaVersion': 1, 'sourceSha256': EXPECTED, 'gameSha256': sha,
              'sourcePoseBounds': {'min': source_low.tolist(), 'max': source_high.tolist(), 'size': (source_high-source_low).tolist()},
              'sourcePoseMatchesIndependentThreeBounds': True, 'coordinateSystem': '+Z forward,+Y up,metres',
              'scale': scale, 'groundOffset': offset.tolist(), 'withersSource': withers_source,
              'withersM': withers, 'heightM': height, 'coreJointCount': 40, 'jointCount': len(positions),
              'saddleSurface': {'method': 'central torso vertical triangle intersection', 'surfaceY': float((max(seat_surface)-ground)*scale), 'clearanceM': .025},
              'stirrupSurface': stirrup_fit,
              'removedGeometry': {'name': 'Plane_Material_0', 'triangles': 12, 'reason': 'decorative source showcase floor'},
              'preservedSourceTriangleCount': sum(a['triangles'] for a in validation),
              'materialDefinitionsPreserved': True, 'materialCount': len(out['materials']), 'images': image_report,
              'sourceUVsAndTopologyPreserved': True, 'sourceSkinOwnershipCollapsedByAnatomy': True,
              'sourceWingOwnershipPreserved': True,
              'derivedClawWeightAdaptation': {'method': 'Lowest anatomical claw/palm fully follows terminal hoof; quintic taper preserves higher hand/ankle source blend; rest geometry unchanged', 'limbs': claw_weight_adaptation},
              'contactEnvelope': profile['contactEnvelope'],
              'contactMeasurement': 'Actual broad claw skin samples, default sole marker retained; opt-in post-skin target lift and anatomical resolve', 'animations': 'Source Scene removed after pose bake; independent full game motions provided by dragon adapter',
              'originalSourcePreserved': hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED,
              'originalReceiptPreserved': (SOURCE.parent/'receipt.json').read_bytes() == receipt_bytes,
              'validation': validation, 'runtimeVisualReview': 'pending', 'gameIntegration': 'pending',
              'license': 'CC BY-NC4.0', 'creator': '3DHaupt', 'noAI': True, 'generativeToolsUsed': False}
    stirrup_fit.update({'gameSha256': sha, 'sourceSha256': EXPECTED,
                        'noAI': True, 'generativeToolsUsed': False})
    for name, value in [('profile.json', profile), ('conversion.json', report), ('stirrup-fit.json', stirrup_fit)]:
        (game/name).write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'path': str(game/'dragon.glb'), 'sha256': sha, 'joints': len(positions), 'withersM': withers,
                      'heightM': height, 'triangles': report['preservedSourceTriangleCount']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--texture-size', type=int, default=2048)
    args = parser.parse_args()
    if args.texture_size not in [1024, 2048, 4096, 8192]:
        raise ValueError('Texture size must be1024,2048,4096 or8192')
    convert(args.texture_size)
