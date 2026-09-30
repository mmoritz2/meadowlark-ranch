#!/usr/bin/env python3
"""Inspect and register an approved horse source without extracting or executing it.

Usage:
    python3 tools/asset-gen/register-horse-import.py --candidate bluemesh-draft --file /path/horse.zip
    python3 tools/asset-gen/register-horse-import.py --candidate arabian-sculpt --file /path/CABALLO_ARABE.obj --file /path/BASE.obj
    python3 tools/asset-gen/register-horse-import.py --inspect-only --file /path/horse.glb

The catalog is assets/models/horse-imports/catalog.json. Acquisition does not
certify authorship, license compliance, anatomy, rig quality or game compatibility.
Repeated --file inputs preserve every original and per-file receipt. The first
file is primary for a new candidate; adding files retains an existing primary.
"""
from __future__ import annotations

import argparse
import base64
from datetime import datetime
import gzip
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import struct
import sys
import tempfile
import unicodedata
import zipfile
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
IMPORTS = ROOT / 'assets/models/horse-imports'
CATALOG = IMPORTS / 'catalog.json'
MODEL_SUFFIXES = {'.blend', '.glb', '.gltf', '.fbx', '.obj', '.stl'}
SUPPLEMENTAL_SUFFIXES = {'.abc', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp',
                         '.tga', '.tif', '.tiff', '.exr', '.hdr', '.dds', '.ktx', '.ktx2'}
SCRIPT_SUFFIXES = {'.py', '.pyc', '.js', '.mjs', '.cjs', '.sh', '.bash', '.zsh',
                   '.bat', '.cmd', '.ps1', '.exe', '.dll', '.so', '.dylib', '.app',
                   '.msi', '.pkg', '.dmg', '.jar', '.wasm'}
EXECUTABLE_MAGIC = (b'MZ', b'\x7fELF', b'\xcf\xfa\xed\xfe', b'\xce\xfa\xed\xfe',
                    b'\xfe\xed\xfa\xcf', b'\xfe\xed\xfa\xce', b'\xca\xfe\xba\xbe')
PARTIAL_DOWNLOAD_SUFFIXES = ('.crdownload', '.part', '.partial', '.download')


def reject_partial_download(path):
    # Check parent components too: Safari keeps unfinished files in a .download
    # directory. The CLI also checks the unresolved path so an alias cannot hide
    # its partial-download name when resolve() follows a symlink.
    if any(part.casefold().endswith(PARTIAL_DOWNLOAD_SUFFIXES) for part in Path(path).parts):
        raise ValueError(f'Incomplete browser download is not a model import: {path}. Wait for the download to finish.')


def digest(path):
    h = hashlib.sha256()
    size = 0
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
            size += len(block)
    return h.hexdigest(), size


def image_format(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'jpeg'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'webp'
    if data.startswith(b'\xabKTX 20\xbb\r\n\x1a\n'):
        return 'ktx2'
    if data.startswith((b'GIF87a', b'GIF89a')):
        return 'gif'
    return 'unknown'


def indexed(items, index, label):
    if type(index) is not int or not 0 <= index < len(items):
        raise ValueError(f'Invalid {label} index: {index!r}')
    item = items[index]
    if not isinstance(item, dict):
        raise ValueError(f'Invalid {label} record')
    return item


def buffer_view(doc, binary, index):
    view = indexed(doc.get('bufferViews', []), index, 'buffer view')
    buffers = doc.get('buffers', [])
    buffer = indexed(buffers, view.get('buffer', 0), 'buffer')
    if view.get('buffer', 0) != 0 or buffer.get('uri') or binary is None:
        return None
    start, length = view.get('byteOffset', 0), view.get('byteLength')
    if type(start) is not int or type(length) is not int or start < 0 or length < 0 or start + length > len(binary):
        raise ValueError('Buffer view exceeds embedded GLB binary')
    return binary[start:start + length]


def position_bounds(doc, binary, index):
    """Decoded mesh-local rest bounds; never imply scene/animated bounds."""
    accessor = indexed(doc.get('accessors', []), index, 'position accessor')
    if accessor.get('type') != 'VEC3' or accessor.get('componentType') != 5126 or accessor.get('normalized'):
        return None
    if accessor.get('sparse') or 'bufferView' not in accessor:
        return None
    data = buffer_view(doc, binary, accessor['bufferView'])
    if data is None:
        return None
    view = doc['bufferViews'][accessor['bufferView']]
    count, offset, stride = accessor.get('count'), accessor.get('byteOffset', 0), view.get('byteStride', 12)
    if (type(count) is not int or count <= 0 or type(offset) is not int or offset < 0
            or type(stride) is not int or stride < 12 or stride % 4
            or offset + (count - 1) * stride + 12 > len(data)):
        raise ValueError('Invalid FLOAT VEC3 position accessor layout')
    low, high = [math.inf] * 3, [-math.inf] * 3
    unpack = struct.Struct('<3f').unpack_from
    for i in range(count):
        values = unpack(data, offset + i * stride)
        if not all(math.isfinite(v) for v in values):
            raise ValueError('Non-finite vertex position')
        for axis, value in enumerate(values):
            low[axis] = min(low[axis], value)
            high[axis] = max(high[axis], value)
    return {'min': low, 'max': high, 'space': 'mesh-local rest geometry',
            'method': 'decoded FLOAT VEC3 positions; not scene or animated bounds'}


def summarize_gltf(doc, binary=None):
    if not isinstance(doc, dict) or not isinstance(doc.get('asset'), dict) or doc['asset'].get('version') != '2.0':
        raise ValueError('Expected a glTF 2.0 asset JSON document')
    nodes, accessors = doc.get('nodes', []), doc.get('accessors', [])
    meshes, triangle_count = [], 0
    for mesh_index, mesh in enumerate(doc.get('meshes', [])):
        primitives = []
        for primitive in mesh.get('primitives', []):
            attributes = primitive.get('attributes', {})
            mode = primitive.get('mode', 4)
            if 'indices' in primitive:
                accessor = indexed(accessors, primitive['indices'], 'index accessor')
                if accessor.get('type') != 'SCALAR':
                    raise ValueError('Mesh indices must use a SCALAR accessor')
            elif 'POSITION' in attributes:
                accessor = indexed(accessors, attributes['POSITION'], 'position accessor')
            else:
                accessor = None
            count = accessor.get('count') if accessor else None
            if count is not None and (type(count) is not int or count < 0):
                raise ValueError('Invalid primitive accessor count')
            triangles = None if count is None else count // 3 if mode == 4 else max(0, count - 2) if mode in (5, 6) else 0
            if mode == 4 and count is not None and count % 3:
                raise ValueError('Triangle primitive count is not divisible by three')
            row = {'mode': mode, 'elementCount': count, 'trianglesFromAccessorCount': triangles}
            if 'POSITION' in attributes:
                bounds = position_bounds(doc, binary, attributes['POSITION'])
                if bounds is not None:
                    row['bounds'] = bounds
            primitives.append(row)
            triangle_count += triangles or 0
        meshes.append({'index': mesh_index, 'name': mesh.get('name'), 'primitives': primitives})
    skins = []
    for skin in doc.get('skins', []):
        joints = skin.get('joints', [])
        skins.append({'name': skin.get('name'), 'jointCount': len(joints),
                      'jointNames': [indexed(nodes, joint, 'joint node').get('name') for joint in joints]})
    images = []
    for entry in doc.get('images', []):
        row = {'name': entry.get('name'), 'declaredMimeType': entry.get('mimeType')}
        data = None
        if 'bufferView' in entry:
            data = buffer_view(doc, binary, entry['bufferView'])
            row['storage'] = 'bufferView'
        elif entry.get('uri', '').startswith('data:'):
            header, payload = entry['uri'].split(',', 1)
            row['storage'] = 'data-uri'
            if ';base64' in header:
                data = base64.b64decode(payload, validate=True)
        else:
            row.update(storage='external-uri', uri=entry.get('uri'))
        row['detectedFormat'] = image_format(data) if data is not None else 'uninspected'
        if data is not None:
            row['bytes'] = len(data)
        images.append(row)
    return {'meshCount': len(meshes), 'meshes': meshes,
            'trianglesFromAccessorCounts': triangle_count,
            'triangleCountComplete': all(p['trianglesFromAccessorCount'] is not None for m in meshes for p in m['primitives']),
            'skins': skins, 'animations': [a.get('name') for a in doc.get('animations', [])],
            'images': images, 'extensionsUsed': doc.get('extensionsUsed', []),
            'externalDependencies': [b['uri'] for b in doc.get('buffers', []) if b.get('uri') and not b['uri'].startswith('data:')],
            'gameCompatibility': 'not-assessed',
            'note': 'Names and counts do not certify rig behavior, anatomy, material quality or game compatibility.'}


def inspect_glb(path):
    raw = path.read_bytes()
    if len(raw) < 20:
        raise ValueError('Truncated GLB header')
    magic, version, length = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2 or length != len(raw):
        raise ValueError('Invalid GLB signature, version or declared length')
    chunks, offset, first = {}, 12, True
    while offset < length:
        if offset + 8 > length:
            raise ValueError('Truncated GLB chunk header')
        size, kind = struct.unpack_from('<I4s', raw, offset)
        offset += 8
        if size % 4 or offset + size > length or kind in chunks:
            raise ValueError('Invalid GLB chunk size or duplicate chunk')
        if first and kind != b'JSON':
            raise ValueError('GLB first chunk must be JSON')
        chunks[kind] = raw[offset:offset + size]
        offset += size
        first = False
    if b'JSON' not in chunks:
        raise ValueError('GLB has no JSON chunk')
    doc = json.loads(chunks[b'JSON'].decode('utf-8'))
    return {'format': 'glb', 'version': version, **summarize_gltf(doc, chunks.get(b'BIN\x00'))}


def inspect_zip(path, *, allow_supplemental=False):
    model_files, supplemental_files, skipped, entries, seen = [], [], [], [], set()
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            name = info.orig_filename.replace('\\', '/')
            parts = PurePosixPath(name).parts
            if ('\x00' in name or not name or name.startswith('/') or re.match(r'^[A-Za-z]:', name)
                    or '..' in parts):
                raise ValueError(f'Unsafe ZIP path: {info.orig_filename!r}')
            normalized = str(PurePosixPath(name)).casefold()
            if normalized in seen:
                raise ValueError(f'Duplicate or ambiguous ZIP path: {name!r}')
            seen.add(normalized)
            mode = info.external_attr >> 16
            kind = stat.S_IFMT(mode)
            if stat.S_ISLNK(mode) or kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                raise ValueError(f'ZIP symlink or special file is not accepted: {name!r}')
            if info.is_dir():
                continue
            row = {'name': name, 'bytes': info.file_size, 'compressedBytes': info.compress_size,
                   'encrypted': bool(info.flag_bits & 1)}
            entries.append(row)
            suffix = PurePosixPath(name).suffix.lower()
            if suffix in SCRIPT_SUFFIXES or mode & 0o111:
                skipped.append(name)
            elif suffix in MODEL_SUFFIXES:
                model_files.append({**row, 'formatFromFilename': suffix[1:]})
            elif suffix in SUPPLEMENTAL_SUFFIXES:
                supplemental_files.append({**row, 'formatFromFilename': suffix[1:]})
    if not model_files and not (allow_supplemental and supplemental_files):
        raise ValueError('ZIP contains no recognized model files after skipping executable/script entries')
    return {'format': 'zip', 'modelFiles': model_files, 'skippedExecutableOrScriptFiles': skipped,
            'entryCount': len(entries), 'uncompressedBytes': sum(e['bytes'] for e in entries),
            'supplementalFiles': supplemental_files, 'supplementalAcquisitionAllowed': allow_supplemental,
            'extracted': False, 'gameCompatibility': 'not-assessed',
            'note': 'ZIP member formats are filename hints; contents were not extracted, executed or certified.'}


def inspect_file(path, *, allow_supplemental=False):
    reject_partial_download(path)
    if not path.is_file():
        raise ValueError(f'Source is not a regular file: {path}')
    with path.open('rb') as stream:
        head = stream.read(4096)
    stripped = head.lstrip(b'\xef\xbb\xbf \t\r\n')
    if path.suffix.lower() in SCRIPT_SUFFIXES or head.startswith(EXECUTABLE_MAGIC) or stripped.startswith(b'#!'):
        raise ValueError('Executable and script files are not model imports')
    if re.search(br'<(?:!doctype\s+html|html|head|body|form)\b', stripped[:4096], re.I):
        raise ValueError('HTML/login-page content is not a downloaded model')
    if head.startswith(b'glTF'):
        return inspect_glb(path)
    if head.startswith((b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08')):
        return inspect_zip(path, allow_supplemental=allow_supplemental)
    if allow_supplemental and path.suffix.lower() == '.abc' and head.startswith(b'Ogawa\xff\x00\x01'):
        return {'format': 'abc', 'inspection': 'Ogawa-header-only', 'gameCompatibility': 'not-assessed'}
    blend_head = head
    compressed = False
    if head.startswith(b'\x1f\x8b'):
        with gzip.open(path, 'rb') as stream:
            blend_head = stream.read(12)
        compressed = True
    if blend_head.startswith(b'BLENDER'):
        if len(blend_head) < 12 or blend_head[7:8] not in (b'_', b'-') or blend_head[8:9] not in (b'v', b'V') or not blend_head[9:12].isdigit():
            raise ValueError('Invalid Blender file header')
        return {'format': 'blend', 'versionHeader': blend_head[9:12].decode('ascii'),
                'compressed': compressed, 'gameCompatibility': 'not-assessed', 'openedOrExecuted': False}
    if head.startswith(b'Kaydara FBX Binary  \x00\x1a\x00'):
        if len(head) < 27:
            raise ValueError('Truncated binary FBX header')
        return {'format': 'fbx', 'encoding': 'binary', 'version': struct.unpack_from('<I', head, 23)[0],
                'gameCompatibility': 'not-assessed'}
    if stripped.startswith(b'{'):
        doc = json.loads(path.read_text(encoding='utf-8-sig'))
        return {'format': 'gltf', **summarize_gltf(doc)}
    size = path.stat().st_size
    if size >= 84:
        with path.open('rb') as stream:
            stream.seek(80)
            facets = struct.unpack('<I', stream.read(4))[0]
        if size == 84 + 50 * facets and facets > 0:
            return {'format': 'stl', 'encoding': 'binary', 'triangles': facets, 'gameCompatibility': 'not-assessed'}
    try:
        text = path.read_text(encoding='utf-8-sig')
    except UnicodeError:
        raise ValueError('Unrecognized model signature') from None
    if re.match(r'^;\s*FBX\s+\d', text.lstrip()) and 'FBXHeaderExtension:' in text:
        return {'format': 'fbx', 'encoding': 'ascii', 'gameCompatibility': 'not-assessed'}
    if re.match(r'^solid(?:\s|$)', text.lstrip()) and re.search(r'\bendsolid[^\n]*\s*$', text):
        facets = re.findall(r'^\s*facet\s+normal\s+', text, re.M)
        if facets and len(re.findall(r'^\s*vertex\s+', text, re.M)) == len(facets) * 3:
            return {'format': 'stl', 'encoding': 'ascii', 'triangles': len(facets), 'gameCompatibility': 'not-assessed'}
    # Some ZBrush OBJ exports end with exactly one C-string NUL terminator.
    # Ignore that marker only for this identified text format, never embedded
    # NULs or arbitrary unknown records; copied originals remain byte-exact.
    zbrush_terminator = (text.endswith('\x00') and '\x00' not in text[:-1]
        and re.match(r'^# File exported by ZBrush version \d+(?:\.\d+)*\r?\n', text) is not None)
    if zbrush_terminator:
        text = text[:-1]
    vertices, faces = 0, 0
    obj_only = True
    for line in text.splitlines():
        fields = line.split('#', 1)[0].split()
        if not fields:
            continue
        if fields[0] not in {'v', 'vn', 'vt', 'vp', 'f', 'l', 'p', 'o', 'g', 's', 'usemtl', 'mtllib'}:
            obj_only = False
            break
        if fields[0] == 'v':
            if len(fields) < 4 or not all(math.isfinite(float(v)) for v in fields[1:4]):
                raise ValueError('Invalid OBJ vertex')
            vertices += 1
        elif fields[0] == 'f':
            if len(fields) < 4 or not all(re.fullmatch(r'-?\d+(?:/-?\d*)?(?:/-?\d+)?', v) for v in fields[1:]):
                raise ValueError('Invalid OBJ face')
            faces += 1
    if obj_only and vertices >= 3 and faces:
        result = {'format': 'obj', 'vertexLines': vertices, 'faceLines': faces, 'gameCompatibility': 'not-assessed'}
        if zbrush_terminator:
            result.update(trailingZBrushNulTerminator=True,
                inspectionNote='One terminal ZBrush text NUL ignored during inspection; original bytes preserved.')
        return result
    raise ValueError('Unrecognized model signature; expected ZIP, Blender, GLB/glTF, FBX, OBJ or STL')


def candidate_source(candidate_id):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', candidate_id):
        raise ValueError('Candidate ID must contain only letters, digits, underscores or hyphens')
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    if catalog.get('schemaVersion') != 1 or not isinstance(catalog.get('candidates'), list):
        raise ValueError('Expected catalog schemaVersion 1 with a candidates list')
    matches = [c for c in catalog['candidates'] if isinstance(c, dict) and c.get('id') == candidate_id]
    if len(matches) != 1 or matches[0].get('userApproved') is not True:
        raise ValueError(f'Candidate must appear exactly once and be user-approved in the catalog: {candidate_id}')
    source_dir = matches[0].get('sourceDir')
    if not isinstance(source_dir, str) or not source_dir or Path(source_dir).is_absolute() or '..' in Path(source_dir).parts:
        raise ValueError('Catalog sourceDir must be a safe repository-relative path')
    allowed = IMPORTS / candidate_id / 'source'
    destination = (ROOT / source_dir).resolve()
    if not destination.is_relative_to(allowed):
        raise ValueError(f'Catalog sourceDir must stay under {allowed.relative_to(ROOT)}')
    return destination


def receipt_bytes(receipt):
    return (json.dumps(receipt, indent=2, allow_nan=False)+'\n').encode('utf-8')


def validate_receipt_record(record, candidate_id, destination):
    filename = record.get('filename')
    if (record.get('schemaVersion') != 1 or record.get('candidateId') != candidate_id
            or record.get('status') != 'source-acquired'
            or not isinstance(filename, str) or filename in ('', '.', '..')
            or Path(filename).name != filename or '/' in filename or '\\' in filename
            or filename.casefold() in ('receipt.json', 'receipts')
            or not isinstance(record.get('sha256'), str)
            or not re.fullmatch(r'[0-9a-f]{64}', record['sha256'])
            or type(record.get('bytes')) is not int or record['bytes'] < 0
            or not isinstance(record.get('inspection'), dict)):
        raise ValueError('Invalid existing per-file source receipt')
    target = destination / filename
    if record.get('path') != str(target.relative_to(ROOT)):
        raise ValueError('Receipt path does not match staged original')
    if target.is_symlink() or not target.is_file() or digest(target) != (record['sha256'], record['bytes']):
        raise ValueError(f'Existing staged original disagrees with its receipt: {target}')


def publish_original(source, target, expected):
    """Publish exact bytes without overwriting a previous acquisition."""
    if target.exists():
        if target.is_symlink() or not target.is_file() or digest(target) != expected:
            raise ValueError(f'Staged filename already has different content: {target}')
        return
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.source-', delete=False) as stream:
        temporary = Path(stream.name)
    try:
        shutil.copyfile(source, temporary)
        if digest(temporary) != expected:
            raise ValueError('Source changed while being staged; retry with a stable file')
        try:
            os.link(temporary, target)
        except FileExistsError:
            if target.is_symlink() or digest(target) != expected:
                raise ValueError(f'Staged filename already has different content: {target}') from None
    finally:
        temporary.unlink(missing_ok=True)


def register_files(candidate_id, sources):
    """Preflight a complete batch, then retain a primary and immutable receipts."""
    if not sources:
        raise ValueError('At least one inspected source is required')
    destination = candidate_source(candidate_id)
    canonical = destination / 'receipt.json'
    if canonical.is_symlink() or (canonical.exists() and not canonical.is_file()):
        raise ValueError('Expected a regular canonical source receipt')
    existing = json.loads(canonical.read_text(encoding='utf-8')) if canonical.exists() else None
    if existing is not None and not isinstance(existing, dict):
        raise ValueError('Invalid canonical source receipt')
    records, copy_records = [], []
    if existing:
        records = existing.get('files', [existing])
        if not isinstance(records, list) or not records:
            raise ValueError('Expected existing per-file receipt records')
        records = [dict(row) for row in records]
        for row in records:
            validate_receipt_record(row, candidate_id, destination)
        if not any(all(row.get(k) == existing.get(k) for k in ('filename', 'path', 'sha256', 'bytes')) for row in records):
            raise ValueError('Canonical primary is absent from per-file receipts')
    keys = {}
    for row in records:
        key = unicodedata.normalize('NFC', row['filename']).casefold()
        if key in keys:
            raise ValueError('Duplicate or case-colliding receipt filenames')
        keys[key] = row
    imported_at = datetime.now(ZoneInfo('America/Chicago')).isoformat(timespec='seconds')
    # Inspect and check every requested path before any originals are published.
    for source, inspection in sources:
        reject_partial_download(source)
        if (source.name.casefold() in ('receipt.json', 'receipts')
                or '\\' in source.name or ':' in source.name
                or source.name.rstrip(' .') != source.name):
            raise ValueError('Source filename is reserved for import metadata')
        source_hash, source_size = digest(source)
        target = destination / source.name
        if target.is_symlink() or (target.exists() and
                (not target.is_file() or digest(target) != (source_hash, source_size))):
            raise ValueError(f'Staged filename already has different content: {target}')
        key = unicodedata.normalize('NFC', source.name).casefold()
        previous = keys.get(key)
        if previous:
            if (previous['filename'], previous['sha256'], previous['bytes']) != (source.name, source_hash, source_size):
                raise ValueError('Duplicate or case-colliding source filenames differ')
            continue
        record = {'schemaVersion': 1, 'candidateId': candidate_id, 'status': 'source-acquired',
                  'importedAtLocal': imported_at, 'importTimezone': 'America/Chicago',
                  'originalPath': str(source), 'filename': source.name,
                  'path': str(target.relative_to(ROOT)), 'bytes': source_size,
                  'sha256': source_hash, 'inspection': inspection,
                  'gameCompatibility': 'not-assessed'}
        records.append(record)
        keys[key] = record
        copy_records.append((source, target, (source_hash, source_size)))
    receipt_dir = destination / 'receipts'
    if receipt_dir.is_symlink() or (receipt_dir.exists() and not receipt_dir.is_dir()):
        raise ValueError('Expected a regular per-file receipt directory')
    destination.mkdir(parents=True, exist_ok=True)
    for source, target, expected in copy_records:
        publish_original(source, target, expected)
    for row in records:
        validate_receipt_record(row, candidate_id, destination)
    receipt_dir.mkdir(exist_ok=True)
    for row in records:
        data = dict(row)
        data.pop('receiptPath', None)
        data.pop('files', None)
        data.pop('fileCount', None)
        encoded = receipt_bytes(data)
        target = receipt_dir / (hashlib.sha256(encoded).hexdigest()+'.json')
        if target.is_symlink() or (target.exists() and target.read_bytes() != encoded):
            raise ValueError('Existing immutable per-file receipt differs')
        if not target.exists():
            with tempfile.NamedTemporaryFile(dir=receipt_dir, prefix='.receipt-', delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(encoded)
            try:
                try:
                    os.link(temporary, target)
                except FileExistsError:
                    if target.is_symlink() or target.read_bytes() != encoded:
                        raise ValueError('Concurrent per-file receipt differs') from None
            finally:
                temporary.unlink(missing_ok=True)
        row['receiptPath'] = str(target.relative_to(ROOT))
    primary_name = existing['filename'] if existing else records[0]['filename']
    primary = next(row for row in records if row['filename'] == primary_name)
    receipt = {**primary, 'fileCount': len(records), 'files': records}
    encoded = receipt_bytes(receipt)
    if canonical.exists() and canonical.read_bytes() == encoded:
        return receipt
    with tempfile.NamedTemporaryFile(dir=destination, prefix='.receipt-', delete=False) as stream:
        temporary = Path(stream.name)
        stream.write(encoded)
    try:
        os.replace(temporary, destination / 'receipt.json')
    finally:
        temporary.unlink(missing_ok=True)
    return receipt


def register(candidate_id, source, inspection):
    # Preserve callers of the original single-source API.
    return register_files(candidate_id, [(source, inspection)])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--candidate', help='Approved candidate ID in the horse import catalog')
    parser.add_argument('--file', required=True, type=Path, action='append',
                        help='An already downloaded local model or ZIP; repeat to preserve separate originals')
    parser.add_argument('--inspect-only', action='store_true', help='Inspect without staging, reading the catalog or writing a receipt')
    parser.add_argument('--allow-supplemental', action='store_true', help='Explicitly preserve same-source texture archives or Alembic caches; extraction verifies their signatures')
    args = parser.parse_args()
    if not args.inspect_only and not args.candidate:
        parser.error('--candidate is required unless --inspect-only is used')
    try:
        sources = []
        for requested in args.file:
            reject_partial_download(requested.expanduser())
            source = requested.expanduser().resolve(strict=True)
            reject_partial_download(source)
            sources.append((source, inspect_file(source, allow_supplemental=args.allow_supplemental)))
        if args.inspect_only:
            results = []
            for source, inspection in sources:
                source_hash, source_size = digest(source)
                results.append({'filename': source.name, 'bytes': source_size, 'sha256': source_hash, 'inspection': inspection})
            result = results[0] if len(results) == 1 else {'fileCount': len(results), 'files': results}
        else:
            result = register_files(args.candidate, sources)
        print(json.dumps(result, indent=2, allow_nan=False))
    except (OSError, ValueError, KeyError, TypeError, AttributeError, struct.error, zipfile.BadZipFile, EOFError) as exc:
        print(f'Import refused: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
