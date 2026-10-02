"""One private late-recovery phase-warp trial on the immutable White Trot.

Only ten left/right foreleg quaternion outputs of Target Native Trot change.
The source LINEAR interpolation and every other original source field remain.
"""
from pathlib import Path
import copy, hashlib, json, sys
import numpy as np
from scipy.spatial.transform import Rotation as R, Slerp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/asset-gen'))
import rig_hero_horse as g

SOURCE = Path(sys.argv[1]) if len(sys.argv)>1 else ROOT / 'review/native-white-head-kit/model.glb'
SOURCE_SHA = '488a3382f9c2f44dc69ccdfe935a032a03dae768e794088aaf9fa04ad045f81f'
OUT = Path(sys.argv[2]) if len(sys.argv)>2 else HERE / 'phase-intermediate.glb'
OUT.parent.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA
d, binary = g.read_glb(SOURCE)
original = copy.deepcopy(d)
old_binary = bytes(binary)
nodes = {n.get('name'): i for i, n in enumerate(d['nodes'])}
clip = next(a for a in d['animations'] if a['name'] == 'Target Native Trot')
STANCE = .44
ADVANCE = .05
WINDOW = (.55, .75, .98)
CHAINS = {
    'FL': (0., ['clavicle_l_0203', 'upperarm_l_0204', 'lowerarm_l_0205', 'hand_l_0206', 'fingers_01_l_0187']),
    'FR': (.5, ['clavicle_r_0269', 'upperarm_r_0270', 'lowerarm_r_0271', 'hand_r_0272', 'fingers_01_r_0273']),
}

def quintic(t):
    return t*t*t*(10. - 15.*t + 6.*t*t)

def quintic_prime(t):
    return 30.*t*t*(1.-t)*(1.-t)

def lobe(u):
    a, p, z = WINDOW
    if u <= a or u >= z:
        return 0., 0.
    if u <= p:
        t = (u-a)/(p-a)
        return quintic(t), quintic_prime(t)/(p-a)
    t = (z-u)/(z-p)
    return quintic(t), -quintic_prime(t)/(z-p)

def mapped_phase(p, offset):
    q = (p-offset) % 1.
    if q < STANCE:
        return p, 0., 1.
    u = (q-STANCE)/(1.-STANCE)
    value, slope = lobe(u)
    if not value and not slope:
        return p, 0., 1.
    q2 = q + ADVANCE*value
    dp2 = 1. + ADVANCE*slope/(1.-STANCE)
    return (offset+q2) % 1., value, dp2

def append(values):
    values = np.asarray(values, dtype='<f4')
    binary.extend(b'\0' * ((-len(binary)) % 4))
    vi = len(d['bufferViews'])
    d['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
    binary.extend(values.tobytes())
    ai = len(d['accessors'])
    d['accessors'].append({'bufferView': vi, 'componentType': 5126, 'count': len(values), 'type': 'VEC4'})
    return ai

changes = []
for foot, (offset, chain) in CHAINS.items():
    for name in chain:
        node = nodes[name]
        channel = next(c for c in clip['channels'] if c['target'] == {'node': node, 'path': 'rotation'})
        sampler = clip['samplers'][channel['sampler']]
        assert sampler['interpolation'] == 'LINEAR'
        times = g.accessor(d, binary, sampler['input']).reshape(-1).astype(float)
        old = g.accessor(d, binary, sampler['output']).reshape(-1, 4).astype(float)
        assert len(times) == len(old) == 129
        duration = float(times[-1])
        interp = Slerp(times, R.from_quat(old))
        new = old.copy()
        changed_indices = []
        map_derivatives = []
        for i, t in enumerate(times):
            p = float(t/duration)
            p2, l, deriv = mapped_phase(p, offset)
            map_derivatives.append(deriv)
            if l == 0.:
                continue
            target_t = p2*duration
            q = interp([target_t]).as_quat()[0]
            if np.dot(q, old[i]) < 0.:
                q = -q
            new[i] = q
            changed_indices.append(i)
        # Signed stance and boundary rows are byte-identical to the source.
        for i, t in enumerate(times):
            p = float(t/duration)
            q = (p-offset) % 1.
            if q < STANCE or not (WINDOW[0] < (q-STANCE)/(1.-STANCE) < WINDOW[2]):
                assert np.array_equal(new[i], old[i])
        old_accessor = sampler['output']
        sampler['output'] = append(new)
        changes.append({'foot': foot, 'name': name, 'node': node, 'oldAccessor': old_accessor,
                        'newAccessor': sampler['output'], 'changedKeys': len(changed_indices),
                        'minMapDerivative': min(map_derivatives), 'maxMapDerivative': max(map_derivatives),
                        'sourceInterpolation': 'LINEAR', 'durationS': duration})

d['buffers'][0]['byteLength'] = len(binary)
g.write_glb(OUT, d, binary)
static = {k: d.get(k) == original.get(k) for k in ['nodes', 'meshes', 'skins', 'materials', 'textures', 'images', 'samplers', 'scenes', 'scene']}
static['binaryPrefixExact'] = bytes(binary[:len(old_binary)]) == old_binary
static['oldAccessorsPrefixExact'] = d['accessors'][:len(original['accessors'])] == original['accessors']
static['oldBufferViewsPrefixExact'] = d['bufferViews'][:len(original['bufferViews'])] == original['bufferViews']
assert all(static.values())
changed = {r['node'] for r in changes}
unchanged = 0
for prior, after in zip(original['animations'], d['animations']):
    assert prior['name'] == after['name']
    assert prior['channels'] == after['channels']
    for channel in prior['channels']:
        a = prior['samplers'][channel['sampler']]
        b = after['samplers'][channel['sampler']]
        if prior['name'] == 'Target Native Trot' and channel['target']['node'] in changed and channel['target']['path'] == 'rotation':
            assert a['input'] == b['input'] and a['interpolation'] == b['interpolation']
        else:
            assert a == b
            assert np.array_equal(g.accessor(original, old_binary, a['output']), g.accessor(d, binary, b['output']))
            unchanged += 1

grid = np.linspace(0, 1, 10001)
min_derivative = min(mapped_phase(float(p), 0.)[2] for p in grid)
assert min_derivative > 0.
report = {
    'source': str(SOURCE), 'sourceSha256': SOURCE_SHA, 'output': str(OUT),
    'outputSha256': hashlib.sha256(OUT.read_bytes()).hexdigest(),
    'clip': 'Target Native Trot', 'durationS': duration, 'stanceFraction': STANCE,
    'offsets': {k: v[0] for k, v in CHAINS.items()}, 'advanceFraction': ADVANCE,
    'swingWindowU': WINDOW, 'globalMinMapDerivative': min_derivative,
    'changedTracks': changes, 'unchangedTracks': unchanged,
    'preservation': static,
    'method': 'Each of ten fore rotation tracks is re-sampled from its own original target Trot clip at a monotone late-swing quintic phase map. Source LINEAR interpolation and 129 key times remain; original quaternion at every unchanged key is exact. No body, hind, floor, stance, clip rate or node bind edits.',
    'status': 'Private visual/contact/step QA pending; not release approved.',
}
OUT.with_name(OUT.stem+'-phase-report.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'sha': report['outputSha256'], 'changedTracks': len(changes), 'minDerivative': min_derivative, 'preservation': static}, indent=2))
