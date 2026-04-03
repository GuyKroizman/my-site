import * as THREE from 'three'
import { getCachedModelClone, isSharedAssetObject, RACING_SHARED_ASSET_PATHS } from './assets'

const PUPIL_LOOK_DEGREES = 20
const PUPIL_LOOK_RAD = (PUPIL_LOOK_DEGREES * Math.PI) / 180
const STROLL_LOOK_DEGREES = 40
const STROLL_LOOK_RAD = (STROLL_LOOK_DEGREES * Math.PI) / 180

const HOLD_DURATION_MIN = 0.4
const HOLD_DURATION_MAX = 2.2
const MOVE_SPEED_MIN = 0.8
const MOVE_SPEED_MAX = 5

const DEFAULT_BASE_SCALE = 8

/** Finds a child object by name (case-insensitive), including nested. */
function findByName(obj: THREE.Object3D, name: string): THREE.Object3D | null {
  if (obj.name.toLowerCase() === name.toLowerCase()) return obj
  for (const child of obj.children) {
    const found = findByName(child, name)
    if (found) return found
  }
  return null
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface BackgroundEyeStroll {
  /** Seconds before starting to move. */
  delay: number
  /** Seconds to move from initial position to endPosition. */
  duration: number
  /** Position where the eye stops. */
  endPosition: Vec3
}

export interface BackgroundEyeParams {
  /** Initial position. */
  position: Vec3
  /** Scale relative to default (1 = default size, 0.5 = half). */
  scaleMultiplier?: number
  /** If set, eye moves from position to endPosition after delay, over duration. */
  stroll?: BackgroundEyeStroll
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
  private readonly scaleMultiplier: number
  private readonly strollDelay: number
  private readonly strollDuration: number
  private readonly strollVelocity = new THREE.Vector3()
  private readonly hasStroll: boolean
  private wasInStrollLook: boolean = false

  constructor(scene: THREE.Scene, params: BackgroundEyeParams) {
    const { position, stroll } = params
    this.scaleMultiplier = params.scaleMultiplier ?? 1
    this.hasStroll = stroll != null
    this.strollDelay = stroll?.delay ?? 0
    this.strollDuration = stroll?.duration ?? 0

    this.mesh = new THREE.Group()
    this.mesh.position.set(position.x, position.y, position.z)
    if (stroll) {
      this.strollVelocity.set(
        (stroll.endPosition.x - position.x) / stroll.duration,
        (stroll.endPosition.y - position.y) / stroll.duration,
        (stroll.endPosition.z - position.z) / stroll.duration
      )
    }
    this.mesh.rotation.order = 'YXZ'
    this.mesh.rotation.x = 0
    this.mesh.rotation.y = 0
    this.mesh.rotation.z = 0
    scene.add(this.mesh)
    const model = getCachedModelClone(RACING_SHARED_ASSET_PATHS.eyeModel)
    if (!model) {
      console.warn('Missing preloaded background eye model')
      return
    }

    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const baseScale = DEFAULT_BASE_SCALE / maxDim
    const scale = baseScale * this.scaleMultiplier
    model.scale.setScalar(scale)
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = false
        child.receiveShadow = true
      }
    })
    this.pupil = findByName(model, 'pupil') ?? model.getObjectByName('pupil') ?? null
    if (this.pupil) {
      if (this.hasStroll) {
        this.pupil.rotation.y = -STROLL_LOOK_RAD
        this.isHolding = true
      } else {
        this.pickNewLook()
        this.isHolding = false
      }
    }
    this.mesh.add(model)
  }

  private pickNewLook(): void {
    this.targetY = THREE.MathUtils.lerp(-PUPIL_LOOK_RAD, PUPIL_LOOK_RAD, Math.random())
    this.holdDuration = THREE.MathUtils.lerp(HOLD_DURATION_MIN, HOLD_DURATION_MAX, Math.random())
    this.moveSpeed = THREE.MathUtils.lerp(MOVE_SPEED_MIN, MOVE_SPEED_MAX, Math.random())
  }

  public update(deltaTime: number): void {
    if (this.hasStroll && this.strollTimer < this.strollDelay + this.strollDuration) {
      this.strollTimer += deltaTime
      if (this.strollTimer >= this.strollDelay && this.strollTimer < this.strollDelay + this.strollDuration) {
        this.mesh.position.x += this.strollVelocity.x * deltaTime
        this.mesh.position.y += this.strollVelocity.y * deltaTime
        this.mesh.position.z += this.strollVelocity.z * deltaTime
      }
    }

    if (!this.pupil) return

    const inStrollLook =
      this.hasStroll && this.strollTimer < this.strollDelay + this.strollDuration

    if (inStrollLook) {
      this.wasInStrollLook = true
      const moving = this.strollTimer >= this.strollDelay
      const strollProgress = moving
        ? (this.strollTimer - this.strollDelay) / this.strollDuration
        : 0
      const easeStart = 0.7
      const lookT = strollProgress <= easeStart
        ? 0
        : (strollProgress - easeStart) / (1 - easeStart)
      this.pupil.rotation.y = THREE.MathUtils.lerp(-STROLL_LOOK_RAD, 0, lookT)
      return
    }

    if (this.wasInStrollLook) {
      this.wasInStrollLook = false
      this.targetY = 0
      this.isHolding = true
      this.holdTimer = 0
    }

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
