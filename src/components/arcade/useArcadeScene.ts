import { useEffect, useRef, RefObject } from 'react'
import * as THREE from 'three'
import { projects } from './cabinetData'

interface ArcadeSceneState {
  ringAngle: number
  targetRingAngle: number
  isZooming: boolean
  zoomTarget: THREE.Vector3 | null
  zoomStartPos: THREE.Vector3 | null
  zoomProgress: number
  zoomCabinetIndex: number
  mouseX: number
  mouseY: number
  cameraBaseX: number
  cameraBaseY: number
  touchStartX: number
  touchStartAngle: number
  isTouching: boolean
  isMobile: boolean
  onNavigate: ((path: string) => void) | null
}

const RING_RADIUS = 4
const ROTATION_SPEED = 0.08
const PARALLAX_STRENGTH = 0.8
const PARALLAX_LERP = 0.05
const ZOOM_DURATION = 800

function createStarfield(count: number): THREE.Points {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 20 + Math.random() * 30
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.08,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
  })
  return new THREE.Points(geometry, material)
}

function createDust(count: number): THREE.Points {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 15
    positions[i * 3 + 1] = (Math.random() - 0.5) * 15
    positions[i * 3 + 2] = (Math.random() - 0.5) * 15
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: 0x8888ff,
    size: 0.04,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.3,
  })
  return new THREE.Points(geometry, material)
}

function createCabinet(color: string): THREE.Group {
  const group = new THREE.Group()

  const boxGeo = new THREE.BoxGeometry(1.8, 2.2, 0.15)
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x111122,
    transparent: true,
    opacity: 0.6,
    metalness: 0.8,
    roughness: 0.3,
  })
  const box = new THREE.Mesh(boxGeo, boxMat)
  group.add(box)

  const edgesGeo = new THREE.EdgesGeometry(boxGeo)
  const edgesMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.9,
  })
  const edges = new THREE.LineSegments(edgesGeo, edgesMat)
  group.add(edges)

  // Inner glow plane facing the camera
  const glowGeo = new THREE.PlaneGeometry(1.6, 2.0)
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.05,
    side: THREE.FrontSide,
  })
  const glow = new THREE.Mesh(glowGeo, glowMat)
  glow.position.z = 0.08
  group.add(glow)

  return group
}

export function useArcadeScene(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  overlayRef: RefObject<HTMLDivElement | null>,
  onNavigate: (path: string) => void,
) {
  const stateRef = useRef<ArcadeSceneState>({
    ringAngle: 0,
    targetRingAngle: 0,
    isZooming: false,
    zoomTarget: null,
    zoomStartPos: null,
    zoomProgress: 0,
    zoomCabinetIndex: -1,
    mouseX: 0,
    mouseY: 0,
    cameraBaseX: 0,
    cameraBaseY: 0,
    touchStartX: 0,
    touchStartAngle: 0,
    isTouching: false,
    isMobile: false,
    onNavigate: null,
  })

  const cabinetsRef = useRef<THREE.Group[]>([])
  const overlayElementsRef = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    stateRef.current.onNavigate = onNavigate
  }, [onNavigate])

  useEffect(() => {
    const canvas = canvasRef.current
    const overlayEl = overlayRef.current
    if (!canvas || !overlayEl) return

    const state = stateRef.current
    state.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    const starCount = state.isMobile ? 800 : 1500
    const dustCount = state.isMobile ? 100 : 200
    const dpr = Math.min(window.devicePixelRatio, state.isMobile ? 2 : 3)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(dpr)
    renderer.setSize(window.innerWidth, window.innerHeight)

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0, 8)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x222244, 1.5)
    scene.add(ambientLight)
    const pointLight = new THREE.PointLight(0xffffff, 1, 20)
    pointLight.position.copy(camera.position)
    scene.add(pointLight)

    // Starfield
    const starfield = createStarfield(starCount)
    scene.add(starfield)

    // Dust
    const dust = createDust(dustCount)
    scene.add(dust)

    // Cabinets
    const ring = new THREE.Group()
    scene.add(ring)

    const cabinets: THREE.Group[] = []
    projects.forEach((project, i) => {
      const cabinet = createCabinet(project.color)
      const angle = (i / projects.length) * Math.PI * 2
      cabinet.position.x = Math.sin(angle) * RING_RADIUS
      cabinet.position.z = Math.cos(angle) * RING_RADIUS
      cabinet.userData = { index: i, baseAngle: angle }
      ring.add(cabinet)
      cabinets.push(cabinet)
    })
    cabinetsRef.current = cabinets

    // Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    // Mouse parallax
    const handlePointerMove = (e: PointerEvent) => {
      state.mouseX = (e.clientX / window.innerWidth - 0.5) * 2
      state.mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }

    // Touch swipe
    const handleTouchStart = (e: TouchEvent) => {
      state.isTouching = true
      state.touchStartX = e.touches[0].clientX
      state.touchStartAngle = state.ringAngle
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!state.isTouching) return
      const deltaX = e.touches[0].clientX - state.touchStartX
      state.ringAngle = state.touchStartAngle + deltaX * 0.005
    }
    const handleTouchEnd = () => {
      state.isTouching = false
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true })
    canvas.addEventListener('touchend', handleTouchEnd)

    // Animation
    let lastTime = performance.now()
    let animId = 0

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate)
      const dt = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      // Ring rotation
      if (!state.isZooming && !state.isTouching) {
        state.ringAngle += ROTATION_SPEED * dt
      }
      ring.rotation.y = state.ringAngle

      // Make cabinets face camera
      cabinets.forEach((cab) => {
        cab.lookAt(camera.position)
      })

      // Camera parallax
      if (!state.isZooming) {
        state.cameraBaseX += (state.mouseX * PARALLAX_STRENGTH - state.cameraBaseX) * PARALLAX_LERP
        state.cameraBaseY += (-state.mouseY * PARALLAX_STRENGTH * 0.5 - state.cameraBaseY) * PARALLAX_LERP
        camera.position.x = state.cameraBaseX
        camera.position.y = state.cameraBaseY
        camera.lookAt(0, 0, 0)
      }

      // Zoom animation
      if (state.isZooming && state.zoomTarget && state.zoomStartPos) {
        state.zoomProgress += dt / (ZOOM_DURATION / 1000)
        const t = Math.min(state.zoomProgress, 1)
        // Ease out cubic
        const ease = 1 - Math.pow(1 - t, 3)

        camera.position.lerpVectors(state.zoomStartPos, state.zoomTarget, ease)
        camera.lookAt(state.zoomTarget)

        // Fade out other cabinets' overlay elements
        overlayElementsRef.current.forEach((el, i) => {
          if (i !== state.zoomCabinetIndex) {
            el.style.opacity = String(1 - ease)
          }
        })

        if (t >= 1) {
          state.isZooming = false
          const path = projects[state.zoomCabinetIndex]?.path
          if (path && state.onNavigate) {
            state.onNavigate(path)
          }
        }
      }

      // Drift dust particles
      const dustPositions = dust.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < dustCount; i++) {
        dustPositions.setX(i, dustPositions.getX(i) + (Math.random() - 0.5) * 0.005)
        dustPositions.setY(i, dustPositions.getY(i) + (Math.random() - 0.5) * 0.005)
        dustPositions.setZ(i, dustPositions.getZ(i) + (Math.random() - 0.5) * 0.005)
      }
      dustPositions.needsUpdate = true

      // Slow starfield rotation
      starfield.rotation.y += 0.002 * dt

      // Update point light to camera
      pointLight.position.copy(camera.position)

      renderer.render(scene, camera)

      // Project cabinet 3D positions to screen for overlay
      cabinets.forEach((cab, i) => {
        const worldPos = new THREE.Vector3()
        cab.getWorldPosition(worldPos)
        const projected = worldPos.clone().project(camera)
        const x = (projected.x * 0.5 + 0.5) * window.innerWidth
        const y = (-projected.y * 0.5 + 0.5) * window.innerHeight
        const el = overlayElementsRef.current[i]
        if (el) {
          el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
          // Scale based on z distance - closer = bigger
          const dist = worldPos.distanceTo(camera.position)
          const scale = Math.max(0.4, Math.min(1.2, 5 / dist))
          el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`
          // Fade based on whether cabinet is behind the ring (z relative to camera)
          const cameraDir = new THREE.Vector3()
          camera.getWorldDirection(cameraDir)
          const toObj = worldPos.clone().sub(camera.position).normalize()
          const dot = cameraDir.dot(toObj)
          const visibility = Math.max(0, Math.min(1, (dot + 0.2) * 2))
          el.style.opacity = state.isZooming
            ? el.style.opacity // managed by zoom animation
            : String(visibility)
        }
      })
    }

    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      renderer.dispose()
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
        if (obj instanceof THREE.LineSegments) {
          obj.geometry.dispose()
          ;(obj.material as THREE.Material).dispose()
        }
        if (obj instanceof THREE.Points) {
          obj.geometry.dispose()
          ;(obj.material as THREE.Material).dispose()
        }
      })
    }
  }, [canvasRef, overlayRef])

  const triggerZoom = (index: number) => {
    const state = stateRef.current
    if (state.isZooming) return
    const cabinet = cabinetsRef.current[index]
    if (!cabinet) return

    const worldPos = new THREE.Vector3()
    cabinet.getWorldPosition(worldPos)

    // Zoom to a position slightly in front of the cabinet
    const cameraPos = new THREE.Vector3()
    const currentCam = new THREE.Vector3(state.cameraBaseX, state.cameraBaseY, 8)
    const direction = worldPos.clone().sub(currentCam).normalize()
    cameraPos.copy(worldPos).sub(direction.multiplyScalar(2))

    state.isZooming = true
    state.zoomTarget = worldPos
    state.zoomStartPos = currentCam.clone()
    state.zoomProgress = 0
    state.zoomCabinetIndex = index
  }

  return { triggerZoom, overlayElementsRef }
}
