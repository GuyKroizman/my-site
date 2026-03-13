import { useEffect, useRef } from 'react'

const COLORS = [
  '#ffeb3b', '#ffd600', '#ff9800', '#ff5722',
  '#f44336', '#e91e63', '#9c27b0', '#673ab7',
  '#00bcd4', '#4caf50', '#8bc34a', '#ffffff'
]

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  w: number
  h: number
  scale: number
  rotation: number
  rotationSpeed: number
  life: number
  decay: number
}

interface FinishLineConfettiProps {
  triggerCount: number
  origin?: { x: number; y: number } | null
}

function spawnBurst(particles: Particle[], originX: number, originY: number) {
  const countPerSide = 80

  // Left side — shoots outward from left of origin
  for (let i = 0; i < countPerSide; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 5
    particles.push({
      x: originX - 10,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 8 + Math.random() * 12,
      h: 4 + Math.random() * 6,
      scale: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      life: 1,
      decay: 0.006 + Math.random() * 0.006
    })
  }

  // Right side — shoots outward from right of origin
  for (let i = 0; i < countPerSide; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 5
    particles.push({
      x: originX + 10,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 8 + Math.random() * 12,
      h: 4 + Math.random() * 6,
      scale: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      life: 1,
      decay: 0.006 + Math.random() * 0.006
    })
  }
}

export function FinishLineConfetti({ triggerCount, origin }: FinishLineConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const lastBurstRef = useRef(0)
  const isAnimatingRef = useRef(false)
  const pendingWavesRef = useRef(0)

  useEffect(() => {
    if (triggerCount <= 0 || triggerCount <= lastBurstRef.current) return
    lastBurstRef.current = triggerCount

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w
    canvas.height = h

    const ox = origin?.x ?? w / 2
    const oy = origin?.y ?? h * 0.45

    spawnBurst(particlesRef.current, ox, oy)

    pendingWavesRef.current = 2
    const wave1 = setTimeout(() => {
      spawnBurst(particlesRef.current, ox, oy)
      pendingWavesRef.current--
    }, 150)
    const wave2 = setTimeout(() => {
      spawnBurst(particlesRef.current, ox, oy)
      pendingWavesRef.current--
    }, 350)

    if (isAnimatingRef.current) return
    isAnimatingRef.current = true

    const tick = () => {
      if (!canvas) return
      const cw = canvas.width
      const ch = canvas.height
      ctx.clearRect(0, 0, cw, ch)

      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        // Drag slows them down (simulates air resistance / falling back to surface)
        p.vx *= 0.93
        p.vy *= 0.93
        // Shrink as they "fall back to the ground"
        p.scale = Math.max(0, p.life)
        p.rotation += p.rotationSpeed
        p.life -= p.decay

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        const sw = p.w * p.scale
        const sh = p.h * p.scale

        ctx.save()
        ctx.globalAlpha = Math.min(1, p.life * 1.5)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-sw / 2, -sh / 2, sw, sh)
        ctx.restore()
      }

      if (particles.length > 0 || pendingWavesRef.current > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        isAnimatingRef.current = false
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      clearTimeout(wave1)
      clearTimeout(wave2)
    }
  }, [triggerCount, origin])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
      aria-hidden
    />
  )
}
