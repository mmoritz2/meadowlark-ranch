"""Texture the new horse using the already-installed isolated Hunyuan paint runtime.

Run with Desktop/hy3d-paint/.venv/Scripts/python.exe. All output is kept in the
project; the installed model weights and compatibility wrapper are read only.
The input retains the original Hunyuan orientation so reference cameras match.
"""
import argparse
import hashlib
import json
import os
import pathlib
import runpy
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
RUNTIME = pathlib.Path(r'C:\Users\msmor\Desktop\hy3d-paint')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mesh', required=True)
    parser.add_argument('--image', required=True)
    parser.add_argument('--out', default=str(ROOT / 'assets/models/hero-horse/hero-textured-raw.glb'))
    args = parser.parse_args()
    output = pathlib.Path(args.out).resolve()
    output.relative_to(ROOT)
    output.parent.mkdir(parents=True, exist_ok=True)
    os.environ['HF_MODULES_CACHE'] = str(ROOT / 'output/hero-paint-module-cache')
    # Reuse the proven torch-2.7 wrapper's API compatibility patches.
    runtime = runpy.run_path(str(RUNTIME / 'texture_mesh.py'), run_name='hero_paint_runtime')
    from hy3dgen.texgen.pipelines import Hunyuan3DTexGenConfig
    import trimesh
    from PIL import Image
    config = Hunyuan3DTexGenConfig(
        str(RUNTIME / 'checkpoints/hunyuan3d-delight-v2-0'),
        str(RUNTIME / 'checkpoints/hunyuan3d-paint-v2-0'))
    review = output.parent / 'paint-views'
    review.mkdir(exist_ok=True)
    original = runtime['Multiview_Diffusion_Net'].__call__

    def retain_views(self, *inputs, **kwargs):
        views = original(self, *inputs, **kwargs)
        for i, view in enumerate(views):
            view.save(review / f'view-{i}.png')
        return views

    runtime['Multiview_Diffusion_Net'].__call__ = retain_views
    started = time.time()
    print('Loading installed paint models', flush=True)
    pipeline = runtime['Hunyuan3DPaintPipeline'](config)
    mesh = trimesh.load(args.mesh, force='mesh')
    image = Image.open(args.image).convert('RGB')
    print('Generating and baking six matching coat views', flush=True)
    textured = pipeline(mesh, image)
    textured.export(str(output))
    from normalize_hero_coat import normalize
    normalize(output, output)
    metadata = {
        'pipeline': 'Hunyuan3D paint v2.0, installed torch2.7 wrapper',
        'mesh': str(pathlib.Path(args.mesh).resolve().relative_to(ROOT)),
        'image': str(pathlib.Path(args.image).resolve().relative_to(ROOT)),
        'meshSHA256': hashlib.sha256(pathlib.Path(args.mesh).read_bytes()).hexdigest(),
        'referenceSHA256': hashlib.sha256(pathlib.Path(args.image).read_bytes()).hexdigest(),
        'textureSize': config.texture_size,
        'views': 6,
        'seconds': round(time.time()-started, 1),
        'output': output.name,
        'outputSHA256': hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    (output.parent / 'paint-manifest.json').write_text(json.dumps(metadata, indent=2))
    print(json.dumps(metadata), flush=True)


if __name__ == '__main__':
    main()
