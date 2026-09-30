"""Verified Arabian source readers and GLB helpers; ordinary tools only.

The final conversion uses source-specific standing retopology and is implemented
in rig-arabian-standing.py. Original OBJ bytes are never written.
"""
from __future__ import annotations
import hashlib, importlib.util, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'assets/models/horse-imports/arabian-sculpt'
SOURCE = BASE/'source/CABALLO_ARABE (1).obj'
SOURCE_SHA = 'c4359189a30dddf92cc31745e756e6cfc6e30505c3b67c6ca879d6d69d7176c3'
BASE_SHA = '405cd3764e2d0415edd85fa546e4c934d3e1600027bf46c24f60f298ecb1854e'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('owned_glb_writer', Path(__file__).with_name('rig-imported-dragon.py'))
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)


def obj(path, expected):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Registered Arabian original hash mismatch')
    text = raw.decode('utf-8-sig')
    if text.endswith('\x00') and '\x00' not in text[:-1]: text = text[:-1]
    points, faces = [], []
    for line in text.splitlines():
        fields = line.split('#', 1)[0].split()
        if not fields: continue
        if fields[0] == 'v': points.append([float(x) for x in fields[1:4]])
        elif fields[0] == 'f': faces.append([int(x)-1 for x in fields[1:]])
        elif fields[0] != 'g': raise ValueError('Unexpected source OBJ record')
    p, f = np.asarray(points), np.asarray(faces)
    if f.shape[1] != 3 or f.min() < 0 or f.max() >= len(p) or not np.isfinite(p).all():
        raise ValueError('Invalid actual source triangles')
    return p, f


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1); return t*t*(3-2*t)


def capsule(points, a, b):
    axis = b-a; t = np.clip((points-a)@axis/(axis@axis), 0, 1)
    return np.linalg.norm(points-(a+t[:, None]*axis), axis=1), t


def rotation_between(a, b):
    a = a/np.linalg.norm(a); b = b/np.linalg.norm(b)
    v = np.cross(a, b); c = float(a@b)
    if c < -1+1e-8:
        axis = np.cross(a, [1, 0, 0] if abs(a[0]) < .8 else [0, 1, 0]); axis /= np.linalg.norm(axis)
        return 2*np.outer(axis, axis)-np.eye(3)
    skew = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3)+skew+skew@skew/max(1e-12, 1+c)


def normals(p, f):
    face = np.cross(p[f[:, 1]]-p[f[:, 0]], p[f[:, 2]]-p[f[:, 0]])
    out = np.zeros_like(p)
    for k in range(3): np.add.at(out, f[:, k], face)
    return out/np.maximum(np.linalg.norm(out, axis=1)[:, None], 1e-12)


if __name__ == "__main__":
    import runpy
    runpy.run_path(str(Path(__file__).with_name("rig-arabian-standing.py")), run_name="__main__")
