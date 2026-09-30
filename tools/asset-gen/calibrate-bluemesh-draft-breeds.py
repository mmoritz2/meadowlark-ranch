"""Measure actual draft coat dye references and saddle/stirrup body contacts.

Edits only the BlueMesh candidate-owned profiles/reports. Body side sections use
real triangle intersections in native raw physical metres, not guessed bounds.
"""
from pathlib import Path
import hashlib,json,sys
import numpy as np
from PIL import Image,ImageFilter
sys.path.insert(0,str(Path(__file__).resolve().parent))
from draft_glb_tools import GLB
ROOT=Path(__file__).resolve().parents[2];C=ROOT/'assets/models/horse-imports/bluemesh-draft';O=C/'game/breeds';S=C/'game/shared'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def linear(rgb):return np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
uv=np.load(O/'body-uv-position-map.npz');points,coverage=uv['points'],uv['mask']
region=coverage&(points[:,:,2]>1.15)&(points[:,:,2]<1.85)&(points[:,:,1]>-.05)&(points[:,:,1]<.95)
assert region.sum()>30000
source_images=json.loads((O/'clyde/conformation-report.json').read_text())['sharedTextures'];source_base=S/source_images[0]['file']
rgb=np.asarray(Image.open(source_base).convert('RGB').resize((2048,2048),Image.Resampling.LANCZOS),dtype=float)/255;luma=rgb@np.array((.2126,.7152,.0722));blur=np.asarray(Image.fromarray((luma*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9)),dtype=float)/255;grain=np.clip(luma/np.maximum(blur,.05),.88,1.14)
neutral=np.repeat((.74*grain)[:,:,None],3,axis=2);neutral[~coverage]=.74
neutral_file=S/'neutral-coat-detail.png';Image.fromarray((np.clip(neutral,0,1)*255).astype(np.uint8)).save(neutral_file)
def lum(p):
 rgb=np.asarray(Image.open(p).convert('RGB').resize((2048,2048),Image.Resampling.BILINEAR),dtype=float)/255
 return float(np.median((linear(rgb)@np.array((.299,.587,.114)))[region]))
neutral_lum=lum(neutral_file);rows=[]
def side_hits(p,tris,y,z):
 a,b,c=p[tris[:,0]],p[tris[:,1]],p[tris[:,2]];v0=b[:,1:]-a[:,1:];v1=c[:,1:]-a[:,1:];q=np.array([y,z])-a[:,1:];den=v0[:,0]*v1[:,1]-v1[:,0]*v0[:,1];valid=abs(den)>1e-12;safe=np.where(valid,den,1)
 u=(q[:,0]*v1[:,1]-v1[:,0]*q[:,1])/safe;v=(v0[:,0]*q[:,1]-q[:,0]*v0[:,1])/safe;inside=valid&(u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)
 hits=a[inside,0]+u[inside]*(b[inside,0]-a[inside,0])+v[inside]*(c[inside,0]-a[inside,0]);assert len(hits)>1,(y,z);return float(hits.min()),float(hits.max())
for key in ['vanner','percheron','shire','clyde','suffolk']:
 folder=O/key;profile_file=folder/'profile.json';profile=json.loads(profile_file.read_text());g=GLB(folder/(key+'-rig.glb'));p=g.accessor(g.doc['meshes'][0]['primitives'][0]['attributes']['POSITION']).astype(float);tri=g.accessor(g.doc['meshes'][0]['primitives'][0]['indices']).reshape(-1,3).astype(int)
 saddle=np.array(profile['anchors']['saddle'][0]);near=(abs(p[:,0]-saddle[0])<.055)&(abs(p[:,2]-saddle[2])<.075);assert near.sum()>4;surface=float(p[near,1].max());saddle[1]=surface+.008
 stirrup_y,stirrup_z=float(saddle[1]-.512),float(saddle[2]+.200);left,right=side_hits(p,tri,stirrup_y,stirrup_z);recommended=[min(-.270,left-.035),max(.270,right+.035)];stirrups=[[recommended[0],stirrup_y,stirrup_z],[recommended[1],stirrup_y,stirrup_z]]
 coat=folder/'coat-basecolor.png' if key!='clyde' else source_base;coat_lum=lum(coat)
 attachments={'coordinateSpace':'HorseBody raw physical metres, +Y up/+Z forward; fitScale1/fitY0',
 'saddle':{'anchor':saddle.tolist(),'attachmentJoint':'spine','sampledTopSurfaceY':surface,'surfaceGapM':.008},
 'stirrups':{'runtimeOriginalRelativePosition':[[ -.270,-.512,.200],[.270,-.512,.200]],'bodySurfaceXAtTreadYAndZ':[left,right],
 'runtimeOriginalSideClearanceM':[abs(-.270)-abs(left),.270-abs(right)],'recommendedRawAnchors':stirrups,'recommendedClearanceM':.035,
 'attachmentJoint':'spine','measurement':'Exact HorseBody triangle intersections for the Y/Z tread ray; recommended lateral anchors clear the measured barrel by35mm. Shared tack/rider runtime must consume them; offline geometry does not certify final mounted appearance.'}}
 profile.update(sourceCandidate='bluemesh-draft',neutralCoatFile='../../shared/'+neutral_file.name,neutralCoatLuminance=neutral_lum,coatLuminance=coat_lum,preserveSaddleAnchor=True,mountAttachments=attachments,
  sourceAppearancePreserved=False,sourceCoatAppearancePreserved=key=='clyde',sourceDetailedTopologyRetained=True,sourceSurfaceCoordinatesSculpted=True)
 profile.pop('sourceDetailedGeometryPreserved',None);profile['anchors']['saddle']=[saddle.tolist()];profile['anchors']['stirrups']=stirrups;profile_file.write_text(json.dumps(profile,indent=2)+'\n')
 row={'breed':key,'rigSha256':profile['rigSha256'],'coatFile':str(coat.relative_to(C/'game')),'coatSha256':sha(coat),'coatLuminance':coat_lum,'neutralCoatFile':profile['neutralCoatFile'],'neutralCoatSha256':sha(neutral_file),'neutralCoatLuminance':neutral_lum,'mountAttachments':attachments};(folder/'attachment-coat-calibration.json').write_text(json.dumps(row,indent=2)+'\n');rows.append(row);print(json.dumps({'breed':key,'saddle':saddle.tolist(),'bodySurfaceX':[left,right],'stirrupX':recommended,'coatLuminance':coat_lum,'neutralCoatLuminance':neutral_lum}),flush=True)
report={'method':'Median linear RGB luminance using current coat shader(.299,.587,.114) on covered original source torso UV pixels; anatomy regionZ1.15..1.85m,BlenderY−.05..+.95m; excludes face/legs/gutters. Neutral atlas is an explicit unmarked grayscale derivative of source fine pigment detail, retaining exact normal/MR source images.','neutralFile':str(neutral_file.relative_to(C/'game')),'neutralSha256':sha(neutral_file),'neutralCoatLuminance':neutral_lum,'breeds':rows,'originalSourceAndReceiptUnmodified':True};(O/'coat-attachment-calibration.json').write_text(json.dumps(report,indent=2)+'\n')
