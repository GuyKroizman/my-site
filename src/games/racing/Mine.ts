import * as THREE from 'three'

const MINE_MODEL_PATH = '/racing/models/landmine.glb'
const COLLISION_RADIUS = 1.8

export class Mine {
  public mesh: THREE.Group
  public position: THREE.Vector3

  private scene: THREE.Scene
  private collisionRadius: number = COLLISION_RADIUS

  constructor(scene: THREE.Scene, x: number, z: number) {
    this.scene = scene
    this.position = new THREE.Vector3(x, 0, z)
    this.mesh = new THREE.Group()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
    void this.loadModel()
  }

  private async loadModel(): Promise<void> {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const loader = new GLTFLoader()
      loader.load(
        MINE_MODEL_PATH,
        (gltf) => {
          const model = gltf.scene as THREE.Group
          const box = new THREE.Box3().setFromObject(model)
          const size = new THREE.Vector3()
          box.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z, 0.001)
          const scale = 1.2 / maxDim
          model.scale.setScalar(scale)
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          this.mesh.add(model)
        },
        undefined,
        (err) => console.warn('Failed to load mine model', err)
      )
    } catch (e) {
      console.warn('Mine loader error', e)
    }
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
