"""Validate the explicit prepared roster and its complete local asset closure.

This is a preflight for prepared assets. It does not activate a partial roster.
"""
import hashlib
import json
import argparse
import base64
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'assets/models/horse-imports'
RENDER_INPUTS = {
    'breeds.html', 'assets/breed-models.js', 'assets/equine-fantasy.js',
    'assets/features/horse-roster.js', 'assets/features/new-breeds.js',
    'assets/feather-wing-material.js', 'assets/game-hero-horse.js',
    'assets/artist-horse-motion.js', 'assets/dragon-horse-motion.js',
    'assets/feather-wing-motion.js', 'assets/hero-horse-coat.js',
    'assets/artist-horse-features.js',
    'assets/protected-horse-resource.js',
    'assets/fjord-horse-motion.js',
}


def main(require_complete=False):
    manifest = json.loads((BASE / 'prepared-manifest.json').read_text())
    plan = json.loads((BASE / 'replacement-plan.json').read_text())
    candidates = json.loads((BASE / 'catalog.json').read_text())['candidates']
    active_sources = {row['bodySource'] for row in plan['identityMapping']} | {source for row in plan['identityMapping'] for source in row['componentSources']}
    expected = {row['id']: row for row in plan['identityMapping']}
    assert len(expected) == 80 and set(manifest['breeds']) == set(expected)
    assert manifest['requireExplicitMapping'] and not manifest['aliases']
    files, models = set(), {}

    def local(path):
        path = path.resolve()
        if not path.is_relative_to(BASE.resolve()) or 'source' in path.relative_to(BASE).parts:
            raise ValueError('Runtime dependency escapes public derived assets')
        if not path.is_file():
            raise FileNotFoundError(path.relative_to(ROOT))
        files.add(path)
        return path

    def glb(relative, sha, protection=None):
        path = local(BASE / relative)
        if path in models:
            assert models[path]['sha256'] == sha
            return
        data = path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == sha
        encrypted_bytes = len(data)
        if protection:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            assert path.suffix == '.mkr' and data[:8] == b'MRHPACK\x00'
            assert protection['format'] == 'meadowlark-protected-horse' and protection['version'] == 1
            assert protection['cipher'] == 'AES-256-GCM'
            assert struct.unpack_from('<4H', data, 8) == (1, 1, 64, 0) and not any(data[36:48])
            assert struct.unpack_from('<Q', data, 16)[0] == len(data) - 64
            key = base64.b64decode(protection['keyBase64'], validate=True)
            assert len(key) == 32
            data = AESGCM(key).decrypt(data[24:36], data[64:] + data[48:64], data[:48])
            assert hashlib.sha256(data).hexdigest() == protection['embeddedGlbSha256']
        assert data[:4] == b'glTF' and int.from_bytes(data[8:12], 'little') == len(data)
        doc = json.loads(data[20:20 + int.from_bytes(data[12:16], 'little')])
        for dependency in doc.get('buffers', []) + doc.get('images', []):
            uri = dependency.get('uri')
            if protection and uri:
                raise ValueError('Protected model contains an external resource URI')
            if uri and not uri.startswith('data:'):
                if ':' in uri or '?' in uri or '#' in uri or '%' in uri:
                    raise ValueError('Unexpected remote or encoded model dependency')
                local(path.parent / uri)
        assert doc.get('skins') and doc.get('animations')
        if protection and 'neutralCoatTexture' in protection:
            image = doc['images'][doc['textures'][protection['neutralCoatTexture']]['source']]
            view = doc['bufferViews'][image['bufferView']]
            json_length = int.from_bytes(data[12:16], 'little')
            start = 28 + json_length + view.get('byteOffset', 0)
            assert hashlib.sha256(data[start:start + view['byteLength']]).hexdigest() == protection['neutralCoatSha256']
        models[path] = {'file': path.relative_to(ROOT).as_posix(), 'bytes': encrypted_bytes,
                        'sha256': sha, 'protected': bool(protection), 'clips': [clip['name'] for clip in doc['animations']]}

    pending = []
    for key, row in manifest['breeds'].items():
        assert row['id'] == key and row['sourceCandidate'] == expected[key]['bodySource']
        assert row['componentSources'] == expected[key]['componentSources']
        if not row['available']:
            assert row['status'] in ('approved-source-download-pending', 'approved-source-conversion-pending')
            pending.append(key)
            continue
        assert row['physicalScale'] and row['fitScale'] == 1 and row['fitY'] == 0
        assert row['acquiredSourceSha256'] and row['license'] and row['creator'] and row['sourceUrl']
        assert row['licenseUrl'].startswith('https://')
        local(BASE / row['profileFile'])
        glb(row['file'], row['sha256'], row.get('protectedResource'))
        if row.get('neutralCoatFile'):
            local((BASE / row['file']).parent / row['neutralCoatFile'])
        component = row.get('wingComponent')
        if component:
            assert component['sourceCandidate'] == 'cgcookie-wings'
            assert component['creator'] and component['license'] and component['sourceUrl']
            assert component['licenseUrl'].startswith('https://') and component['acquiredSourceSha256']
            local(BASE / component['profileFile'])
            glb(component['file'], component['sha256'])
    favorite = manifest['preferredWhiteWestern']
    glb(favorite['file'], favorite['sha256'])
    assert set(pending) == set(manifest['pendingIdentities'])
    assert len(manifest['breeds']) - len(pending) == manifest['availableIdentityCount']
    if require_complete and pending:
        raise RuntimeError('Full roster cannot activate: approved sources pending for ' + ', '.join(pending))
    if require_complete:
        unresolved_delivery = [candidate['id'] for candidate in candidates
                               if candidate['id'] in active_sources
                               and candidate.get('publicationDeliveryReview', {}).get('resolved') is False]
        if unresolved_delivery:
            raise RuntimeError('Publication delivery arrangement remains unresolved for ' + ', '.join(unresolved_delivery))
        thumbnails = read_thumbnails(BASE / 'thumbnails/render-validation.json')
        assert thumbnails['preparedManifestSha256'] == hashlib.sha256((BASE / 'prepared-manifest.json').read_bytes()).hexdigest()
        expected_portraits = set(manifest['breeds']) | {'white-western'}
        portrait_keys = [row['key'] for row in thumbnails['records']]
        assert len(portrait_keys) == len(set(portrait_keys)) and set(portrait_keys) == expected_portraits
        index = json.loads((BASE / 'thumbnails/index.json').read_text())
        assert len(index) == len(set(index)) and set(index) == expected_portraits
        assert set(thumbnails['runtimeSourceSha256']) == RENDER_INPUTS
        for source, sha in thumbnails['runtimeSourceSha256'].items():
            path = (ROOT / source).resolve()
            assert path.is_relative_to(ROOT) and hashlib.sha256(path.read_bytes()).hexdigest() == sha
        by_key = {row['key']: row for row in thumbnails['records']}
        for key, row in list(manifest['breeds'].items()) + [('white-western', favorite)]:
            portrait = by_key[key]
            assert portrait['file'] == key + '.webp' and portrait['modelSha256'] == row['sha256']
            data = local(BASE / 'thumbnails' / portrait['file']).read_bytes()
            assert hashlib.sha256(data).hexdigest() == portrait['sha256']
    inventory = [{'file': file.relative_to(ROOT).as_posix(), 'bytes': file.stat().st_size}
                 for file in sorted(files)]
    assert max(item['bytes'] for item in inventory) < 100_000_000
    active = "manifestURL=new URL('./models/horse-imports/prepared-manifest.json',import.meta.url)" in (ROOT / 'assets/breed-models.js').read_text()
    report = {'schemaVersion': 1, 'preparedAssetsPass': True, 'identityCount': 80,
              'availableIdentityCount': 80 - len(pending), 'pendingIdentities': pending,
              'allSourcesAcquired': all(candidate.get('acquiredSource') for candidate in candidates if candidate['id'] in active_sources),
              'allIdentitiesPrepared': not pending, 'siteActivated': active,
              'uniqueAnimatedModelsIncludingPreferredSource': len(models),
              'publicRuntimeDependencyBytes': sum(item['bytes'] for item in inventory),
              'originalSourcesRequiredAtRuntime': False,
              'models': list(models.values()), 'files': inventory,
              'scope': 'Local resource closure, SHA, explicit identity and metre-fit checks; mounted visual QA is separate.'}
    (BASE / 'imported-asset-validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['preparedAssetsPass', 'availableIdentityCount',
          'allSourcesAcquired', 'uniqueAnimatedModelsIncludingPreferredSource', 'publicRuntimeDependencyBytes']}))


def read_thumbnails(path):
    report = json.loads(path.read_text())
    assert report['completeAvailableCatalog'] and not report['errors'] and not report['blockedExternalRequests']
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-complete', action='store_true', help='Refuse activation unless every approved identity and its actual-model thumbnail is ready.')
    main(parser.parse_args().require_complete)
