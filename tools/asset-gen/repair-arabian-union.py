"""Unsigned actual-surface union; ordinary voxel morphology, no generated art."""
import json
from pathlib import Path
import numpy as np
import trimesh
from scipy.ndimage import binary_closing, binary_fill_holes
from skimage.measure import marching_cubes

ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'assets/models/horse-imports/arabian-sculpt';WORK=BASE/'work'
d=np.load(WORK/'standing-remesh.npz');p=d['source'];f=d['faces'];model=trimesh.Trimesh(p,f,process=False)
vox=model.voxelized(pitch=.0065)
padding=4
occupied=binary_closing(np.pad(vox.matrix,padding),structure=np.ones((3,3,3),dtype=bool),iterations=3)
occupied=binary_fill_holes(occupied)
vertices,faces,_,_=marching_cubes(occupied.astype(np.float32),level=.5)
points=trimesh.transform_points(vertices-padding,vox.transform)
np.savez_compressed(WORK/'standing-union.npz',source=points,faces=faces)
report=json.loads((WORK/'standing-remesh-report.json').read_text())
report.update({'unsignedSurfaceOccupancyUnion':True,'voxelPitchSourceUnits':.0065,'ordinaryMorphologicalClosingIterations':3,'sourceHeadGraftSeamsRepaired':True,'sourceDetailedTopologyPreserved':False,'method':report['method']+' Final unsigned actual-surface voxel occupancy union and three-cell closing/fill repair overlapping cut caps and neck/hip seams; the derivative is reduced to game topology. Source morphology is retained within the explicit voxel/join-fairing limit, not exact original vertices.'})
(WORK/'standing-union-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'unsignedUnionVertices':len(points),'triangles':len(faces),'voxelGrid':list(occupied.shape),'pitch':.0065}),flush=True)
