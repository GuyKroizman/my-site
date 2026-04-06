import * as THREE from 'three'
import type { Checkpoint, CheckpointConfig } from './Track'

const CHECKPOINT_FALLBACK = new THREE.Vector3(0, 0, 0)
const FINISH_LINE_Z_TOLERANCE = 1
const FINISH_LINE_X_TOLERANCE = 2
const RANDOM_POINT_SKIP_FRACTION = 0.15
const PROGRESS_WRAP_THRESHOLD = 0.5
const PROGRESS_BACKTRACK_TOLERANCE = -0.05
const MAX_PROGRESS_SEARCH_DISTANCE = 10
const SEGMENT_TRANSITION_THRESHOLD = 0.95
const MIN_DISTANCE_TO_SEGMENT_END = 2

function getCheckpointCenter(checkpoint: Checkpoint): THREE.Vector3 {
  return new THREE.Vector3(
    (checkpoint.minX + checkpoint.maxX) / 2,
    0,
    (checkpoint.minZ + checkpoint.maxZ) / 2
  )
}

function getProgressDiff(newProgress: number, oldProgress: number): number {
  let diff = newProgress - oldProgress
  if (diff < -PROGRESS_WRAP_THRESHOLD) diff += 1
  if (diff > PROGRESS_WRAP_THRESHOLD) diff -= 1
  return diff
}

export function createDefaultCheckpoints(
  length: number,
  width: number,
  trackWidth: number
): CheckpointConfig[] {
  const cornerSize = 15
  const finishLineLength = 6

  return [
    {
      id: 0,
      bounds: {
        minX: 0,
        maxX: finishLineLength,
        minZ: -width / 2 - trackWidth,
        maxZ: -width / 2 + trackWidth
      }
    },
    {
      id: 1,
      bounds: {
        minX: length / 2 - cornerSize / 2,
        maxX: length / 2 + cornerSize / 2,
        minZ: -width / 2 - cornerSize / 2,
        maxZ: -width / 2 + cornerSize / 2
      }
    },
    {
      id: 2,
      bounds: {
        minX: length / 2 - cornerSize / 2,
        maxX: length / 2 + cornerSize / 2,
        minZ: width / 2 - cornerSize / 2,
        maxZ: width / 2 + cornerSize / 2
      }
    },
    {
      id: 3,
      bounds: {
        minX: -length / 2 - cornerSize / 2,
        maxX: -length / 2 + cornerSize / 2,
        minZ: width / 2 - cornerSize / 2,
        maxZ: width / 2 + cornerSize / 2
      }
    },
    {
      id: 4,
      bounds: {
        minX: -length / 2 - cornerSize / 2,
        maxX: -length / 2 + cornerSize / 2,
        minZ: -width / 2 - cornerSize / 2,
        maxZ: -width / 2 + cornerSize / 2
      }
    }
  ]
}

export function isPointInCheckpoint(position: THREE.Vector3, checkpoint: Checkpoint | undefined): boolean {
  if (!checkpoint) {
    return false
  }

  return (
    position.x >= checkpoint.minX &&
    position.x <= checkpoint.maxX &&
    position.z >= checkpoint.minZ &&
    position.z <= checkpoint.maxZ
  )
}

export function getCheckpointCenterById(checkpoints: Checkpoint[], checkpointId: number): THREE.Vector3 {
  const checkpoint = checkpoints.find(cp => cp.id === checkpointId)
  if (checkpoint) {
    return getCheckpointCenter(checkpoint)
  }

  return checkpoints[0] ? getCheckpointCenter(checkpoints[0]) : CHECKPOINT_FALLBACK.clone()
}

export function getNearestForwardCheckpoint(
  checkpoints: Checkpoint[],
  position: THREE.Vector3,
  forwardDirection: THREE.Vector3,
  lastCheckpoint: number
): THREE.Vector3 | null {
  if (checkpoints.length === 0) {
    return null
  }

  let bestCheckpoint: THREE.Vector3 | null = null
  let bestDot = -1

  for (const checkpointOffset of [1, 2]) {
    const checkpointId = (lastCheckpoint + checkpointOffset) % checkpoints.length
    const checkpointCenter = getCheckpointCenterById(checkpoints, checkpointId)
    const direction = new THREE.Vector3().subVectors(checkpointCenter, position)
    direction.y = 0
    const distance = direction.length()
    if (distance <= 0.1) {
      continue
    }

    direction.normalize()
    const dot = forwardDirection.dot(direction)
    if (dot > bestDot) {
      bestDot = dot
      bestCheckpoint = checkpointCenter
    }
  }

  return bestDot > 0.1 ? bestCheckpoint : null
}

export function getRandomPointOnPath(path: THREE.Vector3[]): THREE.Vector3 {
  const cumulativeLengths: number[] = [0]

  for (let i = 1; i < path.length; i++) {
    cumulativeLengths.push(cumulativeLengths[i - 1] + path[i].distanceTo(path[i - 1]))
  }

  const totalLength = cumulativeLengths[cumulativeLengths.length - 1]
  const minLength = totalLength * RANDOM_POINT_SKIP_FRACTION
  const maxLength = totalLength * (1 - RANDOM_POINT_SKIP_FRACTION)
  const targetLength = minLength + Math.random() * (maxLength - minLength)

  for (let i = 1; i < cumulativeLengths.length; i++) {
    if (cumulativeLengths[i] >= targetLength) {
      const segmentLength = cumulativeLengths[i] - cumulativeLengths[i - 1]
      const t = segmentLength > 0 ? (targetLength - cumulativeLengths[i - 1]) / segmentLength : 0
      return new THREE.Vector3().lerpVectors(path[i - 1], path[i], t).setY(0)
    }
  }

  const fallbackPoint = path[Math.floor(path.length / 2)]
  return new THREE.Vector3(fallbackPoint.x, fallbackPoint.y, fallbackPoint.z)
}

export function getPathProgress(path: THREE.Vector3[], position: THREE.Vector3, previousProgress = 0): number {
  const totalSegments = path.length - 1
  const normalizedPreviousProgress = previousProgress % 1
  const previousSegmentIndex = Math.floor(normalizedPreviousProgress * totalSegments)
  const previousSegmentProgress = normalizedPreviousProgress * totalSegments - previousSegmentIndex

  let bestProgress = previousProgress
  let minDistance = Infinity

  const currentSegmentStart = path[previousSegmentIndex]
  const currentSegmentEnd = path[(previousSegmentIndex + 1) % totalSegments]
  const currentSegment = currentSegmentEnd.clone().sub(currentSegmentStart)
  const currentSegmentLength = currentSegment.length()

  if (currentSegmentLength > 0) {
    const toCurrentPoint = position.clone().sub(currentSegmentStart)
    let t = toCurrentPoint.dot(currentSegment) / (currentSegmentLength * currentSegmentLength)
    t = Math.max(previousSegmentProgress, Math.min(1, t))

    const closestPoint = currentSegmentStart.clone().add(currentSegment.multiplyScalar(t))
    const distance = position.distanceTo(closestPoint)

    if (distance < MAX_PROGRESS_SEARCH_DISTANCE) {
      const segmentProgress = (previousSegmentIndex + t) / totalSegments
      if (getProgressDiff(segmentProgress, previousProgress) >= PROGRESS_BACKTRACK_TOLERANCE) {
        minDistance = distance
        bestProgress = segmentProgress
      }
    }

    const isNearEnd =
      t >= SEGMENT_TRANSITION_THRESHOLD &&
      position.distanceTo(currentSegmentEnd) < MIN_DISTANCE_TO_SEGMENT_END

    if (isNearEnd) {
      const nextSegmentIndex = (previousSegmentIndex + 1) % totalSegments
      const nextSegmentStart = path[nextSegmentIndex]
      const nextSegmentEnd = path[(nextSegmentIndex + 1) % totalSegments]
      const nextSegment = nextSegmentEnd.clone().sub(nextSegmentStart)
      const nextSegmentLength = nextSegment.length()

      if (nextSegmentLength > 0) {
        const toNextPoint = position.clone().sub(nextSegmentStart)
        let tNext = toNextPoint.dot(nextSegment) / (nextSegmentLength * nextSegmentLength)
        tNext = Math.max(0, Math.min(1, tNext))

        const closestPointNext = nextSegmentStart.clone().add(nextSegment.multiplyScalar(tNext))
        const distanceNext = position.distanceTo(closestPointNext)

        if (distanceNext < MAX_PROGRESS_SEARCH_DISTANCE) {
          const nextProgress = (nextSegmentIndex + tNext) / totalSegments
          const progressDiff = getProgressDiff(nextProgress, previousProgress)
          if (progressDiff >= PROGRESS_BACKTRACK_TOLERANCE && distanceNext < minDistance * 0.8) {
            minDistance = distanceNext
            bestProgress = nextProgress
          }
        }
      }
    }
  }

  if (previousProgress > 0.9) {
    const start = path[0]
    const end = path[1 % totalSegments]
    const segment = end.clone().sub(start)
    const segmentLength = segment.length()

    if (segmentLength > 0) {
      const toPoint = position.clone().sub(start)
      let t = toPoint.dot(segment) / (segmentLength * segmentLength)
      t = Math.max(0, Math.min(1, t))

      const closestPoint = start.clone().add(segment.multiplyScalar(t))
      const distance = position.distanceTo(closestPoint)
      if (distance < MAX_PROGRESS_SEARCH_DISTANCE) {
        const segmentProgress = t / totalSegments
        if (getProgressDiff(segmentProgress, previousProgress) < -PROGRESS_WRAP_THRESHOLD) {
          minDistance = distance
          bestProgress = segmentProgress
        }
      }
    }
  }

  const finalDiff = getProgressDiff(bestProgress, previousProgress)
  if (finalDiff < PROGRESS_BACKTRACK_TOLERANCE && finalDiff > -PROGRESS_WRAP_THRESHOLD) {
    return (previousProgress + 0.001) % 1
  }

  if (finalDiff > PROGRESS_WRAP_THRESHOLD) {
    return previousProgress
  }

  return bestProgress
}

export function checkFinishLineCrossing(position: THREE.Vector3, finishLinePosition: THREE.Vector3): boolean {
  const distance = Math.abs(position.z - finishLinePosition.z)
  return (
    distance < FINISH_LINE_Z_TOLERANCE &&
    position.x < finishLinePosition.x + FINISH_LINE_X_TOLERANCE &&
    position.x > finishLinePosition.x - FINISH_LINE_X_TOLERANCE
  )
}
