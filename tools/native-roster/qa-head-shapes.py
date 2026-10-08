"""Focused native head geometry gate; no browser or source-GLB mutation.

Decode the shipped buffers, compare the pre-head cage outside the facial field,
check bit/seat/stirrup continuity and sample the real native motion tracks. This
is a numerical fit gate, not a substitute for closeup art/motion review.
"""
from pathlib import Path
import argparse, hashlib, json, sys
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build as build
import validate as validate

TOLERANCE=2e-5

def decode(data,record,field):
    d=record[field]
    return np.frombuffer(data,dtype='<i2',count=d['count'],offset=d['byteOffset']).reshape(-1,3).astype(float)*d['scale']


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--baseline-dir',type=Path)
    ap.add_argument('--report',type=Path);args=ap.parse_args()
    manifest=json.loads((build.OUT/'manifest.json').read_text())
    assert hashlib.sha256(build.SOURCE.read_bytes()).hexdigest()==build.SOURCE_SHA
    doc,binary=build.glb.read_glb(build.SOURCE);worlds,_=build.glb.node_worlds(doc)
    skin=doc['skins'][0];assert len(skin['joints'])==677
    binds=build.glb.accessor(doc,binary,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    ops=np.array([worlds[i] for i in skin['joints']])@binds
    meshes=[]
    for primitive in [m['primitives'][0] for m in doc['meshes']]:
        a=primitive['attributes'];p=build.glb.accessor(doc,binary,a['POSITION'])
        j=build.glb.accessor(doc,binary,a['JOINTS_0']);w=build.glb.accessor(doc,binary,a['WEIGHTS_0'])
        assert j.max()<677 and np.max(abs(w.sum(axis=1)-1))<.001
        m=np.einsum('nw,nwij->nij',w,ops[j]);q=validate.transform(m,p,build.TRANSLATION)
        meshes.append({'position':p,'matrix':m,'world':q,'weights':w,'joints':j})
    body=meshes[0]['world'];limbs=build.draft_limb_centers(body)
    tack_source={'actual':meshes[3]['world'], 'indices':build.glb.accessor(doc,binary,doc['meshes'][3]['primitives'][0]['indices']).astype(int)}
    tack_mask,_=build.draft_stirrup_components(tack_source)
    keys=[key for key,row in manifest['breeds'].items() if row.get('headShape')]
    assert keys, 'No built head refinements'
    # The field and frame must be shared, centered on the turned source head,
    # compact, and distinguish a dished Arabian from a straight Akhal face.
    basis=np.array([build.HEAD_SIDE,build.HEAD_AXIS,build.HEAD_FACE])
    assert np.max(abs(basis@basis.T-np.eye(3)))<1e-12
    assert build.head_shape('sunset')['nasal_bridge_m']<0 and build.head_shape('akhal')['nasal_bridge_m']==0
    far=np.array([[0.,0.,0.],[0.,1.5,-.7],[0.,1.78,.35],[0.,1.0,.3]])
    for key in build.HEAD_PROFILE_FAMILIES:assert np.array_equal(build.head_refinement(far,key),np.zeros_like(far))
    # Each family moves bilateral cheeks symmetrically in the measured frame.
    pair=build.HEAD_ORIGIN+np.array([-.08,.08])[:,None]*build.HEAD_SIDE+.23*build.HEAD_AXIS-.09*build.HEAD_FACE
    for key in keys:
        local=build.head_refinement(pair,key)@basis.T
        assert abs(local[0,0]+local[1,0])<1e-12
        assert np.max(abs(local[0,1:]-local[1,1:]))<1e-12
    # A selected head mask, rather than validate.py's lower-limb mask, makes
    # these actual animation matrices cover all head/eye/nostril surroundings.
    selected=(body[:,1]>1.5)&(body[:,2]>.85)
    frame_mesh={**meshes[0],'lower':selected}
    frames=validate.gait_frames(doc,binary,skin,binds,frame_mesh)
    baseline_manifest=json.loads((args.baseline_dir/'manifest.json').read_text()) if args.baseline_dir else None
    rows=[]
    for key in keys:
        row=manifest['breeds'][key];data=(build.ROOT/'assets'/row['file']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==row['sha256']
        assert row['headShape']['sameFieldOnBodyEyesAndBridle']
        s=row['sculptTargets'];outside_max=0.;field_max=0.;mesh_rows=[];body_out=None
        for index in [0,1,3,4]:
            source=meshes[index];p=source['world'];record=row['meshes'][index]
            raw=(source['position']+decode(data,record,'positionDelta')).astype('<f4')
            actual=validate.transform(source['matrix'],raw,build.TRANSLATION)
            limb=limbs if key in build.DRAFT_SHAPES and index==0 else None
            mask=tack_mask if key in build.DRAFT_SHAPES and index==3 else None
            lift=build.DRAFT_STIRRUP_LIFT_M.get(key,0)/row['actorScale']
            old=build.cage(p,s,key,limb,mask,lift,refine_head=False)
            expected=build.head_refinement(p,key)
            error=np.linalg.norm(actual-old-expected,axis=1)
            assert np.isfinite(actual).all() and error.max()<TOLERANCE,(key,index,'decoded shared cage',error.max())
            outside=np.linalg.norm(expected,axis=1)==0
            unchanged=np.linalg.norm(actual[outside]-old[outside],axis=1).max(initial=0)
            assert unchanged<TOLERANCE,(key,index,'nonfacial geometry changed',unchanged)
            if baseline_manifest:
                oldrow=baseline_manifest['breeds'][key];olddata=(args.baseline_dir/(key+'.bin')).read_bytes()
                oldraw=(source['position']+decode(olddata,oldrow['meshes'][index],'positionDelta')).astype('<f4')
                oldworld=validate.transform(source['matrix'],oldraw,build.TRANSLATION)
                assert np.linalg.norm(actual[outside]-oldworld[outside],axis=1).max(initial=0)<TOLERANCE*2
            outside_max=max(outside_max,float(unchanged));field_max=max(field_max,float(np.linalg.norm(expected,axis=1).max()*row['actorScale']))
            mesh_rows.append({'meshIndex':index,'maxSharedFieldErrorM':float(error.max()),'maxOutsideHeadErrorM':float(unchanged)})
            if index==0:
                body_out=raw
                floor=actual[:,1].min();assert abs(floor)<1e-8
                lower=p[:,1]<=.65
                if key not in build.DRAFT_SHAPES:assert np.array_equal(raw[lower],source['position'][lower])
                else:assert abs(actual[lower,1]-p[lower,1]).max()<TOLERANCE
            if index==3:
                for a,b in [(2792,2845),(2716,2769)]:
                    assert np.array_equal(expected[a:b+1],np.zeros_like(expected[a:b+1])),(key,'tread drift')
                bits=[float(np.linalg.norm(expected[a:b+1],axis=1).max()*row['actorScale']) for a,b in [(7894,8124),(6954,7184)]]
                assert max(bits)<.016,(key,'large bit movement',bits)
        seat=(build.SOURCE_SEAT+build.TRANSLATION)[None,:]
        assert np.array_equal(build.head_refinement(seat,key),np.zeros((1,3)))
        assert np.array_equal(build.cage(seat,s,key,refine_head=False)[0]-build.TRANSLATION,row['sourceSeat'])
        assert .002<field_max<.020,(key,'head pass is absent or excessive',field_max)
        max_motion=0.
        source=meshes[0];rest_delta=decode(data,row['meshes'][0],'positionDelta')
        # Compare new head displacement with the identical preserved rig and
        # old cage, through each sampled native pose. No clip is reauthored.
        oldworld=build.cage(body,s,key,limbs if key in build.DRAFT_SHAPES else None,refine_head=False)
        oldraw=source['position']+np.linalg.solve(source['matrix'][:,:3,:3],(oldworld-body)[...,None])[...,0]
        for name,at,matrix in frames:
            animated=validate.transform(matrix,body_out[selected],build.TRANSLATION)
            previous=validate.transform(matrix,oldraw[selected],build.TRANSLATION)
            assert np.isfinite(animated).all()
            max_motion=max(max_motion,float(np.linalg.norm(animated-previous,axis=1).max()*row['actorScale']))
        assert max_motion<.025,(key,'animated head delta',max_motion)
        coat=(build.ROOT/'assets'/row['coat']['file']).read_bytes()
        assert hashlib.sha256(coat).hexdigest()==row['coat']['sha256']
        if baseline_manifest:
            before=baseline_manifest['breeds'][key]
            assert {k:v for k,v in row['coat'].items() if k!='description'}=={k:v for k,v in before['coat'].items() if k!='description'}
            assert row['sourceSeat']==before['sourceSeat']
            assert row.get('draftShape')==before.get('draftShape') and row['actorScale']==before['actorScale']
        rows.append({'id':key,'family':row['headShape']['family'],'maxDisplayedHeadDeltaM':field_max,
            'maxOutsideHeadQuantizationM':outside_max,'maxAnimatedAdditionalHeadDeltaM':max_motion,
            'nativeGaitFrames':len(frames),'displayedBitDeltaM':bits,'meshes':mesh_rows})
    report={'pass':True,'sourceRigHashUnchanged':build.SOURCE_SHA,'jointCount':677,'reviewRequired':'Bare head/front/side/quarter and fitted bridle animation. Numerical checks do not certify anatomical appearance.','rows':rows}
    if args.report:args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'pass':True,'profiles':keys,'nativeGaitFramesPerProfile':len(frames),
        'maximumDisplayedHeadDeltaM':max(r['maxDisplayedHeadDeltaM'] for r in rows),
        'maximumOutsideHeadQuantizationM':max(r['maxOutsideHeadQuantizationM'] for r in rows)}))

if __name__=='__main__':main()
