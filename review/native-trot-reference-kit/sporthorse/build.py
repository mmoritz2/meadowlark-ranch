"""Reproduce target-own late recovery, then bounded 30/12 hoof fold."""
from pathlib import Path
import subprocess,sys
H=Path(__file__).resolve().parent
for name in ('warp.py','fold.py'): subprocess.run([sys.executable,str(H/name)],check=True)
