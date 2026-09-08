"""Turn the local ComfyUI source PNGs into small, repeatable game materials.

The base colors are balanced to the ranch's spring palette. The normal/roughness
maps are subtle deterministic detail estimates, not measured/scanned PBR data.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from gen_pastoral_materials import MATERIALS, OUTPUT

PALETTE = {
    "meadow": {"mean": [125, 152, 76], "contrast": 0.82, "roughness": 0.94, "normal": 1.15},
    "bridleway": {"mean": [184, 160, 124], "contrast": 0.84, "roughness": 0.93, "normal": 1.0},
    "arena": {"mean": [204, 190, 157], "contrast": 0.80, "roughness": 0.96, "normal": 0.70},
}


def periodic_surface(pixels):
    """Remove only the low-frequency boundary mismatch with a Poisson solve."""
    h, w = pixels.shape[:2]
    boundary = np.zeros_like(pixels)
    boundary[0] = pixels[-1] - pixels[0]
    boundary[-1] = -boundary[0]
    jump = pixels[:, -1] - pixels[:, 0]
    boundary[:, 0] += jump
    boundary[:, -1] -= jump
    fy = np.arange(h)[:, None] * 2 * np.pi / h
    fx = np.arange(w)[None, :] * 2 * np.pi / w
    denominator = 2 * np.cos(fx) + 2 * np.cos(fy) - 4
    denominator[0, 0] = 1
    smooth_fft = np.fft.fft2(boundary, axes=(0, 1)) / denominator[:, :, None]
    smooth_fft[0, 0] = 0
    return pixels - np.fft.ifft2(smooth_fft, axes=(0, 1)).real


def as_image(pixels):
    return Image.fromarray(np.clip(np.rint(pixels), 0, 255).astype(np.uint8))


def finish_material(name, palette):
    source = OUTPUT / "source" / f"{name}_albedo.png"
    original = np.asarray(Image.open(source).convert("RGB"), dtype=np.float64)
    balanced = periodic_surface(original)
    centered = (balanced - balanced.mean(axis=(0, 1))) * palette["contrast"]
    rgb = np.clip(centered + np.asarray(palette["mean"]), 0, 255)
    albedo = as_image(rgb)
    albedo.save(OUTPUT / f"{name}_albedo.jpg", quality=91, subsampling=0, optimize=True)

    # Smooth the largest color variations out of this conservative detail estimate.
    gray = np.asarray(albedo.convert("L"), dtype=np.float64) / 255
    blur = np.asarray(albedo.convert("L").filter(ImageFilter.GaussianBlur(5)), dtype=np.float64) / 255
    relief = gray - blur
    dx = (np.roll(relief, -1, axis=1) - np.roll(relief, 1, axis=1)) * palette["normal"]
    dy = (np.roll(relief, -1, axis=0) - np.roll(relief, 1, axis=0)) * palette["normal"]
    normal = np.stack([-dx, dy, np.ones_like(dx)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    as_image((normal * .5 + .5) * 255).save(OUTPUT / f"{name}_normal.jpg", quality=93, subsampling=0, optimize=True)
    roughness = np.clip(palette["roughness"] - relief * .16, .82, 1)
    as_image(roughness * 255).save(OUTPUT / f"{name}_roughness.jpg", quality=90, optimize=True)

    # Contact sheets expose both wrap axes; size reduction is preview-only.
    preview = Image.new("RGB", (1024, 1024))
    tile = albedo.resize((512, 512), Image.Resampling.LANCZOS)
    for y in (0, 512):
        for x in (0, 512):
            preview.paste(tile, (x, y))
    preview.save(OUTPUT / f"{name}_tile_preview.jpg", quality=90)

    # Measure the JPEG actually served by the browser, not only the in-memory array.
    served = np.asarray(Image.open(OUTPUT / f"{name}_albedo.jpg"), dtype=np.float64)
    edge_step = float((np.abs(served[0] - served[-1]).mean() + np.abs(served[:, 0] - served[:, -1]).mean()) / 2)
    adjacent_step = float((np.abs(np.diff(served, axis=0)).mean() + np.abs(np.diff(served, axis=1)).mean()) / 2)
    srgb = served / 255
    linear = np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4)
    return {
        **MATERIALS[name],
        "dimensions": list(albedo.size),
        "base_color_srgb_mean": served.mean(axis=(0, 1)).round(3).tolist(),
        "base_color_linear_luminance_mean": round(float(np.mean(linear @ np.array([.2126, .7152, .0722]))), 5),
        "edge_step_mean_8bit": round(edge_step, 3),
        "interior_step_mean_8bit": round(adjacent_step, 3),
        "edge_to_interior_step_ratio": round(edge_step / adjacent_step, 3),
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "material": palette,
        "files": {suffix: f"{name}_{suffix}.jpg" for suffix in ("albedo", "normal", "roughness")},
    }


def main():
    manifest = {"generator": "Local ComfyUI FLUX.2 dev fp8mixed", "size": 1024,
                "steps": 24, "guidance": 3.5,
                "models": ["flux2_dev_fp8mixed.safetensors", "mistral_3_small_flux2_fp8.safetensors", "flux2-vae.safetensors"],
                "postprocess": "Periodic boundary correction, palette balance, JPEG export; conservative derived detail normals and matte roughness.",
                "materials": {}}
    sheet = Image.new("RGB", (1536, 562), (247, 241, 226))
    draw = ImageDraw.Draw(sheet)
    for index, (name, palette) in enumerate(PALETTE.items()):
        manifest["materials"][name] = finish_material(name, palette)
        tex = Image.open(OUTPUT / f"{name}_albedo.jpg").resize((512, 512), Image.Resampling.LANCZOS)
        sheet.paste(tex, (index * 512, 42))
        draw.text((index * 512 + 14, 14), name.upper(), fill=(54, 64, 32))
        print(name, json.dumps(manifest["materials"][name], indent=2))
    sheet.save(OUTPUT / "material_preview.jpg", quality=93)
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
