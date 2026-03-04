import * as THREE from 'three'

const EYE_MODEL_PATH = '/racing/eye.glb'
const PUPIL_Y_DEGREES = 20
const PUPIL_Y_RAD = (PUPIL_Y_DEGREES * Math.PI) / 180

const HOLD_DURATION_MIN = 0.4
const HOLD_DURATION_MAX = 2.2
const MOVE_SPEED_MIN = 0.8
const MOVE_SPEED_MAX = 5

const STROLL_Z = -25
const STROLL_DURATION = 10
const STROLL_START_X = 42
const STROLL_SPEED = -3.2

/** Finds a child object by name (case-insensitive), including nested. */
function findByName(obj: THREE.Object3D, name: string): THREE.Object3D | null {
  if (obj.name.toLowerCase() === name.toLowerCase()) return obj
  for (const child of obj.children) {
    const found = findByName(child, name)
    if (found) return found
  }
  return null
}

export class BackgroundEye {
  public mesh: THREE.Group
  private pupil: THREE.Object3D | null = null
  private targetY: number = 0
  private holdTimer: number = 0
  private holdDuration: number = 1
  private moveSpeed: number = 2
  private isHolding: boolean = true
  private strollTimer: number = 0

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group()
    this.mesh.position.set(STROLL_START_X, 4, STROLL_Z)
    this.mesh.rotation.order = 'YXZ'
    this.mesh.rotation.x = 0
    this.mesh.rotation.y = 0
    this.mesh.rotation.z = 0
    scene.add(this.mesh)
    void this.loadModel()
  }

  private pickNewLook(): void {
    this.targetY = THREE.MathUtils.lerp(-PUPIL_Y_RAD, PUPIL_Y_RAD, Math.random())
    this.holdDuration = THREE.MathUtils.lerp(HOLD_DURATION_MIN, HOLD_DURATION_MAX, Math.random())
    this.moveSpeed = THREE.MathUtils.lerp(MOVE_SPEED_MIN, MOVE_SPEED_MAX, Math.random())
  }

  private async loadModel(): Promise<void> {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const loader = new GLTFLoader()
      loader.load(
        EYE_MODEL_PATH,
        (gltf) => {
          const model = gltf.scene as THREE.Group
          const box = new THREE.Box3().setFromObject(model)
          const size = new THREE.Vector3()
          box.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z, 0.001)
          const scale = 8 / maxDim // Smaller than “sky” size so it fits beside the track
          model.scale.setScalar(scale)
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = false
              child.receiveShadow = true
            }
          })
          this.pupil = findByName(model, 'pupil') ?? model.getObjectByName('pupil') ?? null
          if (this.pupil) {
            this.pickNewLook()
            this.isHolding = false
          }
          this.mesh.add(model)
        },
        undefined,
        (err) => console.warn('Failed to load background eye model', err)
      )
    } catch (e) {
      console.warn('BackgroundEye loader error', e)
    }
  }

  public update(deltaTime: number): void {
    if (this.strollTimer < STROLL_DURATION) {
      this.strollTimer += deltaTime
      if (this.strollTimer < STROLL_DURATION) {
        this.mesh.position.x += STROLL_SPEED * deltaTime
      }
    }

    if (!this.pupil) return

    if (this.isHolding) {
      this.holdTimer += deltaTime
      if (this.holdTimer >= this.holdDuration) {
        this.holdTimer = 0
        this.isHolding = false
        this.pickNewLook()
      }
      return
    }

    const current = this.pupil.rotation.y
    const step = this.moveSpeed * deltaTime
    const diff = this.targetY - current
    if (Math.abs(diff) <= step) {
      this.pupil.rotation.y = this.targetY
      this.isHolding = true
      this.holdTimer = 0
    } else {
      this.pupil.rotation.y = current + Math.sign(diff) * step
    }
  }

  public dispose(): void {
    this.mesh.parent?.remove(this.mesh)
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
