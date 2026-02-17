import { collectSolidMeshes } from './utils'

/**
 * Registers all custom A-Frame components used by Floaty McHandface.
 * Safe to call multiple times — each component guards against re-registration.
 */
export function registerFloatyComponents() {
  const AFRAME = (window as any).AFRAME
  if (!AFRAME) return

  registerPlayerMotion(AFRAME)
  registerShoulderCameraSync(AFRAME)
  registerArmConnector(AFRAME)
  registerHandWalker(AFRAME)
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
      if ((this.el as any).body) return

      // Wait for solid meshes before applying any physics so
      // the player doesn't fall through the floor during load.
      const meshes = collectSolidMeshes()
      if (meshes.length === 0) return

      const dt = Math.max(delta / 1000, 0.001)
      const d = this.data
      this.velocity.y += d.gravity * dt

      const damp = Math.exp(-d.damping * dt)
      this.velocity.x *= damp
      this.velocity.z *= damp

      const pos = this.el.object3D.position
      pos.x += this.velocity.x * dt
      pos.y += this.velocity.y * dt
      pos.z += this.velocity.z * dt

      this.rayOrigin.copy(pos)
      this.collisionInfo.onGround = false

      const dirs = [
        { x: 0, y: -1, z: 0, extent: d.bodyHalfHeight, axis: 'y' as const, sign: -1 },
        { x: 0, y: 1, z: 0, extent: d.bodyHalfHeight, axis: 'y' as const, sign: 1 },
        { x: 1, y: 0, z: 0, extent: d.bodyHalfWidth, axis: 'x' as const, sign: 1 },
        { x: -1, y: 0, z: 0, extent: d.bodyHalfWidth, axis: 'x' as const, sign: -1 },
        { x: 0, y: 0, z: 1, extent: d.bodyHalfDepth, axis: 'z' as const, sign: 1 },
        { x: 0, y: 0, z: -1, extent: d.bodyHalfDepth, axis: 'z' as const, sign: -1 },
      ]

      const dirVec = new AFRAME.THREE.Vector3()
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
      debugEveryMs: { type: 'number', default: 250 }
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

      if (time - this.debugLastSentAt < this.data.debugEveryMs) return
      this.debugLastSentAt = time

      this.cameraEntity.object3D.getWorldPosition(this.cameraWorldPos)
      this.el.object3D.getWorldPosition(this.rigCurrentPos)

      const errX = this.cameraWorldPos.x - this.targetCameraWorldPos.x
      const errY = this.cameraWorldPos.y - this.targetCameraWorldPos.y
      const errZ = this.cameraWorldPos.z - this.targetCameraWorldPos.z

      const manualMotion = this.playerBodyEntity?.components?.['player-motion']
      const bodyMode = this.playerBodyEntity?.body ? 'physics' : (manualMotion ? 'manual' : 'none')
      const bodyPhysicsPos = this.playerBodyEntity?.body?.position ?? this.playerBodyEntity?.object3D?.position
      const bodyPhysicsVel = this.playerBodyEntity?.body?.velocity ?? manualMotion?.velocity
      const bodySleepState = this.playerBodyEntity?.body?.sleepState
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
          ? `gravityDiag   : bodyVelY=${bodyPhysicsVel.y.toFixed(3)} sleepState=${bodyMode === 'physics' ? String(bodySleepState) : 'manual'}`
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
      minHandSpeed: { type: 'number', default: 0.02 }
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
      this.contactSurfaceName = 'none'
      this.contactNormal.set(0, 1, 0)
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

      const body = this.playerBody.body
      const manualMotion = this.playerBody.components?.['player-motion']
      if (!body && !manualMotion) return

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
      const touching = isTracked && meshes.length > 0
        && this.checkSurfaceContact(this.currentPalmPosition, meshes)

      this.pushVelocityDelta.set(0, 0, 0)

      if (touching && rawSpeed > this.data.minHandSpeed) {
        const nDot = this.handVelocity.x * this.contactNormal.x
          + this.handVelocity.y * this.contactNormal.y
          + this.handVelocity.z * this.contactNormal.z

        const tanX = this.handVelocity.x - nDot * this.contactNormal.x
        const tanZ = this.handVelocity.z - nDot * this.contactNormal.z
        this.pushVelocityDelta.x = -tanX * this.data.horizontalGain * dt
        this.pushVelocityDelta.z = -tanZ * this.data.horizontalGain * dt

        if (nDot < 0) {
          this.pushVelocityDelta.x += -nDot * this.contactNormal.x * this.data.verticalGain * dt
          this.pushVelocityDelta.y += -nDot * this.contactNormal.y * this.data.verticalGain * dt
          this.pushVelocityDelta.z += -nDot * this.contactNormal.z * this.data.verticalGain * dt
        }

        if (body) {
          body.velocity.x += this.pushVelocityDelta.x
          body.velocity.y += this.pushVelocityDelta.y
          body.velocity.z += this.pushVelocityDelta.z
          const hSpeed = Math.hypot(body.velocity.x, body.velocity.z)
          if (hSpeed > this.data.maxSpeed) {
            const s = this.data.maxSpeed / hSpeed
            body.velocity.x *= s
            body.velocity.z *= s
          }
          if (body.velocity.y > this.data.maxSpeed * 0.9) {
            body.velocity.y = this.data.maxSpeed * 0.9
          }
        } else {
          manualMotion.applyPush(this.pushVelocityDelta)
        }
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
