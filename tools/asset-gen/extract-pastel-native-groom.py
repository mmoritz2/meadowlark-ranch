"""Bounded probe of source particle paths; no downloaded scripts/drivers run.

First probe uses source parent guides only, without generated children, to check
whether the Blend's authored groom is actually recoverable before reading ABC.
"""
from pathlib import Path
import importlib.util,json,sys
import bpy
import numpy as np

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('owned_pastel_inspection',HERE/'inspect-pastel-unicorn-source.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
report,objects=helper.main()
body=next(o for o in objects if o.name=='body.001')
for obj in objects:
 if obj:
  for m in obj.modifiers:
   if m.type=='PARTICLE_SYSTEM':m.show_viewport=False;m.show_render=False
  if obj.type=='ARMATURE':
   obj.data.pose_position='REST'
   for bone in obj.pose.bones:
    for constraint in list(bone.constraints):bone.constraints.remove(constraint)
  bpy.context.scene.collection.objects.link(obj)
for ps in body.particle_systems:
 ps.settings.display_percentage=100;ps.settings.child_percent=0;ps.settings.rendered_child_count=0
 ps.settings.display_method='RENDER'
mods=[m for m in body.modifiers if m.type=='PARTICLE_SYSTEM']
full='--full' in sys.argv
rows=[]
for i in (range(len(mods)) if full else [1,2]):
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
 body.particle_systems.active_index=i;mod=mods[i];mod.show_viewport=True
 system=body.particle_systems[i];long=system.name in ('neck hair','tail')
 system.settings.child_percent=(20 if system.name=='neck hair' else 60 if system.name=='tail' else 0) if full else 0
 system.settings.display_step=4 if long and full else 2
 bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 before=set(bpy.context.scene.objects)
 result=bpy.ops.object.modifier_convert(modifier=mod.name)
 converted=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH']
 if result!={'FINISHED'} or len(converted)!=1:raise RuntimeError('Native source path conversion failed')
 obj=converted[0];p=np.array([obj.matrix_world@v.co for v in obj.data.vertices],dtype=np.float32)
 if len(p)>4_000_000:raise RuntimeError('Per-system groom point budget exceeded')
 edges=np.array([tuple(e.vertices) for e in obj.data.edges],dtype=np.int32)
 filename=body.particle_systems[i].name.strip().replace(' ','-')+('-source-native-paths.npz' if full else '-source-parent-paths.npz')
 np.savez_compressed(helper.OUT/filename,points=p,edges=edges)
 rows.append({'name':system.name.strip(),'vertices':len(p),'edges':len(edges),'min':p.min(0).tolist() if len(p) else None,'max':p.max(0).tolist() if len(p) else None,'file':filename,'pointsPerPath':(1<<system.settings.display_step)+1,'sourceChildrenConverted':system.settings.child_percent,'sourceRadiusScale':system.settings.radius_scale,'rootRadius':system.settings.root_radius,'tipRadius':system.settings.tip_radius,'originalRenderChildren':report['objects'][next(j for j,o in enumerate(report['objects']) if o['name']=='body.001')]['particleSystems'][i]['renderChildren']})
 bpy.data.objects.remove(obj,do_unlink=True);mod.show_viewport=False
(helper.OUT/('native-groom-extraction.json' if full else 'native-groom-probe.json')).write_text(json.dumps({'rows':rows,'sourceScriptsExecuted':False,'externalAlembicRead':False,'sourceBodyChildrenModifiedOnlyInMemory':True},indent=2)+'\n')
print(json.dumps({'groomProbe':rows}))
