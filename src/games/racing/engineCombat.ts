import * as THREE from 'three'
import { Ball } from './Ball'
import { Bullet } from './Bullet'
import { GluePuddle } from './GluePuddle'
import { Mine } from './Mine'
import { Track } from './Track'

export function clearCombatEntities(
  scene: THREE.Scene,
  bullets: Bullet[],
  balls: Ball[],
  playerMines: Mine[],
  playerGluePuddles: GluePuddle[]
): void {
  bullets.forEach(bullet => bullet.dispose(scene))
  balls.forEach(ball => ball.dispose())
  playerMines.forEach(mine => mine.destroy())
  playerGluePuddles.forEach(puddle => puddle.destroy())
}

export function getNearestLiveBallDistance(position: THREE.Vector3, balls: Ball[]): number {
  let nearestDistance = Infinity

  for (const ball of balls) {
    if (ball.exploded) continue
    nearestDistance = Math.min(nearestDistance, position.distanceTo(ball.position))
  }

  return nearestDistance
}

export function getBallSpawnClearance(balls: Ball[], margin: number): number {
  return balls.length > 0 ? balls[0].getRadius() * 2 + margin : 0
}

export function findBallSpawnPoint(
  track: Track,
  balls: Ball[],
  maxAttempts: number,
  margin: number
): THREE.Vector3 {
  let bestCandidate = track.getRandomPointOnTrack()
  let bestDistance = -Infinity

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = track.getRandomPointOnTrack()
    const nearestDistance = getNearestLiveBallDistance(candidate, balls)
    if (nearestDistance > bestDistance) {
      bestCandidate = candidate
      bestDistance = nearestDistance
    }
    if (nearestDistance >= getBallSpawnClearance(balls, margin)) {
      return candidate
    }
  }

  return bestCandidate
}

export function resolveBallCollisions(balls: Ball[], track: Track): void {
  const activeBalls = balls.filter(ball => !ball.exploded)
  if (activeBalls.length < 2) return

  for (let pass = 0; pass < activeBalls.length; pass++) {
    let changed = false
    for (let i = 0; i < activeBalls.length; i++) {
      for (let j = i + 1; j < activeBalls.length; j++) {
        if (activeBalls[i].resolveCollisionWithBall(activeBalls[j], track)) {
          changed = true
        }
      }
    }
    if (!changed) break
  }
}

export function triggerBallChainReactions(balls: Ball[], explosionPositions: THREE.Vector3[]): void {
  if (explosionPositions.length === 0) {
    return
  }

  for (const ball of balls) {
    if (ball.exploded) continue
    for (const pos of explosionPositions) {
      if (ball.isInChainReactionRange(pos)) {
        if (ball.activated) {
          ball.triggerImmediateDetonation()
        } else {
          ball.triggerActivation()
        }
        break
      }
    }
  }
}
