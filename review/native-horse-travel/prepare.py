"""Measure the frozen white native horse's actual sole and Western-tack contacts.

Read-only inputs: review/target-native-walk/model.glb and existing source-tack
evidence. Outputs stay in output/native-horse-travel. The game-space frame is
+Y up, +Z forward, floor zero, and the original saddle seat at Z zero.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
MODEL = ROOT / 'review/target-native-walk/model.glb'
BUILD = ROOT / 'review/target-native-walk/build-report.json'
TACK = ROOT / 'assets/models/horse-imports/wildmesh-white-western/game/source-tack-anchor-report.json'

spec = importlib.util.spec_from_file_location('horse_glb', ROOT / 'tools/asset-gen/rig_hero_horse.py')
horse_glb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(horse_glb)


def components(index, count):
    parent = np.arange(count)

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for tri in index.reshape(-1, 3):
        a = find(int(tri[0]))
        for j in tri[1:]:
            parent[find(int(j))] = a
    groups = {}
    for i in range(count):
        groups.setdefault(find(i), []).append(i)
    return [np.asarray(v, dtype=int) for v in groups.values()]


def skin_points(document, binary, world, mesh_index):
    node = next((n for n in document['nodes'] if n.get('mesh') == mesh_index))
    primitive = document['meshes'][mesh_index]['primitives'][0]
    attr = primitive['attributes']
    position = horse_glb.accessor(document, binary, attr['POSITION'])
    joint_index = horse_glb.accessor(document, binary, attr['JOINTS_0']).astype(int)
    weights = horse_glb.accessor(document, binary, attr['WEIGHTS_0'])
    skin = document['skins'][node['skin']]
    inverse = horse_glb.accessor(document, binary, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    operators = np.asarray([world[i] for i in skin['joints']]) @ inverse
    homogeneous = np.c_[position, np.ones(len(position))]
    points = np.sum(np.einsum('ncij,nj->nci', operators[joint_index], homogeneous) * weights[:, :, None], axis=1)[:, :3]
    indices = horse_glb.accessor(document, binary, primitive['indices']).reshape(-1)
    return points, indices, joint_index, weights, skin


document, binary = horse_glb.read_glb(MODEL)
world, parents = horse_glb.node_worlds(document)
build = json.loads(BUILD.read_text())
tack_evidence = json.loads(TACK.read_text())
assert hashlib.sha256(MODEL.read_bytes()).hexdigest() == 'dcec158d30a7bab814b4aaaeeb07dff95fc54d4dbe71db704858928fe2c904ec'
assert len(document['skins'][0]['joints']) == 677
assert any(a['name'] == 'Target Native Walk' for a in document['animations'])

tack_points, tack_indices, tack_joints, tack_weights, skin = skin_points(document, binary, world, 3)
pieces = components(tack_indices, len(tack_points))
assert len(pieces) == 300
known = {x['indexedComponent']: x for x in tack_evidence['components']}
contacts = {}
for component_id, label in [(91, 'leftStirrupTread'), (89, 'rightStirrupTread'), (209, 'leftBitRing'), (205, 'rightBitRing')]:
    ids = pieces[component_id]
    evidence = known[component_id]
    assert len(ids) == evidence['vertexCount'], (label, len(ids))
    points = tack_points[ids]
    low, high = points.min(axis=0), points.max(axis=0)
    middle = (low + high) / 2
    if 'Stirrup' in label:
        middle[1] = high[1]  # the boot stands on the upper tread surface
    contacts[label] = {'mesh': document['meshes'][3]['name'], 'component': component_id,
                       'vertexCount': len(ids), 'vertexIds': ids.tolist(),
                       'sourceMin': low.tolist(), 'sourceMax': high.tolist(),
                       'sourcePoint': middle.tolist(), 'canonicalPoint': evidence['point']}

# The near-saddle *inner* rein pieces are original, skinned tack vertices. Keep
# the actual IDs as bounded grip candidates for the rider-fit study. They are
# deliberately separate from the bit rings, which are too far ahead for hands.
joint_names = {document['nodes'][index].get('name'): j for j, index in enumerate(skin['joints'])}
rein_grips = {}
for side, bone_name, xlo, xhi in [('right', 'reins_01_inner_l_0339', .04, .11),
                                  ('left', 'reins_01_inner_r_0328', -.09, -.035)]:
    joint = joint_names[bone_name]
    ownership = np.sum(tack_weights * (tack_joints == joint), axis=1)
    z_reference = np.mean([c['sourcePoint'][2] - c['canonicalPoint'][2] for c in contacts.values()])
    game_points = tack_points + np.array([0., -float(build['floorY']), -z_reference])
    selected = np.where((ownership > .60) & (game_points[:, 0] > xlo) & (game_points[:, 0] < xhi) &
                        (game_points[:, 1] > 1.838) & (game_points[:, 2] > .19) & (game_points[:, 2] < .27))[0]
    assert len(selected) >= 4, (side, len(selected))
    rein_grips[side] = {'mesh': document['meshes'][3]['name'], 'bone': bone_name,
                        'vertexIds': selected.tolist(), 'vertexCount': len(selected),
                        'meanSkinOwnership': float(ownership[selected].mean()),
                        'sourcePoint': tack_points[selected].mean(axis=0).tolist()}

# The old game profile was built from this exact topology but moved its floor
# and placed the saddle at Z=0. Match the four *real* tack components to derive
# that translation, rather than guessing from a skeleton bone or bounding box.
offsets = np.asarray([np.asarray(c['sourcePoint']) - np.asarray(c['canonicalPoint']) for c in contacts.values()])
offset = offsets.mean(axis=0)
assert np.max(np.abs(offsets - offset)) < .002, offsets
floor = float(build['floorY'])
assert abs(offset[1] - floor) < .002, (offset, floor)
canonical_seat = np.asarray(tack_evidence['sourceTackAnchors']['saddleSeat'], dtype=float)
source_seat = canonical_seat + offset
normalizer = np.array([-source_seat[0], -floor, -source_seat[2]])
for contact in contacts.values():
    contact['gamePoint'] = (np.asarray(contact['sourcePoint']) + normalizer).tolist()
for contact in rein_grips.values():
    contact['gamePoint'] = (np.asarray(contact['sourcePoint']) + normalizer).tolist()

body_points, _, _, _, _ = skin_points(document, binary, world, 0)
named = {node.get('name'): i for i, node in enumerate(document['nodes']) if node.get('name')}
bone_positions = {name: world[named[name]][:3, 3].tolist() for name in
                  ['saddle_0333', 'stirrup_02_l_0335', 'stirrup_02_r_0343', 'head_019', 'tail_01_0367']}
assert bone_positions['head_019'][2] > source_seat[2] > bone_positions['tail_01_0367'][2]

report = {
    'model': str(MODEL.relative_to(ROOT)), 'sha256': hashlib.sha256(MODEL.read_bytes()).hexdigest(),
    'sourceTackEvidence': str(TACK.relative_to(ROOT)),
    'rigJoints': 677, 'forward': '+Z', 'up': '+Y',
    'sourceFloorY': floor, 'sourceSeat': source_seat.tolist(),
    'canonicalSeat': canonical_seat.tolist(), 'sourceToGameTranslation': normalizer.tolist(),
    'tackComponentOffsetResidualM': float(np.max(np.abs(offsets - offset))),
    'nativeBonesSource': bone_positions,
    'contacts': contacts,
    'reinGripStudy': rein_grips,
    'trunkVertex1998Game': (body_points[1998] + normalizer).tolist(),
    'soleMasks': {k: {'vertexIds': value['vertices'], 'stancePhaseOffset': value['offset'],
                      'restCentroidGame': (np.asarray(value['restCentroid']) + normalizer).tolist()}
                  for k, value in build['footMasks'].items()},
    'walk': {'clip': 'Target Native Walk', 'durationS': build['duration'],
             'stanceFraction': build['stanceFraction'], 'strideM': 2 * build['strideHalfM'],
             'nominalSpeedMps': 2 * build['strideHalfM'] / (build['stanceFraction'] * build['duration'])},
    'note': 'A static geometric registration and travel harness input, not mounted rider IK approval.'
}
assert abs(report['walk']['nominalSpeedMps'] - .5494505494505494) < 1e-9
OUT.mkdir(exist_ok=True)
(OUT / 'anchors.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['sourceFloorY', 'sourceSeat', 'sourceToGameTranslation', 'tackComponentOffsetResidualM', 'walk']}, indent=2))
