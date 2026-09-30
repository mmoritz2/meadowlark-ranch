#!/usr/bin/env python3
"""Finite nearest-surface QA of the approved Fjord source-derived LOD.

Usage: python3 tools/asset-gen/audit-fjord-lod.py
Ordinary deterministic geometry measurements, no learned/generative processing.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
import open3d as o3d

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/fjord-sculpt'
SOURCE=BASE/'source/Fjord_Final.stl'
DTYPE=np.dtype([('normal','<f4',(3,)),('vertices','<f4',(3,3)),('attribute','<u2')])
SHA='c652933791dc85ea7ec9a1c9b4707b04b4c4a1f1bb28c27a99b58a0f978c2178'


def main():
    source=np.memmap(SOURCE,dtype=DTYPE,mode='r',offset=84,shape=(12963748,))
    data=np.load(BASE/'work/fjord-simplified.npz');v=data['vertices'];f=data['faces']
    mesh=o3d.geometry.TriangleMesh(o3d.utility.Vector3dVector(v),o3d.utility.Vector3iVector(f))
    scene=o3d.t.geometry.RaycastingScene();scene.add_triangles(o3d.t.geometry.TriangleMesh.from_legacy(mesh))
    # Every37th source triangle, with centroid and allthree native corner points.
    # This checks original microdetail/silhouette against actual triangles,
    # rather than substituting distance to only simplified vertex positions.
    tris=source[::37]['vertices'];points=np.concatenate([tris.reshape(-1,3),tris.mean(1)]).astype(np.float32)
    values=[]
    for start in range(0,len(points),100000):
        values.append(scene.compute_distance(o3d.core.Tensor(points[start:start+100000])).numpy())
    distance=np.concatenate(values);scale=json.loads((BASE/'game/build-report.json').read_text())['physicalFit']['metresPerNativeUnit']
    percent={str(p):float(np.percentile(distance,p)) for p in [0,50,90,95,99,99.9,100]}
    components,counts,areas=mesh.cluster_connected_triangles()
    index=int(np.argmax(distance));report={'sourceSha256':SHA,'lodSha256':hashlib.sha256((BASE/'work/fjord-simplified.npz').read_bytes()).hexdigest(),
        'method':'Open3D RaycastingScene point-to-actual-triangle unsigned nearest distance; every37th source triangle centroid and allthree vertices. Deterministic ordinary numeric processing, noAI.',
        'sourceTriangles':12963748,'sampledSourceTriangles':len(tris),'sourceSurfaceSamples':len(points),'metresPerNativeUnit':scale,
        'distancePercentilesNative':percent,'distancePercentilesM':{key:value*scale for key,value in percent.items()},
        'worstSourcePointNative':points[index].tolist(),'worstDistanceM':float(distance[index]*scale),
        'lodVertices':len(v),'lodTriangles':len(f),'lodBoundsMinNative':v.min(0).tolist(),'lodBoundsMaxNative':v.max(0).tolist(),
        'components':sorted(map(int,counts),reverse=True),'edgeManifoldAllowBoundary':bool(mesh.is_edge_manifold(True)),'vertexManifold':bool(mesh.is_vertex_manifold()),'watertight':bool(mesh.is_watertight()),
        'sourceTopologyNotClaimedPreserved':True,'selfIntersectionsNotAssessed':True,'finite':bool(np.isfinite(distance).all()),
        'scope':'Source-to-LOD geometry sampling only; animated pose/material/tack QA is recorded separately. This reduced derivative is not asserted to reproduce every microfacet.'}
    (BASE/'work/lod-fidelity-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))


if __name__=='__main__':main()
