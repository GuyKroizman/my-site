import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { registerFloatyComponents } from '../games/floaty/components'
import { getSceneHTML } from '../games/floaty/sceneBuilder'

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

      if (!(window as any).AFRAME || !sceneRef.current) return

      registerFloatyComponents()
      sceneRef.current.innerHTML = getSceneHTML()
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
    </div>
  )
}
