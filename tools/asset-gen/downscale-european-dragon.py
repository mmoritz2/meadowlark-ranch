#!/usr/bin/env python3
"""Make an isolated 2K texture derivative of the original European Dragon GLB.

Geometry, skin, animation accessors, and every JSON field other than buffer
offsets/lengths and derivative metadata are retained. The creator GLB is read
only and its expected SHA-256 is checked before any output is written.
"""

from __future__ import annotations

import hashlib
import io
import json
import copy
from pathlib import Path
import struct

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ORIGINAL = ROOT / "assets/models/horse-imports/european-dragon/source/european_dragon.glb"
DERIVATIVE = ROOT / "assets/models/horse-imports/european-dragon/work/european-dragon-2k.glb"
REPORT = ROOT / "output/european-dragon-2k-report.json"
ORIGINAL_SHA = "27571241712334db4f05d65623ad627024d57730554a74b7902029c9c95fd5f5"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def align4(data: bytearray, pad: int = 0) -> None:
    data.extend(bytes([pad]) * (-len(data) % 4))


def main() -> None:
    source = ORIGINAL.read_bytes()
    actual_sha = hashlib.sha256(source).hexdigest()
    if actual_sha != ORIGINAL_SHA:
        raise SystemExit(f"Original SHA changed: {actual_sha}")
    magic, version, total = struct.unpack_from("<4sII", source, 0)
    if (magic, version, total) != (b"glTF", 2, len(source)):
        raise SystemExit("Not the expected GLB 2.0 file")
    json_len, json_type = struct.unpack_from("<II", source, 12)
    bin_offset = 20 + json_len
    bin_len, bin_type = struct.unpack_from("<II", source, bin_offset)
    if json_type != JSON_CHUNK or bin_type != BIN_CHUNK or bin_offset + 8 + bin_len != len(source):
        raise SystemExit("Unexpected GLB chunk layout")
    document = json.loads(source[20:bin_offset])
    source_document = copy.deepcopy(document)
    if len(document["buffers"]) != 1 or len(document["images"]) != 6:
        raise SystemExit("Unexpected buffer or image count")
    original_bin = memoryview(source)[bin_offset + 8 : bin_offset + 8 + bin_len]
    image_views = {image["bufferView"]: index for index, image in enumerate(document["images"])}
    output_bin = bytearray()
    image_report = []

    for index, view in enumerate(document["bufferViews"]):
        start, length = view.get("byteOffset", 0), view["byteLength"]
        payload = bytes(original_bin[start : start + length])
        if len(payload) != length:
            raise SystemExit(f"Buffer view {index} exceeds original BIN chunk")
        if index in image_views:
            image_index = image_views[index]
            image = Image.open(io.BytesIO(payload))
            if image.size != (4096, 4096):
                raise SystemExit(f"Image {image_index} is not 4K: {image.size}")
            # Palette PNGs have no alpha/transparency; expand before Lanczos.
            if image.mode == "P":
                image = image.convert("RGB")
            resized = image.resize((2048, 2048), Image.Resampling.LANCZOS)
            encoded = io.BytesIO()
            resized.save(encoded, format="PNG", optimize=True)
            payload = encoded.getvalue()
            image_report.append({"index": image_index, "size": [2048, 2048], "mode": resized.mode,
                                 "sourceBytes": length, "derivativeBytes": len(payload)})
        align4(output_bin)
        view["byteOffset"] = len(output_bin)
        view["byteLength"] = len(payload)
        output_bin.extend(payload)

    document["buffers"][0]["byteLength"] = len(output_bin)
    document.setdefault("asset", {}).setdefault("extras", {})["derivative"] = {
        "sourceSha256": ORIGINAL_SHA,
        "method": "Six 4096x4096 embedded PNGs resampled to 2048x2048 with Pillow Lanczos",
        "geometrySkinAnimations": "unchanged",
    }
    json_bytes = bytearray(json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    align4(json_bytes, 0x20)
    align4(output_bin)
    total_length = 12 + 8 + len(json_bytes) + 8 + len(output_bin)
    glb = bytearray(struct.pack("<4sII", b"glTF", 2, total_length))
    glb.extend(struct.pack("<II", len(json_bytes), JSON_CHUNK))
    glb.extend(json_bytes)
    glb.extend(struct.pack("<II", len(output_bin), BIN_CHUNK))
    glb.extend(output_bin)
    DERIVATIVE.parent.mkdir(parents=True, exist_ok=True)
    DERIVATIVE.write_bytes(glb)
    # Check the generated file, not just the in-memory construction. In
    # particular, all non-image buffer view payloads must be byte-for-byte
    # identical, including the skinned vertex data and animation accessors.
    generated = DERIVATIVE.read_bytes()
    assert len(generated) == total_length
    written_json_len, written_json_type = struct.unpack_from("<II", generated, 12)
    assert written_json_type == JSON_CHUNK
    written_document = json.loads(generated[20 : 20 + written_json_len])
    written_bin_offset = 20 + written_json_len + 8
    written_bin_len, written_bin_type = struct.unpack_from("<II", generated, written_bin_offset - 8)
    assert written_bin_type == BIN_CHUNK
    written_bin = memoryview(generated)[written_bin_offset : written_bin_offset + written_bin_len]
    for key in ("nodes", "meshes", "skins", "animations", "accessors", "materials", "textures", "samplers", "scenes", "scene"):
        assert source_document.get(key) == written_document.get(key), f"Changed GLTF {key}"
    for index, original_view in enumerate(source_document["bufferViews"]):
        if index in image_views:
            continue
        new_view = written_document["bufferViews"][index]
        old_bytes = original_bin[original_view.get("byteOffset", 0) : original_view.get("byteOffset", 0) + original_view["byteLength"]]
        new_bytes = written_bin[new_view.get("byteOffset", 0) : new_view.get("byteOffset", 0) + new_view["byteLength"]]
        assert old_bytes == new_bytes, f"Changed non-image buffer view {index}"
    report = {
        "original": str(ORIGINAL.relative_to(ROOT)), "originalSha256": actual_sha,
        "originalBytes": len(source), "derivative": str(DERIVATIVE.relative_to(ROOT)),
        "derivativeSha256": hashlib.sha256(glb).hexdigest(), "derivativeBytes": len(glb),
        "imageReport": sorted(image_report, key=lambda value: value["index"]),
        "geometrySkinAnimationPayloadsIdentical": True,
        "sourceUnchanged": hashlib.sha256(ORIGINAL.read_bytes()).hexdigest() == ORIGINAL_SHA,
        "status": "isolated comparison derivative only; not public",
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
