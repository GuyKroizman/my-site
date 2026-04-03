import * as THREE from 'three'
import { getCachedModelClone, isSharedAssetObject, RACING_SHARED_ASSET_PATHS } from './assets'

/** Trigger only when car actually overlaps the mine (matches visual size after 2x scale). */
const COLLISION_RADIUS = 1.2

export class Mine {
  public mesh: THREE.Group
  public position: THREE.Vector3

  private scene: THREE.Scene
  private collisionRadius: number = COLLISION_RADIUS
  private activationStartTime: number | null
  private activationDelay: number

  constructor(scene: THREE.Scene, x: number, z: number, activationDelay: number = 0, startArmed: boolean = true) {
    this.scene = scene
    this.position = new THREE.Vector3(x, 0, z)
    this.activationDelay = activationDelay
    this.activationStartTime = startArmed ? performance.now() / 1000 : null
    this.mesh = new THREE.Group()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
    const model = getCachedModelClone(RACING_SHARED_ASSET_PATHS.mineModel)
    if (!model) {
      console.warn('Missing preloaded mine model')
      return
    }

    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const scale = 2.4 / maxDim
    model.scale.setScalar(scale)
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    this.mesh.add(model)
  }

  public isActive(): boolean {
    if (this.activationStartTime === null) {
      return false
    }
    const elapsed = performance.now() / 1000 - this.activationStartTime
    return elapsed >= this.activationDelay
  }

  public startActivationCountdown(): void {
    if (this.activationStartTime !== null) return
    this.activationStartTime = performance.now() / 1000
  }

  public getPosition(): THREE.Vector3 {
    return this.position
  }

  public getCollisionRadius(): number {
    return this.collisionRadius
  }

  public collidesWith(position: THREE.Vector3, radius: number = 1): boolean {
    const dx = position.x - this.position.x
    const dz = position.z - this.position.z
    const distSq = dx * dx + dz * dz
    const minDist = this.collisionRadius + radius
    return distSq <= minDist * minDist
  }

  public destroy(): void {
    this.scene.remove(this.mesh)
    this.mesh.traverse((child) => {
      if (isSharedAssetObject(child)) {
        return
      }

      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }
}
