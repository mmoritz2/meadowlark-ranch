"""Build an explicit review catalog without activating incomplete site assets.

Every existing identity keeps its ID and approved source assignment. Missing
sources stay marked unavailable rather than resolving to another horse.
"""
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/models/horse-imports'
LICENSE_URLS = {
    'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
    'CC BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
}


def read(path):
    return json.loads(path.read_text())


def row_from_profile(path, *, require_protection=False):
    row = read(path)
    file = path.parent / row['file']
    if not file.exists():
        raise RuntimeError('Missing converted file: ' + str(file))
    actual = hashlib.sha256(file.read_bytes()).hexdigest()
    if row.get('sha256') != actual:
        raise RuntimeError('Converted asset hash mismatch: ' + str(file))
    if require_protection:
        delivery = read(path.parent / 'protected-delivery-validation.json')
        if delivery['packingReport']['sourceSha256'] != actual:
            raise RuntimeError('Protected delivery does not match converted source')
        protected = path.parent / delivery['file']
        if protected.suffix != '.mkr' or hashlib.sha256(protected.read_bytes()).hexdigest() != delivery['sha256']:
            raise RuntimeError('Protected delivery file/hash mismatch')
        row['convertedGlbSha256'] = actual
        row['file'], row['sha256'] = delivery['file'], delivery['sha256']
        row['protectedResource'] = {key: delivery[key] for key in
            ('format', 'version', 'cipher', 'keyBase64', 'embeddedGlbSha256', 'neutralCoatTexture', 'neutralCoatSha256') if key in delivery}
        if row.get('neutralCoatFile'):
            if not delivery.get('neutralCoatEmbedded'):
                raise RuntimeError('Protected delivery omitted its neutral coat')
            del row['neutralCoatFile']
        file = protected
    row['file'] = file.relative_to(BASE).as_posix()
    row['profileFile'] = path.relative_to(BASE).as_posix()
    row['available'] = True
    return row


def main():
    plan = read(BASE / 'replacement-plan.json')
    wild_base = BASE / 'wildmesh-white-western/game/breeds'
    wild = read(wild_base / 'manifest.json')
    draft_base = BASE / 'bluemesh-draft/game/breeds'
    draft = read(draft_base / 'manifest.json')
    candidates = {c['id']: c for c in read(BASE / 'catalog.json')['candidates']}
    wing_profile = BASE / 'cgcookie-wings/game/profile.json'
    wing = row_from_profile(wing_profile)
    breeds = {}
    for identity in plan['identityMapping']:
        key, source = identity['id'], identity['bodySource']
        candidate = candidates[source]
        if source == 'wildmesh-white-western':
            source_row = wild['models'][key]
            row = row_from_profile(wild_base / source_row['foundation'] / 'profile.json')
            row['foundation'] = source_row['foundation']
        elif source == 'bluemesh-draft':
            source_row = draft['identities'][key]
            profile_path = draft_base / source_row['profile']
            if not profile_path.exists():
                profile_path = draft_base.parent / source_row['profile']
            row = row_from_profile(profile_path)
            row['foundation'] = source_row['foundation']
        else:
            path = BASE / source / 'game/profile.json'
            row = row_from_profile(path, require_protection=bool(candidate.get('publicationDeliveryReview'))) if path.exists() else {'available': False, 'status': 'approved-source-conversion-pending' if candidate.get('acquiredSource') else 'approved-source-download-pending'}
        row = copy.deepcopy(row)
        row.update(id=key, name=identity['name'], sourceCandidate=source,
                   sourceUrl=candidate['sourceUrl'], creator=candidate['creator'],
                   license=candidate['license'], componentSources=identity['componentSources'])
        if candidate.get('licenseUrl') or candidate['license'] in LICENSE_URLS:
            row['licenseUrl'] = candidate.get('licenseUrl') or LICENSE_URLS[candidate['license']]
        row['acquiredSourceSha256'] = candidate.get('acquiredSource', {}).get('sha256')
        if 'cgcookie-wings' in identity['componentSources']:
            row.update(nativeWings=True, motionKind='feathered')
            wing_source = candidates['cgcookie-wings']
            row['wingComponent'] = {
                'file': wing['file'], 'profileFile': wing['profileFile'], 'sha256': wing['sha256'],
                'sourceCandidate': 'cgcookie-wings', 'creator': wing_source['creator'],
                'license': wing_source['license'], 'licenseUrl': wing_source.get('licenseUrl') or LICENSE_URLS[wing_source['license']],
                'sourceUrl': wing_source['sourceUrl'],
                'acquiredSourceSha256': wing_source['acquiredSource']['sha256'],
            }
        if key == 'lumen':
            row['fantasyAppearance'] = {'body': '#dfe9f7', 'mane': '#9fe4ff', 'spectral': True}
        breeds[key] = row
    assert len(breeds) == plan['identityCount'] == 80
    pending = [key for key, row in breeds.items() if not row['available']]
    favorite = row_from_profile(BASE / 'wildmesh-white-western/game/profile.json')
    status = 'complete imported roster; incorporation and runtime validation tracked separately' if not pending else 'review-only, site activation pending all sources and mounted QA'
    manifest = {'schemaVersion': 1, 'status': status,
                'requireExplicitMapping': True, 'identityCount': 80, 'availableIdentityCount': 80 - len(pending),
                'pendingIdentities': pending, 'pendingSourceIds': sorted({breeds[key]['sourceCandidate'] for key in pending}),
                'preferredWhiteWestern': favorite, 'breeds': breeds, 'aliases': {}}
    (BASE / 'prepared-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'available': 80 - len(pending), 'pending': pending,
                      'file': str(BASE / 'prepared-manifest.json'), 'siteActivated': False}))


if __name__ == '__main__':
    main()
