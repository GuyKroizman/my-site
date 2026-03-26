import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useArcadeScene } from './useArcadeScene'
import { projects } from './cabinetData'
import ProjectCabinet from './ProjectCabinet'

export default function ArcadeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const [isMobile, setIsMobile] = useState(false)
  const [isIPhone, setIsIPhone] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua))
    setIsIPhone(/iPhone|iPad|iPod/i.test(ua))
  }, [])

  const handleNavigate = useCallback((path: string) => {
    navigate(path)
  }, [navigate])

  const { triggerZoom, overlayElementsRef } = useArcadeScene(canvasRef, overlayRef, handleNavigate)

  return (
    <div className="arcade-container">
      <canvas ref={canvasRef} className="arcade-canvas" />
      {/* Desktop: 3D positioned overlays */}
      {!isMobile && (
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
      )}
      {/* Mobile: scrollable grid over the starfield */}
      {isMobile && (
        <div className="arcade-mobile-grid">
          {projects.map((project) => {
            const disabled =
              (project.availability === 'desktop') ||
              (project.availability === 'vr') ||
              (project.availability === 'mobile-no-iphone' && isIPhone)
            return (
              <div key={project.id}>
                {disabled ? (
                  <ProjectCabinet
                    project={project}
                    isMobile={isMobile}
                    isIPhone={isIPhone}
                    onClick={() => {}}
                  />
                ) : (
                  <Link to={project.path} style={{ textDecoration: 'none' }}>
                    <ProjectCabinet
                      project={project}
                      isMobile={isMobile}
                      isIPhone={isIPhone}
                      onClick={() => {}}
                    />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="arcade-title">
        <h1>Welcome to My Site</h1>
        <p>{isMobile ? 'Tap a project to explore' : 'Click a project to explore'}</p>
      </div>
    </div>
  )
}
