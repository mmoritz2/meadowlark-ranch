#!/usr/bin/env python3
"""Bind the registered Fjord sculpture derivative to measured anatomical40.

Usage: python3 tools/asset-gen/build-fjord-game.py
Run prepare-fjord-sculpt.py first. Source shape comes only from the approved STL
LOD; coats, UVs, semantic weights and rig are newly authored numeric adaptations.
Plaintext outputs are private build intermediates pending protected packaging.
"""
from __future__ import annotations
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import numpy as np
from PIL import Image
from scipy.cluster.vq import kmeans2
from scipy.sparse import coo_matrix

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/fjord-sculpt'
SHA='c652933791dc85ea7ec9a1c9b4707b04b4c4a1f1bb28c27a99b58a0f978c2178'


def trusted(file,name):
    sys.dont_write_bytecode=True
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)


def capsule(p,a,b):
    d=b-a;t=np.clip((p-a)@d/max(float(d@d),1e-12),0,1)
    return np.linalg.norm(p-a-t[:,None]*d,axis=1),t


def tail_region(raw,p,heads,ids):
    distance=np.full(len(raw),np.inf)
    for prefix in ['HL','HR']:
        chain=[prefix+'.'+n for n in ['thigh','shin','cannon','pastern','hoof']]
        for a,b in zip(chain,chain[1:]):distance=np.minimum(distance,capsule(p,heads[ids[a]],heads[ids[b]])[0])
    return (1-smooth(22,29,raw[:,2]))*(1-smooth(23,31,raw[:,1]))*smooth(.075,.13,distance)


def append(doc,binary,value,component,kind,target=None):
    a=np.asarray(value,dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[component]);binary.extend(b'\0'*(-len(binary)%4));view={'buffer':0,'byteOffset':len(binary),'byteLength':a.nbytes}
    if target:view['target']=target
    index=len(doc['bufferViews']);doc['bufferViews'].append(view);binary.extend(a.tobytes());acc={'bufferView':index,'componentType':component,'count':len(a),'type':kind}
    if kind=='VEC3':acc.update(min=a.min(0).astype(float).tolist(),max=a.max(0).astype(float).tolist())
    result=len(doc['accessors']);doc['accessors'].append(acc);return result


def definitions(raw):
    cx=float((raw[:,0].min()+raw[:,0].max())/2)
    body=[('ROOT',None,[cx,-47.114474,60]),('pelvis','ROOT',[cx,12,40]),('spine','pelvis',[cx,20,59]),('chest','spine',[cx,14,82]),
          ('neck.lower','chest',[cx,27,90]),('neck.upper','neck.lower',[cx,42,109]),('head','neck.upper',[cx,43,124]),('jaw','head',[cx,32,130]),
          ('ear.L','head',[cx-6.3,49,119]),('ear.R','head',[cx+6.3,49,119]),
          ('tail.1','pelvis',[cx,20,23]),('tail.2','tail.1',[cx,2,21]),('tail.3','tail.2',[cx-4,-18,17]),('tail.4','tail.3',[cx-7,-34,12])]
    stations={}
    for family,levels in [('F',[-10,-25,-39,-44]),('H',[-10,-25,-39,-44])]:
        values=[]
        for y in levels:
            p=raw[abs(raw[:,1]-y)<1]
            mask=p[:,2]>80 if family=='F' else (p[:,2]<65)&(p[:,2]>23)&(abs(p[:,0]-cx)>4)
            q=p[mask][:,[0,2]];assert len(q)>20
            centers=np.array([[cx-7,np.median(q[:,1])],[cx+7,np.median(q[:,1])]])
            centers,_=kmeans2(q,centers,iter=20,minit='matrix');centers=centers[np.argsort(centers[:,0])]
            values.append(np.c_[centers[:,0],np.full(2,y),centers[:,1]])
        stations[family]=np.array(values)
    for side,si in [('L',0),('R',1)]:
        p=stations['F'][:,si];x=p[0,0]
        chain=[('scapula',[x,18,82]),('upperarm',[x,3,87]),('forearm',p[0]),('cannon',p[1]),('pastern',p[2]),('hoof',p[3])]
        parent='chest'
        for suffix,point in chain:
            name='F'+side+'.'+suffix;body.append((name,parent,list(point)));parent=name
    for side,si in [('L',0),('R',1)]:
        p=stations['H'][:,si];x=p[0,0]
        # The stifle points forward of the hock. A vertical four-station
        # centerline would mistake the hock for the stifle in this sculpture.
        chain=[('thigh',[x,14,40]),('shin',[x,-3,43+si*5]),('cannon',[p[1,0],-20,p[1,2]]),('pastern',p[2]),('hoof',p[3])]
        parent='pelvis'
        for suffix,point in chain:
            name='H'+side+'.'+suffix;body.append((name,parent,list(point)));parent=name
    for prefix in ['FL','FR','HL','HR']:
        hoof=next(p for n,parent,p in body if n==prefix+'.hoof');body.append((prefix+'.IK','ROOT',list(hoof)))
    assert len(body)==40
    return body,stations,cx


def skin_weights(p,heads,names,faces,raw,cx):
    ids={n:i for i,n in enumerate(names)};n=len(p);w=np.zeros((n,40));core=[]
    for a,b in [('pelvis','spine'),('spine','chest'),('chest','neck.lower'),('neck.lower','neck.upper'),('neck.upper','head')]:
        d,t=capsule(p,heads[ids[a]],heads[ids[b]]);score=1/(.055+d)**4
        w[:,ids[a]]+=score*(1-t);w[:,ids[b]]+=score*t
    d,t=capsule(p,heads[ids['head']],heads[ids['jaw']]+[0,-.018,.09]);w[:,ids['head']]+=1/(.045+d)**4
    w/=w.sum(1)[:,None]
    leg_reports=[];rigid=np.zeros(n,dtype=bool);rigid_owners=[]
    for prefix in ['FL','FR','HL','HR']:
        chain=[prefix+'.'+s for s in (['scapula','upperarm','forearm','cannon','pastern','hoof'] if prefix[0]=='F' else ['thigh','shin','cannon','pastern','hoof'])]
        distances=[];parameters=[]
        for a,b in zip(chain,chain[1:]):
            d,t=capsule(p,heads[ids[a]],heads[ids[b]]);distances.append(d);parameters.append(t)
        distances=np.array(distances).T;parameters=np.array(parameters).T;which=distances.argmin(1);distance=distances.min(1)
        region=(1-smooth(.12,.29,distance))*(1-smooth(.82,1.20,p[:,1]))
        # Continuous source ownership around actual limb attachment, with rigid
        # distal hooves for exact whole-surface contact under the live solver.
        lw=np.zeros_like(w)
        for j,(a,b) in enumerate(zip(chain,chain[1:])):
            mask=which==j;t=parameters[mask,j];blend=smooth(.68,1,t)
            lw[mask,ids[a]]=1-blend;lw[mask,ids[b]]=blend
        sole=(p[:,1]<.155)&(np.linalg.norm(p[:,[0,2]]-heads[ids[prefix+'.hoof']][[0,2]],axis=1)<.14)
        lw[sole]=0;lw[sole,ids[prefix+'.hoof']]=1;region[sole]=1;rigid|=sole
        rigid_owners.append((sole,ids[prefix+'.hoof']))
        w=w*(1-region[:,None])+lw*region[:,None]
        leg_reports.append({'leg':prefix,'rigidHoofVertices':int(sole.sum())})
    # The source already has a sculpted mane and tail. Its tail stays bound to
    # tail joints, rather than being replaced by generic hair-card geometry.
    # The genuine source tail fans laterally well beyond the centerline. A
    # narrow X cutoff would leave its side strands incorrectly owned by legs.
    tail=tail_region(raw,p,heads,ids)
    tw=np.zeros_like(w)
    for j in range(1,4):
        a,b='tail.'+str(j),'tail.'+str(j+1);d,t=capsule(p,heads[ids[a]],heads[ids[b]]);score=1/(.04+d)**4
        tw[:,ids[a]]+=score*(1-t);tw[:,ids[b]]+=score*t
    tw/=tw.sum(1)[:,None];w=w*(1-tail[:,None])+tw*tail[:,None]
    jaw=smooth(125,131,raw[:,2])*(1-smooth(31,37,raw[:,1]));w=w*(1-jaw[:,None]);w[:,ids['jaw']]+=jaw
    for side,sgn in [('L',-1),('R',1)]:
        ear=smooth(45,49,raw[:,1])*smooth(3.2,5.3,sgn*(raw[:,0]-cx))*(1-smooth(122,126,raw[:,2]))*smooth(109,113,raw[:,2])
        w=w*(1-ear[:,None]);w[:,ids['ear.'+side]]+=ear
    # Smooth on the original shared-vertex graph before splitting materials/UV
    # seams, so coincident seam vertices cannot acquire conflicting weights.
    edges=np.unique(np.sort(np.vstack([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1),axis=0)
    a,b=edges.T;graph=coo_matrix((np.ones(len(a)*2),(np.r_[a,b],np.r_[b,a])),shape=(n,n)).tocsr();degree=np.maximum(np.asarray(graph.sum(1)).ravel(),1)
    for _ in range(12):
        avg=(graph@w)/degree[:,None];w[~rigid]=.68*w[~rigid]+.32*avg[~rigid]
    # Source tail/torso capsules may approach a staggered hind hoof. Distal
    # actual hoof surfaces stay rigidly owned by their anatomical terminal.
    for sole,owner in rigid_owners:
        w[sole]=0;w[sole,owner]=1
    keep=np.argsort(w,axis=1)[:,-4:][:,::-1];weights=np.take_along_axis(w,keep,axis=1);weights/=weights.sum(1)[:,None]
    assert np.isfinite(weights).all() and abs(weights.sum(1)-1).max()<1e-8
    return keep.astype('<u2'),weights.astype('<f4'),leg_reports


def main():
    registered=trusted('extract-horse-import.py','fjord_source_paths');_,source,receipt=registered.registered_source('fjord-sculpt');assert registered.file_digest(source)==(SHA,receipt['bytes'])
    receipt_bytes=(source.parent/'receipt.json').read_bytes();lod=BASE/'work/fjord-simplified.npz';data=np.load(lod);raw=data['vertices'];faces=data['faces'];normals=data['normals']
    removed_contact_faces=0
    defs,stations,cx=definitions(raw);ground=float(raw[:,1].min());withers_mask=(abs(raw[:,2]-80)<.7)&(abs(raw[:,0]-cx)<5);withers_raw=float(raw[withers_mask,1].max());scale=1.42/(withers_raw-ground);offset=np.array([-cx,-ground,-60])
    p=(raw+offset)*scale;names=[n for n,parent,point in defs];ids={n:i for i,n in enumerate(names)};heads=(np.array([point for n,parent,point in defs])+offset)*scale
    heads[0]=[0,0,0]
    joints,weights,sole_counts=skin_weights(p,heads,names,faces,raw,cx)
    assert all(s['rigidHoofVertices']>15 for s in sole_counts)
    crest_z=np.array([78,82,90,98,107,113,119,124]);crest_y=np.array([28,30,36,41,44,44,45,49]);threshold=np.interp(raw[:,2],crest_z,crest_y)
    mane=(abs(raw[:,0]-cx)<3.2)&(raw[:,2]>78)&(raw[:,2]<125)&(raw[:,1]>threshold)
    tail=tail_region(raw,p,heads,ids)>.5
    groom_mask=(mane|tail)[faces].sum(1)>=2
    eye=np.zeros(len(raw),dtype=bool)
    for side in [-1,1]:
        eye|=(((raw[:,0]-(cx+side*7.7))/1.7)**2+((raw[:,1]-43.3)/1.65)**2+((raw[:,2]-126.4)/2.2)**2)<1
    eyes_mask=(eye[faces].sum(1)>=2)&~groom_mask
    parts=[('HorseBody',~groom_mask&~eyes_mask,0),('HorseGroom',groom_mask,1),('HorseEyes',eyes_mask,2)]
    assert all(mask.sum()>0 for name,mask,mat in parts)
    out=BASE/'game';out.mkdir(exist_ok=True);(out/'textures').mkdir(exist_ok=True)
    # Newly painted dun atlas with a narrow dorsal stripe and subtle hand-authored
    # sinusoidal pigment variation. Source STL has no UVs or colored texture maps.
    u,v=np.meshgrid(np.arange(1024)/1023,np.arange(512)/511);variation=1+.018*np.sin(u*31+v*9)+.012*np.sin(u*73-v*18);stripe=1-smooth(.009,.018,abs(v-.5));tan=np.array([194,160,106],float)
    atlas=np.clip(tan[None,None,:]*variation[:,:,None]*(1-.43*stripe[:,:,None]),0,255).astype(np.uint8)
    png=out/'textures/fjord-authored-dun.png';Image.fromarray(atlas).save(png)
    neutral=out/'textures/fjord-authored-neutral.png';Image.fromarray(np.full_like(atlas,[225,219,202])).save(neutral)
    def luminance(rgb):
        srgb=np.asarray(rgb,float)/255;linear=np.where(srgb<=.04045,srgb/12.92,((srgb+.055)/1.055)**2.4)
        return float(np.mean(linear@np.array([.2126,.7152,.0722])))
    doc={'asset':{'version':'2.0','generator':'Meadowlark Ranch numerical source-derived Fjord conversion','copyright':'Fjord sculpture by TheBigWolfy; CGTrader Royalty Free License (no AI)',
                  'extras':{'sourceSha256':SHA,'sourceUrl':'https://www.cgtrader.com/free-3d-print-models/art/sculpture/fjord-pony-horse','adaptations':'LOD, physical fit, anatomical40, newly painted UV/coat/two-tone sculpted mane; original source shape retained as derivative','publicPlaintextDistribution':'Not authorized under the standard license; private intermediary pending protected packaging'}},
         'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[],'nodes':[],'meshes':[],'images':[],'textures':[],'samplers':[{'wrapS':10497,'wrapT':10497,'magFilter':9729,'minFilter':9987}],
         'materials':[{'name':'New authored Fjord dun coat','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.73}},
                      {'name':'New two-tone paint on actual sculpted upright mane and tail','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.76}},
                      {'name':'New painted dark eye on actual source eye surface','pbrMetallicRoughness':{'baseColorFactor':[.018,.012,.007,1],'metallicFactor':0,'roughnessFactor':.24}}]}
    binary=bytearray();image=png.read_bytes();vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':0,'byteLength':len(image)});binary.extend(image);doc['images'].append({'name':'New painted Fjord dun coat atlas','bufferView':vi,'mimeType':'image/png'});doc['textures'].append({'sampler':0,'source':0})
    for i,(name,parent,point) in enumerate(defs):
        doc['nodes'].append({'name':name,'translation':(heads[i]-(heads[ids[parent]] if parent else 0)).tolist(),'rotation':[0,0,0,1]})
        if parent:doc['nodes'][ids[parent]].setdefault('children',[]).append(i)
    inverse=np.tile(np.eye(4),(40,1,1));inverse[:,:3,3]=-heads;ib=append(doc,binary,inverse.transpose(0,2,1).reshape(40,16),5126,'MAT4');doc['skins']=[{'name':'Source-fitted anatomical40 Fjord rig','joints':list(range(40)),'skeleton':0,'inverseBindMatrices':ib}]
    uv=np.c_[(raw[:,2]-raw[:,2].min())/np.ptp(raw[:,2]),np.arctan2(raw[:,0]-cx,raw[:,1]-15)/(2*np.pi)+.5]
    body_colors=np.ones((len(raw),3));feet=1-smooth(.10,.30,p[:,1]);body_colors*=1-feet[:,None]*np.array([.91,.88,.82]);muzzle=smooth(130,138,raw[:,2])*(1-smooth(29,37,raw[:,1]));body_colors=body_colors*(1-muzzle[:,None]*.35)+muzzle[:,None]*.11
    groom_colors=np.tile(np.array([.80,.75,.57]),(len(raw),1));center=1-smooth(.9,1.55,abs(raw[:,0]-cx));groom_colors=groom_colors*(1-center[:,None])+np.array([.016,.012,.009])*center[:,None]
    part_reports=[]
    for mi,(name,mask,material) in enumerate(parts):
        selected=faces[mask];indices=np.unique(selected);lookup=np.full(len(raw),-1);lookup[indices]=np.arange(len(indices));local=lookup[selected].astype('<u4')
        colors=body_colors if mi==0 else groom_colors if mi==1 else np.ones_like(body_colors)
        attributes={'POSITION':append(doc,binary,p[indices],5126,'VEC3',34962),'NORMAL':append(doc,binary,normals[indices],5126,'VEC3',34962),
                    'TEXCOORD_0':append(doc,binary,uv[indices],5126,'VEC2',34962),'COLOR_0':append(doc,binary,colors[indices],5126,'VEC3',34962),
                    'JOINTS_0':append(doc,binary,joints[indices],5123,'VEC4',34962),'WEIGHTS_0':append(doc,binary,weights[indices],5126,'VEC4',34962)}
        doc['meshes'].append({'name':name,'primitives':[{'attributes':attributes,'indices':append(doc,binary,local.ravel(),5125,'SCALAR',34963),'material':material}]});doc['nodes'].append({'name':name,'mesh':mi,'skin':0})
        part_reports.append({'mesh':name,'vertices':len(indices),'triangles':len(selected),'sourceLodIndices':True})
    doc['scenes']=[{'name':'Actual source-derived Fjord game rig','nodes':[0,40,41,42]}];doc['scene']=0
    glb=trusted('rig_hero_horse.py','fjord_glb_writer');path=out/'fjord-rig.glb';glb.write_glb(path,doc,binary);rig_hash=hashlib.sha256(path.read_bytes()).hexdigest()
    back_mask=(abs(p[:,0])<.08)&(abs(raw[:,2]-61)<2);back_y=float(p[back_mask,1].max());poll=heads[ids['head']];muzzle_anchor=(np.array([cx,29,137])+offset)*scale
    anchors={'saddle':[[0,back_y,scale]],'withers':[[0,1.42,20*scale]],'head':[poll.tolist()],'poll':[poll.tolist()],'muzzle':[muzzle_anchor.tolist()],
             'crest':[heads[ids['neck.lower']].tolist(),heads[ids['neck.upper']].tolist(),heads[ids['head']].tolist()],
             'tail':[heads[ids['tail.'+str(i)]].tolist() for i in range(1,5)],
             'eyes':[((np.array([cx+side*7.7,43.3,126.4])+offset)*scale).tolist() for side in [-1,1]],
             'nostrils':[((np.array([cx+side*2.4,29.3,135.5])+offset)*scale).tolist() for side in [-1,1]]}
    profile={'id':'fjord','name':'Fjord Horse','artistBreed':True,'bodyMesh':'HorseBody','hairMesh':'HorseGroom','file':path.name,'sha256':rig_hash,'rigSha256':rig_hash,
             'sourceCandidate':'fjord-sculpt','sourceSha256':SHA,'creator':'TheBigWolfy','sourceUrl':doc['asset']['extras']['sourceUrl'],'license':'CGTrader Royalty Free License (no AI)',
             'licenseUrl':'https://www.cgtrader.com/pages/terms-and-conditions','noAI':True,'protectedPackagingRequired':True,
             'physicalScale':True,'fitScale':1,'fitY':0,'withersM':1.42,'heightM':float(p[np.unique(faces[parts[0][1]]),1].max()),'overallHeightM':float(p[:,1].max()),'family':'riding','jointCount':40,'triangles':len(faces),'motionKind':'fjord',
             'anchors':anchors,'preserveSourceGroom':True,'preserveSourceMaterials':True,'preserveSaddleAnchor':True,'groom':{'style':'upright','sourceSculptedGeometry':True},
             'neutralCoatFile':'textures/fjord-authored-neutral.png','neutralCoatLuminance':luminance([225,219,202]),'coatLuminance':luminance(atlas),'clips':[],
             'sourceArtAdaptation':'Actual TheBigWolfy Fjord sculpture LOD. New UVs/dun paint/dorsal stripe, two-tone paint on its actual upright mane and tail, anatomical skin/rig and own motions.',
             'motionStatus':'pending bake and actual playback QA','visualReview':'pending source-derived rest/posed render review','available':False}
    report={'schemaVersion':1,'candidateId':'fjord-sculpt','sourceSha256':SHA,'sourceReceiptPreserved':True,'sourceOriginalPreserved':True,'lodSha256':hashlib.sha256(lod.read_bytes()).hexdigest(),
            'gameRigSha256':rig_hash,'sourceAxes':'+Y up, +Z forward, canonical left=-X','physicalFit':{'metresPerNativeUnit':scale,'offsetNative':offset.tolist(),'measuredWithersNativeY':withers_raw,'groundNativeY':ground,'withersM':1.42},
            'sourceSculptedManeAndTailRetained':True,'generatedDuplicateGroom':False,'bodySilhouetteWarped':False,'geometryMethod':'Only approved numerical source LOD and uniform physical fit; no unrelated horse body substituted.',
            'meshParts':part_reports,'joints':[{'name':name,'parent':parent,'rawSourceFit':point,'metres':heads[i].tolist()} for i,(name,parent,point) in enumerate(defs)],
            'sourcePrintContactAdaptation':{'contactTrianglesRemoved':removed_contact_faces,'purpose':'Source LOD surface retained completely. Anatomical hind stifle/hock fit and source-tail distance ownership distinguish hair from calf/heel without cutting sculptural surfaces.'},
            'legCrossSections':{key:value.tolist() for key,value in stations.items()},'rigidSourceHoofs':sole_counts,
            'jointWeightSeams':'Weights solved and neighbor-smoothed on shared source LOD vertices before material splits; coincident copies share identical weights.',
            'newArtwork':['Dun paint and dorsal stripe atlas','Dark source hoof/muzzle paint','Two-tone paint on actual sculpted upright mane and long tail','Painted actual source eye surface','Longitudinal/cylindrical UV layout'],
            'licenseScope':'Private plaintext conversion only. Protected packaging or broader author grant required before public source/GLB redistribution.',
            'motionReview':'pending','visualReview':'pending'}
    for name,value in [('profile.json',profile),('build-report.json',report)]: (out/name).write_text(json.dumps(value,indent=2)+'\n')
    assert (source.parent/'receipt.json').read_bytes()==receipt_bytes and registered.file_digest(source)==(SHA,receipt['bytes'])
    print(json.dumps({'file':str(path.relative_to(ROOT)),'rigSha256':rig_hash,'withersM':1.42,'heightM':profile['heightM'],'triangles':len(faces),'soleCounts':sole_counts},indent=2))


if __name__=='__main__':main()
