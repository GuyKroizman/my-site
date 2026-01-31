import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { BulletSpawn } from './Player'
import { ARENA_HALF_X, ARENA_HALF_Z } from './types'

const BULLET_LIFETIME = 2

export function isBulletOutOfBounds(
  body: CANNON.Body,
  createdAt: number,
  halfX: number = ARENA_HALF_X,
  halfZ: number = ARENA_HALF_Z
): boolean {
  const now = performance.now()
  if ((now - createdAt) / 1000 > BULLET_LIFETIME) return true
  const p = body.position
  const margin = 2
  if (p.x < -halfX - margin || p.x > halfX + margin) return true
  if (p.z < -halfZ - margin || p.z > halfZ + margin) return true
  if (p.y < -1) return true
  return false
}

export function syncBulletMesh(spawn: BulletSpawn) {
  const { body, mesh } = spawn
  mesh.position.set(body.position.x, body.position.y, body.position.z)
}

const COLLIDE_EVENT = 'collide'

export function disposeBullet(
  spawn: BulletSpawn,
  scene: THREE.Scene,
  world: CANNON.World
) {
  if (spawn.collisionHandler) {
    spawn.body.removeEventListener(COLLIDE_EVENT, spawn.collisionHandler as (e: unknown) => void)
  }
  scene.remove(spawn.mesh)
  spawn.mesh.geometry.dispose()
  ;(spawn.mesh.material as THREE.Material).dispose()
  world.removeBody(spawn.body)
}
