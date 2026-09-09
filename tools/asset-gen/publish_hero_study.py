"""Select a reviewed local hero asset for the comparison page (no deployment)."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'assets/models/hero-horse'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', default='hero-animated.glb')
    parser.add_argument('--revision', default='hero-motion-20260908-4')
    parser.add_argument('--static', action='store_true')
    args = parser.parse_args()
    asset = (ASSETS / args.file).resolve()
    if asset.parent != ASSETS.resolve() or not asset.is_file():
        raise ValueError('Choose an existing GLB in the hero asset directory')
    spec = json.loads((ASSETS / 'finished-manifest.json').read_text(encoding='utf-8-sig'))
    anchors = json.loads((ASSETS / 'finished-anchors.json').read_text(encoding='utf-8-sig'))
    spec.update(file=asset.name, name='Bay sporthorse', revision=args.revision,
                status='Appearance accepted by the user; rig and animation study', rigged=not args.static,
                reviewRequired=False, artAccepted=True,
                appearanceApproval='User: yes!!! those look good — 2026-09-08', anchors=anchors['anchors'],
                heroGroom=anchors['heroGroom'],
                sha256=hashlib.sha256(asset.read_bytes()).hexdigest(),
                coordinateNote='Raw glTF: +X nose, +Y up, +Z lateral. Viewer maps the nose to +Z, then grounds and scales once.')
    animation_report = ASSETS / asset.with_suffix('.animations.json').name
    if animation_report.exists():
        report = json.loads(animation_report.read_text(encoding='utf-8'))
        spec['animationSource'] = 'hero-animated.blend'
        spec['animationReport'] = animation_report.name
        spec['animationClips'] = [clip['name'] for clip in report['clips']]
    (ASSETS / 'manifest.json').write_text(json.dumps(spec, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: spec[key] for key in ('file', 'revision', 'rigged', 'reviewRequired', 'sha256')}))

if __name__ == '__main__':
    main()
