#!/usr/bin/env python3
"""Painterly grade for photoscan albedo maps.

The game's timber sits at roughly RGB(200,200,196) in sun and RGB(150,152,150) in
shade: pale, near-neutral, low contrast.  Photoscan albedo from Poly Haven sits far
warmer and darker.  This is the same treatment the project's own README describes for
its generated props (roughness up, saturation down) expressed as a repeatable filter:
  1. desaturate toward luma
  2. lift the blacks so nothing in the prop is darker than the game's darkest timber
  3. gentle mid gamma
Only *_diff_* (base colour) maps are touched.  ARM and normal maps are left alone.
"""
import sys, os, shutil, numpy as np
from PIL import Image

SAT   = float(os.environ.get('GRADE_SAT',   '0.45'))
LIFT  = float(os.environ.get('GRADE_LIFT',  '0.30'))
GAMMA = float(os.environ.get('GRADE_GAMMA', '0.88'))

def grade(path):
    im = Image.open(path).convert('RGB')
    a  = np.asarray(im).astype(np.float32) / 255.0
    luma = (0.2126*a[...,0] + 0.7152*a[...,1] + 0.0722*a[...,2])[...,None]
    a = luma + (a - luma) * SAT            # desaturate
    a = LIFT + a * (1.0 - LIFT)            # lift blacks
    a = np.clip(a, 0, 1) ** GAMMA          # brighten mids
    Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8)).save(path, quality=95)

src, dst = sys.argv[1], sys.argv[2]
if os.path.exists(dst): shutil.rmtree(dst)
shutil.copytree(src, dst)
n = 0
for root, _, files in os.walk(dst):
    for f in files:
        if '_diff_' in f and f.lower().endswith(('.jpg','.jpeg','.png')):
            grade(os.path.join(root, f)); n += 1
print('graded %d base-colour maps  sat=%.2f lift=%.2f gamma=%.2f' % (n, SAT, LIFT, GAMMA))
