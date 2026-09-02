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

# FLUX.2 dev, split into its three files. The old all-in-one FLUX.1 checkpoint this
# script was written for is no longer on disk; these are what the server has now.
FLUX_CKPT = "flux2_dev_fp8mixed.safetensors"          # kept for gen_model's import
FLUX2_UNET = "flux2_dev_fp8mixed.safetensors"
FLUX2_CLIP = "mistral_3_small_flux2_fp8.safetensors"
FLUX2_VAE = "flux2-vae.safetensors"


def flux_graph(prompt, width, height, steps, guidance, seed, batch,
               ckpt=FLUX_CKPT, prefix="srf_assetgen", seamless=False):
    """Build an API-format FLUX.2 text-to-image graph.

    FLUX.2 does not go through KSampler: it wants its own scheduler and latent
    node, and the guider/noise/sampler split of SamplerCustomAdvanced. Wiring
    taken from ComfyUI's own image_flux2 template. When seamless=True the model
    and VAE are routed through the local SRFSeamless* nodes as before.
    """
    model_ref, vae_ref = ["1", 0], ["3", 0]
    g = {
        "1": {"class_type": "UNETLoader",
              "inputs": {"unet_name": FLUX2_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader",
              "inputs": {"clip_name": FLUX2_CLIP, "type": "flux2"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": FLUX2_VAE}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "5": {"class_type": "FluxGuidance",
              "inputs": {"conditioning": ["4", 0], "guidance": guidance}},
        "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "9": {"class_type": "Flux2Scheduler",
              "inputs": {"steps": steps, "width": width, "height": height}},
        "10": {"class_type": "EmptyFlux2LatentImage",
               "inputs": {"width": width, "height": height, "batch_size": batch}},
    }
    if seamless:
        g["20"] = {"class_type": "SRFSeamlessModel",
                   "inputs": {"model": ["1", 0], "tiling": "enable"}}
        g["21"] = {"class_type": "SRFSeamlessVAE",
                   "inputs": {"vae": ["3", 0], "tiling": "enable"}}
        model_ref, vae_ref = ["20", 0], ["21", 0]
    g["6"] = {"class_type": "BasicGuider",
              "inputs": {"model": model_ref, "conditioning": ["5", 0]}}
    g["11"] = {"class_type": "SamplerCustomAdvanced",
               "inputs": {"noise": ["7", 0], "guider": ["6", 0], "sampler": ["8", 0],
                          "sigmas": ["9", 0], "latent_image": ["10", 0]}}
    g["12"] = {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": vae_ref}}
    g["13"] = {"class_type": "SaveImage",
               "inputs": {"images": ["12", 0], "filename_prefix": prefix}}
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
