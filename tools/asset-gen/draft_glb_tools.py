"""Offline glTF numeric/buffer helpers for the actual BlueMesh derivatives."""
import copy, json, struct
from pathlib import Path
import numpy as np

class GLB:
 def __init__(self,path):
  raw=Path(path).read_bytes()
  if struct.unpack_from('<4sII',raw)!=(b'glTF',2,len(raw)):raise ValueError('Incomplete GLB')
  n=struct.unpack_from('<I',raw,12)[0];self.doc=json.loads(raw[20:20+n]);self.binary=bytearray(raw[28+n:]);self.parents={};self.cache={}
  for i,node in enumerate(self.doc['nodes']):
   for c in node.get('children',[]):self.parents[c]=i
 def accessor(self,index):
  a=self.doc['accessors'][index];v=self.doc['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1',5122:'<i2',5120:'i1'}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];size=np.dtype(dtype).itemsize
  result=np.ndarray((a['count'],width),dtype=dtype,buffer=self.binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',size*width),size)).copy()
  if a.get('normalized') and a['componentType']!=5126:result=result.astype(float)/np.iinfo(dtype).max
  return result
 def append(self,array,kind,component=5126,target=None):
  array=np.asarray(array,dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component]);self.binary.extend(bytes((-len(self.binary))%4));v={'buffer':0,'byteOffset':len(self.binary),'byteLength':array.nbytes}
  if target:v['target']=target
  self.binary.extend(array.tobytes());vi=len(self.doc['bufferViews']);self.doc['bufferViews'].append(v);a={'bufferView':vi,'componentType':component,'count':len(array),'type':kind}
  if kind=='VEC3':a['min']=array.min(0).tolist();a['max']=array.max(0).tolist()
  ai=len(self.doc['accessors']);self.doc['accessors'].append(a);return ai
 def world(self,index):
  if index in self.cache:return self.cache[index]
  n=self.doc['nodes'][index];m=np.eye(4)
  if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
  else:m[:3,:3]=quaternion_matrix(n.get('rotation',[0,0,0,1]))@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
  self.cache[index]=self.world(self.parents[index])@m if index in self.parents else m;return self.cache[index]
 def compact(self):
  d=self.doc;used=set()
  for mesh in d['meshes']:
   for p in mesh['primitives']:used.update(p['attributes'].values());used.add(p['indices'])
  for s in d['skins']:used.add(s['inverseBindMatrices'])
  for a in d.get('animations',[]):
   for s in a['samplers']:used.update([s['input'],s['output']])
  amap={old:i for i,old in enumerate(sorted(used))};views={d['accessors'][a]['bufferView'] for a in used};views.update(i['bufferView'] for i in d.get('images',[]) if 'bufferView' in i);vmap={old:i for i,old in enumerate(sorted(views))};binary=bytearray();newviews=[]
  for old in sorted(views):
   v=copy.deepcopy(d['bufferViews'][old]);start=v.get('byteOffset',0);payload=self.binary[start:start+v['byteLength']];binary.extend(bytes((-len(binary))%4));v['byteOffset']=len(binary);binary.extend(payload);newviews.append(v)
  newaccess=[]
  for old in sorted(used):a=copy.deepcopy(d['accessors'][old]);a['bufferView']=vmap[a['bufferView']];newaccess.append(a)
  for mesh in d['meshes']:
   for p in mesh['primitives']:p['attributes']={k:amap[v] for k,v in p['attributes'].items()};p['indices']=amap[p['indices']]
  for s in d['skins']:s['inverseBindMatrices']=amap[s['inverseBindMatrices']]
  for a in d.get('animations',[]):
   for s in a['samplers']:s['input']=amap[s['input']];s['output']=amap[s['output']]
  for i in d.get('images',[]):
   if 'bufferView' in i:i['bufferView']=vmap[i['bufferView']]
  d['accessors']=newaccess;d['bufferViews']=newviews;self.binary=binary
 def encoded(self):
  self.binary.extend(bytes((-len(self.binary))%4));self.doc['buffers']=[{'byteLength':len(self.binary)}];j=json.dumps(self.doc,separators=(',',':'),allow_nan=False).encode();j+=b' '*((-len(j))%4)
  return struct.pack('<4sII',b'glTF',2,28+len(j)+len(self.binary))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(self.binary),0x004E4942)+self.binary

def quaternion_matrix(q):
 x,y,z,w=np.array(q,dtype=float)/np.linalg.norm(q)
 return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def matrix_quaternion(m):
 # Symmetric eigenproblem is stable near180degrees and normalizes the frame.
 k=np.array([[m[0,0]-m[1,1]-m[2,2],m[1,0]+m[0,1],m[2,0]+m[0,2],m[2,1]-m[1,2]],
 [m[1,0]+m[0,1],m[1,1]-m[0,0]-m[2,2],m[2,1]+m[1,2],m[0,2]-m[2,0]],
 [m[2,0]+m[0,2],m[2,1]+m[1,2],m[2,2]-m[0,0]-m[1,1],m[1,0]-m[0,1]],
 [m[2,1]-m[1,2],m[0,2]-m[2,0],m[1,0]-m[0,1],m.trace()]])/3
 values,vectors=np.linalg.eigh(k);q=vectors[:,values.argmax()]
 if q[3]<0:q=-q
 return q.tolist()
def direction_rotation(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);c=float(a@b)
 if c>1-1e-10:return np.eye(3)
 if c<-1+1e-10:
  axis=np.cross(a,np.array((1,0,0)) if abs(a[0])<.8 else np.array((0,1,0)));axis/=np.linalg.norm(axis);return 2*np.outer(axis,axis)-np.eye(3)
 k=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]);return np.eye(3)+k+k@k/(1+c)
def gltf_to_blender(p):return np.c_[p[:,0],-p[:,2],p[:,1]]
def blender_to_gltf(p):return np.c_[p[:,0],p[:,2],-p[:,1]]
