import type * as THREE from 'three'
import type { PlayerBlockerSnapshot } from './actorTypes'

export function isBlockedByEnvironment(
  x: number,
  z: number,
  radius: number,
  blockers: readonly PlayerBlockerSnapshot[],
): boolean {
  return blockers.some((blocker) => {
    const dx = x - Math.max(blocker.minX, Math.min(x, blocker.maxX))
    const dz = z - Math.max(blocker.minZ, Math.min(z, blocker.maxZ))
    return dx * dx + dz * dz < radius * radius
  })
}

/** Swept hit test so fast projectiles cannot tunnel through thin walls. */
export function segmentIntersectsBox(
  start: THREE.Vector3,
  end: THREE.Vector3,
  box: THREE.Box3,
): boolean {
  let enter = 0
  let exit = 1
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = end[axis] - start[axis]
    if (Math.abs(delta) < 0.000001) {
      if (start[axis] < box.min[axis] || start[axis] > box.max[axis]) return false
      continue
    }
    const near = (box.min[axis] - start[axis]) / delta
    const far = (box.max[axis] - start[axis]) / delta
    enter = Math.max(enter, Math.min(near, far))
    exit = Math.min(exit, Math.max(near, far))
    if (enter > exit) return false
  }
  return true
}
