"""Generate and finish original photoreal environment materials using local ComfyUI.

Run with the existing ComfyUI Python environment. Exact API graphs and successful
server histories are retained alongside untouched source PNGs. --finish-only
rebuilds compact runtime textures without using the GPU.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import comfy
from gen_image import flux_graph
from finish_pastoral_materials import as_image, periodic_surface

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets" / "textures" / "realism"
WORKFLOWS = Path(__file__).resolve().parent / "workflows" / "realism"
COMMON = (
    " Photoreal physically based rendering diffuse base color texture, "
    "seamless tileable square, orthographic straight-on material scan without "
    "perspective or lens distortion. Cross-polarized soft flat lighting, uniform "
    "exposure across the image, no specular highlight, no directional illumination, "
    "no baked shadows, no ambient occlusion, no vignette, no dark corners. "
    "Natural restrained detail and subtle wear, realistic scale, no stylization, "
    "no painting, no illustration, no dramatic cracks or exaggerated grunge, "
    "no text, no watermark, no border."
)
MATERIALS = {
    "siding": {
        "seed": 9082401, "patch_metres": [2.4, 2.4],
        "mean": [192, 188, 174], "contrast": .90, "roughness": .86, "normal": 1.55,
        "normal_scale": .48,
        "prompt": (
            "A square seamless repeating surface texture of maintained weathered "
            "off-white painted vertical timber siding on a traditional upscale rural "
            "horse stable. About eleven narrow straight parallel wooden boards running "
            "vertically from the top edge to the bottom edge, each about twenty-two "
            "centimeters wide, recessed thin straight board seams. Warm chalky ivory "
            "paint covering most of the old wood, fine grey wood grain barely visible "
            "through the thin paint, a few small worn paint flakes revealing muted "
            "grey-tan wood, tiny knots and minor weathering. Clean cared-for mature "
            "architecture, not abandoned or distressed. All boards continue through "
            "both top and bottom edges; no horizontal board ends, no trim, no nails, "
            "no door, no window, no structural elements. A 2.4 metre square wall patch."
        ) + COMMON,
    },
    "roof": {
        "seed": 9082402, "patch_metres": [1.8, 1.8],
        "mean": [92, 87, 75], "contrast": .88, "roughness": .92, "normal": 1.50,
        "normal_scale": .52,
        "prompt": (
            "A square seamless repeating material texture of aged dark cedar shake "
            "roof shingles on a traditional countryside horse stable, five horizontal "
            "courses of rectangular wooden shingles with staggered vertical joints, "
            "shingles of modestly varied widths, straight subtly irregular bottom "
            "edges and fine vertical natural wood grain. Weathered charcoal brown "
            "and muted driftwood taupe grey colors, calm natural board-to-board "
            "variation, restrained realistic fine texture, intact maintained roof. "
            "Only the continuous roof covering viewed straight-on perpendicular to "
            "the surface, no house, no roof ridge, no roof outline, no sky, no gutter, "
            "no moss, no grass, no broken tiles, no deep black gaps. A 1.8 metre square "
            "surface patch; broad modestly overlapping shingles, no deep relief."
        ) + COMMON,
    },
    "rock": {
        "seed": 9082403, "patch_metres": [3.2, 3.2],
        "mean": [135, 132, 119], "contrast": .89, "roughness": .94, "normal": 1.75,
        "normal_scale": .70,
        "prompt": (
            "A square seamless repeating texture of an exposed weathered grey-brown "
            "sedimentary limestone cliff face in temperate countryside. A 3.2 metre "
            "square patch of one continuous solid rock surface, irregular fine "
            "horizontal bedding layers and subtle weathered shallow ledges, small "
            "naturally rounded mineral grains and restrained tiny fissures. Warm "
            "stone grey, muted taupe and dusty pale buff colors, gently mottled "
            "mineral variation. Natural plausible geology, no rectangular masonry, "
            "no bricks, no tiled stones, no huge cracks, no black crevasses, no moss, "
            "no plants, no sky, no separate boulders, no rock silhouette."
        ) + COMMON,
    },
    "forest_floor": {
        "seed": 9082404, "patch_metres": [2.0, 2.0],
        "mean": [108, 96, 70], "contrast": .88, "roughness": .97, "normal": 1.30,
        "normal_scale": .42,
        "prompt": (
            "A square seamless repeating texture of quiet temperate woodland forest "
            "floor, perfectly overhead, showing a two metre square patch of softly "
            "compacted dark brown earth scattered with many small decomposing oak "
            "and beech leaf fragments, tiny dry twigs, minute tan leaf veins, fine "
            "organic litter, and very sparse small desaturated olive moss flecks. "
            "Natural irregular leaf litter, leaves mostly broken and partly "
            "incorporated into the earth, no giant whole leaves, no recognisable "
            "central objects. Muted umber, warm grey-brown, tobacco tan and dull "
            "olive, neutral soft forest colors without orange saturation. "
            "No grass lawn, no stones, no roots, no sticks larger than a pencil, "
            "no mushrooms, no flowers, no trunk, no puddles. Full even coverage."
        ) + COMMON,
    },
}


def finish(name):
    spec = MATERIALS[name]
    source = OUTPUT / "source" / f"{name}_albedo.png"
    raw = np.asarray(Image.open(source).convert("RGB"), dtype=np.float64)
    balanced = periodic_surface(raw)
    rgb = np.clip((balanced-balanced.mean(axis=(0, 1))) * spec["contrast"] + spec["mean"], 0, 255)
    albedo = as_image(rgb)
    albedo.save(OUTPUT / f"{name}_albedo.jpg", quality=93, subsampling=0, optimize=True)

    # Only high/mid-frequency relief is inferred. Large color changes never become
    # false terrain displacement. These estimates are not measured PBR scans.
    gray_image = albedo.convert("L")
    gray = np.asarray(gray_image, dtype=np.float64) / 255
    blurred = np.asarray(gray_image.filter(ImageFilter.GaussianBlur(8)), dtype=np.float64) / 255
    height = gray - blurred
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * spec["normal"]
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * spec["normal"]
    normal = np.stack([-dx, dy, np.ones_like(dx)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    as_image((normal * .5 + .5) * 255).save(OUTPUT / f"{name}_normal.jpg", quality=93, subsampling=0, optimize=True)
    roughness = np.clip(spec["roughness"]-height*.12, .72, 1)
    as_image(roughness*255).save(OUTPUT / f"{name}_roughness.jpg", quality=91, optimize=True)
    preview = Image.new("RGB", (1024, 1024))
    tile = albedo.resize((512, 512), Image.Resampling.LANCZOS)
    for y in (0, 512):
        for x in (0, 512):
            preview.paste(tile, (x, y))
    preview.save(OUTPUT / f"{name}_tile_preview.jpg", quality=92)

    served = np.asarray(Image.open(OUTPUT / f"{name}_albedo.jpg"), dtype=np.float64)
    edge = (np.abs(served[0]-served[-1]).mean()+np.abs(served[:, 0]-served[:, -1]).mean())/2
    interior = (np.abs(np.diff(served, axis=0)).mean()+np.abs(np.diff(served, axis=1)).mean())/2
    srgb = served / 255
    linear = np.where(srgb <= .04045, srgb/12.92, ((srgb+.055)/1.055)**2.4)
    return {**spec, "dimensions": list(albedo.size),
            "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "base_color_srgb_mean": served.mean(axis=(0, 1)).round(3).tolist(),
            "linear_luminance_mean": round(float(np.mean(linear @ np.array([.2126, .7152, .0722]))), 5),
            "edge_step_mean": round(float(edge), 3), "interior_step_mean": round(float(interior), 3),
            "edge_to_interior_ratio": round(float(edge/interior), 3),
            "files": {kind: f"{name}_{kind}.jpg" for kind in ("albedo", "normal", "roughness")}}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("materials", nargs="*", choices=list(MATERIALS), default=list(MATERIALS))
    ap.add_argument("--finish-only", action="store_true")
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--size", type=int, default=1024)
    args = ap.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    WORKFLOWS.mkdir(parents=True, exist_ok=True)
    if not args.finish_only:
        comfy.wait_up()
        queue = comfy.http_get("/queue")
        if queue.get("queue_running") or queue.get("queue_pending"):
            raise RuntimeError("ComfyUI queue is in use; do not compete for the GPU.")
    manifest_path = OUTPUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {
        "generator": "Local ComfyUI FLUX.2 dev fp8mixed", "steps": args.steps,
        "size": args.size, "guidance": 3.5,
        "models": ["flux2_dev_fp8mixed.safetensors", "mistral_3_small_flux2_fp8.safetensors", "flux2-vae.safetensors"],
        "processing": "Periodic boundary correction, restrained color balance; conservative albedo-derived detail normals and matte roughness.",
        "materials": {}}
    for name in args.materials:
        spec = MATERIALS[name]
        if not args.finish_only:
            graph = flux_graph(spec["prompt"], args.size, args.size, args.steps, 3.5,
                               spec["seed"], 1, prefix=f"srf_realism_{name}", seamless=True)
            (WORKFLOWS/f"{name}.api.json").write_text(json.dumps(graph, indent=2), encoding="utf-8")
            print(f"Generating {name}, seed {spec['seed']}", flush=True)
            pid = comfy.submit(graph)
            print(f"prompt_id = {pid}", flush=True)
            entry = comfy.monitor(pid)
            (WORKFLOWS/f"{name}.history.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
            if entry.get("status", {}).get("status_str") != "success":
                raise RuntimeError(f"Generation failed: {entry.get('status')}")
            comfy.download_images(entry, OUTPUT/"source", basename=f"{name}_albedo")
        manifest["materials"][name] = finish(name)
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"READY: {OUTPUT / (name+'_albedo.jpg')}", flush=True)
    available = [n for n in MATERIALS if (OUTPUT/f"{n}_albedo.jpg").exists()]
    sheet = Image.new("RGB", (1024, 1108), (232, 230, 222))
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(available):
        x, y = (i % 2)*512, (i // 2)*554
        draw.text((x+14, y+14), name.upper().replace("_", " "), fill=(42, 46, 36))
        tile = Image.open(OUTPUT/f"{name}_albedo.jpg").resize((512, 512), Image.Resampling.LANCZOS)
        sheet.paste(tile, (x, y+42))
    sheet.save(OUTPUT/"material_preview.jpg", quality=93)


if __name__ == "__main__":
    main()
