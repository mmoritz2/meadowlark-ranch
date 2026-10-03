"""Unhurried neck shake and bow on the original Black Dragon joints.

Twenty seconds includes quiet breathing, a short side-to-side neck shake,
a pause, a slow bow with a hold, then recovery. Quintic envelopes have zero
velocity/acceleration at both ends; the whole idle loops at its neutral pose.
"""
from math import pi, sin
IDLE_DURATION = 20.0


def ease(t):
    t = min(1.0, max(0.0, t))
    return t*t*t*(t*(t*6.0-15.0)+10.0)


def envelope(t, start, rise, hold, fall):
    return ease((t-start)/rise)*(1.0-ease((t-start-rise-hold)/fall))


def idle_curves(phase):
    t = IDLE_DURATION*(phase % 1.0)
    shake = envelope(t, 3.5, .65, 2.05, .85)
    bow = envelope(t, 11.0, 1.6, .9, 2.0)
    return t, shake, bow


def apply_idle_neck(doc, phase, turn):
    t, shake, bow = idle_curves(phase)
    # Successive vertebrae follow with a small delay rather than swivelling
    # the whole neck as one rigid piece. Both sides ease back to neutral.
    for index, node in enumerate((36, 37, 38, 39, 40)):
        wave = sin(2*pi*(t-3.5)/1.15-index*.18)*shake
        turn(doc, node, [0,1,0], (.095,.105,.115,.11,.15)[index]*wave)
        turn(doc, node, [1,0,0], (.10,.12,.15,.13,.16)[index]*bow)
        if node == 40:
            turn(doc, node, [0,0,1], .045*wave)
    return bow
