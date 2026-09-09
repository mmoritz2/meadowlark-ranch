"""Publish the reviewed static hero after finish_hero_horse.py completes.

This only copies the isolated hero candidate. It never changes the shipped
breed library or the viewer's live manifest.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/models/hero-horse'


def publish():
    target = OUT / 'hero-finished.glb'
    shutil.copyfile(OUT / 'hero-face-tail-review.glb', target)
    anchors = json.loads((OUT / 'hero-groom-anchors.json').read_text())
    anchors['anchors'].update(json.loads((OUT / 'face-landmarks.json').read_text()))
    anchors.update(source='hero-finished.glb',
                   status='Static surface revision hero-finish-1; actual eye and nostril surface landmarks')
    (OUT / 'finished-anchors.json').write_text(json.dumps(anchors, indent=2))
    spec = importlib.util.spec_from_file_location('hero_topology', ROOT / 'tools/inspect-horse-topology.py')
    topology = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(topology)
    report = topology.inspect(target)
    if report['boundaryEdges'] or report['nonmanifoldEdges']:
        raise RuntimeError(f'Hero surface integrity failed: {report}')
    (OUT / 'finish-topology.json').write_text(json.dumps(report, indent=2))
    manifest = json.loads((OUT / 'manifest.json').read_text())
    manifest.update(file='hero-finished.glb', name='Bay sporthorse', revision='hero-finish-1',
                    status='Textured hero prototype under visual review',
                    blenderSource='hero-sculpt.blend', rigged=False, geometry=report,
                    anchors=anchors['anchors'], heroGroom=anchors['heroGroom'],
                    sha256=hashlib.sha256(target.read_bytes()).hexdigest())
    (OUT / 'finished-manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f"Published {target.name}: {report['triangles']:,} triangles; {manifest['sha256']}")


if __name__ == '__main__':
    publish()
