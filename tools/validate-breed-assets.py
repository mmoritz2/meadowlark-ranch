"""Independent, standard-library-only validation of the breed GLBs.

Usage: python tools/validate-breed-assets.py
       python tools/validate-breed-assets.py --glb assets/models/breeds/sunset.glb

This reads shipping files and writes only the JSON report. It does not use the
authoring script's geometry statistics or import Blender. Geometry uniqueness is
computed from decoded, sorted vertex positions, removing UV seam duplication and
uniform scale. Skin binding is checked in glTF rest space, not against unchanged
original bone lengths, because new conformation requires new rest translations.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import re
import struct
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
      5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4,
         'MAT2': 4, 'MAT3': 9, 'MAT4': 16}
IDENTITY = [[float(i == j) for j in range(4)] for i in range(4)]


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def matrix(values):
    if len(values) != 16:
        raise ValueError('Matrix must have 16 entries')
    return [[values[c * 4 + r] for c in range(4)] for r in range(4)]


def inverse(a):
    rows = [list(a[i]) + IDENTITY[i][:] for i in range(4)]
    for col in range(4):
        pivot = max(range(col, 4), key=lambda row: abs(rows[row][col]))
        if abs(rows[pivot][col]) < 1e-12:
            raise ValueError('Singular transform')
        rows[col], rows[pivot] = rows[pivot], rows[col]
        factor = rows[col][col]
        rows[col] = [value / factor for value in rows[col]]
        for row in range(4):
            if row != col:
                factor = rows[row][col]
                rows[row] = [x - factor * y for x, y in zip(rows[row], rows[col])]
    return [row[4:] for row in rows]


def delta(a, b):
    return max(abs(x - y) for ra, rb in zip(a, b) for x, y in zip(ra, rb))


def transform_point(m, p):
    return tuple(sum(m[i][k] * p[k] for k in range(3)) + m[i][3] for i in range(3))


def finite(values):
    return all(math.isfinite(x) for row in values for x in row)


class GLB:
    def __init__(self, path):
        self.path = Path(path).resolve()
        raw = self.path.read_bytes()
        if len(raw) < 20:
            raise ValueError('Truncated GLB')
        magic, version, length = struct.unpack_from('<4sII', raw)
        if magic != b'glTF' or version != 2 or length != len(raw):
            raise ValueError('Invalid GLB magic, version or declared length')
        chunks, pos = {}, 12
        while pos < length:
            if pos + 8 > length:
                raise ValueError('Truncated GLB chunk header')
            count, kind = struct.unpack_from('<I4s', raw, pos)
            pos += 8
            if pos + count > length:
                raise ValueError('GLB chunk exceeds file size')
            if kind in chunks:
                raise ValueError('Duplicate GLB chunk')
            chunks[kind] = raw[pos:pos + count]
            pos += count
        self.doc = json.loads(chunks[b'JSON'])
        self.buffers = []
        for item in self.doc.get('buffers', []):
            uri = item.get('uri')
            data = self.read_uri(uri) if uri else chunks.get(b'BIN\x00', b'')
            if len(data) < item['byteLength']:
                raise ValueError('Truncated buffer')
            self.buffers.append(data)
        self.cache = {}
        nodes = self.doc.get('nodes', [])
        self.parents = {}
        for parent, node in enumerate(nodes):
            for child in node.get('children', []):
                if child not in range(len(nodes)) or child in self.parents:
                    raise ValueError('Invalid child node or multiply-parented hierarchy')
                self.parents[child] = parent
        self.world_cache = {}

    def read_uri(self, uri):
        if uri.startswith('data:'):
            header, payload = uri.split(',', 1)
            if ';base64' not in header:
                raise ValueError('Unsupported non-base64 data URI')
            return base64.b64decode(payload, validate=True)
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', uri):
            raise ValueError('Network/absolute URI is not a self-contained shipping asset')
        path = (self.path.parent / unquote(uri)).resolve()
        if not path.is_relative_to(ROOT):
            raise ValueError('Asset dependency escapes workspace')
        return path.read_bytes()

    def read_view(self, index, offset, count, component, width, packed=False):
        view = self.doc['bufferViews'][index]
        fmt, scalar_size = CT[component]
        element = scalar_size * width
        stride = element if packed else view.get('byteStride', element)
        if stride < element or offset < 0:
            raise ValueError('Invalid accessor stride or offset')
        end = offset + (count - 1) * stride + element if count else offset
        if end > view['byteLength']:
            raise ValueError('Accessor exceeds buffer view')
        data = self.buffers[view.get('buffer', 0)]
        start = view.get('byteOffset', 0) + offset
        if start < 0 or view.get('byteOffset', 0) + view['byteLength'] > len(data):
            raise ValueError('Buffer view exceeds buffer')
        unpack = struct.Struct('<' + fmt * width).unpack_from
        return [unpack(data, start + i * stride) for i in range(count)]

    def accessor(self, index):
        if index in self.cache:
            return self.cache[index]
        a = self.doc['accessors'][index]
        count, width, component = a['count'], WIDTH[a['type']], a['componentType']
        if count < 0:
            raise ValueError('Negative accessor count')
        if a['type'].startswith('MAT') and component != 5126:
            raise ValueError('Integer matrix accessors are not supported by this validator')
        values = self.read_view(a['bufferView'], a.get('byteOffset', 0), count, component, width) if 'bufferView' in a else [(0,) * width for _ in range(count)]
        if 'sparse' in a:
            sparse = a['sparse']; ids = sparse['indices']; vals = sparse['values']
            indices = self.read_view(ids['bufferView'], ids.get('byteOffset', 0), sparse['count'], ids['componentType'], 1, True)
            replacement = self.read_view(vals['bufferView'], vals.get('byteOffset', 0), sparse['count'], component, width, True)
            last = -1
            for (i,), value in zip(indices, replacement):
                if not last < i < count:
                    raise ValueError('Invalid sparse accessor indices')
                values[i] = value; last = i
        if a.get('normalized'):
            if component == 5126:
                raise ValueError('FLOAT accessor cannot set normalized=true')
            limits = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5125: 4294967295}
            scale = limits[component]
            values = [tuple(max(-1, x / scale) for x in row) for row in values]
        if not finite(values):
            raise ValueError(f'Nonfinite values in accessor {index}')
        self.cache[index] = values
        return values

    def world(self, index, pending=None):
        if index in self.world_cache:
            return self.world_cache[index]
        pending = set() if pending is None else set(pending)
        if index in pending:
            raise ValueError('Cycle in node hierarchy')
        pending.add(index)
        node = self.doc['nodes'][index]
        if 'matrix' in node:
            if any(key in node for key in ('translation', 'rotation', 'scale')):
                raise ValueError('Node has both matrix and TRS transforms')
            local = matrix(node['matrix'])
        else:
            tx, ty, tz = node.get('translation', [0, 0, 0])
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            sx, sy, sz = node.get('scale', [1, 1, 1])
            if abs(x*x + y*y + z*z + w*w - 1) > 1e-3:
                raise ValueError('Non-normalized node quaternion')
            local = [[(1-2*(y*y+z*z))*sx, 2*(x*y-z*w)*sy, 2*(x*z+y*w)*sz, tx],
                     [2*(x*y+z*w)*sx, (1-2*(x*x+z*z))*sy, 2*(y*z-x*w)*sz, ty],
                     [2*(x*z-y*w)*sx, 2*(y*z+x*w)*sy, (1-2*(x*x+y*y))*sz, tz],
                     [0, 0, 0, 1]]
        if not finite(local):
            raise ValueError('Nonfinite node transform')
        inverse(local)
        parent = self.parents.get(index)
        world = local if parent is None else multiply(self.world(parent, pending), local)
        self.world_cache[index] = world
        return world

    def hierarchy(self, skin):
        joints = skin['joints']; joint_set = set(joints)
        names = [self.doc['nodes'][i].get('name', '') for i in joints]
        parents = []
        for joint in joints:
            parent = self.parents.get(joint)
            while parent is not None and parent not in joint_set:
                parent = self.parents.get(parent)
            parents.append(None if parent is None else self.doc['nodes'][parent].get('name', ''))
        return names, parents


def shape_hash(points):
    lo = [min(p[k] for p in points) for k in range(3)]
    hi = [max(p[k] for p in points) for k in range(3)]
    extent = max(hi[k] - lo[k] for k in range(3))
    if extent < 1e-8:
        raise ValueError('Collapsed geometry')
    center = [(lo[k] + hi[k]) / 2 for k in range(3)]
    quantized = sorted(set(tuple(round((p[k] - center[k]) / extent * 100000) for k in range(3)) for p in points))
    digest = hashlib.sha256()
    for point in quantized:
        digest.update(struct.pack('<3i', *point))
    return digest.hexdigest()


def normalized_points(points):
    lo = [min(p[k] for p in points) for k in range(3)]
    hi = [max(p[k] for p in points) for k in range(3)]
    extent = max(hi[k] - lo[k] for k in range(3))
    center = [(lo[k] + hi[k]) / 2 for k in range(3)]
    return [tuple((p[k] - center[k]) / extent for k in range(3)) for p in points]


def inspect(path, reference, tolerance=1e-4, keep_cloud=False):
    result = {'file': str(Path(path).resolve().relative_to(ROOT)), 'errors': [], 'warnings': []}
    fail, warn = result['errors'].append, result['warnings'].append
    try:
        glb = GLB(path); doc = glb.doc
        result['file_sha256'] = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        unsupported = set(doc.get('extensionsRequired', [])) & {'KHR_draco_mesh_compression', 'EXT_meshopt_compression'}
        if unsupported:
            raise ValueError('Cannot verify compressed geometry: ' + ', '.join(unsupported))
        for index in range(len(doc.get('accessors', []))):
            glb.accessor(index)
        for index in range(len(doc.get('nodes', []))):
            glb.world(index)
        for image in doc.get('images', []):
            if 'uri' in image:
                glb.read_uri(image['uri'])
        expected_names, expected_parents = reference
        skins = doc.get('skins', [])
        if not skins:
            fail('No skin found')
        bind_errors, identity_errors = [], []
        for skin_index, skin in enumerate(skins):
            names, parents = glb.hierarchy(skin)
            if len(names) != 33 or len(set(names)) != 33:
                fail(f'Skin {skin_index}: expected 33 unique joint names, got {len(names)}')
            if names != expected_names:
                fail(f'Skin {skin_index}: joint names/order differ from original')
            if parents != expected_parents:
                fail(f'Skin {skin_index}: joint parent hierarchy differs from original')
            ibms = glb.accessor(skin['inverseBindMatrices']) if 'inverseBindMatrices' in skin else [tuple(1 if i % 5 == 0 else 0 for i in range(16))] * len(names)
            if len(ibms) != len(names):
                raise ValueError('Inverse bind matrix count differs from joint count')
            rest = []
            for node, entries in zip(skin['joints'], ibms):
                ibm = matrix(entries); inverse(ibm)
                rest.append(multiply(glb.world(node), ibm))
            spread = max(delta(m, rest[0]) for m in rest)
            bind_errors.append(spread)
            if spread > tolerance:
                fail(f'Skin {skin_index}: inconsistent jointWorld * inverseBind ({spread:.8g})')
            for mesh_index, node in enumerate(doc.get('nodes', [])):
                if node.get('skin') == skin_index:
                    correction = inverse(glb.world(mesh_index))
                    identity_error = max(delta(multiply(correction, m), IDENTITY) for m in rest)
                    identity_errors.append(identity_error)
                    if identity_error > tolerance and spread <= tolerance:
                        # glTF permits a common bind-shape matrix pre-multiplied
                        # into every inverse bind. It is not joint-specific drift.
                        warn(f'Skin {skin_index}: consistent nonidentity bind-shape transform ({identity_error:.8g}); verify intentional mesh basis')
        points, principal, triangles, vertices, max_sum = [], [], 0, 0, 0.0
        skinned_meshes = {node['mesh']: node['skin'] for node in doc.get('nodes', []) if 'mesh' in node and 'skin' in node}
        for mesh_index, mesh in enumerate(doc.get('meshes', [])):
            for prim_index, primitive in enumerate(mesh.get('primitives', [])):
                label = f'mesh {mesh_index} primitive {prim_index}'
                attrs = primitive.get('attributes', {})
                positions = glb.accessor(attrs['POSITION'])
                if not positions or any(len(p) != 3 for p in positions):
                    raise ValueError(label + ': empty/invalid POSITION')
                points.extend(positions); vertices += len(positions)
                for semantic, index in attrs.items():
                    if len(glb.accessor(index)) != len(positions):
                        fail(label + ': attribute count mismatch: ' + semantic)
                indices = [x[0] for x in glb.accessor(primitive['indices'])] if 'indices' in primitive else list(range(len(positions)))
                if any(not isinstance(i, int) or i < 0 or i >= len(positions) for i in indices):
                    fail(label + ': out-of-range/noninteger geometry index')
                if primitive.get('mode', 4) != 4 or len(indices) % 3:
                    fail(label + ': expected complete triangle lists')
                triangles += len(indices) // 3
                if mesh_index not in skinned_meshes:
                    continue
                if len(positions) > len(principal):
                    principal = positions
                sets = sorted(k[7:] for k in attrs if k.startswith('JOINTS_'))
                if not sets or any('WEIGHTS_' + k not in attrs for k in sets):
                    fail(label + ': missing joint/weight pair'); continue
                if set(sets) != {k[8:] for k in attrs if k.startswith('WEIGHTS_')}:
                    fail(label + ': joint/weight sets differ'); continue
                joint_count = len(skins[skinned_meshes[mesh_index]]['joints'])
                sums = [0.0] * len(positions)
                for suffix in sets:
                    joints = glb.accessor(attrs['JOINTS_' + suffix]); weights = glb.accessor(attrs['WEIGHTS_' + suffix])
                    if len(joints) != len(positions) or len(weights) != len(positions):
                        continue
                    if any(len(j) != 4 or any(not isinstance(i, int) or i < 0 or i >= joint_count for i in j) for j in joints):
                        fail(label + ': invalid skin joint index')
                    if any(len(w) != 4 or any(v < 0 or v > 1 + tolerance for v in w) for w in weights):
                        fail(label + ': invalid skin weight')
                    for i, weight in enumerate(weights):
                        sums[i] += sum(weight)
                error = max(abs(value - 1) for value in sums)
                max_sum = max(max_sum, error)
                if error > tolerance:
                    fail(label + f': non-normalized skin weights ({error:.8g})')
        if not principal:
            raise ValueError('No skinned body primitive')
        result.update(vertices=vertices, triangles=triangles, skins=len(skins),
                      joints=[len(s['joints']) for s in skins],
                      max_skin_weight_sum_error=max_sum,
                      max_bind_pose_spread=max(bind_errors, default=0),
                      max_bind_pose_identity_error=max(identity_errors, default=0),
                      geometry_hash=shape_hash(points),
                      principal_body_geometry_hash=shape_hash(principal))
        if keep_cloud:
            result['_principal_cloud'] = normalized_points(principal)
    except (ValueError, KeyError, IndexError, TypeError, OSError, struct.error, ZeroDivisionError) as error:
        fail(str(error))
    result['passed'] = not result['errors']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'assets/models/breeds/manifest.json')
    parser.add_argument('--reference', type=Path, default=ROOT / 'assets/models/horse_textured_rigged.glb')
    parser.add_argument('--glb', type=Path, action='append', help='Validate selected GLBs without requiring a complete manifest')
    parser.add_argument('--report', type=Path, default=ROOT / 'output/breed-validation.json')
    parser.add_argument('--tolerance', type=float, default=1e-4)
    args = parser.parse_args()
    report = {'passed': False, 'errors': [], 'warnings': [], 'assets': []}
    try:
        original = GLB(args.reference)
        reference = original.hierarchy(original.doc['skins'][0])
        if len(reference[0]) != 33:
            raise ValueError('Reference must have exactly 33 joints')
        report['reference_joint_order'] = reference[0]
        if args.glb:
            files = [(path.stem, path) for path in args.glb]
            report['scope'] = 'selected_assets_only'
        else:
            report['scope'] = 'complete_roster'
            manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
            spec = json.loads((ROOT / 'tools/asset-gen/breed-conformation.json').read_text(encoding='utf-8'))
            source = (ROOT / 'ranch3d.html').read_text(encoding='utf-8').split('const BREEDS3=[', 1)[1].split('];', 1)[0]
            roster = set(re.findall(r"\['([^']+)','[^']+'", source))
            foundations = set(spec['conformations'])
            breeds = manifest['breeds']; aliases = manifest.get('aliases', {})
            legacy = set(manifest.get('legacyDragonKeys', []))
            expected_dragons = {'frostdrake', 'emberdrake', 'amethyst', 'stormdrake', 'verdant'}
            if legacy - expected_dragons:
                report['errors'].append('Non-dragon IDs routed through legacyDragonKeys')
            if len(roster) != 44 or len(foundations) != 24:
                report['errors'].append('Expected 44 actual roster IDs and 24 foundations')
            if set(breeds) != foundations:
                report['errors'].append('Foundation mismatch: missing=' + str(sorted(foundations-set(breeds))) + ' extra=' + str(sorted(set(breeds)-foundations)))
            covered = set(breeds) | set(aliases) | legacy
            if covered != roster:
                report['errors'].append('Roster coverage mismatch: missing=' + str(sorted(roster-covered)) + ' extra=' + str(sorted(covered-roster)))
            if set(breeds) & set(aliases) or set(breeds) & legacy or set(aliases) & legacy:
                report['errors'].append('Overlapping foundation, alias or legacy routes')
            for key, target in aliases.items():
                seen = {key}
                while target in aliases:
                    if target in seen:
                        raise ValueError('Alias cycle: ' + key)
                    seen.add(target); target = aliases[target]
                if target not in breeds:
                    report['errors'].append('Unresolved alias: ' + key)
            for key in ('aether', 'sunspear', 'meadowlight', 'tempest', 'eclipse', 'glacier'):
                if aliases.get(key) != spec['roster'][key]['conformation_id']:
                    report['errors'].append('Named mythic breed changed: ' + key)
            files = []
            for key, meta in breeds.items():
                path = (args.manifest.parent / meta['file']).resolve()
                if not path.is_relative_to((ROOT / 'assets/models/breeds').resolve()) or path.suffix.lower() != '.glb':
                    raise ValueError('Foundation file must be a GLB inside assets/models/breeds: ' + key)
                files.append((key, path))
                for field in ('withersM', 'fitScale', 'fitY'):
                    if not math.isfinite(meta[field]) or field != 'fitY' and meta[field] <= 0:
                        report['errors'].append('Invalid ' + field + ': ' + key)
                if key in foundations and abs(meta['withersM'] - spec['conformations'][key]['height']['target_m']) > .04:
                    report['warnings'].append('Target height differs from conformation design: ' + key)
                anchors = meta.get('anchors', {})
                for label in ('withers', 'saddle', 'eyes', 'muzzle', 'crest', 'tail'):
                    value = anchors.get(label)
                    if not value or any(len(p) != 3 for p in value) or not finite(value):
                        report['errors'].append('Missing/invalid ' + label + ' anchor: ' + key)
                if anchors.get('withers'):
                    fitted = anchors['withers'][0][1] * meta['fitScale'] + meta['fitY']
                    if abs(fitted - manifest['canonicalWithers']) > .005:
                        report['errors'].append('Withers anchor fit is inconsistent: ' + key)
            if len(set(path for _, path in files)) != 24:
                report['errors'].append('Expected 24 distinct foundation GLB files')
            report.update(roster_ids=len(roster), foundation_files=len(files), resolved_aliases=len(aliases),
                          explicit_legacy_dragons=sorted(legacy))
        for key, path in files:
            asset = inspect(path, reference, args.tolerance, keep_cloud=True); asset['id'] = key
            report['assets'].append(asset)
        for hash_key in ('geometry_hash', 'principal_body_geometry_hash'):
            groups = {}
            for asset in report['assets']:
                if hash_key in asset:
                    groups.setdefault(asset[hash_key], []).append(asset['id'])
            duplicates = [ids for ids in groups.values() if len(ids) > 1]
            if duplicates:
                report['errors'].append(hash_key + ' duplicates after removing scale/translation: ' + str(duplicates))
        # Hash quantization has cell boundaries. This independent tolerance
        # comparison also catches scale-only exports rounded back to FLOAT32.
        for index, left in enumerate(report['assets']):
            a = left.get('_principal_cloud')
            if not a:
                continue
            for right in report['assets'][index + 1:]:
                b = right.get('_principal_cloud')
                if b and len(a) == len(b) and all(max(abs(x-y) for x, y in zip(p, q)) < 2e-5 for p, q in zip(a, b)):
                    report['errors'].append('Principal body is only scaled/translated within FLOAT32 tolerance: ' + left['id'] + ', ' + right['id'])
        for asset in report['assets']:
            asset.pop('_principal_cloud', None)
        report['passed'] = not report['errors'] and all(asset['passed'] for asset in report['assets'])
    except (ValueError, KeyError, IndexError, TypeError, OSError) as error:
        report['errors'].append(str(error))
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    summary = {key: report[key] for key in ('passed', 'scope', 'errors', 'warnings') if key in report}
    summary['asset_count'] = len(report['assets'])
    summary['failed_assets'] = {a.get('id', a['file']): a['errors'] for a in report['assets'] if not a['passed']}
    summary['report'] = str(args.report.resolve())
    print(json.dumps(summary, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
