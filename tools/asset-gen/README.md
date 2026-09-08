# Star Ranch Fable — Asset Generation (local ComfyUI)

Local pipelines for generating game art with the ComfyUI install on this machine.
Outputs land in `../../assets/textures` (images) and `../../assets/models` (3D).

## Hardware / environment
- GPU: RTX PRO 6000 Blackwell (96 GB VRAM), torch 2.8.0+cu129, sm_120
- ComfyUI server code: `C:\Users\msmor\ComfyUI-Installs\ComfyUI\ComfyUI`
- venv (has all packages): `C:\Users\msmor\Documents\ComfyUI\.venv`
- base-directory (models/custom_nodes/output): `C:\Users\msmor\Documents\ComfyUI`

## Starting the server

```
cd C:\Users\msmor\ComfyUI-Installs\ComfyUI\ComfyUI
C:\Users\msmor\Documents\ComfyUI\.venv\Scripts\python.exe main.py ^
    --base-directory C:\Users\msmor\Documents\ComfyUI --port 8188 --highvram
```

> **Why a VRAM flag is required.** This is a customized ComfyUI build
> (`comfy_aimdo` / `comfy_kitchen`). When dynamic VRAM (aimdo) is enabled, the core
> `comfy.utils.load_safetensors` path uses a `ModelMMAP` object that is missing
> `get_file_handle()`, so **any core loader** (CheckpointLoaderSimple, UNETLoader,
> VAELoader, CLIPLoader) crashes. Video workflows work because WanVideo/LTX use
> their own loaders. **Both `--highvram` and `--disable-dynamic-vram`** turn aimdo
> off and route loads through the standard `safetensors.safe_open` path.
>
> **`--highvram`** (recommended on 96 GB) pins all models in VRAM for instant
> FLUX↔Hunyuan switching — but the footprint only grows (FLUX+Hunyuan+encoders
> ≈ 70 GB), so use `gen_*.py --free` or `POST /free` to release models, or restart,
> if you also load big video models. **`--disable-dynamic-vram`** instead offloads
> to CPU under pressure (leaner, slower switches).

## Images / textures — `gen_image.py`
Uses **FLUX.2 dev (fp8mixed)** with the locally installed split model files:
`flux2_dev_fp8mixed.safetensors`, `mistral_3_small_flux2_fp8.safetensors`, and
`flux2-vae.safetensors`. The old FLUX.1 all-in-one checkpoint is no longer used.

```
# Seamless (tileable) ground texture saved into the game's assets:
python gen_image.py "top-down grass turf, flat even lighting, PBR albedo" \
    --name grass_albedo --size 1024 --seamless

# Several non-tiling variations:
python gen_image.py "weathered barn wood planks" --name barnwood --count 4
```

Key flags: `--size`, `--steps`, `--guidance`, `--seed`, `--count`, `--seamless`,
`--out`. The first run loads the model and text encoder; warmed 1024px, 24-step
terrain jobs took approximately 25 seconds on this machine in the September 2026 pass.

### Seamless tiling
`--seamless` routes the UNet and VAE through the local custom nodes in
`custom_nodes/srf_seamless.py` (`SRFSeamlessModel` / `SRFSeamlessVAE`), which set
every Conv2d layer to `circular` padding so output tiles perfectly. This is far
useful at the VAE boundary, but a transformer diffusion model can still leave
an edge mismatch. Inspect a 2x2 tile preview before using a generated material.
Restart the server after changing that node file. Tip: prompt for "top-down
orthographic, flat even/overcast lighting, no shadows, no vignette" to minimize
tile-boundary brightness steps.

### Pastoral terrain materials — September 2026

`gen_pastoral_materials.py` reproduces three original FLUX.2 albedos for the
game's spring countryside art direction. It saves exact prompts, seeds, API
graphs, server histories, and unmodified generated PNGs. It checks that the
ComfyUI queue is empty and runs the jobs sequentially.

```powershell
& 'C:\Users\msmor\Documents\ComfyUI\.venv\Scripts\python.exe' tools/asset-gen/gen_pastoral_materials.py meadow bridleway arena
& 'C:\Users\msmor\Documents\ComfyUI\.venv\Scripts\python.exe' tools/asset-gen/finish_pastoral_materials.py
```

The second script balances the palette, removes residual low-frequency edge
mismatch using a periodic Poisson correction, and exports 1024px JPEG materials.
It also creates conservative detail normal and roughness estimates from the
generated albedo; these are artist-useful derived maps, not measured PBR scans.

- Runtime materials and a contact sheet: `assets/textures/pastoral/`
- Untouched ComfyUI PNGs: `assets/textures/pastoral/source/`
- Prompts, seeds, source hashes, and measured seam statistics:
  `assets/textures/pastoral/manifest.json`
- Reproducible ComfyUI API graphs and completed histories:
  `tools/asset-gen/workflows/pastoral/`
- Integration notes: `assets/textures/pastoral/README.md`

No existing ground textures are overwritten by these scripts.

## 3D models — `gen_model.py`
Image → 3D via **Hunyuan3D 2.1 (shape only)** through kijai's ComfyUI wrapper
(`--ver 2.0` falls back to the older path). Pipeline: FLUX makes a reference
image → background removal → Hunyuan3D generates a watertight mesh → exported as
GLB into `../../assets/models/`.

```
# From a text prompt (FLUX makes the reference image automatically):
python gen_model.py --prompt "a mossy granite boulder, three-quarter view, white background, game prop" --name boulder --max-faces 6000
# Three-quarter view matters: a straight-on reference reconstructs as a flat disc.
# --max-faces 6000 at generation time means no decimation step afterwards.

# Use Hunyuan3D 2.0 instead, or an existing image in ComfyUI/input:
python gen_model.py --image rock.png --name rock2 --ver 2.0
```
Knobs: `--ver` (2.1/2.0), `--steps`, `--octree` (detail, 256/384/512),
`--max-faces` (decimation), `--guidance`, plus FLUX `--ref-*` flags. First run
loads the shape model (2.1 ≈ 6.9 GB, 2.0 ≈ 4.6 GB). Typical mesh: ~20k verts /
40k faces, watertight, normalized to ±1. The 2.1 node (`Hy3D_2_1SimpleMeshGen`)
does its own background removal and needs no separate VAE-decode step.

### Status & limits
- **Shape works, and texture baking works too** — via the isolated torch-2.7 env at `Desktop\hy3d-paint` (`texture_props.py NAME ...`). The note below is historical:
- ~~Shape works; texture baking does NOT (yet).~~ The texture-paint stage needs a
  compiled `custom_rasterizer`. All four prebuilt wheels shipped with the wrapper
  fail to import on this machine's **torch 2.8 / cu129** with a C++ ABI mismatch
  (`DLL load failed ... procedure could not be found`); there is no torch-2.8
  wheel. Options to enable textured output, in order of preference:
  1. **Isolated env** — a second ComfyUI venv pinned to torch 2.7 + cu128 (matches
     the `+torch270.cuda128` wheel) on a separate port, used only for 3D. Doesn't
     disturb the torch-2.8 video setup.
  2. **Build from source** — install CUDA Toolkit 12.9 + VS Build Tools (~5 GB),
     then `pip install .` in `hy3dgen/texgen/custom_rasterizer`.
  3. Wait for kijai to publish a torch-2.8 wheel.
- Meshes are exported untextured — shade/texture them in-engine (vertex color,
  triplanar material, or projected FLUX texture) for now.
- Both 2.1 and 2.0 run **shape-only**; 2.1's PBR-texture gain is unusable until
  the rasterizer is fixed. 2.1 shape model: `tencent/Hunyuan3D-2.1`
  (`hunyuan3d-dit-v2-1/model.fp16.ckpt`, combined DiT+VAE, ~6.9 GB), renamed to
  `models/diffusion_models/hy3dgen/hunyuan3d-dit-v2-1-fp16.ckpt`.

## Files
- `comfy.py` — minimal ComfyUI API client (submit / monitor / download)
- `gen_image.py` — FLUX texture & image generator
- `workflows/` — saved API graphs (optional)
