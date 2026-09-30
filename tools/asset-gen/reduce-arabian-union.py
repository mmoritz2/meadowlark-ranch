"""Reduce the ordinary unsigned source-derived union to game topology."""
import json,sys
from pathlib import Path
import bpy,bmesh
import numpy as np
if not {'--factory-startup','--disable-autoexec'}<=set(sys.argv):raise RuntimeError('Trusted launch flags missing')
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'assets/models/horse-imports/arabian-sculpt/work'
d=np.load(WORK/'standing-union.npz');p=d['source'];f=d['faces']
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.use_scripts_auto_execute=False
mesh=bpy.data.meshes.new('Actual source-derived repaired standing union');mesh.from_pydata(p.tolist(),[],f.tolist());mesh.update();obj=bpy.data.objects.new(mesh.name,mesh);bpy.context.scene.collection.objects.link(obj);obj.select_set(True);bpy.context.view_layer.objects.active=obj
smooth=obj.modifiers.new('Final small join fairing','SMOOTH');smooth.factor=.22;smooth.iterations=2;bpy.ops.object.modifier_apply(modifier=smooth.name)
dec=obj.modifiers.new('Game source-specific topology','DECIMATE');dec.ratio=min(1.,95000/len(mesh.polygons));dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
bm.to_mesh(obj.data);bm.free()
p=np.array([v.co[:] for v in obj.data.vertices]);f=np.array([poly.vertices[:] for poly in obj.data.polygons]);np.savez_compressed(WORK/'standing-remesh.npz',source=p,faces=f)
r=json.loads((WORK/'standing-union-report.json').read_text());r.update({'derivativeVertices':len(p),'derivativeTriangles':len(f),'sourceHeadSurfaceExactlyPreservedAfterUnion':False,'headJoin':'Final unsigned union removes overlapping head/body caps and joins the actual source-derived surfaces into continuous game geometry.'});(WORK/'standing-remesh-report.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'vertices':len(p),'triangles':len(f),'bounds':{'min':p.min(0).tolist(),'max':p.max(0).tolist()}}),flush=True)
