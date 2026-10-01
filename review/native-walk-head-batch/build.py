"""Bounded neck/head-only Walk extensions. No source, limb or game edits."""
from pathlib import Path
import copy, hashlib, json, sys
import numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.optimize import brentq

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools/asset-gen'))
import rig_hero_horse as g
CONFIG = json.loads((HERE / 'config.json').read_text())
WHITE = ROOT / 'review/native-horse-kit/model.glb'
WHITE_SHA = 'fa797ad07137af09b1824cabe8737a530206804fcee2ab3a526ac12be1f08fc1'
FRACTIONS = [('neck_01_014', .45), ('neck_02_015', .60), ('neck_03_016', .75),
             ('neck_04_017', .90), ('neck_05_018', 1.), ('head_019', .85)]
FEET = {'FL': 'fingers_02_l_0208', 'FR': 'fingers_02_r_0274',
        'HL': 'toes_02_l_0409', 'HR': 'toes_02_r_0478'}
OFFSETS = {'HL': 0., 'FL': .25, 'HR': .5, 'FR': .75}

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def rotation(m):
    u, _, v = np.linalg.svd(m[:3, :3])
    return R.from_matrix(u @ v)

def body_rest(d, b, worlds):
    found = []
    for node in d['nodes']:
        if 'mesh' not in node or 'skin' not in node: continue
        for prim in d['meshes'][node['mesh']]['primitives']:
            a = prim['attributes']
            p = g.accessor(d, b, a['POSITION'])
            if len(p) != 16159: continue
            skin = d['skins'][node['skin']]
            assert len(skin['joints']) == 677
            bind = g.accessor(d, b, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
            mats = np.stack([worlds[i] for i in skin['joints']]) @ bind
            j = g.accessor(d, b, a['JOINTS_0']).astype(int)
            w = g.accessor(d, b, a['WEIGHTS_0'])
            out = np.zeros((len(p), 4)); ph = np.c_[p, np.ones(len(p))]
            for c in range(4): out += np.einsum('nij,nj->ni', mats[j[:, c]], ph) * w[:, c, None]
            found.append(out[:, :3])
    assert len(found) == 1
    return found[0]

assert digest(WHITE) == WHITE_SHA
wd, wb = g.read_glb(WHITE); ww, _ = g.node_worlds(wd)
wn = {n.get('name'): i for i, n in enumerate(wd['nodes'])}
white_floor = float(body_rest(wd, wb, ww)[:, 1].min())
white_height = float(ww[wn['spine_04_012']][1, 3] - white_floor)

def build(key):
    config = CONFIG[key]; source = ROOT / config['source']
    assert digest(source) == config['sourceSha256']
    report_dir = HERE / key; report_dir.mkdir(exist_ok=True)
    out = ROOT / 'output/native-walk-head-batch' / key; out.mkdir(parents=True, exist_ok=True)
    d, db = g.read_glb(source); original = copy.deepcopy(d); prefix = bytes(db)
    rw, parent = g.node_worlds(d); names = {n.get('name'): i for i, n in enumerate(d['nodes'])}
    rest_rotation = {i: rotation(w) for i, w in rw.items()}
    head, trunk = names['head_019'], names['spine_04_012']
    selected = {names[n]: f for n, f in FRACTIONS}
    rest_points = body_rest(d, db, rw); floor = float(rest_points[:, 1].min())
    height = float(rw[trunk][1, 3] - floor); ratio = height / white_height
    amplitude = .035 * ratio
    clip = next(a for a in d['animations'] if a['name'] == 'Target Native Walk Rollover')
    channels = {c['target']['node']: c for c in clip['channels'] if c['target']['path'] == 'rotation'}
    times = g.accessor(d, db, clip['samplers'][channels[head]['sampler']]['input']).reshape(-1)
    N = len(times) - 1; D = float(times[-1]); assert N == 128
    track_arrays = []
    for c in clip['channels']:
        s = clip['samplers'][c['sampler']]
        assert np.array_equal(g.accessor(d, db, s['input']).reshape(-1), times) and s['interpolation'] == 'CUBICSPLINE'
        value = g.accessor(d, db, s['output']).reshape(len(times), 3, -1)[:, 1, :]
        track_arrays.append((c['target']['node'], c['target']['path'], value))

    def local_at(j):
        q = {i: R.from_quat(n.get('rotation', [0, 0, 0, 1])) for i, n in enumerate(d['nodes'])}
        t = {i: np.array(n.get('translation', [0, 0, 0]), float) for i, n in enumerate(d['nodes'])}
        s = {i: np.array(n.get('scale', [1, 1, 1]), float) for i, n in enumerate(d['nodes'])}
        for i, path, a in track_arrays:
            if path == 'rotation': q[i] = R.from_quat(a[j])
            elif path == 'translation': t[i] = a[j].copy()
            elif path == 'scale': s[i] = a[j].copy()
        return q, t, s

    def world_at(q, t, s):
        cache = {}
        def world(i):
            if i in cache: return cache[i]
            if 'matrix' in d['nodes'][i]: m = g.local_matrix(d['nodes'][i])
            else:
                m = np.eye(4); m[:3, :3] = q[i].as_matrix() * s[i][None, :]; m[:3, 3] = t[i]
            cache[i] = (world(parent[i]) if i in parent else np.eye(4)) @ m
            return cache[i]
        return world

    old = []
    for j in range(N):
        q, t, s = local_at(j); world = world_at(q, t, s)
        old.append({'phase': float(times[j] / D), 'headY': float(world(head)[1, 3]), 'trunkY': float(world(trunk)[1, 3])})
    y = np.array([r['trunkY'] for r in old]); angles = 4 * np.pi * np.arange(N) / N
    c, sn = 2 / N * np.sum((y - y.mean()) * np.cos(angles)), 2 / N * np.sum((y - y.mean()) * np.sin(angles))
    trunk_phase = float(np.arctan2(-sn, c)); mean_head = float(np.mean([r['headY'] for r in old]))
    values = {i: [] for i in selected}; solves = []
    for j in range(N):
        phase = float(times[j] / D); q, t, s = local_at(j); base_q = q.copy()
        target_y = mean_head + amplitude * np.cos(4 * np.pi * phase + trunk_phase + np.pi)
        def trial(degrees):
            q = base_q.copy()
            for i, fraction in selected.items():
                world = world_at(q, t, s)
                q[i] = rotation(world(parent[i])).inv() * R.from_rotvec([np.deg2rad(degrees * fraction), 0, 0]) * rest_rotation[i]
            return q, world_at(q, t, s)(head)[1, 3]
        angle = brentq(lambda a: trial(a)[1] - target_y, -12, 12, xtol=1e-10)
        new_q, actual_y = trial(angle)
        for i in selected: values[i].append(new_q[i].as_quat())
        solves.append({'phase': phase, 'neckCommonPitchDegrees': angle, 'targetHeadY': float(target_y), 'actualHeadY': float(actual_y)})

    def append(a):
        a = np.asarray(a, dtype='<f4'); db.extend(b'\0' * ((-len(db)) % 4))
        view = len(d['bufferViews']); d['bufferViews'].append({'buffer': 0, 'byteOffset': len(db), 'byteLength': a.nbytes}); db.extend(a.tobytes())
        acc = len(d['accessors']); d['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(a), 'type': 'VEC4'})
        return acc
    changed = []
    for i, x in values.items():
        x = np.asarray(x); x /= np.linalg.norm(x, axis=1)[:, None]
        for j in range(1, N):
            if x[j - 1] @ x[j] < 0: x[j] *= -1
        tangent = (np.roll(x, -1, axis=0) - np.roll(x, 1, axis=0)) / (2 * D / N)
        tangent -= x * np.sum(x * tangent, axis=1)[:, None]
        v, tt = np.vstack([x, x[0]]), np.vstack([tangent, tangent[0]])
        sampler = clip['samplers'][channels[i]['sampler']]; old_output = sampler['output']
        sampler['output'] = append(np.stack([tt, v, tt], axis=1).reshape(-1, 4))
        changed.append({'node': i, 'name': d['nodes'][i]['name'], 'path': 'rotation', 'oldOutputAccessor': old_output,
                        'newOutputAccessor': sampler['output'], 'globalPitchFraction': selected[i]})
    d['buffers'][0]['byteLength'] = len(db); model = out / 'model.glb'; g.write_glb(model, d, db)
    checks = {k: d.get(k) == original.get(k) for k in ['nodes', 'meshes', 'skins', 'materials', 'textures', 'images', 'samplers', 'scenes', 'scene']}
    checks.update(originalBinaryPrefix=bytes(db[:len(prefix)]) == prefix,
                  originalAccessorPrefix=d['accessors'][:len(original['accessors'])] == original['accessors'],
                  originalBufferViewPrefix=d['bufferViews'][:len(original['bufferViews'])] == original['bufferViews'])
    assert all(checks.values()); unchanged = 0
    for before, after in zip(original['animations'], d['animations']):
        assert before['name'] == after['name'] and before['channels'] == after['channels']
        for ch in before['channels']:
            bs, cs = before['samplers'][ch['sampler']], after['samplers'][ch['sampler']]
            if before['name'] == clip['name'] and ch['target']['node'] in selected and ch['target']['path'] == 'rotation':
                assert bs['input'] == cs['input'] and bs['interpolation'] == cs['interpolation']; continue
            assert bs == cs and np.array_equal(g.accessor(original, prefix, bs['output']), g.accessor(d, db, cs['output'])); unchanged += 1
    broad_ids = np.where(rest_points[:, 1] < floor + .19 * ratio)[0]
    markers = np.array([rw[names[FEET[f]]][[0, 2], 3] for f in FEET])
    groups = np.argmin(np.linalg.norm(rest_points[broad_ids][:, None, [0, 2]] - markers[None, :, :], axis=2), axis=1)
    masks = {}
    for j, foot in enumerate(FEET):
        ids = broad_ids[groups == j]; points = rest_points[ids]
        sole = ids[points[:, 1] <= points[:, 1].min() + .007]; z = rest_points[sole, 2]
        masks[foot] = {'offset': OFFSETS[foot], 'wholeVertices': ids.tolist(), 'vertices': sole.tolist(),
                       'toeVertices': sole[z >= np.quantile(z, .75)].tolist(), 'heelVertices': sole[z <= np.quantile(z, .25)].tolist()}
    method = {'duration': D, 'stanceFraction': .65, 'footMasks': masks, 'fixedSourceBodyFloorY': floor,
              'wholeHoofRestAboveFloorCutoffM': .19 * ratio, 'strictSoleThicknessM': .007,
              'method': 'Untouched source-rest skinned body vertices. Broad lower-foot region assigned to nearest native distal marker in XZ; fixed IDs. Own minimum +7mm strict sole, rest+Z quartile toe/heel. No current-pose reselection. Anatomical left uses native _l.'}
    meta = dict(config, sourceSha256=config['sourceSha256'], candidateSha256=digest(model), candidateBytes=model.stat().st_size,
                clip=clip['name'], durationS=D, changedTracks=changed, unchangedTracksAllClips=unchanged, preservation=checks,
                originalHeadYSpanM=float(np.ptp([r['headY'] for r in old])), originalTrunkYSpanM=float(np.ptp(y)),
                trunkSecondHarmonicPhaseRadians=trunk_phase, originalHeadMeanWorldY=mean_head,
                sourceBodyFloorY=floor, standingTrunkOriginAboveFloorM=height, whiteStandingTrunkOriginAboveFloorM=white_height,
                standingTrunkProxyRatio=ratio, whiteReferenceSha256=WHITE_SHA, targetHeadSpanM=amplitude * 2,
                neckCommonPitchBoundsDegrees=[-12, 12], neckCommonPitchRangeDegrees=[min(r['neckCommonPitchDegrees'] for r in solves), max(r['neckCommonPitchDegrees'] for r in solves)],
                method='Own animated parents and native world-rest rotations; bounded common sagittal pitch solve; only six neck/head Walk quaternion outputs appended, periodic normalized cubic tangents.',
                bodyLimitation='Unchanged source torso has dominant four-cycle vertical component; head and trunk origins are proxies, not anatomical optical markers.',
                noMotionOrProductionApproval=True)
    (report_dir / 'build-summary.json').write_text(json.dumps(meta, indent=2) + '\n')
    (report_dir / 'contact-method.json').write_text(json.dumps(method, indent=2) + '\n')
    (out / 'head-solves.json').write_text(json.dumps({'original': old, 'solves': solves}, indent=2) + '\n')
    print(json.dumps({k: meta[k] for k in ['label', 'candidateSha256', 'targetHeadSpanM', 'standingTrunkProxyRatio', 'neckCommonPitchRangeDegrees', 'unchangedTracksAllClips']}))

for key in sys.argv[1:] or ['bay', 'sporthorse']: build(key)
