"""Read BlueMesh's registered GLB using glTF scene/linear-skin semantics.

No embedded Blender scripts or source animation are executed. Positions returned
are the actual glTF scene-zero pose, not Blender's reconstructed armature rest.
"""
from pathlib import Path
import hashlib
import json
import struct
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE = ROOT / 'assets/models/horse-imports/bluemesh-draft'


class SourcePose:
    def __init__(self, path=None):
        receipt = json.loads((CANDIDATE / 'source/receipt.json').read_text())
        self.path = Path(path or ROOT / receipt['path'])
        raw = self.path.read_bytes()
        self.sha256 = hashlib.sha256(raw).hexdigest()
        if self.sha256 != receipt['sha256'] or len(raw) != receipt['bytes']:
            raise ValueError('Registered BlueMesh source hash/size mismatch')
        if struct.unpack_from('<4sII', raw) != (b'glTF', 2, len(raw)):
            raise ValueError('Expected complete GLB 2')
        chunks = {}; offset = 12
        while offset < len(raw):
            size, kind = struct.unpack_from('<II', raw, offset)
            if kind in chunks or offset + 8 + size > len(raw):
                raise ValueError('Malformed GLB chunk')
            chunks[kind] = raw[offset + 8:offset + 8 + size]; offset += 8 + size
        self.doc = json.loads(chunks[0x4E4F534A])
        self.binary = chunks[0x004E4942]
        if len(self.doc['buffers']) != 1 or self.doc['buffers'][0].get('uri'):
            raise ValueError('Source must be self-contained')
        self.parents = {}
        for i, node in enumerate(self.doc['nodes']):
            for child in node.get('children', []):
                if child in self.parents: raise ValueError('Multiple node parents')
                self.parents[child] = i
        self._world = {}

    def accessor(self, index):
        a = self.doc['accessors'][index]; v = self.doc['bufferViews'][a['bufferView']]
        if a.get('sparse'): raise ValueError('Sparse source accessor unsupported')
        dtype = {5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
        width = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        item = np.dtype(dtype).itemsize
        result = np.ndarray((a['count'], width), dtype=dtype, buffer=self.binary,
                            offset=v.get('byteOffset',0)+a.get('byteOffset',0),
                            strides=(v.get('byteStride',width*item),item)).copy()
        if a.get('normalized') and a['componentType'] != 5126:
            info=np.iinfo(dtype); result=result.astype(float)/info.max
            if info.min<0: result=np.maximum(result,-1)
        return result

    def world(self, index, active=None):
        if index in self._world: return self._world[index]
        active = set(active or ())
        if index in active: raise ValueError('Node cycle')
        active.add(index); node=self.doc['nodes'][index]
        if 'matrix' in node: local=np.array(node['matrix'],dtype=float).reshape(4,4).T
        else:
            x,y,z,w=node.get('rotation',[0,0,0,1]); local=np.eye(4)
            local[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                                  [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                                  [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(node.get('scale',[1,1,1]))
            local[:3,3]=node.get('translation',[0,0,0])
        self._world[index]=(self.world(self.parents[index],active)@local if index in self.parents else local)
        return self._world[index]

    def primitives(self):
        reachable=set()
        def visit(i):
            reachable.add(i)
            for j in self.doc['nodes'][i].get('children',[]): visit(j)
        for i in self.doc['scenes'][self.doc.get('scene',0)]['nodes']: visit(i)
        for ni in sorted(reachable):
            node=self.doc['nodes'][ni]
            if 'mesh' not in node: continue
            for pi,p in enumerate(self.doc['meshes'][node['mesh']]['primitives']):
                if p.get('mode',4)!=4: raise ValueError('Only triangle source primitives supported')
                a=p['attributes']; pos=self.accessor(a['POSITION']).astype(float)
                normal=self.accessor(a['NORMAL']).astype(float) if 'NORMAL' in a else None
                if 'skin' in node:
                    skin=self.doc['skins'][node['skin']]
                    ib=self.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
                    transforms=np.array([self.world(j)@m for j,m in zip(skin['joints'],ib)])
                    joints=self.accessor(a['JOINTS_0']).astype(int); weights=self.accessor(a['WEIGHTS_0']).astype(float)
                    weights/=weights.sum(axis=1,keepdims=True)
                    blend=np.einsum('nk,nkij->nij',weights,transforms[joints])
                    posed=np.einsum('nij,nj->ni',blend,np.c_[pos,np.ones(len(pos))])[:,:3]
                    if normal is not None:
                        normal=np.einsum('nij,nj->ni',blend[:,:3,:3],normal)
                else:
                    m=self.world(ni); posed=(np.c_[pos,np.ones(len(pos))]@m.T)[:,:3]
                    if normal is not None: normal=normal@np.linalg.inv(m[:3,:3])
                if normal is not None: normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-10)
                if not np.isfinite(posed).all(): raise ValueError('Nonfinite source posed vertices')
                yield {'node':ni,'mesh':node['mesh'],'primitive':pi,'name':node.get('name',''),
                       'positions':posed,'normals':normal,'uv':self.accessor(a['TEXCOORD_0']) if 'TEXCOORD_0' in a else None,
                       'indices':self.accessor(p['indices']).ravel().astype(int), 'material':p.get('material',0),
                       'sourceSkin':node.get('skin')}

    def summary(self):
        meshes=[]
        for p in self.primitives():
            points=p['positions']
            meshes.append({k:p[k] for k in ('node','mesh','name','sourceSkin')}|{
                'vertices':len(points),'triangles':len(p['indices'])//3,
                'bounds':[points.min(0).tolist(),points.max(0).tolist()]})
        return {'sourceSha256':self.sha256,'coordinates':'+Z forward / +Y up as source scene',
                'method':'glTF world(node) * inverseBind * POSITION weighted by normalized source JOINTS_0/WEIGHTS_0; world(node)*POSITION for static meshes',
                'meshes':meshes,'bones':[{'name':self.doc['nodes'][i].get('name'), 'point':self.world(i)[:3,3].tolist()}
                    for i in self.doc['skins'][0]['joints']]}


if __name__=='__main__':
    print(json.dumps(SourcePose().summary(),indent=2))
