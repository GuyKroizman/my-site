import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import {
  GIANT_WALK_SPEED,
  GIANT_WANDER_INTERVAL,
  GIANT_AGGRO_RANGE,
  GIANT_CHASE_SPEED,
  GROUND_SIZE,
} from './types'

const WALK_ANIM_SPEED = 2.5
const MAX_HIP_SWING = 0.4
const MAX_KNEE_BEND = 0.5
const MAX_SHOULDER_SWING = 0.3
const MAX_ELBOW_BEND = 0.3

const SKIN_COLOR = 0xc4956a
const TORSO_COLOR = 0x4a2800
const LEG_COLOR = 0x2a2a4a

// All dimensions are 2x the original (giant is now 34 units tall)
const S = 2

export class Giant {
  private group: THREE.Group
  body: CANNON.Body

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

  constructor(world: CANNON.World, scene: THREE.Scene, position: { x: number; z: number }) {
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

  private buildBody(
    skinMat: THREE.MeshStandardMaterial,
    torsoMat: THREE.MeshStandardMaterial,
    legMat: THREE.MeshStandardMaterial,
  ): void {
    // Torso group at center of torso
    const torsoGroup = new THREE.Group()
    torsoGroup.position.y = 11.5 * S
    this.group.add(torsoGroup)

    const torsoGeo = new THREE.BoxGeometry(4.0 * S, 6.0 * S, 2.5 * S)
    this.geometries.push(torsoGeo)
    torsoGroup.add(new THREE.Mesh(torsoGeo, torsoMat))

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

    // --- Arms ---
    this.leftShoulderPivot = new THREE.Group()
    this.leftShoulderPivot.position.set(-2.6 * S, 2.5 * S, 0)
    torsoGroup.add(this.leftShoulderPivot)

    const upperArmGeo = new THREE.BoxGeometry(1.2 * S, 3.5 * S, 1.2 * S)
    this.geometries.push(upperArmGeo)
    const leftUpperArm = new THREE.Mesh(upperArmGeo, skinMat)
    leftUpperArm.position.y = -1.75 * S
    this.leftShoulderPivot.add(leftUpperArm)

    this.leftElbowPivot = new THREE.Group()
    this.leftElbowPivot.position.y = -3.5 * S
    this.leftShoulderPivot.add(this.leftElbowPivot)

    const lowerArmGeo = new THREE.BoxGeometry(1.0 * S, 3.0 * S, 1.0 * S)
    this.geometries.push(lowerArmGeo)
    const leftLowerArm = new THREE.Mesh(lowerArmGeo, skinMat)
    leftLowerArm.position.y = -1.5 * S
    this.leftElbowPivot.add(leftLowerArm)

    this.rightShoulderPivot = new THREE.Group()
    this.rightShoulderPivot.position.set(2.6 * S, 2.5 * S, 0)
    torsoGroup.add(this.rightShoulderPivot)

    const rightUpperArm = new THREE.Mesh(upperArmGeo, skinMat)
    rightUpperArm.position.y = -1.75 * S
    this.rightShoulderPivot.add(rightUpperArm)

    this.rightElbowPivot = new THREE.Group()
    this.rightElbowPivot.position.y = -3.5 * S
    this.rightShoulderPivot.add(this.rightElbowPivot)

    const rightLowerArm = new THREE.Mesh(lowerArmGeo, skinMat)
    rightLowerArm.position.y = -1.5 * S
    this.rightElbowPivot.add(rightLowerArm)

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

  update(dt: number, playerPos: THREE.Vector3): void {
    const dx = playerPos.x - this.group.position.x
    const dz = playerPos.z - this.group.position.z
    const distToPlayer = Math.sqrt(dx * dx + dz * dz)

    let speed: number
    if (distToPlayer < GIANT_AGGRO_RANGE) {
      // Chase player
      const invDist = 1 / distToPlayer
      this.wanderDirX = dx * invDist
      this.wanderDirZ = dz * invDist
      speed = GIANT_CHASE_SPEED
    } else {
      // Wander
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

    // Face movement direction
    this.group.rotation.y = Math.atan2(this.wanderDirX, this.wanderDirZ)

    // Walking animation
    const animSpeed = distToPlayer < GIANT_AGGRO_RANGE
      ? WALK_ANIM_SPEED * (GIANT_CHASE_SPEED / GIANT_WALK_SPEED)
      : WALK_ANIM_SPEED
    this.walkPhase += dt * animSpeed

    // Legs
    this.leftHipPivot.rotation.x = Math.sin(this.walkPhase) * MAX_HIP_SWING
    this.rightHipPivot.rotation.x = Math.sin(this.walkPhase + Math.PI) * MAX_HIP_SWING

    this.leftKneePivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + 0.5)) * MAX_KNEE_BEND
    this.rightKneePivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + Math.PI + 0.5)) * MAX_KNEE_BEND

    // Arms (opposite to legs)
    this.leftShoulderPivot.rotation.x = Math.sin(this.walkPhase + Math.PI) * MAX_SHOULDER_SWING
    this.rightShoulderPivot.rotation.x = Math.sin(this.walkPhase) * MAX_SHOULDER_SWING

    this.leftElbowPivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + Math.PI + 0.5)) * MAX_ELBOW_BEND
    this.rightElbowPivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + 0.5)) * MAX_ELBOW_BEND

    // Sync physics body
    this.body.position.set(this.group.position.x, 8.5 * S, this.group.position.z)
  }

  dispose(scene: THREE.Scene, world: CANNON.World): void {
    world.removeBody(this.body)
    scene.remove(this.group)
    for (const geo of this.geometries) geo.dispose()
    for (const mat of this.materials) mat.dispose()
  }
}
