"""Reproduce the original FLUX.2 terrain albedos for the September 2026 art pass.

Uses the existing local ComfyUI instance and saves the exact API graphs, history,
and original generated PNGs. Run from any directory with the ComfyUI Python env.
"""
import argparse
import json
from pathlib import Path

import comfy
from gen_image import flux_graph

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets" / "textures" / "pastoral"
WORKFLOWS = Path(__file__).resolve().parent / "workflows" / "pastoral"
MATERIALS = {
    "meadow": {
        "seed": 829174,
        "prompt": (
            "Seamless tileable ground material, PBR base color albedo texture of a lush "
            "rural horse pasture, perfectly vertical top-down orthographic view. The entire "
            "square is covered evenly with fine short soft green meadow grass, tiny clover "
            "leaves and a few straw-colored fine grass blades. Natural spring colors, muted "
            "sage green and warm fresh yellow green. Premium semi-realistic pastoral "
            "equestrian adventure game material with softly simplified believable natural "
            "detail, subtle color variation, cohesive painterly realism. Approximately "
            "a two meter square of turf seen directly from above, no perspective, no "
            "horizon, no objects, no flowers, no broad dirt patches. Uniform flat diffuse "
            "overcast lighting, no directional illumination, no shadows, no ambient "
            "occlusion, no dark corners, no vignette. Even brightness from edge to edge. "
            "Medium value greens, gentle contrast, no neon colors, no text or watermark."
        ),
    },
    "bridleway": {
        "seed": 829175,
        "prompt": (
            "Seamless tileable PBR base color albedo texture of a warm pale earthen "
            "bridleway in an idyllic countryside horse ranch, perfectly vertical "
            "top-down orthographic view. Fine softly compacted sandy clay, tiny rounded "
            "gravel grains sparsely scattered through the earth, subtle natural worn "
            "surface variation. Warm light taupe, sand and muted honey beige. Premium "
            "semi-realistic pastoral equestrian adventure game material, softly "
            "simplified believable natural detail, cohesive painterly realism. "
            "Approximately a two meter square of ground, completely uniform coverage "
            "across the frame. No path edges, no grass, no grass border, no wheel tracks, "
            "no footprints, no large stones, no rocks, no perspective. Perfectly flat "
            "diffuse overcast illumination, no directional shadows, no ambient "
            "occlusion, no vignette, no dark corners, no text or watermark. Low contrast."
        ),
    },
    "arena": {
        "seed": 829176,
        "prompt": (
            "Seamless tileable PBR base color albedo material texture of professionally "
            "maintained fine equestrian riding arena footing. Perfectly vertical "
            "top-down orthographic view of fine cream and warm ivory silica sand with "
            "subtle tiny fiber inclusions, softly groomed gentle irregular small scale "
            "raking texture. Soft warm pale beige and buff sand colors. Premium "
            "semi-realistic pastoral horse riding adventure game material with cohesive "
            "painterly realism, believable granular fine detail, low contrast, even "
            "coverage. Approximately a two meter square of sand. No hoof prints, no "
            "footprints, no circles, no straight grid lines, no large ridges, no pebbles, "
            "no rocks, no grass, no objects, no perspective. Uniform flat diffuse "
            "overcast illumination, no directional shadow, no ambient occlusion, no "
            "vignette, no dark corners, no text or watermark."
        ),
    },
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("materials", nargs="*", choices=list(MATERIALS), default=list(MATERIALS))
    parser.add_argument("--steps", type=int, default=24)
    parser.add_argument("--size", type=int, default=1024)
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    WORKFLOWS.mkdir(parents=True, exist_ok=True)
    comfy.wait_up()
    queue = comfy.http_get("/queue")
    if queue.get("queue_running") or queue.get("queue_pending"):
        raise RuntimeError("ComfyUI has queued work; wait until that work finishes before running this batch.")
    for name in args.materials:
        spec = MATERIALS[name]
        graph = flux_graph(spec["prompt"], args.size, args.size, args.steps, 3.5,
                           spec["seed"], 1, prefix=f"srf_pastoral_{name}", seamless=True)
        (WORKFLOWS / f"{name}.api.json").write_text(json.dumps(graph, indent=2), encoding="utf-8")
        print(f"Generating {name}: seed {spec['seed']}", flush=True)
        prompt_id = comfy.submit(graph)
        print(f"prompt_id = {prompt_id}", flush=True)
        entry = comfy.monitor(prompt_id)
        (WORKFLOWS / f"{name}.history.json").write_text(json.dumps(entry, indent=2), encoding="utf-8")
        if entry.get("status", {}).get("status_str") != "success":
            raise RuntimeError(f"Generation failed: {entry.get('status')}")
        for path in comfy.download_images(entry, OUTPUT / "source", basename=f"{name}_albedo"):
            print(path, flush=True)


if __name__ == "__main__":
    main()
