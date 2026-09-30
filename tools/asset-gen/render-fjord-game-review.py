"""Ordinary render of exact site Three-deformed Fjord review geometry.

Launch verified Blender --background --factory-startup --disable-autoexec
--python tools/asset-gen/render-fjord-game-review.py -- Rest,Walk,Gallop_Left,Jump
No embedded source Python, imported actions, AI imagery or source mutation.
"""
from pathlib import Path
import hashlib
import json
import sys
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/fjord-sculpt'


def main():
    if not {'--factory-startup','--disable-autoexec'}<=set(sys.argv):raise RuntimeError('Safe factory/autoexec flags required')
    data=json.loads((BASE/'game/actual-deformed-review-poses.json').read_text());profile=json.loads((BASE/'game/profile.json').read_text())
    animated=BASE/'game'/profile['file'];sha=hashlib.sha256(animated.read_bytes()).hexdigest();assert sha==profile['sha256']==data['animatedSha256']
    requested=set(sys.argv[sys.argv.index('--')+1].split(',')) if '--' in sys.argv else {'Rest','Walk','Gallop_Left','Jump'}
    out=BASE/'game/review';out.mkdir(exist_ok=True);reports=[]
    for pose in data['poses']:
        if pose['name'] not in requested:continue
        file=ROOT/pose['file'];assert file.resolve().is_relative_to((BASE/'work/poses').resolve());assert hashlib.sha256(file.read_bytes()).hexdigest()==pose['sha256']
        for label,direction in [('quarter',(-1.5,-2.4,.85)),('side',(-3,0,.25))] if pose['name']=='Rest' else [('side',(-3,0,.25))]:
            bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.use_scripts_auto_execute=False
            bpy.ops.import_scene.gltf(filepath=str(file),import_pack_images=True);assert not bpy.data.texts
            meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update()
            points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)*.5;size=max(hi-lo)
            scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
            scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
            scene.world=bpy.data.worlds.new('View-only studio');scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background'];bg.inputs['Color'].default_value=(.17,.18,.21,1);bg.inputs['Strength'].default_value=.6
            def aim(obj):obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
            for name,position,energy in [('Key',(-3,-4,6),55),('Fill',(4,-1,4),32),('Rim',(0,4,5),45)]:
                light_data=bpy.data.lights.new('View only '+name,'AREA');light_data.energy=energy*size*size;light_data.size=size*1.6;light=bpy.data.objects.new(light_data.name,light_data);scene.collection.objects.link(light);light.location=center+Vector(position)*size/3;aim(light)
            camera_data=bpy.data.cameras.new('View only '+label);camera=bpy.data.objects.new(camera_data.name,camera_data);scene.collection.objects.link(camera);camera.location=center+Vector(direction).normalized()*size*3;aim(camera);camera_data.type='ORTHO';scene.camera=camera
            bpy.context.view_layer.update();inv=camera.matrix_world.inverted();corners=[inv@Vector((x,y,z)) for x in [lo.x,hi.x] for y in [lo.y,hi.y] for z in [lo.z,hi.z]];aspect=1200/900;camera_data.ortho_scale=max(max(p.x for p in corners)-min(p.x for p in corners),(max(p.y for p in corners)-min(p.y for p in corners))*aspect)*1.13
            bpy.ops.mesh.primitive_plane_add(size=size*10,location=(0,0,-.008));floor=bpy.context.object;mat=bpy.data.materials.new('View only floor');mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.10,.12,.15,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.94;floor.data.materials.append(mat)
            png=out/(pose['name'].lower()+'-'+label+'.png');scene.render.filepath=str(png);bpy.ops.render.render(write_still=True)
            reports.append({'clip':pose['name'],'time':pose['time'],'view':label,'image':str(png.relative_to(ROOT)),'imageSha256':hashlib.sha256(png.read_bytes()).hexdigest(),'actualThreeDeformed':True,'boundsBlender':{'min':list(lo),'max':list(hi)}})
            print(json.dumps(reports[-1]),flush=True)
    assert hashlib.sha256(animated.read_bytes()).hexdigest()==sha
    report={'animatedSha256':sha,'poseMethod':data['method'],'ordinaryBlenderCyclesCPU':True,'generativeToolsUsed':False,'noImportedBonePoseAssumptions':True,'newPaintedSourceShape':True,'renderOnlyChanges':['camera','studio lighting','floor'],'animatedModelPreserved':True,'renders':reports,'visualReview':'pending actual PNG inspection'}
    (out/'render-report.json').write_text(json.dumps(report,indent=2)+'\n')


if __name__=='__main__':main()
