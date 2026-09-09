import sys,importlib.util,json,pathlib,io,struct,numpy as np
from PIL import Image
r=pathlib.Path.cwd();spec=importlib.util.spec_from_file_location('v',r/'tools/validate-breed-assets.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
g=m.GLB(r/'assets/models/hero-horse/hero-textured-raw.glb');p=g.doc['meshes'][0]['primitives'][0]
pos=np.array(g.accessor(p['attributes']['POSITION']));uv=np.array(g.accessor(p['attributes']['TEXCOORD_0']));print('BOUNDS',pos.min(0),pos.max(0));raw=(r/'assets/models/hero-horse/hero-textured-raw.glb').read_bytes();jl=struct.unpack_from('<I',raw,12)[0];binary=raw[28+jl:];v=g.doc['bufferViews'][g.doc['images'][0]['bufferView']];im=Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB');im.save(r/'assets/models/hero-horse/paint-albedo.png');a=np.asarray(im);col=a[np.clip((uv[:,1]*(a.shape[0]-1)).astype(int),0,a.shape[0]-1),np.clip((uv[:,0]*(a.shape[1]-1)).astype(int),0,a.shape[1]-1)]
# glTF V begins at texture top; image row orientation confirmed visually later.
for side in (1,-1):
    ids=np.where((pos[:,0]>.68)&(pos[:,0]<.84)&(pos[:,1]>.51)&(pos[:,1]<.69)&(pos[:,2]*side>.03))[0]
    ids=ids[np.argsort(col[ids].mean(1))[:30]]
    print('EYE',side,'xyz',pos[ids].mean(0),'dark',col[ids].mean(0),'minmax',pos[ids].min(0),pos[ids].max(0))
