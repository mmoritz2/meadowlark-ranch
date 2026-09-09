"""Give a Hunyuan/trimesh GLB an explicit nonmetallic coat material.

trimesh's SimpleMaterial conversion omits metallicFactor; glTF defaults that
missing value to 1. Geometry, UVs and embedded texture bytes stay unchanged.
"""
import argparse
import json
import pathlib
import struct


def normalize(source, destination):
    data = pathlib.Path(source).read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError('Expected a valid glTF 2 binary')
    chunks = []
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from('<II', data, offset)
        body = data[offset+8:offset+8+size]
        if kind == 0x4E4F534A:
            document = json.loads(body)
            for material in document.get('materials', []):
                pbr = material.setdefault('pbrMetallicRoughness', {})
                pbr.update(metallicFactor=0, roughnessFactor=.68)
            body = json.dumps(document, separators=(',', ':')).encode()
            body += b' ' * (-len(body) % 4)
        chunks.append(struct.pack('<II', len(body), kind) + body)
        offset += 8 + size
    result = b''.join(chunks)
    pathlib.Path(destination).write_bytes(struct.pack('<III', magic, version, 12+len(result))+result)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    normalize(args.source, args.destination)
