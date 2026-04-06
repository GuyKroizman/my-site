import * as THREE from 'three'
import type { GroundCoverStyle, GroundTheme } from './levels/types'
import { addRoundedRectPath, type TrackRectBounds } from './trackGeometry'

type GroundPalette = {
  base: number[][]
  accent: number[][]
  dirt: number[][]
}

const GROUND_PALETTES: Record<GroundTheme, GroundPalette> = {
  grass: {
    base: [[58, 107, 35], [68, 120, 40], [50, 95, 30], [75, 130, 45], [45, 85, 28]],
    accent: [[60, 130, 30], [80, 150, 40], [70, 140, 35], [90, 160, 45]],
    dirt: [[100, 80, 50], [90, 72, 45], [85, 68, 40]],
  },
  dry: {
    base: [[140, 120, 50], [150, 130, 55], [130, 110, 45], [160, 138, 58], [120, 100, 42]],
    accent: [[165, 145, 60], [175, 155, 65], [155, 135, 55]],
    dirt: [[110, 85, 55], [100, 75, 48], [95, 70, 45]],
  },
  sand: {
    base: [[210, 185, 130], [218, 192, 138], [200, 178, 122], [222, 198, 145], [195, 172, 118]],
    accent: [[225, 205, 155], [232, 212, 162], [218, 198, 148]],
    dirt: [[160, 130, 90], [150, 120, 82], [145, 115, 78]],
  },
  snow: {
    base: [[230, 238, 245], [235, 242, 248], [225, 233, 242], [238, 245, 250], [222, 230, 240]],
    accent: [[240, 248, 252], [245, 250, 254], [235, 242, 248]],
    dirt: [[180, 190, 200], [170, 180, 190], [165, 175, 185]],
  },
  dirt: {
    base: [[120, 90, 60], [110, 82, 55], [130, 98, 65], [115, 85, 58], [125, 92, 62]],
    accent: [[140, 105, 70], [135, 100, 68], [145, 110, 72]],
    dirt: [[95, 70, 45], [88, 65, 42], [85, 62, 40]],
  },
  autumn: {
    base: [[160, 95, 40], [170, 100, 45], [150, 90, 38], [178, 108, 48], [145, 85, 35]],
    accent: [[190, 115, 55], [185, 110, 52], [195, 120, 58]],
    dirt: [[100, 75, 50], [92, 70, 46], [88, 66, 43]],
  },
}

const TUFT_SCATTER_LAYERS = [
  { spacing: 0.72, offsetX: 0.13, offsetZ: 0.31, jitter: 0.62, minFill: 0.998, scaleMin: 0.72, scaleRange: 0.42, seed: 0, rotation: -0.34 },
  { spacing: 0.82, offsetX: 0.61, offsetZ: 0.18, jitter: 0.54, minFill: 0.992, scaleMin: 0.48, scaleRange: 0.22, seed: 20, rotation: 0.49 },
  { spacing: 0.58, offsetX: 0.27, offsetZ: 0.74, jitter: 0.46, minFill: 0.982, scaleMin: 0.26, scaleRange: 0.13, seed: 40, rotation: -0.92 },
  { spacing: 0.48, offsetX: 0.44, offsetZ: 0.57, jitter: 0.34, minFill: 0.94, scaleMin: 0.14, scaleRange: 0.08, seed: 60, rotation: 0.88 }
] as const

function getGroundPalette(theme: GroundTheme): GroundPalette {
  return GROUND_PALETTES[theme]
}

function createSolidGroundMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true
  })
}

function createGrassTexture(theme: GroundTheme): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const pal = getGroundPalette(theme)
  const { base: baseColors, accent: accentColors, dirt: dirtColors } = pal

  if (theme === 'dry') {
    ctx.fillStyle = 'rgb(146,126,54)'
    ctx.fillRect(0, 0, size, size)

    for (let i = 0; i < 85; i++) {
      const x = Math.floor(Math.random() * size)
      const y = Math.floor(Math.random() * size)
      const patchSize = Math.random() < 0.7 ? 2 : 3
      const colorSet = Math.random() < 0.18 ? dirtColors : Math.random() < 0.55 ? accentColors : baseColors
      const color = colorSet[Math.floor(Math.random() * colorSet.length)]
      const v = 0.96 + Math.random() * 0.08
      ctx.fillStyle = `rgb(${Math.floor(color[0] * v)},${Math.floor(color[1] * v)},${Math.floor(color[2] * v)})`
      ctx.fillRect(x, y, patchSize, patchSize)
    }

    for (let i = 0; i < 45; i++) {
      const x = Math.floor(Math.random() * size)
      const y = Math.floor(Math.random() * size)
      const color = accentColors[Math.floor(Math.random() * accentColors.length)]
      const v = 1.02 + Math.random() * 0.06
      ctx.fillStyle = `rgb(${Math.min(255, Math.floor(color[0] * v))},${Math.min(255, Math.floor(color[1] * v))},${Math.min(255, Math.floor(color[2] * v))})`
      ctx.fillRect(x, y, 1, 1)
    }
  } else {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = Math.random()
        const color = r < 0.08
          ? dirtColors[Math.floor(Math.random() * dirtColors.length)]
          : r < 0.25
            ? accentColors[Math.floor(Math.random() * accentColors.length)]
            : baseColors[Math.floor(Math.random() * baseColors.length)]
        const v = 0.9 + Math.random() * 0.2
        ctx.fillStyle = `rgb(${Math.floor(color[0] * v)},${Math.floor(color[1] * v)},${Math.floor(color[2] * v)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function createInfieldShape(bounds: TrackRectBounds, radius: number): THREE.Shape {
  const shape = new THREE.Shape()
  addRoundedRectPath(shape, bounds, radius)
  return shape
}

function pointInsideRoundedRect(x: number, z: number, bounds: TrackRectBounds, radius: number): boolean {
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
    return false
  }

  const effectiveRadius = Math.max(
    0,
    Math.min(radius, (bounds.maxX - bounds.minX) / 2, (bounds.maxZ - bounds.minZ) / 2)
  )
  if (effectiveRadius === 0) {
    return true
  }

  const clampedX = THREE.MathUtils.clamp(x, bounds.minX + effectiveRadius, bounds.maxX - effectiveRadius)
  const clampedZ = THREE.MathUtils.clamp(z, bounds.minZ + effectiveRadius, bounds.maxZ - effectiveRadius)
  const dx = x - clampedX
  const dz = z - clampedZ
  return dx * dx + dz * dz <= effectiveRadius * effectiveRadius
}

function hash2D(x: number, z: number, seed: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123
  return value - Math.floor(value)
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function createGrassBladeGeometry(height: number, width: number): THREE.BufferGeometry {
  const halfWidth = width / 2
  const topWidth = width * 0.78
  const halfTopWidth = topWidth / 2
  const positions = new Float32Array([
    -halfWidth, 0, 0,
    halfWidth, 0, 0,
    -halfTopWidth, height, 0,
    -halfTopWidth, height, 0,
    halfWidth, 0, 0,
    halfTopWidth, height, 0,
  ])
  const colors = new Float32Array(18)
  const stem = new THREE.Color(0x10110c)
  const frontTop = new THREE.Color(0x4f8f2e)
  const backTop = new THREE.Color(0x86d04f)

  for (let i = 0; i < 6; i++) {
    const y = positions[i * 3 + 1]
    const t = THREE.MathUtils.clamp(y / height, 0, 1)
    const topColor = i < 3 ? frontTop : backTop
    const color = stem.clone().lerp(topColor, Math.pow(t, 0.85))
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function addTrackGround(
  trackMesh: THREE.Group,
  groundTheme: GroundTheme,
  groundCoverStyle: GroundCoverStyle,
  outerBounds: TrackRectBounds,
  innerBounds: TrackRectBounds,
  radius: number
): void {
  if (groundCoverStyle === 'grassTufts') {
    addTuftGrass(trackMesh, groundTheme, outerBounds, innerBounds, radius)
    return
  }

  addTexturedGround(trackMesh, groundTheme, innerBounds, radius)
}

function addTexturedGround(
  trackMesh: THREE.Group,
  groundTheme: GroundTheme,
  innerBounds: TrackRectBounds,
  radius: number
): void {
  const grassTexture = createGrassTexture(groundTheme)
  const infieldShape = createInfieldShape(innerBounds, radius)
  const infieldGeometry = new THREE.ShapeGeometry(infieldShape, 32)
  const tileWorldSize = 8.33

  const infieldTexture = grassTexture.clone()
  infieldTexture.needsUpdate = true
  infieldTexture.repeat.set(1 / tileWorldSize, 1 / tileWorldSize)
  const infieldPlane = new THREE.Mesh(infieldGeometry, new THREE.MeshStandardMaterial({
    map: infieldTexture,
    flatShading: true
  }))
  infieldPlane.rotation.x = -Math.PI / 2
  infieldPlane.position.y = 0.02
  infieldPlane.receiveShadow = true
  trackMesh.add(infieldPlane)

  const groundSize = 500
  const groundTexture = grassTexture.clone()
  groundTexture.needsUpdate = true
  groundTexture.repeat.set(groundSize / tileWorldSize, groundSize / tileWorldSize)
  const groundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({ map: groundTexture, flatShading: true })
  )
  groundPlane.rotation.x = -Math.PI / 2
  groundPlane.position.y = 0
  groundPlane.receiveShadow = true
  trackMesh.add(groundPlane)
}

function addTuftGrass(
  trackMesh: THREE.Group,
  groundTheme: GroundTheme,
  outerBounds: TrackRectBounds,
  innerBounds: TrackRectBounds,
  radius: number
): void {
  const palette = getGroundPalette(groundTheme)
  const backgroundGround = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    createSolidGroundMaterial(new THREE.Color(`rgb(${palette.base[0].join(',')})`))
  )
  backgroundGround.rotation.x = -Math.PI / 2
  backgroundGround.position.y = 0
  backgroundGround.receiveShadow = true
  trackMesh.add(backgroundGround)

  const bladeGeometry = createGrassBladeGeometry(0.58, 0.2)
  const bladeMaterial = new THREE.MeshStandardMaterial({
    flatShading: true,
    vertexColors: true,
    side: THREE.FrontSide
  })

  const placements: Array<{ x: number; z: number; y: number; scale: number; rotation: number; color: THREE.Color }> = []
  const sideBand = 28
  const frontBand = 34
  const backBand = 8
  const outerPatchBounds: TrackRectBounds = {
    minX: outerBounds.minX - sideBand,
    maxX: outerBounds.maxX + sideBand,
    minZ: outerBounds.minZ - frontBand,
    maxZ: outerBounds.maxZ + backBand
  }
  const outerPatchRadius = radius + sideBand
  const infieldMargin = 1.05
  const outerClearMargin = 1.35
  const fadeBand = 8
  const infieldBounds: TrackRectBounds = {
    minX: innerBounds.minX + infieldMargin,
    maxX: innerBounds.maxX - infieldMargin,
    minZ: innerBounds.minZ + infieldMargin,
    maxZ: innerBounds.maxZ - infieldMargin
  }
  const roadBounds: TrackRectBounds = {
    minX: outerBounds.minX - outerClearMargin,
    maxX: outerBounds.maxX + outerClearMargin,
    minZ: outerBounds.minZ - outerClearMargin,
    maxZ: outerBounds.maxZ + outerClearMargin
  }

  for (const layer of TUFT_SCATTER_LAYERS) {
    for (let gx = Math.floor(outerPatchBounds.minX / layer.spacing); gx <= Math.ceil(outerPatchBounds.maxX / layer.spacing); gx++) {
      for (let gz = Math.floor(outerPatchBounds.minZ / layer.spacing); gz <= Math.ceil(outerPatchBounds.maxZ / layer.spacing); gz++) {
        const localX = (gx + layer.offsetX) * layer.spacing
        const localZ = (gz + layer.offsetZ) * layer.spacing
        const cos = Math.cos(layer.rotation)
        const sin = Math.sin(layer.rotation)
        const baseX = localX * cos - localZ * sin
        const baseZ = localX * sin + localZ * cos
        const x = baseX + (hash2D(gx, gz, layer.seed + 1) - 0.5) * layer.spacing * layer.jitter
        const z = baseZ + (hash2D(gx, gz, layer.seed + 2) - 0.5) * layer.spacing * layer.jitter

        if (!pointInsideRoundedRect(x, z, outerPatchBounds, outerPatchRadius)) continue

        const inRoadOrBorder = pointInsideRoundedRect(x, z, roadBounds, radius + outerClearMargin)
          && !pointInsideRoundedRect(x, z, infieldBounds, Math.max(0, radius - infieldMargin))
        if (inRoadOrBorder) continue

        const inInfield = pointInsideRoundedRect(x, z, infieldBounds, Math.max(0, radius - infieldMargin))
        const inTrackside = pointInsideRoundedRect(x, z, outerPatchBounds, outerPatchRadius)
          && !pointInsideRoundedRect(x, z, roadBounds, radius + outerClearMargin)
        if (!inInfield && !inTrackside) continue

        const edgeDistance = Math.min(
          x - outerPatchBounds.minX,
          outerPatchBounds.maxX - x,
          z - outerPatchBounds.minZ,
          outerPatchBounds.maxZ - z
        )
        const edgeChance = THREE.MathUtils.clamp(edgeDistance / fadeBand, 0, 1)
        const fillChance = THREE.MathUtils.lerp(layer.minFill, 1, edgeChance)
        if (hash2D(gx, gz, layer.seed + 3) > fillChance) continue

        const accentMix = hash2D(gx, gz, layer.seed + 4)
        const baseColor = new THREE.Color(
          `rgb(${palette.base[positiveModulo(gx + gz, palette.base.length)].join(',')})`
        )
        const accentColor = new THREE.Color(
          `rgb(${palette.accent[positiveModulo(gx * 3 + gz * 5, palette.accent.length)].join(',')})`
        )

        placements.push({
          x,
          z,
          y: 0.03,
          scale: layer.scaleMin + hash2D(gx, gz, layer.seed + 5) * layer.scaleRange,
          rotation: hash2D(gx, gz, layer.seed + 6) * Math.PI,
          color: baseColor.lerp(accentColor, accentMix * 0.35)
        })
      }
    }
  }

  const bladeAngles = [0, Math.PI / 3, (Math.PI * 2) / 3]
  const grassMesh = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, placements.length * bladeAngles.length)
  grassMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

  const dummy = new THREE.Object3D()
  let instanceIndex = 0
  for (const placement of placements) {
    for (const angle of bladeAngles) {
      dummy.position.set(placement.x, placement.y, placement.z)
      dummy.rotation.set(
        (hash2D(instanceIndex, bladeAngles.length, 7) - 0.5) * 0.08,
        placement.rotation + angle,
        (hash2D(instanceIndex, bladeAngles.length, 8) - 0.5) * 0.08
      )
      dummy.scale.setScalar(placement.scale)
      dummy.updateMatrix()
      grassMesh.setMatrixAt(instanceIndex, dummy.matrix)
      grassMesh.setColorAt(instanceIndex, placement.color)
      instanceIndex += 1
    }
  }

  grassMesh.castShadow = false
  grassMesh.receiveShadow = false
  trackMesh.add(grassMesh)
}

export function addLaneDividers(trackMesh: THREE.Group, path: THREE.Vector3[]): void {
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    flatShading: true
  })
  const stripeWidth = 0.3
  const stripeLength = 2
  const gapLength = 2
  const stripeHeight = 0.03
  const stripeY = 0.1 + stripeHeight / 2 + 0.005
  const startOffset = 3
  const halfStripeWidth = stripeWidth / 2
  const spacing = stripeLength + gapLength

  const centerCurve = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < path.length - 1; i++) {
    centerCurve.add(new THREE.LineCurve3(path[i], path[i + 1]))
  }

  const totalLength = centerCurve.getLength()
  if (totalLength <= 0) return

  const createCurvedDash = (dashStart: number, dashEnd: number) => {
    const clampedStart = Math.max(0, dashStart)
    const clampedEnd = Math.min(totalLength, dashEnd)
    const dashDistance = clampedEnd - clampedStart
    if (dashDistance <= 0.05) return

    const sampleCount = Math.max(8, Math.ceil(dashDistance / 0.15))
    const leftPoints: THREE.Vector2[] = []
    const rightPoints: THREE.Vector2[] = []

    for (let i = 0; i <= sampleCount; i++) {
      const distance = clampedStart + (dashDistance * i) / sampleCount
      const u = distance / totalLength
      const point = centerCurve.getPointAt(u)
      const tangent = centerCurve.getTangentAt(u).setY(0).normalize()
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
      leftPoints.push(new THREE.Vector2(point.x + normal.x * halfStripeWidth, point.z + normal.z * halfStripeWidth))
      rightPoints.push(new THREE.Vector2(point.x - normal.x * halfStripeWidth, point.z - normal.z * halfStripeWidth))
    }

    const dashShape = new THREE.Shape()
    dashShape.moveTo(leftPoints[0].x, leftPoints[0].y)
    for (let i = 1; i < leftPoints.length; i++) dashShape.lineTo(leftPoints[i].x, leftPoints[i].y)
    for (let i = rightPoints.length - 1; i >= 0; i--) dashShape.lineTo(rightPoints[i].x, rightPoints[i].y)
    dashShape.lineTo(leftPoints[0].x, leftPoints[0].y)

    const dashMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(dashShape, { depth: stripeHeight, bevelEnabled: false, curveSegments: 16 }),
      stripeMaterial
    )
    dashMesh.rotation.x = -Math.PI / 2
    dashMesh.position.y = stripeY
    dashMesh.receiveShadow = true
    trackMesh.add(dashMesh)
  }

  for (let distance = startOffset + 2; distance < totalLength; distance += spacing) {
    createCurvedDash(distance, distance + stripeLength)
  }
}

export function addRoadShoulders(
  trackMesh: THREE.Group,
  outerBounds: TrackRectBounds,
  innerBounds: TrackRectBounds,
  cornerRadius: number
): void {
  const shoulderMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true
  })
  const lineWidth = 0.35
  const lineInset = 0.7
  const lineHeight = 0.03
  const lineY = 0.1 + lineHeight / 2 + 0.005

  const createShoulderStrip = (
    stripOuterBounds: TrackRectBounds,
    stripOuterRadius: number,
    stripInnerBounds: TrackRectBounds,
    stripInnerRadius: number
  ) => {
    const stripShape = new THREE.Shape()
    addRoundedRectPath(stripShape, stripOuterBounds, stripOuterRadius)
    const stripHole = new THREE.Path()
    addRoundedRectPath(stripHole, stripInnerBounds, stripInnerRadius)
    stripShape.holes.push(stripHole)

    const shoulderMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(stripShape, { depth: lineHeight, bevelEnabled: false, curveSegments: 32 }),
      shoulderMaterial
    )
    shoulderMesh.rotation.x = -Math.PI / 2
    shoulderMesh.position.y = lineY
    shoulderMesh.receiveShadow = true
    return shoulderMesh
  }

  const nearInset = lineInset - lineWidth / 2
  const farInset = lineInset + lineWidth / 2

  trackMesh.add(createShoulderStrip(
    {
      minX: outerBounds.minX + nearInset,
      maxX: outerBounds.maxX - nearInset,
      minZ: outerBounds.minZ + nearInset,
      maxZ: outerBounds.maxZ - nearInset
    },
    cornerRadius - nearInset,
    {
      minX: outerBounds.minX + farInset,
      maxX: outerBounds.maxX - farInset,
      minZ: outerBounds.minZ + farInset,
      maxZ: outerBounds.maxZ - farInset
    },
    cornerRadius - farInset
  ))

  trackMesh.add(createShoulderStrip(
    {
      minX: innerBounds.minX - farInset,
      maxX: innerBounds.maxX + farInset,
      minZ: innerBounds.minZ - farInset,
      maxZ: innerBounds.maxZ + farInset
    },
    cornerRadius + farInset,
    {
      minX: innerBounds.minX - nearInset,
      maxX: innerBounds.maxX + nearInset,
      minZ: innerBounds.minZ - nearInset,
      maxZ: innerBounds.maxZ + nearInset
    },
    cornerRadius + nearInset
  ))
}
