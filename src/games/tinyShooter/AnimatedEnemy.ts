import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { EnemyBehavior } from './enemyBehaviors'
import type { LevelActor, ActorUpdateContext, PlayerContactEffect } from './actorTypes'
import type { EnemyArchetype } from './enemyTypes'
import type { Projectile } from './gameTypes'

const TURN_SPEED = 8
const ROOT_MOTION_NODE_NAMES = new Set(['CharacterArmature', 'RootNode', 'Armature'])

const loader = new GLTFLoader()
const modelAssetCache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>()

export interface AnimatedEnemyOptions {
  label?: string
  keepFallbackVisible?: boolean
  labelHeight?: number
  debugColor?: number
}

async function loadModelAsset(modelPath: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  if (!modelAssetCache.has(modelPath)) {
    modelAssetCache.set(
      modelPath,
      loader.loadAsync(modelPath).then((gltf) => ({
        scene: gltf.scene,
        animations: gltf.animations,
      }))
    )
  }

  return modelAssetCache.get(modelPath)!
}

async function loadModelInstance(
  modelPath: string,
  useDirectScene: boolean,
): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  if (useDirectScene) {
    const gltf = await loader.loadAsync(modelPath)
    return {
      scene: gltf.scene,
      animations: gltf.animations,
    }
  }

  const asset = await loadModelAsset(modelPath)
  return {
    scene: cloneSkeleton(asset.scene) as THREE.Group,
    animations: asset.animations,
  }
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

function forceMaterialOpaque(material: THREE.Material): void {
  material.transparent = false
  material.opacity = 1
  material.depthWrite = true
  material.alphaTest = 0
  material.needsUpdate = true

  if (material instanceof THREE.MeshStandardMaterial) {
    material.alphaMap = null
    material.metalness = 0
    material.roughness = 0.6
  }

  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.transmission = 0
  }
}

export class AnimatedEnemy implements LevelActor {
  readonly body: CANNON.Body
  readonly root = new THREE.Group()

  private readonly config: EnemyArchetype
  private readonly scene: THREE.Scene
  private readonly world: CANNON.World
  private readonly behavior: EnemyBehavior
  private readonly moveDir = new THREE.Vector3(1, 0, 0)
  private readonly knockbackVelocity = new THREE.Vector3()
  private readonly toTarget = new THREE.Vector3()
  private readonly modelAnchor = new THREE.Group()
  private readonly visualBounds = new THREE.Box3()
  private readonly fallbackMesh: THREE.Mesh
  private readonly hitRadiusSq: number
  private readonly options: AnimatedEnemyOptions
  private labelSprite: THREE.Sprite | null = null

  private mixer: THREE.AnimationMixer | null = null
  private walkAction: THREE.AnimationAction | null = null
  private deathAction: THREE.AnimationAction | null = null
  private visualModel: THREE.Object3D | null = null
  private health: number
  private disposed = false

  dead = false

  get isAlive(): boolean {
    return !this.dead
  }

  constructor(
    world: CANNON.World,
    scene: THREE.Scene,
    position: { x: number; z: number },
    config: EnemyArchetype,
    behavior: EnemyBehavior,
    options: AnimatedEnemyOptions = {},
  ) {
    this.world = world
    this.scene = scene
    this.config = config
    this.behavior = behavior
    this.options = options
    this.health = config.health
    this.hitRadiusSq = config.hitRadius * config.hitRadius

    this.root.position.set(position.x, 0, position.z)
    this.scene.add(this.root)
    this.root.add(this.modelAnchor)

    this.fallbackMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(config.bodyRadius * 0.8, config.height - config.bodyRadius * 1.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0x441100, emissiveIntensity: 1.2 })
    )
    if (options.keepFallbackVisible) {
      const fallbackMaterial = this.fallbackMesh.material as THREE.MeshStandardMaterial
      fallbackMaterial.transparent = true
      fallbackMaterial.opacity = 0.22
    }
    this.fallbackMesh.position.y = config.height / 2
    this.root.add(this.fallbackMesh)

    if (options.label) {
      this.labelSprite = createLabelSprite(options.label)
      this.labelSprite.position.set(0, options.labelHeight ?? config.height + 2.5, 0)
      this.root.add(this.labelSprite)
    }

    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(config.bodyRadius),
      position: new CANNON.Vec3(position.x, config.height / 2, position.z),
      type: CANNON.Body.KINEMATIC,
    })
    this.world.addBody(this.body)

    void this.loadVisual()
  }

  private async loadVisual(): Promise<void> {
    const asset = await loadModelInstance(
      this.config.model.modelPath,
      this.config.model.useDirectScene === true,
    )
    if (this.disposed) return

    const model = asset.scene
    const animations = asset.animations.map((clip) => removeRootMotion(clip.clone()))

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.frustumCulled = false
        if (this.config.model.forceOpaqueMaterials) {
          if (Array.isArray(child.material)) {
            child.material.forEach(forceMaterialOpaque)
          } else if (child.material) {
            forceMaterialOpaque(child.material)
          }
        }
        if (this.options.debugColor !== undefined) {
          child.material = new THREE.MeshStandardMaterial({
            color: this.options.debugColor,
            emissive: this.options.debugColor,
            emissiveIntensity: 0.18,
            roughness: 0.45,
            metalness: 0.15,
          })
        }
      }
    })

    const initialBox = new THREE.Box3().setFromObject(model)
    const sourceHeight = Math.max(initialBox.max.y - initialBox.min.y, 0.001)
    const scale = (this.config.height / sourceHeight) * this.config.model.visualScaleCorrection
    model.scale.setScalar(scale)
    model.updateMatrixWorld(true)

    const scaledBox = new THREE.Box3().setFromObject(model)
    this.modelAnchor.position.y = -scaledBox.min.y
    this.modelAnchor.add(model)
    this.fallbackMesh.visible = !!this.options.keepFallbackVisible
    this.visualModel = model

    const mixerRoot = model.getObjectByName('CharacterArmature') ?? model
    this.mixer = new THREE.AnimationMixer(mixerRoot)

    const walkClip =
      animations.find((clip) => clip.name === this.config.model.walkAnimation) ??
      animations.find((clip) => clip.name.toLowerCase().includes('walk'))
    const deathClip =
      animations.find((clip) => clip.name === this.config.model.deathAnimation) ??
      animations.find((clip) => clip.name.toLowerCase().includes('dead') || clip.name.toLowerCase().includes('death'))

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

  moveToward(target: THREE.Vector3, dt: number): boolean {
    this.toTarget.set(target.x - this.root.position.x, 0, target.z - this.root.position.z)
    const distanceToTarget = this.toTarget.length()
    if (distanceToTarget < 0.5) {
      return true
    }

    this.toTarget.normalize()
    this.moveDir.lerp(this.toTarget, Math.min(1, dt * TURN_SPEED)).normalize()
    this.root.position.addScaledVector(this.moveDir, this.config.moveSpeed * dt)
    return false
  }

  getPosition(): THREE.Vector3 {
    return this.root.position
  }

  private applyKnockback(dt: number): void {
    this.root.position.addScaledVector(this.knockbackVelocity, dt)
    const damping = Math.max(0, 1 - this.config.knockbackDamping * dt)
    this.knockbackVelocity.multiplyScalar(damping)
  }

  private syncBody(): void {
    this.body.position.set(this.root.position.x, this.config.height / 2, this.root.position.z)
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
    this.modelAnchor.position.y = -(this.visualBounds.min.y + this.config.model.visualFootContactOffset)
  }

  private die(): void {
    if (this.dead) return
    this.dead = true
    this.body.collisionFilterMask = 0
    this.walkAction?.stop()

    if (this.deathAction) {
      this.deathAction.reset()
      this.deathAction.play()
    }
  }

  update(dt: number, context: ActorUpdateContext): void {
    if (!this.dead) {
      this.behavior.update(this, dt, context)
    }

    this.applyKnockback(dt)
    this.updateFacing()
    this.mixer?.update(dt)
    this.snapVisualToGround()
    this.syncBody()
  }

  collectProjectileHits(projectiles: Projectile[]): number[] {
    const hitIndices: number[] = []
    if (this.dead) return hitIndices

    for (let index = 0; index < projectiles.length; index++) {
      const projectile = projectiles[index]
      const dx = projectile.body.position.x - this.root.position.x
      const dy = projectile.body.position.y - this.body.position.y
      const dz = projectile.body.position.z - this.root.position.z
      if (dx * dx + dy * dy + dz * dz > this.hitRadiusSq) {
        continue
      }

      const impactDirection = new THREE.Vector3(projectile.body.velocity.x, 0, projectile.body.velocity.z)
      if (impactDirection.lengthSq() > 0.0001) {
        impactDirection.normalize().multiplyScalar(projectile.knockback)
        this.knockbackVelocity.add(impactDirection)
      }

      this.health = Math.max(0, this.health - projectile.damage)
      if (this.health === 0) {
        this.die()
      }

      hitIndices.push(index)
    }

    return hitIndices
  }

  getPlayerContactEffect(_playerPosition: THREE.Vector3): PlayerContactEffect | null {
    return null
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

    if (this.labelSprite) {
      this.labelSprite.geometry.dispose()
      this.labelSprite.material.map?.dispose()
      if (Array.isArray(this.labelSprite.material)) {
        for (const material of this.labelSprite.material) {
          material.dispose()
        }
      } else {
        this.labelSprite.material.dispose()
      }
    }
  }
}

function createLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('2D canvas context is required to create enemy labels')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(15, 15, 18, 0.8)'
  context.beginPath()
  context.roundRect(20, 18, canvas.width - 40, canvas.height - 36, 24)
  context.fill()

  context.lineWidth = 6
  context.strokeStyle = '#f6e05e'
  context.stroke()

  context.font = 'bold 72px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#ffffff'
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 4)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(4.8, 2.4, 1)
  return sprite
}
