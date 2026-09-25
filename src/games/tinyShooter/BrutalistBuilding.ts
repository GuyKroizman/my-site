import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PLAYER_HEIGHT, PROJECTILE_RADIUS } from './constants'
import type { PlayerBlockerSnapshot } from './actorTypes'
import type { Projectile } from './gameTypes'
import { segmentIntersectsBox } from './environmentCollision'

function disposeModel(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material)
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}

/** Static scenery, kept separate from enemies and level-clear conditions. */
export class BrutalistBuilding {
  readonly root = new THREE.Group()
  readonly blockers: PlayerBlockerSnapshot[] = []
  readonly ready: Promise<void>
  private readonly projectileBounds: THREE.Box3[] = []
  private disposed = false

  constructor(scene: THREE.Scene, position: { x: number; z: number }) {
    this.root.name = 'Brutalist building'
    this.root.position.set(position.x, 0, position.z)
    scene.add(this.root)

    this.ready = new GLTFLoader().loadAsync('/tiny-shooter/brutalist-building.glb').then((asset) => {
      if (this.disposed) {
        disposeModel(asset.scene)
        return
      }
      this.root.add(asset.scene)
      this.root.updateMatrixWorld(true)
      asset.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        if (object.userData.collider) {
          object.visible = false
          const bounds = new THREE.Box3().setFromObject(object)
          this.projectileBounds.push(bounds.clone().expandByScalar(PROJECTILE_RADIUS))
          // Upper slabs/canopies stop bullets, but do not prevent walking underneath.
          if (bounds.min.y < PLAYER_HEIGHT) {
            this.blockers.push({
              minX: bounds.min.x,
              maxX: bounds.max.x,
              minZ: bounds.min.z,
              maxZ: bounds.max.z,
            })
          }
        } else {
          object.castShadow = true
          object.receiveShadow = true
        }
      })
    }).catch((error: unknown) => {
      console.error('Could not load the brutalist building', error)
    })
  }

  blocksProjectile(projectile: Projectile): boolean {
    return this.projectileBounds.some((box) =>
      segmentIntersectsBox(projectile.previousPosition, projectile.mesh.position, box),
    )
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeFromParent()
    disposeModel(this.root)
    this.root.clear()
    this.blockers.length = 0
    this.projectileBounds.length = 0
  }
}
