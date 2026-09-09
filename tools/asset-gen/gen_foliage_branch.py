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

SEED = 9082410
PROMPT = (
    "Photoreal botanical cutout texture for an oak and beech countryside tree "
    "foliage card. One natural broad spreading slender branching leafy twig spray, "
    "about thirty-five to forty-five distinct mature small lobed oak leaves mixed "
    "with a few pointed oval beech leaves on three fine branching brown-green "
    "twig stems. Real leaf anatomy, gently irregular lobes, fine natural veins, "
    "crisp delicate edges, slight leaf-to-leaf size and angle variation. Many "
    "small open gaps between leaves, irregular wide branching silhouette, not a "
    "round bush, not a solid blob. Muted natural medium sage green and olive green "
    "foliage with subtle pale new leaves, soft brown-green twigs, no black stems. "
    "The whole twig spray fits within the central 88 percent of the square image, "
    "a clear pure white margin on all sides; no leaf touches or crosses the "
    "image boundary. Isolated on perfectly pure white background. Front-facing "
    "orthographic overhead botanical specimen photography, leaves approximately "
    "parallel to the image plane, cross-polarized diffuse soft white light, no "
    "directional sunlight, no cast shadow, no ground, no vase, no depth of field, "
    "no vignette. PBR diffuse albedo asset, scientifically believable plants, "
    "sharp natural detail, no illustration, no painting, no decorative frame, "
    "no text or watermark."
)


def finish():
    source = OUTPUT / "source" / "foliage_branch.png"
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
    alpha = grey_closing(alpha, size=(3, 3))
    # Keep the antialias fringe to a single pixel rather than retaining wide
    # semi-transparent background shadows as part of a foliage card.
    alpha = gaussian_filter((alpha > .52).astype(np.float64), sigma=.45)
    # Gutter and partially transparent pixels inherit nearby true leaf colors,
    # avoiding white/black fringing when the renderer builds smaller mip levels.
    opaque = alpha > .97
    if opaque.sum() < 5000:
        raise RuntimeError("Foreground extraction is implausibly small; inspect the source.")
    _, indices = distance_transform_edt(~opaque, return_indices=True)
    bleed = rgb[indices[0], indices[1]]
    rgb[~opaque] = bleed[~opaque]
    rgba = np.dstack([np.clip(rgb*255, 0, 255), np.clip(alpha*255, 0, 255)]).astype(np.uint8)
    Image.fromarray(rgba).save(OUTPUT / "foliage_branch_rgba.png", optimize=True)
    checker = np.zeros((1024, 1024, 3), dtype=np.uint8)
    yy, xx = np.indices((1024, 1024))
    checker[:] = np.where(((xx//64+yy//64)%2)[:, :, None] == 0, [214, 218, 204], [166, 176, 152])
    background = Image.fromarray(checker).convert("RGBA")
    background.alpha_composite(Image.fromarray(rgba))
    background.convert("RGB").save(OUTPUT / "foliage_branch_preview.jpg", quality=93)
    meta = {"generator": "Local ComfyUI FLUX.2 dev fp8mixed", "prompt": PROMPT,
            "seed": SEED, "steps": 28, "guidance": 3.5, "size": 1024,
            "seamless": False, "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "alpha_method": "White-distance and chroma matte suppressing neutral specimen shadows; tiny-hole closing, one-pixel feather, nearest opaque color bleed across gutter and partial edge.",
            "foreground_coverage": round(float((alpha>.5).mean()), 4),
            "opaque_mean_srgb": np.rint(rgb[opaque].mean(axis=0)*255).astype(int).tolist(),
            "output": "foliage_branch_rgba.png"}
    (OUTPUT/"foliage_branch.manifest.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
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
        (WORKFLOWS/"foliage_branch.api.json").write_text(json.dumps(graph, indent=2), encoding="utf-8")
        pid = comfy.submit(graph)
        print(f"prompt_id = {pid}", flush=True)
        entry = comfy.monitor(pid)
        (WORKFLOWS/"foliage_branch.history.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
        if entry.get("status", {}).get("status_str") != "success":
            raise RuntimeError(f"Generation failed: {entry.get('status')}")
        comfy.download_images(entry, OUTPUT/"source", basename="foliage_branch")
    finish()


if __name__ == "__main__":
    main()
