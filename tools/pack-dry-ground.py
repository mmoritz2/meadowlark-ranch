#!/usr/bin/env python3
"""Verify and pack the CC0 Sandy Gravel 02 terrain material.

Usage: python3 pack-dry-ground.py --source SOURCE_DIRECTORY --output OUTPUT_DIRECTORY
Requires Pillow 11.3.0 for byte-identical reference PNG output.
No resampling, recolouring, normal conversion, or creative raster editing occurs.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path

import PIL
from PIL import Image


ASSET = "sandy_gravel_02"
PACKED_NAME = f"{ASSET}_surface.png"
REFERENCE_PILLOW = "11.3.0"
REFERENCE_PACKED_SHA256 = "cac5bb2661e77895ff2b8f6c8f4c40022c62ca8606b61d786d48b1b8f5b38105"
SOURCE_MAPS = (
    {
        "role": "diffuse",
        "file": f"{ASSET}_diff_1k.jpg",
        "bytes": 947222,
        "sha256": "c9d143db07db9a6be2eba285fae961d868520422ee5fa4d38d55da24f9968d51",
        "official_md5": "e8f0496f1e0e923514470171de033bf9",
    },
    {
        "role": "normal_opengl",
        "file": f"{ASSET}_nor_gl_1k.jpg",
        "bytes": 1185078,
        "sha256": "36db1d118fb74885991ada4a3028f4fe346c65a8e3c75edea123c08856068e41",
        "official_md5": "a0174cc069d02b825b546d8547b4a49a",
    },
    {
        "role": "arm",
        "file": f"{ASSET}_arm_1k.jpg",
        "bytes": 820610,
        "sha256": "c10a20b5736bf1785f12f1c6744d80450b98bf0ea8cb7128acb78df39688838f",
        "official_md5": "1fef9778c9be98b81bb30a69437ec1da",
    },
)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build(source, output):
    """Write diffuse, packed surface, and manifest after validating every input."""
    if PIL.__version__ != REFERENCE_PILLOW:
        raise ValueError(
            f"Use Pillow {REFERENCE_PILLOW} for the recorded byte-identical PNG; "
            f"found {PIL.__version__}."
        )

    decoded = {}
    source_bytes = {}
    for entry in SOURCE_MAPS:
        raw = (source / entry["file"]).read_bytes()
        if len(raw) != entry["bytes"] or sha256(raw) != entry["sha256"]:
            raise ValueError(f"Source size/SHA256 mismatch: {entry['file']}")
        if hashlib.md5(raw).hexdigest() != entry["official_md5"]:
            raise ValueError(f"Official source MD5 mismatch: {entry['file']}")
        with Image.open(io.BytesIO(raw)) as image:
            if image.size != (1024, 1024) or image.mode != "RGB" or image.format != "JPEG":
                raise ValueError(f"Unexpected source image format: {entry['file']}")
            decoded[entry["role"]] = image.copy()
        source_bytes[entry["role"]] = raw

    normal = decoded["normal_opengl"]
    arm = decoded["arm"]
    # Preserve decoded bytes: XY normal, roughness, then occlusion.
    expected_channels = (
        normal.getchannel("R"), normal.getchannel("G"),
        arm.getchannel("G"), arm.getchannel("R"),
    )
    packed = Image.merge("RGBA", expected_channels)
    encoded = io.BytesIO()
    packed.save(encoded, format="PNG", optimize=True, compress_level=9)
    packed_bytes = encoded.getvalue()
    if sha256(packed_bytes) != REFERENCE_PACKED_SHA256:
        raise ValueError("Packed PNG differs from the reference encoder output; nothing written.")
    with Image.open(io.BytesIO(packed_bytes)) as restored:
        if any(actual.tobytes() != expected.tobytes()
               for actual, expected in zip(restored.split(), expected_channels)):
            raise ValueError("Packed PNG channel round-trip failed; nothing written.")

    manifest = {
        "asset": ASSET,
        "title": "Sandy Gravel 02",
        "author": "Dario Barresi",
        "provider": "Poly Haven",
        "asset_url": f"https://polyhaven.com/a/{ASSET}",
        "license": {
            "identifier": "CC0-1.0",
            "provider_url": "https://polyhaven.com/license",
            "legal_url": "https://creativecommons.org/publicdomain/zero/1.0/",
            "verified_date": "2026-10-08",
            "scope": "Official downloadable texture maps; excludes website example renders.",
        },
        "physical_tile_metres": [2.53, 2.53],
        "physical_scale_provenance": {
            "info_url": f"https://api.polyhaven.com/info/{ASSET}",
            "dimensions_mm": [2529.9999713897705, 2529.9999713897705],
            "displayed_width_metres": 2.5,
            "units_schema_url": "https://raw.githubusercontent.com/Poly-Haven/Public-API/master/swagger.yml",
            "units_schema_path": "components.schemas.texture.properties.dimensions",
        },
        "source_files": [
            {
                **entry,
                "url": f"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{ASSET}/{entry['file']}",
                "resolution": [1024, 1024],
                "included_at_runtime": entry["role"] == "diffuse",
            }
            for entry in SOURCE_MAPS
        ],
        "files_metadata_url": f"https://api.polyhaven.com/files/{ASSET}",
        "runtime_files": [
            {
                "file": SOURCE_MAPS[0]["file"],
                "role": "albedo",
                "format": "JPEG",
                "resolution": [1024, 1024],
                "bytes": len(source_bytes["diffuse"]),
                "sha256": sha256(source_bytes["diffuse"]),
                "color_space": "sRGB",
                "modifications": "None; exact official download bytes.",
            },
            {
                "file": PACKED_NAME,
                "role": "surface_properties",
                "format": "PNG RGBA8",
                "resolution": [1024, 1024],
                "bytes": len(packed_bytes),
                "sha256": sha256(packed_bytes),
                "color_space": "linear data / THREE.NoColorSpace",
                "channels": {
                    "R": "OpenGL normal X encoded in [0,1]; source normal R unchanged",
                    "G": "OpenGL normal Y encoded in [0,1]; source normal G unchanged",
                    "B": "Roughness in [0,1]; source ARM G unchanged",
                    "A": "Ambient occlusion in [0,1]; source ARM R unchanged",
                },
                "modifications": "Lossless channel packing of decoded JPEG bytes; no resize, colour adjustment, rotation or inversion.",
            },
        ],
        "runtime_texture_bytes": len(source_bytes["diffuse"]) + len(packed_bytes),
        "runtime_notes": [
            "Diffuse plus the packed PNG are the only runtime textures. Source normal/ARM JPGs are build inputs, not shipped duplicates.",
            "Alpha is occlusion data, not transparency; keep premultiplyAlpha=false.",
            "Metalness is fixed at zero; source ARM blue is not packed.",
            "Normal Z is omitted because this terrain shader consumes only XY relief. A full tangent-space normal consumer must reconstruct Z.",
            "Use identical world UVs and the same normal orientation transform for albedo and packed data.",
            "Shader exposure/tint and terrain blending are runtime art parameters; the stored albedo is unchanged.",
        ],
        "build": {
            "tool": "pack-dry-ground.py",
            "pillow": REFERENCE_PILLOW,
            "png_options": {"optimize": True, "compress_level": 9},
            "source_hash_checks": "SHA256, official MD5 and exact byte size for all three inputs",
            "packed_validation": "Reference SHA256 and byte-exact decoded RGBA channel round trip",
        },
    }

    # Validation finishes before creating or replacing any output.
    output.mkdir(parents=True, exist_ok=True)
    (output / SOURCE_MAPS[0]["file"]).write_bytes(source_bytes["diffuse"])
    (output / PACKED_NAME).write_bytes(packed_bytes)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Directory containing the three verified official 1K JPG maps")
    parser.add_argument("--output", type=Path, required=True, help="Directory for the two runtime textures and manifest.json")
    args = parser.parse_args()
    try:
        manifest = build(args.source, args.output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Dry-ground build failed: {error}\n")
    print(json.dumps({"output": str(args.output), "runtime_textures": len(manifest["runtime_files"]),
                      "runtime_texture_bytes": manifest["runtime_texture_bytes"],
                      "packed_sha256": manifest["runtime_files"][1]["sha256"]}, indent=2))


if __name__ == "__main__":
    main()
