import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any
      'a-box': any
      'a-sphere': any
      'a-cylinder': any
      'a-plane': any
      'a-sky': any
      'a-light': any
      'a-entity': any
      'a-camera': any
    }
  }
}

export default function FloatyMcHandface() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const scriptLoadedRef = useRef(false)
  const [debugText, setDebugText] = useState('Waiting for scene...')

  useEffect(() => {
    const onDebugEvent = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (typeof detail === 'string') {
        setDebugText(detail)
      }
    }

    window.addEventListener('floaty-vr-debug', onDebugEvent as EventListener)

    const loadScripts = async () => {
      if (!document.querySelector('script[src*="aframe.min"]')) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script')
          script.src = 'https://aframe.io/releases/1.5.0/aframe.min.js'
          script.onload = () => resolve()
          document.head.appendChild(script)
        })
      }
      if (!document.querySelector('script[src*="aframe-physics"]')) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/gh/c-frame/aframe-physics-system@v4.2.2/dist/aframe-physics-system.min.js'
          script.onload = () => resolve()
          document.head.appendChild(script)
        })
      }

      const AFRAME = (window as any).AFRAME
      if (!AFRAME || !sceneRef.current) return

      // Register fallback player-motion component.
      // Used when physics-system dynamic-body is unavailable.
      if (!AFRAME.components['player-motion']) {
        AFRAME.registerComponent('player-motion', {
          schema: {
            gravity: { type: 'number', default: -9.8 },
            floorY: { type: 'number', default: 0.1 },
            roomHalfSize: { type: 'number', default: 14.8 },
            damping: { type: 'number', default: 3.2 },
            maxSpeed: { type: 'number', default: 6 }
          },
          init: function () {
            this.velocity = new AFRAME.THREE.Vector3()
          },
          applyPush: function (delta: { x: number; y: number; z: number }) {
            this.velocity.x += delta.x
            this.velocity.y += delta.y
            this.velocity.z += delta.z
            this.clampVelocity(this.data.maxSpeed)
          },
          clampVelocity: function (maxSpeed: number) {
            const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z)
            if (horizontalSpeed > maxSpeed) {
              const s = maxSpeed / horizontalSpeed
              this.velocity.x *= s
              this.velocity.z *= s
            }
            if (this.velocity.y > maxSpeed * 0.9) {
              this.velocity.y = maxSpeed * 0.9
            }
          },
          tick: function (_time: number, delta: number) {
            if (!delta) return
            if ((this.el as any).body) return

            const dt = Math.max(delta / 1000, 0.001)
            this.velocity.y += this.data.gravity * dt

            // Dampen horizontal motion to mimic friction.
            const damp = Math.exp(-this.data.damping * dt)
            this.velocity.x *= damp
            this.velocity.z *= damp

            const pos = this.el.object3D.position
            pos.x += this.velocity.x * dt
            pos.y += this.velocity.y * dt
            pos.z += this.velocity.z * dt

            const bound = this.data.roomHalfSize - 0.2
            if (pos.x < -bound) {
              pos.x = -bound
              if (this.velocity.x < 0) this.velocity.x = 0
            } else if (pos.x > bound) {
              pos.x = bound
              if (this.velocity.x > 0) this.velocity.x = 0
            }
            if (pos.z < -bound) {
              pos.z = -bound
              if (this.velocity.z < 0) this.velocity.z = 0
            } else if (pos.z > bound) {
              pos.z = bound
              if (this.velocity.z > 0) this.velocity.z = 0
            }

            if (pos.y < this.data.floorY) {
              pos.y = this.data.floorY
              if (this.velocity.y < 0) this.velocity.y = 0
            }
          }
        })
      }

      // Register shoulder-camera-sync component - keeps camera shoulder-anchored.
      if (!AFRAME.components['shoulder-camera-sync']) {
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
              if (bodyEntity) {
                this.playerBodyEntity = bodyEntity
              }
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

            // Body world position from dynamic physics body.
            this.playerBodyEntity.object3D.getWorldPosition(this.bodyWorldPos)
            this.shoulderEntity.object3D.getWorldPosition(this.shoulderWorldPos)

            // Local headset offset inside rig (XR tracking writes this).
            const trackedLocalHead = this.cameraEntity.object3D.position

            // Desired camera world position: just above the shoulders.
            this.targetCameraWorldPos.set(
              this.shoulderWorldPos.x,
              this.shoulderWorldPos.y + this.data.shoulderOffsetY,
              this.shoulderWorldPos.z
            )

            // Put rig so camera lands at shoulder target.
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
                ? `groundDiag    : bodyY=${bodyPhysicsPos.y.toFixed(3)} bodyHalfHeight=0.100 gapToFloor=${(bodyPhysicsPos.y - 0.10).toFixed(3)} shoulderGapToFloor=${(this.shoulderWorldPos.y - 0.10).toFixed(3)}`
                : 'groundDiag    : body position missing',
              leftHandDebug
                ? `leftPalm      : tracked=${leftHandDebug.tracked ? 'Y' : 'N'} y=${leftHandDebug.palmY.toFixed(3)} grounded=${leftHandDebug.grounded ? 'Y' : 'N'} relSpeed=${leftHandDebug.relSpeed.toFixed(3)} rawVelY=${leftHandDebug.rawVelY.toFixed(3)} relVelY=${leftHandDebug.relVelY.toFixed(3)} pushY=${leftHandDebug.pushY.toFixed(3)} pushMag=${leftHandDebug.pushMag.toFixed(3)}`
                : 'leftPalm      : missing',
              rightHandDebug
                ? `rightPalm     : tracked=${rightHandDebug.tracked ? 'Y' : 'N'} y=${rightHandDebug.palmY.toFixed(3)} grounded=${rightHandDebug.grounded ? 'Y' : 'N'} relSpeed=${rightHandDebug.relSpeed.toFixed(3)} rawVelY=${rightHandDebug.rawVelY.toFixed(3)} relVelY=${rightHandDebug.relVelY.toFixed(3)} pushY=${rightHandDebug.pushY.toFixed(3)} pushMag=${rightHandDebug.pushMag.toFixed(3)}`
                : 'rightPalm     : missing'
            ]

            const debugOutput = debugLines.join('\n')
            window.dispatchEvent(new CustomEvent('floaty-vr-debug', { detail: debugOutput }))

            if (this.debugHudEntity) {
              const bodyY = bodyPhysicsPos ? bodyPhysicsPos.y.toFixed(2) : 'na'
              const shoulderY = this.shoulderWorldPos.y.toFixed(2)
              const bodyGap = bodyPhysicsPos ? (bodyPhysicsPos.y - 0.10).toFixed(3) : 'na'
              const shoulderGap = (this.shoulderWorldPos.y - 0.10).toFixed(3)
              const bodyVelY = bodyPhysicsVel ? bodyPhysicsVel.y.toFixed(2) : 'na'
              const sleep = bodyMode === 'physics'
                ? (bodySleepState === undefined ? 'na' : String(bodySleepState))
                : (bodyMode === 'manual' ? 'manual' : 'na')
              const physicsReady = bodyMode !== 'none' ? 'Y' : 'N'
              const leftTracked = leftHandDebug ? (leftHandDebug.tracked ? 'Y' : 'N') : '?'
              const leftGrounded = leftHandDebug ? (leftHandDebug.grounded ? 'Y' : 'N') : '?'
              const leftRel = leftHandDebug ? leftHandDebug.relSpeed.toFixed(2) : 'na'
              const leftPush = leftHandDebug ? leftHandDebug.pushMag.toFixed(2) : 'na'
              const leftPalmY = leftHandDebug ? leftHandDebug.palmY.toFixed(2) : 'na'
              const rightTracked = rightHandDebug ? (rightHandDebug.tracked ? 'Y' : 'N') : '?'
              const rightGrounded = rightHandDebug ? (rightHandDebug.grounded ? 'Y' : 'N') : '?'
              const rightRel = rightHandDebug ? rightHandDebug.relSpeed.toFixed(2) : 'na'
              const rightPush = rightHandDebug ? rightHandDebug.pushMag.toFixed(2) : 'na'
              const rightPalmY = rightHandDebug ? rightHandDebug.palmY.toFixed(2) : 'na'
              const hudLines = [
                `phys:${physicsReady}/${bodyMode} vr:${isVr ? 'Y' : 'N'} bodyY:${bodyY} shoulderY:${shoulderY}`,
                `gap:${bodyGap} shoulderGap:${shoulderGap} bodyVy:${bodyVelY} sleep:${sleep}`,
                `L tr:${leftTracked} gr:${leftGrounded} rel:${leftRel} push:${leftPush} pY:${leftPalmY}`,
                `R tr:${rightTracked} gr:${rightGrounded} rel:${rightRel} push:${rightPush} pY:${rightPalmY}`,
                `camErrY:${errY.toFixed(2)}`
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

      // Register arm-connector component - connects arm cylinder from shoulder edge to hand
      if (!AFRAME.components['arm-connector']) {
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
            // Shoulder edge offset from body center (left/right side).
            this.edgeOffset = this.data.hand === 'left' ? -0.22 : 0.22
          },
          tick: function () {
            const shoulder = document.querySelector('#shoulder-box') as any
            if (!shoulder) return

            if (!this.camera) {
              this.camera = document.querySelector('#camera') as any
            }

            // Get shoulder world position and add side offset.
            shoulder.object3D.getWorldPosition(this.shoulderEdgePos)

            // Use camera orientation for shoulder left/right so arms do not cross
            // when physics body rotates.
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

            // Get hand world position
            this.el.object3D.getWorldPosition(this.handPos)

            // Calculate distance
            this.direction.subVectors(this.shoulderEdgePos, this.handPos)
            const distance = this.direction.length()

            // Get the arm cylinder
            const armCylinder = this.el.querySelector('a-cylinder') as any
            if (!armCylinder) return

            // Calculate midpoint in world space, then convert to local
            this.midpoint.addVectors(this.handPos, this.shoulderEdgePos).multiplyScalar(0.5)
            const localMidpoint = this.el.object3D.worldToLocal(this.midpoint.clone())

            // Position cylinder at midpoint
            armCylinder.object3D.position.copy(localMidpoint)

            // Scale cylinder to match distance
            armCylinder.object3D.scale.y = distance / 0.5 // 0.5 is default height

            // Rotate cylinder to point from hand toward shoulder edge
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

      // Register custom hand-walk component
      if (!AFRAME.components['hand-walker']) {
        AFRAME.registerComponent('hand-walker', {
          schema: {
            hand: { type: 'string', default: 'left' },
            palmContactY: { type: 'number', default: 0.2 },
            horizontalGain: { type: 'number', default: 13 },
            verticalGain: { type: 'number', default: 16 },
            maxSpeed: { type: 'number', default: 6 },
            minHandSpeed: { type: 'number', default: 0.03 }
          },
          init: function () {
            this.lastPalmPosition = new AFRAME.THREE.Vector3()
            this.currentPalmPosition = new AFRAME.THREE.Vector3()
            this.handDelta = new AFRAME.THREE.Vector3()
            this.handVelocity = new AFRAME.THREE.Vector3()
            this.relativeHandVelocity = new AFRAME.THREE.Vector3()
            this.pushVelocityDelta = new AFRAME.THREE.Vector3()
            this.isGrounded = false
            this.playerBody = null
            this.palmEntity = null
            this.didInitializePalmPosition = false

            if (!(window as any).__floatyHandDebug) {
              ; (window as any).__floatyHandDebug = {}
            }
          },
          tick: function (_time: number, delta: number) {
            if (!delta) return

            // Find physics body
            if (!this.playerBody) {
              this.playerBody = document.querySelector('#player-body') as any
              return
            }

            const body = this.playerBody.body
            const manualMotion = this.playerBody.components?.['player-motion']
            if (!body && !manualMotion) return

            // Use palm marker if present, otherwise fallback to hand origin.
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

            // Convert hand movement to world-space hand velocity.
            this.handDelta.subVectors(this.currentPalmPosition, this.lastPalmPosition)
            const dt = Math.max(delta / 1000, 0.001)
            this.handVelocity.copy(this.handDelta).multiplyScalar(1 / dt)
            this.relativeHandVelocity.copy(this.handVelocity)
            const baseVel = body ? body.velocity : manualMotion.velocity
            this.relativeHandVelocity.x -= baseVel.x
            this.relativeHandVelocity.y -= baseVel.y
            this.relativeHandVelocity.z -= baseVel.z
            const relativeHandSpeed = this.relativeHandVelocity.length()

            const isTracked = this.el.object3D.visible !== false

            // Floor contact check by palm height.
            this.isGrounded = isTracked && this.currentPalmPosition.y <= this.data.palmContactY
            this.pushVelocityDelta.set(0, 0, 0)

            // Gorilla-tag style: when palm is planted/moving on floor,
            // body gets opposite velocity delta.
            if (this.isGrounded && relativeHandSpeed > this.data.minHandSpeed) {
              this.pushVelocityDelta.x = -this.relativeHandVelocity.x * this.data.horizontalGain * dt
              this.pushVelocityDelta.z = -this.relativeHandVelocity.z * this.data.horizontalGain * dt

              // Only convert downward palm movement into upward boost.
              if (this.relativeHandVelocity.y < 0) {
                this.pushVelocityDelta.y = -this.relativeHandVelocity.y * this.data.verticalGain * dt
              }

              if (body) {
                body.velocity.x += this.pushVelocityDelta.x
                body.velocity.y += this.pushVelocityDelta.y
                body.velocity.z += this.pushVelocityDelta.z

                // Keep locomotion controllable.
                const horizontalSpeed = Math.hypot(body.velocity.x, body.velocity.z)
                if (horizontalSpeed > this.data.maxSpeed) {
                  const speedScale = this.data.maxSpeed / horizontalSpeed
                  body.velocity.x *= speedScale
                  body.velocity.z *= speedScale
                }
                if (body.velocity.y > this.data.maxSpeed * 0.9) {
                  body.velocity.y = this.data.maxSpeed * 0.9
                }
              } else {
                manualMotion.applyPush(this.pushVelocityDelta)
              }
            }

            const handDebug = (window as any).__floatyHandDebug
            const pushMag = Math.hypot(this.pushVelocityDelta.x, this.pushVelocityDelta.y, this.pushVelocityDelta.z)
            handDebug[this.data.hand] = {
              tracked: isTracked,
              grounded: this.isGrounded,
              palmY: Number(this.currentPalmPosition.y.toFixed(3)),
              relSpeed: Number(relativeHandSpeed.toFixed(3)),
              rawVelY: Number(this.handVelocity.y.toFixed(3)),
              relVelY: Number(this.relativeHandVelocity.y.toFixed(3)),
              pushY: Number(this.pushVelocityDelta.y.toFixed(3)),
              pushMag: Number(pushMag.toFixed(3))
            }

            this.lastPalmPosition.copy(this.currentPalmPosition)
          }
        })
      }

      // Render the scene
      sceneRef.current.innerHTML = getSceneHTML()
    }

    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true
      loadScripts()
    }

    return () => {
      window.removeEventListener('floaty-vr-debug', onDebugEvent as EventListener)
      if (sceneRef.current) {
        sceneRef.current.innerHTML = ''
      }
    }
  }, [])

  const getSceneHTML = () => `
    <a-scene 
      vr-mode-ui="enabled: true" 
      background="color: #1a1a2e"
      physics="driver: cannon; gravity: 0 -9.8 0; debug: false"
    >
      <!-- Room - big enclosed space -->
      <!-- Floor with physics -->
      <a-plane 
        position="0 0 0" 
        rotation="-90 0 0" 
        width="30" 
        height="30" 
        color="#3d3d5c"
        shadow="receive: true"
        static-body
      ></a-plane>
      
      <!-- Ceiling -->
      <a-plane 
        position="0 12 0" 
        rotation="90 0 0" 
        width="30" 
        height="30" 
        color="#2a2a4a"
        static-body
      ></a-plane>
      
      <!-- Walls with physics -->
      <a-plane position="0 6 -15" width="30" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="0 6 15" rotation="0 180 0" width="30" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="-15 6 0" rotation="0 90 0" width="30" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="15 6 0" rotation="0 -90 0" width="30" height="12" color="#4a4a6a" static-body></a-plane>
      
      <!-- Low box - easy to touch -->
      <a-box 
        position="-3 0.5 -5" 
        width="2" 
        height="1" 
        depth="2" 
        color="#ff6b6b"
        shadow="cast: true; receive: true"
        static-body
      ></a-box>
      
      <!-- Very high pillar box -->
      <a-box 
        position="4 5 -6" 
        width="1.5" 
        height="10" 
        depth="1.5" 
        color="#4ecdc4"
        shadow="cast: true; receive: true"
        static-body
      ></a-box>
      
      <!-- Invisible physics shoulder body (driven by gravity). -->
      <a-box
        id="player-body"
        position="0 1.6 0"
        width="0.4"
        height="0.2"
        depth="0.2"
        material="opacity: 0; transparent: true; depthWrite: false"
        dynamic-body="shape: box; mass: 70; linearDamping: 0.45; angularDamping: 0.99"
        player-motion="gravity: -9.8; floorY: 0.1; roomHalfSize: 14.8; damping: 3.2; maxSpeed: 6"
      >
        <!-- Visible shoulder body. -->
        <a-box
          id="shoulder-box"
          position="0 0 0"
          width="0.4"
          height="0.2"
          depth="0.2"
          color="#ffd93d"
        ></a-box>
      </a-box>
      
      <!-- VR Camera Rig - shoulder anchored camera -->
      <a-entity id="rig" position="0 1.5 0" shoulder-camera-sync="shoulderOffsetY: 0.3; lockHorizontal: true; debugEveryMs: 250">
        <!-- Camera for VR view -->
        <a-camera id="camera" position="0 0 0" look-controls="pointerLockEnabled: true">
          <!-- In-headset debug HUD -->
          <a-entity
            id="debug-hud"
            position="0 -0.24 -2.2"
            scale="0.55 0.55 0.55"
            text="value: Waiting for VR debug...; color: #7CFF7C; width: 3.6; align: left; wrapCount: 64"
          ></a-entity>
        </a-camera>
        
        <!-- Left hand controller with hand-walker and arm-connector -->
        <a-entity 
          id="left-hand" 
          oculus-touch-controls="hand: left"
          hand-tracking-controls="hand: left"
          hand-walker="hand: left"
          arm-connector="hand: left"
        >
          <!-- Arm cylinder - dynamically positioned/rotated by arm-connector -->
          <a-cylinder
            radius="0.04"
            height="0.5"
            color="#ffb347"
          ></a-cylinder>
          <!-- Palm ball at controller/hand position -->
          <a-sphere
            id="left-palm"
            position="0 0 0"
            radius="0.1"
            color="#ff7f50"
          ></a-sphere>
        </a-entity>
        
        <!-- Right hand controller with hand-walker and arm-connector -->
        <a-entity 
          id="right-hand" 
          oculus-touch-controls="hand: right"
          hand-tracking-controls="hand: right"
          hand-walker="hand: right"
          arm-connector="hand: right"
        >
          <!-- Arm cylinder - dynamically positioned/rotated by arm-connector -->
          <a-cylinder
            radius="0.04"
            height="0.5"
            color="#ffb347"
          ></a-cylinder>
          <!-- Palm ball at controller/hand position -->
          <a-sphere
            id="right-palm"
            position="0 0 0"
            radius="0.1"
            color="#ff7f50"
          ></a-sphere>
        </a-entity>
      </a-entity>
      
      <!-- Lighting -->
      <a-light type="ambient" color="#404060" intensity="0.4"></a-light>
      <a-light type="directional" position="2 8 4" intensity="0.8" castShadow="true"></a-light>
      <a-light type="point" position="-3 4 -3" color="#ff6b6b" intensity="0.3"></a-light>
      <a-light type="point" position="4 8 -6" color="#4ecdc4" intensity="0.4"></a-light>
      
      <!-- Sky gradient effect -->
      <a-sky color="#16213e"></a-sky>
    </a-scene>
  `

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden relative">
      <div className="flex justify-between items-center p-4 bg-gray-900 text-white flex-shrink-0 z-10">
        <div>
          <h1 className="text-2xl font-bold">Floaty McHandface</h1>
          <p className="text-sm text-gray-400">VR - Put on your headset and push around!</p>
        </div>
        <Link to="/" className="text-xl text-blue-400 underline hover:text-blue-300">
          Back to Menu
        </Link>
      </div>
      <div
        ref={sceneRef}
        className="flex-1 w-full h-full overflow-hidden"
        style={{ position: 'relative' }}
      />
      <div className="absolute bottom-3 left-3 right-3 md:max-w-2xl bg-black/75 text-green-200 text-xs p-3 rounded-md pointer-events-none">
        <div className="font-semibold mb-1 text-green-100">Floaty debug</div>
        <pre className="whitespace-pre-wrap break-words m-0 leading-4">{debugText}</pre>
      </div>
    </div>
  )
}
