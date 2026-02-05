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
    // Load A-Frame script dynamically
    if (!scriptLoadedRef.current && !document.querySelector('script[src*="aframe"]')) {
      scriptLoadedRef.current = true
      const script = document.createElement('script')
      script.src = 'https://aframe.io/releases/1.5.0/aframe.min.js'
      script.async = true
      script.onload = () => {
        // Force re-render after A-Frame loads
        if (sceneRef.current) {
          sceneRef.current.innerHTML = getSceneHTML()
        }
      }
      document.head.appendChild(script)
    } else if (sceneRef.current && (window as any).AFRAME) {
      sceneRef.current.innerHTML = getSceneHTML()
    }

    return () => {
      // Cleanup A-Frame scene on unmount
      if (sceneRef.current) {
        sceneRef.current.innerHTML = ''
      }
    }
  }, [])

  const getSceneHTML = () => `
    <a-scene vr-mode-ui="enabled: true" background="color: #1a1a2e">
      <!-- Room - big enclosed space -->
      <!-- Floor -->
      <a-plane 
        position="0 0 0" 
        rotation="-90 0 0" 
        width="30" 
        height="30" 
        color="#3d3d5c"
        shadow="receive: true"
      ></a-plane>
      
      <!-- Ceiling -->
      <a-plane 
        position="0 12 0" 
        rotation="90 0 0" 
        width="30" 
        height="30" 
        color="#2a2a4a"
      ></a-plane>
      
      <!-- Walls -->
      <a-plane position="0 6 -15" width="30" height="12" color="#4a4a6a"></a-plane>
      <a-plane position="0 6 15" rotation="0 180 0" width="30" height="12" color="#4a4a6a"></a-plane>
      <a-plane position="-15 6 0" rotation="0 90 0" width="30" height="12" color="#4a4a6a"></a-plane>
      <a-plane position="15 6 0" rotation="0 -90 0" width="30" height="12" color="#4a4a6a"></a-plane>
      
      <!-- Low box - easy to touch -->
      <a-box 
        position="-3 0.5 -5" 
        width="2" 
        height="1" 
        depth="2" 
        color="#ff6b6b"
        shadow="cast: true; receive: true"
      ></a-box>
      
      <!-- Very high pillar box -->
      <a-box 
        position="4 5 -6" 
        width="1.5" 
        height="10" 
        depth="1.5" 
        color="#4ecdc4"
        shadow="cast: true; receive: true"
      ></a-box>
      
      <!-- Player body - shoulder box between hands -->
      <a-entity id="player" position="0 1.6 0">
        <!-- Shoulder box (torso proxy) -->
        <a-box
          id="shoulder-box"
          position="0 0 0"
          width="0.4"
          height="0.2"
          depth="0.15"
          color="#ffd93d"
        ></a-box>
        
        <!-- Left arm -->
        <a-entity id="left-arm" position="-0.3 0 0">
          <!-- Long cylinder arm -->
          <a-cylinder
            position="0 -0.4 0"
            radius="0.05"
            height="0.6"
            color="#ffb347"
            rotation="0 0 0"
          ></a-cylinder>
          <!-- Palm ball -->
          <a-sphere
            id="left-palm"
            position="0 -0.8 0"
            radius="0.12"
            color="#ff7f50"
          ></a-sphere>
        </a-entity>
        
        <!-- Right arm -->
        <a-entity id="right-arm" position="0.3 0 0">
          <!-- Long cylinder arm -->
          <a-cylinder
            position="0 -0.4 0"
            radius="0.05"
            height="0.6"
            color="#ffb347"
            rotation="0 0 0"
          ></a-cylinder>
          <!-- Palm ball -->
          <a-sphere
            id="right-palm"
            position="0 -0.8 0"
            radius="0.12"
            color="#ff7f50"
          ></a-sphere>
        </a-entity>
        
        <!-- Camera attached to player for first-person view -->
        <a-camera position="0 0.3 0" look-controls="pointerLockEnabled: true"></a-camera>
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
