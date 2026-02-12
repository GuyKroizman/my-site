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

      // Register shoulder-camera-sync component - keeps camera shoulder-anchored.
      if (!AFRAME.components['shoulder-camera-sync']) {
        AFRAME.registerComponent('shoulder-camera-sync', {
          schema: {
            shoulderOffsetY: { type: 'number', default: 0.16 },
            lockHorizontal: { type: 'boolean', default: true },
            debugEveryMs: { type: 'number', default: 250 }
          },
          init: function () {
            this.playerBodyEntity = null
            this.cameraEntity = null
            this.debugHudEntity = null
            this.bodyWorldPos = new AFRAME.THREE.Vector3()
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

            if (!this.debugHudEntity) {
              this.debugHudEntity = document.querySelector('#debug-hud') as any
            }

            // Shoulder world position from physics body.
            this.playerBodyEntity.object3D.getWorldPosition(this.bodyWorldPos)

            // Local headset offset inside rig (XR tracking writes this).
            const trackedLocalHead = this.cameraEntity.object3D.position

            // Desired camera world position: just above the shoulders.
            this.targetCameraWorldPos.set(
              this.bodyWorldPos.x,
              this.bodyWorldPos.y + this.data.shoulderOffsetY,
              this.bodyWorldPos.z
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

            const bodyPhysicsPos = this.playerBodyEntity?.body?.position
            const scene = this.el.sceneEl
            const isVr = scene ? scene.is('vr-mode') : false

            const debugLines = [
              `VR: ${isVr ? 'ON' : 'OFF'} | lockHorizontal: ${this.data.lockHorizontal ? 'ON' : 'OFF'}`,
              `targetCamWorld: x=${this.targetCameraWorldPos.x.toFixed(3)} y=${this.targetCameraWorldPos.y.toFixed(3)} z=${this.targetCameraWorldPos.z.toFixed(3)}`,
              `actualCamWorld: x=${this.cameraWorldPos.x.toFixed(3)} y=${this.cameraWorldPos.y.toFixed(3)} z=${this.cameraWorldPos.z.toFixed(3)}`,
              `camError      : x=${errX.toFixed(3)} y=${errY.toFixed(3)} z=${errZ.toFixed(3)}`,
              `headLocal(rig): x=${trackedLocalHead.x.toFixed(3)} y=${trackedLocalHead.y.toFixed(3)} z=${trackedLocalHead.z.toFixed(3)}`,
              `rigWorld      : x=${this.rigCurrentPos.x.toFixed(3)} y=${this.rigCurrentPos.y.toFixed(3)} z=${this.rigCurrentPos.z.toFixed(3)}`,
              bodyPhysicsPos
                ? `physicsBody   : x=${bodyPhysicsPos.x.toFixed(3)} y=${bodyPhysicsPos.y.toFixed(3)} z=${bodyPhysicsPos.z.toFixed(3)}`
                : 'physicsBody   : missing'
            ]

            const debugOutput = debugLines.join('\n')
            window.dispatchEvent(new CustomEvent('floaty-vr-debug', { detail: debugOutput }))

            if (this.debugHudEntity) {
              const hudValue = debugLines.slice(0, 5).join('\n').split(';').join(',')
              this.debugHudEntity.setAttribute(
                'text',
                `value: ${hudValue}; color: #7CFF7C; width: 1.9; align: left; wrapCount: 38`
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
          this.quaternion = new AFRAME.THREE.Quaternion()
          // Shoulder edge offset - left hand connects to left edge, right to right
          this.edgeOffset = this.data.hand === 'left' ? -0.2 : 0.2
        },
        tick: function () {
          const shoulder = document.querySelector('#shoulder-box') as any
          if (!shoulder) return

          // Get shoulder world position and add edge offset
          shoulder.object3D.getWorldPosition(this.shoulderEdgePos)
          // Get shoulder's world rotation to properly offset the edge
          const shoulderRight = new AFRAME.THREE.Vector3(1, 0, 0)
          shoulderRight.applyQuaternion(shoulder.object3D.getWorldQuaternion(new AFRAME.THREE.Quaternion()))
          this.shoulderEdgePos.addScaledVector(shoulderRight, this.edgeOffset)

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
          hand: { type: 'string', default: 'left' }
        },
        init: function () {
          this.lastPosition = new AFRAME.THREE.Vector3()
          this.currentPosition = new AFRAME.THREE.Vector3()
          this.velocity = new AFRAME.THREE.Vector3()
          this.isGrounded = false
          this.playerBody = null

          // Get world position initially
          this.el.object3D.getWorldPosition(this.lastPosition)
        },
        tick: function (_time: number, delta: number) {
          if (!delta) return

          // Find the physics body
          if (!this.playerBody) {
            this.playerBody = document.querySelector('#player-body') as any
            return
          }

          const body = this.playerBody.body
          if (!body) return

          // Get current world position of hand
          this.el.object3D.getWorldPosition(this.currentPosition)

          // Check if hand is near ground (y < 0.25 means touching/near floor)
          this.isGrounded = this.currentPosition.y < 0.25

          if (this.isGrounded) {
            // Calculate hand movement delta
            this.velocity.subVectors(this.currentPosition, this.lastPosition)

            // Apply opposite force to physics body (push ground = move opposite direction)
            // Newton's third law: push ground one way, you move the other
            const pushForce = 80

            // Horizontal movement - push sideways to slide
            body.velocity.x -= this.velocity.x * pushForce
            body.velocity.z -= this.velocity.z * pushForce

            // Vertical movement - push down to go up (pushing off ground)
            // When hand moves down (negative y velocity), push body up
            body.velocity.y -= this.velocity.y * pushForce
          }

          // Store position for next frame
          this.lastPosition.copy(this.currentPosition)
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
      
      <!-- Physics body - the shoulder that falls with gravity -->
      <a-entity
        id="player-body"
        position="0 1.5 0"
        dynamic-body="mass: 70; linearDamping: 0.5; angularDamping: 0.99"
      >
        <!-- Shoulder box - visible representation -->
        <a-box
          id="shoulder-box"
          position="0 0 0"
          width="0.4"
          height="0.2"
          depth="0.2"
          color="#ffd93d"
        ></a-box>
      </a-entity>
      
      <!-- VR Camera Rig - shoulder anchored camera -->
      <a-entity id="rig" position="0 1.5 0" shoulder-camera-sync="shoulderOffsetY: 0.16; lockHorizontal: true; debugEveryMs: 250">
        <!-- Camera for VR view -->
        <a-camera id="camera" position="0 0 0" look-controls="pointerLockEnabled: true">
          <!-- In-headset debug HUD -->
          <a-entity
            id="debug-hud"
            position="-0.55 -0.5 -0.9"
            text="value: Waiting for VR debug...; color: #7CFF7C; width: 1.9; align: left; wrapCount: 38"
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
