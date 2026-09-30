"""Five real conformation/coat/groom derivatives of the acquired BlueMesh draft.

Registered source files are read only. Original detailed UV geometry, normal/MR
maps and original eye material are retained; clearly described derivative coat
atlases and regional sculpting make five physical bodies, not scaled recolors.
Run with the bundled Python (NumPy/Pillow), never a downloaded source script.
"""
from pathlib import Path
import copy, hashlib, io, json, sys
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0,str(Path(__file__).resolve().parent))
from draft_glb_tools import GLB, gltf_to_blender, blender_to_gltf, matrix_quaternion, direction_rotation

ROOT=Path(__file__).resolve().parents[2]
CANDIDATE=ROOT/'assets/models/horse-imports/bluemesh-draft'
RIG=CANDIDATE/'work/canonical-rig'
GAME=CANDIDATE/'game'; SHARED=GAME/'shared'; OUT=GAME/'breeds'
EXPECTED_SOURCE='b5a33b0dd0e5e921d95a6b593223e2d098c68d00b57d15a90228ca5f6aa7c564'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
receipt=json.loads((CANDIDATE/'source/receipt.json').read_text())
source=CANDIDATE/'source/horse_draft_horse.glb'
receipt_sha=sha(CANDIDATE/'source/receipt.json')
assert sha(source)==EXPECTED_SOURCE==receipt['sha256'] and source.stat().st_size==receipt['bytes']
base_profile=json.loads((RIG/'draft-profile.json').read_text())
assert sha(RIG/'draft-canonical-rig.glb')==base_profile['rigSha256']
conversion=json.loads((RIG/'conversion-report.json').read_text())
CONF=json.loads((ROOT/'tools/asset-gen/breed-conformation.json').read_text())
specs={k:copy.deepcopy(CONF['conformations'][k]) for k in ['vanner','percheron','shire','clyde']}
specs['suffolk']={'game_id':'suffolk','canonical_breed':'Suffolk Punch','classification':'breed',
 'height':{'target_m':1.67,'reference_range_m':[1.6002,1.7272],'range_basis':'Suffolk Horse Society mature15¾–17 hands; some individuals exceed17 hands.'},
 'morphology':{'build':'Compact deep round-ribbed draft with broad quarters and relatively short legs',
 'neck':'Deep muscular collar neck, gracefully tapered','head_face':'Broad shapely head, proportionate length',
 'ears':'Medium alert ears','limbs':'Short strong clean legs, short cannons, long clean hocks',
 'hooves':'Large round wide-coronet feet','mane_tail':'Moderate full chestnut mane and tail',
 'feathering':'Clean legs with minimal heel hair','coat':'Whole chestnut; this exemplar has no white markings'},
 'sculpt_targets':{'body_length':.98,'barrel_width':1.26,'body_depth':1.18,'neck_length':1.01,'neck_thickness':1.25,
 'head_length':1.03,'head_width':1.13,'ear_length':.95,'limb_length':.91,'hoof_width':1.20,'hindquarter_width':1.25,
 'face_profile_depth_per_withers':.005,'neck_arch_rise_per_withers':.040},
 'source_ids':['suffolk-official'],'source_urls':['https://suffolkhorsesociety.org.uk/about/breed-characteristics/'],
 'numeric_scope':'Height uses the official envelope; proportional sculpt values are original art choices, not breed association measured averages.'}
styles={
 'vanner':{'mane':1.24,'tail_width':1.28,'feather_length':1.8,'feather_width':1.4,'coat':'black and white piebald','hair':'mixed black/white'},
 'percheron':{'mane':.83,'tail_width':.90,'feather_length':.25,'feather_width':.80,'coat':'dapple steel gray','hair':'charcoal gray'},
 'shire':{'mane':1.11,'tail_width':1.15,'feather_length':1.2,'feather_width':1.15,'coat':'black, white blaze and stockings','hair':'black; silky rear feather'},
 'clyde':{'mane':1.02,'tail_width':1.07,'feather_length':1.45,'feather_width':1.13,'coat':'original source bay, blaze and stockings','hair':'original dark mane/tail; white feather'},
 'suffolk':{'mane':.74,'tail_width':.90,'feather_length':0,'feather_width':1,'coat':'whole chestnut, clean legs','hair':'chestnut'}
}

def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

class KD:
 """Small deterministic nearest-body tree, no extra dependencies or source code."""
 def __init__(self,p):
  self.p=p;self.nodes=[]
  def build(ids,depth):
   if not len(ids):return -1
   ax=depth%3;ids=ids[np.argsort(p[ids,ax],kind='stable')];half=len(ids)//2
   node=len(self.nodes);self.nodes.append([int(ids[half]),ax,-1,-1]);self.nodes[node][2]=build(ids[:half],depth+1);self.nodes[node][3]=build(ids[half+1:],depth+1);return node
  self.root=build(np.arange(len(p)),0)
 def find(self,q):
  best=-1;distance=float('inf');stack=[self.root]
  while stack:
   node=stack.pop()
   if node<0:continue
   i,ax,left,right=self.nodes[node];delta=q-self.p[i];d=float(delta@delta)
   if d<distance:best,distance=i,d
   gap=float(delta[ax]);near,far=(left,right) if gap<0 else (right,left)
   if gap*gap<distance:stack.append(far)
   stack.append(near)
  return best

base=GLB(RIG/'draft-canonical-rig.glb');bodyprim=base.doc['meshes'][0]['primitives'][0]
BP=gltf_to_blender(base.accessor(bodyprim['attributes']['POSITION']).astype(float));W=float(base_profile['withersM'])
withers_mask=(abs(BP[:,0])<.1)&(BP[:,1]>-.15)&(BP[:,1]<-.075)
assert withers_mask.sum()>5 and abs(BP[withers_mask,2].max()-W)<2e-6
withers_index=int(np.where(withers_mask)[0][BP[withers_mask,2].argmax()])
body_tree=KD(BP)
groom_data=np.load(RIG/'source-groom-components.npz');GP=groom_data['points'];GC=groom_data['component'];GK=groom_data['kind']
components=[np.where(GC==c)[0] for c in range(int(GC.max())+1)]
assert len(GP)==348546 and len(components)==5339

def cage(points,key):
 """Continuous anatomical cage relative to the source's Clydesdale-like draft."""
 ratios={k:specs[key]['sculpt_targets'][k]/specs['clyde']['sculpt_targets'][k] for k in specs[key]['sculpt_targets'] if k not in ['face_profile_depth_per_withers','neck_arch_rise_per_withers']}
 s=specs[key]['sculpt_targets'];ref=specs['clyde']['sculpt_targets'];p=np.asarray(points,float)/W;x,y,z=p.T;forward=-y;q=p.copy()
 head=smooth(.51,.635,forward)*smooth(.80,.99,z)
 neck=smooth(.11,.37,forward)*smooth(.70,.89,z)
 torso=(1-neck)*smooth(.43,.66,z);rump=smooth(.22,.57,y)*torso
 q[:,0]*=1+torso*(ratios['barrel_width']-1)+rump*(ratios['hindquarter_width']-ratios['barrel_width'])
 q[:,1]=.18+(y-.18)*ratios['body_length']
 q[:,2]+=(ratios['limb_length']-1)*np.minimum(z,.64)
 q[:,2]+=(z-.88)*(ratios['body_depth']-1)*torso
 q[:,1]+=(y+.235)*(ratios['neck_length']-1)*neck
 q[:,2]+=(z-.92)*(ratios['neck_length']-1)*neck
 q[:,0]+=x*(ratios['neck_thickness']-1)*neck*(1-head)
 center=.92+np.clip((forward-.235)/.35,0,1)*.28
 q[:,2]+=(z-center)*(ratios['neck_thickness']-1)*neck*(1-head)
 crest=smooth(.08,.17,z-center);arch=(s['neck_arch_rise_per_withers']-ref['neck_arch_rise_per_withers'])*np.sin(np.clip((forward-.2)/.40,0,1)*np.pi)
 q[:,2]+=arch*neck*(1-head)*crest
 q[:,1]+=(y+.59)*(ratios['head_length']-1)*head
 q[:,2]+=(z-1.19)*(ratios['head_length']-1)*head
 q[:,0]+=x*(ratios['head_width']-1)*head
 profile=(s['face_profile_depth_per_withers']-ref['face_profile_depth_per_withers'])*np.exp(-((forward-.74)/.10)**2-((z-1.105)/.16)**2)
 q[:,1]-=profile*head
 ears=smooth(1.215,1.25,z)*smooth(.47,.54,forward)*(1-smooth(.60,.68,forward))
 q[:,2]+=(z-1.225)*(ratios['ear_length']-1)*ears
 hoof=(1-smooth(.065,.135,z))*smooth(.055,.085,abs(x))
 for side in [-1,1]:
  for front in [True,False]:
   h=conversion['rigPointsBlender'][('F' if front else 'H')+('L' if side<0 else 'R')+'.hoof']['head'];hx,hy,_=np.array(h)/W
   gate=hoof*smooth(.02,.07,x*side)*(1-smooth(.02,.16,y) if front else smooth(.30,.42,y))
   q[:,0]+=(x-hx)*(ratios['hoof_width']-1)*gate
   q[:,1]+=(y-hy)*(ratios['hoof_width']-1)*gate
 return q*W

def warp(points,key,scale):return cage(points,key)*scale
def normals_cage(points,normals,key,scale):
 h=2e-5;J=np.stack([(warp(points+np.eye(3)[a]*h,key,scale)-warp(points-np.eye(3)[a]*h,key,scale))/(2*h) for a in range(3)],axis=2)
 result=np.linalg.solve(J.transpose(0,2,1),normals[...,None])[...,0];result/=np.maximum(np.linalg.norm(result,axis=1)[:,None],1e-12);return result

def texture_payloads():
 SHARED.mkdir(parents=True,exist_ok=True);rows=[]
 for i,image in enumerate(base.doc['images']):
  view=base.doc['bufferViews'][image['bufferView']];payload=bytes(base.binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);digest=hashlib.sha256(payload).hexdigest();name=['source-body-basecolor','source-body-metalrough','source-body-normal'][i]+'-'+digest[:16]+'.png';target=SHARED/name
  if target.exists():assert target.read_bytes()==payload
  else:target.write_bytes(payload)
  rows.append({'file':name,'sha256':digest,'bytes':len(payload),'originalEncodedBytes':True})
 return rows
textures=texture_payloads();original=np.array(Image.open(SHARED/textures[0]['file']).convert('RGB').resize((2048,2048),Image.Resampling.LANCZOS),dtype=np.float32)/255

def uv_atlas():
 cache=OUT/'body-uv-position-map.npz'
 if cache.exists():d=np.load(cache);return d['points'],d['mask']
 uv=base.accessor(bodyprim['attributes']['TEXCOORD_0']).astype(float);size=2048;P=np.zeros((size,size,3),np.float32);mask=np.zeros((size,size),bool)
 for ids in base.accessor(bodyprim['indices']).reshape(-1,3):
  # glTF UV has its image origin at the top left, as does Pillow. Blender's
  # display UV flip belongs only in the native preview mesh, not this PNG map.
  u=uv[ids]*(size-1);lo=np.maximum(0,np.floor(u.min(0)).astype(int));hi=np.minimum(size-1,np.ceil(u.max(0)).astype(int))
  if np.any(hi<lo):continue
  yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];v0=u[1]-u[0];v1=u[2]-u[0];den=v0[0]*v1[1]-v1[0]*v0[1]
  if abs(den)<1e-9:continue
  a=((xx-u[0,0])*v1[1]-v1[0]*(yy-u[0,1]))/den;b=(v0[0]*(yy-u[0,1])-(xx-u[0,0])*v0[1])/den;ok=(a>=-.003)&(b>=-.003)&(a+b<=1.003)
  pos=BP[ids];result=pos[0]+a[...,None]*(pos[1]-pos[0])+b[...,None]*(pos[2]-pos[0]);part=P[lo[1]:hi[1]+1,lo[0]:hi[0]+1];part[ok]=result[ok];mask[lo[1]:hi[1]+1,lo[0]:hi[0]+1]|=ok
 for _ in range(8):
  for ax in [0,1]:
   for step in [-1,1]:
    near=np.roll(mask,step,ax);take=~mask&near;P[take]=np.roll(P,step,ax)[take];mask[take]=True
 np.savez_compressed(cache,points=P,mask=mask);return P,mask
OUT.mkdir(parents=True,exist_ok=True);UVP,UVM=uv_atlas()

def coat(key,folder):
 if key=='clyde':return None
 x,y,z=np.moveaxis(UVP,-1,0);luma=original@np.array((.2126,.7152,.0722));pale=luma>.51
 # Transfer fine source pigment/fur grain while removing the old bay/blaze
 # macro-color boundary. Original normal and roughness detail remains exact.
 blurred=np.array(Image.fromarray((luma*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9)),dtype=np.float32)/255
 grain=np.clip(luma/np.maximum(blurred,.05),.88,1.14)
 targets={'vanner':(.12,.105,.095),'percheron':(.58,.595,.61),'shire':(.15,.135,.125),'suffolk':(.55,.275,.145)}
 rgb=np.broadcast_to(targets[key],original.shape).copy()*grain[...,None]
 if key=='vanner':
  pattern=np.sin(y*4.5+z*3.1)+.58*np.sin(y*9.7-z*4.1)+.42*np.cos(x*7.8+z*4.9);white=smooth(-.03,.13,pattern)
  white=np.maximum(white,smooth(.05,.14,luma-.45)*smooth(1.02,1.22,-y));white=np.maximum(white,(1-smooth(.38,.68,z))*smooth(.10,.17,abs(x)))
  rgb=rgb*(1-white[...,None])+np.array((.87,.855,.82))*grain[...,None]*white[...,None]
 elif key=='percheron':
  field=np.sin(x*42+np.sin(y*17))*np.sin(y*38+np.sin(z*15))*np.sin(z*34+np.cos(x*20));area=smooth(.6,1.1,z)
  # Gray dapples have subtle light centers and a darker irregular ring. Solid
  # high-contrast dark dots would read as Appaloosa spots on this gray coat.
  dapple=(.10*smooth(.22,.68,field)-.045*np.exp(-((field-.16)/.20)**2))*area;rgb*=1+dapple[...,None]
 elif key=='shire':
  white=pale & ((-y>1.05)|((z<.57)&(abs(x)>.12)))
  rgb[white]=np.array((.87,.85,.80))*grain[white,None]
 # Original small scale coat shading remains in the derivative atlas. Preserve
 # anatomical dark orbits, hoof grain and nostrils rather than painting over it.
 orbit=(abs(x)>.06)&(y< -1.19)&(y> -1.32)&(z>2.12)&(z<2.28)&(luma<.20)
 hooves=(z<.135)&(abs(x)>.12);nostril=(-y>1.39)&(z<1.985)&(luma<.16)
 keep=hooves|nostril;rgb[keep]=original[keep]
 if key=='suffolk':rgb[orbit]=original[orbit]
 else:rgb[orbit]=(original[orbit]@np.array((.2126,.7152,.0722)))[:,None]*np.array((.85,.85,.85))
 rgb[~UVM]=original[~UVM]
 p=folder/'coat-basecolor.png';Image.fromarray((np.clip(rgb,0,1)*255).astype(np.uint8)).save(p)
 return {'file':p.name,'sha256':sha(p),'bytes':p.stat().st_size,'dimensions':[2048,2048],
  'authorship':'Original Meadowlark Ranch breed coat atlas on original BlueMesh UVs, retaining resized original coat grain and dark anatomical features; explicit color/marking adaptation.'}

body_weights=base.accessor(bodyprim['attributes']['WEIGHTS_0']);body_joints=base.accessor(bodyprim['attributes']['JOINTS_0'])

def styled_groom(key):
 p=GP.copy();keep=np.ones(len(p),bool);white=np.zeros(len(p),bool);rooted=np.full(len(p),-1,np.int32);style=styles[key];roots=[]
 for ci,ids in enumerate(components):
  kind=int(GK[ids[0]]);q=p[ids].copy()
  if kind in [0,3]:
   root=q[np.argmax(q[:,2])];factor=style['mane'] if kind==0 else 1+(style['mane']-1)*.5
   q[:,2]=root[2]+(q[:,2]-root[2])*factor
   if key=='vanner' and ci%9 in [0,1]:white[ids]=True
  elif kind==1:
   q[:,0]*=style['tail_width']
  elif kind==2:
   root=q[np.argmax(q[:,2])];front=root[1]<.10;side=-1 if root[0]<0 else 1;foot=conversion['rigPointsBlender'][('F' if front else 'H')+('L' if side<0 else 'R')+'.hoof']['head']
   retain=True
   if key=='suffolk':retain=False
   if key=='percheron':retain=(ci%8==0 and q[:,1].mean()>foot[1]+.02)
   if key=='shire':retain=q[:,1].mean()>foot[1]+.012
   if not retain:keep[ids]=False;continue
   q[:,2]=.035+(q[:,2]-.035)*style['feather_length'];q[:,0]=foot[0]+(q[:,0]-foot[0])*style['feather_width'];q[:,1]=foot[1]+(q[:,1]-foot[1])*style['feather_width']
   # Keep each original strand/component rigidly owned by its new anatomical
   # root; continuous source limbs then supply matching canonical weights.
   nearest=body_tree.find(q[np.argmax(q[:,2])]);rooted[ids]=nearest;roots.append({'component':ci,'bodyVertex':nearest,'root':q[np.argmax(q[:,2])].tolist()})
   white[ids]=key in ['vanner','shire','clyde']
  q[:,2]=np.maximum(q[:,2],.014);p[ids]=q
 return p,keep,white,rooted,roots

def build(key):
 folder=OUT/key;folder.mkdir(parents=True,exist_ok=True);g=GLB(RIG/'draft-canonical-rig.glb');d=g.doc
 transformed=cage(BP,key);scale=float(specs[key]['height']['target_m'])/float(transformed[withers_mask,2].max());body=warp(BP,key,scale)
 assert abs(body[withers_mask,2].max()-specs[key]['height']['target_m'])<1e-9
 groom,keep,white,rooted,roots=styled_groom(key);offset=0;mesh_facts=[]
 # All external original texture bytes are deduplicated across five bodies.
 for i,image in enumerate(d['images']):image.pop('bufferView',None);image['uri']='../../shared/'+textures[i]['file'];image['mimeType']='image/png'
 derivative=coat(key,folder)
 eye_material=copy.deepcopy(d['materials'][1]);eye_material['name']='Original BlueMesh eye atlas';d['materials'].append(eye_material);eye_mi=len(d['materials'])-1
 if derivative:
  image=len(d['images']);d['images'].append({'name':key+' authored coat atlas','uri':derivative['file'],'mimeType':'image/png'});texture=len(d['textures']);d['textures'].append({'source':image,'sampler':d['textures'][0].get('sampler',0)});d['materials'][1]['pbrMetallicRoughness']['baseColorTexture']['index']=texture;d['materials'][1]['name']=key+' authored coat'
 if key=='suffolk':d['materials'][0]['pbrMetallicRoughness']['baseColorFactor']=[.19,.069,.025,1]
 elif key=='percheron':d['materials'][0]['pbrMetallicRoughness']['baseColorFactor']=[.025,.028,.031,1]
 feather=copy.deepcopy(d['materials'][0]);feather['name']='Breed white silky feather/mane';feather['pbrMetallicRoughness']['baseColorFactor']=[.80,.77,.69,1];d['materials'].append(feather);white_mi=len(d['materials'])-1
 for mi,mesh in enumerate(d['meshes']):
  old=mesh['primitives'][0];a=old['attributes'];pos=gltf_to_blender(g.accessor(a['POSITION']).astype(float));normal=gltf_to_blender(g.accessor(a['NORMAL']).astype(float));indices=g.accessor(old['indices']).reshape(-1,3).astype(np.int64)
  if 1<=mi<=6:
   count=len(pos);ids=np.arange(offset,offset+count);assert np.max(abs(pos-GP[ids]))<2e-6
   pos=groom[ids];selected=keep[ids];iswhite=white[ids];assign=rooted[ids];offset+=count
   # Groom normals use the local strand stretch before the regional body cage.
   factor=np.ones((count,3));kind=GK[ids]
   factor[kind==0,2]=styles[key]['mane'];factor[kind==3,2]=1+(styles[key]['mane']-1)*.5;factor[kind==1,0]=styles[key]['tail_width'];factor[kind==2]=[styles[key]['feather_width'],styles[key]['feather_width'],max(.01,styles[key]['feather_length'])]
   normal/=factor;normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-12)
   tri_keep=selected[indices].all(1);indices=indices[tri_keep]
   joints=g.accessor(a['JOINTS_0']);weights=g.accessor(a['WEIGHTS_0']);r=assign>=0;joints[r]=body_joints[assign[r]];weights[r]=body_weights[assign[r]]
   a['JOINTS_0']=g.append(joints,'VEC4',5123,34962);a['WEIGHTS_0']=g.append(weights,'VEC4',5126,34962)
   material_masks=[(~iswhite[indices].any(1),0),(iswhite[indices].any(1),white_mi)]
  else:material_masks=[(np.ones(len(indices),bool),eye_mi if mi==7 else old['material'])]
  newpos=warp(pos,key,scale);newnormal=normals_cage(pos,normal,key,scale)
  a['POSITION']=g.append(blender_to_gltf(newpos),'VEC3',5126,34962);a['NORMAL']=g.append(blender_to_gltf(newnormal),'VEC3',5126,34962)
  mesh['primitives']=[]
  for mask,material in material_masks:
   if not mask.any():continue
   primitive=copy.deepcopy(old);primitive['attributes']=a.copy();primitive['indices']=g.append(indices[mask].reshape(-1,1),'SCALAR',5125 if indices.max()>65535 else 5123,34963);primitive['material']=material;mesh['primitives'].append(primitive)
  mesh_facts.append({'mesh':mesh['name'],'vertices':len(pos),'triangles':len(indices),'min':newpos.min(0).tolist(),'max':newpos.max(0).tolist(),'primitiveCount':len(mesh['primitives'])})
 assert offset==len(GP)
 # Deform joint heads/tails with the same cage, rotate each full anatomical
 # frame to its new direction, and rebuild exact local transforms/inverse binds.
 joints=d['skins'][0]['joints'];oldworld={i:g.world(i).copy() for i in joints};newworld={};rigpoints={}
 C=np.array([[1,0,0],[0,0,1],[0,-1,0]],float)
 for i in joints:
  name=d['nodes'][i]['name'];original=conversion['rigPointsBlender'][name];h,t=np.array([original['head'],original['tail']]);nh,nt=warp(np.array([h,t]),key,scale);oldh,oldt=blender_to_gltf(np.array([h,t]));newh,newt=blender_to_gltf(np.array([nh,nt]));rotation=direction_rotation(oldt-oldh,newt-newh)@oldworld[i][:3,:3];m=np.eye(4);m[:3,:3]=rotation;m[:3,3]=newh;newworld[i]=m;rigpoints[name]={'head':nh.tolist(),'tail':nt.tolist()}
 for i in joints:
  parent=g.parents.get(i);local=np.linalg.inv(newworld[parent])@newworld[i] if parent in newworld else newworld[i];n=d['nodes'][i];n.pop('matrix',None);n['translation']=local[:3,3].tolist();n['rotation']=matrix_quaternion(local[:3,:3]);n['scale']=[1,1,1]
  assert np.max(abs(np.linalg.det(local[:3,:3])-1))<1e-8
 ibm=np.array([np.linalg.inv(newworld[i]).T.reshape(-1) for i in joints]);d['skins'][0]['inverseBindMatrices']=g.append(ibm,'MAT4')
 anchors={name:blender_to_gltf(warp(gltf_to_blender(np.array(values)),key,scale)).tolist() for name,values in base_profile['anchors'].items()}
 anchors['withers']=[blender_to_gltf(body[withers_index:withers_index+1])[0].tolist()]
 d['asset']['extras'].update({'derivative':key+' anatomical breed sculpt with original detailed BlueMesh meshes, authored coat/groom and new canonical40 rig','sourceOriginalSha256':EXPECTED_SOURCE,'breedGeometryIsArtistAdaptation':True})
 d['scenes'][0]['name']='BlueMesh '+specs[key]['canonical_breed'];g.compact();rigfile=folder/(key+'-rig.glb');rigfile.write_bytes(g.encoded())
 p=copy.deepcopy(base_profile);p.update({'id':key,'breed':specs[key]['canonical_breed'],'file':rigfile.name,'sha256':sha(rigfile),'rigSha256':sha(rigfile),'physicalScale':True,'fitScale':1,'fitY':0,'withersM':float(body[withers_mask,2].max()),'heightM':float(body[:,2].max()),'anchors':anchors,'clips':[],'motionStatus':'pending bake against final site solver','sourceAppearancePreserved':False,'sourceCoatAppearancePreserved':key=='clyde','sourceDetailedTopologyRetained':True,'sourceSurfaceCoordinatesSculpted':True,'authoredCoat':True,'preserveAuthoredHair':True,'bodyTriangleCount':23152,'triangles':{r['mesh']:r['triangles'] for r in mesh_facts},'coat':styles[key]['coat'],'groomStyle':styles[key],'conformation':specs[key],'conformationScope':'Regional original art sculpt ratios are calibrated relative to the source draft/Clydesdale exemplar. All body, bones, eyes and anchors share one cage, with actual final measured breed metres. Association references are type/height guidance, not exact measured proportional averages.','withersMeasurement':'Actual shoulder crest vertex region on the conformed body; all geometry physically calibrated to target metres; no loader scale duplication.','motionValidation':'pending','visualReview':'pending actual geometry PNG inspection'})
 (folder/'profile.json').write_text(json.dumps(p,indent=2))
 normalized=body/body[withers_mask,2].max();report={'sourceSha256':EXPECTED_SOURCE,'inputRigSha256':base_profile['rigSha256'],'rigSha256':sha(rigfile),'originalSourceAndReceiptUnchanged':sha(source)==EXPECTED_SOURCE,'bodyTopologyAndOriginalUVRetained':True,'originalNormalMetalroughAndEyeImageEncodedBytesRetained':True,'coatAtlas':derivative or {'originalBytes':True,'file':'../../shared/'+textures[0]['file']},'sharedTextures':textures,'regionalScaleCalibration':scale,'withersM':p['withersM'],'withersVertexIndex':withers_index,'heightM':p['heightM'],'fitScale':1,'fitY':0,'physicalScale':True,'bodyNormalizedShapeSha256':hashlib.sha256(normalized.astype('<f4').tobytes()).hexdigest(),'shapeMetrics':{'normalizedBounds':(normalized.max(0)-normalized.min(0)).tolist(),'barrelWidthM':float(np.ptp(body[(BP[:,1]>0)&(BP[:,1]<.75)&(BP[:,2]>1.25),0])),'bodyLengthM':float(np.ptp(body[(BP[:,2]>1.1)&(BP[:,2]<1.8),1]))},'rigPointsBlender':rigpoints,'meshes':mesh_facts,'groomComponentsRetained':int(np.unique(GC[keep]).size),'sourceGroomComponents':len(components),'legFeatherComponentsRetained':int(np.unique(GC[keep&(GK==2)]).size),'legFeatherRootWeightsRetargeted':roots,'suffolkPrimarySource':specs['suffolk']['source_urls'][0] if key=='suffolk' else None,'sourceSphereIssue':'Original skinned Sphere had misplaced authored scene semantics; the separately documented two original eye components were fitted to visible source head sockets before this cage and remain head-only bound.'}
 (folder/'conformation-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'breed':key,'bytes':rigfile.stat().st_size,'sha256':sha(rigfile),'withersM':p['withersM'],'triangles':sum(r['triangles'] for r in mesh_facts),'featherComponents':report['legFeatherComponentsRetained']}),flush=True)
 return {'foundation':key,'profile':str((folder/'profile.json').relative_to(GAME)),'file':str(rigfile.relative_to(GAME)),'sha256':sha(rigfile),'physicalScale':True,'fitScale':1,'fitY':0,'withersM':p['withersM'],'bodyNormalizedShapeSha256':report['bodyNormalizedShapeSha256']}

if __name__=='__main__':
 keys=sys.argv[1:] or list(specs);rows={key:build(key) for key in keys}
 # Merge only candidate-owned rows; a rerun of one shape preserves other real
 # physical bodies and never edits the shared game/roster/runtime manifest.
 mf=OUT/'manifest.json';existing=json.loads(mf.read_text()) if mf.exists() else {};existing.setdefault('physicalBodies',{}).update(rows)
 plan=json.loads((CANDIDATE.parent/'replacement-plan.json').read_text());entries=plan['assignments'] if 'assignments' in plan else plan.get('breeds',[])
 if isinstance(entries,dict):entries=list(entries.values())
 identity_map={'vanner':'vanner','percheron':'percheron','shire':'shire','clyde':'clyde','tempest':'clyde','glacier':'percheron','rimewalker':'percheron','suffolk':'suffolk'}
 existing.update({'candidate':'bluemesh-draft','sourceAuthor':'BlueMesh','license':'CC BY4.0','sourceUrl':base_profile['sourceUrl'],'sourceSha256':EXPECTED_SOURCE,'coordinates':'+Z forward,+Y up,physical metres; groundY0','derivativeScope':'Five distinct real conformation bodies for eight approved identities. Fantasy coat/effects remain explicit identity overlays on the listed real bodies.','identities':{identity:{'foundation':foundation,'profile':existing['physicalBodies'].get(foundation,{}).get('profile'),'physicalScale':True,'fitScale':1,'fitY':0,'isFantasyOverlay':identity in ['tempest','glacier','rimewalker']} for identity,foundation in identity_map.items()},'motionStatus':'pending final shared solver bake','visualStatus':'pending actual PNG review'})
 if len(existing['physicalBodies'])==5:assert len({v['bodyNormalizedShapeSha256'] for v in existing['physicalBodies'].values()})==5
 mf.write_text(json.dumps(existing,indent=2))
