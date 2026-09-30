#!/usr/bin/env python3
"""Safely unpack a registered horse source into its candidate/work directory.

Usage: python3 tools/asset-gen/extract-horse-import.py --candidate bluemesh-draft
       python3 tools/asset-gen/extract-horse-import.py --candidate arabian-sculpt --filename BASE.obj

Only the staged source recorded in source/receipt.json is read. Originals are
preserved. Extraction is data preparation, not a game-ready certification. No
downloaded script or Blender file is executed or opened in Blender.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import struct
import sys
import tempfile
import unicodedata
import zipfile

ROOT = Path(__file__).resolve().parents[2]
IMPORTS = ROOT / 'assets/models/horse-imports'
CATALOG = IMPORTS / 'catalog.json'
MODEL_SUFFIXES = {'.blend', '.glb', '.gltf', '.fbx', '.obj', '.stl'}
TEXTURE_SUFFIXES = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tga',
                    '.tif', '.tiff', '.exr', '.hdr', '.dds', '.ktx', '.ktx2'}
DOCUMENT_SUFFIXES = {'.json', '.mtl', '.txt', '.md'}
DATA_SUFFIXES = MODEL_SUFFIXES | TEXTURE_SUFFIXES | DOCUMENT_SUFFIXES | {'.bin', '.abc'}
INSPECT_LIMIT = 64 * 1024 * 1024
DOCUMENT_LIMIT = 16 * 1024 * 1024
BLOCK = 1024 * 1024


def registration_module():
    # This imports our own trusted inspector, never a downloaded source module.
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location(
            'horse_source_registration', Path(__file__).with_name('register-horse-import.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        sys.dont_write_bytecode = previous


def safe_name(name):
    if (not isinstance(name, str) or not name or '\x00' in name
            or name.startswith(('/', '\\')) or '\\' in name or ':' in name):
        raise ValueError(f'Unsafe archive path: {name!r}')
    parts = name.rstrip('/').split('/')
    if any(p in ('', '.', '..') or p.rstrip(' .') != p for p in parts):
        raise ValueError(f'Unsafe archive path: {name!r}')
    if any(re.fullmatch(r'(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?', p, re.I)
           for p in parts):
        raise ValueError(f'Nonportable reserved archive path: {name!r}')
    return '/'.join(parts)


def path_key(name):
    return unicodedata.normalize('NFC', name).casefold()


def checked_path(path, boundary, *, directory=False, create=False):
    """Reject symlinks in every existing component under a trusted boundary."""
    path, boundary = Path(path), Path(boundary)
    if not path.is_relative_to(boundary):
        raise ValueError(f'Path escapes allowed directory: {path}')
    current = boundary
    for part in ((), *[(p,) for p in path.relative_to(boundary).parts]):
        if part:
            current = current / part[0]
        try:
            mode = current.lstat().st_mode
        except FileNotFoundError:
            if create:
                current.mkdir()
                mode = current.lstat().st_mode
            else:
                continue
        if stat.S_ISLNK(mode):
            raise ValueError(f'Symlink path is not accepted: {current}')
        if current != path or directory:
            if not stat.S_ISDIR(mode):
                raise ValueError(f'Expected a directory: {current}')
    return path


def open_regular(path):
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise ValueError(f'Expected a regular file: {path}')
    return os.fdopen(fd, 'rb')


def stream_digest(stream):
    stream.seek(0)
    result, size = hashlib.sha256(), 0
    for block in iter(lambda: stream.read(BLOCK), b''):
        result.update(block)
        size += len(block)
    stream.seek(0)
    return result.hexdigest(), size


def file_digest(path):
    with open_regular(path) as stream:
        return stream_digest(stream)


def read_json(path):
    with open_regular(path) as stream:
        if os.fstat(stream.fileno()).st_size > DOCUMENT_LIMIT:
            raise ValueError(f'JSON metadata is too large: {path}')
        return json.load(stream)


def registered_source(candidate_id, filename=None):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', candidate_id):
        raise ValueError('Invalid candidate ID')
    checked_path(CATALOG, ROOT)
    catalog = read_json(CATALOG)
    if catalog.get('schemaVersion') != 1 or not isinstance(catalog.get('candidates'), list):
        raise ValueError('Expected catalog schemaVersion 1 with a candidates list')
    matches = [c for c in catalog['candidates'] if isinstance(c, dict) and c.get('id') == candidate_id]
    if len(matches) != 1 or matches[0].get('userApproved') is not True:
        raise ValueError('Candidate must appear once and be user-approved in the catalog')
    candidate = IMPORTS / candidate_id
    source_dir = candidate / 'source'
    relative = matches[0].get('sourceDir')
    if not isinstance(relative, str) or ROOT / safe_name(relative) != source_dir:
        raise ValueError('Catalog sourceDir must be the candidate/source directory')
    checked_path(source_dir, ROOT, directory=True)
    receipt = read_json(source_dir / 'receipt.json')
    if (receipt.get('schemaVersion') != 1 or receipt.get('candidateId') != candidate_id
            or receipt.get('status') != 'source-acquired'):
        raise ValueError('Expected this candidate\'s source-acquired receipt')
    records = receipt.get('files', [receipt])
    if not isinstance(records, list) or not records or not all(isinstance(row, dict) for row in records):
        raise ValueError('Expected valid per-file source receipts')
    names = [safe_name(row.get('filename')) for row in records]
    if len(set(path_key(name) for name in names)) != len(names) or any('/' in name for name in names):
        raise ValueError('Duplicate or invalid registered filenames')
    if not any(all(row.get(k) == receipt.get(k) for k in ('filename', 'path', 'sha256', 'bytes')) for row in records):
        raise ValueError('Canonical source is absent from per-file receipts')
    if filename is not None:
        name = safe_name(filename)
        matches = [row for row in records if row.get('filename') == name]
        if len(matches) != 1:
            raise ValueError('Requested filename must be explicitly registered for this candidate')
        receipt = matches[0]
        if (receipt.get('schemaVersion') != 1 or receipt.get('candidateId') != candidate_id
                or receipt.get('status') != 'source-acquired'):
            raise ValueError('Expected a valid selected per-file receipt')
    filename = safe_name(receipt.get('filename'))
    if '/' in filename or filename.casefold() == 'receipt.json':
        raise ValueError('Invalid receipt filename')
    source = source_dir / filename
    if receipt.get('path') != str(source.relative_to(ROOT)):
        raise ValueError('Receipt path does not match the candidate staged original')
    if (not isinstance(receipt.get('sha256'), str)
            or not re.fullmatch(r'[0-9a-f]{64}', receipt['sha256'])
            or type(receipt.get('bytes')) is not int or receipt['bytes'] < 0
            or not isinstance(receipt.get('inspection'), dict)):
        raise ValueError('Invalid receipt hash, size or inspection')
    checked_path(source, ROOT)
    if receipt.get('receiptPath'):
        metadata = ROOT / safe_name(receipt['receiptPath'])
        if not metadata.is_relative_to(source_dir / 'receipts'):
            raise ValueError('Per-file receipt path escapes candidate/source/receipts')
        checked_path(metadata, ROOT)
        original_record = read_json(metadata)
        if {k: v for k, v in receipt.items() if k not in ('receiptPath', 'files', 'fileCount')} != original_record:
            raise ValueError('Selected source metadata disagrees with immutable per-file receipt')
    return candidate, source, receipt


def zip_plan(archive, receipt, inspector, limits, members=()):
    infos = archive.infolist()
    if len(infos) > limits['maxEntries']:
        raise ValueError('ZIP exceeds the entry count limit')
    skipped_receipt = {path_key(safe_name(n)) for n in
                       receipt['inspection'].get('skippedExecutableOrScriptFiles', [])}
    seen, files, total, compressed, plan = {}, set(), 0, 0, []
    selections = [safe_name(member) + ('/' if member.endswith('/') else '') for member in members]
    matched = set()
    for info in infos:
        name = safe_name(info.orig_filename)
        key = path_key(name)
        if key in seen:
            raise ValueError(f'Duplicate or ambiguous ZIP path: {name!r}')
        seen[key] = name
        mode = info.external_attr >> 16
        kind = stat.S_IFMT(mode)
        if kind not in (0, stat.S_IFREG, stat.S_IFDIR) or stat.S_ISLNK(mode):
            raise ValueError(f'ZIP symlink or special file: {name!r}')
        directory = info.is_dir()
        if kind == stat.S_IFDIR and not directory or kind == stat.S_IFREG and directory:
            raise ValueError(f'Conflicting ZIP entry type: {name!r}')
        if info.flag_bits & 1:
            raise ValueError(f'Encrypted ZIP entry is not accepted: {name!r}')
        if info.file_size < 0 or info.compress_size < 0:
            raise ValueError('Invalid ZIP size')
        if directory:
            if info.file_size:
                raise ValueError('ZIP directory contains payload bytes')
            continue
        files.add(key)
        selected = not selections
        for selection in selections:
            if name == selection or selection.endswith('/') and name.startswith(selection):
                matched.add(selection)
                selected = True
        if selected:
            total += info.file_size
            compressed += info.compress_size
            if total > limits['maxUncompressedBytes']:
                raise ValueError('ZIP exceeds the selected uncompressed byte limit')
            if info.file_size / max(1, info.compress_size) > limits['maxRatio']:
                raise ValueError(f'ZIP member exceeds the compression ratio limit: {name!r}')
        suffix = PurePosixPath(name).suffix.lower()
        reason = None if selected else 'not-explicitly-selected'
        if key in skipped_receipt or suffix in inspector.SCRIPT_SUFFIXES or mode & 0o111:
            reason = 'registration-listed-or-executable-or-script'
        elif suffix not in DATA_SUFFIXES:
            reason = 'unsupported-data-file-type'
        plan.append((info, name, reason))
    if total / max(1, compressed) > limits['maxRatio']:
        raise ValueError('ZIP exceeds the aggregate compression ratio limit')
    if set(selections) != matched:
        raise ValueError('Every selected archive member or directory must exist')
    for key, name in seen.items():
        parts = key.split('/')
        if any('/'.join(parts[:i]) in files for i in range(1, len(parts))):
            raise ValueError(f'ZIP file/directory collision: {name!r}')
    return plan, total


def texture_signature(suffix, head):
    signatures = {
        '.png': head.startswith(b'\x89PNG\r\n\x1a\n'),
        '.jpg': head.startswith(b'\xff\xd8\xff'),
        '.jpeg': head.startswith(b'\xff\xd8\xff'),
        '.webp': head[:4] == b'RIFF' and head[8:12] == b'WEBP',
        '.gif': head.startswith((b'GIF87a', b'GIF89a')),
        '.bmp': head.startswith(b'BM') and len(head) >= 54,
        '.tif': head.startswith((b'II*\x00', b'MM\x00*', b'II+\x00', b'MM\x00+')),
        '.tiff': head.startswith((b'II*\x00', b'MM\x00*', b'II+\x00', b'MM\x00+')),
        '.exr': head.startswith(b'v/1\x01'),
        '.hdr': head.startswith((b'#?RADIANCE', b'#?RGBE')),
        '.dds': head.startswith(b'DDS '),
        '.ktx': head.startswith(b'\xabKTX 11\xbb\r\n\x1a\n'),
        '.ktx2': head.startswith(b'\xabKTX 20\xbb\r\n\x1a\n'),
    }
    if suffix == '.tga':
        return (len(head) >= 18 and head[1] in (0, 1) and head[2] in (1, 2, 3, 9, 10, 11)
                and head[16] in (8, 15, 16, 24, 32)
                and struct.unpack_from('<HH', head, 12)[0] > 0
                and struct.unpack_from('<HH', head, 12)[1] > 0)
    return signatures.get(suffix, False)


def inspect_data(path, inspector):
    suffix = path.suffix.lower()
    with path.open('rb') as stream:
        head = stream.read(4096)
    stripped = head.lstrip(b'\xef\xbb\xbf \t\r\n')
    if head.startswith(inspector.EXECUTABLE_MAGIC) or stripped.startswith(b'#!'):
        return None, 'detected-executable-or-script-signature'
    if re.match(br'(?:import\s+\w|from\s+\w+\s+import|def\s+\w+\s*\(|'
                br'(?:const|let|var)\s+\w+\s*=|function\s+\w*\s*\(|'
                br'Invoke-Expression\b|powershell\b)', stripped, re.I):
        return None, 'detected-script-like-content'
    if re.search(br'<(?:!doctype\s+html|html|head|body|form|script)\b', stripped, re.I):
        return None, 'detected-html-or-script-content'
    size = path.stat().st_size
    if suffix == '.abc':
        if not head.startswith(b'Ogawa\xff\x00\x01'):
            raise ValueError('Expected an Ogawa Alembic cache header')
        return {'format': 'abc', 'inspection': 'Ogawa-header-only', 'openedOrExecuted': False}, None
    if suffix in MODEL_SUFFIXES:
        # Full trusted inspector on reasonably sized assets; large data uses
        # bounded signature checks to avoid an unbounded in-memory GLB/OBJ read.
        if size <= INSPECT_LIMIT or suffix == '.blend':
            result = inspector.inspect_file(path)
            if result['format'] != suffix[1:]:
                raise ValueError(f'Model extension disagrees with inspected contents: {path.name}')
            return result, None
        valid = False
        if suffix == '.glb' and len(head) >= 20:
            magic, version, length = struct.unpack_from('<4sII', head)
            valid = magic == b'glTF' and version == 2 and length == size and head[16:20] == b'JSON'
        elif suffix == '.fbx':
            valid = head.startswith(b'Kaydara FBX Binary  \x00\x1a\x00') or bool(
                re.match(br'^;\s*FBX\s+\d', stripped) and b'FBXHeaderExtension:' in head)
        elif suffix == '.stl':
            if size >= 84:
                valid = size == 84 + 50 * struct.unpack_from('<I', head, 80)[0]
            if not valid and re.match(br'^solid(?:\s|$)', stripped):
                with path.open('rb') as stream:
                    stream.seek(max(0, size - 4096))
                    valid = b'facet normal' in head and b'endsolid' in stream.read()
        elif suffix == '.obj':
            text = head.decode('utf-8-sig')
            valid = bool(re.search(r'^v\s+[-+\d.]', text, re.M)) and all(
                not line.strip() or line.lstrip().startswith('#') or line.split()[0] in
                {'v', 'vn', 'vt', 'vp', 'f', 'l', 'p', 'o', 'g', 's', 'usemtl', 'mtllib'}
                for line in text.rsplit('\n', 1)[0].splitlines())
        if not valid:
            raise ValueError(f'Unrecognized or oversized model contents: {path.name}')
        return {'format': suffix[1:], 'inspection': 'bounded-header-signature-only',
                'fullGeometryValidation': False}, None
    if suffix in TEXTURE_SUFFIXES:
        if not texture_signature(suffix, head):
            raise ValueError(f'Texture extension disagrees with its signature: {path.name}')
        return {'format': suffix[1:], 'inspection': 'header-signature-only'}, None
    if suffix == '.bin':
        if head.startswith((b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08')):
            return None, 'nested-archive-not-extracted'
        return {'format': 'binary-buffer', 'inspection': 'executable-signature-screen-only'}, None
    if size > DOCUMENT_LIMIT:
        return None, 'document-exceeds-inspection-limit'
    text = path.read_text(encoding='utf-8-sig')
    if '\x00' in text:
        raise ValueError(f'Binary contents in text document: {path.name}')
    if suffix == '.json':
        json.loads(text)
        return {'format': 'json', 'inspection': 'parsed-data-only'}, None
    if re.search(r'^\s*(?:import\s+\w|from\s+\w+\s+import|def\s+\w+\s*\(|'
                 r'(?:const|let|var)\s+\w+\s*=|function\s+\w*\s*\(|'
                 r'Invoke-Expression\b|powershell\b|<script\b)', text, re.M | re.I):
        return None, 'detected-script-like-document'
    return {'format': suffix[1:], 'inspection': 'utf8-data-document-only'}, None


def copy_bounded(stream, destination, expected, budget):
    total, h = 0, hashlib.sha256()
    with destination.open('xb') as output:
        while True:
            block = stream.read(min(BLOCK, expected - total + 1))
            if not block:
                break
            total += len(block)
            budget[0] += len(block)
            if total > expected or budget[0] > budget[1]:
                raise ValueError('Extracted payload exceeds declared size or byte limit')
            h.update(block)
            output.write(block)
    if total != expected:
        raise ValueError('Extracted payload size disagrees with ZIP metadata')
    os.chmod(destination, 0o644)
    return h.hexdigest(), total


def publish_no_overwrite(temporary, destination, boundary, expected):
    checked_path(destination.parent, boundary, directory=True, create=True)
    checked_path(destination, boundary)
    try:
        os.link(temporary, destination)
    except FileExistsError:
        if file_digest(destination) != expected:
            raise ValueError(f'Existing output has different content: {destination}') from None


def extract(candidate_id, *, filename=None, members=(), max_bytes=4 * 1024 ** 3, max_ratio=1000.0, max_entries=20000):
    limits = {'maxUncompressedBytes': max_bytes, 'maxRatio': max_ratio, 'maxEntries': max_entries}
    if type(max_bytes) is not int or max_bytes <= 0 or type(max_entries) is not int or max_entries <= 0:
        raise ValueError('Byte and entry limits must be positive integers')
    if not 1 <= max_ratio < float('inf'):
        raise ValueError('Compression ratio limit must be finite and at least one')
    inspector = registration_module()
    candidate, source, receipt = registered_source(candidate_id, filename=filename)
    expected_source = (receipt['sha256'], receipt['bytes'])
    with open_regular(source) as original, ExitStack() as resources:
        if stream_digest(original) != expected_source:
            raise ValueError('Staged original hash or size does not match its receipt')
        archive = None
        if receipt['inspection'].get('format') == 'zip':
            archive = resources.enter_context(zipfile.ZipFile(original))
            plan, declared_bytes = zip_plan(archive, receipt, inspector, limits, members)
        else:
            if source.suffix.lower() not in MODEL_SUFFIXES:
                raise ValueError('Receipt must identify a ZIP or a recognized standalone model')
            declared_bytes = receipt['bytes']
            if declared_bytes > max_bytes:
                raise ValueError('Standalone source exceeds the byte limit')
            plan = [(None, source.name, None)]
        work = checked_path(candidate / 'work', ROOT, directory=True, create=True)
        output_dir = work / 'extracted'
        checked_path(output_dir, work, directory=True)
        budget, files, skipped = [0, max_bytes], [], []
        try:
            with tempfile.TemporaryDirectory(dir=work, prefix='.extract-') as staging_name:
                staging = Path(staging_name)
                payload = staging / 'payload'
                payload.mkdir()
                for info, name, reason in plan:
                    if reason:
                        skipped.append({'name': name, 'reason': reason})
                        continue
                    temporary = payload / name
                    checked_path(temporary.parent, payload, directory=True, create=True)
                    if info is None:
                        original.seek(0)
                        content_hash, count = copy_bounded(original, temporary, declared_bytes, budget)
                    else:
                        with archive.open(info) as member:
                            content_hash, count = copy_bounded(member, temporary, info.file_size, budget)
                    inspection, reason = inspect_data(temporary, inspector)
                    if reason:
                        skipped.append({'name': name, 'reason': reason})
                        temporary.unlink()
                        continue
                    files.append({'name': name, 'bytes': count, 'sha256': content_hash,
                                  'inspection': inspection})
                accepted = MODEL_SUFFIXES | {'.abc'}
                if receipt['inspection'].get('supplementalAcquisitionAllowed'):
                    accepted |= TEXTURE_SUFFIXES
                if not any(PurePosixPath(f['name']).suffix.lower() in accepted for f in files):
                    raise ValueError('No signature-verified model data remains after screening')
                if stream_digest(original) != expected_source:
                    raise ValueError('Staged original changed during extraction')
                # Check every existing target before publishing any file.
                for row in files:
                    destination = checked_path(output_dir / row['name'], work)
                    if destination.exists() and file_digest(destination) != (row['sha256'], row['bytes']):
                        raise ValueError(f'Existing output has different content: {destination}')
                report = {'schemaVersion': 1, 'candidateId': candidate_id, 'status': 'source-extracted',
                          'sourcePath': str(source.relative_to(ROOT)), 'sourceSha256': receipt['sha256'],
                          'sourceBytes': receipt['bytes'], 'sourceHashVerified': True,
                          'outputDir': str(output_dir.relative_to(ROOT)), 'limits': limits,
                          'declaredUncompressedBytes': declared_bytes, 'files': files,
                          'selectedMembers': list(members),
                          'skippedFiles': skipped, 'openedOrExecuted': False,
                          'gameCompatibility': 'not-assessed',
                          'note': 'Extraction preserves originals and screens file data; it does not certify authorship, license compliance, geometry, rig behavior or game readiness. Blender files may contain embedded scripts; disable auto-execution when opening them.'}
                encoded = (json.dumps(report, indent=2, allow_nan=False) + '\n').encode('utf-8')
                report_hash = hashlib.sha256(encoded).hexdigest()
                report_path = work / f'extraction-report-{receipt["sha256"][:16]}-{report_hash[:12]}.json'
                checked_path(report_path, work)
                if report_path.exists() and file_digest(report_path) != (report_hash, len(encoded)):
                    raise ValueError('Existing extraction report has different content')
                for row in files:
                    publish_no_overwrite(payload / row['name'], output_dir / row['name'], work,
                                         (row['sha256'], row['bytes']))
                temporary_report = staging / '.report.json'
                temporary_report.write_bytes(encoded)
                publish_no_overwrite(temporary_report, report_path, work, (report_hash, len(encoded)))
                return {**report, 'reportPath': str(report_path.relative_to(ROOT))}
        finally:
            if archive is not None:
                archive.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--candidate', required=True, help='Approved candidate ID with a registered source receipt')
    parser.add_argument('--filename', help='Explicit registered original basename; default is the primary receipt file')
    parser.add_argument('--member', action='append', default=[], help='Select an exact ZIP member or a directory prefix ending with /; repeat as needed')
    parser.add_argument('--max-uncompressed-bytes', type=int, default=4 * 1024 ** 3)
    parser.add_argument('--max-ratio', type=float, default=1000.0)
    parser.add_argument('--max-entries', type=int, default=20000)
    args = parser.parse_args()
    try:
        result = extract(args.candidate, filename=args.filename, members=args.member, max_bytes=args.max_uncompressed_bytes,
                         max_ratio=args.max_ratio, max_entries=args.max_entries)
        print(json.dumps(result, indent=2, allow_nan=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, AttributeError, UnicodeError,
            struct.error, zipfile.BadZipFile, EOFError, RuntimeError) as exc:
        print(f'Extraction refused: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
