"""Reproduce White late-recovery + front-hoof fold from checked-in White488.

Optional positional argument: final output.glb. Intermediate is temporary.
"""
from pathlib import Path
import hashlib, json, subprocess, sys, tempfile
H = Path(__file__).resolve().parent
ROOT = H.parents[2]
SOURCE = ROOT / 'review/native-white-head-kit/model.glb'
SOURCE_SHA = '488a3382f9c2f44dc69ccdfe935a032a03dae768e794088aaf9fa04ad045f81f'
PHASE_SHA = 'f8d688b660fbb841bfc168e86a9fa1d7bb3a92de2ad8ea87f79062a2fe0fa81d'
FINAL_SHA = 'b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else H / 'model.glb'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA
with tempfile.TemporaryDirectory(prefix='white-reference-fold-') as temporary:
    intermediate = Path(temporary) / 'phase.glb'
    subprocess.run([sys.executable, str(H/'build-phase.py'), str(SOURCE), str(intermediate)], check=True)
    assert hashlib.sha256(intermediate.read_bytes()).hexdigest() == PHASE_SHA
    subprocess.run([sys.executable, str(H/'build-fold.py'), str(intermediate), PHASE_SHA, str(OUT)], check=True)
assert hashlib.sha256(OUT.read_bytes()).hexdigest() == FINAL_SHA
print(json.dumps({'originalSourceSha256':SOURCE_SHA, 'phaseSha256':PHASE_SHA, 'finalSha256':FINAL_SHA, 'output':str(OUT)}, indent=2))
