import * as THREE from 'three'
import { getCachedAnimatedModelClone, isSharedAssetObject, RACING_SHARED_ASSET_PATHS } from './assets'
import { type AmbientWolfCenter, ORBIT_RADIUS, ORBIT_SPEED } from './AmbientWolf'

const BASE_SCALE = 120
const START_ANGLE = -Math.PI / 2
const HEADING_OFFSET = 0

export class AmbientBunny {
  public mesh: THREE.Group
  private mixer: THREE.AnimationMixer | null = null
  private angle = START_ANGLE
  private readonly center: AmbientWolfCenter

  constructor(scene: THREE.Scene, center: AmbientWolfCenter) {
    this.center = center
    this.mesh = new THREE.Group()
    scene.add(this.mesh)

    const loaded = getCachedAnimatedModelClone(RACING_SHARED_ASSET_PATHS.bunnyModel)
    if (!loaded) {
      console.warn('Missing preloaded ambient bunny model')
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

    const runClip = animations.find((clip) => clip.name === 'CharacterArmature|Run')
      ?? animations.find((clip) => clip.name.endsWith('|Run'))
      ?? animations.find((clip) => clip.name === 'Run')

    if (runClip) {
      const action = this.mixer.clipAction(runClip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    } else {
      console.warn('Ambient bunny missing Run animation clip')
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
