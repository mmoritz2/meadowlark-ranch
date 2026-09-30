"""Fetch source-verified CC0 ranch joinery and upholstery maps. No executable assets."""
import hashlib
import json
import sys
from pathlib import Path
import urllib.request
from urllib.parse import urlparse

OUT = Path('/tmp/meadowlark-builder-materials')
OUT.mkdir(parents=True, exist_ok=True)

def get(url):
    if urlparse(url).hostname not in ('api.polyhaven.com', 'dl.polyhaven.org'):
        raise ValueError('Unexpected source')
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'MeadowlarkRanch/1.0'}), timeout=180) as r:
        return r.read()

records = []
for asset in (sys.argv[1:] or ['coated_pine', 'weathered_brown_planks', 'brown_leather', 'rough_linen', 'riet_01']):
    info = json.loads(get('https://api.polyhaven.com/info/' + asset))
    files = json.loads(get('https://api.polyhaven.com/files/' + asset))
    record = {'id': asset, 'page': 'https://polyhaven.com/a/' + asset,
              'authors': info['authors'], 'license': 'CC0-1.0',
              'licenseURL': 'https://polyhaven.com/license', 'retrieved': '2026-09-30', 'files': []}
    for key, suffix in [('Diffuse', 'diff'), ('nor_gl', 'nor_gl'), ('arm', 'arm')]:
        entry = files[key]['2k' if key == 'Diffuse' else '1k']['jpg']
        data = get(entry['url'])
        if hashlib.md5(data).hexdigest() != entry['md5']:
            raise ValueError('Checksum mismatch: ' + asset)
        name = asset + '_' + suffix + '.jpg'
        (OUT / name).write_bytes(data)
        record['files'].append({'file': name, 'url': entry['url'], 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    records.append(record)
    print(asset, 'verified', flush=True)
(OUT / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')
