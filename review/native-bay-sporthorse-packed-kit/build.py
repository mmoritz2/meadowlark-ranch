"""Deterministic lossless runtime package; immutable source master retained."""
from pathlib import Path
import copy, hashlib, json, sys
ROOT = Path(__file__).resolve().parents[2]; HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools/asset-gen')); import rig_hero_horse as g
SOURCE = ROOT / 'review/native-bay-sporthorse-head-kit/model.glb'
PIN = 'a83db5e4fda2ca1fa83478c94fda891bd385a24f7db3cecf2af2cb85e5e6b034'
def sha(b): return hashlib.sha256(b).hexdigest()
assert sha(SOURCE.read_bytes()) == PIN
d, original_bin = g.read_glb(SOURCE); original = copy.deepcopy(d)
assert len(d['animations']) == 4
active = {'Target Native Walk Rollover', 'Target Native Trot', 'Target Native Canter Left', 'Target Native Canter Right'}
assert {a['name'] for a in d['animations']} == active
used = set()
for mesh in d['meshes']:
    for p in mesh['primitives']:
        used |= set(p['attributes'].values())
        if 'indices' in p: used.add(p['indices'])
        for target in p.get('targets', []): used |= set(target.values())
for skin in d['skins']:
    if 'inverseBindMatrices' in skin: used.add(skin['inverseBindMatrices'])
for a in d['animations']:
    for s in a['samplers']: used |= {s['input'], s['output']}

binary = bytearray(); views = []; accessors = []; mapping = {}; blobs = {}
def store(raw, target=None):
    key = (sha(raw), len(raw), target)
    if key in blobs: return blobs[key]
    binary.extend(b'\0' * ((-len(binary)) % 4)); view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw)}
    if target is not None: view['target'] = target
    index = len(views); views.append(view); binary.extend(raw); blobs[key] = index
    return index
for i in sorted(used):
    a = copy.deepcopy(d['accessors'][i]); raw = g.accessor(d, original_bin, i).tobytes(order='C')
    target = d['bufferViews'][a['bufferView']].get('target')
    a['bufferView'] = store(raw, target); a.pop('byteOffset', None)
    mapping[i] = len(accessors); accessors.append(a)
for image in d['images']:
    v = original['bufferViews'][image['bufferView']]; offset = v.get('byteOffset', 0)
    image['bufferView'] = store(bytes(original_bin[offset:offset + v['byteLength']]))
for mesh in d['meshes']:
    for p in mesh['primitives']:
        p['attributes'] = {k: mapping[i] for k, i in p['attributes'].items()}
        if 'indices' in p: p['indices'] = mapping[p['indices']]
        for target in p.get('targets', []):
            for k, i in target.items(): target[k] = mapping[i]
for skin in d['skins']:
    if 'inverseBindMatrices' in skin: skin['inverseBindMatrices'] = mapping[skin['inverseBindMatrices']]
for a in d['animations']:
    for s in a['samplers']: s['input'], s['output'] = mapping[s['input']], mapping[s['output']]
d['accessors'] = accessors; d['bufferViews'] = views; d['buffers'] = [{'byteLength': len(binary)}]
MODEL = HERE / 'model.glb'; g.write_glb(MODEL, d, binary)
assert sha(SOURCE.read_bytes()) == PIN
summary = {'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': PIN, 'candidateSha256': sha(MODEL.read_bytes()),
           'sourceBytes': SOURCE.stat().st_size, 'candidateBytes': MODEL.stat().st_size,
           'reductionBytes': SOURCE.stat().st_size - MODEL.stat().st_size,
           'reductionPercent': 100 * (1 - MODEL.stat().st_size / SOURCE.stat().st_size),
           'originalAccessorCount': len(original['accessors']), 'candidateAccessorCount': len(accessors),
           'originalBufferViewCount': len(original['bufferViews']), 'candidateBufferViewCount': len(views),
           'activeClips': sorted(active), 'noBinaryPrefixPreservationClaim': True, 'privateCandidateOnly': True,
           'method': 'Sorted used accessor IDs; original tightly packed raw fields, exact equal blobs shared with matching buffer target; exact PNG streams. All source node/mesh/skin/material/clip semantics retained with accessor/view remap. No numeric/image/curve conversion.'}
(HERE / 'build-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
(HERE / 'accessor-map.json').write_text(json.dumps(mapping, indent=2) + '\n')
print(json.dumps(summary, indent=2))
