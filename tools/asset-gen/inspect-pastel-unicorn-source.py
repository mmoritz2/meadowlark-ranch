"""Inspect approved pastel source data with verified Blender and autoexec off.

Only source Object data is appended. No source Scene, Text or WindowManager is
loaded. Source actions/drivers are disabled before linking/evaluation. The first
pass reads cached transforms, weights and cache references without evaluating
the multi-gigabyte Alembic groom. Original files remain read-only.
"""
from pathlib import Path
import hashlib, json, sys
import bpy
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/pastel-unicorn'
SOURCE=BASE/'work/extracted/blend/unicorn.blend'
OUT=BASE/'work/source-inspection'

def vec(value):return [float(x) for x in value]
def main():
 if not {'--factory-startup','--disable-autoexec'}<=set(sys.argv):raise RuntimeError('Factory startup and disabled autoexec required')
 OUT.mkdir(parents=True,exist_ok=True)
 before=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.context.preferences.filepaths.use_scripts_auto_execute=False
 with bpy.data.libraries.load(str(SOURCE),link=False) as (source,data):data.objects=list(source.objects)
 removed=[]
 for collection in [bpy.data.objects,bpy.data.meshes,bpy.data.curves,bpy.data.armatures,bpy.data.materials,bpy.data.node_groups,bpy.data.shape_keys]:
  for block in collection:
   ad=getattr(block,'animation_data',None)
   if ad:
    for driver in list(ad.drivers):removed.append({'block':block.name,'path':driver.data_path});ad.drivers.remove(driver)
    block.animation_data_clear()
   tree=getattr(block,'node_tree',None)
   if tree and tree.animation_data:tree.animation_data_clear()
 objects=[]
 for obj in data.objects:
  if obj is None:continue
  row={'name':obj.name,'type':obj.type,'worldMatrix':[list(r) for r in obj.matrix_world],'parent':obj.parent.name if obj.parent else None,'modifiers':[]}
  for mod in obj.modifiers:
   item={'name':mod.name,'type':mod.type,'viewport':mod.show_viewport,'render':mod.show_render}
   for name in ('object_path','filepath'):
    if hasattr(mod,name):item[name]=str(getattr(mod,name))
   cache=getattr(mod,'cache_file',None)
   if cache:item['cacheFile']={'name':cache.name,'filepath':cache.filepath,'frame':cache.frame,'overrideFrame':cache.override_frame}
   target=getattr(mod,'object',None)
   if target:item['object']=target.name
   row['modifiers'].append(item)
  if obj.type=='MESH':
   row.update(vertices=len(obj.data.vertices),polygons=len(obj.data.polygons),materials=[m.name if m else None for m in obj.data.materials],vertexGroups=[g.name for g in obj.vertex_groups])
   points=np.array([obj.matrix_world@v.co for v in obj.data.vertices],dtype=np.float32)
   row['worldBounds']={'min':points.min(0).tolist(),'max':points.max(0).tolist()}
   weights=np.zeros((len(points),len(obj.vertex_groups)),dtype=np.float32)
   for vertex in obj.data.vertices:
    for group in vertex.groups:weights[vertex.index,group.group]=group.weight
   row['weightedVertices']=int(np.count_nonzero(weights.sum(1)))
   row['maxWeightSumError']=float(np.max(abs(weights.sum(1)-1))) if row['weightedVertices'] else None
   filename=''.join(c if c.isalnum() else '_' for c in obj.name)+'.npz'
   np.savez_compressed(OUT/filename,points=points,weights=weights,groupNames=np.array(row['vertexGroups']))
   row['numericInspection']=filename
   row['particleSystems']=[]
   for ps in obj.particle_systems:
    s=ps.settings
    row['particleSystems'].append({'name':ps.name,'type':s.type,'count':s.count,'parentParticlesStored':len(ps.particles),'hairStep':s.hair_step,'hairLength':s.hair_length,'displayChildren':s.child_percent,'renderChildren':s.rendered_child_count,'childType':s.child_type,'materialSlot':s.material,'rootRadius':s.root_radius,'tipRadius':s.tip_radius,'radiusScale':s.radius_scale,'vertexGroupDensity':ps.vertex_group_density,'vertexGroupLength':ps.vertex_group_length,'firstStoredHairKeys':[vec(k.co) for k in ps.particles[0].hair_keys] if len(ps.particles) else []})
  if obj.type=='ARMATURE':row['bones']=[{'name':bone.name,'parent':bone.parent.name if bone.parent else None,'headWorld':vec(obj.matrix_world@bone.head_local),'tailWorld':vec(obj.matrix_world@bone.tail_local),'deform':bone.use_deform} for bone in obj.data.bones]
  if obj.type in ('CURVE','CURVES'):
   row['splines']=len(getattr(obj.data,'splines',[]));row['curves']=len(getattr(obj.data,'curves',[]));row['materials']=[m.name if m else None for m in obj.data.materials]
  objects.append(row)
 caches=[{'name':cache.name,'filepath':cache.filepath,'frame':cache.frame,'overrideFrame':cache.override_frame} for cache in bpy.data.cache_files]
 images=[{'name':image.name,'filepath':image.filepath,'packed':bool(image.packed_file),'size':list(image.size)} for image in bpy.data.images]
 report={'sourceBlendSha256':before,'originalUnchanged':hashlib.sha256(SOURCE.read_bytes()).hexdigest()==before,'blenderVersion':bpy.app.version_string,'scriptsExecuted':False,'sourceScenesTextsWindowManagersAppended':False,'cacheEvaluationRequested':False,'removedDrivers':removed,'objects':objects,'cacheFiles':caches,'images':images}
 (OUT/'source-blend-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'objects':[{k:r[k] for k in ('name','type','vertices','weightedVertices','vertexGroups','particleSystems','modifiers') if k in r} for r in objects],'cacheFiles':caches,'removedDrivers':len(removed),'report':str(OUT/'source-blend-inspection.json')}))
 return report,data.objects
if __name__=='__main__':main()
