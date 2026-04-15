import * as THREE from 'three'
import type { AnimatedEnemy } from './AnimatedEnemy'

export interface EnemyBehavior {
  update(enemy: AnimatedEnemy, dt: number): void
}

export class IdleBehavior implements EnemyBehavior {
  update(): void {}
}

export class PatrolBehavior implements EnemyBehavior {
  private readonly patrolPoints: THREE.Vector3[]
  private patrolIndex = 1

  constructor(origin: { x: number; z: number }, patrolDistance: number) {
    this.patrolPoints = [
      new THREE.Vector3(origin.x - patrolDistance, 0, origin.z),
      new THREE.Vector3(origin.x + patrolDistance, 0, origin.z),
    ]
  }

  update(enemy: AnimatedEnemy, dt: number): void {
    const target = this.patrolPoints[this.patrolIndex]
    const reached = enemy.moveToward(target, dt)
    if (reached) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length
    }
  }
}

export class StrafeBehavior implements EnemyBehavior {
  private readonly center: THREE.Vector3
  private readonly direction: THREE.Vector3
  private readonly lateral: THREE.Vector3
  private readonly distance: number
  private time = 0

  constructor(origin: { x: number; z: number }, distance: number, headingDegrees = 0) {
    const heading = THREE.MathUtils.degToRad(headingDegrees)
    this.center = new THREE.Vector3(origin.x, 0, origin.z)
    this.direction = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))
    this.lateral = new THREE.Vector3(this.direction.z, 0, -this.direction.x)
    this.distance = distance
  }

  update(enemy: AnimatedEnemy, dt: number): void {
    this.time += dt
    const forwardOffset = Math.sin(this.time * 0.9) * this.distance
    const lateralOffset = Math.sin(this.time * 1.8) * this.distance * 0.55
    const target = this.center
      .clone()
      .addScaledVector(this.direction, forwardOffset)
      .addScaledVector(this.lateral, lateralOffset)
    enemy.moveToward(target, dt)
  }
}
