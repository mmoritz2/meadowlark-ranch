"""Fetch selected CC0 models from Poly Haven's official API, with provenance.

Only glTF geometry and its images/buffers are downloaded; no executable assets.
Sources are cached outside the repository. Run with model IDs as arguments.
"""
from datetime import date
import hashlib
import json
from pathlib import Path
import sys
import urllib.request
from urllib.parse import urlparse

ROOT = Path('/tmp/meadowlark-realism-sources')
HEADERS = {'User-Agent': 'MeadowlarkRanch/1.0 (CC0 environment asset integration)'}


def get(url):
    if urlparse(url).hostname not in ('api.polyhaven.com', 'dl.polyhaven.org'):
        raise ValueError('Unexpected source host: ' + url)
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=180) as response:
        return response.read()


for asset in sys.argv[1:]:
    folder = ROOT / asset
    folder.mkdir(parents=True, exist_ok=True)
    files = json.loads(get('https://api.polyhaven.com/files/' + asset))
    info = json.loads(get('https://api.polyhaven.com/info/' + asset))
    source = files['gltf']['1k']['gltf']
    records = []
    downloads = [(asset + '.gltf', source)] + list(source.get('include', {}).items())
    # The glTF export uses JPEG diffuse maps. Preserve the separate leaf alpha
    # masks supplied with the author's Blender asset when making game foliage.
    for relative, entry in files.get('blend', {}).get('1k', {}).get('blend', {}).get('include', {}).items():
        if '_alpha_' in relative or '_opacity_' in relative:
            downloads.append((relative, entry))
    for relative, entry in downloads:
        dest = (folder / relative).resolve()
        if not dest.is_relative_to(folder.resolve()):
            raise ValueError('Unexpected asset path')
        dest.parent.mkdir(parents=True, exist_ok=True)
        data = dest.read_bytes() if dest.exists() else get(entry['url'])
        if entry.get('md5') and hashlib.md5(data).hexdigest() != entry['md5']:
            raise ValueError('Source checksum mismatch: ' + relative)
        dest.write_bytes(data)
        records.append({'file': relative, 'url': entry['url'], 'bytes': len(data),
                        'sha256': hashlib.sha256(data).hexdigest()})
    provenance = {'id': asset, 'page': 'https://polyhaven.com/a/' + asset,
                  'license': 'CC0-1.0', 'licenseURL': 'https://polyhaven.com/license',
                  'retrieved': date.today().isoformat(), 'authors': info.get('authors', {}),
                  'sourceFiles': records}
    (folder / 'source.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print(asset, round(sum(r['bytes'] for r in records) / 1048576, 2), 'MB verified', flush=True)
