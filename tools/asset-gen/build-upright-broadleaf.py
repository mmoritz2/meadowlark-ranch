#!/usr/bin/env python3
"""Build the upright broadleaf: Quaternius wood + whole Poly Haven leaf patches.
Portable offline asset build. Requires NumPy and Pillow; never downloads.
CommonTree_3: Quaternius CC0-1.0, source archive hash pinned below.
Tree Small 02: Rico Cilliers, Poly Haven CC0-1.0; raw geometry/UV/materials.
Bark Brown 02: Rob Tuytel, Poly Haven CC0-1.0; exact three local map hashes.
Rebuild from repo: python3 tools/asset-gen/build-upright-broadleaf.py
  --source-archive /path/to/standard.zip --root .
Source license text and hashes are included in the optional build receipt.
"""
import argparse, copy, hashlib, io, json, math, pathlib, struct, zipfile
import numpy as np
from PIL import Image

parser = argparse.ArgumentParser(description='Build the licensed upright broadleaf derivative without downloading source assets.')
parser.add_argument('--source-archive', required=True, type=pathlib.Path)
parser.add_argument('--root', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[2])
parser.add_argument('--output', type=pathlib.Path)
parser.add_argument('--receipt', type=pathlib.Path)
args = parser.parse_args()
ROOT = args.root.resolve()
ARCHIVE = args.source_archive.resolve()
PHOTO = ROOT / 'assets/models/world/realism/tree_small_02.glb'
TARGET = args.output or ROOT / 'assets/models/world/realism/upright_broadleaf_01.glb'
BARK_SHA = {
    6: ('diff', '2213ae1da8970e2e0aa839f14afca5b633f83d77ca8b947f3c0a6a7468af3430'),
    7: ('nor_gl', 'adb37eb9e67b3eb7db41d473131f973fc829e5dae013fbfe8225957a2ca2303e'),
    8: ('rough', 'ec6c30f7ff298fff0e21d4370a91e7dfb720b5ea6afa629d39967e144041017e'),
}
EXPECTED_ARCHIVE = '298f6732b872e4cf7b30e6e7abf9641c7f6dc6b326df37ac089533ed7e3d58c9'
EXPECTED_PHOTO = '863d7bddbca4d46df85c32531acd56102ebb91315eec0bed066b7d5e029bf1a2'
sha = lambda b: hashlib.sha256(b).hexdigest()

def accessor(g, buffers, index):
    a = g['accessors'][index]; v = g['bufferViews'][a['bufferView']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']])
    return np.ndarray((a['count'], width), dtype=dtype, buffer=buffers[v['buffer']],
        offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
        strides=(v.get('byteStride', width * dtype.itemsize), dtype.itemsize)).copy()

def components(n, triangles):
    parent = list(range(n))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    def join(a, b):
        a, b = find(int(a)), find(int(b))
        if a != b: parent[b] = a
    for a, b, c in triangles: join(a, b); join(a, c)
    vertices = {}; faces = {}
    for i in range(n): vertices.setdefault(find(i), []).append(i)
    for i, triangle in enumerate(triangles): faces.setdefault(find(int(triangle[0])), []).append(i)
    return [(np.array(v, dtype=np.int64), np.array(faces[k], dtype=np.int64))
            for k, v in sorted(vertices.items())]

def unit(v):
    v = np.asarray(v, dtype=np.float64)
    d = np.linalg.norm(v)
    assert d > 1e-9
    return v / d

def rotate_between(a, b):
    a, b = unit(a), unit(b); v = np.cross(a, b); c = float(np.dot(a, b))
    if c < -.999999:
        axis = unit(np.cross(a, np.array([1., 0., 0.]) if abs(a[0]) < .8 else np.array([0., 1., 0.])))
        return 2 * np.outer(axis, axis) - np.eye(3)
    k = np.array([[0., -v[2], v[1]], [v[2], 0., -v[0]], [-v[1], v[0], 0.]])
    return np.eye(3) + k + k @ k / (1 + c)

def turn(axis, angle):
    axis = unit(axis); x, y, z = axis
    k = np.array([[0., -z, y], [z, 0., -x], [-y, x, 0.]])
    return np.eye(3) * math.cos(angle) + (1 - math.cos(angle)) * np.outer(axis, axis) + math.sin(angle) * k

def hashed(i):
    i = (i ^ (i >> 16)) * 0x7feb352d & 0xffffffff
    i = (i ^ (i >> 15)) * 0x846ca68b & 0xffffffff
    return (i ^ (i >> 16)) & 0xffffffff

archive_bytes = ARCHIVE.read_bytes(); photo_bytes = PHOTO.read_bytes()
assert sha(archive_bytes) == EXPECTED_ARCHIVE
assert sha(photo_bytes) == EXPECTED_PHOTO
with zipfile.ZipFile(io.BytesIO(archive_bytes)) as z:
    stock_json = z.read('glTF/CommonTree_3.gltf'); stock_bin = z.read('glTF/CommonTree_3.bin')
    stock = json.loads(stock_json); license_text = z.read('License_Standard.txt')
assert sha(license_text) == '120710e542c3ebaf83856c4eb55b4a1e680593b39302eba7fdc5d942dfe78c58'
assert b'CC0 1.0 Universal' in license_text
assert all(not any(k in node for k in ['matrix', 'rotation', 'translation', 'scale']) for node in stock['nodes'])
length = struct.unpack_from('<I', photo_bytes, 12)[0]
photo = json.loads(photo_bytes[20:20 + length]); photo_bin = photo_bytes[28 + length:]
assert all(not any(k in node for k in ['matrix', 'rotation', 'translation', 'scale']) for node in photo['nodes'])
wood, cards = stock['meshes'][0]['primitives']
photo_leaf = next(p for p in photo['meshes'][0]['primitives'] if photo['materials'][p['material']]['name'] == 'tree_small_02_leaves')
cp = accessor(stock, [stock_bin], cards['attributes']['POSITION']).astype(np.float64)
cn = accessor(stock, [stock_bin], cards['attributes']['NORMAL']).astype(np.float64)
ci = accessor(stock, [stock_bin], cards['indices']).reshape(-1, 3)
pp = accessor(photo, [photo_bin], photo_leaf['attributes']['POSITION'])
pn = accessor(photo, [photo_bin], photo_leaf['attributes']['NORMAL'])
puv = accessor(photo, [photo_bin], photo_leaf['attributes']['TEXCOORD_0'])
pi = accessor(photo, [photo_bin], photo_leaf['indices']).reshape(-1, 3)
patches = components(len(pp), pi); card_components = components(len(cp), ci)
assert len(patches) == 12937 and len(card_components) == 900
assert all(len(v) == 4 and len(t) == 2 for v, t in card_components)
pool = []
for patch_id, (v, t) in enumerate(patches):
    extent = np.ptp(pp[v], axis=0).max()
    if 6 <= len(t) <= 12 and .045 <= extent <= .125:
        pool.append((patch_id, v, t))
assert len(pool) >= 100
wood_p = accessor(stock, [stock_bin], wood['attributes']['POSITION'])
stock_min = np.minimum(wood_p.min(axis=0), cp.min(axis=0)); stock_max = np.maximum(wood_p.max(axis=0), cp.max(axis=0))
photo_min = min(a.get('min', [0, 999, 0])[1] for a in photo['accessors'] if a.get('type') == 'VEC3' and 'min' in a)
photo_max = max(a.get('max', [0, -999, 0])[1] for a in photo['accessors'] if a.get('type') == 'VEC3' and 'max' in a)
physical_scale = float((stock_max[1] - stock_min[1]) / (photo_max - photo_min)) * 1.45
leaf_min, leaf_max = cp.min(axis=0), cp.max(axis=0)
positions = []; normals = []; uvs = []; indices = []; vertex_base = 0; patch_usage = {}; uv_exact = True
max_det_error = 0.; patch_records = []
# Original crown composition, not a scaled stock-card envelope. Connected,
# asymmetric branch-side lobes overlap into one crown with a broken outer edge.
# Whole source leaf patches remain rigid and uniformly sized; only their poses change.
CROWN_LOBES = [
    # center, ellipsoid radii, share of the 900 leafy twig clusters
    ((-.58, 3.55, .16), (1.40, .82, 1.16), .07),
    ((.65, 4.50, -.12), (1.72, 1.07, 1.35), .14),
    ((-.53, 5.40, -.45), (1.98, 1.26, 1.48), .20),
    ((.12, 6.25, .56), (2.00, 1.25, 1.46), .20),
    ((-.72, 7.10, .07), (1.71, 1.16, 1.40), .17),
    ((.64, 7.72, -.27), (1.57, 1.02, 1.26), .14),
    ((-.31, 8.37, .06), (1.16, .62, 1.06), .08),
]
cluster_targets = []; lobe_counts = [0] * len(CROWN_LOBES)
for card_id in range(len(card_components)):
    pick = hashed((card_id + 7) * 809 + 31337) / 0xffffffff
    cumulative = 0.
    for lobe_id, (lobe_center, radii, share) in enumerate(CROWN_LOBES):
        cumulative += share
        if pick <= cumulative or lobe_id == len(CROWN_LOBES) - 1: break
    lobe_counts[lobe_id] += 1
    azimuth = hashed((card_id + 1) * 887 + 111) / 0xffffffff * math.tau
    vertical = hashed((card_id + 1) * 929 + 223) / 0xffffffff * 2. - 1.
    radial = (hashed((card_id + 1) * 947 + 331) / 0xffffffff) ** (1. / 3.)
    direction = np.array([math.cos(azimuth) * math.sqrt(1 - vertical * vertical), vertical,
                          math.sin(azimuth) * math.sqrt(1 - vertical * vertical)])
    # Low-amplitude correlated roughness makes an irregular canopy edge, rather
    # than hard ellipsoid skins or independently inflated topiary balls.
    ripple = 1 + .09 * math.sin(azimuth * 3. + lobe_id * 1.7) * math.cos(vertical * 4. + lobe_id)
    point = np.array(lobe_center) + direction * np.array(radii) * radial * ripple
    cluster_targets.append(point)
# Twelve complete photographed surfaces form each small leafy twig cluster.
for card_id, (cv, _) in enumerate(card_components):
    points = cp[cv]; source_center = points.mean(axis=0); center = cluster_targets[card_id]; n = unit(cn[cv].mean(axis=0))
    e = unit(points[1] - points[0]); e = unit(e - n * np.dot(e, n)); f = unit(np.cross(n, e))
    half_e = max(abs((points - source_center) @ e)) * .82; half_f = max(abs((points - source_center) @ f)) * .82
    for slot in range(12):
        h = hashed((card_id + 1) * 947 + (slot + 1) * 313)
        patch_id, pv, pt = pool[h % len(pool)]
        local = pp[pv].astype(np.float64); source_normal = unit(pn[pv].mean(axis=0))
        # Preserve each complete leaf surface; anchor is an actual retained source vertex.
        anchor = local[np.argmin(np.linalg.norm(local - local.mean(axis=0), axis=1))]
        spin = (h / 0xffffffff) * math.tau
        tilt = ((hashed(h + 11) / 0xffffffff) - .5) * 1.1
        r = turn(e, tilt) @ turn(n, spin) @ rotate_between(source_normal, n)
        max_det_error = max(max_det_error, abs(float(np.linalg.det(r)) - 1))
        ue = ((slot % 4) - 1.5) * .5 * half_e
        vf = ((slot // 4) - 1) * .72 * half_f
        depth = ((hashed(h + 71) / 0xffffffff) - .5) * .18
        target = center + e * ue + f * vf + n * depth
        p = (local - anchor) @ r.T * physical_scale + target
        # Whole-patch vertical translation preserves the reviewed tree's exact
        # foot and tip; XZ is intentionally permitted to form the fuller crown.
        # Most patches never touch this guard because the lobe tips sit below it.
        shift = np.zeros(3)
        shift[1] = max(float(leaf_min[1] - p[:, 1].min()), 0.) - max(float(p[:, 1].max() - leaf_max[1]), 0.)
        p += shift
        new_normals = pn[pv].astype(np.float64) @ r.T
        new_normals /= np.linalg.norm(new_normals, axis=1)[:, None]
        remap = {int(old): i for i, old in enumerate(pv)}
        local_index = np.array([[remap[int(a)] for a in t] for t in pi[pt]], dtype=np.uint32)
        assert np.array_equal(puv[pv], puv[pv].copy())
        assert np.max(np.abs(p - (local - anchor) @ r.T * physical_scale - target - shift)) < 1e-9
        positions.append(p.astype('<f4')); normals.append(new_normals.astype('<f4')); uvs.append(puv[pv].copy())
        indices.append(local_index + vertex_base); vertex_base += len(pv)
        patch_usage[patch_id] = patch_usage.get(patch_id, 0) + 1
        patch_records.append((len(positions) - 1, p.min(axis=0), p.max(axis=0)))
# Keep exact source height without stretching leaves: seat the highest retained patch at the original tip.
top = max(patch_records, key=lambda q: q[2][1])[0]
positions[top][:, 1] += np.float32(leaf_max[1] - positions[top][:, 1].max())
lp = np.concatenate(positions); ln = np.concatenate(normals); luv = np.concatenate(uvs); li = np.concatenate(indices).reshape(-1)
wood_triangles = len(accessor(stock, [stock_bin], wood['indices'])) // 3
assert len(li) % 3 == 0 and len(li) // 3 + wood_triangles <= 110000
assert np.isfinite(lp).all() and np.isfinite(ln).all() and np.isfinite(luv).all()
assert li.max() < len(lp) and np.max(abs(np.linalg.norm(ln, axis=1) - 1)) < 2e-6
assert lp[:,1].min() >= leaf_min[1] - 2e-6 and lp[:,1].max() <= leaf_max[1] + 2e-6
assert max(abs(lp[:,0]).max(), abs(lp[:,2]).max()) < 3.1
assert max_det_error < 1e-12

output = {'asset': {'version': '2.0', 'generator': 'Original full-crown upright photographed leaf hybrid V4 candidate'},
    'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'Upright photographed leaf hybrid', 'mesh': 0}],
    'meshes': [{'name': 'CommonTree_3 wood + complete tree_small_02 leaf surfaces', 'primitives': []}],
    'accessors': [], 'bufferViews': [], 'buffers': [], 'materials': [], 'images': [], 'textures': [],
    'samplers': photo['samplers'], 'extensionsUsed': ['EXT_texture_webp', 'KHR_texture_transform'], 'extensionsRequired': ['EXT_texture_webp', 'KHR_texture_transform']}
binary = bytearray()
def blob(data, target=None):
    while len(binary) % 4: binary.append(0)
    offset = len(binary); binary.extend(data); v = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)}
    if target: v['target'] = target
    output['bufferViews'].append(v); return len(output['bufferViews']) - 1
def attribute(array, kind, component=5126, bounds=False, target=34962):
    a = np.ascontiguousarray(array); count = a.shape[0]
    view = blob(a.tobytes(), target); entry = {'bufferView': view, 'componentType': component, 'count': count, 'type': kind}
    if bounds: entry.update(min=a.min(axis=0).tolist(), max=a.max(axis=0).tolist())
    output['accessors'].append(entry); return len(output['accessors']) - 1
wood_out = {'attributes': {}, 'indices': None, 'material': 0}
for name, ai in wood['attributes'].items():
    a = accessor(stock, [stock_bin], ai)
    wood_out['attributes'][name] = attribute(a, stock['accessors'][ai]['type'], bounds=name == 'POSITION')
wi = accessor(stock, [stock_bin], wood['indices']).reshape(-1)
wood_out['indices'] = attribute(wi, 'SCALAR', stock['accessors'][wood['indices']]['componentType'], target=34963)
leaf_out = {'attributes': {'POSITION': attribute(lp, 'VEC3', bounds=True), 'NORMAL': attribute(ln, 'VEC3'), 'TEXCOORD_0': attribute(luv, 'VEC2')},
    'indices': attribute(li.astype('<u4'), 'SCALAR', 5125, target=34963), 'material': 1}
output['meshes'][0]['primitives'] = [wood_out, leaf_out]
image_receipts = []; texture_remap = {}
def texture(old):
    if old in texture_remap: return texture_remap[old]
    t = copy.deepcopy(photo['textures'][old]); image_id = t['extensions']['EXT_texture_webp']['source']
    image = copy.deepcopy(photo['images'][image_id]); v = photo['bufferViews'][image['bufferView']]
    data = photo_bin[v['byteOffset']:v['byteOffset'] + v['byteLength']]
    if old in BARK_SHA:
        role, expected = BARK_SHA[old]
        data = (ROOT / f'assets/textures/landmarks/bark_brown_02_{role}.webp').read_bytes()
        assert sha(data) == expected
        image['name'] = f'bark_brown_02_{role}'
        image['mimeType'] = 'image/webp'
    image['bufferView'] = blob(data); output['images'].append(image)
    t['extensions']['EXT_texture_webp']['source'] = len(output['images']) - 1
    output['textures'].append(t); texture_remap[old] = len(output['textures']) - 1
    im = Image.open(io.BytesIO(data)); image_receipts.append({'sourceImage': image['name'], 'bytes': len(data), 'sha256': sha(data), 'dimensions': list(im.size)})
    return texture_remap[old]
for name in ['tree_small_02_trunk', 'tree_small_02_leaves']:
    material = copy.deepcopy(next(m for m in photo['materials'] if m['name'] == name))
    material['name'] = 'upright_hybrid_' + name
    for holder in [material, material['pbrMetallicRoughness']]:
        for key, value in holder.items():
            if key.endswith('Texture') and isinstance(value, dict): value['index'] = texture(value['index'])
    if name == 'tree_small_02_trunk':
        def tile(info):
            return {'index': info['index'], 'extensions': {'KHR_texture_transform': {'scale': [3, 3]}}}
        material = {'name': material['name'], 'doubleSided': True, 'alphaMode': 'OPAQUE',
            'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1,
                'baseColorTexture': tile(material['pbrMetallicRoughness']['baseColorTexture']),
                'metallicRoughnessTexture': tile(material['pbrMetallicRoughness']['metallicRoughnessTexture'])},
            'normalTexture': {**tile(material['normalTexture']), 'scale': .7},
            'extras': {'role': 'wood', 'barkSource': 'Poly Haven Bark Brown 02', 'woodGeometry': 'Quaternius CommonTree_3', 'nameRetainedForWoodRoleContract': True}}
    output['materials'].append(material)
while len(binary) % 4: binary.append(0)
output['buffers'] = [{'byteLength': len(binary)}]
encoded = json.dumps(output, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
glb = struct.pack('<III', 0x46546c67, 2, 12 + 8 + len(encoded) + 8 + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + bytes(binary)
assert sha(glb) == '5393f0c370b385920b840850881d4fbb25afc965f3e1dc24bda596572476b538', 'Reviewed full-crown model hash mismatch'
target = TARGET.resolve(); target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(glb)
receipt = {'kind': 'upright-broadleaf-full-crown-candidate-v1', 'artAccepted': False, 'physicsReady': False,
    'generator': {'file': pathlib.Path(__file__).name, 'sha256': sha(pathlib.Path(__file__).read_bytes())},
    'sourceWood': {'author': 'Quaternius', 'license': 'CC0-1.0', 'archiveSha256': EXPECTED_ARCHIVE,
        'licenseSha256': sha(license_text), 'licenseText': license_text.decode().strip(), 'gltf': 'glTF/CommonTree_3.gltf', 'gltfSha256': sha(stock_json), 'binSha256': sha(stock_bin)},
    'sourceLeaves': {'author': 'Rico Cilliers', 'provider': 'Poly Haven', 'license': 'CC0-1.0', 'sourcePage': 'https://polyhaven.com/a/tree_small_02', 'file': str(PHOTO), 'sha256': EXPECTED_PHOTO},
    'output': {'file': str(target), 'sha256': sha(glb), 'bytes': len(glb), 'drawPrimitives': 2, 'woodTriangles': wood_triangles,
        'leafTriangles': len(li) // 3, 'totalTriangles': len(li) // 3 + wood_triangles, 'woodVertices': len(wood_p), 'leafVertices': len(lp),
        'sourceHeight': float(stock_max[1] - stock_min[1]), 'bounds': {'min': np.minimum(wood_p.min(axis=0), lp.min(axis=0)).tolist(), 'max': np.maximum(wood_p.max(axis=0), lp.max(axis=0)).tolist()}},
    'patches': {'sourceComponents': len(patches), 'eligibleWholePatchPool': len(pool), 'occupiedSourceCards': len(card_components),
        'copies': len(positions), 'distinctSourcePatches': len(patch_usage), 'copiesPerSourceCard': 12, 'rigidRotationUniformScale': physical_scale,
        'leafSizeRule': 'A complete source leaf is uniformly 45% larger than on a resident tree_small_02 scaled to the same overall height; UV, shape and topology remain intact. Patch placement is redistributed among overlapping asymmetrical branch-side lobes.',
        'uvIndexTopologyPreservedPerPatch': True, 'rotationDeterminantMaxError': max_det_error},
    'crownComposition': {'lobes': [{'center': c, 'radii': r, 'share': w, 'clusters': lobe_counts[i]} for i, (c, r, w) in enumerate(CROWN_LOBES)], 'clusterBounds': {'min': np.min(cluster_targets, axis=0).tolist(), 'max': np.max(cluster_targets, axis=0).tolist()}, 'leafBounds': {'min': lp.min(axis=0).tolist(), 'max': lp.max(axis=0).tolist()}, 'woodBounds': {'min': wood_p.min(axis=0).tolist(), 'max': wood_p.max(axis=0).tolist()}, 'strategy': 'Redistribute same 900 twig clusters / 10800 whole photographed patches into seven overlapping irregular ellipsoidal volumes; denser middle crown, staggered broad lower shoulders and tapered offset top. No stock card geometry or global foliage stretch.'},
    'images': image_receipts, 'tileableBark': {'author': 'Rob Tuytel', 'provider': 'Poly Haven', 'sourcePage': 'https://polyhaven.com/a/bark_brown_02', 'license': 'CC0-1.0', 'textureHashes': BARK_SHA, 'repeat': [3, 3], 'normalScale': .7},
    'checks': {'finitePNAndUV': True, 'validIndices': True, 'unitLeafNormals': True, 'under110000Triangles': True,
        'originalWoodAttributesAndIndicesReemittedExact': True, 'originalVerticalBounds': True, 'originalSourceHeight': True, 'intentionallyBroaderFoliageOnly': True,
        'rawLeafAndChosenTileableBarkImagesExact': True, 'noWorldRNGOrRuntimeWrites': True},
    'limitations': ['Native art fullness remains unaccepted. Seven overlapping original lobes replace stock card islands; twig-cluster orientation remains based on source cards.',
        'Stock wood UVs remain exact; local tileable Bark Brown 02 is repeated [3,3], replacing the incompatible trunk atlas.',
        'Use the existing one-pass lower-case leaves preparation/configuration; do not also apply a generic stock-leaf reskin.',
        'No production LOD atlas, source selection, route/contact registration, or FPS certification.',
        'The original photographed leaf UVs and material alpha mask are retained; projected alpha coverage must be judged natively.']}
if args.receipt:
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
