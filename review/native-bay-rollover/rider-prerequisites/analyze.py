"""Read-only Bay rest tack/rider anchor prerequisite against the white native rig."""
from pathlib import Path
import hashlib
import importlib.util
import json
import numpy as np

ROOT=Path(__file__).resolve().parents[3]
# The full-precision regenerated report is private output; the checked-in
# handoff is the compact actual-coordinates.json beside this method.
OUT=ROOT/'output/native-bay-rider-plan'
WHITE=ROOT/'review/native-horse-kit/model.glb'
BAY=ROOT/'output/native-bay-preparation/native-bay-rest.glb'
ANCHORS=json.loads((ROOT/'review/native-rider-reins/anchors.json').read_text())
spec=importlib.util.spec_from_file_location('horse_glb',ROOT/'tools/asset-gen/rig_hero_horse.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)

def point_cloud(doc,blob,world,mesh_index):
    node=next(n for n in doc['nodes'] if n.get('mesh')==mesh_index)
    primitive=doc['meshes'][mesh_index]['primitives'][0]
    attrs=primitive['attributes']
    pos=g.accessor(doc,blob,attrs['POSITION']).astype(float)
    joint=g.accessor(doc,blob,attrs['JOINTS_0']).astype(int)
    weight=g.accessor(doc,blob,attrs['WEIGHTS_0']).astype(float)
    skin=doc['skins'][node['skin']]
    inv=g.accessor(doc,blob,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    op=np.asarray([world[i] for i in skin['joints']])@inv
    points=np.sum(np.einsum('ncij,nj->nci',op[joint],np.c_[pos,np.ones(len(pos))])*weight[:,:,None],axis=1)[:,:3]
    index=g.accessor(doc,blob,primitive['indices']).reshape(-1).astype(int)
    return points,index,joint,weight

def components(index,n):
    parent=np.arange(n)
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]]
            i=parent[i]
        return i
    for a,b,c in index.reshape(-1,3):
        r=find(a);parent[find(b)]=r;parent[find(c)]=r
    groups={}
    for i in range(n):groups.setdefault(find(i),[]).append(i)
    return [np.asarray(ids,dtype=int) for ids in groups.values()]

white,wb=g.read_glb(WHITE);bay,bb=g.read_glb(BAY)
ww,_=g.node_worlds(white);bw,_=g.node_worlds(bay)
named={n.get('name'):i for i,n in enumerate(white['nodes']) if n.get('name')}
assert all(bay['nodes'][i].get('name')==white['nodes'][i].get('name') for i in range(len(white['nodes'])))
assert white['skins'][0]['joints']==bay['skins'][0]['joints']
assert len(white['skins'][0]['joints'])==677
assert len(white['meshes'])==len(bay['meshes'])==5
mesh_reports={}
for mi in range(5):
    wp,wi,wj,wwt=point_cloud(white,wb,ww,mi)
    bp,bi,bj,bwt=point_cloud(bay,bb,bw,mi)
    mesh_reports[str(mi)]={'name':white['meshes'][mi]['name'],'vertexCount':len(wp),'indexCount':len(wi),'indicesIdentical':bool(np.array_equal(wi,bi)),'jointIndicesIdentical':bool(np.array_equal(wj,bj)),'weightsIdentical':bool(np.array_equal(wwt,bwt))}
    assert all(mesh_reports[str(mi)][k] for k in ['indicesIdentical','jointIndicesIdentical','weightsIdentical'])
    if mi==0:white_body,bay_body=wp,bp
    if mi==3:white_tack,bay_tack,tack_index=wp,bp,bi
    if mi==4:white_saddle,bay_saddle=wp,bp

piece=components(tack_index,len(bay_tack));assert len(piece)==300
for label,c in ANCHORS['contacts'].items():
    assert np.array_equal(piece[c['component']],np.asarray(c['vertexIds'],dtype=int)),label
rein_hidden=json.loads((ROOT/'review/native-rider-reins/qa-summary.json').read_text())['hiddenComponents']
assert len(rein_hidden)==24 and not set(rein_hidden)&{89,91,205,209}

white_seat=np.asarray(ANCHORS['sourceSeat'],dtype=float)
white_saddle_world=ww[named['saddle_0333']]
bay_saddle_world=bw[named['saddle_0333']]
seat_local=np.linalg.solve(white_saddle_world,np.r_[white_seat,1.])
bay_seat=(bay_saddle_world@seat_local)[:3]
bay_floor=float(bay_body[:,1].min())
normalize=np.array([-bay_seat[0],-bay_floor,-bay_seat[2]])
closest=np.argsort(np.linalg.norm(white_saddle-white_seat,axis=1))[:24]
white_near=white_saddle[closest].mean(axis=0)
bay_near=bay_saddle[closest].mean(axis=0)
nearest={'vertexIds':closest.tolist(),'whiteMeanM':white_near.tolist(),'bayMeanM':bay_near.tolist(),'whiteSeatToNearMeanM':(white_seat-white_near).tolist(),'bayMappedSeatToNearMeanM':(bay_seat-bay_near).tolist(),'whiteNearestVertexDistanceM':float(np.linalg.norm(white_saddle[closest[0]]-white_seat)),'bayNearestVertexDistanceM':float(np.linalg.norm(bay_saddle[closest[0]]-bay_seat))}

def bounds(points):return {'min':points.min(axis=0).tolist(),'max':points.max(axis=0).tolist()}
contacts={}
for label,c in ANCHORS['contacts'].items():
    pts=bay_tack[piece[c['component']]]
    low,high=pts.min(axis=0),pts.max(axis=0)
    point=(low+high)/2
    if 'Stirrup' in label:point[1]=high[1]
    white_point=np.asarray(c['gamePoint'])
    contacts[label]={'component':c['component'],'vertexCount':len(pts),'sourceBoundsM':bounds(pts),'sourcePointM':point.tolist(),'gamePointM':(point+normalize).tolist(),'whiteGamePointM':white_point.tolist(),'deltaFromWhiteGameM':(point+normalize-white_point).tolist()}

rein_grip={}
for side,c in ANCHORS['reinGripStudy'].items():
    pts=bay_tack[c['vertexIds']]
    rein_grip[side]={'bone':c['bone'],'vertexIds':c['vertexIds'],'sourcePointM':pts.mean(axis=0).tolist(),'gamePointM':(pts.mean(axis=0)+normalize).tolist()}

outer_guides={}
for side,id in [('left',72),('right',141)]:
    ids=piece[id];assert len(ids)==56
    outer_guides[side]={'component':id,'sourceVertexIds':ids.tolist(),'pairedWidthMedianM':float(np.median(np.linalg.norm(bay_tack[ids[::2]]-bay_tack[ids[1::2]],axis=1))),'gameCentersM':{str(k):((bay_tack[ids[2*k]]+bay_tack[ids[2*k+1]])/2+normalize).tolist() for k in [0,6,15,24,27]},'boundsGameM':bounds(bay_tack[ids]+normalize)}

bones={}
for name in ['saddle_0333','stirrup_02_l_0335','stirrup_02_r_0343','reins_01_l_0338','reins_01_r_0346','neck_01_014','neck_02_015','neck_03_016','head_019']:
    index=named[name]
    bones[name]={'nodeId':index,'whiteGameM':(ww[index][:3,3]+np.asarray(ANCHORS['sourceToGameTranslation'])).tolist(),'bayGameM':(bw[index][:3,3]+normalize).tolist()}

report={'status':'Bay static prerequisite only; no approved Bay gait or mounted quality claim','whiteModel':str(WHITE.relative_to(ROOT)),'whiteSha256':hashlib.sha256(WHITE.read_bytes()).hexdigest(),'bayModel':str(BAY.relative_to(ROOT)),'baySha256':hashlib.sha256(BAY.read_bytes()).hexdigest(),'topology':{'nativeJointCount':677,'nodeNamesAndIdsSame':True,'skinJointSequenceSame':True,'meshes':mesh_reports,'tackConnectedComponentCount':len(piece),'reinComponentIdsSame':rein_hidden,'protectedBitAndTreadComponentIdsSame':[89,91,205,209],'guideComponentIdsSame':[72,141]},'frame':{'up':'+Y','forward':'+Z','bayRestFloorSourceY':bay_floor,'sourceToGameTranslationM':normalize.tolist(),'seatLocalRelativeToNativeSaddle':seat_local.tolist(),'seatBoneMappedSourceM':bay_seat.tolist(),'seatGameM':(bay_seat+normalize).tolist(),'saddleVertexCrosscheck':nearest},'contacts':contacts,'nearSaddleOriginalReinGrips':rein_grip,'outerNeckReinGuide':outer_guides,'bones':bones,'trunkVertex1998GameM':(bay_body[1998]+normalize).tolist(),'bodyBoundsSourceM':bounds(bay_body)}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'bay-anchor-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'baySha256':report['baySha256'],'sourceToGameTranslationM':normalize.tolist(),'seatGameM':report['frame']['seatGameM'],'contacts':{k:v['gamePointM'] for k,v in contacts.items()},'saddleVertexCrosscheck':nearest,'allMeshTopologySame':True},indent=2))
