"""Slow airborne limb follow-through on the original Black Dragon rig.

Offsets are source-world metres relative to the existing tucked-foot targets.
One leg cycle spans the complete 3.30-second clip (two wingbeats). The legs
move in a loose stagger, not diagonal gait pairs; a delayed ankle curl follows
each recovery. The existing analytical limb solver still controls the native
hip/shoulder and knee/elbow joints. No mesh, weighting or ground clip changes.
"""
from math import pi, sin

# Front left/right then hind left/right. Left/right timing differences
# preserve a relaxed airborne pose without reproducing a walking footfall.
_PHASE_LAG = (0., .72, 1.45, 2.17)
_HEIGHT_AMPLITUDE = (.49, .49, .39, .39)
_REACH_AMPLITUDE = (.44, .44, .36, .36)
_ANKLE_AMPLITUDE = (.27, .27, .23, .23)


def flight_leg_offsets(leg_index, phase):
    """Return (world XYZ target offset, extra world-X foot pitch)."""
    i = int(leg_index)
    theta = 2*pi*(float(phase) % 1.) - _PHASE_LAG[i]
    side = 1. if i in (0, 2) else -1.
    offset = (side*.05*sin(theta-.35),
              _HEIGHT_AMPLITUDE[i]*sin(theta),
              _REACH_AMPLITUDE[i]*sin(theta+.85))
    ankle = _ANKLE_AMPLITUDE[i]*sin(theta-.50)
    return offset, ankle
