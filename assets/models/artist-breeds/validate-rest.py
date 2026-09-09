"""Blender neutral skin-binding and separate-eye attachment verification."""
import bpy,pathlib,json,hashlib,numpy as np
out=pathlib.Path(__file__).resolve().parent
manifest=json.loads((out/'manifest.json').read_text());report=[]
for spec in manifest['breeds'].values():
 if spec.get('foundation'):continue
 key=spec['id'];bpy.ops.wm.open_mainfile(filepath=str(out/(key+'.blend')))
 rig=bpy.data.objects['HorseRig'];rig.animation_data.action=bpy.data.actions['Rest'];bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 row={'id':key,'jointCount':len(rig.data.bones),'meshes':[],'eyeAttachments':[]}
 for o in bpy.context.scene.objects:
  if o.type!='MESH' or o.parent!=rig:continue
  evaluated=o.evaluated_get(bpy.context.evaluated_depsgraph_get());p=np.empty((len(o.data.vertices),3));q=p.copy()
  o.data.vertices.foreach_get('co',p.ravel());evaluated.data.vertices.foreach_get('co',q.ravel())
  error=float(np.linalg.norm(q-p,axis=1).max());assert error<.00001,(key,o.name,error)
  row['meshes'].append({'name':o.name,'restMaxDeformationM':error,'finite':bool(np.isfinite(q).all())})
  if 'eye' in o.name.lower() or 'pupil' in o.name.lower():
   vg={g.index:g.name for g in o.vertex_groups};okay=all(len(v.groups)==1 and vg[v.groups[0].group]=='head' and abs(v.groups[0].weight-1)<1e-6 for v in o.data.vertices)
   assert okay,(key,o.name,'eye not rigid to head');row['eyeAttachments'].append({'name':o.name,'rigidToHead':okay})
 assert len(row['eyeAttachments'])==4,(key,row['eyeAttachments'])
 report.append(row)
approved=out.parent/'horse-candidates/b2przemo';approval=json.loads((approved/'APPROVAL.json').read_text())
assert hashlib.sha256((approved/approval['file']).read_bytes()).hexdigest()==approval['sha256']
result={'passed':True,'physicalModels':len(report),'approvedSourceUnchanged':True,'maxNeutralDeformationM':max(m['restMaxDeformationM'] for r in report for m in r['meshes']),'models':report}
(out/'rest-validation.json').write_text(json.dumps(result,indent=2));print('REST_VALIDATION',result['physicalModels'],result['maxNeutralDeformationM'])
