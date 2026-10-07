"""Pack CC0 plant specimens without gallery translations, retaining leaf alpha masks.
Usage: python3 tools/asset-gen/build-undergrowth.py /path/to/downloaded-sources
Each asset directory contains its original glTF, buffer, maps and downloads.json.
"""
from pathlib import Path
from PIL import Image
import hashlib,io,json,struct,sys
source=Path(sys.argv[1]);dest=Path('assets/models/world/undergrowth');dest.mkdir(parents=True,exist_ok=True)
manifest={'license':'CC0-1.0','processing':'Original individual meshes and metre-scale geometry retained. Gallery node translations removed. Official alpha mask packed into base colour; normal and ARM maps kept. WebP textures require EXT_texture_webp. No geometry decimation.','assets':[]}
for name in ['fern_02','shrub_03']:
 folder=source/name;j=json.loads((folder/(name+'_1k.gltf')).read_text());blob=bytearray((folder/j['buffers'][0]['uri']).read_bytes());j['buffers']=[{'byteLength':len(blob)}]
 for node in j['nodes']:node['translation']=[0,0,0]
 def append(data):
  while len(blob)%4:blob.append(0)
  i=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data);return i
 for im in j['images']:
  image=Image.open(folder/im['uri'])
  if '_diff' in im['uri']:
   image=image.convert('RGBA');alpha=Image.open(folder/'textures'/(name+'_alpha_1k.png')).convert('L');assert image.size==alpha.size;image.putalpha(alpha)
  else:image.thumbnail((512,512),Image.Resampling.LANCZOS)
  data=io.BytesIO();image.save(data,'WEBP',lossless=True,method=6)
  im.pop('uri');im['mimeType']='image/webp';im['bufferView']=append(data.getvalue())
 for tex in j['textures']:tex['extensions']={'EXT_texture_webp':{'source':tex.pop('source')}}
 j['extensionsUsed']=j['extensionsRequired']=['EXT_texture_webp'];j['buffers'][0]['byteLength']=len(blob)
 packed=json.dumps(j,separators=(',',':')).encode();packed+=b' '*((-len(packed))%4);blob+=b'\x00'*((-len(blob))%4)
 glb=struct.pack('<III',0x46546c67,2,28+len(packed)+len(blob))+struct.pack('<II',len(packed),0x4e4f534a)+packed+struct.pack('<II',len(blob),0x004e4942)+blob
 path=dest/(name+'.glb');path.write_bytes(glb)
 counts=[sum(j['accessors'][p['indices']]['count']//3 for p in mesh['primitives']) for mesh in j['meshes']]
 entry={'id':name,'file':path.name,'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest(),'sourcePage':'https://polyhaven.com/a/'+name,'license':'CC0-1.0','authors':{'fern_02':['Rob Tuytel (scanning)','Rico Cilliers (modeling)'],'shrub_03':['Rico Cilliers']}[name],'specimens':[{'name':n['name'],'triangles':counts[n['mesh']]} for n in j['nodes']],'sources':json.loads((folder/'downloads.json').read_text())};manifest['assets'].append(entry);print(name,len(glb),counts)
# Reuse the already verified builder scan without another download or copy.
reused={'id': 'wild_rooibos_bush', 'file': '../builder/wild_rooibos_bush.glb', 'bytes': 1559720, 'sha256': '2eb7176c13737e47db3a244634c5577b3d790970a5b99b1a08a924dd100e9000', 'license': 'CC0-1.0', 'sourcePage': 'https://polyhaven.com/a/wild_rooibos_bush', 'authors': {'James Ray Cock': 'modeling', 'Jenelle van Heerden': 'photography'}, 'sources': [{'file': 'wild_rooibos_bush.gltf', 'url': 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/wild_rooibos_bush/wild_rooibos_bush_1k.gltf', 'bytes': 23122, 'sha256': '7f3fb17e4606e33d0bc4239c4901c9610b4bd17fe26b6780ba11ab4493f25d29'}, {'file': 'textures/wild_rooibos_bush_nor_gl_1k.jpg', 'url': 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wild_rooibos_bush/wild_rooibos_bush_nor_gl_1k.jpg', 'bytes': 463170, 'sha256': 'ffd557b4cb732d24988d41741398df150567f3ac9d1433f11b88d60158c953d4'}, {'file': 'textures/wild_rooibos_bush_diff_1k.jpg', 'url': 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wild_rooibos_bush/wild_rooibos_bush_diff_1k.jpg', 'bytes': 374003, 'sha256': 'd963cdaf769bc39bb57295d518b37cd9456168cf5e3b82fd59f58c98d3faf596'}, {'file': 'textures/wild_rooibos_bush_arm_1k.jpg', 'url': 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/wild_rooibos_bush/wild_rooibos_bush_arm_1k.jpg', 'bytes': 367273, 'sha256': 'e0e512f263b8f1fe1c485e61912ba1ce5d42b397cf9a4e2b1786677e732bb84b'}, {'file': 'wild_rooibos_bush.bin', 'url': 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/wild_rooibos_bush/wild_rooibos_bush.bin', 'bytes': 1236928, 'sha256': '7a3471b4d110fe9927f4a200191eae86fa3c0a08f8e8e797d22e94a1703322e1'}, {'file': 'textures/wild_rooibos_bush_alpha_1k.png', 'url': 'https://dl.polyhaven.org/file/ph-assets/Models/png/1k/wild_rooibos_bush/wild_rooibos_bush_alpha_1k.png', 'bytes': 90888, 'sha256': '6a9fcd7a62aab1366b0ae50273c4a638591e932049a647ccadce6687ce657b72'}], 'note': 'Reuses the existing processed CC0 builder asset. Only individual B and C specimens are used; gallery translations are removed at runtime and during view baking.'}
assert hashlib.sha256((dest/reused['file']).read_bytes()).hexdigest()==reused['sha256']
manifest['assets'].append(reused)
(dest/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
