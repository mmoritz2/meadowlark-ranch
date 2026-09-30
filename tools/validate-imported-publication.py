"""Check the actual Git index against the approved horse runtime closure."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'assets/models/horse-imports'
OUTPUT = BASE / 'deployment-closure-validation.json'
CORE_RUNTIME = {
    'ranch3d.html', 'breeds.html', 'hero-horse.html', 'horse-art-review.html',
    'horse-import-review.html', 'sw.js', 'assets/breed-models.js',
    'assets/breed-portraits.js', 'assets/game-hero-horse.js',
    'assets/rider-model.js', 'assets/artist-horse-motion.js',
    'assets/dragon-horse-motion.js', 'assets/feather-wing-motion.js',
    'assets/feather-wing-material.js', 'assets/fjord-horse-motion.js',
    'assets/protected-horse-resource.js', 'assets/equine-fantasy.js',
    'assets/horse-import-review.js', 'assets/features/index.js',
    'assets/features/horse-roster.js', 'assets/features/new-breeds.js',
    'assets/features/story-quests.js', 'assets/features/ui-kit.js',
}


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def required_files(report):
    """Include live resources and the metadata consumed by their validators/UI."""
    relative_base = BASE.relative_to(ROOT).as_posix()
    manifest = json.loads((BASE / 'prepared-manifest.json').read_text())
    portraits = json.loads((BASE / 'thumbnails/render-validation.json').read_text())
    catalog = json.loads((BASE / 'catalog.json').read_text())
    names = set(CORE_RUNTIME) | {row['file'] for row in report['files']}
    names.update(portraits['runtimeSourceSha256'])
    names.update(relative_base + '/' + name for name in (
        'catalog.json', 'replacement-plan.json', 'prepared-manifest.json',
        'imported-asset-validation.json', 'review.json',
        'thumbnails/render-validation.json', 'thumbnails/index.json',
        'README.md', 'ATTRIBUTION.md',
    ))
    names.add('README.md')
    names.update(relative_base + '/thumbnails/' + row['file']
                 for row in portraits['records'])
    names.update(relative_base + '/' + row['id'] + '/provenance.json'
                 for row in catalog['candidates'] if row.get('acquiredSource'))
    expected = set(manifest['breeds']) | {'white-western'}
    actual = [row['key'] for row in portraits['records']]
    assert len(expected) == 81 and len(actual) == 81 and set(actual) == expected
    # The report is produced by this check; comparing it with its previous
    # index version would require a self-referential restage/recheck loop.
    names.discard(OUTPUT.relative_to(ROOT).as_posix())
    for name in names:
        path = (ROOT / name).resolve()
        assert path.is_relative_to(ROOT) and path.is_file(), 'Invalid publication dependency: ' + name
    return names


def main():
    report = json.loads((BASE / 'imported-asset-validation.json').read_text())
    assert report['preparedAssetsPass'] and report['allIdentitiesPrepared']
    assert report['availableIdentityCount'] == 80
    assert report['uniqueAnimatedModelsIncludingPreferredSource'] == 38
    assert len({row['file'] for row in report['models']}) == 38
    index_output = subprocess.run(['git', 'ls-files', '-s', '-z'], cwd=ROOT,
                                  capture_output=True, check=True).stdout.decode()
    index_objects = {}
    for entry in filter(None, index_output.split('\0')):
        metadata, name = entry.split('\t', 1)
        mode, oid, stage = metadata.split()
        assert stage == '0', 'Unmerged publication index entry: ' + name
        index_objects[name] = oid
    indexed = set(index_objects)
    required = required_files(report)
    missing = sorted(required - indexed)
    assert not missing, 'Runtime dependencies absent from the Git index: ' + ', '.join(missing)
    private, plaintext, oversized, local_paths = [], [], [], []
    public_files, indexed_hashes = [], {}
    for name in sorted(indexed):
        if not name.startswith('assets/models/horse-imports/'):
            continue
        path = ROOT / name
        parts = Path(name).parts
        data = subprocess.run(['git', 'show', ':' + name], cwd=ROOT,
                              capture_output=True, check=True).stdout
        indexed_hashes[name] = hashlib.sha256(data).hexdigest()
        public_files.append({'file': name, 'bytes': len(data),
                             'sha256': indexed_hashes[name]})
        if 'source' in parts or 'work' in parts or path.suffix.lower() in {'.zip', '.abc', '.blend', '.obj', '.stl'}:
            private.append(name)
        protected = any(candidate in parts for candidate in ['fjord-sculpt', 'pastel-unicorn'])
        is_map = path.suffix.lower() in {'.png', '.jpg', '.jpeg'} and 'game' in parts and 'review' not in parts
        if protected and (path.suffix.lower() in {'.glb', '.gltf'} or is_map):
            plaintext.append(name)
        if path.suffix == '.json' and any(marker in data for marker in [b'/Users/', b'/private/tmp/', b'C:/Users/']):
            local_paths.append(name)
    comparisons = []
    for name in sorted(required):
        if name not in indexed_hashes:
            data = subprocess.run(['git', 'show', ':' + name], cwd=ROOT,
                                  capture_output=True, check=True).stdout
            indexed_hashes[name] = hashlib.sha256(data).hexdigest()
        working_sha = file_sha256(ROOT / name)
        comparisons.append({'file': name, 'workingSha256': working_sha,
                            'indexedSha256': indexed_hashes[name],
                            'matchesValidatedWorkingBytes': working_sha == indexed_hashes[name]})
    stale = [row['file'] for row in comparisons if not row['matchesValidatedWorkingBytes']]
    model_mismatches = [row['file'] for row in report['models']
                        if indexed_hashes[row['file']] != row['sha256']]
    # Count unique index objects once for the size lookup, then account for
    # every published filename. This includes tools/docs conservatively.
    objects = list(index_objects.values())
    unique = sorted(set(objects))
    sizes = subprocess.run(['git', 'cat-file', '--batch-check=%(objectname) %(objectsize)'],
                           cwd=ROOT, input='\n'.join(unique) + '\n', text=True,
                           capture_output=True, check=True).stdout.splitlines()
    by_object = {line.split()[0]: int(line.split()[1]) for line in sizes}
    site_bytes = sum(by_object[oid] for oid in objects)
    oversized = sorted(name for name, oid in index_objects.items()
                       if by_object[oid] >= 100_000_000)
    checks = {'all80Prepared': True, 'completeRuntimeClosureIndexed': not missing,
              'exactly38UniqueAnimatedModels': True,
              'stagedRuntimeAndMetadataMatchValidatedWorkingBytes': not stale,
              'stagedModelsMatchValidatedModelSha256': not model_mismatches,
              'privateOriginalsAndIntermediatesExcluded': not private,
              'protectedSourcesHaveNoPlaintextPublicModelOrMaps': not plaintext,
              'everyPublicFileBelow100MB': not oversized,
              'publicReportsContainNoLocalUserPaths': not local_paths,
              'entireIndexedSiteBelow1GB': site_bytes < 1_000_000_000}
    result = {'schemaVersion': 1, 'checks': checks, 'passed': all(checks.values()),
              'privateFiles': private, 'plaintextProtectedFiles': plaintext,
              'oversizedFiles': oversized, 'reportsWithLocalPaths': local_paths,
              'staleIndexedFiles': stale, 'validatedModelHashMismatches': model_mismatches,
              'validatedIndexFileComparisons': comparisons,
              'publicHorseFileCount': len(public_files),
              'publicHorseBytes': sum(row['bytes'] for row in public_files),
              'conservativeIndexedSiteBytes': site_bytes,
              'scope': 'Actual Git index bytes and complete runtime dependencies; no strong client DRM or legal certification is implied.'}
    OUTPUT.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    assert result['passed'], 'Public horse delivery closure failed'


if __name__ == '__main__':
    main()
