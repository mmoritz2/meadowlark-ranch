#!/usr/bin/env python3
"""Prepare an unchanged review copy of an approved, registered standalone GLB.

Usage:
    python3 tools/asset-gen/prepare-registered-glb-review.py --candidate bluemesh-draft
    python3 tools/asset-gen/prepare-registered-glb-review.py --candidate ID --label "Model name" --notes "Source review notes"

Legacy zero-specular/glossiness materials require explicit opt-in and notes:
    ... --allow-zero-specular-glossiness --notes "Uses the existing review material adapter."

Original files and receipts remain unchanged. Static inspection does not certify
appearance, animation behavior or game compatibility; browser review stays pending.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import struct
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
IMPORTS = ROOT / 'assets/models/horse-imports'
SG = 'KHR_materials_pbrSpecularGlossiness'
UNCONFIGURED_DECODERS = {'KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'}
SUPPORTED_REQUIRED = {
    'KHR_texture_transform', 'KHR_mesh_quantization', 'KHR_materials_unlit',
    'KHR_materials_clearcoat', 'KHR_materials_ior', 'KHR_materials_sheen',
    'KHR_materials_specular', 'KHR_materials_transmission', 'KHR_materials_iridescence',
    'KHR_materials_anisotropy', 'KHR_materials_volume', 'KHR_materials_emissive_strength',
    'EXT_materials_bump', 'KHR_lights_punctual', 'EXT_mesh_gpu_instancing',
    'EXT_texture_webp', 'EXT_texture_avif', SG,
}


def extraction_module():
    # Reuse our trusted path/receipt primitives, never a downloaded module.
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location(
            'horse_source_extraction', Path(__file__).with_name('extract-horse-import.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        sys.dont_write_bytecode = previous


def glb_json(path, paths):
    """Read JSON and validate chunk boundaries without a second binary allocation."""
    with paths.open_regular(path) as stream:
        size = os.fstat(stream.fileno()).st_size
        header = stream.read(12)
        if len(header) != 12 or struct.unpack('<4sII', header) != (b'glTF', 2, size):
            raise ValueError('Expected a complete GLB 2.0 file')
        offset, seen, doc = 12, set(), None
        while offset < size:
            chunk = stream.read(8)
            if len(chunk) != 8:
                raise ValueError('Truncated GLB chunk header')
            length, kind = struct.unpack('<I4s', chunk)
            offset += 8
            if length % 4 or offset + length > size or kind in seen or not seen and kind != b'JSON':
                raise ValueError('Invalid GLB chunk layout')
            seen.add(kind)
            if kind == b'JSON':
                if length > paths.DOCUMENT_LIMIT:
                    raise ValueError('GLB JSON metadata exceeds the inspection limit')
                doc = json.loads(stream.read(length).decode('utf-8'))
            else:
                stream.seek(length, 1)
            offset += length
    if not isinstance(doc, dict) or doc.get('asset', {}).get('version') != '2.0':
        raise ValueError('Expected glTF 2.0 asset metadata')
    return doc


def extension_names(value, label):
    if not isinstance(value, list) or not all(isinstance(name, str) for name in value):
        raise ValueError(f'Invalid {label}')
    return set(value)


def validate_preview(doc, *, allow_zero_sg=False, notes=None):
    used = extension_names(doc.get('extensionsUsed', []), 'extensionsUsed')
    required = extension_names(doc.get('extensionsRequired', []), 'extensionsRequired')
    if not required <= used:
        raise ValueError('Required extensions must also appear in extensionsUsed')
    unavailable = (used | required) & UNCONFIGURED_DECODERS
    if unavailable:
        raise ValueError('Review decoder is not configured for: ' + ', '.join(sorted(unavailable)))
    if required - SUPPORTED_REQUIRED:
        raise ValueError('Unsupported required review extensions: ' + ', '.join(sorted(required - SUPPORTED_REQUIRED)))
    for entry in doc.get('buffers', []) + doc.get('images', []):
        if not isinstance(entry, dict):
            raise ValueError('Invalid buffer/image definition')
        uri = entry.get('uri')
        if uri is not None and (not isinstance(uri, str) or not uri.startswith('data:')):
            raise ValueError('Review GLB must embed all buffers and images; external dependencies are refused')
    for image in doc.get('images', []):
        if image.get('mimeType') not in (None, 'image/png', 'image/jpeg', 'image/webp', 'image/avif'):
            raise ValueError('Unsupported review image MIME type: ' + str(image.get('mimeType')))
    sg_materials = []
    for material in doc.get('materials', []):
        if not isinstance(material, dict) or not isinstance(material.get('extensions', {}), dict):
            raise ValueError('Invalid material definition')
        extensions = material.get('extensions', {})
        if SG not in extensions:
            continue
        extension = extensions[SG]
        if not isinstance(extension, dict) or set(extensions) != {SG}:
            raise ValueError('Legacy materials combined with other material extensions need separate conversion')
        fallback = material.get('pbrMetallicRoughness', {})
        if not isinstance(fallback, dict) or {'baseColorTexture', 'metallicRoughnessTexture'} & fallback.keys():
            raise ValueError('Legacy materials with fallback metallic/roughness textures need separate conversion')
        specular = extension.get('specularFactor', [1, 1, 1])
        if (not isinstance(specular, list) or len(specular) != 3
                or not all(type(value) in (int, float) and math.isfinite(value) and value == 0 for value in specular)
                or 'specularGlossinessTexture' in extension):
            raise ValueError('Legacy nonzero/textured specular-glossiness materials need faithful conversion')
        diffuse, glossiness = extension.get('diffuseFactor', [1, 1, 1, 1]), extension.get('glossinessFactor', 1)
        if (not isinstance(diffuse, list) or len(diffuse) != 4
                or not all(type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 1 for value in diffuse)
                or type(glossiness) not in (int, float) or not math.isfinite(glossiness) or not 0 <= glossiness <= 1):
            raise ValueError('Invalid legacy material factors')
        sg_materials.append(material.get('name'))
    if sg_materials or SG in used:
        if not sg_materials:
            raise ValueError('Declared legacy extension has no inspected legacy materials')
        if not allow_zero_sg or not isinstance(notes, str) or not notes.strip():
            raise ValueError('Legacy zero-specular materials require --allow-zero-specular-glossiness and explicit --notes')
    return 'zero-specular-glossiness-review-v1' if sg_materials else 'original-gltf-materials'


def read_registry(path, paths):
    paths.checked_path(path, ROOT)
    registry = paths.read_json(path) if path.exists() else {'schemaVersion': 1, 'models': []}
    if registry.get('schemaVersion') != 1 or not isinstance(registry.get('models'), list):
        raise ValueError('Expected review registry schemaVersion 1 with a models list')
    ids = []
    for entry in registry['models']:
        candidate_id = entry.get('candidateId') if isinstance(entry, dict) else None
        if not isinstance(candidate_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', candidate_id):
            raise ValueError('Review registry has an invalid candidate ID')
        ids.append(candidate_id)
    if len(ids) != len(set(ids)):
        raise ValueError('Review registry contains duplicate candidate IDs; resolve them before preparing a preview')
    return registry


@contextmanager
def registry_lock(paths):
    lock = paths.checked_path(IMPORTS / '.review-preparation.lock', ROOT)
    try:
        fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise ValueError('Another preparation owns the review registry lock; retry after it finishes') from None
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(str(os.getpid()))
        yield
    finally:
        lock.unlink()


def prepare(candidate_id, *, label=None, notes=None, allow_zero_sg=False):
    paths = extraction_module()
    candidate, source, receipt = paths.registered_source(candidate_id)
    if source.suffix.lower() != '.glb' or receipt['inspection'].get('format') != 'glb':
        raise ValueError('This helper accepts only a registered standalone GLB; extract/convert archives separately')
    catalog = paths.read_json(paths.CATALOG)
    metadata = next(item for item in catalog['candidates'] if item.get('id') == candidate_id)
    if label is not None and not label.strip() or notes is not None and not notes.strip():
        raise ValueError('Explicit label/notes must not be blank')
    expected = (receipt['sha256'], receipt['bytes'])
    if paths.file_digest(source) != expected:
        raise ValueError('Original source hash or size does not match its receipt')
    registry_path = IMPORTS / 'review.json'
    with registry_lock(paths):
        registry = read_registry(registry_path, paths)
        doc = glb_json(source, paths)
        adapter = validate_preview(doc, allow_zero_sg=allow_zero_sg, notes=notes)
        inspection = paths.registration_module().inspect_file(source)
        output = paths.checked_path(candidate / 'review', ROOT, directory=True)
        target = paths.checked_path(output / 'model.glb', ROOT)
        if target.exists() and paths.file_digest(target) != expected:
            raise ValueError('Existing review/model.glb has different content; it will not be overwritten')
        paths.checked_path(output, ROOT, directory=True, create=True)
        with tempfile.TemporaryDirectory(dir=output, prefix='.prepare-') as folder:
            staging = Path(folder)
            temporary = staging / 'model.glb'
            with paths.open_regular(source) as original:
                copied = paths.copy_bounded(original, temporary, expected[1], [0, expected[1]])
            if copied != expected or paths.file_digest(source) != expected:
                raise ValueError('Original source changed during preparation')
            # Static checks were made against this hash, and the publication cannot
            # replace a differing file even if a target appears concurrently.
            paths.publish_no_overwrite(temporary, target, ROOT, expected)
            entry = {'candidateId': candidate_id, 'file': str(target.relative_to(ROOT)),
                     'sourceSha256': receipt['sha256'], 'fileSha256': receipt['sha256'],
                     'label': label or metadata.get('name') or candidate_id,
                     'notes': notes or 'Original source model. Browser review is pending.',
                     'creator': metadata.get('creator'), 'license': metadata.get('license'),
                     'sourceUrl': metadata.get('sourceUrl'), 'licenseUrl': metadata.get('licenseUrl'),
                     'preparation': {'status': 'review-file-prepared', 'preparedAtUtc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                                     'originalBytesPreserved': True, 'sourceReceiptPreserved': True,
                                     'materialAdapter': adapter, 'rigRetargeted': False, 'animationsModified': False,
                                     'gameCompatibility': 'not-assessed'},
                     'verification': {'sourceHashVerified': True, 'selfContained': True, 'glbInspection': 'passed',
                                      'browserReview': 'pending', 'rigMotionReview': 'pending',
                                      'meshCount': inspection['meshCount'],
                                      'trianglesFromAccessorCounts': inspection['trianglesFromAccessorCounts'],
                                      'skinJointCounts': [skin['jointCount'] for skin in inspection['skins']],
                                      'animationNames': inspection['animations'], 'imageCount': len(inspection['images']),
                                      'extensionsUsed': sorted(doc.get('extensionsUsed', [])),
                                      'extensionsRequired': sorted(doc.get('extensionsRequired', []))}}
            registry['models'] = [entry if item['candidateId'] == candidate_id else item for item in registry['models']]
            if not any(item['candidateId'] == candidate_id for item in registry['models']):
                registry['models'].append(entry)
            # Recheck before replacing metadata; originals and acquisition receipts
            # are never updated by this helper.
            if paths.file_digest(source) != expected or paths.read_json(source.parent / 'receipt.json') != receipt:
                raise ValueError('Original source or receipt changed during preparation')
            registry_temporary = staging / 'review.json'
            registry_temporary.write_text(json.dumps(registry, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
            paths.checked_path(registry_path, ROOT)
            os.replace(registry_temporary, registry_path)
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--label')
    parser.add_argument('--notes')
    parser.add_argument('--allow-zero-specular-glossiness', action='store_true')
    args = parser.parse_args()
    try:
        result = prepare(args.candidate, label=args.label, notes=args.notes,
                         allow_zero_sg=args.allow_zero_specular_glossiness)
        print(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, AttributeError, UnicodeError, struct.error, RuntimeError) as exc:
        print(f'Review preparation refused: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
