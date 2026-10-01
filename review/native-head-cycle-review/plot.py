from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

here = Path(__file__).resolve().parent
rows = json.loads((here / 'measurements.json').read_text())['rows']
fig, axes = plt.subplots(2, 2, figsize=(10, 6), sharex=True, sharey=True)
for ax, horse in zip(axes.flat, rows):
    samples = horse['rows']
    phase = np.array([r['phase'] for r in samples])
    for field, label, color in [('headY', 'Head origin', '#b46b32'), ('trunkY', 'Upper trunk origin', '#386d89')]:
        y = np.array([r[field] for r in samples])
        ax.plot(phase * 100, (y-y.mean()) * 1000, label=label, color=color, linewidth=2)
    ax.axhline(0, color='#cccccc', linewidth=.7)
    ax.set_title(horse['key'].replace('-', ' ').title(), fontsize=10)
    ax.grid(alpha=.18)
    ax.set_ylabel('Vertical change from mean (mm)')
    ax.set_xlabel('Walk stride (%)')
axes[0, 0].legend(frameon=False, fontsize=9)
fig.suptitle('Baseline native Walk: nearly synchronous head and torso', fontsize=14)
fig.text(.5, .01, 'Actual Three.js poses; native bone origins are proxies, not laboratory optical markers.', ha='center', fontsize=9, color='#555555')
fig.tight_layout(rect=[0, .04, 1, .94])
fig.savefig(here / 'current-cycles.png', dpi=160)
