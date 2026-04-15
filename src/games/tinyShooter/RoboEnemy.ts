import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import {
  ROBO_ENEMY_HEALTH,
  ROBO_ENEMY_PATROL_SPEED,
  ROBO_ENEMY_PATROL_DISTANCE,
  ROBO_ENEMY_HEIGHT,
  ROBO_ENEMY_HIT_RADIUS,
  ROBO_ENEMY_KNOCKBACK_DAMPING,
} from './types'
import type { Projectile } from './types'

const MODEL_PATH = '/tiny-shooter/robo-enemy-1.glb'
const BODY_RADIUS = 0.75
const TURN_SPEED = 8
const HIT_RADIUS_SQ = ROBO_ENEMY_HIT_RADIUS * ROBO_ENEMY_HIT_RADIUS
const ROOT_MOTION_NODE_NAMES = new Set(['CharacterArmature', 'RootNode', 'Armature'])
const VISUAL_SCALE_CORRECTION = 800
const VISUAL_FOOT_CONTACT_OFFSET = 1130

const loader = new GLTFLoader()
let modelAssetPromise: Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> | null = null

async function loadModelAsset(): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  if (!modelAssetPromise) {
    modelAssetPromise = loader.loadAsync(MODEL_PATH).then((gltf) => ({
      scene: gltf.scene,
      animations: gltf.animations,
    }))
  }

  return modelAssetPromise
}

function removeRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const filteredTracks = clip.tracks.filter((track) => {
    if (!track.name.endsWith('.position')) {
      return true
    }

    const trackTarget = track.name.split('.')[0]
    return !ROOT_MOTION_NODE_NAMES.has(trackTarget)
  })

  return new THREE.AnimationClip(clip.name, clip.duration, filteredTracks)
}

export class RoboEnemy {
  readonly body: CANNON.Body
  readonly root = new THREE.Group()

  private readonly scene: THREE.Scene
  private readonly world: CANNON.World
  private readonly patrolPoints: THREE.Vector3[]
  private readonly moveDir = new THREE.Vector3(1, 0, 0)
  private readonly knockbackVelocity = new THREE.Vector3()
  private readonly tmpVec = new THREE.Vector3()
  private readonly modelAnchor = new THREE.Group()
  private readonly visualBounds = new THREE.Box3()
  private readonly fallbackMesh: THREE.Mesh

  private mixer: THREE.AnimationMixer | null = null
  private walkAction: THREE.AnimationAction | null = null
  private deathAction: THREE.AnimationAction | null = null
  private visualModel: THREE.Object3D | null = null
  private patrolIndex = 1
  private health = ROBO_ENEMY_HEALTH
  private disposed = false

  dead = false

  constructor(world: CANNON.World, scene: THREE.Scene, position: { x: number; z: number }) {
    this.world = world
    this.scene = scene

    this.root.position.set(position.x, 0, position.z)
    this.scene.add(this.root)
    this.root.add(this.modelAnchor)

    this.fallbackMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(BODY_RADIUS * 0.8, ROBO_ENEMY_HEIGHT - BODY_RADIUS * 1.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0x441100, emissiveIntensity: 1.2 })
    )
    this.fallbackMesh.position.y = ROBO_ENEMY_HEIGHT / 2
    this.root.add(this.fallbackMesh)

    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(BODY_RADIUS),
      position: new CANNON.Vec3(position.x, ROBO_ENEMY_HEIGHT / 2, position.z),
      type: CANNON.Body.KINEMATIC,
    })
    this.world.addBody(this.body)

    this.patrolPoints = [
      new THREE.Vector3(position.x - ROBO_ENEMY_PATROL_DISTANCE, 0, position.z),
      new THREE.Vector3(position.x + ROBO_ENEMY_PATROL_DISTANCE, 0, position.z),
    ]

    void this.loadVisual()
  }

  private async loadVisual(): Promise<void> {
    const asset = await loadModelAsset()
    if (this.disposed) return

    const model = cloneSkeleton(asset.scene) as THREE.Group
    const animations = asset.animations.map((clip) => removeRootMotion(clip.clone()))

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.frustumCulled = false
      }
    })

    const initialBox = new THREE.Box3().setFromObject(model)
    const sourceHeight = Math.max(initialBox.max.y - initialBox.min.y, 0.001)
    const scale = (ROBO_ENEMY_HEIGHT / sourceHeight) * VISUAL_SCALE_CORRECTION
    model.scale.setScalar(scale)
    model.updateMatrixWorld(true)

    const scaledBox = new THREE.Box3().setFromObject(model)
    this.modelAnchor.position.y = -scaledBox.min.y
    this.modelAnchor.add(model)
    this.fallbackMesh.visible = false
    this.visualModel = model

    const mixerRoot = model.getObjectByName('CharacterArmature') ?? model
    this.mixer = new THREE.AnimationMixer(mixerRoot)

    const walkClip =
      animations.find((clip) => clip.name === 'CharacterArmature|Walk') ??
      animations.find((clip) => clip.name.toLowerCase().includes('walk'))
    const deathClip =
      animations.find((clip) => clip.name === 'CharacterArmature|Death') ??
      animations.find((clip) => clip.name.toLowerCase().includes('death'))

    if (walkClip) {
      this.walkAction = this.mixer.clipAction(walkClip)
      this.walkAction.setLoop(THREE.LoopRepeat, Infinity)
      this.walkAction.play()
    }

    if (deathClip) {
      this.deathAction = this.mixer.clipAction(deathClip)
      this.deathAction.setLoop(THREE.LoopOnce, 1)
      this.deathAction.clampWhenFinished = true
    }
  }

  private applyMovement(dt: number): void {
    const target = this.patrolPoints[this.patrolIndex]
    this.tmpVec.set(target.x - this.root.position.x, 0, target.z - this.root.position.z)
    const distanceToTarget = this.tmpVec.length()

    if (distanceToTarget < 0.5) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length
      return
    }

    this.tmpVec.normalize()
    this.moveDir.lerp(this.tmpVec, Math.min(1, dt * TURN_SPEED)).normalize()
    this.root.position.addScaledVector(this.moveDir, ROBO_ENEMY_PATROL_SPEED * dt)
  }

  private applyKnockback(dt: number): void {
    this.root.position.addScaledVector(this.knockbackVelocity, dt)
    const damping = Math.max(0, 1 - ROBO_ENEMY_KNOCKBACK_DAMPING * dt)
    this.knockbackVelocity.multiplyScalar(damping)
  }

  private syncBody(): void {
    this.body.position.set(this.root.position.x, ROBO_ENEMY_HEIGHT / 2, this.root.position.z)
  }

  private updateFacing(): void {
    const velocitySq = this.moveDir.lengthSq() + this.knockbackVelocity.lengthSq()
    if (velocitySq < 0.0001) return

    const facingX = this.dead ? this.knockbackVelocity.x : this.moveDir.x
    const facingZ = this.dead ? this.knockbackVelocity.z : this.moveDir.z
    if (Math.abs(facingX) < 0.0001 && Math.abs(facingZ) < 0.0001) return

    this.root.rotation.y = Math.atan2(facingX, facingZ)
  }

  private snapVisualToGround(): void {
    if (!this.visualModel) return

    this.visualBounds.setFromObject(this.visualModel)
    this.modelAnchor.position.y -= this.visualBounds.min.y + VISUAL_FOOT_CONTACT_OFFSET
  }

  private die(): void {
    if (this.dead) return
    this.dead = true
    this.body.collisionFilterMask = 0

    if (this.walkAction) {
      this.walkAction.stop()
    }

    if (this.deathAction) {
      this.deathAction.reset()
      this.deathAction.play()
    }
  }

  update(dt: number): void {
    if (!this.dead) {
      this.applyMovement(dt)
    }

    this.applyKnockback(dt)
    this.updateFacing()
    this.mixer?.update(dt)
    this.snapVisualToGround()
    this.syncBody()
  }

  checkProjectileHits(projectiles: Projectile[]): Set<number> {
    const hitIndices = new Set<number>()
    if (this.dead) return hitIndices

    for (let index = 0; index < projectiles.length; index++) {
      const projectile = projectiles[index]
      const dx = projectile.body.position.x - this.root.position.x
      const dy = projectile.body.position.y - this.body.position.y
      const dz = projectile.body.position.z - this.root.position.z
      if (dx * dx + dy * dy + dz * dz > HIT_RADIUS_SQ) {
        continue
      }

      const impactDirection = new THREE.Vector3(
        projectile.body.velocity.x,
        0,
        projectile.body.velocity.z
      )
      if (impactDirection.lengthSq() > 0.0001) {
        impactDirection.normalize().multiplyScalar(projectile.knockback)
        this.knockbackVelocity.add(impactDirection)
      }

      this.health = Math.max(0, this.health - projectile.damage)
      if (this.health === 0) {
        this.die()
      }

      hitIndices.add(index)
    }

    return hitIndices
  }

  dispose(): void {
    this.disposed = true
    this.scene.remove(this.root)
    this.world.removeBody(this.body)
    this.fallbackMesh.geometry.dispose()
    if (Array.isArray(this.fallbackMesh.material)) {
      for (const material of this.fallbackMesh.material) {
        material.dispose()
      }
    } else {
      this.fallbackMesh.material.dispose()
    }
  }
}
