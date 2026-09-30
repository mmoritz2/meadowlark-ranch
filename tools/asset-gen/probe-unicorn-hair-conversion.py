"""Probe legacy strand export on an in-memory copy of the registered unicorn."""
import importlib.util
import json
from pathlib import Path
import sys

import bpy

ROOT = Path(__file__).resolve().parents[2]


def main():
    if not {'--factory-startup', '--disable-autoexec'} <= set(sys.argv):
        raise RuntimeError('Required trusted launch flags missing')
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('owned_unicorn_append', Path(__file__).with_name('prepare-unicorn-review.py'))
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    helper.safe_append()
    scene = bpy.context.scene
    body = bpy.data.objects['kon']
    arm = bpy.data.objects['horse_Armature']
    arm.data.pose_position = 'REST'
    flags = []
    for m in body.modifiers:
        flags.append({'name': m.name, 'type': m.type, 'showViewport': m.show_viewport, 'showRender': m.show_render})
        if m.type == 'MULTIRES':
            m.levels = 1
            m.render_levels = 1
        if m.type == 'PARTICLE_SYSTEM':
            m.show_viewport = True
    for ps in body.particle_systems:
        ps.settings.display_percentage = 100
        ps.settings.display_method = 'RENDER'
        ps.settings.child_percent = min(ps.settings.child_percent, 5)
    scene.frame_set(1)
    bpy.context.view_layer.update()
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    probes = []
    for original, ps in zip(body.particle_systems, evaluated.particle_systems):
        row = {'name': ps.name, 'originalParentCount': len(original.particles),
               'evaluatedParentCount': len(ps.particles), 'coHairMethodAvailable': hasattr(ps, 'co_hair')}
        if hasattr(ps, 'co_hair'):
            row['firstParentPath'] = [list(ps.co_hair(evaluated, particle_no=0, step=i)) for i in range(9)]
            row['secondParentPath'] = [list(ps.co_hair(evaluated, particle_no=1, step=i)) for i in range(9)]
        probes.append(row)
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    body.particle_systems.active_index = 0
    before = {o.name for o in scene.objects}
    operator = {'modifier': 'grzywamod'}
    try:
        operator['result'] = list(bpy.ops.object.modifier_convert(modifier='grzywamod'))
        operator['newObjects'] = [{'name': o.name, 'type': o.type,
            'matrixWorld': [list(row) for row in o.matrix_world],
            'vertices': len(o.data.vertices) if o.type == 'MESH' else None,
            'edges': len(o.data.edges) if o.type == 'MESH' else None,
            'bounds': [list(v) for v in o.bound_box]} for o in scene.objects if o.name not in before]
    except RuntimeError as error:
        operator['failure'] = str(error)
    out = ROOT / 'assets/models/horse-imports/ikkiz-unicorn/game/hair-conversion-probe.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    assert helper.sha256(helper.SOURCE) == helper.EXPECTED_BLEND_HASH
    out.write_text(json.dumps({'schemaVersion': 1, 'status': 'probe-only',
        'sourceBlendUnchanged': True, 'sourcePoseOverride': 'REST in memory only',
        'scriptsExecuted': False, 'originalModifierFlags': flags,
        'bodyRestBoundsWorld': {'min': [min((evaluated.matrix_world @ v.co)[i] for v in evaluated.data.vertices) for i in range(3)],
                                'max': [max((evaluated.matrix_world @ v.co)[i] for v in evaluated.data.vertices) for i in range(3)]},
        'sourceBoneHeadsWorld': {b.name: list(arm.matrix_world @ b.head_local) for b in arm.data.bones},
        'strandApiProbes': probes, 'conversionOperator': operator}, indent=2) + '\n')
    print(json.dumps({'report': str(out), 'conversionOperator': operator}))


if __name__ == '__main__':
    main()
