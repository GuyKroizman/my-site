import { collectSolidMeshes } from './utils'

/**
 * Registers all custom A-Frame components used by Floaty McHandface.
 * Safe to call multiple times — each component guards against re-registration.
 */
export function registerFloatyComponents() {
  const AFRAME = (window as any).AFRAME
  if (!AFRAME) return

  registerPlayerMotion(AFRAME)
  registerPlayerHealth(AFRAME)
  registerHealthHud(AFRAME)
  registerShoulderCameraSync(AFRAME)
  registerArmConnector(AFRAME)
  registerHandWalker(AFRAME)
  registerCannonball(AFRAME)
  registerCannonShooter(AFRAME)
}

// ---------------------------------------------------------------------------
// player-motion
// Handles gravity, movement, and raycasted collision against all solid geometry.
// ---------------------------------------------------------------------------
function registerPlayerMotion(AFRAME: any) {
  if (AFRAME.components['player-motion']) return

  AFRAME.registerComponent('player-motion', {
    schema: {
      gravity: { type: 'number', default: -9.8 },
      damping: { type: 'number', default: 1.4 },
      maxSpeed: { type: 'number', default: 7 },
      bodyHalfWidth: { type: 'number', default: 0.2 },
      bodyHalfHeight: { type: 'number', default: 0.1 },
      bodyHalfDepth: { type: 'number', default: 0.1 },
      skinWidth: { type: 'number', default: 0.02 }
    },
    init: function () {
      this.velocity = new AFRAME.THREE.Vector3()
      this.raycaster = new AFRAME.THREE.Raycaster()
      this.rayOrigin = new AFRAME.THREE.Vector3()
      this.collisionInfo = { onGround: false, groundY: 0, hitWall: false }
    },
    applyPush: function (delta: { x: number; y: number; z: number }) {
      this.velocity.x += delta.x
      this.velocity.y += delta.y
      this.velocity.z += delta.z
      const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z)
      if (horizontalSpeed > this.data.maxSpeed) {
        const s = this.data.maxSpeed / horizontalSpeed
        this.velocity.x *= s
        this.velocity.z *= s
      }
      if (this.velocity.y > this.data.maxSpeed * 0.9) {
        this.velocity.y = this.data.maxSpeed * 0.9
      }
    },
    castRay: function (origin: any, dir: any, maxDist: number, meshes: any[]) {
      this.raycaster.set(origin, dir)
      this.raycaster.near = 0
      this.raycaster.far = maxDist
      const hits = this.raycaster.intersectObjects(meshes, true)
      return hits.length > 0 ? hits[0] : null
    },
    tick: function (_time: number, delta: number) {
      if (!delta) return

      // Wait for solid meshes before applying any physics so
      // the player doesn't fall through the floor during load.
      const meshes = collectSolidMeshes()
      if (meshes.length === 0) return

      const d = this.data
      const pos = this.el.object3D.position
      const maxFrameDt = 0.2
      const fixedStep = 1 / 90
      let remaining = Math.min(Math.max(delta / 1000, 0), maxFrameDt)

      this.collisionInfo.onGround = false
      this.collisionInfo.hitWall = false

      const dirs = [
        { x: 0, y: -1, z: 0, extent: d.bodyHalfHeight, axis: 'y' as const, sign: -1 },
        { x: 0, y: 1, z: 0, extent: d.bodyHalfHeight, axis: 'y' as const, sign: 1 },
        { x: 1, y: 0, z: 0, extent: d.bodyHalfWidth, axis: 'x' as const, sign: 1 },
        { x: -1, y: 0, z: 0, extent: d.bodyHalfWidth, axis: 'x' as const, sign: -1 },
        { x: 0, y: 0, z: 1, extent: d.bodyHalfDepth, axis: 'z' as const, sign: 1 },
        { x: 0, y: 0, z: -1, extent: d.bodyHalfDepth, axis: 'z' as const, sign: -1 },
      ]

      const dirVec = new AFRAME.THREE.Vector3()
      while (remaining > 0.000001) {
        const dt = Math.min(remaining, fixedStep)
        remaining -= dt

        this.velocity.y += d.gravity * dt

        const damp = Math.exp(-d.damping * dt)
        this.velocity.x *= damp
        this.velocity.z *= damp

        pos.x += this.velocity.x * dt
        pos.y += this.velocity.y * dt
        pos.z += this.velocity.z * dt

        this.rayOrigin.copy(pos)

        for (const dd of dirs) {
          dirVec.set(dd.x, dd.y, dd.z)
          const maxDist = dd.extent + d.skinWidth
          const hit = this.castRay(this.rayOrigin, dirVec, maxDist, meshes)
          if (hit && hit.distance < dd.extent + d.skinWidth) {
            const pushOut = dd.extent + d.skinWidth - hit.distance
            pos[dd.axis] -= dd.sign * pushOut

            if (dd.sign === 1 && (this.velocity as any)[dd.axis] > 0) {
              (this.velocity as any)[dd.axis] = 0
            }
            if (dd.sign === -1 && (this.velocity as any)[dd.axis] < 0) {
              (this.velocity as any)[dd.axis] = 0
            }
            if (dd.y === -1) {
              this.collisionInfo.onGround = true
              this.collisionInfo.groundY = hit.point.y
            }
            if (dd.x !== 0 || dd.z !== 0) {
              this.collisionInfo.hitWall = true
            }
            this.rayOrigin.copy(pos)
          }
        }
      }

      // Safety guard for VR mode transitions:
      // if a very bad frame ever pushes us far below the room floor,
      // snap back to the floor baseline instead of free-falling forever.
      const floorBaselineY = d.bodyHalfHeight + d.skinWidth
      if (pos.y < -1) {
        pos.y = floorBaselineY
        if (this.velocity.y < 0) this.velocity.y = 0
        this.collisionInfo.onGround = true
        this.collisionInfo.groundY = 0
      }
    }
  })
}

// ---------------------------------------------------------------------------
// shoulder-camera-sync
// Keeps VR camera anchored just above the shoulder entity.
// Emits debug events for the on-screen panel and updates the in-headset HUD.
// ---------------------------------------------------------------------------
function registerShoulderCameraSync(AFRAME: any) {
  if (AFRAME.components['shoulder-camera-sync']) return

  AFRAME.registerComponent('shoulder-camera-sync', {
    schema: {
      shoulderOffsetY: { type: 'number', default: 0.3 },
      lockHorizontal: { type: 'boolean', default: true },
      debugEveryMs: { type: 'number', default: 250 },
      debugEnabled: { type: 'boolean', default: false },
      shoulderTurnLerp: { type: 'number', default: 0.18 }
    },
    init: function () {
      this.playerBodyEntity = null
      this.shoulderEntity = null
      this.cameraEntity = null
      this.debugHudEntity = null
      this.bodyWorldPos = new AFRAME.THREE.Vector3()
      this.shoulderWorldPos = new AFRAME.THREE.Vector3()
      this.cameraWorldPos = new AFRAME.THREE.Vector3()
      this.targetCameraWorldPos = new AFRAME.THREE.Vector3()
      this.rigTargetPos = new AFRAME.THREE.Vector3()
      this.rigCurrentPos = new AFRAME.THREE.Vector3()
      this.cameraForward = new AFRAME.THREE.Vector3()
      this.flatForward = new AFRAME.THREE.Vector3()
      this.defaultForward = new AFRAME.THREE.Vector3(0, 0, -1)
      this.targetShoulderQuat = new AFRAME.THREE.Quaternion()
      this.debugLastSentAt = 0
    },
    tick: function (time: number) {
      if (!this.playerBodyEntity) {
        const bodyEntity = document.querySelector('#player-body') as any
        if (bodyEntity) this.playerBodyEntity = bodyEntity
        return
      }
      if (!this.cameraEntity) {
        this.cameraEntity = document.querySelector('#camera') as any
        return
      }
      if (!this.shoulderEntity) {
        this.shoulderEntity = document.querySelector('#shoulder-box') as any
        return
      }
      if (!this.debugHudEntity) {
        this.debugHudEntity = document.querySelector('#debug-hud') as any
      }

      this.playerBodyEntity.object3D.getWorldPosition(this.bodyWorldPos)
      this.shoulderEntity.object3D.getWorldPosition(this.shoulderWorldPos)

      const trackedLocalHead = this.cameraEntity.object3D.position

      this.targetCameraWorldPos.set(
        this.shoulderWorldPos.x,
        this.shoulderWorldPos.y + this.data.shoulderOffsetY,
        this.shoulderWorldPos.z
      )

      this.rigTargetPos.set(
        this.targetCameraWorldPos.x - (this.data.lockHorizontal ? trackedLocalHead.x : 0),
        this.targetCameraWorldPos.y - trackedLocalHead.y,
        this.targetCameraWorldPos.z - (this.data.lockHorizontal ? trackedLocalHead.z : 0)
      )
      this.el.object3D.position.copy(this.rigTargetPos)

      // Rotate shoulders to follow head yaw (horizontal look direction only).
      this.cameraEntity.object3D.getWorldDirection(this.cameraForward)
      this.flatForward.set(this.cameraForward.x, 0, this.cameraForward.z)
      if (this.flatForward.lengthSq() > 0.0001) {
        this.flatForward.normalize()
        this.targetShoulderQuat.setFromUnitVectors(this.defaultForward, this.flatForward)
        this.shoulderEntity.object3D.quaternion.slerp(
          this.targetShoulderQuat,
          Math.max(0, Math.min(1, this.data.shoulderTurnLerp))
        )
      }

      if (!this.data.debugEnabled) return
      if (time - this.debugLastSentAt < this.data.debugEveryMs) return
      this.debugLastSentAt = time

      this.cameraEntity.object3D.getWorldPosition(this.cameraWorldPos)
      this.el.object3D.getWorldPosition(this.rigCurrentPos)

      const errX = this.cameraWorldPos.x - this.targetCameraWorldPos.x
      const errY = this.cameraWorldPos.y - this.targetCameraWorldPos.y
      const errZ = this.cameraWorldPos.z - this.targetCameraWorldPos.z

      const manualMotion = this.playerBodyEntity?.components?.['player-motion']
      const bodyMode = manualMotion ? 'manual' : 'none'
      const bodyPhysicsPos = this.playerBodyEntity?.object3D?.position
      const bodyPhysicsVel = manualMotion?.velocity
      const handDebug = (window as any).__floatyHandDebug || {}
      const leftHandDebug = handDebug.left
      const rightHandDebug = handDebug.right
      const scene = this.el.sceneEl
      const isVr = scene ? scene.is('vr-mode') : false

      const debugLines = [
        `VR: ${isVr ? 'ON' : 'OFF'} | lockHorizontal: ${this.data.lockHorizontal ? 'ON' : 'OFF'}`,
        `physicsReady : ${bodyMode !== 'none' ? 'YES' : 'NO'} mode=${bodyMode}`,
        `bodyWorld    : x=${this.bodyWorldPos.x.toFixed(3)} y=${this.bodyWorldPos.y.toFixed(3)} z=${this.bodyWorldPos.z.toFixed(3)}`,
        `shoulderWorld: x=${this.shoulderWorldPos.x.toFixed(3)} y=${this.shoulderWorldPos.y.toFixed(3)} z=${this.shoulderWorldPos.z.toFixed(3)}`,
        `targetCamWorld: x=${this.targetCameraWorldPos.x.toFixed(3)} y=${this.targetCameraWorldPos.y.toFixed(3)} z=${this.targetCameraWorldPos.z.toFixed(3)}`,
        `actualCamWorld: x=${this.cameraWorldPos.x.toFixed(3)} y=${this.cameraWorldPos.y.toFixed(3)} z=${this.cameraWorldPos.z.toFixed(3)}`,
        `camError      : x=${errX.toFixed(3)} y=${errY.toFixed(3)} z=${errZ.toFixed(3)}`,
        `headLocal(rig): x=${trackedLocalHead.x.toFixed(3)} y=${trackedLocalHead.y.toFixed(3)} z=${trackedLocalHead.z.toFixed(3)}`,
        `rigWorld      : x=${this.rigCurrentPos.x.toFixed(3)} y=${this.rigCurrentPos.y.toFixed(3)} z=${this.rigCurrentPos.z.toFixed(3)}`,
        bodyPhysicsPos
          ? `physicsBody   : x=${bodyPhysicsPos.x.toFixed(3)} y=${bodyPhysicsPos.y.toFixed(3)} z=${bodyPhysicsPos.z.toFixed(3)}`
          : 'physicsBody   : missing',
        bodyPhysicsVel
          ? `gravityDiag   : bodyVelY=${bodyPhysicsVel.y.toFixed(3)} mode=${bodyMode}`
          : 'gravityDiag   : body velocity missing',
        bodyPhysicsPos
          ? `groundDiag    : bodyY=${bodyPhysicsPos.y.toFixed(3)} shoulderY=${this.shoulderWorldPos.y.toFixed(3)}`
          : 'groundDiag    : body position missing',
        leftHandDebug
          ? `leftPalm      : tracked=${leftHandDebug.tracked ? 'Y' : 'N'} contact=${leftHandDebug.contact ? 'Y' : 'N'} surface=${leftHandDebug.surface} y=${leftHandDebug.palmY.toFixed(3)} rawSpeed=${leftHandDebug.rawSpeed.toFixed(3)} pushH=${leftHandDebug.pushH.toFixed(3)} pushY=${leftHandDebug.pushY.toFixed(3)} pushMag=${leftHandDebug.pushMag.toFixed(3)}`
          : 'leftPalm      : missing',
        rightHandDebug
          ? `rightPalm     : tracked=${rightHandDebug.tracked ? 'Y' : 'N'} contact=${rightHandDebug.contact ? 'Y' : 'N'} surface=${rightHandDebug.surface} y=${rightHandDebug.palmY.toFixed(3)} rawSpeed=${rightHandDebug.rawSpeed.toFixed(3)} pushH=${rightHandDebug.pushH.toFixed(3)} pushY=${rightHandDebug.pushY.toFixed(3)} pushMag=${rightHandDebug.pushMag.toFixed(3)}`
          : 'rightPalm     : missing'
      ]

      window.dispatchEvent(new CustomEvent('floaty-vr-debug', { detail: debugLines.join('\n') }))

      if (this.debugHudEntity) {
        const bodyY = bodyPhysicsPos ? bodyPhysicsPos.y.toFixed(2) : 'na'
        const shoulderY = this.shoulderWorldPos.y.toFixed(2)
        const bodyGap = bodyPhysicsPos ? (bodyPhysicsPos.y - 0.10).toFixed(3) : 'na'
        const shoulderGap = (this.shoulderWorldPos.y - 0.10).toFixed(3)
        const bodyVelY = bodyPhysicsVel ? bodyPhysicsVel.y.toFixed(2) : 'na'
        const physicsReady = bodyMode !== 'none' ? 'Y' : 'N'
        const leftContact = leftHandDebug ? (leftHandDebug.contact ? 'Y' : 'N') : '?'
        const leftSurf = leftHandDebug ? leftHandDebug.surface : '?'
        const leftPush = leftHandDebug ? leftHandDebug.pushMag.toFixed(2) : 'na'
        const leftPushH = leftHandDebug ? leftHandDebug.pushH.toFixed(2) : 'na'
        const rightContact = rightHandDebug ? (rightHandDebug.contact ? 'Y' : 'N') : '?'
        const rightSurf = rightHandDebug ? rightHandDebug.surface : '?'
        const rightPush = rightHandDebug ? rightHandDebug.pushMag.toFixed(2) : 'na'
        const rightPushH = rightHandDebug ? rightHandDebug.pushH.toFixed(2) : 'na'
        const hudLines = [
          `phys:${physicsReady}/${bodyMode} vr:${isVr ? 'Y' : 'N'} bodyY:${bodyY} shoulderY:${shoulderY}`,
          `gap:${bodyGap} shoulderGap:${shoulderGap} bodyVy:${bodyVelY}`,
          `L ct:${leftContact} surf:${leftSurf} pH:${leftPushH} pT:${leftPush}`,
          `R ct:${rightContact} surf:${rightSurf} pH:${rightPushH} pT:${rightPush}`,
        ]
        const hudValue = hudLines.join('\n').split(';').join(',')
        this.debugHudEntity.setAttribute(
          'text',
          `value: ${hudValue}; color: #7CFF7C; width: 3.6; align: left; wrapCount: 64`
        )
      }
    }
  })
}

// ---------------------------------------------------------------------------
// arm-connector
// Draws a cylinder from the shoulder edge to each hand controller.
// ---------------------------------------------------------------------------
function registerArmConnector(AFRAME: any) {
  if (AFRAME.components['arm-connector']) return

  AFRAME.registerComponent('arm-connector', {
    schema: {
      hand: { type: 'string', default: 'left' }
    },
    init: function () {
      this.shoulderEdgePos = new AFRAME.THREE.Vector3()
      this.handPos = new AFRAME.THREE.Vector3()
      this.midpoint = new AFRAME.THREE.Vector3()
      this.direction = new AFRAME.THREE.Vector3()
      this.shoulderRight = new AFRAME.THREE.Vector3()
      this.cameraWorldQuat = new AFRAME.THREE.Quaternion()
      this.quaternion = new AFRAME.THREE.Quaternion()
      this.camera = null
      this.edgeOffset = this.data.hand === 'left' ? -0.22 : 0.22
    },
    tick: function () {
      const shoulder = document.querySelector('#shoulder-box') as any
      if (!shoulder) return

      if (!this.camera) {
        this.camera = document.querySelector('#camera') as any
      }

      shoulder.object3D.getWorldPosition(this.shoulderEdgePos)

      this.shoulderRight.set(1, 0, 0)
      if (this.camera) {
        this.camera.object3D.getWorldQuaternion(this.cameraWorldQuat)
        this.shoulderRight.applyQuaternion(this.cameraWorldQuat)
      }
      this.shoulderRight.y = 0
      if (this.shoulderRight.lengthSq() < 0.0001) {
        this.shoulderRight.set(1, 0, 0)
      } else {
        this.shoulderRight.normalize()
      }
      this.shoulderEdgePos.addScaledVector(this.shoulderRight, this.edgeOffset)

      this.el.object3D.getWorldPosition(this.handPos)

      this.direction.subVectors(this.shoulderEdgePos, this.handPos)
      const distance = this.direction.length()

      const armCylinder = this.el.querySelector('a-cylinder') as any
      if (!armCylinder) return

      this.midpoint.addVectors(this.handPos, this.shoulderEdgePos).multiplyScalar(0.5)
      const localMidpoint = this.el.object3D.worldToLocal(this.midpoint.clone())

      armCylinder.object3D.position.copy(localMidpoint)
      armCylinder.object3D.scale.y = distance / 0.5

      if (distance > 0.01) {
        const localShoulderEdge = this.el.object3D.worldToLocal(this.shoulderEdgePos.clone())
        const localDir = localShoulderEdge.sub(localMidpoint).normalize()
        const defaultDir = new AFRAME.THREE.Vector3(0, 1, 0)
        this.quaternion.setFromUnitVectors(defaultDir, localDir)
        armCylinder.object3D.quaternion.copy(this.quaternion)
      }
    }
  })
}

// ---------------------------------------------------------------------------
// hand-walker
// Detects palm contact with ANY solid surface via raycasting,
// then applies Gorilla-Tag style push locomotion.
// ---------------------------------------------------------------------------
function registerHandWalker(AFRAME: any) {
  if (AFRAME.components['hand-walker']) return

  AFRAME.registerComponent('hand-walker', {
    schema: {
      hand: { type: 'string', default: 'left' },
      contactDistance: { type: 'number', default: 0.15 },
      horizontalGain: { type: 'number', default: 24 },
      verticalGain: { type: 'number', default: 14 },
      maxSpeed: { type: 'number', default: 7 },
      minHandSpeed: { type: 'number', default: 0.02 },
      oneHandBoost: { type: 'number', default: 1.65 },
      contactGraceMs: { type: 'number', default: 90 }
    },
    init: function () {
      this.lastPalmPosition = new AFRAME.THREE.Vector3()
      this.currentPalmPosition = new AFRAME.THREE.Vector3()
      this.handDelta = new AFRAME.THREE.Vector3()
      this.handVelocity = new AFRAME.THREE.Vector3()
      this.pushVelocityDelta = new AFRAME.THREE.Vector3()
      this.isInContact = false
      this.contactSurfaceName = 'none'
      this.contactNormal = new AFRAME.THREE.Vector3()
      this.playerBody = null
      this.palmEntity = null
      this.didInitializePalmPosition = false
      this.lastContactAt = 0
      this.raycaster = new AFRAME.THREE.Raycaster()
      this.normalMatrix = new AFRAME.THREE.Matrix3()
      this.rayDirs = [
        new AFRAME.THREE.Vector3(0, -1, 0),
        new AFRAME.THREE.Vector3(0, 1, 0),
        new AFRAME.THREE.Vector3(1, 0, 0),
        new AFRAME.THREE.Vector3(-1, 0, 0),
        new AFRAME.THREE.Vector3(0, 0, 1),
        new AFRAME.THREE.Vector3(0, 0, -1),
      ]

      if (!(window as any).__floatyHandDebug) {
        ;(window as any).__floatyHandDebug = {}
      }
    },
    checkSurfaceContact: function (palmPos: any, meshes: any[]) {
      this.isInContact = false
      let closestDist = Infinity

      for (let i = 0; i < this.rayDirs.length; i++) {
        this.raycaster.set(palmPos, this.rayDirs[i])
        this.raycaster.near = 0
        this.raycaster.far = this.data.contactDistance
        const hits = this.raycaster.intersectObjects(meshes, true)
        if (hits.length > 0 && hits[0].distance < closestDist) {
          closestDist = hits[0].distance
          this.isInContact = true
          if (hits[0].face) {
            this.normalMatrix.getNormalMatrix(hits[0].object.matrixWorld)
            this.contactNormal.copy(hits[0].face.normal)
              .applyMatrix3(this.normalMatrix).normalize()
          } else {
            this.contactNormal.copy(this.rayDirs[i]).negate()
          }
          const parentName = hits[0].object?.parent?.el?.id
            || hits[0].object?.el?.id || 'unknown'
          this.contactSurfaceName = parentName
        }
      }
      return this.isInContact
    },
    tick: function (_time: number, delta: number) {
      if (!delta) return

      if (!this.playerBody) {
        this.playerBody = document.querySelector('#player-body') as any
        return
      }

      const manualMotion = this.playerBody.components?.['player-motion']
      if (!manualMotion) return

      if (!this.palmEntity) {
        this.palmEntity = this.el.querySelector('a-sphere') as any
      }

      const palmObject = this.palmEntity ? this.palmEntity.object3D : this.el.object3D
      palmObject.getWorldPosition(this.currentPalmPosition)

      if (!this.didInitializePalmPosition) {
        this.lastPalmPosition.copy(this.currentPalmPosition)
        this.didInitializePalmPosition = true
        return
      }

      const dt = Math.max(delta / 1000, 0.001)
      this.handDelta.subVectors(this.currentPalmPosition, this.lastPalmPosition)
      this.handVelocity.copy(this.handDelta).multiplyScalar(1 / dt)
      const rawSpeed = this.handVelocity.length()

      const isTracked = this.el.object3D.visible !== false

      const meshes = collectSolidMeshes()
      const touchingNow = isTracked && meshes.length > 0
        && this.checkSurfaceContact(this.currentPalmPosition, meshes)
      const nowMs = performance.now()
      if (touchingNow) this.lastContactAt = nowMs
      const touching = touchingNow
        || (isTracked && nowMs - this.lastContactAt <= this.data.contactGraceMs)
      if (!touching) this.contactSurfaceName = 'none'

      this.pushVelocityDelta.set(0, 0, 0)

      if (touching && rawSpeed > this.data.minHandSpeed) {
        const handDebug = (window as any).__floatyHandDebug || {}
        const otherHand = this.data.hand === 'left' ? 'right' : 'left'
        const otherTouching = handDebug[otherHand]?.contact === true
        const oneHandScale = otherTouching ? 1 : this.data.oneHandBoost

        const nDot = this.handVelocity.x * this.contactNormal.x
          + this.handVelocity.y * this.contactNormal.y
          + this.handVelocity.z * this.contactNormal.z

        const tanX = this.handVelocity.x - nDot * this.contactNormal.x
        const tanZ = this.handVelocity.z - nDot * this.contactNormal.z
        this.pushVelocityDelta.x = -tanX * this.data.horizontalGain * oneHandScale * dt
        this.pushVelocityDelta.z = -tanZ * this.data.horizontalGain * oneHandScale * dt

        if (nDot < 0) {
          this.pushVelocityDelta.x += -nDot * this.contactNormal.x * this.data.verticalGain * dt
          this.pushVelocityDelta.y += -nDot * this.contactNormal.y * this.data.verticalGain * dt
          this.pushVelocityDelta.z += -nDot * this.contactNormal.z * this.data.verticalGain * dt
        }

        manualMotion.applyPush(this.pushVelocityDelta)
      }

      const handDebug = (window as any).__floatyHandDebug
      const pushH = Math.hypot(this.pushVelocityDelta.x, this.pushVelocityDelta.z)
      const pushMag = Math.hypot(this.pushVelocityDelta.x, this.pushVelocityDelta.y, this.pushVelocityDelta.z)
      handDebug[this.data.hand] = {
        tracked: isTracked,
        contact: touching,
        surface: this.contactSurfaceName,
        palmY: Number(this.currentPalmPosition.y.toFixed(3)),
        rawSpeed: Number(rawSpeed.toFixed(3)),
        pushH: Number(pushH.toFixed(3)),
        pushY: Number(this.pushVelocityDelta.y.toFixed(3)),
        pushMag: Number(pushMag.toFixed(3))
      }

      this.lastPalmPosition.copy(this.currentPalmPosition)
    }
  })
}

// ---------------------------------------------------------------------------
// player-health
// Owns health, damage, and respawn logic for the player body.
// ---------------------------------------------------------------------------
function registerPlayerHealth(AFRAME: any) {
  if (AFRAME.components['player-health']) return

  AFRAME.registerComponent('player-health', {
    schema: {
      maxHealth: { type: 'number', default: 100 },
      respawnPosition: { type: 'vec3', default: { x: 0, y: 1.6, z: 0 } },
      respawnInvulnMs: { type: 'number', default: 1200 }
    },
    init: function () {
      this.currentHealth = this.data.maxHealth
      this.lastRespawnAt = -Infinity
      this.respawnPos = new AFRAME.THREE.Vector3(
        this.data.respawnPosition.x,
        this.data.respawnPosition.y,
        this.data.respawnPosition.z
      )
      this.publishState()
    },
    update: function () {
      if (typeof this.currentHealth !== 'number') {
        this.currentHealth = this.data.maxHealth
      }
      this.currentHealth = Math.min(this.currentHealth, this.data.maxHealth)
      this.publishState()
    },
    publishState: function () {
      ;(window as any).__floatyPlayerHealth = {
        current: this.currentHealth,
        max: this.data.maxHealth
      }
    },
    applyDamage: function (amount: number) {
      if (!Number.isFinite(amount) || amount <= 0) return

      const nowMs = performance.now()
      if (nowMs - this.lastRespawnAt < this.data.respawnInvulnMs) return

      this.currentHealth = Math.max(0, this.currentHealth - amount)
      this.publishState()

      if (this.currentHealth <= 0) {
        this.respawn()
      }
    },
    respawn: function () {
      const pos = this.el.object3D.position
      pos.set(this.respawnPos.x, this.respawnPos.y, this.respawnPos.z)
      this.el.object3D.updateMatrixWorld(true)

      const motion = this.el.components?.['player-motion']
      if (motion?.velocity) {
        motion.velocity.set(0, 0, 0)
      }

      this.currentHealth = this.data.maxHealth
      this.lastRespawnAt = performance.now()
      this.publishState()
    }
  })
}

// ---------------------------------------------------------------------------
// health-hud
// Renders health bar + text in front of the camera.
// ---------------------------------------------------------------------------
function registerHealthHud(AFRAME: any) {
  if (AFRAME.components['health-hud']) return

  AFRAME.registerComponent('health-hud', {
    schema: {
      maxWidth: { type: 'number', default: 0.9 }
    },
    init: function () {
      this.fillEntity = null
      this.textEntity = null
      this.lastUpdateAt = 0
      this.lastCurrent = -1
      this.lastMax = -1
    },
    renderHealth: function (current: number, max: number) {
      if (!this.fillEntity) {
        this.fillEntity = this.el.querySelector('#health-fill') as any
      }
      if (!this.textEntity) {
        this.textEntity = this.el.querySelector('#health-text') as any
      }
      if (!this.fillEntity || !this.textEntity) return

      const ratio = Math.max(0, Math.min(1, current / max))
      const fillWidth = Math.max(0.001, this.data.maxWidth * ratio)
      const fillX = -this.data.maxWidth * 0.5 + fillWidth * 0.5

      let fillColor = '#37ff66'
      if (ratio < 0.25) {
        fillColor = '#ff3b30'
      } else if (ratio < 0.55) {
        fillColor = '#ffb020'
      }

      this.fillEntity.setAttribute('width', fillWidth)
      this.fillEntity.setAttribute('position', `${fillX.toFixed(3)} 0 0.01`)
      this.fillEntity.setAttribute('color', fillColor)
      this.textEntity.setAttribute(
        'text',
        `value: HP ${Math.ceil(current)}/${max}; color: #ffffff; align: center; width: 1.35; wrapCount: 18`
      )
    },
    tick: function (time: number) {
      if (time - this.lastUpdateAt < 80) return
      this.lastUpdateAt = time

      const state = (window as any).__floatyPlayerHealth
      const max = Math.max(1, Number(state?.max || 100))
      const current = Math.max(0, Math.min(max, Number(state?.current ?? max)))

      if (current !== this.lastCurrent || max !== this.lastMax) {
        this.renderHealth(current, max)
        this.lastCurrent = current
        this.lastMax = max
      }
    }
  })
}

// ---------------------------------------------------------------------------
// cannonball
// Simple projectile: moves forward, collides with solids/player, then despawns.
// ---------------------------------------------------------------------------
function registerCannonball(AFRAME: any) {
  if (AFRAME.components['cannonball']) return

  AFRAME.registerComponent('cannonball', {
    schema: {
      velocity: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
      gravity: { type: 'number', default: -3.2 },
      damage: { type: 'number', default: 20 },
      radius: { type: 'number', default: 0.1 },
      lifeMs: { type: 'number', default: 7000 }
    },
    init: function () {
      this.spawnAt = null
      this.velocity = new AFRAME.THREE.Vector3(
        this.data.velocity.x,
        this.data.velocity.y,
        this.data.velocity.z
      )
      this.prevPos = new AFRAME.THREE.Vector3()
      this.rayDir = new AFRAME.THREE.Vector3()
      this.playerPos = new AFRAME.THREE.Vector3()
      this.raycaster = new AFRAME.THREE.Raycaster()
      this.playerBody = null
    },
    removeSelf: function () {
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el)
      }
    },
    tick: function (time: number, delta: number) {
      if (!delta) return
      if (this.spawnAt === null) this.spawnAt = time
      if (time - this.spawnAt > this.data.lifeMs) {
        this.removeSelf()
        return
      }

      const dt = Math.min(Math.max(delta / 1000, 0), 0.05)
      const pos = this.el.object3D.position
      this.prevPos.copy(pos)

      this.velocity.y += this.data.gravity * dt
      pos.x += this.velocity.x * dt
      pos.y += this.velocity.y * dt
      pos.z += this.velocity.z * dt

      if (!this.playerBody) {
        this.playerBody = document.querySelector('#player-body') as any
      }
      if (this.playerBody) {
        this.playerBody.object3D.getWorldPosition(this.playerPos)
        const hitDist = this.data.radius + 0.24
        if (pos.distanceToSquared(this.playerPos) <= hitDist * hitDist) {
          const playerHealth = this.playerBody.components?.['player-health']
          if (playerHealth?.applyDamage) {
            playerHealth.applyDamage(this.data.damage)
          }
          this.removeSelf()
          return
        }
      }

      const meshes = collectSolidMeshes()
      if (meshes.length > 0) {
        this.rayDir.subVectors(pos, this.prevPos)
        const travel = this.rayDir.length()
        if (travel > 0.0001) {
          this.rayDir.multiplyScalar(1 / travel)
          this.raycaster.set(this.prevPos, this.rayDir)
          this.raycaster.near = 0
          this.raycaster.far = travel + this.data.radius
          const hits = this.raycaster.intersectObjects(meshes, true)
          if (hits.length > 0) {
            this.removeSelf()
            return
          }
        }
      }

      if (Math.abs(pos.x) > 90 || Math.abs(pos.z) > 90 || pos.y < -6 || pos.y > 80) {
        this.removeSelf()
      }
    }
  })
}

// ---------------------------------------------------------------------------
// cannon-shooter
// Periodically spawns cannonball entities from the cannon muzzle.
// ---------------------------------------------------------------------------
function registerCannonShooter(AFRAME: any) {
  if (AFRAME.components['cannon-shooter']) return

  AFRAME.registerComponent('cannon-shooter', {
    schema: {
      fireRateMs: { type: 'number', default: 950 },
      ballSpeed: { type: 'number', default: 11 },
      ballGravity: { type: 'number', default: -3.2 },
      damage: { type: 'number', default: 20 },
      ballRadius: { type: 'number', default: 0.1 },
      lifeMs: { type: 'number', default: 7000 },
      muzzleOffset: { type: 'vec3', default: { x: 0, y: 0.34, z: 1.36 } },
      shotVolume: { type: 'number', default: 0.11 }
    },
    init: function () {
      this.lastShotAt = 0
      this.muzzleWorld = new AFRAME.THREE.Vector3()
      this.fireDirection = new AFRAME.THREE.Vector3()
      this.worldQuat = new AFRAME.THREE.Quaternion()
    },
    fireBall: function () {
      const scene = this.el.sceneEl
      if (!scene) return

      this.muzzleWorld.set(
        this.data.muzzleOffset.x,
        this.data.muzzleOffset.y,
        this.data.muzzleOffset.z
      )
      this.el.object3D.localToWorld(this.muzzleWorld)

      this.el.object3D.getWorldQuaternion(this.worldQuat)
      this.fireDirection.set(0, 0, 1).applyQuaternion(this.worldQuat).normalize()

      const velocityX = this.fireDirection.x * this.data.ballSpeed
      const velocityY = this.fireDirection.y * this.data.ballSpeed
      const velocityZ = this.fireDirection.z * this.data.ballSpeed

      const cannonBall = document.createElement('a-sphere')
      cannonBall.setAttribute(
        'position',
        `${this.muzzleWorld.x.toFixed(3)} ${this.muzzleWorld.y.toFixed(3)} ${this.muzzleWorld.z.toFixed(3)}`
      )
      cannonBall.setAttribute('radius', this.data.ballRadius)
      cannonBall.setAttribute('color', '#252a33')
      cannonBall.setAttribute(
        'material',
        'roughness: 0.62; metalness: 0.25; emissive: #7a1d1d; emissiveIntensity: 0.36'
      )
      cannonBall.setAttribute('shadow', 'cast: true')
      cannonBall.setAttribute(
        'cannonball',
        `velocity: ${velocityX.toFixed(4)} ${velocityY.toFixed(4)} ${velocityZ.toFixed(4)}; gravity: ${this.data.ballGravity}; damage: ${this.data.damage}; radius: ${this.data.ballRadius}; lifeMs: ${this.data.lifeMs}`
      )
      scene.appendChild(cannonBall)

      playCannonShotSound(this.data.shotVolume)
    },
    tick: function (time: number) {
      if (time - this.lastShotAt < this.data.fireRateMs) return
      this.lastShotAt = time
      this.fireBall()
    }
  })
}

function playCannonShotSound(volume: number) {
  const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!AudioContextCtor) return

  const win = window as any
  if (!win.__floatyAudioCtx) {
    win.__floatyAudioCtx = new AudioContextCtor()
  }
  const ctx = win.__floatyAudioCtx as AudioContext
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => undefined)
  }

  const t0 = ctx.currentTime
  const bodyGain = ctx.createGain()
  bodyGain.gain.setValueAtTime(0.0001, t0)
  bodyGain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume), t0 + 0.01)
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)

  const tone = ctx.createOscillator()
  tone.type = 'square'
  tone.frequency.setValueAtTime(260, t0)
  tone.frequency.exponentialRampToValueAtTime(95, t0 + 0.16)

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(1150, t0)
  bandpass.Q.value = 0.8

  tone.connect(bandpass)
  bandpass.connect(bodyGain)
  bodyGain.connect(ctx.destination)
  tone.start(t0)
  tone.stop(t0 + 0.2)

  if (!win.__floatyNoiseBuffer || win.__floatyNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const sampleCount = Math.floor(ctx.sampleRate * 0.14)
    const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate)
    const channel = noiseBuffer.getChannelData(0)
    for (let i = 0; i < sampleCount; i++) {
      const decay = 1 - i / sampleCount
      channel[i] = (Math.random() * 2 - 1) * decay
    }
    win.__floatyNoiseBuffer = noiseBuffer
  }

  const noiseSource = ctx.createBufferSource()
  noiseSource.buffer = win.__floatyNoiseBuffer as AudioBuffer
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'highpass'
  noiseFilter.frequency.setValueAtTime(520, t0)

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(Math.max(0.006, volume * 0.55), t0)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14)

  noiseSource.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noiseSource.start(t0)
  noiseSource.stop(t0 + 0.15)
}
