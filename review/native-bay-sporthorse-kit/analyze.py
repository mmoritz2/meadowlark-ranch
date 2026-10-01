"""Measure Bay Sporthorse tack contacts against its immutable native rest pose.

This keeps the verified White tack component IDs but recomputes every point
from the Sporthorse skin, bind matrices, and actual rest joint transforms.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WHITE = ROOT / 'review/native-horse-kit/model.glb'
SPORT = ROOT / 'review/native-breed-targets/bay-sporthorse/rest.glb'
ANCHORS = json.loads((ROOT / 'review/native-rider-reins/anchors.json').read_text())
spec = importlib.util.spec_from_file_location('horse_glb', ROOT / 'tools/asset-gen/rig_hero_horse.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

def cloud(doc, blob, world, mesh_index):
    node = next(n for n in doc['nodes'] if n.get('mesh') == mesh_index)
    attrs = doc['meshes'][mesh_index]['primitives'][0]['attributes']
    pos = g.accessor(doc, blob, attrs['POSITION']).astype(float)
    joints = g.accessor(doc, blob, attrs['JOINTS_0']).astype(int)
    weights = g.accessor(doc, blob, attrs['WEIGHTS_0']).astype(float)
    skin = doc['skins'][node['skin']]
    inverse = g.accessor(doc, blob, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    operators = np.asarray([world[i] for i in skin['joints']]) @ inverse
    points = np.sum(np.einsum('ncij,nj->nci', operators[joints], np.c_[pos, np.ones(len(pos))]) * weights[:, :, None], axis=1)[:, :3]
    indices = g.accessor(doc, blob, doc['meshes'][mesh_index]['primitives'][0]['indices']).reshape(-1).astype(int)
    return points, indices, joints, weights

def component_ids(index, count):
    parent = np.arange(count)
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for a, b, c in index.reshape(-1, 3):
        r = root(a)
        parent[root(b)] = r
        parent[root(c)] = r
    groups = {}
    for i in range(count):
        groups.setdefault(root(i), []).append(i)
    return [np.asarray(ids, dtype=int) for ids in groups.values()]

white, wb = g.read_glb(WHITE)
sport, sb = g.read_glb(SPORT)
ww, _ = g.node_worlds(white)
sw, _ = g.node_worlds(sport)
names = {n.get('name'): i for i, n in enumerate(white['nodes']) if n.get('name')}
assert len(sport['nodes']) == len(white['nodes']) + 1
assert all(white['nodes'][i].get('name') == sport['nodes'][i].get('name') for i in range(len(white['nodes'])))
assert white['skins'][0]['joints'] == sport['skins'][0]['joints']
assert len(sport['skins'][0]['joints']) == 677 and len(sport['meshes']) == 5
mesh_summary = {}
for i in range(5):
    wp, wi, wj, wt = cloud(white, wb, ww, i)
    sp, si, sj, st = cloud(sport, sb, sw, i)
    assert np.array_equal(wi, si) and np.array_equal(wj, sj) and np.array_equal(wt, st)
    mesh_summary[str(i)] = {'vertices': len(sp), 'triangles': len(si) // 3, 'indicesAndSkinOwnershipMatchWhite': True}
    if i == 0: body = sp
    if i == 3: tack, tack_index = sp, si
    if i == 4: saddle = sp

pieces = component_ids(tack_index, len(tack))
assert len(pieces) == 300
for label, c in ANCHORS['contacts'].items():
    assert np.array_equal(pieces[c['component']], np.asarray(c['vertexIds'], dtype=int)), label

# A local point on the actual source saddle follows the new breed's saddle,
# rather than copying a game-space White seat position.
white_seat = np.asarray(ANCHORS['sourceSeat'], dtype=float)
seat_local = np.linalg.solve(ww[names['saddle_0333']], np.r_[white_seat, 1.])
sport_seat = (sw[names['saddle_0333']] @ seat_local)[:3]
floor = float(body[:, 1].min())
translation = np.array([-sport_seat[0], -floor, -sport_seat[2]])
closest_white_saddle = np.argsort(np.linalg.norm(cloud(white, wb, ww, 4)[0] - white_seat, axis=1))[:24]
seat_crosscheck = {
    'sameNearestSaddleVertexIdsAsWhite': closest_white_saddle.tolist(),
    'nearestSporthorseSaddleVertexDistanceM': float(np.linalg.norm(saddle[closest_white_saddle[0]] - sport_seat)),
    'sporthorseSeatMinusNearbySaddleMeanM': (sport_seat - saddle[closest_white_saddle].mean(axis=0)).tolist(),
}

def box(points):
    return {'min': points.min(axis=0).tolist(), 'max': points.max(axis=0).tolist()}

contact_report = {}
anchor_contacts = {}
for label, original in ANCHORS['contacts'].items():
    pts = tack[pieces[original['component']]]
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    point = (lo + hi) / 2
    if 'Stirrup' in label:
        point[1] = hi[1]
    target = dict(original)
    target.update(sourceMin=lo.tolist(), sourceMax=hi.tolist(), sourcePoint=point.tolist(),
                  gamePoint=(point + translation).tolist())
    target.pop('canonicalPoint', None)
    anchor_contacts[label] = target
    contact_report[label] = {'component': original['component'], 'vertices': len(pts),
                             'sourceBoundsM': box(pts), 'sourcePointM': point.tolist(),
                             'gamePointM': (point + translation).tolist()}

rein_grip = {}
for side, original in ANCHORS['reinGripStudy'].items():
    point = tack[original['vertexIds']].mean(axis=0)
    rein_grip[side] = dict(original, sourcePoint=point.tolist(), gamePoint=(point + translation).tolist())

guides = {}
for side, component in [('left', 72), ('right', 141)]:
    ids = pieces[component]
    assert len(ids) == 56
    centers = (tack[ids[::2]] + tack[ids[1::2]]) / 2 + translation
    guides[side] = {'component': component, 'widthMedianM': float(np.median(np.linalg.norm(tack[ids[::2]] - tack[ids[1::2]], axis=1))),
                    'centersGameM': {str(i): centers[i].tolist() for i in [0, 6, 15, 24, 27]},
                    'boundsGameM': box(tack[ids] + translation)}

bones = {}
for name in ['saddle_0333', 'stirrup_02_l_0335', 'stirrup_02_r_0343', 'reins_01_l_0338',
             'reins_01_r_0346', 'neck_01_014', 'neck_02_015', 'neck_03_016', 'head_019']:
    bones[name] = {'node': names[name], 'gamePointM': (sw[names[name]][:3, 3] + translation).tolist()}

sport_anchors = dict(ANCHORS)
sport_anchors.update(model='review/native-bay-sporthorse-kit/model.glb',
                     sourceFloorY=floor, sourceSeat=sport_seat.tolist(),
                     canonicalSeat=(sport_seat + translation).tolist(),
                     sourceToGameTranslation=translation.tolist(),
                     contacts=anchor_contacts, reinGripStudy=rein_grip,
                     trunkVertex1998Game=(body[1998] + translation).tolist(),
                     note='Private Sporthorse mounted review. Gait source arrays and tack are unchanged.')
gaits = json.loads((HERE / 'preservation.json').read_text())['gaits']
sport_anchors['gaits'] = gaits
walk_masks = json.loads((ROOT / 'review/native-bay-sporthorse-walk/build-report.json').read_text())['footMasks']
sport_anchors['soleMasks'] = {name: {
    'vertexIds': mask['vertices'], 'wholeVertexIds': mask['wholeVertices'],
    'heelVertexIds': mask['heelVertices'], 'toeVertexIds': mask['toeVertices'],
    'stancePhaseOffset': mask['offset'], 'restCentroidGame': mask['restCentroid'],
} for name, mask in walk_masks.items()}
sport_anchors['walk'] = {'clip': gaits['walk']['clip'], 'durationS': gaits['walk']['durationS'],
                         'stanceFraction': gaits['walk']['stanceFraction'],
                         'strideM': gaits['walk']['strokeM'], 'nominalSpeedMps': gaits['walk']['nominalSpeedMps']}
for stale in ['rolloverSource', 'priorWalkSha256', 'initialCheckedKitSha256', 'modelHashMeaning']:
    sport_anchors.pop(stale, None)
sport_anchors['combinedKitSha256'] = hashlib.sha256((HERE / 'model.glb').read_bytes()).hexdigest()
sport_anchors['nativeBonesSource']={name:sw[names[name]][:3,3].tolist() for name in ANCHORS['nativeBonesSource']}
sport_anchors.pop('tackComponentOffsetResidualM',None)
sport_anchors['sourceRestSha256'] = hashlib.sha256(SPORT.read_bytes()).hexdigest()

report = {'status': 'Static Sporthorse tack/seat prerequisite; mounted gait quality pending browser QA',
          'restSha256': sport_anchors['sourceRestSha256'], 'kitSha256': sport_anchors['combinedKitSha256'],
          'referenceWhiteKitSha256':hashlib.sha256(WHITE.read_bytes()).hexdigest(),'jointCount': 677, 'meshTopology': mesh_summary, 'tackComponents': 300,
          'sourceFloorY': floor, 'sourceToGameTranslationM': translation.tolist(),
          'sourceSeatM': sport_seat.tolist(), 'gameSeatM': (sport_seat + translation).tolist(),
          'seatLocalRelativeToNativeSaddle': seat_local.tolist(), 'seatSaddleSurfaceCrosscheck': seat_crosscheck,
          'trunkVertex1998GameM': (body[1998] + translation).tolist(),
          'contacts': contact_report, 'nearSaddleOriginalReinGrips': {s: {'gamePointM': r['gamePoint']} for s,r in rein_grip.items()},
          'originalOutsideNeckGuides': guides, 'bones': bones,
          'hiddenDisplayReinComponents': [57,58,59,60,61,62,72,73,74,75,103,104,141,142,143,153,163,164,244,245,254,255,278,283],
          'protectedBitAndTreadComponents': [89,91,205,209], 'bodyBoundsSourceM': box(body)}
(HERE / 'anchors.json').write_text(json.dumps(sport_anchors, indent=2) + '\n')
(HERE / 'actual-coordinates.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'restSha256': report['restSha256'], 'kitSha256': report['kitSha256'],
                  'sourceSeatM': report['sourceSeatM'], 'gameSeatM': report['gameSeatM'],
                  'sourceToGameTranslationM': report['sourceToGameTranslationM'],
                  'contactsGameM': {k: v['gamePointM'] for k,v in contact_report.items()},
                  'originalGripGameM': {k: v['gamePointM'] for k,v in report['nearSaddleOriginalReinGrips'].items()},
                  'allTopologyMatched': True}, indent=2))
