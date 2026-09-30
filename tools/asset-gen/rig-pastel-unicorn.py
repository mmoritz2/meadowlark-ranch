"""Bind the actual approved pastel source + recovered native groom to canonical40.

Run verified Blender with factory startup and autoexec disabled. GLB source UVs,
indices, normals/materials and all14 original image bytes are retained. Source
Blend anatomical weights are matched numerically at coincident source vertices;
no replacement horse mesh or generative imagery is used. Native particle path
centrelines become tapered skinned ribbons with explicit density adaptation.
Raw outputs remain local and require protected incorporated delivery.
"""
from pathlib import Path
import copy,hashlib,json,sys,math
import bpy,numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
from draft_glb_tools import GLB

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/pastel-unicorn'
IN=BASE/'work/source-inspection';OUT=BASE/'game';OUT.mkdir(parents=True,exist_ok=True)
SOURCE=BASE/'source/unicorn.glb';EXPECTED='9a6888256be7f7be2f8773be30cc1245b58b2bbe9c370c166388098c326c333c'
def sha(data):return hashlib.sha256(data).hexdigest()
def tree(points):
 result=KDTree(len(points))
 for i,p in enumerate(points):result.insert(Vector(p),i)
 result.balance();return result
def nearest(kd,points):
 rows=[kd.find(Vector(p)) for p in points];return np.array([r[1] for r in rows]),np.array([r[2] for r in rows])
def main():
 if not {'--factory-startup','--disable-autoexec'}<=set(sys.argv):raise RuntimeError('Factory/autoexec launch contract')
 assert sha(SOURCE.read_bytes())==EXPECTED
 source=GLB(SOURCE);old=copy.deepcopy(source.doc);old_nodes=copy.deepcopy(old['nodes']);old_world={i:source.world(i).copy() for i in range(len(old_nodes))}
 source_points={}
 for i,node in enumerate(old_nodes):
  if 'mesh' not in node:continue
  w=old_world[i]
  for pi,p in enumerate(old['meshes'][node['mesh']]['primitives']):
   v=source.accessor(p['attributes']['POSITION']);source_points[(node['name'],pi)]=v@w[:3,:3].T+w[:3,3]
 body=source_points[('body.001',0)];ground=float(body[:,1].min())
 node_by_name={n['name']:i for i,n in enumerate(old_nodes) if 'name' in n}
 native=lambda name:old_world[node_by_name[name]][:3,3].copy()
 native_withers=native('Bip01_Spine3')[2]
 wither_band=body[(abs(body[:,0])<.075)&(abs(body[:,2]-native_withers)<.03)]
 wither_point=wither_band[wither_band[:,1].argmax()].copy();wither_point[0]=0
 target_withers=1.60;scale=target_withers/(wither_point[1]-ground)
 def norm(points):p=np.array(points,dtype=float,copy=True);p[...,1]-=ground;p*=scale;return p
 body=norm(body);kd_body=tree(body)
 # Exact hierarchy/name order from the live canonical contract, without its art.
 canonical=GLB(ROOT/'assets/models/artist-breeds/bay.glb');joint_nodes=canonical.doc['skins'][0]['joints'];names=[canonical.doc['nodes'][i]['name'] for i in joint_nodes]
 parent_names={canonical.doc['nodes'][i]['name']:canonical.doc['nodes'][canonical.parents[i]]['name'] if canonical.parents.get(i) in joint_nodes else None for i in joint_nodes}
 assert len(names)==40
 index={name:i for i,name in enumerate(names)}
 native_map={'pelvis':'Bip01_Pelvis','spine':'Bip01_Spine1','chest':'Bip01_Spine3','neck.lower':'Bip01_Neck1','neck.upper':'Bip01_Neck3','head':'Bip01_Head','jaw':'Bip01_chin','ear.L':'Bip01_L_Ear','ear.R':'Bip01_R_Ear','tail.1':'Bip01_Tail0','tail.2':'Bip01_Tail1','tail.3':'Bip01_Tail2','tail.4':'Bip01_Tail3'}
 for prefix,side in [('FL','R'),('FR','L')]:
  for suffix,part in zip(['scapula','upperarm','forearm','cannon','pastern','hoof'],['Clavicle','UpperArm','Forearm','Hand','Finger0','Finger01']):native_map[prefix+'.'+suffix]='Bip01_'+side+'_'+part
 for prefix,side in [('HL','R'),('HR','L')]:
  for suffix,part in zip(['thigh','shin','cannon','pastern','hoof'],['Thigh','Calf','HorseLink','Foot','Toe0']):native_map[prefix+'.'+suffix]='Bip01_'+side+'_'+part
 heads={name:norm(native(original)) for name,original in native_map.items()};heads['ROOT']=np.zeros(3)
 assert heads['ear.L'][0]<0 and heads['ear.R'][0]>0 and heads['FL.hoof'][0]<0 and heads['FR.hoof'][0]>0 and heads['HL.hoof'][0]<0 and heads['HR.hoof'][0]>0
 for prefix in ['FL','FR','HL','HR']:heads[prefix+'.IK']=heads[prefix+'.hoof']+np.array((0,.025,0))
 mapping={value:key for key,value in native_map.items()}
 mapping.update({'Bip01_Spine':'spine','Bip01_Spine2':'spine','Bip01_Neck':'neck.lower','Bip01_Neck2':'neck.upper','Bip01_Tail':'tail.1','Bip01_Tail5':'tail.4'})
 match_rows=[];dense={};originals={};seam_ownership={};truncated=[]
 inspection=json.loads((IN/'source-blend-inspection.json').read_text())
 for obj in inspection['objects']:
  if obj['type']!='MESH':continue
  raw=np.load(IN/obj['numericInspection']);native_p=raw['points'].astype(float)*.01;native_p=np.c_[native_p[:,0],native_p[:,2],-native_p[:,1]]
  weights=np.zeros((len(native_p),40));groups=list(raw['groupNames'])
  for j,group in enumerate(groups):
   if group in mapping:weights[:,index[mapping[group]]]+=raw['weights'][:,j]
  for pi,p in enumerate(old['meshes'][next(n['mesh'] for n in old_nodes if n.get('name')==obj['name'])]['primitives']):
   points=source_points[(obj['name'],pi)];ids,errors=nearest(tree(native_p),points)
   assert errors.max()<2e-5,(obj['name'],errors.max())
   w=weights[ids].copy();unweighted=w.sum(1)<1e-6
   if unweighted.any():assert obj['name']=='body.001';w[unweighted,index['head']]=1
   if obj['name'].startswith(('eye','tear_')) or obj['name']=='eyelashes':w[:]=0;w[:,index['head']]=1
   point=norm(points)
   if obj['name']=='body.001' and pi==0:
    for row in np.where(point[:,1]<.14*scale)[0]:
     prefix=min(['FL','FR','HL','HR'],key=lambda k:np.linalg.norm(point[row,[0,2]]-heads[k+'.hoof'][[0,2]]))
     w[row]=0;w[row,index[prefix+'.hoof']]=1
   # Original source surface seams retain one ownership vector everywhere.
   unique,inverse=np.unique(np.round(point,6),axis=0,return_inverse=True);uw=np.zeros((len(unique),40));np.add.at(uw,inverse,w);uw/=np.bincount(inverse)[:,None];w=uw[inverse]
   w/=np.maximum(w.sum(1)[:,None],1e-8);dense[(obj['name'],pi)]=w;originals[(obj['name'],pi)]=point
   seam_ownership[obj['name']+':'+str(pi)]={'vertices':len(w),'uniquePositions':len(unique),'weightsMatchAtUVSeams':True}
   match_rows.append({'mesh':obj['name'],'primitive':pi,'matchedSourceVertices':len(ids),'maxCorrespondenceErrorM':float(errors.max()),'previouslyUnweightedVertices':int(unweighted.sum())})
 def four(weights):
  selected=np.argsort(weights,axis=1)[:,-4:];values=np.take_along_axis(weights,selected,axis=1);truncated.append(float(np.max(1-values.sum(1))));values/=np.maximum(values.sum(1)[:,None],1e-8);return selected.astype(np.uint16),values.astype(np.float32)
 body_weights=dense[('body.001',0)];body_uv=source.accessor(old['meshes'][0]['primitives'][0]['attributes']['TEXCOORD_0']);body_normals=source.accessor(old['meshes'][0]['primitives'][0]['attributes']['NORMAL'])
 source.doc['nodes']=[];source.doc['meshes']=[];source.doc['animations']=[];source.doc['skins']=[];source.cache={};source.parents={}
 for name in names:
  parent=parent_names[name];row={'name':name,'translation':(heads[name]-(heads[parent] if parent else np.zeros(3))).tolist()};children=[index[n] for n in names if parent_names[n]==name]
  if children:row['children']=children
  source.doc['nodes'].append(row)
 matrices=[]
 for name in names:m=np.eye(4);m[:3,3]=-heads[name];matrices.append(m.T.reshape(16))
 source.doc['skins']=[{'name':'Pastel source anatomical40','joints':list(range(40)),'skeleton':index['ROOT'],'inverseBindMatrices':source.append(np.array(matrices),'MAT4')}]
 mesh_nodes=[];triangles={}
 def add_mesh(name,primitive):
  mesh=len(source.doc['meshes']);source.doc['meshes'].append({'name':name,'primitives':[primitive]});ni=len(source.doc['nodes']);source.doc['nodes'].append({'name':name,'mesh':mesh,'skin':0});mesh_nodes.append(ni);triangles[name]=len(source.accessor(primitive['indices']))//3
 for node in old_nodes:
  if 'mesh' not in node:continue
  for pi,original in enumerate(old['meshes'][node['mesh']]['primitives']):
   primitive=copy.deepcopy(original);points=originals[(node['name'],pi)];w=dense[(node['name'],pi)];si,sw=four(w)
   primitive['attributes'].update(POSITION=source.append(points,'VEC3',target=34962),JOINTS_0=source.append(si,'VEC4',5123,34962),WEIGHTS_0=source.append(sw,'VEC4',target=34962))
   name=('HorseBody' if pi==0 else 'HorseHorn') if node['name']=='body.001' else 'Source_'+node['name']
   add_mesh(name,primitive)
 # Source particle colours use their original body material's root UV. Native
 # normal skin texture is excluded from ribbon shading; source maps stay intact.
 groom_material=copy.deepcopy(old['materials'][0]);groom_material['name']='Actual native pastel groom root-colour';groom_material.pop('normalTexture',None);groom_material['doubleSided']=True;groom_material['pbrMetallicRoughness']['roughnessFactor']=.68
 mat=len(source.doc['materials']);source.doc['materials'].append(groom_material)
 extraction=json.loads((IN/'native-groom-extraction.json').read_text());groom_rows=[];all_groom=[]
 for row in extraction['rows']:
  raw=np.load(IN/row['file']);pp=row['pointsPerPath'];points=raw['points'];assert len(points)%pp==0
  curves=points.reshape(-1,pp,3);expected=[]
  for start in range(0,len(points),pp):expected.extend((i,i+1) for i in range(start,start+pp-1))
  assert np.array_equal(raw['edges'],np.array(expected)),row['name']
  curves=norm(np.stack([curves[:,:,0],curves[:,:,2],-curves[:,:,1]],axis=2));root_ids,dist=nearest(kd_body,curves[:,0]);valid=dist<.065
  dropped=int((~valid).sum());curves=curves[valid];root_ids=root_ids[valid];dist=dist[valid]
  if row['name']=='head':
   # Creator head group contains stray coat guides elsewhere on the body.
   # Keep all attached paths rather than inventing a head-only replacement.
   pass
  assert len(curves)>0,row['name']
  long=row['name'] in ('neck hair','tail');kept=list(range(pp))
  if kept[-1]!=pp-1:kept.append(pp-1)
  # Track the actual native sampled points omitted by the ribbon approximation.
  max_path_error=0.
  for lo,hi in zip(kept[:-1],kept[1:]):
   a,b=curves[:,lo],curves[:,hi];d=b-a
   for j in range(lo+1,hi):t=np.clip(np.sum((curves[:,j]-a)*d,axis=1)/np.maximum(np.sum(d*d,axis=1),1e-12),0,1);max_path_error=max(max_path_error,float(np.linalg.norm(curves[:,j]-(a+t[:,None]*d),axis=1).max()))
  curves=curves[:,kept];steps=len(kept);tangent=np.empty_like(curves);tangent[:,1:-1]=curves[:,2:]-curves[:,:-2];tangent[:,0]=curves[:,1]-curves[:,0];tangent[:,-1]=curves[:,-1]-curves[:,-2];tangent/=np.maximum(np.linalg.norm(tangent,axis=2,keepdims=True),1e-10)
  normals=np.repeat(body_normals[root_ids,None,:],steps,axis=1);side=np.cross(tangent,normals);bad=np.linalg.norm(side,axis=2)<1e-6;side[bad]=np.cross(tangent[bad],np.array((1,0,0)));bad=np.linalg.norm(side,axis=2)<1e-6;side[bad]=np.cross(tangent[bad],np.array((0,0,1)));side/=np.maximum(np.linalg.norm(side,axis=2,keepdims=True),1e-10);normal=np.cross(side,tangent);normal/=np.maximum(np.linalg.norm(normal,axis=2,keepdims=True),1e-10)
  original_radius=row['sourceRadiusScale']*.01*row['rootRadius']*scale;density_width=math.sqrt(100/max(1,row['sourceChildrenConverted']))
  fraction=np.linspace(0,1,steps);radius=original_radius*density_width*np.maximum(1-fraction+fraction*row['tipRadius'],.012)
  positions=np.stack([curves-side*radius[None,:,None],curves+side*radius[None,:,None]],axis=2).reshape(-1,3)
  # Native short fur can cross the ground at the sole. Limit this documented
  # adaptation to the bottom tips; roots/long mane and tail remain unchanged.
  correction=np.maximum(0,.003-positions[:,1]);max_floor_adjustment=float(correction.max());positions[:,1]+=correction
  normals=np.repeat(normal[:,:,None,:],2,axis=2).reshape(-1,3);uv=np.repeat(body_uv[root_ids,None,None,:],steps*2,axis=1).reshape(-1,2)
  w=np.repeat(body_weights[root_ids,None,:],steps,axis=1)
  if row['name']=='tail':
   centers=np.array([heads['tail.'+str(i)] for i in range(1,5)]);d=np.linalg.norm(curves[:,:,None,:]-centers[None,None,:,:],axis=3);tw=np.exp(-d*d/.035);tw/=np.maximum(tw.sum(2,keepdims=True),1e-12);w[:]=0
   for i in range(4):w[:,:,index['tail.'+str(i+1)]]=tw[:,:,i]
  w=np.repeat(w[:,:,None,:],2,axis=2).reshape(-1,40);si,sw=four(w)
  starts=np.arange(len(curves))*steps*2;faces=[]
  for j in range(steps-1):
   a=starts+j*2;faces.append(np.stack([a,a+1,a+2],axis=1));faces.append(np.stack([a+1,a+3,a+2],axis=1))
  faces=np.concatenate(faces).reshape(-1,1)
  primitive={'attributes':{'POSITION':source.append(positions,'VEC3',target=34962),'NORMAL':source.append(normals,'VEC3',target=34962),'TEXCOORD_0':source.append(uv,'VEC2',target=34962),'JOINTS_0':source.append(si,'VEC4',5123,34962),'WEIGHTS_0':source.append(sw,'VEC4',target=34962)},'indices':source.append(faces,'SCALAR',5125,34963),'material':mat}
  add_mesh('HorseGroom_'+row['name'].replace(' ','_'),primitive);all_groom.append(positions)
  groom_rows.append({**row,'retainedNativePaths':len(curves),'detachedGuidePathsOmitted':dropped,'maxRootDistanceM':float(dist.max()),'retainedPointsPerPath':steps,'maxNativePathApproximationErrorM':max_path_error,'maxBottomFurClearanceAdjustmentM':max_floor_adjustment,'nativeRootRadiusM':original_radius,'bundleWidthMultiplier':density_width,'triangles':len(faces)//3,'sourceRootUVColourRetained':True})
 source.doc['scenes']=[{'name':'Actual pastel unicorn canonical rig','nodes':[index['ROOT'],*mesh_nodes]}];source.doc['scene']=0
 source.compact();target=OUT/'pastel-unicorn-rigged.glb';data=source.encoded();target.write_bytes(data)
 # Copy original encoded body colour unchanged for root-owned protected neutral
 # embedding. Its source pastel pigment is explicit; mean luminance follows QA.
 body_image=old['textures'][old['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source'];image=old['images'][body_image];view=old['bufferViews'][image['bufferView']];original_binary=GLB(SOURCE).binary;image_bytes=bytes(original_binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);(OUT/'source-body-basecolor.png').write_bytes(image_bytes)
 saddle_band=body[(abs(body[:,0])<.05)&(abs(body[:,2])<.05)];saddle=[0,float(saddle_band[:,1].max()+.009),0]
 stirrup_y=saddle[1]-.55*target_withers/1.6;girth=body[(abs(body[:,2])<.065)&(abs(body[:,1]-stirrup_y)<.09)];stirrup_x=float(abs(girth[:,0]).max()+.075)
 anchors={'saddle':[saddle],'withers':[norm(wither_point).tolist()],'head':[heads['head'].tolist()],'poll':[(heads['ear.L']+heads['ear.R']).tolist()],'muzzle':[[0,float(body[(body[:,2]>1.27*scale)&(abs(body[:,0])<.075),1].mean()),float(body[:,2].max())]],'crest':[heads['neck.upper'].tolist()],'tail':[heads['tail.1'].tolist()],'eyes':[originals[('eye_ball_R',0)].mean(0).tolist(),originals[('eye_ball_L',0)].mean(0).tolist()],'nostrils':[[-.075*scale,1.57*scale,1.36*scale],[.075*scale,1.57*scale,1.36*scale]],'stirrups':[[-stirrup_x,stirrup_y,.015],[stirrup_x,stirrup_y,.015]]};anchors['poll']=[((heads['ear.L']+heads['ear.R'])/2).tolist()]
 # Snap bilateral nostril landmarks to the actual acquired muzzle surface.
 # Source face geometry is retained; the atlas supplies the nostril appearance.
 anchors['nostrils']=[body[np.linalg.norm(body-np.array((side*.084,1.69,1.36)),axis=1).argmin()].tolist() for side in (-1,1)]
 catalog=json.loads((BASE.parent/'catalog.json').read_text());provenance=next(r for r in catalog['candidates'] if r['id']=='pastel-unicorn')
 profile={'id':'pastel-unicorn','name':'Pastel Unicorn','file':target.name,'sha256':sha(data),'rigSha256':sha(data),'artistBreed':True,'bodyMesh':'HorseBody','jointCount':40,'withersM':target_withers,'heightM':float(body[:,1].max()),'fitScale':1,'fitY':0,'physicalScale':True,'preserveSaddleAnchor':True,'nativeHorn':True,'preserveAuthoredHair':True,'preserveSourceGroom':True,'anchors':anchors,'triangles':triangles,'sourceCandidate':'pastel-unicorn','creator':provenance['creator'],'sourceAuthor':provenance['creator'],'sourceUrl':provenance['sourceUrl'],'license':provenance['license'],'licenseUrl':provenance['licenseUrl'],'acquiredSourceSha256':EXPECTED,'sourceBlendSha256':inspection['sourceBlendSha256'],'neutralCoatFile':'source-body-basecolor.png','neutralCoatSourcePigmentRetained':True,'neutralCoatLuminance':None,'publicationDeliveryRequired':'protected-mkr','motionModuleSha256':None,'status':'canonical-source-rigged-motion-and-visual-qa-pending'}
 (OUT/'profile.json').write_text(json.dumps(profile,indent=2)+'\n')
 report={'sourceGLBSha256':EXPECTED,'rigSha256':sha(data),'sourceUnchanged':sha(SOURCE.read_bytes())==EXPECTED,'sourceImageBytesPreserved':True,'sourceUVsNormalsIndicesMaterialsPreserved':True,'physicalNormalization':{'sourceGroundY':ground,'sourceWithersPoint':wither_point.tolist(),'scale':scale,'withersM':target_withers},'nativeSourceWeightMatching':match_rows,'canonicalMapping':mapping,'leftSideLabels':'Canonical L negativeX limbs map source Bip01_R; ear.L maps source Bip01_L_Ear because ear source labels already have negativeX L. All actual sided head positions asserted. Source geometry orientation unchanged.','sourceUVSeamOwnership':seam_ownership,'maximumCanonicalTop4WeightDiscarded':max(truncated),'groom':groom_rows,'externalAlembicRead':False,'sourceScriptsDriversExecuted':False,'bodyAnchorsMeasuredFromSourceSurface':True,'rawPlaintextMustRemainUnpublished':True,'motionAndAppearanceCertification':'pending'}
 (OUT/'rigging-validation.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'file':str(target),'bytes':len(data),'sha256':sha(data),'withersM':target_withers,'triangles':sum(triangles.values()),'groomPaths':sum(r['retainedNativePaths'] for r in groom_rows),'weightsMatched':match_rows,'groom':groom_rows}))
if __name__=='__main__':main()
