"""Independent logical traversal proof, does not read the builder's index map."""
from pathlib import Path
import hashlib, json, struct, sys
import numpy as np
ROOT = Path(__file__).resolve().parents[2]; HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools/asset-gen')); import rig_hero_horse as g
meta = json.loads((HERE / 'build-summary.json').read_text())
source = ROOT / meta['source']; model = HERE / 'model.glb'
sha = lambda b: hashlib.sha256(b).hexdigest()
assert sha(source.read_bytes()) == meta['sourceSha256'] and sha(model.read_bytes()) == meta['candidateSha256']
old, ob = g.read_glb(source); new, nb = g.read_glb(model); rows = []; mappings = {}; descriptors = []
SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def field_bytes(doc, binary, i):
    a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]; assert 'sparse' not in a
    width = WIDTH[a['type']] * SIZE[a['componentType']]; step = v.get('byteStride', width)
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return b''.join(bytes(binary[start+j*step:start+j*step+width]) for j in range(a['count']))
def compare(path, a, b):
    ao, an = old['accessors'][a], new['accessors'][b]
    desc = lambda x: {k: v for k, v in x.items() if k not in ['bufferView', 'byteOffset']}
    assert desc(ao) == desc(an), path
    raw_old, raw_new = field_bytes(old, ob, a), field_bytes(new, nb, b)
    assert raw_old == raw_new, path
    assert np.array_equal(g.accessor(old, ob, a), g.accessor(new, nb, b)), path
    assert mappings.get(a, b) == b; mappings[a] = b
    rows.append({'path': path, 'sourceAccessor': a, 'packedAccessor': b, 'bytes': len(raw_old), 'sha256': sha(raw_old), 'descriptorExact': True, 'rawFieldExact': True, 'decodedArrayExact': True})
protected = {}
for k in ['asset', 'scene', 'scenes', 'nodes', 'materials', 'textures', 'samplers', 'extensions', 'extensionsUsed', 'extensionsRequired', 'extras']:
    protected[k] = old.get(k) == new.get(k); assert protected[k], k
assert len(old['meshes']) == len(new['meshes']) and len(old['skins']) == len(new['skins'])
for mi, (a, b) in enumerate(zip(old['meshes'], new['meshes'])):
    assert {k: v for k, v in a.items() if k != 'primitives'} == {k: v for k, v in b.items() if k != 'primitives'}
    assert len(a['primitives']) == len(b['primitives'])
    for pi, (p, q) in enumerate(zip(a['primitives'], b['primitives'])):
        assert {k: v for k, v in p.items() if k not in ['attributes', 'indices', 'targets']} == {k: v for k, v in q.items() if k not in ['attributes', 'indices', 'targets']}
        assert p['attributes'].keys() == q['attributes'].keys()
        for k in p['attributes']: compare(f'mesh[{mi}].primitive[{pi}].attribute.{k}', p['attributes'][k], q['attributes'][k])
        if 'indices' in p: compare(f'mesh[{mi}].primitive[{pi}].indices', p['indices'], q['indices'])
        assert len(p.get('targets', [])) == len(q.get('targets', []))
        for ti, (t, u) in enumerate(zip(p.get('targets', []), q.get('targets', []))):
            assert t.keys() == u.keys()
            for k in t: compare(f'mesh[{mi}].primitive[{pi}].morph[{ti}].{k}', t[k], u[k])
for i, (a, b) in enumerate(zip(old['skins'], new['skins'])):
    assert {k: v for k, v in a.items() if k != 'inverseBindMatrices'} == {k: v for k, v in b.items() if k != 'inverseBindMatrices'}
    compare(f'skin[{i}].inverseBindMatrices', a['inverseBindMatrices'], b['inverseBindMatrices'])
assert len(old['animations']) == len(new['animations']) == 4
for ai, (a, b) in enumerate(zip(old['animations'], new['animations'])):
    assert {k: v for k, v in a.items() if k != 'samplers'} == {k: v for k, v in b.items() if k != 'samplers'}
    assert len(a['samplers']) == len(b['samplers'])
    for si, (s, t) in enumerate(zip(a['samplers'], b['samplers'])):
        assert {k: v for k, v in s.items() if k not in ['input', 'output']} == {k: v for k, v in t.items() if k not in ['input', 'output']}
        for k in ['input', 'output']: compare(f'animation[{ai}].sampler[{si}].{k}', s[k], t[k])
images = []
assert len(old['images']) == len(new['images']) == 5
for i, (a, b) in enumerate(zip(old['images'], new['images'])):
    assert {k: v for k, v in a.items() if k != 'bufferView'} == {k: v for k, v in b.items() if k != 'bufferView'}
    def stream(doc, blob, image):
        v = doc['bufferViews'][image['bufferView']]; p = v.get('byteOffset', 0)
        return bytes(blob[p:p+v['byteLength']])
    x, y = stream(old, ob, a), stream(new, nb, b); assert x == y
    images.append({'image': i, 'bytes': len(x), 'sha256': sha(x), 'exact': True})
assert len(mappings) == len(new['accessors']) == 368
assert set(mappings.values()) == set(range(len(new['accessors'])))
report = {'sourceSha256': meta['sourceSha256'], 'candidateSha256': meta['candidateSha256'], 'pass': True,
          'protectedMetadataExact': protected, 'fullNodes': len(new['nodes']), 'joints': len(new['skins'][0]['joints']),
          'logicalFieldReferencesChecked': len(rows), 'uniqueUsedAccessorsChecked': len(mappings),
          'fieldComparisonMethod': 'Independent field-path walk. Copy exact original element bytes using source buffer stride, compare new raw bytes, original accessor metadata excluding storage indices, and decoded arrays. Builder map not used.',
          'rows': rows, 'images': images, 'noBinaryPrefixPreservationClaim': True, 'privateCandidateOnly': True}
(HERE / 'field-preservation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['sourceSha256', 'candidateSha256', 'pass', 'fullNodes', 'joints', 'logicalFieldReferencesChecked', 'uniqueUsedAccessorsChecked', 'noBinaryPrefixPreservationClaim']}, indent=2))
