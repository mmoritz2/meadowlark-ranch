"""Only writes isolated candidate outputs, with explicit attribution."""
import bpy,pathlib,json,math
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/horse-candidates/b2przemo'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/horse-reset/b2przemo-review/b2przemo-review.blend'))
horse=next(o for o in bpy.context.scene.objects if o.type=='MESH')
pts=[v.co.copy() for v in horse.data.vertices]
lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);span=hi-lo
scale=2.2/span.z;cx=(lo.x+hi.x)/2;cy=(lo.y+hi.y)/2
headpts=[p for p in pts if p.x>hi.x-span.x*.24 and p.z>lo.z+span.z*.68]
headlo=Vector([min(p[i] for p in headpts) for i in range(3)]);headhi=Vector([max(p[i] for p in headpts) for i in range(3)]);head=(headlo+headhi)/2
headgltf=[(head.y-cy)*scale,(head.z-lo.z)*scale,(head.x-cx)*scale]
for v in horse.data.vertices:
    x,y,z=v.co;v.co=((y-cy)*scale,-(x-cx)*scale,(z-lo.z)*scale)
horse.data.update()
bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);bpy.context.view_layer.objects.active=horse
bpy.ops.export_scene.gltf(filepath=str(OUT/'horse-review.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
sub=horse.modifiers.new('One subdivision of artist quad cage for review','SUBSURF');sub.subdivision_type='CATMULL_CLARK';sub.levels=1;sub.render_levels=1
bpy.ops.object.modifier_apply(modifier=sub.name)
bpy.ops.export_scene.gltf(filepath=str(OUT/'horse-review-subdiv1.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
meta={'artist':'b2przemo','source':'https://blendswap.com/blend/13903','license':'CC BY 3.0','licenseUrl':'https://creativecommons.org/licenses/by/3.0/','status':'Unrigged modeling foundation; not a finished game horse','file':'horse-review.glb','subdivTrial':'horse-review-subdiv1.glb','changes':'Source axis/unit conversion, centering and floor placement, smooth recalculated normals, nonmetallic material. Optional subdiv1 file applies one Catmull-Clark level.','orientation':'+Y up, +Z nose, centered X/Z, feet at Y=0','height':2.2,'headCenter':headgltf,'scaleFromOriginalCm':scale*.01,'sourceTextureSize':[512,512]}
(OUT/'review-manifest.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta),flush=True)
