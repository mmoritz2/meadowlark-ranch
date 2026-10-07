"""Import checksum-verified Poly Haven CC0 village surfaces as local WebP maps.

Run with Python + Pillow; --cache may contain downloaded API metadata/JPEGs.
Diffuse and normal maps are 1K, packed occlusion/roughness/metalness is 512px.
"""
import argparse
import datetime
import hashlib
import io
import json
from pathlib import Path
import urllib.request
from urllib.parse import urlparse
from PIL import Image


def fetch(url):
    if urlparse(url).hostname not in ('api.polyhaven.com', 'dl.polyhaven.org'):
        raise ValueError('Unexpected asset host: ' + url)
    req = urllib.request.Request(url, headers={'User-Agent': 'MeadowlarkRanch/1.0'})
    with urllib.request.urlopen(req, timeout=180) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[2] / 'assets/textures/village')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    def source(name, url):
        cached = args.cache / name if args.cache else None
        return cached.read_bytes() if cached and cached.exists() else fetch(url)
    records = []
    for asset in ('painted_plaster_wall', 'roof_slates_03'):
        info = json.loads(source(asset + '-info.json', 'https://api.polyhaven.com/info/' + asset))
        files = json.loads(source(asset + '-files.json', 'https://api.polyhaven.com/files/' + asset))
        record = {'id': asset, 'page': 'https://polyhaven.com/a/' + asset, 'authors': info['authors'],
                  'license': 'CC0-1.0', 'licenseURL': 'https://polyhaven.com/license',
                  'scaleMetres': [v / 1000 for v in info['dimensions']],
                  'retrieved': datetime.date.today().isoformat(), 'files': []}
        for channel, suffix, size in [('Diffuse', 'diff', 1024), ('nor_gl', 'nor_gl', 1024), ('arm', 'arm', 512)]:
            entry = files[channel]['1k']['jpg']
            data = source(asset + '-' + channel + '.jpg', entry['url'])
            if hashlib.md5(data).hexdigest() != entry['md5']:
                raise ValueError('Source checksum mismatch: ' + asset + '/' + channel)
            image = Image.open(io.BytesIO(data)).convert('RGB')
            if image.size != (size, size):
                image = image.resize((size, size), Image.Resampling.LANCZOS)
            name = asset + '_' + suffix + '.webp'
            output = args.output / name
            image.save(output, 'WEBP', quality=95 if channel == 'nor_gl' else 90, method=6)
            encoded = output.read_bytes()
            record['files'].append({'url': entry['url'], 'sourceMD5': entry['md5'],
              'sourceSHA256': hashlib.sha256(data).hexdigest(), 'sourceBytes': len(data),
              'output': {'file': name, 'size': size, 'bytes': len(encoded), 'sha256': hashlib.sha256(encoded).hexdigest(),
                         'colorSpace': 'sRGB' if channel == 'Diffuse' else 'linear'}})
        records.append(record)
        print(asset, 'verified and converted')
    (args.output / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')


if __name__ == '__main__':
    main()
