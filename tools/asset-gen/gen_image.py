"""Generate game images/textures with FLUX dev (fp8) on the local ComfyUI server.

Examples:
  # A tiling ground texture, 1024x1024, made seamless, saved into the game:
  python gen_image.py "lush green meadow grass, top-down, even lighting, pbr albedo" \
      --name grass_albedo --size 1024 --seamless --out ../../assets/textures

  # A few horse-coat reference swatches:
  python gen_image.py "dapple grey horse coat fur texture, close up" \
      --name coat_dapple --size 768 --count 4

Run the ComfyUI server first (see tools/asset-gen/README.md).
"""
import argparse
import sys
from pathlib import Path

import comfy

# The all-in-one FLUX dev fp8 checkpoint (bundles model + CLIP + VAE).
FLUX_CKPT = "flux1-dev-fp8.safetensors"


def flux_graph(prompt, width, height, steps, guidance, seed, batch,
               ckpt=FLUX_CKPT, prefix="srf_assetgen", seamless=False):
    """Build an API-format FLUX text-to-image prompt graph.

    When seamless=True, MODEL and VAE are routed through the local SRFSeamless*
    nodes (circular conv padding) so the output tiles perfectly.
    """
    model_ref, vae_ref = ["1", 0], ["1", 2]
    g = {
        "1": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": ckpt}},
        "2": {"class_type": "CLIPTextEncode",
              "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode",
              "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {"class_type": "FluxGuidance",
              "inputs": {"conditioning": ["2", 0], "guidance": guidance}},
        "5": {"class_type": "EmptySD3LatentImage",
              "inputs": {"width": width, "height": height, "batch_size": batch}},
    }
    if seamless:
        g["10"] = {"class_type": "SRFSeamlessModel",
                   "inputs": {"model": ["1", 0], "tiling": "enable"}}
        g["11"] = {"class_type": "SRFSeamlessVAE",
                   "inputs": {"vae": ["1", 2], "tiling": "enable"}}
        model_ref, vae_ref = ["10", 0], ["11", 0]
    g["6"] = {"class_type": "KSampler",
              "inputs": {"model": model_ref, "positive": ["4", 0], "negative": ["3", 0],
                         "latent_image": ["5", 0], "seed": seed, "steps": steps,
                         "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple",
                         "denoise": 1.0}}
    g["7"] = {"class_type": "VAEDecode",
              "inputs": {"samples": ["6", 0], "vae": vae_ref}}
    g["8"] = {"class_type": "SaveImage",
              "inputs": {"images": ["7", 0], "filename_prefix": prefix}}
    return g


def main():
    ap = argparse.ArgumentParser(description="FLUX texture/image generator for Star Ranch Fable")
    ap.add_argument("prompt", help="text prompt")
    ap.add_argument("--name", default="asset", help="output basename")
    ap.add_argument("--size", type=int, default=1024, help="square size (px)")
    ap.add_argument("--width", type=int, help="override width")
    ap.add_argument("--height", type=int, help="override height")
    ap.add_argument("--steps", type=int, default=20)
    ap.add_argument("--guidance", type=float, default=3.5)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--count", type=int, default=1, help="how many variations")
    ap.add_argument("--seamless", action="store_true", help="tileable (circular padding)")
    ap.add_argument("--free", action="store_true",
                    help="release VRAM (unload cached models) before generating")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[2] / "assets" / "textures"))
    args = ap.parse_args()

    w = args.width or args.size
    h = args.height or args.size
    out_dir = Path(args.out)

    print(f"Waiting for ComfyUI at {comfy.HOST} ...")
    comfy.wait_up()
    if args.free:
        print("Freeing VRAM (unloading cached models) ...")
        comfy.free()

    saved_all = []
    for i in range(args.count):
        seed = args.seed + i if args.seed else (1234567 + i * 7919)
        print(f"[{i+1}/{args.count}] {args.name}  {w}x{h}  seed={seed}")
        graph = flux_graph(args.prompt, w, h, args.steps, args.guidance, seed, 1,
                           seamless=args.seamless)
        base = args.name if args.count == 1 else f"{args.name}_{i:02d}"
        saved = comfy.run(graph, out_dir, basename=base)
        for p in saved:
            print(f"      {'seamless ' if args.seamless else ''}-> {p}")
        saved_all += saved

    print(f"\nDone. {len(saved_all)} file(s) in {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
