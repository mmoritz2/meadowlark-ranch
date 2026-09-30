#!/usr/bin/env python3
"""Build a smaller, native-rig black-dragon review candidate from the creator GLB.

Only embedded 4096px images are resized to 2048px. Every non-image buffer view,
mesh, skin, animation, and material configuration is copied unchanged. The
creator original remains ignored and byte-for-byte untouched.
"""

from __future__ import annotations

import copy
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ORIGINAL = ROOT / "assets/models/horse-imports/black-dragon/source/black_dragon_with_idle_animation.glb"
DERIVATIVE = ROOT / "assets/models/horse-imports/black-dragon/work/black-dragon-native-2k.glb"
CANDIDATE = ROOT / "assets/models/horse-imports/black-dragon/game/black-dragon-native-2k-candidate.glb"
REPORT = ROOT / "output/black-dragon-native-2k-report.json"
ORIGINAL_SHA = "3abf7ed79e40406236d8b0e365f4690174daf8cfec39b32bfb2ab3ba48d5a1e7"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def align4(data: bytearray, pad: int = 0) -> None:
    data.extend(bytes([pad]) * (-len(data) % 4))


def read_glb(content: bytes):
    magic, version, total = struct.unpack_from("<4sII", content)
    if (magic, version, total) != (b"glTF", 2, len(content)):
        raise ValueError("Unexpected GLB header")
    json_length, json_type = struct.unpack_from("<II", content, 12)
    bin_header = 20 + json_length
    bin_length, bin_type = struct.unpack_from("<II", content, bin_header)
    if json_type != JSON_CHUNK or bin_type != BIN_CHUNK or bin_header + 8 + bin_length != len(content):
        raise ValueError("Unexpected GLB chunks")
    return json.loads(content[20:bin_header]), memoryview(content)[bin_header + 8:bin_header + 8 + bin_length]


def main() -> None:
    source = ORIGINAL.read_bytes()
    source_sha = hashlib.sha256(source).hexdigest()
    if source_sha != ORIGINAL_SHA:
        raise SystemExit(f"Creator source changed: {source_sha}")
    document, source_bin = read_glb(source)
    original_document = copy.deepcopy(document)
    if len(document["buffers"]) != 1 or len(document["images"]) != 9 or len(document["skins"][0]["joints"]) != 232:
        raise SystemExit("Unexpected black-dragon structure")
    if [clip["name"] for clip in document["animations"]] != ["Scene"]:
        raise SystemExit("Expected sole creator Scene idle clip")
    image_views = {image["bufferView"]: index for index, image in enumerate(document["images"])}
    output_bin = bytearray()
    image_report = []

    for index, view in enumerate(document["bufferViews"]):
        start, length = view.get("byteOffset", 0), view["byteLength"]
        payload = bytes(source_bin[start:start + length])
        if len(payload) != length:
            raise SystemExit(f"Source buffer view {index} out of range")
        if index in image_views:
            image_index = image_views[index]
            image = Image.open(io.BytesIO(payload))
            original_size = image.size
            if max(image.size) > 2048:
                if image.size != (4096, 4096):
                    raise SystemExit(f"Unexpected texture size {image_index}: {image.size}")
                if image.mode == "P":
                    image = image.convert("RGB")
                image = image.resize((2048, 2048), Image.Resampling.LANCZOS)
                encoded = io.BytesIO()
                if document["images"][image_index]["mimeType"] == "image/jpeg":
                    image.convert("RGB").save(encoded, format="JPEG", quality=92, subsampling=0, optimize=True)
                else:
                    image.save(encoded, format="PNG", optimize=True)
                payload = encoded.getvalue()
            image_report.append({"index": image_index, "sourceSize": list(original_size),
                                 "candidateSize": list(image.size), "sourceBytes": length,
                                 "candidateBytes": len(payload), "mimeType": document["images"][image_index]["mimeType"]})
        align4(output_bin)
        view["byteOffset"] = len(output_bin)
        view["byteLength"] = len(payload)
        output_bin.extend(payload)

    document["buffers"][0]["byteLength"] = len(output_bin)
    document.setdefault("asset", {}).setdefault("extras", {})["derivative"] = {
        "sourceSha256": ORIGINAL_SHA,
        "method": "Six 4096x4096 embedded images resized to 2048x2048 with Pillow Lanczos; other three 2K images unchanged",
        "geometrySkinAnimations": "unchanged",
    }
    json_bytes = bytearray(json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    align4(json_bytes, 0x20)
    align4(output_bin)
    glb = bytearray(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(json_bytes) + 8 + len(output_bin)))
    glb.extend(struct.pack("<II", len(json_bytes), JSON_CHUNK))
    glb.extend(json_bytes)
    glb.extend(struct.pack("<II", len(output_bin), BIN_CHUNK))
    glb.extend(output_bin)
    DERIVATIVE.parent.mkdir(parents=True, exist_ok=True)
    DERIVATIVE.write_bytes(glb)

    saved_document, saved_bin = read_glb(DERIVATIVE.read_bytes())
    for key in ("nodes", "meshes", "skins", "animations", "accessors", "materials", "textures", "samplers", "scenes", "scene"):
        assert original_document.get(key) == saved_document.get(key), f"Changed GLTF {key}"
    for index, original_view in enumerate(original_document["bufferViews"]):
        if index in image_views:
            continue
        new_view = saved_document["bufferViews"][index]
        old_bytes = source_bin[original_view.get("byteOffset", 0):original_view.get("byteOffset", 0) + original_view["byteLength"]]
        new_bytes = saved_bin[new_view.get("byteOffset", 0):new_view.get("byteOffset", 0) + new_view["byteLength"]]
        assert old_bytes == new_bytes, f"Changed non-image buffer view {index}"
    assert hashlib.sha256(ORIGINAL.read_bytes()).hexdigest() == ORIGINAL_SHA

    CANDIDATE.parent.mkdir(parents=True, exist_ok=True)
    CANDIDATE.write_bytes(glb)
    candidate_sha = hashlib.sha256(glb).hexdigest()
    report = {"source": str(ORIGINAL.relative_to(ROOT)), "sourceSha256": source_sha,
              "sourceBytes": len(source), "candidate": str(CANDIDATE.relative_to(ROOT)),
              "candidateSha256": candidate_sha, "candidateBytes": len(glb),
              "joints": 232, "nativeClips": ["Scene"], "geometrySkinAnimationPayloadsIdentical": True,
              "sourceUnchanged": True, "images": sorted(image_report, key=lambda item: item["index"]),
              "status": "Tracked local review candidate only; not connected to ranch roster"}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
