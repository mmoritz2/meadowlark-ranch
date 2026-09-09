"""Author anatomically distinct breed meshes in isolated Blender 5.2.

Blender --background --factory-startup --python tools/asset-gen/build_breed_horses.py
Pass -- --preview to export/render the four contrasting approval silhouettes only.
Source GLBs and the interactive Blender session are never modified.
"""
import bpy, bmesh, math, json, pathlib, struct, copy, sys, re, hashlib
import numpy as np
from mathutils import Vector, Matrix, Quaternion

ROOT = pathlib.Path(__file__).resolve().parents[2]
ANATOMY_PREVIEW='--anatomy-preview' in sys.argv
ANATOMY_V2=ANATOMY_PREVIEW or '--anatomy-v2' in sys.argv
OUT = ROOT / 'assets/models/breeds'
if ANATOMY_PREVIEW:OUT=OUT/'anatomy-v2-preview'
elif '--anatomy-staging' in sys.argv:OUT=OUT/'anatomy-v2-build'
OUT.mkdir(parents=True, exist_ok=True)
REVIEW = OUT / 'review'; REVIEW.mkdir(exist_ok=True)
PREVIEW = '--preview' in sys.argv or ANATOMY_PREVIEW
if ANATOMY_V2:
    sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
    import equine_anatomy as anatomy
SOURCE = ROOT / 'assets/models/horse_showcase_rigged.glb'

# Region dimensions are relative to the base horse, never object-level scales.
# leg, barrel length/width/depth, neck length/thickness, head length/width,
# muzzle width, facial concavity, crest arch, cannon, hoof, ear length, tail set.
FIELDS = 'leg length width depth neck neckWidth head headWidth muzzle dish arch cannon hoof ear tailSet'.split()
ROWS = [
 ('bay','Quarter Horse',1.52, [ .98,1.02,1.11,1.05,.94,1.04,.96,1.05,1.03,0,.008,1.04,1.02,.96,0]),
 ('chestnut','Shetland Pony',1.02, [.73,.98,1.22,1.13,.88,1.12,.78,1.13,.96,.008,.039,1.02,1.08,.64,-.012]),
 ('palomino','Mustang',1.45, [.96,.97,1.05,1.04,.95,1.01,.98,1.02,1.0,0,.006,1.04,1.10,.98,0]),
 ('haflinger','Haflinger',1.45, [.85,1.01,1.24,1.16,.90,1.18,.96,1.10,1.03,.005,.025,1.14,1.12,.93,0]),
 ('grey','Andalusian',1.60, [1.00,.98,1.12,1.06,1.01,1.27,1.00,1.00,.99,-.012,.055,1.02,1.05,1.03,.018]),
 ('black','Friesian',1.64, [1.04,1.04,1.15,1.10,1.10,1.24,1.05,.99,1.0,-.010,.060,1.11,1.10,1.07,.012]),
 ('pinto','Paint Horse',1.55, [.97,1.04,1.18,1.08,.95,1.09,.99,1.07,1.04,0,.008,1.08,1.06,.99,0]),
 ('appaloosa','Appaloosa',1.54, [.99,1.01,1.10,1.02,.97,1.01,1.00,1.04,.98,0,.011,1.02,1.04,1.02,.004]),
 ('sunset','Arabian',1.50, [1.05,.92,.89,1.00,.99,.99,.90,1.02,.82,.027,.035,.91,.92,.92,.045]),
 ('iceland','Icelandic Horse',1.38, [.82,1.07,1.24,1.16,.89,1.16,1.00,1.12,1.03,0,.014,1.15,1.16,.87,-.009]),
 ('welsh','Welsh Mountain Pony',1.19, [.83,.92,1.07,1.06,.91,1.00,.88,1.06,.88,.020,.030,.93,.94,.84,.018]),
 ('stock','Australian Stock Horse',1.55, [1.03,1.02,1.03,1.02,.99,1.00,.99,.98,.98,0,.012,.98,1.03,1.00,.002]),
 ('fjord','Norwegian Fjord',1.42, [.85,1.00,1.30,1.20,.86,1.31,.96,1.16,1.08,0,.034,1.20,1.20,.90,-.006]),
 ('morgan','Morgan',1.52, [.98,.93,1.11,1.09,.99,1.15,.94,1.03,.94,.008,.050,1.02,1.02,.94,.025]),
 ('thoro','Thoroughbred',1.66, [1.17,1.11,.90,.98,1.11,.86,1.08,.92,.94,0,.012,.84,.94,1.09,.006]),
 ('knab','Knabstrupper',1.64, [1.07,1.08,1.09,1.06,1.05,1.04,1.04,1.02,1.02,0,.024,1.05,1.06,1.02,.003]),
 ('vanner','Gypsy Vanner',1.50, [.83,1.06,1.42,1.24,.93,1.33,1.02,1.12,1.06,-.006,.036,1.31,1.35,1.00,-.002]),
 ('marwari','Marwari',1.58, [1.09,1.00,.98,1.01,1.10,1.02,1.04,.97,.93,-.020,.034,.90,1.00,1.33,.022]),
 ('lipiz','Lipizzaner',1.56, [.98,.96,1.20,1.12,.98,1.27,1.02,1.04,1.03,-.019,.052,1.09,1.10,1.00,.016]),
 ('sport','Friesian Sporthorse',1.68, [1.11,1.08,1.07,1.06,1.10,1.12,1.03,.97,.98,-.003,.037,1.01,1.06,1.06,.012]),
 ('akhal','Akhal-Teke',1.59, [1.13,1.15,.80,1.01,1.20,.73,1.05,.83,.82,0,.017,.76,.85,1.22,.006]),
 ('percheron','Percheron',1.73, [.99,1.11,1.45,1.21,1.01,1.28,1.06,1.08,1.10,0,.030,1.28,1.30,1.02,-.004]),
 ('shire','Shire',1.82, [1.12,1.17,1.49,1.24,1.10,1.34,1.17,1.11,1.15,-.025,.038,1.32,1.40,1.15,-.008]),
 ('clyde','Clydesdale',1.78, [1.18,1.13,1.36,1.17,1.232,1.56,1.13,1.07,1.10,0,.048,1.24,1.39,1.24,-.001]),
]
SPECS={r[0]:{'id':r[0],'name':r[1],'withersM':r[2],'params':dict(zip(FIELDS,r[3]))} for r in ROWS}
SPECS['clyde']['params']['headVolume']=1.23
SPECS['clyde']['params'].update({'headBreadth':1.24,'headDepth':1.12})
if ANATOMY_V2:SPECS['clyde']['params'].update({'headVolume':1.23,'headBreadth':1.15,'headDepth':1.10})
if ANATOMY_V2:SPECS['akhal']['params']['separateHeadGate']=True
SPECS['clyde'].update({'fitScale':.9853418701948865,'fitY':.9615163086411954,'withersAnchor':[.2684011997406631,.49575046604097855,.0011449208678080104]})
ALIASES={'aether':'black','sunspear':'sunset','meadowlight':'bay','tempest':'clyde','eclipse':'thoro','glacier':'percheron','unicorn':'sunset','pegasus':'sport','celestial':'sunset','ember':'thoro','frost':'lipiz','aurora':'sport','phoenix':'marwari','shadowmare':'black','kestrel':'stock'}
DRAGONS=['frostdrake','emberdrake','amethyst','stormdrake','verdant']

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
def gauss(x,center,width): return np.exp(-((x-center)/width)**2)
def gltf_point(p): return [float(p[0]),float(p[2]),float(-p[1])]

def finish_surface(coords,key,p):
    """Small surface-only facial correction; it does not move gait pivots."""
    out=np.array(coords).copy()
    if key=='thoro':
        target=warp([[.950,-.119,.444]],p)[0];x,y,z=out.T
        nose=smooth(target[0]-.105,target[0]-.035,x)*(1-smooth(target[2]+.07,target[2]+.11,z))
        out[:,1]+=(y-target[1])*.16*nose
        out[:,2]-=.024*gauss(x,target[0]+.005,.075)*(1-smooth(target[2]-.018,target[2]+.045,z))*nose
    return out

if '--clyde-head-neck' in sys.argv or '--clyde-head-width' in sys.argv:
    # A targeted saved-library rebuild keeps the other 23 GLBs and both shared
    # images byte-identical while editing the live Blender armature and mesh.
    import ast
    own=ast.parse(pathlib.Path(__file__).read_text())
    for fn in own.body:
        if isinstance(fn,ast.FunctionDef) and fn.name in ('warp','read_glb','preserve_rig_and_share_textures','make_ear','make_lid','add_ellipsoid'):
            exec(compile(ast.Module(body=[fn],type_ignores=[]),__file__,'exec'),globals())
    inspection=json.loads((ROOT/'output/horse-review/original-inspection.json').read_text())
    bones={b['name']:(np.array(b['head']),np.array(b['tail']),0) for b in inspection['bones']}
    ORIG,ORIGBIN=read_glb(ROOT/'assets/models/horse_textured_rigged.glb')
    width_pass='--clyde-head-width' in sys.argv
    manifest=json.loads((OUT/'manifest.json').read_text())
    old=(json.loads((ROOT/'output/clyde-head-width-before/manifest.json').read_text())['breeds']['clyde'] if width_pass else json.loads((REVIEW/'clyde-before-head-neck.json').read_text(encoding='utf-8-sig')))
    pinned={path.name:hashlib.sha256(path.read_bytes()).hexdigest() for path in OUT.glob('*.glb') if path.name not in ('clyde.glb','clyde-before-head-neck.glb')}
    key='clyde';p=SPECS[key]['params'].copy();p['marwari']=False
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'breed-library.blend'))
    scene=bpy.context.scene;cam=scene.camera;floor=bpy.data.objects['Review floor'];reference=bpy.data.objects['Anatomical clean retopology']
    raw=np.array([v.co[:] for v in reference.data.vertices]);oldcoords=warp(raw,old['params']);coords=warp(raw,p)
    horse=bpy.data.objects['clyde_body'];arm=bpy.data.objects['clyde_skeleton'];horse.hide_set(False);arm.hide_set(False)
    coat=next(m for m in horse.data.materials if m.name.startswith('Horse coat'))
    eye_mat=bpy.data.materials['Horse eyes'];inner_mat=bpy.data.materials['Horse inner ear'];nostril_mat=bpy.data.materials['Horse muzzle details']
    uvvertex=int(np.argmin(np.sum((raw-np.array([-.1,-.2,.13]))**2,axis=1)))
    BODY_UV=next(tuple(reference.data.uv_layers.active.data[l.index].uv) for l in reference.data.loops if l.vertex_index==uvvertex)
    horse.data=reference.data.copy();horse.data.materials.clear();horse.data.materials.append(coat)
    for v,pt in zip(horse.data.vertices,coords):v.co=pt
    for f in horse.data.polygons:f.use_smooth=True
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
    for eb in arm.data.edit_bones:
        direction=eb.tail-eb.head;eb.use_connect=False;eb.head=Vector(warp([bones[eb.name][0]],p)[0]);eb.tail=eb.head+direction
    bpy.ops.object.mode_set(mode='OBJECT')
    sourceanchors={k:[[q[0],-q[2],q[1]] for q in points] for k,points in manifest['sourceAnchors'].items()}
    anchors={k:[gltf_point(pt) for pt in warp(points,p)] for k,points in sourceanchors.items()}
    anchors['withers']=copy.deepcopy(old['anchors']['withers'])
    extras=[make_ear(side,p,arm) for side in (-1,1)];volume=p['headVolume']
    for side,pt in enumerate(warp(sourceanchors['eyes'],p)):
        sg=-1 if side==0 else 1;nearest=int(np.argmin(np.sum((coords-pt)**2,axis=1)));pt=coords[nearest].copy();pt[1]+=sg*.001*volume;anchors['eyes'][side]=gltf_point(pt)
        extras.append(add_ellipsoid(key+'_eye_'+str(side),pt,tuple(s*volume for s in (.0182,.0065,.012)),eye_mat,arm,'bone_5'))
        extras.append(make_lid(pt,sg,arm,volume))
    for side,pt in enumerate(warp(sourceanchors['nostrils'],p)):
        sg=-1 if side==0 else 1;nearest=int(np.argmin(np.sum((coords-pt)**2,axis=1)));pt=coords[nearest].copy();pt[1]-=sg*.001*volume;anchors['nostrils'][side]=gltf_point(pt)
        extras.append(add_ellipsoid(key+'_nostril_'+str(side),pt,tuple(s*volume for s in (.019,.0027,.012)),nostril_mat,arm,'bone_6',16,10))
    bpy.ops.object.select_all(action='DESELECT');horse.select_set(True)
    for obj in extras:obj.select_set(True)
    bpy.context.view_layer.objects.active=horse;bpy.ops.object.join();horse.data.update()
    pts=np.array([v.co[:] for v in horse.data.vertices]);lo=pts.min(axis=0);hi=pts.max(axis=0)
    fit=old['fitScale'];fy=old['fitY']
    entry=copy.deepcopy(old);entry.update({'params':p,'anchors':anchors,'fitScale':fit,'fitY':fy,'surfaceRefinement':'Clydesdale regional head volume enlarged 23%; neck length coefficient increased 10% and thickness coefficient 24.8%; shoulder transition and original 1.78 m stature retained.'})
    if width_pass:entry['surfaceRefinement']='Clydesdale cheek/skull/jaw and muzzle breadth enlarged 24% with 12% more dorsoventral depth about the face axis; existing enlarged head length, fuller neck, stature and body fit retained.'
    entry['geometry'].update({'vertices':len(horse.data.vertices),'triangles':sum(len(f.vertices)-2 for f in horse.data.polygons),'sha256':hashlib.sha256(np.round(coords,7).tobytes()).hexdigest(),'rmsDisplacement':float(np.sqrt(np.mean(np.sum((coords-raw)**2,axis=1))))})
    entry['dimensionsSource']={'length':float(hi[0]-lo[0]),'width':float(hi[1]-lo[1]),'height':float(hi[2]-lo[2]),'withersHeight':float(anchors['withers'][0][1]-lo[2])}
    entry['bounds']={'min':gltf_point((lo[0],hi[1],lo[2])),'max':gltf_point((hi[0],lo[1],hi[2]))}
    bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=horse
    path=OUT/'clyde.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_skins=True,export_all_influences=False,export_materials='EXPORT');preserve_rig_and_share_textures(path,p);entry['geometry']['bytes']=path.stat().st_size
    for obj in scene.objects:
        if obj.name.endswith('_body'):obj.hide_render=True
    horse.hide_render=False;arm.hide_render=False
    def aim_clyde(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    center=Vector(((lo[0]+hi[0])/2,0,(lo[2]+hi[2])/2));floor.location.z=lo[2]-.003;cam.data.ortho_scale=max(float(hi[0]-lo[0])*1.23,float(hi[2]-lo[2])*1.6)
    for name,offset in [('front',(4.8,0,.15)),('side',(0,-4.5,.15)),('three-quarter',(2.4,-4.4,.70))]:
        cam.location=center+Vector(offset);aim_clyde(cam,center);scene.render.filepath=str(REVIEW/('clyde-'+name+'.png'));bpy.ops.render.render(write_still=True)
    physical=fit*entry['withersM']/1.45;arm.scale=(physical,)*3;arm.location.z=-lo[2]*physical;floor.location.z=-.003;cam.location=(0,-5,1.34);aim_clyde(cam,(0,0,1.34));cam.data.ortho_scale=3.65;scene.render.filepath=str(REVIEW/'clyde-scale.png');bpy.ops.render.render(write_still=True)
    arm.scale=(1,1,1);arm.location=(0,0,0);horse.hide_render=True;horse.hide_set(True);arm.hide_render=True;arm.hide_set(True);bpy.data.objects['bay_body'].hide_render=False;bpy.data.objects['bay_body'].hide_set(False)
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'breed-library.blend'))
    manifest['breeds']['clyde']=entry;temp=OUT/'manifest.json.tmp';temp.write_text(json.dumps(manifest,indent=2));temp.replace(OUT/'manifest.json')
    head=(raw[:,0]>.705)&(raw[:,2]>.365)
    neck=(raw[:,0]>.35)&(raw[:,0]<.43)&(raw[:,2]>.33)&(raw[:,2]<.58)
    def spans(a,sel):return np.ptp(a[sel],axis=0)
    metrics={'headVolumeFactor':volume,'neckLengthCoefficientRatio':p['neck']/old['params']['neck'],'neckThicknessCoefficientRatio':p['neckWidth']/old['params']['neckWidth'],'headBoundsOld':spans(oldcoords,head).tolist(),'headBoundsNew':spans(coords,head).tolist(),'headBoundsRatios':(spans(coords,head)/spans(oldcoords,head)).tolist(),'neckCrossSectionWidthOld':float(spans(oldcoords,neck)[1]),'neckCrossSectionWidthNew':float(spans(coords,neck)[1]),'neckCrossSectionWidthRatio':float(spans(coords,neck)[1]/spans(oldcoords,neck)[1]),'withersM':entry['withersM'],'fitScaleBefore':old['fitScale'],'fitScaleAfter':fit,'headBoneBefore':old['anchors']['head'],'headBoneAfter':anchors['head'],'otherModelHashesUnchanged':all(hashlib.sha256((OUT/name).read_bytes()).hexdigest()==digest for name,digest in pinned.items())}
    if width_pass:
        frame=warp([[.715,-.070,.645],[.950,-.119,.444]],old['params']);axis=frame[1]-frame[0];axis/=np.linalg.norm(axis)
        lateral=np.array([0.,1.,0.]);lateral-=axis*np.dot(lateral,axis);lateral/=np.linalg.norm(lateral);dorsal=np.cross(axis,lateral)
        for name,direction in [('faceLength',axis),('cheekBreadth',lateral),('facialDepth',dorsal)]:
            a=float(np.ptp(oldcoords[head]@direction));b=float(np.ptp(coords[head]@direction));metrics[name+'Before']=a;metrics[name+'After']=b;metrics[name+'Ratio']=b/a
        fixed=(raw[:,0]<.50)|(raw[:,2]<.28);metrics['bodyAndHoofMaxDisplacement']=float(np.max(np.abs(coords[fixed]-oldcoords[fixed])))
        metrics['fitYBefore']=old['fitY'];metrics['fitYAfter']=fy;metrics['headBreadthCoefficient']=p['headBreadth'];metrics['headDepthCoefficient']=p['headDepth']
    assert metrics['otherModelHashesUnchanged']
    (REVIEW/('clyde-head-width-metrics.json' if width_pass else 'clyde-head-neck-metrics.json')).write_text(json.dumps(metrics,indent=2));print('CLYDESDALE_COMPLETE',json.dumps(metrics),flush=True)
    raise SystemExit

if '--repair-details' in sys.argv:
    # Reuse the author's pure deformation/export functions without rebaking the
    # shared atlas or rewriting the other 22 models during browser QA.
    import ast
    own=ast.parse(pathlib.Path(__file__).read_text())
    for fn in own.body:
        if isinstance(fn,ast.FunctionDef) and fn.name in ('warp','read_glb','preserve_rig_and_share_textures'):
            exec(compile(ast.Module(body=[fn],type_ignores=[]),__file__,'exec'),globals())
    inspection=json.loads((ROOT/'output/horse-review/original-inspection.json').read_text())
    bones={b['name']:(np.array(b['head']),np.array(b['tail']),0) for b in inspection['bones']}
    ORIG,ORIGBIN=read_glb(ROOT/'assets/models/horse_textured_rigged.glb')
    manifest=json.loads((OUT/'manifest.json').read_text())
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'breed-library.blend'))
    scene=bpy.context.scene;cam=scene.camera;floor=bpy.data.objects['Review floor']
    reference=bpy.data.objects['Anatomical clean retopology']
    raw=np.array([v.co[:] for v in reference.data.vertices]);base_count=len(raw)
    def point_back(p):return np.array([p[0],-p[2],p[1]])
    def aim_repair(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
    for obj in scene.objects:
        if obj.name.endswith('_body'):obj.hide_render=True
    for key in ('marwari','thoro'):
        entry=manifest['breeds'][key];p=entry['params'];horse=bpy.data.objects[key+'_body'];arm=bpy.data.objects[key+'_skeleton']
        adjacency=[set() for _ in horse.data.vertices]
        for e in horse.data.edges:
            a,b=e.vertices;adjacency[a].add(b);adjacency[b].add(a)
        seen=set();components=[]
        for start in range(len(adjacency)):
            if start in seen:continue
            stack=[start];seen.add(start);group=[]
            while stack:
                i=stack.pop();group.append(i)
                for j in adjacency[i]:
                    if j not in seen:seen.add(j);stack.append(j)
            components.append(sorted(group))
        if key=='marwari':
            ears=[c for c in components if len(c)==182]
            assert len(ears)==2,[(len(c)) for c in components]
            ears.sort(key=lambda c:sum(horse.data.vertices[i].co.y for i in c)/len(c))
            for ids,side in zip(ears,(-1,1)):
                for index,vi in enumerate(ids):
                    j,k=divmod(index,14);t=j/12;a=k/14*math.tau;rad=(math.sin(math.pi*(t*.91+.05))**.60)*(1-t*.86)
                    inward=-side*.024*math.sin(t*math.pi*.73)**2+side*.008*t
                    q=np.array([.720+.020*t+.029*rad*math.cos(a),-.060+side*.061+inward+.023*rad*math.sin(a),.710+.108*p['ear']*t])
                    horse.data.vertices[vi].co=warp([q],p)[0]
            entry['surfaceRefinement']='Inward-curved ears separated along the entire shaft; tips approach without crossing.'
        else:
            coords=finish_surface(warp(raw,p),key,p)
            for vi in range(base_count):horse.data.vertices[vi].co=coords[vi]
            # Seat nostril inserts on the broadened wing, keeping their shape.
            nostrils=[c for c in components if len(c)==146]
            assert len(nostrils)==2,'Expected the two authored nostril inserts'
            nostrils.sort(key=lambda c:sum(horse.data.vertices[i].co.y for i in c)/len(c))
            for side,ids in enumerate(nostrils):
                old=point_back(entry['anchors']['nostrils'][side]);source=point_back(manifest['sourceAnchors']['nostrils'][side]);proposal=finish_surface(warp([source],p),key,p)[0]
                nearest=int(np.argmin(np.sum((coords-proposal)**2,axis=1)));new=coords[nearest].copy();new[1]-=(-1 if side==0 else 1)*.001
                for vi in ids:horse.data.vertices[vi].co+=Vector(new-old)
                entry['anchors']['nostrils'][side]=gltf_point(new)
            entry['surfaceRefinement']='Broadened nostril wings and a deeper rounded lower muzzle/chin; original skeletal pivots retained.'
        horse.data.update();horse.hide_render=False;horse.hide_set(False);arm.hide_render=False;arm.hide_set(False)
        bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=horse
        path=OUT/entry['file'];bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_skins=True,export_all_influences=False,export_materials='EXPORT');preserve_rig_and_share_textures(path,p)
        coords=np.array([v.co[:] for v in horse.data.vertices]);lo=coords.min(axis=0);hi=coords.max(axis=0)
        entry['geometry']['bytes']=path.stat().st_size;entry['geometry']['sha256']=hashlib.sha256(np.round(coords,7).tobytes()).hexdigest()
        center=Vector(((lo[0]+hi[0])/2,0,(lo[2]+hi[2])/2));floor.location.z=lo[2]-.003
        cam.data.ortho_scale=max(float(hi[0]-lo[0])*1.23,float(hi[2]-lo[2])*1.6)
        cam.location=center+Vector((0,-4.5,.15));aim_repair(cam,center);scene.render.filepath=str(REVIEW/(key+'-side.png'));bpy.ops.render.render(write_still=True)
        cam.location=center+Vector((2.4,-4.4,.70));aim_repair(cam,center);scene.render.filepath=str(REVIEW/(key+'-three-quarter.png'));bpy.ops.render.render(write_still=True)
        physical=entry['fitScale']*entry['withersM']/1.45;arm.scale=(physical,)*3;arm.location.z=-lo[2]*physical;floor.location.z=-.003;cam.location=(0,-5,1.34);aim_repair(cam,(0,0,1.34));cam.data.ortho_scale=3.65;scene.render.filepath=str(REVIEW/(key+'-scale.png'));bpy.ops.render.render(write_still=True)
        arm.scale=(1,1,1);arm.location=(0,0,0);horse.hide_render=True;horse.hide_set(True);arm.hide_render=True;arm.hide_set(True)
    bpy.data.objects['bay_body'].hide_render=False;bpy.data.objects['bay_body'].hide_set(False)
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'breed-library.blend'))
    temp=OUT/'manifest.json.tmp';temp.write_text(json.dumps(manifest,indent=2));temp.replace(OUT/'manifest.json')
    print('DETAIL_REPAIR_COMPLETE marwari thoro',flush=True)
    raise SystemExit

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
base=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
base_arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
base.name='Authoring reference - retained original'
base.hide_render=True
base_coords=np.array([v.co[:] for v in base.data.vertices],dtype=np.float64)
bones={b.name:(np.array(b.head_local[:]),np.array(b.tail_local[:]),b.roll if hasattr(b,'roll') else 0) for b in base_arm.data.bones}
bone_rest={b.name:b.matrix_local.copy() for b in base_arm.data.bones}
weights=np.zeros((len(base_coords),33))
for v in base.data.vertices:
    for g in v.groups:
        name=base.vertex_groups[g.group].name
        if name.startswith('bone_'): weights[v.index,int(name[5:])]=g.weight

# Flatten the integrated generated mane onto a smooth oval neck surface. The
# underlying closed mesh remains: deleting a painted patch would open the neck.
def sculpt_clean(points):
    """Retopology-preserving anatomical loft: erase generated hair/brow folds."""
    a=np.array(points,dtype=np.float64).reshape((-1,3));x,y,z=a.T;out=a.copy()
    A=np.array([.20,-.017,.293]);B=np.array([.676,-.055,.658]);axis=B-A
    axis[1]=0;length=np.linalg.norm(axis);direction=axis/length;perp=np.array([-direction[2],0,direction[0]])
    t=np.clip(((a-A)@direction)/length,0,1);center=A+(B-A)*t[:,None]
    v=a-center;u=v@perp;side=v[:,1]
    r=np.interp(t,[0,.32,.68,1],[.162,.126,.087,.061]);w=np.interp(t,[0,.4,1],[.139,.111,.064])
    angle=np.arctan2(side/w,u/r)
    if ANATOMY_V2:
        dorsal=np.interp(t,[0,.32,.68,1],[.161,.131,.083,.053]);ventral=np.interp(t,[0,.32,.68,1],[.224,.177,.098,.053])
        r=np.where(np.cos(angle)>0,dorsal,ventral);w=np.interp(t,[0,.4,1],[.151,.118,.057])
    neck=center+np.cos(angle)[:,None]*r[:,None]*perp;neck[:,1]+=np.sin(angle)*w
    headmix=smooth(.58,.72,x)*smooth(.29,.40,z)
    nw=smooth(.065,.20,x)*smooth(.205,.33,z)*(1-headmix)
    out+=(neck-a)*nw[:,None]*.985
    P=np.array([.744,-.071,.662]);Q=np.array([.950,-.119,.444]);axis=Q-P;axis[1]=0;length=np.linalg.norm(axis);direction=axis/length;perp=np.array([-direction[2],0,direction[0]])
    t=((a-P)@direction)/length;tc=np.clip(t,-.20,1.17);center=P+(Q-P)*tc[:,None]
    v=a-center;u=v@perp;side=v[:,1]
    r=np.interp(tc,[-.20,0,.17,.35,.58,.80,1,1.17],[.006,.068,.080,.072,.052,.054,.060,.041])
    w=np.interp(tc,[-.20,0,.17,.35,.58,.80,1,1.17],[.006,.067,.079,.074,.057,.058,.067,.041])
    angle=np.arctan2(side/w,u/r)
    head=center+np.cos(angle)[:,None]*r[:,None]*perp;head[:,1]+=np.sin(angle)*w
    # Masseter under the cheek, supraorbital shelf, nostril wing and chin are
    # surface volume, not dark paint. Keep the jaw-to-throat transition open.
    ventral=1-smooth(-.025,.010,u)
    cheek=gauss(tc,.11,.25)*ventral
    head-=perp[None,:]*(.021*cheek)[:,None]
    head[:,1]+=np.sign(side)*(.014*gauss(tc,.16,.24)+.006*gauss(tc,.86,.17))*np.minimum(1,np.abs(side)/(w+.001))
    orbit=gauss(tc,.04,.14)*gauss(u,.002,.024)
    head[:,1]+=np.sign(side)*.007*orbit
    head-=perp[None,:]*(.014*gauss(tc,.95,.21)*ventral)[:,None]
    out+=(head-out)*headmix[:,None]*.995
    return out
clean=sculpt_clean(base_coords)

# Remove the opaque lower tail and ear lumps. Small openings at the dock/poll
# are covered by the authored volumetric replacement ear bases and groom roots.
remove_tail=(weights[:,20:23].sum(axis=1)>.18)&(base_coords[:,0]<-.82)
remove_tail|=(base_coords[:,0]<-.87)&(base_coords[:,2]<.34)
remove_tail|=(base_coords[:,0]<-.855)&(base_coords[:,2]>.10)&(base_coords[:,2]<.46)
remove_ear=(base_coords[:,0]>.58)&(base_coords[:,2]>.755)
remove_vertices=remove_tail|remove_ear
keep_faces=[p.index for p in base.data.polygons if not any(remove_vertices[i] for i in p.vertices)]
cleaned_mesh=base.data.copy()
bm=bmesh.new();bm.from_mesh(cleaned_mesh);bm.faces.ensure_lookup_table()
keep_face_set=set(keep_faces)
removed=[f for f in bm.faces if f.index not in keep_face_set]
bmesh.ops.delete(bm,geom=removed,context='FACES_ONLY')
# Do not remesh/decimate: preserve original UV seams and deform weights.
bm.to_mesh(cleaned_mesh);bm.free()
# Mesh cleanup retains original vertex ordering until orphan vertices removed.
for v in cleaned_mesh.vertices: v.co=clean[v.index]
for attr in list(cleaned_mesh.color_attributes): cleaned_mesh.color_attributes.remove(attr)

# The generated mane is folded topology, so projecting it alone leaves tangent
# creases and coplanar scraps. Reconstruct a closed volume once, then transfer
# the original UV coordinates and skin weights onto this cleaner topology.
retopo_source=base.copy();retopo_source.data=cleaned_mesh.copy();bpy.context.collection.objects.link(retopo_source);retopo_source.name='Source for skin and UV transfer';retopo_source.hide_render=True
retopo=retopo_source.copy();retopo.data=retopo_source.data.copy();bpy.context.collection.objects.link(retopo);retopo.name='Anatomical clean retopology'
for mod in list(retopo.modifiers):retopo.modifiers.remove(mod)
if ANATOMY_V2:anatomy.prepare_master(retopo)
# The imported GLB duplicates vertices along UV seams. Weld those geometric
# seams and cap the deliberately cut poll/dock before volume reconstruction.
bm=bmesh.new();bm.from_mesh(retopo.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00003)
loose=[v for v in bm.verts if not v.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
boundary=[e for e in bm.edges if e.is_boundary]
if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(retopo.data);bm.free()
bpy.ops.object.select_all(action='DESELECT');retopo.select_set(True);bpy.context.view_layer.objects.active=retopo
rem=retopo.modifiers.new('Close folded surface and hair cuts','REMESH');rem.mode='VOXEL';rem.voxel_size=.008 if ANATOMY_V2 else .010;rem.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=rem.name)
sm=retopo.modifiers.new('Relax voxel surface','SMOOTH');sm.factor=.38;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
tri=sum(len(f.vertices)-2 for f in retopo.data.polygons)
if tri>44500:
    dec=retopo.modifiers.new('Balanced game topology','DECIMATE');dec.ratio=44500/tri;bpy.ops.object.modifier_apply(modifier=dec.name)
V2_LANDMARKS=None
if ANATOMY_V2:
    anatomy.blend_dock(retopo);anatomy.refine_limbs(retopo,bones);anatomy.refine_muzzle(retopo);anatomy.densify_head(retopo);V2_LANDMARKS=anatomy.cut_features(retopo)
for layer in list(retopo.data.uv_layers):retopo.data.uv_layers.remove(layer)
retopo.data.uv_layers.new(name='UVMap')
transfer=retopo.modifiers.new('Original skin transfer','DATA_TRANSFER');transfer.object=retopo_source;transfer.use_vert_data=True;transfer.data_types_verts={'VGROUP_WEIGHTS'};transfer.vert_mapping='POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier=transfer.name)
# A fresh atlas avoids interpolation across unrelated original UV islands.
# Every breed shares this topology and these coordinates, so both maps are
# baked once on the clean reference and reused across all conformation meshes.
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.018);bpy.ops.object.mode_set(mode='OBJECT')
for v in retopo.data.vertices:
    ordered=sorted([(g.group,g.weight) for g in v.groups],key=lambda q:q[1],reverse=True)[:4]
    total=sum(w for _,w in ordered)
    for group in retopo.vertex_groups:group.remove([v.index])
    if total>0:
        for gi,w in ordered:retopo.vertex_groups[gi].add([v.index],w/total,'REPLACE')
cleaned_mesh=retopo.data.copy();clean=np.array([v.co[:] for v in cleaned_mesh.vertices])
for f in cleaned_mesh.polygons:f.use_smooth=True
body_uv_vertex=int(np.argmin(np.sum((clean-np.array([-.1,-.2,.13]))**2,axis=1)))
BODY_UV=next(tuple(cleaned_mesh.uv_layers.active.data[l.index].uv) for l in cleaned_mesh.loops if l.vertex_index==body_uv_vertex)
retopo.hide_render=True;retopo.hide_set(True);retopo_source.hide_set(True)
print('CLEAN_RETOPOLOGY',len(cleaned_mesh.vertices),sum(len(f.vertices)-2 for f in cleaned_mesh.polygons),flush=True)

def warp(points,p):
    """Continuous anatomy field in Blender rest coordinates; also maps joints."""
    a=np.array(points,dtype=np.float64).reshape((-1,3));x,y,z=a.T
    out=a.copy()
    # Barrel length/depth, defined shoulders/gluteals and a quieter lumbar dip.
    torso=(1-smooth(.27,.62,x))*smooth(-.34,-.03,z)
    out[:,0]=-.20+(x+.20)*p['length']
    out[:,1]=-.015+(y+.015)*(1+(p['width']-1)*torso)
    out[:,2]=z+(z-.11)*(p['depth']-1)*torso
    flank=gauss(x,-.47,.31)*gauss(z,.07,.24)*torso
    shoulder=gauss(x,.16,.14)*gauss(z,.12,.18)*torso
    gluteal=gauss(x,-.64,.18)*gauss(z,.20,.18)*torso
    surface=smooth(.03,.14,np.abs(y+.015))
    out[:,1]+=np.sign(y+.015)*surface*(.014*gluteal+(.0 if ANATOMY_V2 else .010)*shoulder-.004*flank)
    if ANATOMY_V2:
        scapula=np.exp(-((x-(.265-.54*(z+.02)))/.075)**2)*gauss(z,.13,.22)*torso
        out[:,1]+=np.sign(y+.015)*surface*.010*scapula
        out[:,2]+=.006*gauss(x,.14,.18)*smooth(.21,.35,z)
    else:out[:,2]+=.014*gauss(x,.22,.12)*smooth(.20,.34,z)
    # Independent leg length and cannon/fetlock/hoof conformation. The centers
    # follow the existing bent rest legs, so stance and four skin chains survive.
    low=1-smooth(-.12,.075,z)
    out[:,2]+=z*(p['leg']-1)*low
    for indices in ([7,8,9,10,11,12],[13,14,15,16,17,18],[23,24,25,26,27],[28,29,30,31,32]):
        seq=np.array([bones['bone_'+str(i)][0] for i in indices]);seq=seq[np.argsort(seq[:,2])]
        cx=np.interp(z,seq[:,2],seq[:,0]);cy=np.interp(z,seq[:,2],seq[:,1])
        isfront=indices[0]<20;isleft=indices[0] in (7,23)
        sel=(x>-.20 if isfront else x<-.35)&(y>-.015 if isleft else y<-.015)
        influence=sel*(1-smooth(-.15,-.035,z))
        hoof=1-smooth(-.735,-.685,z)
        fetlock=gauss(z,-.65,.046)
        radial=p['cannon']+(p['hoof']-p['cannon'])*hoof+.025*fetlock
        out[:,0]+=(x-cx)*(radial-1)*influence
        # Spread limbs with chest width but change thickness about each limb.
        out[:,1]+=(cy+.015)*(p['width']-1)*.48*influence+(y-cy)*(radial-1)*influence
        # Slightly sloped draft pasterns, distinct from merely fat hooves.
        out[:,0]+=.025*(p['hoof']-1)*gauss(z,-.715,.04)*influence
    # Neck length, cross section and raised crest; head travels with its poll.
    A=np.array([.22,-.015,.30]);B=np.array([.66,-.053,.655]);axis=B-A
    t=np.clip(((a-A)@axis)/(axis@axis),0,1)
    axial=t[:,None]*axis
    perp=a-(A+axial)
    nw=smooth(.18,.38,x)*smooth(.20,.40,z)
    hw=smooth(.58,.73,x)*smooth(.33,.49,z)
    if p.get('separateHeadGate'):hw=smooth(.58,.73,x)*smooth(.24,.34,z)
    delta=axial*(p['neck']-1)
    thick=perp*(p['neckWidth']-1);thick[:,0]*=.55
    delta+=thick*(1-hw[:,None])
    delta[:,2]+=p['arch']*np.sin(t*np.pi*.75)
    delta[:,0]-=p['arch']*.35*np.sin(t*np.pi*.75)
    out+=delta*nw[:,None]
    # Head length is measured along the poll-to-muzzle axis, independently of
    # ears, neck length and jaw width. Dish/convexity affect the nasal bridge.
    P=np.array([.715,-.070,.645]);v=a-P
    faceaxis=np.array([.78,0,-.625]);along=v@faceaxis
    head_delta=along[:,None]*faceaxis*(p['head']-1)
    head_delta[:,1]+=(y-P[1])*(p['headWidth']-1)
    face=gauss(x,.850,.084)*gauss(z,.56,.095)
    head_delta[:,0]-=p['dish']*face
    head_delta[:,2]-=p['dish']*.32*face
    muzzle=smooth(.83,.94,x)*(1-smooth(.48,.57,z))
    head_delta[:,1]+=(y+.104)*(p['muzzle']-1)*muzzle
    head_delta[:,2]+=(z-.44)*(p['muzzle']-1)*muzzle*.42
    # More distinct eye socket and fine throat latch on light heads.
    socket=gauss(x,.785,.044)*gauss(z,.637,.029)
    head_delta[:,1]-=np.sign(y+.065)*.0035*socket
    out+=head_delta*hw[:,None]
    if p.get('headVolume',1)!=1:
        baseparams=dict(p);baseparams.update({'headVolume':1,'headBreadth':1,'headDepth':1})
        poll=warp([P],baseparams)[0]
        headvolume=smooth(.50,.67,x)*smooth(.28,.43,z)
        out+=(out-poll)*(p['headVolume']-1)*headvolume[:,None]
    if p.get('headBreadth',1)!=1 or p.get('headDepth',1)!=1:
        # Expand the cross section of the face, never its poll-to-muzzle axis.
        # The orthonormal lateral/dorsal frame also follows the source head's
        # slight turn, preventing a one-sided cheek or off-centre muzzle.
        baseline=dict(p);baseline.update({'headBreadth':1,'headDepth':1})
        frame=warp([P,[.950,-.119,.444]],baseline);axis=frame[1]-frame[0];axis/=np.linalg.norm(axis)
        lateral=np.array([0.,1.,0.]);lateral-=axis*np.dot(lateral,axis);lateral/=np.linalg.norm(lateral);dorsal=np.cross(axis,lateral)
        relative=out-frame[0];zone=smooth(.57,.70,x)*smooth(.28,.43,z)
        out+=((relative@lateral)[:,None]*lateral*(p.get('headBreadth',1)-1)+(relative@dorsal)[:,None]*dorsal*(p.get('headDepth',1)-1))*zone[:,None]
    tail=smooth(.77,.91,-x)*smooth(.12,.29,z)
    out[:,2]+=p['tailSet']*tail
    return out

def material(name,color,rough=.58):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Specular IOR Level'].default_value=.28
    return m

# Clean shared albedo: actual coat/muzzle/hoof pigmentation, without the old
# baked cream mane islands, specular highlights, painted eyes or muscle shadows.
albedo_path=OUT/'coat_albedo.png'
coat=material('Horse coat - clean shared chestnut',(.26,.091,.036),.63)
if True:
    bake_obj=retopo.copy();bake_obj.data=cleaned_mesh.copy();bpy.context.collection.objects.link(bake_obj);bake_obj.hide_render=False;bake_obj.hide_set(False)
    bake=bpy.data.materials.new('Unlit coat bake');bake.use_nodes=True;n=bake.node_tree.nodes;l=bake.node_tree.links;n.clear()
    attr=bake_obj.data.color_attributes.new(name='CleanPigment',type='FLOAT_COLOR',domain='POINT')
    for i,v in enumerate(bake_obj.data.vertices):
        x,y,z=clean[i]
        hoof=float(1-smooth(-.758,-.71,z))
        muzzle=float(smooth(.85,.935,x)*(1-smooth(.48,.54,z)))
        dark=max(hoof,muzzle*.90)
        warmth=.98+.035*math.sin(x*7+z*5)
        col=np.array([.26,.091,.036])*warmth*(1-dark)+np.array([.023,.020,.018])*dark
        attr.data[i].color=(*col,1)
    vc=n.new('ShaderNodeVertexColor');vc.layer_name=attr.name
    em=n.new('ShaderNodeEmission');l.new(vc.outputs[0],em.inputs[0]);out=n.new('ShaderNodeOutputMaterial');l.new(em.outputs[0],out.inputs[0])
    im=bpy.data.images.new('Shared breed coat albedo',2048,2048,alpha=False);im.colorspace_settings.name='sRGB'
    node=n.new('ShaderNodeTexImage');node.image=im;n.active=node
    bake_obj.data.materials.clear();bake_obj.data.materials.append(bake)
    bpy.ops.object.select_all(action='DESELECT');bake_obj.select_set(True);bpy.context.view_layer.objects.active=bake_obj
    bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=1;bpy.context.scene.render.bake.margin=16
    bpy.ops.object.bake(type='EMIT');im.filepath_raw=str(albedo_path);im.file_format='PNG';im.save()
    bpy.data.objects.remove(bake_obj,do_unlink=True)
else: im=bpy.data.images.load(str(albedo_path),check_existing=True)
n=coat.node_tree.nodes;l=coat.node_tree.links;bs=n.get('Principled BSDF');tex=n.new('ShaderNodeTexImage');tex.image=im;l.new(tex.outputs[0],bs.inputs['Base Color'])
normal=bpy.data.images.new('Shared breed coat normal',1024,1024,alpha=False);normal.colorspace_settings.name='Non-Color'
normal_obj=retopo.copy();normal_obj.data=cleaned_mesh.copy();bpy.context.collection.objects.link(normal_obj);normal_obj.hide_render=False;normal_obj.hide_set(False);normal_obj.data.materials.clear();normal_obj.data.materials.append(coat)
coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=380;noise.inputs['Detail'].default_value=1;l.new(coord.outputs['Object'],noise.inputs['Vector'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.08 if ANATOMY_V2 else .10;bump.inputs['Distance'].default_value=.00018 if ANATOMY_V2 else .0012;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],bs.inputs['Normal'])
target=n.new('ShaderNodeTexImage');target.image=normal;n.active=target
bpy.ops.object.select_all(action='DESELECT');normal_obj.select_set(True);bpy.context.view_layer.objects.active=normal_obj;bpy.ops.object.bake(type='NORMAL');normal.filepath_raw=str(OUT/'coat_normal.png');normal.file_format='PNG';normal.save();bpy.data.objects.remove(normal_obj,do_unlink=True)
l.remove(bs.inputs['Normal'].links[0])
texn=n.new('ShaderNodeTexImage');texn.image=normal;nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.4;l.new(texn.outputs[0],nm.inputs[1]);l.new(nm.outputs[0],bs.inputs['Normal'])
eye_mat=material('Horse eyes',(.023,.012,.006),.22)
inner_mat=material('Horse inner ear',(.072,.039,.022),.86)
nostril_mat=material('Horse muzzle details',(.014,.012,.010),.65)

def add_ellipsoid(name,center,scale,mat,arm,weightbone,segments=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=(0,0,0));o=bpy.context.object;o.name=name
    for v in o.data.vertices:v.co=Vector(center)+Vector((v.co.x*scale[0],v.co.y*scale[1],v.co.z*scale[2]))
    for f in o.data.polygons:f.use_smooth=True
    o.data.materials.append(mat);g=o.vertex_groups.new(name=weightbone);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    mod=o.modifiers.new('Breed skin','ARMATURE');mod.object=arm;o.parent=arm
    return o

def make_ear(side,p,arm):
    # Closed pointed ear with a gently cupped front and asymmetrical tip bend.
    verts=[];faces=[];uvs=[];rows=12;around=14
    center=np.array([.720,-.060+side*(.061 if p.get('marwari') else .053),.710]);height=.108*p['ear']
    for j in range(rows+1):
        t=j/rows;rad=(math.sin(math.pi*(t*.91+.05))**.60)*(1-t*.86)
        for k in range(around):
            a=k/around*math.tau
            inward=(-side*.024*math.sin(t*math.pi*.73)**2+side*.008*t if p.get('marwari') else -side*.008*t*t)
            q=center+np.array([.020*t+.029*rad*math.cos(a),inward+.023*rad*math.sin(a),height*t])
            verts.append(warp([q],p)[0]);uvs.append((.18,.24))
    for j in range(rows):
        for k in range(around):
            a=j*around+k;b=j*around+(k+1)%around;c=b+around;d=a+around;faces.append((a,b,c,d))
    faces.append(tuple(range(around-1,-1,-1)));faces.append(tuple(rows*around+k for k in range(around)))
    mesh=bpy.data.meshes.new('Authored ear');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Authored pinna',mesh);bpy.context.collection.objects.link(o)
    mesh.materials.append(coat);mesh.materials.append(inner_mat)
    # The narrow inside face is dark tissue; outer ear is coat pigment.
    for f in mesh.polygons:
        f.use_smooth=True
        if f.index<rows*around and (f.index%around in (6,7,8)) and f.index//around>1:f.material_index=1
    uv=mesh.uv_layers.new()
    for loop in mesh.loops:uv.data[loop.index].uv=BODY_UV
    g=o.vertex_groups.new(name='bone_5');g.add(list(range(len(verts))),1,'REPLACE');mod=o.modifiers.new('Breed skin','ARMATURE');mod.object=arm;o.parent=arm
    return o

def make_lid(center,side,arm,scale=1):
    # A fleshy oval orbital rim seats the visible cornea, avoiding button eyes.
    verts=[];faces=[];around=32;tube=6
    for j in range(around):
        a=j/around*math.tau;thick=.0023*(1+.30*max(0,math.sin(a)))
        for k in range(tube):
            b=k/tube*math.tau
            verts.append((center[0]+scale*(.0188+thick*math.cos(b))*math.cos(a),center[1]+scale*side*(.004+thick*math.sin(b)),center[2]+scale*(.0126+thick*math.cos(b))*math.sin(a)))
    for j in range(around):
        for k in range(tube):faces.append((j*tube+k,((j+1)%around)*tube+k,((j+1)%around)*tube+(k+1)%tube,j*tube+(k+1)%tube))
    mesh=bpy.data.meshes.new('Sculpted eyelid');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Sculpted eyelid',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(coat)
    uv=mesh.uv_layers.new()
    for loop in mesh.loops:uv.data[loop.index].uv=BODY_UV
    for f in mesh.polygons:f.use_smooth=True
    g=o.vertex_groups.new(name='bone_5');g.add(list(range(len(verts))),1,'REPLACE');mod=o.modifiers.new('Breed skin','ARMATURE');mod.object=arm;o.parent=arm
    return o

def read_glb(path):
    raw=path.read_bytes();jl=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+jl]),bytearray(raw[28+jl:])
ORIG,ORIGBIN=read_glb(ROOT/'assets/models/horse_textured_rigged.glb')

def preserve_rig_and_share_textures(path,p):
    doc,raw=read_glb(path);oj=ORIG['skins'][0]['joints'];sj=doc['skins'][0]['joints']
    assert [ORIG['nodes'][i]['name'] for i in oj]==[doc['nodes'][i]['name'] for i in sj]
    parents={c:i for i,n in enumerate(ORIG['nodes']) for c in n.get('children',[])}
    def local(n):
        if 'matrix'in n:return Matrix(np.array(n['matrix']).reshape(4,4).T)
        q=n.get('rotation',[0,0,0,1]);return Matrix.Translation(Vector(n.get('translation',[0,0,0])))@Quaternion((q[3],*q[:3])).to_matrix().to_4x4()@Matrix.Diagonal((*n.get('scale',[1,1,1]),1))
    cache={}
    def world(i):
        if i not in cache:cache[i]=(world(parents[i]) if i in parents else Matrix.Identity(4))@local(ORIG['nodes'][i])
        return cache[i]
    desired={}
    for oi in oj:
        m=world(oi).copy();q=m.translation
        q2=warp([[q.x,-q.z,q.y]],p)[0];m.translation=Vector(gltf_point(q2));desired[oi]=m
    for oi,si in zip(oj,sj):
        old=ORIG['nodes'][oi];new=doc['nodes'][si]
        parent=parents.get(oi);pm=desired.get(parent,world(parent) if parent is not None else Matrix.Identity(4))
        lm=pm.inverted()@desired[oi]
        for prop in ('translation','rotation','scale','matrix'):new.pop(prop,None)
        # Exact original local rest rotations are the gait contract.
        if 'rotation' in old:new['rotation']=old['rotation']
        if 'scale' in old:new['scale']=old['scale']
        new['translation']=list(lm.translation)
    # All generated primitives share the same skeleton and inverse bind data.
    for skin in doc['skins']:
        accessor=doc['accessors'][skin['inverseBindMatrices']];view=doc['bufferViews'][accessor['bufferView']]
        start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
        bind=[]
        for ji in skin['joints']:
            name=doc['nodes'][ji]['name'];oi=next(i for i in oj if ORIG['nodes'][i]['name']==name)
            bind.extend(np.array(desired[oi].inverted()).T.flatten().tolist())
        raw[start:start+len(bind)*4]=struct.pack('<'+'f'*len(bind),*bind)
    image_views=set()
    for image in doc.get('images',[]):
        if 'bufferView' in image:image_views.add(image['bufferView'])
        image.pop('bufferView',None);image.pop('mimeType',None)
        image['uri']='coat_normal.png' if 'normal' in image.get('name','').lower() else 'coat_albedo.png'
    # Repack excluding image payloads (shared once across all 24 breeds).
    packed=bytearray();views=[];remap={}
    for i,view in enumerate(doc['bufferViews']):
        if i in image_views:continue
        packed.extend(b'\0'*((-len(packed))%4));start=view.get('byteOffset',0)
        v=dict(view);v['byteOffset']=len(packed);packed.extend(raw[start:start+view['byteLength']]);remap[i]=len(views);views.append(v)
    for a in doc['accessors']:a['bufferView']=remap[a['bufferView']]
    doc['bufferViews']=views;doc['buffers'][0]['byteLength']=len(packed)
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            for attr in list(prim['attributes']):
                if attr.startswith('COLOR_'):del prim['attributes'][attr]
    jb=json.dumps(doc,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);packed.extend(b'\0'*((-len(packed))%4))
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(jb)+len(packed))+struct.pack('<II',len(jb),0x4E4F534A)+jb+struct.pack('<II',len(packed),0x004E4942)+packed)
    return doc

def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=20;s.cycles.use_denoising=True
s.render.resolution_x=960;s.render.resolution_y=720;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.83));floor=bpy.context.object;floor.name='Review floor';floor.data.materials.append(material('Review floor',(.155,.18,.16),.9))
bpy.ops.object.camera_add(location=(2.2,-4.4,1.1));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.8;s.camera=cam
for name,loc,power,size in [('Soft key',(1,-3,4),480,4),('Fill',(-2,1,2),160,3),('Rim',(-1,3,3),300,2)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;aim(o,(0,0,0))
s.world=bpy.data.worlds.new('Review daylight');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.38,.43,.50,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.48

SOURCE_ANCHORS={
 'withers':[[.215,-.005,.425]], 'saddle':[[-.24,-.005,.323]],
 'head':[bones['bone_6'][0].tolist()],
 'eyes':[[.769,-.151,.640],[.769,-.003,.640]],
 'nostrils':[[.959,-.173,.446],[.959,-.065,.446]],
 'muzzle':[[.923,-.112,.422]], 'poll':[[.708,-.049,.737]],
 'crest':[[.685,-.056,.727],[.625,-.050,.699],[.531,-.042,.648],[.436,-.034,.595],[.343,-.027,.544],[.247,-.019,.490],[.133,-.012,.422]],
 'tail':[[ -.825,.022,.345],[-.895,.014,.219],[-.938,.001,-.070],[-.931,-.007,-.373],[-.923,-.015,-.676]],
 'hooves':[bones['bone_'+str(i)][0].tolist() for i in [12,18,27,32]],
}
if V2_LANDMARKS:
    SOURCE_ANCHORS.update(V2_LANDMARKS)
    SOURCE_ANCHORS['crest'][0]=[.704,-.051,.722]
manifest={'version':1,'coordinateSystem':'+X forward, +Y up, +Z lateral; glTF scene rest space','canonicalWithers':1.45,'referenceWithersM':1.52,'source':'../horse_showcase_rigged.glb','sharedTextures':['coat_albedo.png','coat_normal.png'],'breeds':{},'aliases':ALIASES,'legacyDragonKeys':DRAGONS,'sourceAnchors':{k:[gltf_point(v) for v in vs] for k,vs in SOURCE_ANCHORS.items()}}
manifest['anatomyRevision']='equine-v2' if ANATOMY_V2 else 'breed-v1'
objects=[]
ids=['clyde','sunset','thoro'] if ANATOMY_PREVIEW else ['chestnut','sunset','thoro','shire'] if PREVIEW else list(SPECS)
for count,key in enumerate(ids):
    spec=SPECS[key];p=spec['params'].copy();p['marwari']=key=='marwari'
    arm=base_arm.copy();arm.data=base_arm.data.copy();bpy.context.collection.objects.link(arm);arm.name=key+'_skeleton';arm.hide_render=False
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
    for eb in arm.data.edit_bones:
        direction=eb.tail-eb.head;head=warp([bones[eb.name][0]],p)[0];eb.use_connect=False;eb.head=Vector(head);eb.tail=eb.head+direction
    bpy.ops.object.mode_set(mode='OBJECT')
    horse=base.copy();horse.data=cleaned_mesh.copy();bpy.context.collection.objects.link(horse);horse.name=key+'_body';horse.parent=arm;horse.hide_render=False
    for mod in horse.modifiers:
        if mod.type=='ARMATURE':mod.object=arm
    coords=warp(np.array([v.co[:] for v in cleaned_mesh.vertices]),p)
    if not ANATOMY_V2:coords=finish_surface(coords,key,p)
    for v,co in zip(horse.data.vertices,coords):v.co=co
    for f in horse.data.polygons:f.use_smooth=True
    horse.data.materials.clear();horse.data.materials.append(coat)
    extras=[anatomy.ear(side,arm,p,warp,coat,inner_mat,BODY_UV) if ANATOMY_V2 else make_ear(side,p,arm) for side in (-1,1)]
    if ANATOMY_V2:
        extras.extend(anatomy.mouth_seam(SOURCE_ANCHORS[name],arm,p,warp,nostril_mat) for name in ('mouthLeft','mouthRight'))
    anchors={k:[gltf_point(v) for v in warp(vs,p)] for k,vs in SOURCE_ANCHORS.items()}
    for side,pt in enumerate(warp(SOURCE_ANCHORS['eyes'],p)):
        if ANATOMY_V2:
            extras.append(anatomy.eye_globe(SOURCE_ANCHORS['eyes'][side],arm,p,warp,eye_mat,BODY_UV,-1 if side==0 else 1));continue
        sg=-1 if side==0 else 1;nearest=int(np.argmin(np.sum((coords-pt)**2,axis=1)));pt=coords[nearest].copy();pt[1]+=sg*.001
        anchors['eyes'][side]=gltf_point(pt)
        extras.append(add_ellipsoid(key+'_eye_'+str(side),pt,tuple(s*p.get('headVolume',1) for s in (.0182,.0065,.012)),eye_mat,arm,'bone_5'))
        extras.append(make_lid(pt,sg,arm,p.get('headVolume',1)))
    for side,pt in enumerate(warp(SOURCE_ANCHORS['nostrils'],p)):
        if ANATOMY_V2:
            extras.append(anatomy.nostril_bowl(SOURCE_ANCHORS['nostrils'][side],-1 if side==0 else 1,arm,p,warp,nostril_mat,BODY_UV));continue
        sg=-1 if side==0 else 1;nearest=int(np.argmin(np.sum((coords-pt)**2,axis=1)));pt=coords[nearest].copy();pt[1]-=sg*.001
        anchors['nostrils'][side]=gltf_point(pt)
        extras.append(add_ellipsoid(key+'_nostril_'+str(side),pt,tuple(s*p.get('headVolume',1) for s in (.019,.0027,.012)),nostril_mat,arm,'bone_6',16,10))
    # One coat primitive means existing runtime coat shaders can target the body.
    bpy.ops.object.select_all(action='DESELECT');horse.select_set(True)
    for o in extras:o.select_set(True)
    bpy.context.view_layer.objects.active=horse;bpy.ops.object.join()
    if ANATOMY_V2:anatomy.clean_export(horse)
    pts=np.array([v.co[:] for v in horse.data.vertices]);used=np.unique([i for f in horse.data.polygons for i in f.vertices]);lo=pts[used].min(axis=0);hi=pts[used].max(axis=0)
    withers=np.array(anchors['withers'][0])[1];fit=1.45/(withers-lo[2]);fy=-lo[2]*fit
    if key=='clyde':
        fit=spec['fitScale'];fy=spec['fitY'];anchors['withers']=[spec['withersAnchor']];withers=anchors['withers'][0][1]
    triangle_count=sum(len(f.vertices)-2 for f in horse.data.polygons)
    geometry_digest=hashlib.sha256(np.round(coords,7).tobytes()).hexdigest()
    specentry={'file':key+'.glb','name':spec['name'],'withersM':spec['withersM'],'fitScale':fit,'fitY':fy,'anchors':anchors,'params':p,'groom':{'opaqueManeRemoved':True,'opaqueTailRemoved':True,'style':'upright' if key=='fjord' else 'sparse' if key=='akhal' else 'long' if key in ('black','vanner','shire','clyde') else 'natural'},'dimensionsSource':{'length':float(hi[0]-lo[0]),'width':float(hi[1]-lo[1]),'height':float(hi[2]-lo[2]),'withersHeight':float(withers-lo[2])},'bounds':{'min':gltf_point((lo[0],hi[1],lo[2])),'max':gltf_point((hi[0],lo[1],hi[2]))},'geometry':{'vertices':len(horse.data.vertices),'triangles':triangle_count,'bones':33,'sha256':geometry_digest,'rmsDisplacement':float(np.sqrt(np.mean(np.sum((coords-clean)**2,axis=1))))},'restRotations':'exact original','restTranslations':'anatomically repositioned','skinWeights':'source interpolated onto clean retopology, strongest4 renormalized; authored head details use existing joints'}
    bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=horse
    file=OUT/specentry['file'];bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_skins=True,export_all_influences=False,export_materials='EXPORT',export_tangents=True)
    preserve_rig_and_share_textures(file,p);specentry['geometry']['bytes']=file.stat().st_size;manifest['breeds'][key]=specentry
    floor.location.z=lo[2]-.003
    center=Vector(((lo[0]+hi[0])/2,0,(lo[2]+hi[2])/2))
    cam.location=center+Vector((0,-4.5,.15));aim(cam,center);cam.data.ortho_scale=max(float(hi[0]-lo[0])*1.23,float(hi[2]-lo[2])*1.6)
    s.render.filepath=str(REVIEW/(key+'-side.png'));bpy.ops.render.render(write_still=True)
    if ANATOMY_V2 or PREVIEW or key in ('marwari','fjord','akhal','bay'):
        cam.location=center+Vector((2.4,-4.4,.70));aim(cam,center);s.render.filepath=str(REVIEW/(key+'-three-quarter.png'));bpy.ops.render.render(write_still=True)
    if ANATOMY_V2:
        head_center=Vector(warp([[.805,-.08,.575]],p)[0]);cam.data.ortho_scale=.95
        for angle,offset in [('head-side',(0,-4,.03)),('head-quarter',(2,-4,.35)),('head-front',(4,0,.04))]:
            cam.location=head_center+Vector(offset);aim(cam,head_center);s.render.filepath=str(REVIEW/(key+'-'+angle+'.png'));bpy.ops.render.render(write_still=True)
    # Fixed metre scale and framing for an honest size comparison contact sheet.
    physical=fit*spec['withersM']/1.45;arm.scale=(physical,)*3;arm.location.z=-lo[2]*physical
    floor.location.z=-.003;cam.location=(0,-5,1.34);aim(cam,(0,0,1.34));cam.data.ortho_scale=3.65
    s.render.filepath=str(REVIEW/(key+'-scale.png'));bpy.ops.render.render(write_still=True)
    arm.scale=(1,1,1);arm.location=(0,0,0)
    horse.hide_render=True;arm.hide_render=True;objects.append((key,horse,arm))
    (OUT/('preview-manifest.json' if PREVIEW else 'build-progress.json')).write_text(json.dumps(manifest,indent=2))
    print('BREED_FINISHED',key,'triangles',triangle_count,'file',file.stat().st_size,'fitScale',round(fit,5),flush=True)

# Editable library: each collection contains its unique mesh plus live armature.
# Geometry stays at the origin, with all but the first hidden for easy inspection.
for i,(key,horse,arm) in enumerate(objects):
    col=bpy.data.collections.new(SPECS[key]['name']);s.collection.children.link(col)
    for o in (horse,arm):
        for old in list(o.users_collection):old.objects.unlink(o)
        col.objects.link(o)
    horse.hide_render=i!=0;arm.hide_render=i!=0;horse.hide_set(i!=0);arm.hide_set(i!=0)
base.hide_set(True);base_arm.hide_set(True)
im.pack();normal.pack();bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('breed-preview.blend' if PREVIEW else 'breed-library.blend')))
if not PREVIEW:
    assert len(manifest['breeds'])==24
    temp=OUT/'manifest.json.tmp';temp.write_text(json.dumps(manifest,indent=2));temp.replace(OUT/'manifest.json')
elif ANATOMY_PREVIEW:(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('BUILD_COMPLETE',len(ids),flush=True)
