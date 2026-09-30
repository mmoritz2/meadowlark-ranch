"""Independent finite numeric checks against acquired pastel geometry/maps/groom.

Run our script in trusted Blender solely for its numeric KDTree API. It never
opens the downloaded Blend, executes source scripts, or evaluates drivers.
"""
from pathlib import Path
import hashlib,json,sys
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
from draft_glb_tools import GLB

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/pastel-unicorn'

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def image_bytes(g,image):
    v=g.doc['bufferViews'][image['bufferView']]
    return bytes(g.binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])

def main():
    source=GLB(BASE/'source/unicorn.glb');profile=json.loads((BASE/'game/profile.json').read_text())
    rig=GLB(BASE/'game/pastel-unicorn-rigged.glb');game=GLB(BASE/'game'/profile['file'])
    report=json.loads((BASE/'game/rigging-validation.json').read_text());normal=report['physicalNormalization']
    checks={};metrics={}
    checks['registeredSourceHash']=sha(BASE/'source/unicorn.glb')==profile['acquiredSourceSha256']
    checks['profileAnimatedHash']=sha(BASE/'game'/profile['file'])==profile['sha256']
    def norm(p):
        out=np.array(p,dtype=float,copy=True);out[...,1]-=normal['sourceGroundY'];out*=normal['scale'];return out
    source_meshes={};body=None;max_position_error=0.;uv_checks=[]
    meshes={m['name']:m for m in game.doc['meshes']}
    for i,node in enumerate(source.doc['nodes']):
        if 'mesh' not in node:continue
        world=source.world(i)
        for pi,sp in enumerate(source.doc['meshes'][node['mesh']]['primitives']):
            name=('HorseBody' if pi==0 else 'HorseHorn') if node['name']=='body.001' else 'Source_'+node['name']
            gp=meshes[name]['primitives'][0];points=source.accessor(sp['attributes']['POSITION'])
            expected=norm(points@world[:3,:3].T+world[:3,3]);actual=game.accessor(gp['attributes']['POSITION'])
            error=float(np.linalg.norm(expected-actual,axis=1).max());max_position_error=max(max_position_error,error)
            for attr in ('NORMAL','TANGENT','TEXCOORD_0','TEXCOORD_1','COLOR_0'):
                if attr in sp['attributes']:uv_checks.append(np.array_equal(source.accessor(sp['attributes'][attr]),game.accessor(gp['attributes'][attr])))
            uv_checks.append(np.array_equal(source.accessor(sp['indices']),game.accessor(gp['indices'])))
            uv_checks.append(sp.get('material')==gp.get('material'))
            if name=='HorseBody':body=expected;body_uv=source.accessor(sp['attributes']['TEXCOORD_0'])
    checks['allSourceBodyEyesHornVerticesPreserved']=max_position_error<1e-6
    metrics['maxSourceNormalizedVertexErrorM']=max_position_error
    checks['sourceUVNormalsTangentsIndicesExact']=all(uv_checks)
    checks['originalMaterialsExact']=game.doc['materials'][:len(source.doc['materials'])]==source.doc['materials']
    checks['all14OriginalEncodedImagesExact']=len(source.doc['images'])==14 and all(image_bytes(source,s)==image_bytes(game,g) for s,g in zip(source.doc['images'],game.doc['images']))
    metrics['originalImageHashes']=[hashlib.sha256(image_bytes(source,i)).hexdigest() for i in source.doc['images']]
    checks['allBuffersImagesEmbedded']=all('uri' not in x for x in game.doc['images']+game.doc['buffers'])
    skin=game.doc['skins'][0];joints=skin['joints'];names=[game.doc['nodes'][i]['name'] for i in joints]
    checks['canonical40Ordered']=len(joints)==40 and all(game.parents.get(i) not in joints or joints.index(game.parents[i])<j for j,i in enumerate(joints))
    heads={n:game.world(i)[:3,3] for n,i in zip(names,joints)}
    checks['canonicalLeftNegativeX']=all(heads[n][0]<0 for n in ('ear.L','FL.hoof','HL.hoof')) and all(heads[n][0]>0 for n in ('ear.R','FR.hoof','HR.hoof'))
    ibm=game.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    transforms=np.array([game.world(i) for i in joints])@ibm
    max_bind_error=0.;max_weight_error=0.;count=0
    for mesh in game.doc['meshes']:
        for p in mesh['primitives']:
            a=p['attributes'];points=game.accessor(a['POSITION']);js=game.accessor(a['JOINTS_0']);w=game.accessor(a['WEIGHTS_0'])
            max_weight_error=max(max_weight_error,float(abs(w.sum(1)-1).max()));count+=len(points)
            assert js.max()<40 and w.min()>=0
            for start in range(0,len(points),100000):
                q=points[start:start+100000];jj=js[start:start+100000];ww=w[start:start+100000]
                deformed=np.zeros_like(q,dtype=np.float64)
                for k in range(4):
                    t=transforms[jj[:,k]];deformed+=(np.einsum('nij,nj->ni',t[:,:3,:3],q)+t[:,:3,3])*ww[:,k,None]
                max_bind_error=max(max_bind_error,float(np.linalg.norm(deformed-q,axis=1).max()))
    checks['everyBodyAndGroomVertexRestSkinIdentity']=max_bind_error<2e-6
    checks['fourWeightsNormalized']=max_weight_error<2e-6
    metrics.update(totalSkinVertices=count,maxBindSkinErrorM=max_bind_error,maxWeightSumError=max_weight_error)
    kd=KDTree(len(body))
    for i,p in enumerate(body):kd.insert(Vector(p),i)
    kd.balance();groom=[];extraction=json.loads((BASE/'work/source-inspection/native-groom-extraction.json').read_text())
    for row in extraction['rows']:
        raw=np.load(BASE/'work/source-inspection'/row['file']);pp=row['pointsPerPath'];curves=raw['points'].reshape(-1,pp,3)
        expected=norm(np.stack([curves[:,:,0],curves[:,:,2],-curves[:,:,1]],axis=2))
        nearest=[kd.find(Vector(p)) for p in expected[:,0]];valid=np.array([r[2]<.065 for r in nearest]);ids=np.array([r[1] for r in nearest])[valid]
        expected=expected[valid];name='HorseGroom_'+row['name'].replace(' ','_');p=meshes[name]['primitives'][0]
        ribbons=game.accessor(p['attributes']['POSITION']).reshape(len(expected),pp,2,3);centres=ribbons.mean(2)
        # Each ribbon half is clamped only for actual lower-fur sole clearance.
        delta=centres-expected;err=float(np.linalg.norm(delta,axis=2).max());horizontal=float(abs(delta[:,:,[0,2]]).max())
        uv=game.accessor(p['attributes']['TEXCOORD_0']).reshape(len(expected),pp,2,2)
        uv_exact=np.array_equal(uv,np.broadcast_to(body_uv[ids,None,None,:],uv.shape))
        assert len(expected)==next(r['retainedNativePaths'] for r in report['groom'] if r['name']==row['name'])
        groom.append({'name':row['name'],'nativePaths':len(expected),'sampledPointsPerPath':pp,'maxCentrelineErrorM':err,'maxHorizontalCentrelineErrorM':horizontal,'rootUVExact':bool(uv_exact)})
    checks['allNativeSampledGroomCentrelinesRetained']=all(r['maxCentrelineErrorM']<.003 and r['maxHorizontalCentrelineErrorM']<3e-7 for r in groom)
    checks['allGroomSourceRootUVsExact']=all(r['rootUVExact'] for r in groom)
    metrics['groom']=groom
    checks['rigAndBakedMeshAttributesExact']=rig.doc['meshes']==game.doc['meshes'] and rig.doc['materials']==game.doc['materials']
    # Accessor indices can be compacted by the baker: compare every actual array.
    checks['rigAndBakedMeshAttributesExact']=all(np.array_equal(rig.accessor(rp['attributes'][attr]),game.accessor(gp['attributes'][attr])) for rm,gm in zip(rig.doc['meshes'],game.doc['meshes']) for rp,gp in zip(rm['primitives'],gm['primitives']) for attr in rp['attributes'])
    result={'sourceSha256':sha(BASE/'source/unicorn.glb'),'animatedSha256':profile['sha256'],'checks':checks,'metrics':metrics,'passed':all(checks.values()),'sourceScriptsDriversExecuted':False,'externalAlembicRead':False,'generativeToolsUsed':False,'nativeGroomAdaptation':'Source-native sampled particle paths; explicit selected child density and documented <=2.77mm lower-fur floor clearance. No procedural replacement flow.'}
    (BASE/'game/source-fidelity-validation.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'passed':result['passed'],'checks':checks,'maxSourceVertexErrorM':max_position_error,'maxBindSkinErrorM':max_bind_error,'groom':groom}),flush=True)
    if not result['passed']:raise RuntimeError('Actual source fidelity check failed')
if __name__=='__main__':main()
