"""Orthographic actual source/neutral triangles, without synthetic images."""
import json
import importlib.util
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'assets/models/horse-imports/arabian-sculpt'
data = np.load(BASE/'work/neutral-source.npz')
report = json.loads((BASE/'game/conversion-report.json').read_text())
spec = importlib.util.spec_from_file_location('arabian_source_helpers', Path(__file__).with_name('rig-arabian-sculpt.py'))
helpers = importlib.util.module_from_spec(spec); spec.loader.exec_module(helpers)
original_points, original_faces = helpers.obj(helpers.SOURCE, helpers.SOURCE_SHA)
out = BASE/'review'; out.mkdir(exist_ok=True)
for kind in ('source', 'neutral'):
    p = (original_points if kind == 'source' else data[kind]).copy()
    faces = original_faces if kind == 'source' else data['faces']
    if kind == 'source': p -= report['sourceFrameCenter']
    for name, normal in [('side', [1., 0., 0.]), ('quarter', [.75, -1., .28]), ('front', [0., -1., 0.])]:
        normal = np.array(normal); normal /= np.linalg.norm(normal)
        horizontal = np.cross([0., 0., 1.], normal); horizontal /= np.linalg.norm(horizontal)
        vertical = np.cross(normal, horizontal)
        q = np.c_[p@horizontal, p@vertical]
        triangles = p[faces]
        normals = np.cross(triangles[:, 1]-triangles[:, 0], triangles[:, 2]-triangles[:, 0])
        normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], 1e-12)
        light = np.array([-.5, -.7, 1.]); light /= np.linalg.norm(light)
        lum = .45+.55*np.maximum(0., normals@light)
        colors = np.c_[np.tile([.70, .68, .65], (len(faces), 1))*lum[:, None], np.ones(len(faces))]
        depth = (triangles@normal).mean(1); order = np.argsort(depth)
        fig, ax = plt.subplots(figsize=(10, 9), dpi=130)
        ax.add_collection(PolyCollection(q[faces][order], facecolors=colors[order], edgecolors='none', rasterized=True))
        ax.set_xlim(q[:, 0].min()-.15, q[:, 0].max()+.15); ax.set_ylim(q[:, 1].min()-.12, q[:, 1].max()+.15)
        ax.set_aspect('equal'); ax.set_facecolor('#25303d'); ax.set_title('Actual Arabian '+kind+' triangle surface')
        ax.axis('off'); fig.tight_layout(); fig.savefig(out/(kind+'-'+name+'.png')); plt.close(fig)
        print(out/(kind+'-'+name+'.png'), flush=True)
