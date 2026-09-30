"""Download the game's three CC0 surface scans from the official Poly Haven API."""
import hashlib
import json
from pathlib import Path
import urllib.request

out = Path('assets/textures/scanned')
out.mkdir(parents=True, exist_ok=True)
records = []


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'MeadowlarkRanch/1.0'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


for asset in ['leafy_grass', 'forest_ground_04', 'rock_boulder_cracked']:
    files = json.loads(get('https://api.polyhaven.com/files/' + asset))
    info = json.loads(get('https://api.polyhaven.com/info/' + asset))
    record = {'id': asset, 'page': 'https://polyhaven.com/a/' + asset, 'license': 'CC0-1.0',
              'licenseURL': 'https://polyhaven.com/license', 'retrieved': '2026-09-30',
              'authors': info['authors'], 'files': []}
    for key, suffix in [('Diffuse', 'diff'), ('nor_gl', 'nor_gl'), ('arm', 'arm')]:
        entry = files[key]['2k']['jpg']
        data = get(entry['url'])
        if hashlib.md5(data).hexdigest() != entry['md5']:
            raise ValueError('Checksum mismatch: ' + asset + ' ' + key)
        name = asset + '_' + suffix + '.jpg'
        (out / name).write_bytes(data)
        record['files'].append({'file': name, 'url': entry['url'], 'bytes': len(data),
                                'sha256': hashlib.sha256(data).hexdigest()})
    records.append(record)
    print(asset, 'verified 2K albedo, normal, AO/roughness maps', flush=True)
(out / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')
