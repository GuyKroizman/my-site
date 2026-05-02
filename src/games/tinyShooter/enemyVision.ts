import * as THREE from 'three'
import type { VisionBlockerSnapshot } from './actorTypes'

const EPSILON = 0.000001

export interface VisionTarget {
  position: THREE.Vector3
  radius: number
}

export interface VisionCheckOptions {
  observerPosition: THREE.Vector3
  observerForward: THREE.Vector3
  target: VisionTarget
  range: number
  coneAngleDegrees: number
  blockers: readonly VisionBlockerSnapshot[]
}

function isPointInsideBlocker(point: THREE.Vector3, blocker: VisionBlockerSnapshot): boolean {
  return (
    point.x >= blocker.minX &&
    point.x <= blocker.maxX &&
    point.z >= blocker.minZ &&
    point.z <= blocker.maxZ
  )
}

function doesSegmentIntersectBlocker(
  start: THREE.Vector3,
  end: THREE.Vector3,
  blocker: VisionBlockerSnapshot,
): boolean {
  const deltaX = end.x - start.x
  const deltaZ = end.z - start.z
  let tMin = 0
  let tMax = 1

  const clipAxis = (p: number, q: number): boolean => {
    if (Math.abs(p) < EPSILON) {
      return q >= 0
    }

    const t = q / p
    if (p < 0) {
      if (t > tMax) {
        return false
      }
      if (t > tMin) {
        tMin = t
      }
      return true
    }

    if (t < tMin) {
      return false
    }
    if (t < tMax) {
      tMax = t
    }
    return true
  }

  return (
    clipAxis(-deltaX, start.x - blocker.minX) &&
    clipAxis(deltaX, blocker.maxX - start.x) &&
    clipAxis(-deltaZ, start.z - blocker.minZ) &&
    clipAxis(deltaZ, blocker.maxZ - start.z) &&
    tMin <= tMax
  )
}

function isOccluded(
  observerPosition: THREE.Vector3,
  targetPosition: THREE.Vector3,
  blockers: readonly VisionBlockerSnapshot[],
): boolean {
  for (const blocker of blockers) {
    const observerInside = isPointInsideBlocker(observerPosition, blocker)
    const targetInside = isPointInsideBlocker(targetPosition, blocker)
    if (observerInside && targetInside) {
      continue
    }

    if (doesSegmentIntersectBlocker(observerPosition, targetPosition, blocker)) {
      return true
    }
  }

  return false
}

export function canSeeTarget({
  observerPosition,
  observerForward,
  target,
  range,
  coneAngleDegrees,
  blockers,
}: VisionCheckOptions): boolean {
  const toTarget = new THREE.Vector3(
    target.position.x - observerPosition.x,
    0,
    target.position.z - observerPosition.z,
  )
  const distanceToTarget = toTarget.length()
  const effectiveDistance = Math.max(0, distanceToTarget - target.radius)
  if (effectiveDistance > range) {
    return false
  }

  if (distanceToTarget <= EPSILON) {
    return true
  }
  toTarget.multiplyScalar(1 / distanceToTarget)

  const normalizedForward = observerForward.clone().setY(0)
  if (normalizedForward.lengthSq() <= EPSILON) {
    normalizedForward.set(0, 0, 1)
  } else {
    normalizedForward.normalize()
  }

  const halfAngleRadians = THREE.MathUtils.degToRad(coneAngleDegrees * 0.5)
  if (normalizedForward.dot(toTarget) < Math.cos(halfAngleRadians)) {
    return false
  }

  return !isOccluded(observerPosition, target.position, blockers)
}
