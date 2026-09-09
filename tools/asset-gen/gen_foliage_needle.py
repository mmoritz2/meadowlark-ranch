"""Original local FLUX.2 foliage card with a feathered, color-bleeded alpha edge."""
import argparse
import hashlib
import json

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter, grey_closing

import comfy
from gen_image import flux_graph
from gen_realism_materials import OUTPUT, WORKFLOWS

SEED = 9082420
PROMPT = 'Photoreal botanical cutout texture of a dense healthy evergreen balsam fir and spruce branch spray for a realistic three dimensional foliage card. One broad irregular spreading evergreen bough with six overlapping branching flat sprays, many hundreds of short thick flattened needles packed densely around fine brown-green twigs, naturally irregular needle lengths and orientations. Dense overlapping foliage fills approximately forty-five percent of the full square image, open small gaps between neighboring sprays but thick opaque foliage along the central branchlets. Short blunt-pointed needles, real natural fir anatomy, not long thin pine hairs, not geometric zigzag rows. Rich muted medium-dark olive sage green with natural lighter new needles and warm brown slender twigs. Front orthographic view of a thirty-five centimeter wide evergreen botanical specimen, slight natural curvature and depth but diffuse albedo lighting. Entire branch remains inside the central eighty-eight percent of a square with a generous pure-white border on all sides. Isolated on completely white background, cross-polarized flat soft diffuse illumination, no cast shadows, no grey background, no directional sunlight, no specular shine, no dramatic contrast, no depth of field, no text, no watermark, no illustration or painting. Realistic fine botanical detail, full natural dense foliage, organic asymmetrical broad silhouette.'


def finish():
    source = OUTPUT / "source" / "foliage_needle.png"
    rgb = np.asarray(Image.open(source).convert("RGB"), dtype=np.float64) / 255
    distance_from_white = 1-rgb.min(axis=2)
    alpha = np.clip((distance_from_white-.028)/.19, 0, 1)
    # The generator can leave neutral-grey specimen shadows despite the prompt.
    # Leaf green and twig brown are chromatic; suppress neutral background/shadow
    # pixels before choosing the opaque colors used for edge bleeding.
    chroma = rgb.max(axis=2)-rgb.min(axis=2)
    chromatic_foreground = np.clip((chroma-.070)/.110, 0, 1)
    dark_foreground = np.clip((.70-rgb.max(axis=2))/.25, 0, 1)
    alpha *= np.maximum(chromatic_foreground, dark_foreground)
    alpha = alpha*alpha*(3-2*alpha)
    # Closing tiny mask holes previously promoted white antialias pixels to
    # opaque foreground. Veto bright neutral source pixels AFTER the closing.
    white_contamination = (rgb.min(axis=2) > .48) | ((rgb.max(axis=2) > .76) & (chroma < .20))
    matte = grey_closing((alpha > .52).astype(np.float64), size=(3, 3)) > .5
    matte &= ~white_contamination
    # Keep the antialias fringe to a single pixel rather than retaining wide
    # semi-transparent background shadows as part of a foliage card.
    alpha = gaussian_filter(matte.astype(np.float64), sigma=.45)
    # Gutter and partially transparent pixels inherit nearby true leaf colors,
    # avoiding white/black fringing when the renderer builds smaller mip levels.
    opaque = alpha > .97
    # Trust only actual dark/chromatic needle and bark colors. This is separate
    # from the coverage mask: no expanded or feathered background pixel can ever
    # become the color donor for a transparent gutter or partially covered edge.
    color_core = matte & (rgb.min(axis=2) < .35) & (rgb.max(axis=2) < .70)
    if color_core.sum() < 5000:
        raise RuntimeError("Foreground extraction is implausibly small; inspect the source.")
    # Balance this unusually dark/yellow source to a subdued evergreen diffuse
    # palette before reusing the same RGB in the alpha gutter.
    rgb = np.clip((rgb-rgb[color_core].mean(axis=0))*.82 + np.array([90,110,68])/255, 0, 1)
    _, indices = distance_transform_edt(~color_core, return_indices=True)
    bleed = rgb[indices[0], indices[1]]
    rgb[~color_core] = bleed[~color_core]
    rgba = np.dstack([np.clip(rgb*255, 0, 255), np.clip(alpha*255, 0, 255)]).astype(np.uint8)
    Image.fromarray(rgba).save(OUTPUT / "foliage_needle_rgba.png", optimize=True)
    checker = np.zeros((1024, 1024, 3), dtype=np.uint8)
    yy, xx = np.indices((1024, 1024))
    checker[:] = np.where(((xx//64+yy//64)%2)[:, :, None] == 0, [214, 218, 204], [166, 176, 152])
    background = Image.fromarray(checker).convert("RGBA")
    background.alpha_composite(Image.fromarray(rgba))
    background.convert("RGB").save(OUTPUT / "foliage_needle_preview.jpg", quality=93)
    dark_preview = Image.new("RGBA", (1024, 1024), (31, 42, 35, 255))
    dark_preview.alpha_composite(Image.fromarray(rgba))
    dark_preview.convert("RGB").save(OUTPUT / "foliage_needle_dark_preview.jpg", quality=93)
    meta = {"generator": "Local ComfyUI FLUX.2 dev fp8mixed", "prompt": PROMPT,
            "seed": SEED, "steps": 28, "guidance": 3.5, "size": 1024,
            "seamless": False, "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "alpha_method": "White-distance/chroma matte; bright neutral source veto after hole closing; one-pixel feather; separate dark needle/bark color-core donors bleed across all contaminated pixels and gutters.",
            "color_core_coverage": round(float(color_core.mean()), 4),
            "bright_neutral_mask_pixels": int(np.count_nonzero(white_contamination & matte)),
            "foreground_coverage": round(float((alpha>.5).mean()), 4),
            "opaque_mean_srgb": np.rint(rgb[opaque].mean(axis=0)*255).astype(int).tolist(),
            "palette": {"target_srgb_mean": [90,110,68], "contrast": .82},
            "output": "foliage_needle_rgba.png"}
    (OUTPUT/"foliage_needle.manifest.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2), flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--finish-only", action="store_true")
    args = ap.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    WORKFLOWS.mkdir(parents=True, exist_ok=True)
    if not args.finish_only:
        comfy.wait_up()
        queue = comfy.http_get("/queue")
        if queue.get("queue_running") or queue.get("queue_pending"):
            raise RuntimeError("ComfyUI queue must be idle before foliage generation.")
        graph = flux_graph(PROMPT, 1024, 1024, 28, 3.5, SEED, 1, prefix="srf_realism_foliage", seamless=False)
        # Explicitly reset local circular-padding patches left by terrain jobs.
        graph["20"] = {"class_type": "SRFSeamlessModel", "inputs": {"model": ["1", 0], "tiling": "disable"}}
        graph["21"] = {"class_type": "SRFSeamlessVAE", "inputs": {"vae": ["3", 0], "tiling": "disable"}}
        graph["6"]["inputs"]["model"] = ["20", 0]
        graph["12"]["inputs"]["vae"] = ["21", 0]
        (WORKFLOWS/"foliage_needle.api.json").write_text(json.dumps(graph, indent=2), encoding="utf-8")
        pid = comfy.submit(graph)
        print(f"prompt_id = {pid}", flush=True)
        entry = comfy.monitor(pid)
        (WORKFLOWS/"foliage_needle.history.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
        if entry.get("status", {}).get("status_str") != "success":
            raise RuntimeError(f"Generation failed: {entry.get('status')}")
        comfy.download_images(entry, OUTPUT/"source", basename="foliage_needle")
    finish()


if __name__ == "__main__":
    main()
