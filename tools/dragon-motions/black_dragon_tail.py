"""Flowing flight tail for the original 232-joint Black Dragon.

Builder API: apply_flight_tail(doc, phase, turn). `turn` rotates one existing
joint around a world-space axis, exactly as build-black-dragon.py does. Call
only for DragonFly. `phase` is one full 3.30-second tail wave; wings and body
may complete two 1.65-second beats during this period. Ground motion is not
changed. No translation, mesh, skin weight, or bone hierarchy is edited.
"""
from math import atan2, pi, sin

TAIL_JOINTS = (14, 15, 16, 17)
TAIL_NAMES = ('tail_1_04', 'tail_2_05', 'tail_3_06', 'ik_ACT_tail_5_07')
# Measured original joint centers in the source model's world coordinates.
# The four bones carry 1,176.85 total body skin-weight units; the endpoint and
# detached Blender tail controls carry no body weights and need no tracks.
_REST_YZ = ((2.75075796, -2.64830397), (2.12366456, -4.59990747),
            (1.01670710, -7.57177961), (.577713697, -11.2648449),
            (.636760167, -13.9693613))
_REST_PITCH = tuple(atan2(b[0]-a[0], a[1]-b[1])
                    for a, b in zip(_REST_YZ, _REST_YZ[1:]))
_CARRIED_PITCH = tuple(v*pi/180 for v in (-3., -2., 3., 7.))
_PITCH_AMPLITUDE = (.025, .040, .060, .075)
_YAW_AMPLITUDE = (.018, .045, .075, .110)
_LAG = (0., .32, .67, 1.03)


def flight_tail_angles(phase):
    """Return incremental world pitch/yaw rotations, in radians.

    Targets describe the *whole segment's* direction. Subtracting the previous
    segment correction prevents four rotations accumulating into a whip. The
    sine wave and analytic endpoints are periodic, including their velocities.
    """
    theta = 2*pi*(float(phase) % 1.)
    previous_pitch = previous_yaw = 0.
    rotations = []
    for i, rest in enumerate(_REST_PITCH):
        pitch = _CARRIED_PITCH[i] - rest + _PITCH_AMPLITUDE[i]*sin(theta-_LAG[i]-.35)
        yaw = _YAW_AMPLITUDE[i]*sin(theta-_LAG[i])
        rotations.append((pitch-previous_pitch, yaw-previous_yaw))
        previous_pitch, previous_yaw = pitch, yaw
    return rotations


def apply_flight_tail(doc, phase, turn):
    """Pose only the four original weighted tail joints for flight."""
    for joint, (pitch, yaw) in zip(TAIL_JOINTS, flight_tail_angles(phase)):
        turn(doc, joint, (1., 0., 0.), pitch)
        turn(doc, joint, (0., 1., 0.), yaw)
