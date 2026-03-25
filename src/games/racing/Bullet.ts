import * as THREE from 'three'
import type { Car } from './Car'

export class Bullet {
  public mesh: THREE.Mesh
  private velocity: THREE.Vector3
  private lifetime: number = 0.4

  constructor(position: THREE.Vector3, rotationY: number) {
    const geometry = new THREE.BoxGeometry(0.06, 0.06, 0.2)
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffff88,
      emissiveIntensity: 3,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.copy(position)
    this.mesh.rotation.y = rotationY

    const speed = 120
    this.velocity = new THREE.Vector3(
      Math.sin(rotationY) * speed,
      0,
      Math.cos(rotationY) * speed
    )
  }

  update(dt: number): void {
    this.mesh.position.addScaledVector(this.velocity, dt)
    this.lifetime -= dt
  }

  isExpired(): boolean {
    return this.lifetime <= 0
  }

  checkCollision(car: Car): boolean {
    // Transform bullet position into car's local space and check against half-extents
    const bp = this.mesh.position
    const cp = car.position
    const dx = bp.x - cp.x
    const dz = bp.z - cp.z
    const cos = Math.cos(-car.rotation)
    const sin = Math.sin(-car.rotation)
    const localX = Math.abs(dx * cos - dz * sin)
    const localZ = Math.abs(dx * sin + dz * cos)
    const half = car.getLocalHalfSize()
    return localX <= half.x && localZ <= half.z
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
