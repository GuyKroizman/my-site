import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'

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

  useEffect(() => {
    const loadScripts = async () => {
      // Load A-Frame first
      if (!document.querySelector('script[src*="aframe.min"]')) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script')
          script.src = 'https://aframe.io/releases/1.5.0/aframe.min.js'
          script.onload = () => resolve()
          document.head.appendChild(script)
        })
      }

      // Load physics system
      if (!document.querySelector('script[src*="aframe-physics"]')) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/gh/c-frame/aframe-physics-system@v4.2.2/dist/aframe-physics-system.min.js'
          script.onload = () => resolve()
          document.head.appendChild(script)
        })
      }

      const AFRAME = (window as any).AFRAME
      if (!AFRAME) return

      // Register arm-connector component - connects arm cylinder from shoulder to hand
      if (!AFRAME.components['arm-connector']) {
        AFRAME.registerComponent('arm-connector', {
          schema: {
            hand: { type: 'string', default: 'left' }
          },
          init: function() {
            this.shoulderPos = new AFRAME.THREE.Vector3()
            this.handPos = new AFRAME.THREE.Vector3()
            this.direction = new AFRAME.THREE.Vector3()
            this.quaternion = new AFRAME.THREE.Quaternion()
            this.up = new AFRAME.THREE.Vector3(0, 1, 0)
          },
          tick: function() {
            const shoulder = document.querySelector('#shoulder-box') as any
            if (!shoulder) return
            
            // Get world positions
            shoulder.object3D.getWorldPosition(this.shoulderPos)
            this.el.object3D.getWorldPosition(this.handPos)
            
            // Calculate direction and distance
            this.direction.subVectors(this.handPos, this.shoulderPos)
            const distance = this.direction.length()
            
            // Get the arm cylinder (first cylinder child)
            const armCylinder = this.el.querySelector('a-cylinder')
            if (!armCylinder) return
            
            // Position cylinder at midpoint between shoulder and hand (in local space)
            // Convert shoulder position to local space of hand entity
            const localShoulderPos = this.el.object3D.worldToLocal(this.shoulderPos.clone())
            
            // Midpoint in local space
            armCylinder.object3D.position.set(
              localShoulderPos.x / 2,
              localShoulderPos.y / 2,
              localShoulderPos.z / 2
            )
            
            // Scale cylinder to match distance
            armCylinder.setAttribute('height', distance)
            
            // Rotate cylinder to point from hand toward shoulder
            if (distance > 0.01) {
              const localDir = localShoulderPos.normalize()
              // Cylinder's default orientation is along Y axis
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
          init: function() {
            this.lastPosition = new AFRAME.THREE.Vector3()
            this.currentPosition = new AFRAME.THREE.Vector3()
            this.velocity = new AFRAME.THREE.Vector3()
            this.isGrounded = false
            this.rig = document.querySelector('#rig')
            
            // Get world position initially
            this.el.object3D.getWorldPosition(this.lastPosition)
          },
          tick: function(_time: number, delta: number) {
            if (!this.rig || !delta) return
            
            const rigBody = this.rig.body
            if (!rigBody) return
            
            // Get current world position of hand
            this.el.object3D.getWorldPosition(this.currentPosition)
            
            // Check if hand is near ground (y < 0.25 means touching/near floor)
            this.isGrounded = this.currentPosition.y < 0.25
            
            if (this.isGrounded) {
              // Calculate hand movement delta
              this.velocity.subVectors(this.currentPosition, this.lastPosition)
              
              // Apply opposite force to rig (push ground = move opposite direction)
              // Newton's third law: push ground one way, you move the other
              const pushForce = 80
              
              // Horizontal movement - push sideways to slide
              rigBody.velocity.x -= this.velocity.x * pushForce
              rigBody.velocity.z -= this.velocity.z * pushForce
              
              // Vertical movement - push down to go up (pushing off ground)
              // When hand moves down (negative y velocity), push body up
              rigBody.velocity.y -= this.velocity.y * pushForce
            }
            
            // Store position for next frame
            this.lastPosition.copy(this.currentPosition)
          }
        })
      }

      // Render the scene
      if (sceneRef.current) {
        sceneRef.current.innerHTML = getSceneHTML()
      }
    }

    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true
      loadScripts()
    }

    return () => {
      if (sceneRef.current) {
        sceneRef.current.innerHTML = ''
      }
    }
  }, [])

  const getSceneHTML = () => `
    <a-scene 
      vr-mode-ui="enabled: true" 
      background="color: #1a1a2e"
      physics="driver: ammo; gravity: 0 -9.8 0; debug: false"
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
        ammo-body="type: static"
        ammo-shape="type: box; fit: all"
      ></a-plane>
      
      <!-- Ceiling -->
      <a-plane 
        position="0 12 0" 
        rotation="90 0 0" 
        width="30" 
        height="30" 
        color="#2a2a4a"
        ammo-body="type: static"
        ammo-shape="type: box; fit: all"
      ></a-plane>
      
      <!-- Walls with physics -->
      <a-plane position="0 6 -15" width="30" height="12" color="#4a4a6a" ammo-body="type: static" ammo-shape="type: box; fit: all"></a-plane>
      <a-plane position="0 6 15" rotation="0 180 0" width="30" height="12" color="#4a4a6a" ammo-body="type: static" ammo-shape="type: box; fit: all"></a-plane>
      <a-plane position="-15 6 0" rotation="0 90 0" width="30" height="12" color="#4a4a6a" ammo-body="type: static" ammo-shape="type: box; fit: all"></a-plane>
      <a-plane position="15 6 0" rotation="0 -90 0" width="30" height="12" color="#4a4a6a" ammo-body="type: static" ammo-shape="type: box; fit: all"></a-plane>
      
      <!-- Low box - easy to touch -->
      <a-box 
        position="-3 0.5 -5" 
        width="2" 
        height="1" 
        depth="2" 
        color="#ff6b6b"
        shadow="cast: true; receive: true"
        ammo-body="type: static"
        ammo-shape="type: box"
      ></a-box>
      
      <!-- Very high pillar box -->
      <a-box 
        position="4 5 -6" 
        width="1.5" 
        height="10" 
        depth="1.5" 
        color="#4ecdc4"
        shadow="cast: true; receive: true"
        ammo-body="type: static"
        ammo-shape="type: box"
      ></a-box>
      
      <!-- VR Camera Rig with physics (affected by gravity) -->
      <!-- The rig is the player body that falls and can be pushed by hands -->
      <a-entity 
        id="rig" 
        position="0 1.5 0"
        ammo-body="type: dynamic; mass: 70; linearDamping: 0.5; angularDamping: 0.99"
        ammo-shape="type: box; fit: manual; halfExtents: 0.2 0.1 0.1"
      >
        <!-- Shoulder box - the main body that falls to ground -->
        <!-- This is the player's "torso" between the hands -->
        <a-box
          id="shoulder-box"
          position="0 0 0"
          width="0.4"
          height="0.2"
          depth="0.2"
          color="#ffd93d"
        ></a-box>
        
        <!-- Camera slightly above shoulder for viewing -->
        <a-camera id="camera" position="0 0.3 0" look-controls="pointerLockEnabled: true"></a-camera>
        
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
    <div className="w-full h-screen flex flex-col overflow-hidden">
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
    </div>
  )
}
