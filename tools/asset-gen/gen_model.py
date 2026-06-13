"""Generate a 3D game model (GLB) from a text prompt or an image, using FLUX for
the reference image and Hunyuan3D 2.0 (shape only) on the local ComfyUI server.

Pipeline:  FLUX image  ->  rembg (cut out subject)  ->  Hunyuan3D shape  ->  GLB

Examples:
  # From a text prompt (FLUX makes the reference image automatically):
  python gen_model.py --prompt "a mossy granite boulder, video game prop" --name boulder

  # From an existing image (skips FLUX):
  python gen_model.py --image my_rock.png --name rock2

Notes:
  - Shape only (no baked texture): the texture-bake stage needs a compiled
    rasterizer that has no torch-2.8 wheel on this machine. The mesh is exported
    untextured (vertex geometry); texture/shade it in-engine for now.
  - Output GLB is copied into ../../assets/models/<name>.glb
"""
import argparse
import shutil
import sys
import time
from pathlib import Path

import comfy
from gen_image import flux_graph, FLUX_CKPT

COMFY_INPUT = Path(r"C:\Users\msmor\Documents\ComfyUI\input")
COMFY_OUTPUT = Path(r"C:\Users\msmor\Documents\ComfyUI\output")
SHAPE_MODEL_21 = "hy3dgen\\hunyuan3d-dit-v2-1-fp16.ckpt"
SHAPE_MODEL_20 = "hy3dgen\\hunyuan3d-dit-v2-0-fp16.safetensors"


def flux_image_to_input(prompt, name, size, steps, guidance, seed, cut=True):
    """Generate a reference image with FLUX and save it into ComfyUI's input folder.

    cut=True : rembg cutout saved as RGBA (needed for the 2.0 mesh path).
    cut=False: raw FLUX RGB on white bg (the 2.1 node removes bg itself).
    """
    from PIL import Image

    # object-centric prompt helpers for clean single-subject silhouettes
    full = (f"{prompt}, single object, centered, full object in frame, "
            f"three-quarter view, plain solid white background, soft even studio "
            f"lighting, product photo, no shadows")
    tmp_dir = Path(__file__).resolve().parent / "_ref"
    graph = flux_graph(full, size, size, steps, guidance, seed, 1, seamless=False)
    src = comfy.run(graph, tmp_dir, basename=f"{name}_ref")[0]
    print(f"  reference image: {src}")

    COMFY_INPUT.mkdir(parents=True, exist_ok=True)
    if cut:
        from rembg import remove
        img = remove(Image.open(src).convert("RGBA"))
        fname = f"srf_{name}_cut.png"
    else:
        img = Image.open(src).convert("RGB")
        fname = f"srf_{name}_ref.png"
    img.save(COMFY_INPUT / fname)
    print(f"  -> {COMFY_INPUT / fname}")
    return fname


def shape_graph_21(image_filename, name, guidance, steps, octree, max_faces,
                   model=SHAPE_MODEL_21):
    """Hunyuan3D 2.1 shape-only graph (Hy3D_2_1SimpleMeshGen does its own rembg
    and outputs a mesh directly): image -> mesh -> postprocess -> GLB."""
    prefix = f"3D/srf_{name}"
    return {
        "2": {"class_type": "LoadImage", "inputs": {"image": image_filename}},
        "3": {"class_type": "Hy3D_2_1SimpleMeshGen",
              "inputs": {"model": model, "image": ["2", 0], "steps": steps,
                         "guidance_scale": guidance, "octree_resolution": octree}},
        "5": {"class_type": "Hy3DPostprocessMesh",
              "inputs": {"trimesh": ["3", 0], "remove_floaters": True,
                         "remove_degenerate_faces": True, "reduce_faces": True,
                         "max_facenum": max_faces, "smooth_normals": False}},
        "6": {"class_type": "Hy3DExportMesh",
              "inputs": {"trimesh": ["5", 0], "filename_prefix": prefix,
                         "file_format": "glb", "save_file": True}},
    }


def shape_graph_20(image_filename, name, guidance, steps, seed, max_faces,
                   octree, model=SHAPE_MODEL_20):
    """Hunyuan3D 2.0 shape-only graph: image -> mesh -> postprocess -> GLB."""
    prefix = f"3D/srf_{name}"
    return {
        "1": {"class_type": "Hy3DModelLoader",
              "inputs": {"model": model, "attention_mode": "sdpa", "compile": False}},
        "2": {"class_type": "LoadImage",
              "inputs": {"image": image_filename}},
        "3": {"class_type": "Hy3DGenerateMesh",
              "inputs": {"pipeline": ["1", 0], "image": ["2", 0], "mask": ["2", 1],
                         "guidance_scale": guidance, "steps": steps, "seed": seed}},
        "4": {"class_type": "Hy3DVAEDecode",
              "inputs": {"vae": ["1", 1], "latents": ["3", 0], "box_v": 1.01,
                         "octree_resolution": octree, "num_chunks": 8000,
                         "mc_level": 0, "mc_algo": "mc"}},
        "5": {"class_type": "Hy3DPostprocessMesh",
              "inputs": {"trimesh": ["4", 0], "remove_floaters": True,
                         "remove_degenerate_faces": True, "reduce_faces": True,
                         "max_facenum": max_faces, "smooth_normals": False}},
        "6": {"class_type": "Hy3DExportMesh",
              "inputs": {"trimesh": ["5", 0], "filename_prefix": prefix,
                         "file_format": "glb", "save_file": True}},
    }


def find_latest_glb(name, since_ts):
    """Find the GLB that Hy3DExportMesh just wrote under output/3D/."""
    d = COMFY_OUTPUT / "3D"
    cands = [p for p in d.glob(f"srf_{name}*.glb") if p.stat().st_mtime >= since_ts - 5]
    if not cands:
        cands = list(d.glob(f"srf_{name}*.glb"))
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


def main():
    ap = argparse.ArgumentParser(description="Hunyuan3D image->GLB generator")
    ap.add_argument("--prompt", help="text prompt; FLUX makes the reference image")
    ap.add_argument("--image", help="existing image filename in ComfyUI/input (skips FLUX)")
    ap.add_argument("--name", required=True, help="output basename")
    ap.add_argument("--ver", choices=["2.1", "2.0"], default="2.1",
                    help="Hunyuan3D version (default 2.1, better shape)")
    ap.add_argument("--guidance", type=float, default=5.5, help="mesh guidance scale")
    ap.add_argument("--steps", type=int, default=50, help="mesh diffusion steps")
    ap.add_argument("--seed", type=int, default=123)
    ap.add_argument("--octree", type=int, default=384, help="VAE octree resolution (detail)")
    ap.add_argument("--max-faces", type=int, default=40000, help="decimation target")
    # FLUX reference-image params
    ap.add_argument("--ref-size", type=int, default=1024)
    ap.add_argument("--ref-steps", type=int, default=22)
    ap.add_argument("--ref-guidance", type=float, default=3.5)
    ap.add_argument("--free", action="store_true",
                    help="release VRAM (unload cached models) before generating")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[2] / "assets" / "models"))
    args = ap.parse_args()

    if not args.prompt and not args.image:
        ap.error("provide --prompt (generate ref image) or --image (existing)")

    print(f"Waiting for ComfyUI at {comfy.HOST} ...")
    comfy.wait_up()
    if args.free:
        print("Freeing VRAM (unloading cached models) ...")
        comfy.free()

    if args.image:
        image_filename = args.image
        print(f"Using existing input image: {image_filename}")
    else:
        print(f"Step 1/2: FLUX reference image (Hunyuan3D {args.ver})")
        # 2.1 node removes background itself; 2.0 path needs a pre-cut RGBA.
        image_filename = flux_image_to_input(
            args.prompt, args.name, args.ref_size, args.ref_steps,
            args.ref_guidance, args.seed, cut=(args.ver == "2.0"))

    print(f"Step 2/2: Hunyuan3D {args.ver} shape generation -> GLB")
    t0 = time.time()
    if args.ver == "2.1":
        graph = shape_graph_21(image_filename, args.name, args.guidance,
                               args.steps, args.octree, args.max_faces)
    else:
        graph = shape_graph_20(image_filename, args.name, args.guidance,
                               args.steps, args.seed, args.max_faces, args.octree)
    pid = comfy.submit(graph)
    print(f"  prompt_id = {pid}")
    entry = comfy.monitor(pid)
    status = (entry or {}).get("status", {}).get("status_str")
    if status != "success":
        msgs = (entry or {}).get("status", {}).get("messages")
        print(f"[error] mesh generation failed: {status}\n{msgs}", file=sys.stderr)
        return 1

    glb = find_latest_glb(args.name, t0)
    if not glb:
        print("[error] could not locate exported GLB under output/3D/", file=sys.stderr)
        return 1
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / f"{args.name}.glb"
    shutil.copy2(glb, dest)
    size_mb = dest.stat().st_size / 1e6
    print(f"\nDone in {int(time.time()-t0)}s. GLB -> {dest} ({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
