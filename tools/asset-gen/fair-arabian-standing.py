"""Ordinary localized fairing of the approved source-derived standing sculpture."""
import json
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix

root=Path(__file__).resolve().parents[2]
work=root/'assets/models/horse-imports/arabian-sculpt/work'
d=np.load(work/'standing-remesh.npz');p=d['source'].copy();f=d['faces'];before=p.copy()
edges=np.vstack([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]);edges=np.unique(np.sort(edges,axis=1),axis=0)
row=np.r_[edges[:,0],edges[:,1]];col=np.r_[edges[:,1],edges[:,0]]
matrix=coo_matrix((np.ones(len(row)),(row,col)),shape=(len(p),len(p))).tocsr();degree=np.asarray(matrix.sum(1)).ravel()
# Protect sole silhouette and the original sculpture's facial features while
# fairing the voxel corrugation and adapted shoulder/hip joins.
strength=np.ones(len(p));strength[p[:,2]<.14]=0
face=(p[:,1]<.85)&(p[:,2]>2.35);strength[face]=.25
for _ in range(80):
    delta=matrix@p/degree[:,None]-p;p+=.46*strength[:,None]*delta
    delta=matrix@p/degree[:,None]-p;p-=.47*strength[:,None]*delta
np.savez_compressed(work/'standing-remesh.npz',source=p,faces=f)
r=json.loads((work/'standing-remesh-report.json').read_text())
r.update({'ordinaryLocalTaubinFairing':{'iterations':80,'lambda':.46,'mu':-.47,'solesProtected':True,'faceStrength':.25,'maximumDisplacementSourceUnits':float(np.linalg.norm(p-before,axis=1).max()),'meanDisplacementSourceUnits':float(np.linalg.norm(p-before,axis=1).mean())},'sourceHeadGraftSeamsRepaired':True,'allOriginalVerticesOrTopologyPreserved':False})
(work/'standing-remesh-report.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r['ordinaryLocalTaubinFairing']))
