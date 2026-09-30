"""Classify connected Western-tack parts without changing the source GLB."""
from pathlib import Path
import importlib.util
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'output/native-rider-reins-review-qa'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('horse_glb', ROOT / 'tools/asset-gen/rig_hero_horse.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
doc, blob = g.read_glb(ROOT / 'review/native-horse-kit/model.glb')
world, _ = g.node_worlds(doc)
node = next(n for n in doc['nodes'] if n.get('mesh') == 3)
prim = doc['meshes'][3]['primitives'][0]
pos = g.accessor(doc, blob, prim['attributes']['POSITION'])
joint = g.accessor(doc, blob, prim['attributes']['JOINTS_0']).astype(int)
weight = g.accessor(doc, blob, prim['attributes']['WEIGHTS_0'])
tri = g.accessor(doc, blob, prim['indices']).reshape(-1, 3).astype(int)
skin = doc['skins'][node['skin']]
inv = g.accessor(doc, blob, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
operators = np.asarray([world[i] for i in skin['joints']]) @ inv
points = np.sum(np.einsum('ncij,nj->nci', operators[joint], np.c_[pos, np.ones(len(pos))]) * weight[:, :, None], axis=1)[:, :3]
normalizer = np.asarray(json.loads((HERE / 'anchors.json').read_text())['sourceToGameTranslation'])
points += normalizer
names = [doc['nodes'][i].get('name', '') for i in skin['joints']]
rein = np.asarray([x.startswith('reins_') for x in names])

parent = np.arange(len(pos))
def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i
for a, b, c in tri:
    parent[find(int(b))] = find(int(a))
    parent[find(int(c))] = find(int(a))
groups = {}
for i in range(len(pos)):
    groups.setdefault(find(i), []).append(i)
groups = [np.asarray(v) for v in groups.values()]
assert len(groups) == 300
cid = np.zeros(len(pos), dtype=int)
for i, ids in enumerate(groups):
    cid[ids] = i
tri_cid = cid[tri[:, 0]]
assert np.all(cid[tri] == tri_cid[:, None])
report = {'sourceMesh': doc['meshes'][3]['name'], 'vertexCount': len(pos), 'triangleCount': len(tri), 'componentCount': len(groups), 'components': []}
for i, ids in enumerate(groups):
    pts = points[ids]
    ownership = np.sum(weight[ids] * rein[joint[ids]], axis=1)
    influences = {}
    for js, ws in zip(joint[ids], weight[ids]):
        for j, w in zip(js, ws):
            influences[names[j]] = influences.get(names[j], 0.) + float(w)
    influences = sorted(influences.items(), key=lambda x: -x[1])[:5]
    component_tri = tri[tri_cid == i]
    lengths = np.concatenate([np.linalg.norm(points[component_tri[:, k]] - points[component_tri[:, (k+1)%3]], axis=1) for k in range(3)])
    pairs = np.linalg.norm(pts[::2] - pts[1::2], axis=1) if len(ids)%2 == 0 else np.asarray([])
    report['components'].append({'id': i, 'vertexCount': len(ids), 'triangleCount': int(np.sum(tri_cid == i)), 'firstVertexId': int(ids[0]), 'lastVertexId': int(ids[-1]), 'meanReinOwnership': float(ownership.mean()), 'maxReinOwnership': float(ownership.max()), 'min': pts.min(axis=0).tolist(), 'max': pts.max(axis=0).tolist(), 'mean': pts.mean(axis=0).tolist(), 'triangleEdgeQuantilesM': np.quantile(lengths,[.1,.25,.5,.75,.9]).tolist(), 'pairWidthQuantilesM': np.quantile(pairs,[.05,.5,.95]).tolist() if len(pairs) else None, 'topInfluences': [{'bone': k, 'meanWeight': v / len(ids)} for k, v in influences]})
(OUT / 'component-report.json').write_text(json.dumps(report, indent=2) + '\n')
for c in report['components']:
    if c['meanReinOwnership'] > .03:
        print(c['id'], c['vertexCount'], c['triangleCount'], 'rein=', round(c['meanReinOwnership'], 3), 'min=', np.round(c['min'], 3), 'max=', np.round(c['max'], 3), 'bone=', c['topInfluences'][0]['bone'])
