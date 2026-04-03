import * as THREE from 'three'
import { getCachedAnimatedModelClone, isSharedAssetObject, RACING_SHARED_ASSET_PATHS } from './assets'

export interface AmbientWolfCenter {
  x: number
  y: number
  z: number
}

const ORBIT_RADIUS = 4
const ORBIT_SPEED = 0.95
const BASE_SCALE = 120
const START_ANGLE = 0
const HEADING_OFFSET = 0

export class AmbientWolf {
  public mesh: THREE.Group
  private mixer: THREE.AnimationMixer | null = null
  private angle = START_ANGLE
  private readonly center: AmbientWolfCenter

  constructor(scene: THREE.Scene, center: AmbientWolfCenter) {
    this.center = center
    this.mesh = new THREE.Group()
    scene.add(this.mesh)

    const loaded = getCachedAnimatedModelClone(RACING_SHARED_ASSET_PATHS.wolfModel)
    if (!loaded) {
      console.warn('Missing preloaded ambient wolf model')
      return
    }

    const { scene: model, animations } = loaded
    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    model.scale.setScalar(BASE_SCALE / maxDim)
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    this.mesh.add(model)
    this.mixer = new THREE.AnimationMixer(model)

    const gallopClip = animations.find((clip) => clip.name === 'Gallop')
      ?? animations.find((clip) => clip.name.endsWith('|Gallop'))

    if (gallopClip) {
      const action = this.mixer.clipAction(gallopClip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    } else {
      console.warn('Ambient wolf missing Gallop animation clip')
    }

    this.updateTransform()
  }

  public update(deltaTime: number): void {
    this.mixer?.update(deltaTime)
    this.angle -= ORBIT_SPEED * deltaTime
    this.updateTransform()
  }

  private updateTransform(): void {
    this.mesh.position.set(
      this.center.x + Math.cos(this.angle) * ORBIT_RADIUS,
      this.center.y,
      this.center.z + Math.sin(this.angle) * ORBIT_RADIUS
    )

    const tangentX = Math.sin(this.angle)
    const tangentZ = -Math.cos(this.angle)
    this.mesh.rotation.y = Math.atan2(tangentX, tangentZ) + HEADING_OFFSET
  }

  public dispose(): void {
    this.mesh.parent?.remove(this.mesh)
    this.mixer?.stopAllAction()
    this.mixer = null
    this.mesh.traverse((child) => {
      if (isSharedAssetObject(child)) {
        return
      }

      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }
}
