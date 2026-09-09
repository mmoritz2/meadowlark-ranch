"""Surface diagnostics after welding glTF UV/material seams by position.

Closed eyes/ear details can be separate components; this reports topology rather
than asserting that every horse should consist of a single closed surface.
"""
import importlib.util
import json
from collections import Counter
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('breed_validator', Path(__file__).with_name('validate-breed-assets.py'))
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def inspect(path):
    glb = validator.GLB(path)
    ids, vertices, edges, parent, faces = {}, [], Counter(), [], []
    def welded(point):
        key = tuple(round(c, 6) for c in point)
        if key not in ids:
            ids[key] = len(vertices)
            parent.append(len(vertices))
            vertices.append(point)
        return ids[key]
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for mesh in glb.doc['meshes']:
        for prim in mesh['primitives']:
            positions = glb.accessor(prim['attributes']['POSITION'])
            mapping = [welded(p) for p in positions]
            indices = [v[0] for v in glb.accessor(prim['indices'])]
            for i in range(0, len(indices), 3):
                triangle = [mapping[j] for j in indices[i:i+3]]
                if len(set(triangle)) < 3:
                    continue
                faces.append(triangle)
                for a, b in zip(triangle, triangle[1:] + triangle[:1]):
                    edges[tuple(sorted((a, b)))] += 1
                    parent[root(a)] = root(b)
    groups = {}
    for i, p in enumerate(vertices):
        groups.setdefault(root(i), []).append(p)
    component_edges = {i: Counter() for i in groups}
    for (a, b), count in edges.items():
        component_edges[root(a)][count] += 1
    components = sorted(groups.items(), key=lambda item: len(item[1]), reverse=True)
    return {'file': str(path), 'weldedVertices': len(vertices), 'triangles': len(faces),
            'boundaryEdges': sum(n == 1 for n in edges.values()),
            'nonmanifoldEdges': sum(n > 2 for n in edges.values()),
            'components': [{'vertices': len(c), 'min': [min(p[k] for p in c) for k in range(3)],
                            'max': [max(p[k] for p in c) for k in range(3)],
                            'boundaryEdges': component_edges[i][1],
                            'nonmanifoldEdges': sum(n for count, n in component_edges[i].items() if count > 2)} for i, c in components[:16]],
            'componentCount': len(components)}

if __name__ == '__main__':
    print(json.dumps([inspect(Path(p)) for p in sys.argv[1:]], indent=2))
