"""Minimal ComfyUI API client: submit an API-format prompt, monitor it, and
download the resulting images. Shared by the asset-generation scripts.

The ComfyUI server for Star Ranch Fable asset gen is launched headless with:
  <venv>\\python.exe main.py --base-directory C:\\Users\\msmor\\Documents\\ComfyUI --port 8188
"""
import json
import time
import uuid
import urllib.request
import urllib.error
from pathlib import Path

# COMFY_HOST lets a run target another instance — e.g. one already holding the weights —
# instead of starting a second server that would not fit alongside it in VRAM.
import os as _os
HOST = _os.environ.get("COMFY_HOST", "http://127.0.0.1:8188")


def http_get(path, host=HOST):
    with urllib.request.urlopen(f"{host}{path}", timeout=30) as r:
        return json.loads(r.read())


def http_post(path, body, host=HOST):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{host}{path}", data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def wait_up(host=HOST, timeout=180):
    """Block until the server answers /system_stats, or raise."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            http_get("/system_stats", host)
            return True
        except Exception:
            time.sleep(2)
    raise RuntimeError(f"ComfyUI did not come up at {host} within {timeout}s")


def object_info(host=HOST):
    return http_get("/object_info", host)


def free(host=HOST, unload_models=True, free_memory=True):
    """Release VRAM: unload ComfyUI-managed models and free cached memory.

    Frees the heavy core models (e.g. the FLUX checkpoint). Note: the Hunyuan3D
    wrapper caches its pipeline inside the node instance, so that stays resident
    until the server restarts — which is fine for repeated 3D gen.
    """
    try:
        http_post("/free", {"unload_models": unload_models,
                            "free_memory": free_memory}, host)
        return True
    except Exception as e:
        print(f"  [warn] /free failed: {e}")
        return False


def submit(prompt, host=HOST, client_id=None):
    """Submit an API-format prompt dict. Returns prompt_id."""
    client_id = client_id or str(uuid.uuid4())
    try:
        resp = http_post("/prompt", {"prompt": prompt, "client_id": client_id}, host)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"/prompt rejected {e.code}: {e.read().decode()}") from e
    return resp["prompt_id"]


def monitor(prompt_id, host=HOST, on_status=print):
    """Block until prompt_id finishes. Returns the history entry dict."""
    start = time.time()
    last = None
    while True:
        time.sleep(2)
        q = http_get("/queue", host)
        running = [r[1] for r in (q.get("queue_running") or [])]
        pending = [p[1] for p in (q.get("queue_pending") or [])]
        if prompt_id in running:
            status = f"running ({int(time.time()-start)}s)"
        elif prompt_id in pending:
            status = f"pending (ahead: {pending.index(prompt_id)})"
        else:
            hist = http_get(f"/history/{prompt_id}", host)
            entry = hist.get(prompt_id)
            if entry is None:
                # brief race between leaving queue and history landing
                time.sleep(1)
                entry = http_get(f"/history/{prompt_id}", host).get(prompt_id, {})
            return entry
        if status != last:
            on_status(f"  [{time.strftime('%H:%M:%S')}] {status}")
            last = status


def download_images(entry, dest_dir, basename=None, host=HOST):
    """Download all image outputs from a finished history entry into dest_dir.
    Returns list of saved Path objects."""
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    saved = []
    outputs = (entry or {}).get("outputs", {})
    idx = 0
    for _nid, out in outputs.items():
        for im in out.get("images", []):
            fn = im["filename"]
            sub = im.get("subfolder", "")
            typ = im.get("type", "output")
            url = f"{host}/view?filename={urllib.parse.quote(fn)}&subfolder={urllib.parse.quote(sub)}&type={typ}"
            data = urllib.request.urlopen(url, timeout=60).read()
            ext = Path(fn).suffix or ".png"
            if basename:
                name = f"{basename}{'' if idx == 0 else f'_{idx}'}{ext}"
            else:
                name = fn
            p = dest / name
            p.write_bytes(data)
            saved.append(p)
            idx += 1
    return saved


def run(prompt, dest_dir, basename=None, host=HOST):
    """Convenience: submit, monitor, download. Returns saved paths."""
    pid = submit(prompt, host)
    print(f"  prompt_id = {pid}")
    entry = monitor(pid, host)
    status = (entry or {}).get("status", {}).get("status_str")
    if status != "success":
        msgs = (entry or {}).get("status", {}).get("messages")
        raise RuntimeError(f"generation failed: status={status} messages={msgs}")
    return download_images(entry, dest_dir, basename, host)


import urllib.parse  # noqa: E402  (used in download_images)
