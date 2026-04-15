import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import {
  GIANT_WALK_SPEED,
  GIANT_WANDER_INTERVAL,
  GIANT_AGGRO_RANGE,
  GIANT_CHASE_SPEED,
  GROUND_SIZE,
} from './types'
import type { Projectile } from './types'
import { GiantSound } from './GiantSound'

const WALK_ANIM_SPEED = 2.5
const MAX_HIP_SWING = 0.4
const MAX_KNEE_BEND = 0.5
const MAX_SHOULDER_SWING = 0.3
const MAX_ELBOW_BEND = 0.3

const SKIN_COLOR = 0xc4956a
const TORSO_COLOR = 0x4a2800
const LEG_COLOR = 0x2a2a4a

const S = 2

// Torso grid
const TORSO_COLS = 3
const TORSO_ROWS = 10
const TORSO_W = 4.0 * S
const TORSO_H = 6.0 * S
const TORSO_D = 2.5 * S

// Arm box counts
const ARM_UPPER_COUNT = 10
const ARM_LOWER_COUNT = 9

const HIT_RADIUS_SQ = 3.0 * 3.0
const FALLING_GRAVITY = -40

interface BodyBlock {
  mesh: THREE.Mesh
  alive: boolean
}

interface FallingBlock {
  mesh: THREE.Mesh
  vx: number
  vy: number
  vz: number
  grounded: boolean
  lingerTime: number
}

export class Giant {
  private group: THREE.Group
  body: CANNON.Body
  dead = false

  private leftHipPivot!: THREE.Group
  private rightHipPivot!: THREE.Group
  private leftKneePivot!: THREE.Group
  private rightKneePivot!: THREE.Group
  private leftShoulderPivot!: THREE.Group
  private rightShoulderPivot!: THREE.Group
  private leftElbowPivot!: THREE.Group
  private rightElbowPivot!: THREE.Group

  private wanderDirX = 0
  private wanderDirZ = 1
  private wanderTimeLeft = 0
  private walkPhase = 0

  private geometries: THREE.BoxGeometry[] = []
  private materials: THREE.MeshStandardMaterial[] = []

  private torsoBlocks: BodyBlock[] = []
  private torsoAliveCount = TORSO_COLS * TORSO_ROWS

  private leftUpperArmBlocks: BodyBlock[] = []
  private leftLowerArmBlocks: BodyBlock[] = []
  private rightUpperArmBlocks: BodyBlock[] = []
  private rightLowerArmBlocks: BodyBlock[] = []

  private fallingBlocks: FallingBlock[] = []
  private scene: THREE.Scene
  private world: CANNON.World
  private sound = new GiantSound()

  private tmpVec = new THREE.Vector3()
  private tmpQuat = new THREE.Quaternion()

  constructor(world: CANNON.World, scene: THREE.Scene, position: { x: number; z: number }) {
    this.scene = scene
    this.world = world
    this.group = new THREE.Group()
    this.group.position.set(position.x, 0, position.z)

    const skinMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR })
    const torsoMat = new THREE.MeshStandardMaterial({ color: TORSO_COLOR })
    const legMat = new THREE.MeshStandardMaterial({ color: LEG_COLOR })
    this.materials.push(skinMat, torsoMat, legMat)

    this.buildBody(skinMat, torsoMat, legMat)

    scene.add(this.group)

    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(2.0 * S, 8.5 * S, 1.25 * S)),
      position: new CANNON.Vec3(position.x, 8.5 * S, position.z),
      type: CANNON.Body.KINEMATIC,
    })
    world.addBody(this.body)

    this.pickNewWanderDirection()
  }

  private buildArmColumn(
    parent: THREE.Group,
    w: number, totalH: number, d: number,
    count: number, mat: THREE.MeshStandardMaterial,
  ): BodyBlock[] {
    const boxH = totalH / count
    const geo = new THREE.BoxGeometry(w * 0.92, boxH * 0.92, d * 0.92)
    this.geometries.push(geo)
    const blocks: BodyBlock[] = []
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.y = -(i + 0.5) * boxH
      parent.add(mesh)
      blocks.push({ mesh, alive: true })
    }
    return blocks
  }

  private buildBody(
    skinMat: THREE.MeshStandardMaterial,
    torsoMat: THREE.MeshStandardMaterial,
    legMat: THREE.MeshStandardMaterial,
  ): void {
    // Torso group at center of torso
    const torsoGroup = new THREE.Group()
    torsoGroup.position.y = 11.5 * S
    this.group.add(torsoGroup)

    // Torso: 10x30 grid of boxes
    const blockW = TORSO_W / TORSO_COLS
    const blockH = TORSO_H / TORSO_ROWS
    const torsoBlockGeo = new THREE.BoxGeometry(blockW * 0.92, blockH * 0.92, TORSO_D * 0.92)
    this.geometries.push(torsoBlockGeo)

    for (let row = 0; row < TORSO_ROWS; row++) {
      for (let col = 0; col < TORSO_COLS; col++) {
        const mesh = new THREE.Mesh(torsoBlockGeo, torsoMat)
        mesh.position.set(
          -TORSO_W / 2 + blockW / 2 + col * blockW,
          -TORSO_H / 2 + blockH / 2 + row * blockH,
          0,
        )
        torsoGroup.add(mesh)
        this.torsoBlocks.push({ mesh, alive: true })
      }
    }

    // Head
    const headGeo = new THREE.BoxGeometry(2.5 * S, 2.5 * S, 2.5 * S)
    this.geometries.push(headGeo)
    const head = new THREE.Mesh(headGeo, skinMat)
    head.position.y = 4.25 * S
    torsoGroup.add(head)

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.4 * S, 0.4 * S, 0.1 * S)
    this.geometries.push(eyeGeo)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x880000 })
    this.materials.push(eyeMat)
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
    leftEye.position.set(-0.5 * S, 4.5 * S, 1.3 * S)
    torsoGroup.add(leftEye)
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
    rightEye.position.set(0.5 * S, 4.5 * S, 1.3 * S)
    torsoGroup.add(rightEye)

    // --- Left arm ---
    this.leftShoulderPivot = new THREE.Group()
    this.leftShoulderPivot.position.set(-2.6 * S, 2.5 * S, 0)
    torsoGroup.add(this.leftShoulderPivot)

    this.leftUpperArmBlocks = this.buildArmColumn(
      this.leftShoulderPivot,
      1.2 * S, 3.5 * S, 1.2 * S,
      ARM_UPPER_COUNT, skinMat,
    )

    this.leftElbowPivot = new THREE.Group()
    this.leftElbowPivot.position.y = -3.5 * S
    this.leftShoulderPivot.add(this.leftElbowPivot)

    this.leftLowerArmBlocks = this.buildArmColumn(
      this.leftElbowPivot,
      1.0 * S, 3.0 * S, 1.0 * S,
      ARM_LOWER_COUNT, skinMat,
    )

    // --- Right arm ---
    this.rightShoulderPivot = new THREE.Group()
    this.rightShoulderPivot.position.set(2.6 * S, 2.5 * S, 0)
    torsoGroup.add(this.rightShoulderPivot)

    this.rightUpperArmBlocks = this.buildArmColumn(
      this.rightShoulderPivot,
      1.2 * S, 3.5 * S, 1.2 * S,
      ARM_UPPER_COUNT, skinMat,
    )

    this.rightElbowPivot = new THREE.Group()
    this.rightElbowPivot.position.y = -3.5 * S
    this.rightShoulderPivot.add(this.rightElbowPivot)

    this.rightLowerArmBlocks = this.buildArmColumn(
      this.rightElbowPivot,
      1.0 * S, 3.0 * S, 1.0 * S,
      ARM_LOWER_COUNT, skinMat,
    )

    // --- Legs ---
    this.leftHipPivot = new THREE.Group()
    this.leftHipPivot.position.set(-1.0 * S, 8.5 * S, 0)
    this.group.add(this.leftHipPivot)

    const upperLegGeo = new THREE.BoxGeometry(1.5 * S, 4.5 * S, 1.5 * S)
    this.geometries.push(upperLegGeo)
    const leftUpperLeg = new THREE.Mesh(upperLegGeo, legMat)
    leftUpperLeg.position.y = -2.25 * S
    this.leftHipPivot.add(leftUpperLeg)

    this.leftKneePivot = new THREE.Group()
    this.leftKneePivot.position.y = -4.5 * S
    this.leftHipPivot.add(this.leftKneePivot)

    const lowerLegGeo = new THREE.BoxGeometry(1.3 * S, 4.0 * S, 1.3 * S)
    this.geometries.push(lowerLegGeo)
    const leftLowerLeg = new THREE.Mesh(lowerLegGeo, legMat)
    leftLowerLeg.position.y = -2.0 * S
    this.leftKneePivot.add(leftLowerLeg)

    this.rightHipPivot = new THREE.Group()
    this.rightHipPivot.position.set(1.0 * S, 8.5 * S, 0)
    this.group.add(this.rightHipPivot)

    const rightUpperLeg = new THREE.Mesh(upperLegGeo, legMat)
    rightUpperLeg.position.y = -2.25 * S
    this.rightHipPivot.add(rightUpperLeg)

    this.rightKneePivot = new THREE.Group()
    this.rightKneePivot.position.y = -4.5 * S
    this.rightHipPivot.add(this.rightKneePivot)

    const rightLowerLeg = new THREE.Mesh(lowerLegGeo, legMat)
    rightLowerLeg.position.y = -2.0 * S
    this.rightKneePivot.add(rightLowerLeg)
  }

  private pickNewWanderDirection(): void {
    const angle = Math.random() * Math.PI * 2
    this.wanderDirX = Math.sin(angle)
    this.wanderDirZ = Math.cos(angle)
    this.wanderTimeLeft = GIANT_WANDER_INTERVAL
  }

  private spawnFallingBlock(mesh: THREE.Mesh, scatter = false): void {
    mesh.getWorldPosition(this.tmpVec)
    mesh.getWorldQuaternion(this.tmpQuat)
    mesh.removeFromParent()

    mesh.position.copy(this.tmpVec)
    mesh.quaternion.copy(this.tmpQuat)
    this.scene.add(mesh)

    const spreadXZ = scatter ? 12 : 0
    const upBoost = scatter ? Math.random() * 10 + 4 : 0
    this.fallingBlocks.push({
      mesh,
      vx: (Math.random() - 0.5) * spreadXZ,
      vy: upBoost,
      vz: (Math.random() - 0.5) * spreadXZ,
      grounded: false,
      lingerTime: 0,
    })
  }

  private destroyTorsoBlock(index: number): void {
    const block = this.torsoBlocks[index]
    if (!block.alive) return
    block.alive = false
    this.torsoAliveCount--
    this.spawnFallingBlock(block.mesh)
  }

  private destroyArmBlocksFrom(blocks: BodyBlock[], fromIndex: number, cascade: BodyBlock[] | null): void {
    for (let i = fromIndex; i < blocks.length; i++) {
      if (!blocks[i].alive) continue
      blocks[i].alive = false
      this.spawnFallingBlock(blocks[i].mesh)
    }
    if (cascade) {
      for (const block of cascade) {
        if (!block.alive) continue
        block.alive = false
        this.spawnFallingBlock(block.mesh)
      }
    }
  }

  private die(): void {
    if (this.dead) return
    this.dead = true
    this.world.removeBody(this.body)
    this.sound.playDeath()

    this.group.updateMatrixWorld(true)
    const meshes: THREE.Mesh[] = []
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child)
    })

    for (const mesh of meshes) {
      this.spawnFallingBlock(mesh, true)
    }

    this.scene.remove(this.group)
  }

  checkProjectileHits(projectiles: Projectile[]): Set<number> {
    const hitIndices = new Set<number>()
    if (this.dead) return hitIndices

    this.group.updateMatrixWorld(true)

    for (let pi = 0; pi < projectiles.length; pi++) {
      const pp = projectiles[pi].body.position

      // Check torso blocks
      let hit = false
      for (let bi = 0; bi < this.torsoBlocks.length; bi++) {
        const block = this.torsoBlocks[bi]
        if (!block.alive) continue
        block.mesh.getWorldPosition(this.tmpVec)
        const dx = pp.x - this.tmpVec.x
        const dy = pp.y - this.tmpVec.y
        const dz = pp.z - this.tmpVec.z
        if (dx * dx + dy * dy + dz * dz < HIT_RADIUS_SQ) {
          this.destroyTorsoBlock(bi)
          this.sound.playHit()
          hitIndices.add(pi)
          hit = true
          break
        }
      }
      if (hit) continue

      // Check arm blocks: [blocks, cascade]
      const armSegments: [BodyBlock[], BodyBlock[] | null][] = [
        [this.leftUpperArmBlocks, this.leftLowerArmBlocks],
        [this.leftLowerArmBlocks, null],
        [this.rightUpperArmBlocks, this.rightLowerArmBlocks],
        [this.rightLowerArmBlocks, null],
      ]

      for (const [blocks, cascade] of armSegments) {
        if (hit) break
        for (let bi = 0; bi < blocks.length; bi++) {
          if (!blocks[bi].alive) continue
          blocks[bi].mesh.getWorldPosition(this.tmpVec)
          const dx = pp.x - this.tmpVec.x
          const dy = pp.y - this.tmpVec.y
          const dz = pp.z - this.tmpVec.z
          if (dx * dx + dy * dy + dz * dz < HIT_RADIUS_SQ) {
            this.destroyArmBlocksFrom(blocks, bi, cascade)
            this.sound.playHit()
            hitIndices.add(pi)
            hit = true
            break
          }
        }
      }
    }

    // Death check: more than half the torso is gone
    if (!this.dead && this.torsoAliveCount <= (TORSO_COLS * TORSO_ROWS) / 2) {
      this.die()
    }

    return hitIndices
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // Update falling blocks
    for (let i = this.fallingBlocks.length - 1; i >= 0; i--) {
      const fb = this.fallingBlocks[i]

      if (fb.grounded) {
        fb.lingerTime += dt
        if (fb.lingerTime >= 5) {
          this.scene.remove(fb.mesh)
          this.fallingBlocks.splice(i, 1)
        }
        continue
      }

      fb.vy += FALLING_GRAVITY * dt
      fb.mesh.position.x += fb.vx * dt
      fb.mesh.position.y += fb.vy * dt
      fb.mesh.position.z += fb.vz * dt

      // Tumble while airborne
      fb.mesh.rotation.x += fb.vx * dt
      fb.mesh.rotation.z += fb.vz * dt

      if (fb.mesh.position.y <= 0.2) {
        fb.mesh.position.y = 0.2
        fb.grounded = true
        fb.lingerTime = 0
      }
    }

    if (this.dead) return

    // Movement
    const dx = playerPos.x - this.group.position.x
    const dz = playerPos.z - this.group.position.z
    const distToPlayer = Math.sqrt(dx * dx + dz * dz)

    let speed: number
    if (distToPlayer < GIANT_AGGRO_RANGE) {
      const invDist = 1 / distToPlayer
      this.wanderDirX = dx * invDist
      this.wanderDirZ = dz * invDist
      speed = GIANT_CHASE_SPEED
    } else {
      this.wanderTimeLeft -= dt
      if (this.wanderTimeLeft <= 0) {
        this.pickNewWanderDirection()
      }
      speed = GIANT_WALK_SPEED
    }

    const boundary = GROUND_SIZE / 2 - 5
    const newX = this.group.position.x + this.wanderDirX * speed * dt
    const newZ = this.group.position.z + this.wanderDirZ * speed * dt

    if (Math.abs(newX) > boundary || Math.abs(newZ) > boundary) {
      this.pickNewWanderDirection()
    } else {
      this.group.position.x = newX
      this.group.position.z = newZ
    }

    this.group.rotation.y = Math.atan2(this.wanderDirX, this.wanderDirZ)

    // Walking animation
    const animSpeed = distToPlayer < GIANT_AGGRO_RANGE
      ? WALK_ANIM_SPEED * (GIANT_CHASE_SPEED / GIANT_WALK_SPEED)
      : WALK_ANIM_SPEED
    this.walkPhase += dt * animSpeed

    this.leftHipPivot.rotation.x = Math.sin(this.walkPhase) * MAX_HIP_SWING
    this.rightHipPivot.rotation.x = Math.sin(this.walkPhase + Math.PI) * MAX_HIP_SWING

    this.leftKneePivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + 0.5)) * MAX_KNEE_BEND
    this.rightKneePivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + Math.PI + 0.5)) * MAX_KNEE_BEND

    this.leftShoulderPivot.rotation.x = Math.sin(this.walkPhase + Math.PI) * MAX_SHOULDER_SWING
    this.rightShoulderPivot.rotation.x = Math.sin(this.walkPhase) * MAX_SHOULDER_SWING

    this.leftElbowPivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + Math.PI + 0.5)) * MAX_ELBOW_BEND
    this.rightElbowPivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + 0.5)) * MAX_ELBOW_BEND

    this.body.position.set(this.group.position.x, 8.5 * S, this.group.position.z)
  }

  dispose(scene: THREE.Scene, world: CANNON.World): void {
    if (!this.dead) world.removeBody(this.body)
    scene.remove(this.group)
    for (const fb of this.fallingBlocks) scene.remove(fb.mesh)
    this.fallingBlocks.length = 0
    for (const geo of this.geometries) geo.dispose()
    for (const mat of this.materials) mat.dispose()
    this.sound.dispose()
  }
}
