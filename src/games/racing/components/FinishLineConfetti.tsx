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
  rotation: number
  rotationSpeed: number
  life: number
  decay: number
}

interface FinishLineConfettiProps {
  triggerCount: number
  origin?: { x: number; y: number } | null
}

function spawnBurst(particles: Particle[], originX: number, originY: number, _w: number, h: number) {
  const countPerSide = 80
  const spread = h * 0.06

  // Left side burst — mostly upward with slight leftward lean
  for (let i = 0; i < countPerSide; i++) {
    const speed = 3 + Math.random() * 2
    const sideways = (Math.random() - 0.5) * 3
    particles.push({
      x: originX - 10,
      y: originY + (Math.random() - 0.5) * spread,
      vx: -(1 + Math.random() * 2) + sideways,
      vy: -speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 8 + Math.random() * 12,
      h: 4 + Math.random() * 6,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      life: 1,
      decay: 0.004 + Math.random() * 0.004
    })
  }

  // Right side burst — mostly upward with slight rightward lean
  for (let i = 0; i < countPerSide; i++) {
    const speed = 3 + Math.random() * 2
    const sideways = (Math.random() - 0.5) * 3
    particles.push({
      x: originX + 10,
      y: originY + (Math.random() - 0.5) * spread,
      vx: (1 + Math.random() * 2) + sideways,
      vy: -speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 8 + Math.random() * 12,
      h: 4 + Math.random() * 6,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      life: 1,
      decay: 0.004 + Math.random() * 0.004
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

    // Immediate burst
    spawnBurst(particlesRef.current, ox, oy, w, h)

    // Schedule 2 follow-up waves for a fuller effect
    pendingWavesRef.current = 2
    const wave1 = setTimeout(() => {
      spawnBurst(particlesRef.current, ox, oy, w, h)
      pendingWavesRef.current--
    }, 150)
    const wave2 = setTimeout(() => {
      spawnBurst(particlesRef.current, ox, oy, w, h)
      pendingWavesRef.current--
    }, 350)

    if (isAnimatingRef.current) return
    isAnimatingRef.current = true

    const gravity = 0.12

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
        p.vy += gravity
        p.vx *= 0.99
        p.rotation += p.rotationSpeed
        p.life -= p.decay

        if (p.life <= 0 || p.y > ch + 30) {
          particles.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = Math.min(1, p.life * 1.5)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
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
