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
    const bulletBox = new THREE.Box3().setFromObject(this.mesh)
    return bulletBox.intersectsBox(car.getBoundingBox())
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
