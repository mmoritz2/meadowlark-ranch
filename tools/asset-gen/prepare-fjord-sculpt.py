#!/usr/bin/env python3
"""Audit and numerically simplify the approved Fjord STL, preserving its source.

Usage: python3 tools/asset-gen/prepare-fjord-sculpt.py [--audit-only]
       python3 tools/asset-gen/prepare-fjord-sculpt.py --voxel 0.3 --triangles 110000
All outputs remain in this candidate's work directory. Source previews are
explicitly sampled orthographic surface-point renders, not fabricated artwork.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import time
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import maximum_filter

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/models/horse-imports/fjord-sculpt'
SHA = 'c652933791dc85ea7ec9a1c9b4707b04b4c4a1f1bb28c27a99b58a0f978c2178'
DTYPE = np.dtype([('normal', '<f4', (3,)), ('vertices', '<f4', (3, 3)), ('attribute', '<u2')])


def registration():
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('fjord_registered_source', Path(__file__).with_name('extract-horse-import.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def orthos(triangles, low, high, destination):
    sampled = triangles[::13]
    points = sampled['vertices'].mean(axis=1).astype(float)
    normals = np.cross(sampled['vertices'][:, 1] - sampled['vertices'][:, 0], sampled['vertices'][:, 2] - sampled['vertices'][:, 0]).astype(float)
    normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], 1e-12)
    light = np.array([1, 1, 2.0]); light /= np.linalg.norm(light)
    shade = np.clip(.45 + .55 * (normals @ light), .12, 1)
    views = [('Side +X, source Y up', [0, 0, 1], [0, 1, 0], [1, 0, 0]),
             ('Opposite side -X', [0, 0, -1], [0, 1, 0], [-1, 0, 0]),
             ('Front +Z, source Y up', [1, 0, 0], [0, 1, 0], [0, 0, 1]),
             ('Top +Y', [1, 0, 0], [0, 0, -1], [0, 1, 0])]
    canvas = Image.new('RGB', (1600, 1700), '#eeeeea')
    draw = ImageDraw.Draw(canvas)
    for index, (label, right, up, forward) in enumerate(views):
        x = points @ np.array(right); y = points @ np.array(up); z = points @ np.array(forward)
        size = 760; scale = 690 / max(np.ptp(x), np.ptp(y))
        px = np.clip(np.round((x - (x.max() + x.min()) / 2) * scale + size / 2), 0, size - 1).astype(int)
        py = np.clip(np.round(((y.max() + y.min()) / 2 - y) * scale + size / 2), 0, size - 1).astype(int)
        flat = py * size + px
        depth = np.full(size * size, -np.inf)
        np.maximum.at(depth, flat, z)
        visible = np.abs(depth[flat] - z) < 1e-7
        tones = np.full(size * size, 0, dtype=np.uint8)
        tones[flat[visible]] = np.clip(35 + shade[visible] * 175, 0, 255).astype(np.uint8)
        tones = maximum_filter(tones.reshape(size, size), size=3)
        rgb = np.full((size, size, 3), [238, 238, 234], dtype=np.uint8)
        rgb[tones > 0] = tones[tones > 0, None]
        left = 20 + (index % 2) * 800; top = 70 + (index // 2) * 800
        canvas.paste(Image.fromarray(rgb), (left, top))
        draw.text((left, top - 30), label, fill='#222222')
    draw.text((20, 12), 'Actual registered Fjord STL: sampled surface orthographic views; no coat, rig or invented features', fill='#222222')
    canvas.save(destination)


def simplify(triangles, low, high, voxel, target, work):
    import open3d as o3d
    shape = np.floor((high - low) / voxel).astype(np.int64) + 2
    cells = int(np.prod(shape)); assert cells < 90000000, 'Voxel grid exceeds the bounded working-memory limit'
    counts = np.zeros(cells, dtype=np.uint32); sums = np.zeros((cells, 3), dtype=np.float64)
    face_chunks = []
    for start in range(0, len(triangles), 250000):
        points = triangles[start:start + 250000]['vertices'].reshape(-1, 3).astype(float)
        coord = np.floor((points - low) / voxel).astype(np.int64)
        keys = (coord[:, 0] * shape[1] + coord[:, 1]) * shape[2] + coord[:, 2]
        unique, inverse, local_counts = np.unique(keys, return_inverse=True, return_counts=True)
        counts[unique] += local_counts.astype(np.uint32)
        for axis in range(3): sums[unique, axis] += np.bincount(inverse, weights=points[:, axis])
        faces = keys.reshape(-1, 3)
        mask = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
        face_chunks.append(faces[mask].astype(np.int32))
        if start % 2000000 == 0: print(json.dumps({'stage': 'source-vertex-clustering', 'sourceTrianglesRead': start + len(points) // 3}), flush=True)
    occupied = np.flatnonzero(counts)
    vertices = sums[occupied] / counts[occupied, None]
    lookup = np.full(cells, -1, dtype=np.int32); lookup[occupied] = np.arange(len(occupied))
    faces = lookup[np.concatenate(face_chunks)]
    del sums, counts, lookup, face_chunks
    mesh = o3d.geometry.TriangleMesh(o3d.utility.Vector3dVector(vertices), o3d.utility.Vector3iVector(faces))
    mesh.remove_duplicated_triangles(); mesh.remove_degenerate_triangles(); mesh.remove_unreferenced_vertices()
    clustered = {'vertices': len(mesh.vertices), 'triangles': len(mesh.triangles)}
    print(json.dumps({'stage': 'quadric-simplification', 'clustered': clustered, 'targetTriangles': target}), flush=True)
    simplified = mesh.simplify_quadric_decimation(target, boundary_weight=8)
    simplified.remove_degenerate_triangles(); simplified.remove_duplicated_triangles(); simplified.remove_unreferenced_vertices(); simplified.compute_vertex_normals()
    v = np.asarray(simplified.vertices).copy(); f = np.asarray(simplified.triangles).copy(); normals = np.asarray(simplified.vertex_normals).copy()
    np.savez_compressed(work / 'fjord-simplified.npz', vertices=v, faces=f, normals=normals)
    o3d.io.write_triangle_mesh(str(work / 'fjord-simplified.ply'), simplified, write_ascii=False)
    components, component_counts, areas = simplified.cluster_connected_triangles()
    return {'method': 'Source vertices clustered by spatial voxel with exact source-coordinate averages, followed by Open3D quadric edge-collapse simplification; no learned or generative processing.',
            'voxelNativeUnits': voxel, 'clusterMaximumWithinCellDistanceNative': float(np.sqrt(3) * voxel), 'clustered': clustered,
            'vertices': len(v), 'triangles': len(f), 'boundsMin': v.min(0).tolist(), 'boundsMax': v.max(0).tolist(),
            'connectedComponentTriangleCounts': sorted(map(int, component_counts), reverse=True),
            'edgeManifoldAllowBoundary': bool(simplified.is_edge_manifold(allow_boundary_edges=True)), 'vertexManifold': bool(simplified.is_vertex_manifold()),
            'watertight': bool(simplified.is_watertight()), 'selfIntersectionNotAssessed': True,
            'output': str((work / 'fjord-simplified.npz').relative_to(ROOT))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-only', action='store_true'); parser.add_argument('--voxel', type=float, default=.3); parser.add_argument('--triangles', type=int, default=110000)
    args = parser.parse_args(); assert .15 <= args.voxel <= 1 and 20000 <= args.triangles <= 250000
    paths = registration(); candidate, source, receipt = paths.registered_source('fjord-sculpt')
    assert paths.file_digest(source) == (SHA, 648187484), 'Registered Fjord original hash/size changed'
    receipt_hash = hashlib.sha256((source.parent / 'receipt.json').read_bytes()).hexdigest()
    with source.open('rb') as stream: header = stream.read(80); n = struct.unpack('<I', stream.read(4))[0]
    assert 84 + 50 * n == source.stat().st_size
    triangles = np.memmap(source, dtype=DTYPE, mode='r', offset=84, shape=(n,))
    low = np.array([np.inf] * 3); high = -low; finite = degenerate = 0
    for start in range(0, n, 250000):
        v = triangles[start:start + 250000]['vertices']; finite += int(np.isfinite(v).all(axis=(1, 2)).sum()); low = np.minimum(low, v.min(axis=(0, 1))); high = np.maximum(high, v.max(axis=(0, 1)))
        degenerate += int((np.linalg.norm(np.cross(v[:, 1] - v[:, 0], v[:, 2] - v[:, 0]), axis=1) < 1e-12).sum())
    attrs, frequencies = np.unique(triangles['attribute'], return_counts=True)
    work = paths.checked_path(candidate / 'work', ROOT, directory=True, create=True)
    report = {'candidateId': 'fjord-sculpt', 'sourceSha256': SHA, 'sourceBytes': receipt['bytes'], 'sourceTriangles': n,
              'allTrianglesFinite': finite == n, 'degenerateNativeAreaBelow1e12': degenerate,
              'boundsMin': low.tolist(), 'boundsMax': high.tolist(), 'dimensions': (high - low).tolist(),
              'facetAttributes': dict(zip(map(str, attrs.tolist()), map(int, frequencies.tolist()))),
              'headerColorMaterial': header.decode('ascii', 'replace').strip(), 'sourceUnitsListing': 'centimetres; physical anatomy fit remains separate',
              'sourceRigUVTextures': 'None in STL; uniform gray header/facet fields do not supply a painted coat.',
              'sourcePreviewMethod': 'Every13th triangle centroid, depth-selected orthographic surface points with normal lighting; visibly labeled sampled, not a complete polygon raster.',
              'anatomyOrientation': 'Actual sampled orthos inspected: +Y up, +Z muzzle-forward; source has four standing legs, upright sculpted mane, sculpted long tail.', 'originalSourcePreserved': True}
    existing = work / 'source-audit.json'
    if existing.is_file():
        previous = json.loads(existing.read_text())
        if previous.get('sourceSha256') == SHA and 'simplification' in previous: report['simplification'] = previous['simplification']
    orthos(triangles, low, high, work / 'source-orthos.png')
    (work / 'source-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    if not args.audit_only:
        start = time.monotonic(); report['simplification'] = simplify(triangles, low, high, args.voxel, args.triangles, work); report['simplification']['seconds'] = time.monotonic() - start
        (work / 'source-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    assert hashlib.sha256((source.parent / 'receipt.json').read_bytes()).hexdigest() == receipt_hash
    assert paths.file_digest(source) == (SHA, receipt['bytes']), 'Original changed during numeric preparation'
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__': main()
