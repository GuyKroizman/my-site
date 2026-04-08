import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArcadeScene } from './useArcadeScene'
import { projects } from './cabinetData'
import ProjectCabinet from './ProjectCabinet'
import { isIPhoneBrowser, isMobileBrowser } from '../../utils/runtime'

export default function ArcadeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const [isMobile, setIsMobile] = useState(false)
  const [isIPhone, setIsIPhone] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileBrowser())
    setIsIPhone(isIPhoneBrowser())
  }, [])

  const handleNavigate = useCallback((path: string) => {
    navigate(path)
  }, [navigate])

  const { triggerZoom, overlayElementsRef } = useArcadeScene(canvasRef, overlayRef, handleNavigate)

  return (
    <div className="arcade-container">
      <canvas ref={canvasRef} className="arcade-canvas" />
      <div ref={overlayRef} className="arcade-overlay">
        {projects.map((project, i) => (
          <div
            key={project.id}
            className="arcade-card-wrapper"
            ref={(el) => {
              if (el) overlayElementsRef.current[i] = el
            }}
          >
            <ProjectCabinet
              project={project}
              isMobile={isMobile}
              isIPhone={isIPhone}
              onClick={() => triggerZoom(i)}
            />
          </div>
        ))}
      </div>
      <div className="arcade-title">
        <h1>Welcome</h1>
        <p>My name is Guy Kroizman</p>
        <p>Click a project to explore</p>
      </div>
    </div>
  )
}
