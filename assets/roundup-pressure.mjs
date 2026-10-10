// One solo pressure result drives the movement speed and the rider's cue.
// Steering and obstacle avoidance still choose the direction away from the rider.
const finitePoint = p => p != null && Number.isFinite(p.x) && Number.isFinite(p.z);
const smooth = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const invalid = () => ({active:false, status:'invalid', distance:null, alignment:null, speed:0, radius:null});

/** Speeds are metres/second; alignment is the rider-away direction dotted with
 * the direction to the pen. Disabled/unselected horses receive no pressure.
 * This describes pressure only: a blocked movement path must be reported by
 * the caller, and the caller retains all pen/progression logic.
 */
export function roundupPressure(options = {}) {
  if (options == null || typeof options !== 'object' || Array.isArray(options)) return invalid();
  const {horse, rider, pen, mode = 'beginner', enabled = true} = options;
  if (!finitePoint(horse) || !finitePoint(rider) || !finitePoint(pen) ||
      (mode !== 'beginner' && mode !== 'full') || typeof enabled !== 'boolean') return invalid();
  const rx = horse.x - rider.x, rz = horse.z - rider.z;
  const px = pen.x - horse.x, pz = pen.z - horse.z;
  const distance = Math.hypot(rx, rz), penDistance = Math.hypot(px, pz);
  if (!Number.isFinite(distance) || !Number.isFinite(penDistance)) return invalid();
  // Normalize first so otherwise finite large coordinates cannot overflow a dot product.
  const alignment = distance > 0 && penDistance > 0
    ? Math.max(-1, Math.min(1, (rx / distance) * (px / penDistance) + (rz / distance) * (pz / penDistance)))
    : 0;
  const radius = mode === 'beginner' ? 12 : 14;
  const active = enabled && distance < radius;
  if (!active) return {active, status:enabled ? 'out of range' : 'inactive', distance, alignment, speed:0, radius};
  const tooClose = distance < 6;
  const speed = mode === 'full' ? (tooClose ? 6 : 4.8)
    : tooClose ? 2.1 + 1.5 * (1 - smooth(distance / 6))
    : 2.1 - .9 * smooth((distance - 6) / 6);
  return {active, status:tooClose ? 'too close' : alignment > .5 ? 'guiding' : 'circle behind',
    distance, alignment, speed, radius};
}
