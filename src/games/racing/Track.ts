import * as THREE from 'three'
import PF from 'pathfinding'
import type { GroundCoverStyle, GroundTheme } from './levels/types'
import {
  addRoundedRectPath,
  buildRectangularTrackPath,
  createCornerBorderMesh,
  createRoundedTrackShape,
  DEFAULT_TRACK_LENGTH,
  DEFAULT_TRACK_WIDTH,
  type TrackRectBounds,
} from './trackGeometry'

export interface Checkpoint {
  id: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface CheckpointConfig {
  id: number
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
  }
  // Optional: rotation angle in radians (0 = aligned with X axis, positive = counterclockwise)
  // If not provided, checkpoint will be axis-aligned
  rotation?: number
}

export interface TrackGroundOptions {
  theme?: GroundTheme
  coverStyle?: GroundCoverStyle
}

export class Track {
  private path: THREE.Vector3[] = []
  private trackWidth: number = 6
  private cornerRadius: number = 3 // Radius for rounded corners
  private trackMesh: THREE.Group
  private finishLine!: THREE.Mesh // Initialized in createRectangularTrack
  private length: number = 30
  private width: number = 20
  private outerBounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  private innerBounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  private checkpoints: Checkpoint[] = []
  private checkpointMeshes: THREE.Object3D[] = []
  private showCheckpoints: boolean = false // Debug flag to show/hide checkpoints

  // Navigation grid for A* pathfinding
  private navGrid: PF.Grid | null = null
  private navGridCellSize: number = 1.0 // Size of each grid cell in world units
  private navGridOffsetX: number = 0 // World X coordinate of grid origin
  private navGridOffsetZ: number = 0 // World Z coordinate of grid origin

  private groundTheme: GroundTheme = 'grass'
  private groundCoverStyle: GroundCoverStyle = 'texture'

  constructor(scene: THREE.Scene, checkpointConfigs?: CheckpointConfig[], groundOptions?: TrackGroundOptions) {
    this.trackMesh = new THREE.Group()
    if (groundOptions?.theme) this.groundTheme = groundOptions.theme
    if (groundOptions?.coverStyle) this.groundCoverStyle = groundOptions.coverStyle
    this.createRectangularTrack()

    // Create checkpoints - use provided configs or default rectangular track checkpoints
    if (checkpointConfigs && checkpointConfigs.length > 0) {
      this.createCheckpointsFromConfig(checkpointConfigs)
    } else {
      this.createCheckpoints()
    }

    scene.add(this.trackMesh)

    // Calculate bounds for collision detection
    this.outerBounds = {
      minX: -this.length / 2 - this.trackWidth,
      maxX: this.length / 2 + this.trackWidth,
      minZ: -this.width / 2 - this.trackWidth,
      maxZ: this.width / 2 + this.trackWidth
    }

    this.innerBounds = {
      minX: -this.length / 2 + this.trackWidth,
      maxX: this.length / 2 - this.trackWidth,
      minZ: -this.width / 2 + this.trackWidth,
      maxZ: this.width / 2 - this.trackWidth
    }
  }

  private static GROUND_PALETTES: Record<GroundTheme, { base: number[][]; accent: number[][]; dirt: number[][] }> = {
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

  private getGroundPalette() {
    return Track.GROUND_PALETTES[this.groundTheme]
  }

  private createGrassTexture(): THREE.CanvasTexture {
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    const pal = this.getGroundPalette()
    const { base: baseColors, accent: accentColors, dirt: dirtColors } = pal

    if (this.groundTheme === 'dry') {
      ctx.fillStyle = 'rgb(146,126,54)'
      ctx.fillRect(0, 0, size, size)

      for (let i = 0; i < 85; i++) {
        const x = Math.floor(Math.random() * size)
        const y = Math.floor(Math.random() * size)
        const patchSize = Math.random() < 0.7 ? 2 : 3
        const colorSet = Math.random() < 0.18
          ? dirtColors
          : Math.random() < 0.55
            ? accentColors
            : baseColors
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
        let color: number[]
        if (r < 0.08) {
          color = dirtColors[Math.floor(Math.random() * dirtColors.length)]
        } else if (r < 0.25) {
          color = accentColors[Math.floor(Math.random() * accentColors.length)]
        } else {
          color = baseColors[Math.floor(Math.random() * baseColors.length)]
        }
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

  private createSolidGroundMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      flatShading: true
    })
  }

  private createInfieldShape(minX: number, maxX: number, minZ: number, maxZ: number, radius: number): THREE.Shape {
    const shape = new THREE.Shape()
    shape.moveTo(minX, minZ + radius)
    shape.absarc(minX + radius, minZ + radius, radius, Math.PI, Math.PI * 1.5, false)
    shape.lineTo(maxX - radius, minZ)
    shape.absarc(maxX - radius, minZ + radius, radius, Math.PI * 1.5, 0, false)
    shape.lineTo(maxX, maxZ - radius)
    shape.absarc(maxX - radius, maxZ - radius, radius, 0, Math.PI / 2, false)
    shape.lineTo(minX + radius, maxZ)
    shape.absarc(minX + radius, maxZ - radius, radius, Math.PI / 2, Math.PI, false)
    shape.lineTo(minX, minZ + radius)
    return shape
  }

  private addTexturedGround(
    innerMinX: number,
    innerMaxX: number,
    innerMinZ: number,
    innerMaxZ: number,
    radius: number
  ): void {
    const grassTexture = this.createGrassTexture()
    const infieldShape = this.createInfieldShape(innerMinX, innerMaxX, innerMinZ, innerMaxZ, radius)
    const infieldGeometry = new THREE.ShapeGeometry(infieldShape, 32)
    const tileWorldSize = 8.33
    const infieldTexture = grassTexture.clone()
    infieldTexture.needsUpdate = true
    infieldTexture.repeat.set(1 / tileWorldSize, 1 / tileWorldSize)
    const infieldMaterial = new THREE.MeshStandardMaterial({
      map: infieldTexture,
      flatShading: true
    })
    const infieldPlane = new THREE.Mesh(infieldGeometry, infieldMaterial)
    infieldPlane.rotation.x = -Math.PI / 2
    infieldPlane.position.y = 0.02
    infieldPlane.receiveShadow = true
    this.trackMesh.add(infieldPlane)

    const groundSize = 500
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize)
    const groundTexture = grassTexture.clone()
    groundTexture.needsUpdate = true
    groundTexture.repeat.set(groundSize / tileWorldSize, groundSize / tileWorldSize)
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: groundTexture,
      flatShading: true
    })
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial)
    groundPlane.rotation.x = -Math.PI / 2
    groundPlane.position.y = 0
    groundPlane.receiveShadow = true
    this.trackMesh.add(groundPlane)
  }

  private pointInsideRoundedRect(
    x: number,
    z: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    radius: number
  ): boolean {
    if (x < minX || x > maxX || z < minZ || z > maxZ) {
      return false
    }

    const effectiveRadius = Math.max(
      0,
      Math.min(radius, (maxX - minX) / 2, (maxZ - minZ) / 2)
    )
    if (effectiveRadius === 0) {
      return true
    }

    const clampedX = THREE.MathUtils.clamp(x, minX + effectiveRadius, maxX - effectiveRadius)
    const clampedZ = THREE.MathUtils.clamp(z, minZ + effectiveRadius, maxZ - effectiveRadius)
    const dx = x - clampedX
    const dz = z - clampedZ
    return dx * dx + dz * dz <= effectiveRadius * effectiveRadius
  }

  private hash2D(x: number, z: number, seed: number): number {
    const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123
    return value - Math.floor(value)
  }

  private positiveModulo(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus
  }

  private createGrassBladeGeometry(height: number, width: number): THREE.BufferGeometry {
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

  private addTuftGrass(
    outerMinX: number,
    outerMaxX: number,
    outerMinZ: number,
    outerMaxZ: number,
    innerMinX: number,
    innerMaxX: number,
    innerMinZ: number,
    innerMaxZ: number,
    radius: number
  ): void {
    const palette = this.getGroundPalette()
    const groundBase = new THREE.Color(`rgb(${palette.base[0].join(',')})`)
    const backgroundGround = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      this.createSolidGroundMaterial(groundBase)
    )
    backgroundGround.rotation.x = -Math.PI / 2
    backgroundGround.position.y = 0
    backgroundGround.receiveShadow = true
    this.trackMesh.add(backgroundGround)

    const bladeHeight = 0.58
    const bladeWidth = 0.2
    const bladeGeometry = this.createGrassBladeGeometry(bladeHeight, bladeWidth)
    const bladeMaterial = new THREE.MeshStandardMaterial({
      flatShading: true,
      vertexColors: true,
      side: THREE.FrontSide
    })

    const placements: Array<{ x: number; z: number; y: number; scale: number; rotation: number; color: THREE.Color }> = []
    const sideBand = 28
    const frontBand = 34
    const backBand = 8
    const outerPatchMinX = outerMinX - sideBand
    const outerPatchMaxX = outerMaxX + sideBand
    const outerPatchMinZ = outerMinZ - frontBand
    const outerPatchMaxZ = outerMaxZ + backBand
    const outerPatchRadius = radius + sideBand
    const infieldMargin = 1.05
    const outerClearMargin = 1.35
    const fadeBand = 8

    const scatterLayers = [
      { spacing: 0.72, offsetX: 0.13, offsetZ: 0.31, jitter: 0.62, minFill: 0.998, scaleMin: 0.72, scaleRange: 0.42, seed: 0, rotation: -0.34 },
      { spacing: 0.82, offsetX: 0.61, offsetZ: 0.18, jitter: 0.54, minFill: 0.992, scaleMin: 0.48, scaleRange: 0.22, seed: 20, rotation: 0.49 },
      { spacing: 0.58, offsetX: 0.27, offsetZ: 0.74, jitter: 0.46, minFill: 0.982, scaleMin: 0.26, scaleRange: 0.13, seed: 40, rotation: -0.92 },
      { spacing: 0.48, offsetX: 0.44, offsetZ: 0.57, jitter: 0.34, minFill: 0.94, scaleMin: 0.14, scaleRange: 0.08, seed: 60, rotation: 0.88 }
    ]

    for (const layer of scatterLayers) {
      for (let gx = Math.floor(outerPatchMinX / layer.spacing); gx <= Math.ceil(outerPatchMaxX / layer.spacing); gx++) {
        for (let gz = Math.floor(outerPatchMinZ / layer.spacing); gz <= Math.ceil(outerPatchMaxZ / layer.spacing); gz++) {
          const localX = (gx + layer.offsetX) * layer.spacing
          const localZ = (gz + layer.offsetZ) * layer.spacing
          const cos = Math.cos(layer.rotation)
          const sin = Math.sin(layer.rotation)
          const baseX = localX * cos - localZ * sin
          const baseZ = localX * sin + localZ * cos
          const jitterX = (this.hash2D(gx, gz, layer.seed + 1) - 0.5) * layer.spacing * layer.jitter
          const jitterZ = (this.hash2D(gx, gz, layer.seed + 2) - 0.5) * layer.spacing * layer.jitter
          const x = baseX + jitterX
          const z = baseZ + jitterZ

          const inOuterPatch = this.pointInsideRoundedRect(
            x,
            z,
            outerPatchMinX,
            outerPatchMaxX,
            outerPatchMinZ,
            outerPatchMaxZ,
            outerPatchRadius
          )
          if (!inOuterPatch) continue

          const inRoadOrBorder = this.pointInsideRoundedRect(
            x,
            z,
            outerMinX - outerClearMargin,
            outerMaxX + outerClearMargin,
            outerMinZ - outerClearMargin,
            outerMaxZ + outerClearMargin,
            radius + outerClearMargin
          ) && !this.pointInsideRoundedRect(
            x,
            z,
            innerMinX + infieldMargin,
            innerMaxX - infieldMargin,
            innerMinZ + infieldMargin,
            innerMaxZ - infieldMargin,
            Math.max(0, radius - infieldMargin)
          )
          if (inRoadOrBorder) continue

          const inInfield = this.pointInsideRoundedRect(
            x,
            z,
            innerMinX + infieldMargin,
            innerMaxX - infieldMargin,
            innerMinZ + infieldMargin,
            innerMaxZ - infieldMargin,
            Math.max(0, radius - infieldMargin)
          )
          const inTrackside = this.pointInsideRoundedRect(
            x,
            z,
            outerPatchMinX,
            outerPatchMaxX,
            outerPatchMinZ,
            outerPatchMaxZ,
            outerPatchRadius
          ) && !this.pointInsideRoundedRect(
            x,
            z,
            outerMinX - outerClearMargin,
            outerMaxX + outerClearMargin,
            outerMinZ - outerClearMargin,
            outerMaxZ + outerClearMargin,
            radius + outerClearMargin
          )
          if (!inInfield && !inTrackside) continue

          const edgeDistance = Math.min(
            x - outerPatchMinX,
            outerPatchMaxX - x,
            z - outerPatchMinZ,
            outerPatchMaxZ - z
          )
          const edgeChance = THREE.MathUtils.clamp(edgeDistance / fadeBand, 0, 1)
          const fillChance = THREE.MathUtils.lerp(layer.minFill, 1, edgeChance)
          if (this.hash2D(gx, gz, layer.seed + 3) > fillChance) continue

          const accentMix = this.hash2D(gx, gz, layer.seed + 4)
          const baseColor = new THREE.Color(
            `rgb(${palette.base[this.positiveModulo(gx + gz, palette.base.length)].join(',')})`
          )
          const accentColor = new THREE.Color(
            `rgb(${palette.accent[this.positiveModulo(gx * 3 + gz * 5, palette.accent.length)].join(',')})`
          )
          const color = baseColor.lerp(accentColor, accentMix * 0.35)

          placements.push({
            x,
            z,
            y: 0.03,
            scale: layer.scaleMin + this.hash2D(gx, gz, layer.seed + 5) * layer.scaleRange,
            rotation: this.hash2D(gx, gz, layer.seed + 6) * Math.PI,
            color
          })
        }
      }
    }

    const bladeAngles = [0, Math.PI / 3, (Math.PI * 2) / 3]
    const grassMesh = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, placements.length * bladeAngles.length)
    grassMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    grassMesh.castShadow = false
    grassMesh.receiveShadow = false

    const dummy = new THREE.Object3D()
    let instanceIndex = 0
    for (const placement of placements) {
      for (const angle of bladeAngles) {
        dummy.position.set(placement.x, placement.y, placement.z)
        dummy.rotation.set(
          (this.hash2D(instanceIndex, bladeAngles.length, 7) - 0.5) * 0.08,
          placement.rotation + angle,
          (this.hash2D(instanceIndex, bladeAngles.length, 8) - 0.5) * 0.08
        )
        dummy.scale.setScalar(placement.scale)
        dummy.updateMatrix()
        grassMesh.setMatrixAt(instanceIndex, dummy.matrix)
        grassMesh.setColorAt(instanceIndex, placement.color)
        instanceIndex += 1
      }
    }

    this.trackMesh.add(grassMesh)
  }

  private createRectangularTrack() {
    // Create a rectangular track
    this.length = DEFAULT_TRACK_LENGTH
    this.width = DEFAULT_TRACK_WIDTH
    const length = this.length
    const width = this.width

    // Define track path with rounded corners
    // Track: 30x20, corner radius: 3
    // Path goes: start -> top edge -> top-right corner -> right edge -> bottom-right corner -> bottom edge -> bottom-left corner -> left edge -> top-left corner -> back to start

    const radius = this.cornerRadius

    // Top edge: from (-12, 0, -10) to (12, 0, -10)
    // Top-right corner: arc from (12, 0, -10) to (15, 0, -7), center at (12, 0, -7)
    // Right edge: from (15, 0, -7) to (15, 0, 7)
    // Bottom-right corner: arc from (15, 0, 7) to (12, 0, 10), center at (12, 0, 7)
    // Bottom edge: from (12, 0, 10) to (-12, 0, 10)
    // Bottom-left corner: arc from (-12, 0, 10) to (-15, 0, 7), center at (-12, 0, 7)
    // Left edge: from (-15, 0, 7) to (-15, 0, -7)
    // Top-left corner: arc from (-15, 0, -7) to (-12, 0, -10), center at (-12, 0, -7)

    this.path = buildRectangularTrackPath(length, width, radius)

    // Create track surface with rounded corners
    const outerBounds: TrackRectBounds = {
      minX: -length / 2 - this.trackWidth,
      maxX: length / 2 + this.trackWidth,
      minZ: -width / 2 - this.trackWidth,
      maxZ: width / 2 + this.trackWidth
    }
    const innerBounds: TrackRectBounds = {
      minX: -length / 2 + this.trackWidth,
      maxX: length / 2 - this.trackWidth,
      minZ: -width / 2 + this.trackWidth,
      maxZ: width / 2 - this.trackWidth
    }
    const { minX: outerMinX, maxX: outerMaxX, minZ: outerMinZ, maxZ: outerMaxZ } = outerBounds
    const { minX: innerMinX, maxX: innerMaxX, minZ: innerMinZ, maxZ: innerMaxZ } = innerBounds
    const trackShape = createRoundedTrackShape(outerBounds, innerBounds, radius)

    // Create track geometry as 3D extruded shape with thickness
    const extrudeSettings = {
      depth: 0.1, // Track thickness (very thin, like a road surface)
      bevelEnabled: false, // No beveled edges
      curveSegments: 32 // Smooth curves for rounded corners
    }
    const trackGeometry = new THREE.ExtrudeGeometry(trackShape, extrudeSettings)
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666, // Lighter gray for better visibility
      flatShading: true // Polygon style
    })
    const trackSurface = new THREE.Mesh(trackGeometry, trackMaterial)
    // Rotate to lay flat on the ground (ExtrudeGeometry creates vertical extrusion, so rotate to horizontal)
    trackSurface.rotation.x = -Math.PI / 2
    trackSurface.position.y = 0.05 // Slightly above ground (half of thickness 0.1)
    trackSurface.receiveShadow = true
    trackSurface.castShadow = true
    this.trackMesh.add(trackSurface)

    if (this.groundCoverStyle === 'grassTufts') {
      this.addTuftGrass(
        outerMinX,
        outerMaxX,
        outerMinZ,
        outerMaxZ,
        innerMinX,
        innerMaxX,
        innerMinZ,
        innerMaxZ,
        radius
      )
    } else {
      this.addTexturedGround(
        innerMinX,
        innerMaxX,
        innerMinZ,
        innerMaxZ,
        radius
      )
    }

    // Add lane divider stripes (center line)
    this.addLaneDividers()
    // Add solid shoulder lines near both road edges
    this.addRoadShoulders(
      outerMinX,
      outerMaxX,
      outerMinZ,
      outerMaxZ,
      innerMinX,
      innerMaxX,
      innerMinZ,
      innerMaxZ,
      radius
    )

    // Create track borders with rounded corners
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true
    })

    const borderThickness = 0.1
    const borderHeight = 0.5

    // Outer borders with rounded corners
    // Top border (straight segment, shorter to leave room for corners)
    const topBorderLength = length + this.trackWidth * 2 - radius * 2
    const topBorder = new THREE.Mesh(
      new THREE.BoxGeometry(topBorderLength, borderHeight, borderThickness),
      borderMaterial
    )
    topBorder.position.set(0, borderHeight / 2, -width / 2 - this.trackWidth - borderThickness / 2)
    this.trackMesh.add(topBorder)

    // Bottom border (straight segment)
    const bottomBorderLength = length + this.trackWidth * 2 - radius * 2
    const bottomBorder = new THREE.Mesh(
      new THREE.BoxGeometry(bottomBorderLength, borderHeight, borderThickness),
      borderMaterial
    )
    bottomBorder.position.set(0, borderHeight / 2, width / 2 + this.trackWidth + borderThickness / 2)
    this.trackMesh.add(bottomBorder)

    // Left border (straight segment)
    const leftBorderLength = width + this.trackWidth * 2 - radius * 2
    const leftBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderHeight, leftBorderLength),
      borderMaterial
    )
    leftBorder.position.set(-length / 2 - this.trackWidth - borderThickness / 2, borderHeight / 2, 0)
    this.trackMesh.add(leftBorder)

    // Right border (straight segment)
    const rightBorderLength = width + this.trackWidth * 2 - radius * 2
    const rightBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderHeight, rightBorderLength),
      borderMaterial
    )
    rightBorder.position.set(length / 2 + this.trackWidth + borderThickness / 2, borderHeight / 2, 0)
    this.trackMesh.add(rightBorder)

    // Helper function to create a corner border piece
    // Creates a curved border strip that follows a quarter-circle arc
    // arcCenterX, arcCenterZ: where to position the corner piece (the arc center in world coordinates)
    // arcRadius: the radius of the track corner arc (where the border follows)
    // borderThickness: how thick the border should be
    // Outer corner pieces - positioned at track corner arc centers
    // The border follows the outer edge of the track, so arcRadius = radius + trackWidth
    // Top-right corner
    const topRightCorner = createCornerBorderMesh(
      borderMaterial,
      borderHeight,
      outerMaxX - radius,
      outerMinZ + radius,
      radius,
      borderThickness,
      0,
      Math.PI / 2
    )
    this.trackMesh.add(topRightCorner)

    // Bottom-right corner
    const bottomRightCorner = createCornerBorderMesh(
      borderMaterial,
      borderHeight,
      outerMaxX - radius,
      outerMaxZ - radius,
      radius,
      borderThickness,
      Math.PI * 1.5,
      0
    )
    this.trackMesh.add(bottomRightCorner)

    // Bottom-left corner
    const bottomLeftCorner = createCornerBorderMesh(
      borderMaterial,
      borderHeight,
      outerMinX + radius,
      outerMaxZ - radius,
      radius,
      borderThickness,
      Math.PI,
      Math.PI * 1.5
    )
    this.trackMesh.add(bottomLeftCorner)

    // Top-left corner
    const topLeftCorner = createCornerBorderMesh(
      borderMaterial,
      borderHeight,
      outerMinX + radius,
      outerMinZ + radius,
      radius,
      borderThickness,
      Math.PI / 2,
      Math.PI
    )
    this.trackMesh.add(topLeftCorner)

    // Inner borders with rounded corners
    // Top inner border (straight segment)
    const topInnerBorderLength = length - this.trackWidth * 2 - radius * 2
    const topInnerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(topInnerBorderLength, borderHeight, borderThickness),
      borderMaterial
    )
    topInnerBorder.position.set(0, borderHeight / 2, -width / 2 + this.trackWidth + borderThickness / 2)
    this.trackMesh.add(topInnerBorder)

    // Bottom inner border (straight segment)
    const bottomInnerBorderLength = length - this.trackWidth * 2 - radius * 2
    const bottomInnerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(bottomInnerBorderLength, borderHeight, borderThickness),
      borderMaterial
    )
    bottomInnerBorder.position.set(0, borderHeight / 2, width / 2 - this.trackWidth - borderThickness / 2)
    this.trackMesh.add(bottomInnerBorder)

    // Left inner border (straight segment)
    const leftInnerBorderLength = width - this.trackWidth * 2 - radius * 2
    const leftInnerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderHeight, leftInnerBorderLength),
      borderMaterial
    )
    leftInnerBorder.position.set(-length / 2 + this.trackWidth + borderThickness / 2, borderHeight / 2, 0)
    this.trackMesh.add(leftInnerBorder)

    // Right inner border (straight segment)
    const rightInnerBorderLength = width - this.trackWidth * 2 - radius * 2
    const rightInnerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderHeight, rightInnerBorderLength),
      borderMaterial
    )
    rightInnerBorder.position.set(length / 2 - this.trackWidth - borderThickness / 2, borderHeight / 2, 0)
    this.trackMesh.add(rightInnerBorder)

    // Inner corner pieces - positioned at track inner corner arc centers
    // The border follows the inner edge of the track, so arcRadius = radius - trackWidth
    // Top-right inner corner
    const topRightInnerCorner = createCornerBorderMesh(
      borderMaterial,
      borderHeight,
      innerMaxX - radius,
      innerMinZ + radius,
      radius - this.trackWidth,
      borderThickness,
      Math.PI,
      Math.PI * 1.5
    )
    this.trackMesh.add(topRightInnerCorner)

    // Bottom-right inner corner
    const bottomRightInnerCorner = createCornerBorderMesh(
      borderMaterial,
      borderHeight,
      innerMaxX - radius,
      innerMaxZ - radius,
      radius - this.trackWidth,
      borderThickness,
      Math.PI / 2,
      Math.PI
    )
    this.trackMesh.add(bottomRightInnerCorner)

    // Bottom-left inner corner
    const bottomLeftInnerCorner = createCornerBorderMesh(
      borderMaterial,
      borderHeight,
      innerMinX + radius,
      innerMaxZ - radius,
      radius - this.trackWidth,
      borderThickness,
      0,
      Math.PI / 2
    )
    this.trackMesh.add(bottomLeftInnerCorner)

    // Top-left inner corner
    const topLeftInnerCorner = createCornerBorderMesh(
      borderMaterial,
      borderHeight,
      innerMinX + radius,
      innerMinZ + radius,
      radius - this.trackWidth,
      borderThickness,
      Math.PI * 1.5,
      0
    )
    this.trackMesh.add(topLeftInnerCorner)

    // Create finish line - a flat stripe on the track surface (painted line)
    // Track surface top is at y: 0.1
    const finishLineWidth = this.trackWidth * 2 // 12 units across the track (Z)
    const finishLineLength = 0.4 // Length along track direction (X) - visible stripe
    const finishLineHeight = 0.1 // Very thin so it sits on the track like paint
    const finishLineGeometry = new THREE.BoxGeometry(finishLineLength, finishLineHeight, finishLineWidth)
    const finishLineMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      flatShading: true
    })
    this.finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial)
    // Position at center of top lane (x: 0), flush on track surface (y: 0.1 + half thickness), top of track (z: -width/2)
    this.finishLine.position.set(0, 0.1 + finishLineHeight / 2, -width / 2)
    this.trackMesh.add(this.finishLine)
  }

  private createCheckpoints() {
    // Default checkpoints for rectangular track
    const length = this.length
    const width = this.width
    const trackWidth = this.trackWidth
    const cornerSize = 15
    const finishLineLength = 6

    const configs: CheckpointConfig[] = [
      // Checkpoint 0: Finish line checkpoint
      // The track path starts at (-length/2, 0, -width/2) = (-15, 0, -10)
      // Left side (minX) should be exactly at the start line position (x = -15)
      // Should span the width of the track (perpendicular to travel) and extend along track direction
      // Track direction at finish line is +X (cars move from left to right)
      {
        id: 0,
        bounds: {
          minX: 0,
          maxX: finishLineLength, // Extend forward 8 units
          minZ: -width / 2 - trackWidth, // Bottom edge: -10 - 6 = -16
          maxZ: -width / 2 + trackWidth  // Top edge: -10 + 6 = -4
        }
      },
      // Checkpoint 1: Top right corner (bigger)
      {
        id: 1,
        bounds: {
          minX: length / 2 - cornerSize / 2,
          maxX: length / 2 + cornerSize / 2,
          minZ: -width / 2 - cornerSize / 2,
          maxZ: -width / 2 + cornerSize / 2
        }
      },
      // Checkpoint 2: Bottom right corner (bigger)
      {
        id: 2,
        bounds: {
          minX: length / 2 - cornerSize / 2,
          maxX: length / 2 + cornerSize / 2,
          minZ: width / 2 - cornerSize / 2,
          maxZ: width / 2 + cornerSize / 2
        }
      },
      // Checkpoint 3: Bottom left corner (bigger)
      {
        id: 3,
        bounds: {
          minX: -length / 2 - cornerSize / 2,
          maxX: -length / 2 + cornerSize / 2,
          minZ: width / 2 - cornerSize / 2,
          maxZ: width / 2 + cornerSize / 2
        }
      },
      // Checkpoint 4: Top left corner (bigger)
      {
        id: 4,
        bounds: {
          minX: -length / 2 - cornerSize / 2,
          maxX: -length / 2 + cornerSize / 2,
          minZ: -width / 2 - cornerSize / 2,
          maxZ: -width / 2 + cornerSize / 2
        }
      }
    ]

    this.createCheckpointsFromConfig(configs)
  }

  private createCheckpointsFromConfig(configs: CheckpointConfig[]) {
    // Clear existing checkpoints
    this.checkpoints = []
    this.checkpointMeshes.forEach(obj => {
      this.trackMesh.remove(obj)
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) {
          obj.geometry.dispose()
        }
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat: THREE.Material) => mat.dispose())
        } else if (obj.material) {
          obj.material.dispose()
        }
      }
    })
    this.checkpointMeshes = []

    // Create checkpoints from config
    configs.forEach(config => {
      this.checkpoints.push({
        id: config.id,
        minX: config.bounds.minX,
        maxX: config.bounds.maxX,
        minZ: config.bounds.minZ,
        maxZ: config.bounds.maxZ
      })


      // Create visual representation for debugging
      if (this.showCheckpoints) {
        this.createCheckpointVisual(config)
      }
    })
  }

  private createCheckpointVisual(config: CheckpointConfig) {
    const width = config.bounds.maxX - config.bounds.minX
    const depth = config.bounds.maxZ - config.bounds.minZ
    const centerX = (config.bounds.minX + config.bounds.maxX) / 2
    const centerZ = (config.bounds.minZ + config.bounds.maxZ) / 2
    const rotation = config.rotation || 0


    // Use PlaneGeometry which is naturally flat
    // PlaneGeometry creates a plane in XY plane by default
    // We need it in XZ plane (flat on track), so rotate -90 degrees around X axis
    const geometry = new THREE.PlaneGeometry(width, depth)
    const material = new THREE.MeshStandardMaterial({
      color: config.id === 0 ? 0x00ff00 : 0xff0000, // Green for finish line, red for corners
      transparent: true,
      opacity: 0.3,
      wireframe: false,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    // Position slightly above track surface (track is at y=0)
    mesh.position.set(centerX, 0.19, centerZ)
    // Rotate -90 degrees around X axis to lay flat on XZ plane (track surface)
    // PlaneGeometry is in XY plane by default, so rotate X to put it in XZ plane
    mesh.rotation.x = -Math.PI / 2
    // Apply custom rotation around Y axis (vertical) if provided
    if (rotation !== 0) {
      mesh.rotation.y = rotation
    }

    // Add wireframe outline for better visibility
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: config.id === 0 ? 0x00ff00 : 0xff0000,
      linewidth: 2
    })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    wireframe.position.set(centerX, 0.06, centerZ)
    wireframe.rotation.x = -Math.PI / 2
    if (rotation !== 0) {
      wireframe.rotation.y = rotation
    }

    this.trackMesh.add(mesh)
    this.trackMesh.add(wireframe)
    this.checkpointMeshes.push(mesh, wireframe)
  }

  public setShowCheckpoints(show: boolean) {
    this.showCheckpoints = show
    this.checkpointMeshes.forEach(mesh => {
      mesh.visible = show
    })
  }

  public isInCheckpoint(position: THREE.Vector3, checkpointId: number): boolean {
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId)
    if (!checkpoint) return false

    // For now, use axis-aligned bounding box check
    // If rotation is needed in the future, we'd need to transform the position
    // by the inverse rotation before checking bounds
    return (
      position.x >= checkpoint.minX &&
      position.x <= checkpoint.maxX &&
      position.z >= checkpoint.minZ &&
      position.z <= checkpoint.maxZ
    )
  }

  public getCheckpointCount(): number {
    return this.checkpoints.length
  }

  public getNextCheckpointCenter(checkpointId: number): THREE.Vector3 {
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId)
    if (!checkpoint) {
      // Fallback to first checkpoint
      const first = this.checkpoints[0]
      if (!first) return new THREE.Vector3(0, 0, 0)
      return new THREE.Vector3(
        (first.minX + first.maxX) / 2,
        0,
        (first.minZ + first.maxZ) / 2
      )
    }
    return new THREE.Vector3(
      (checkpoint.minX + checkpoint.maxX) / 2,
      0,
      (checkpoint.minZ + checkpoint.maxZ) / 2
    )
  }

  public getNearestForwardCheckpoint(position: THREE.Vector3, forwardDirection: THREE.Vector3, lastCheckpoint: number): THREE.Vector3 | null {
    // Find the checkpoint that is forward-facing from the car's position
    let bestCheckpoint: THREE.Vector3 | null = null
    let bestDot = -1

    // Try the next checkpoint first
    const checkpointCount = this.checkpoints.length
    const nextCheckpointId = (lastCheckpoint + 1) % checkpointCount
    const nextCheckpoint = this.getNextCheckpointCenter(nextCheckpointId)
    const nextDir = new THREE.Vector3()
    nextDir.subVectors(nextCheckpoint, position)
    nextDir.y = 0
    const nextDist = nextDir.length()
    if (nextDist > 0.1) {
      nextDir.normalize()
      const nextDot = forwardDirection.dot(nextDir)
      if (nextDot > bestDot) {
        bestDot = nextDot
        bestCheckpoint = nextCheckpoint
      }
    }

    // Also try the checkpoint after that
    const afterNextId = (lastCheckpoint + 2) % checkpointCount
    const afterNextCheckpoint = this.getNextCheckpointCenter(afterNextId)
    const afterNextDir = new THREE.Vector3()
    afterNextDir.subVectors(afterNextCheckpoint, position)
    afterNextDir.y = 0
    const afterNextDist = afterNextDir.length()
    if (afterNextDist > 0.1) {
      afterNextDir.normalize()
      const afterNextDot = forwardDirection.dot(afterNextDir)
      if (afterNextDot > bestDot) {
        bestDot = afterNextDot
        bestCheckpoint = afterNextCheckpoint
      }
    }

    // Return the best forward checkpoint if it's reasonably forward (dot > 0.1)
    if (bestDot > 0.1) {
      return bestCheckpoint
    }

    return null
  }

  /**
   * Returns a random point on the track center path (for placing mines etc.).
   * Avoids the start/finish area.
   * Samples uniformly by arc length so positions are evenly distributed.
   */
  public getRandomPointOnTrack(): THREE.Vector3 {
    // Build cumulative arc-length table
    const cumLen: number[] = [0]
    for (let i = 1; i < this.path.length; i++) {
      const dx = this.path[i].x - this.path[i - 1].x
      const dz = this.path[i].z - this.path[i - 1].z
      cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dz * dz))
    }
    const totalLen = cumLen[cumLen.length - 1]

    // Skip the first/last 15% of arc length to avoid start/finish area
    const skipFraction = 0.15
    const minLen = totalLen * skipFraction
    const maxLen = totalLen * (1 - skipFraction)
    const targetLen = minLen + Math.random() * (maxLen - minLen)

    // Find the segment containing targetLen and interpolate
    for (let i = 1; i < cumLen.length; i++) {
      if (cumLen[i] >= targetLen) {
        const segLen = cumLen[i] - cumLen[i - 1]
        const t = segLen > 0 ? (targetLen - cumLen[i - 1]) / segLen : 0
        const p0 = this.path[i - 1]
        const p1 = this.path[i]
        return new THREE.Vector3(
          p0.x + (p1.x - p0.x) * t,
          0,
          p0.z + (p1.z - p0.z) * t
        )
      }
    }

    // Fallback
    const p = this.path[Math.floor(this.path.length / 2)]
    return new THREE.Vector3(p.x, p.y, p.z)
  }

  private addLaneDividers() {
    // Create dashed center divider strips that follow the curved center path.
    const stripeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00, // Yellow stripes
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
    for (let i = 0; i < this.path.length - 1; i++) {
      centerCurve.add(new THREE.LineCurve3(this.path[i], this.path[i + 1]))
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

        const left = point.clone().addScaledVector(normal, halfStripeWidth)
        const right = point.clone().addScaledVector(normal, -halfStripeWidth)
        leftPoints.push(new THREE.Vector2(left.x, left.z))
        rightPoints.push(new THREE.Vector2(right.x, right.z))
      }

      const dashShape = new THREE.Shape()
      dashShape.moveTo(leftPoints[0].x, leftPoints[0].y)
      for (let i = 1; i < leftPoints.length; i++) {
        dashShape.lineTo(leftPoints[i].x, leftPoints[i].y)
      }
      for (let i = rightPoints.length - 1; i >= 0; i--) {
        dashShape.lineTo(rightPoints[i].x, rightPoints[i].y)
      }
      dashShape.lineTo(leftPoints[0].x, leftPoints[0].y)

      const dashGeometry = new THREE.ExtrudeGeometry(dashShape, {
        depth: stripeHeight,
        bevelEnabled: false,
        curveSegments: 16
      })

      const dashMesh = new THREE.Mesh(dashGeometry, stripeMaterial)
      dashMesh.rotation.x = -Math.PI / 2
      dashMesh.position.y = stripeY
      dashMesh.receiveShadow = true
      this.trackMesh.add(dashMesh)
    }

    for (let distance = startOffset + 2; distance < totalLength; distance += spacing) {
      createCurvedDash(distance, distance + stripeLength)
    }
  }

  private addRoadShoulders(
    outerMinX: number,
    outerMaxX: number,
    outerMinZ: number,
    outerMaxZ: number,
    innerMinX: number,
    innerMaxX: number,
    innerMinZ: number,
    innerMaxZ: number,
    cornerRadius: number
  ) {
    const shoulderMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true
    })

    const lineWidth = 0.35
    const lineInset = 0.7
    const lineHeight = 0.03
    const lineY = 0.1 + lineHeight / 2 + 0.005

    const createShoulderStrip = (
      stripOuterMinX: number,
      stripOuterMaxX: number,
      stripOuterMinZ: number,
      stripOuterMaxZ: number,
      stripOuterRadius: number,
      stripInnerMinX: number,
      stripInnerMaxX: number,
      stripInnerMinZ: number,
      stripInnerMaxZ: number,
      stripInnerRadius: number
    ) => {
      const stripShape = new THREE.Shape()
      addRoundedRectPath(stripShape, {
        minX: stripOuterMinX,
        maxX: stripOuterMaxX,
        minZ: stripOuterMinZ,
        maxZ: stripOuterMaxZ
      }, stripOuterRadius)

      const stripHole = new THREE.Path()
      addRoundedRectPath(stripHole, {
        minX: stripInnerMinX,
        maxX: stripInnerMaxX,
        minZ: stripInnerMinZ,
        maxZ: stripInnerMaxZ
      }, stripInnerRadius)

      stripShape.holes.push(stripHole)

      const shoulderGeometry = new THREE.ExtrudeGeometry(stripShape, {
        depth: lineHeight,
        bevelEnabled: false,
        curveSegments: 32
      })

      const shoulderMesh = new THREE.Mesh(shoulderGeometry, shoulderMaterial)
      shoulderMesh.rotation.x = -Math.PI / 2
      shoulderMesh.position.y = lineY
      shoulderMesh.receiveShadow = true
      return shoulderMesh
    }

    const nearInset = lineInset - lineWidth / 2
    const farInset = lineInset + lineWidth / 2

    // Outer shoulder line: inset from the outside edge toward the center of the road
    const outerShoulder = createShoulderStrip(
      outerMinX + nearInset,
      outerMaxX - nearInset,
      outerMinZ + nearInset,
      outerMaxZ - nearInset,
      cornerRadius - nearInset,
      outerMinX + farInset,
      outerMaxX - farInset,
      outerMinZ + farInset,
      outerMaxZ - farInset,
      cornerRadius - farInset
    )
    this.trackMesh.add(outerShoulder)

    // Inner shoulder line: offset outward from the infield edge into the road
    const innerShoulder = createShoulderStrip(
      innerMinX - farInset,
      innerMaxX + farInset,
      innerMinZ - farInset,
      innerMaxZ + farInset,
      cornerRadius + farInset,
      innerMinX - nearInset,
      innerMaxX + nearInset,
      innerMinZ - nearInset,
      innerMaxZ + nearInset,
      cornerRadius + nearInset
    )
    this.trackMesh.add(innerShoulder)
  }

  public getProgress(position: THREE.Vector3, previousProgress: number = 0): number {
    // Find closest point on track, but only consider segments forward from previous progress
    // This ensures progress only increases (or wraps around at finish line)
    const totalSegments = this.path.length - 1

    // Calculate which segment the previous progress corresponds to
    const previousSegmentIndex = Math.floor((previousProgress % 1.0) * totalSegments)
    const previousSegmentProgress = ((previousProgress % 1.0) * totalSegments) - previousSegmentIndex

    // Helper to normalize progress difference (handles wrap-around)
    const getProgressDiff = (newProgress: number, oldProgress: number): number => {
      let diff = newProgress - oldProgress
      // Handle wrap-around: if going from 0.95 to 0.05, that's +0.1 (forward)
      if (diff < -0.5) diff += 1.0
      // Handle reverse wrap-around: if going from 0.05 to 0.95, that's -0.1 (backward)
      if (diff > 0.5) diff -= 1.0
      return diff
    }

    let bestProgress = previousProgress
    let minDistance = Infinity
    const maxSearchDistance = 10.0 // Maximum distance to consider (prevents huge jumps)
    const segmentTransitionThreshold = 0.95 // Only move to next segment if we're 95% through current
    const minDistanceToEnd = 2.0 // Must be within 2 units of end point to consider next segment

    // First, check the current segment
    const currentSegmentIndex = previousSegmentIndex
    const currentStart = this.path[currentSegmentIndex]
    const currentEnd = this.path[(currentSegmentIndex + 1) % totalSegments]
    const currentSegment = currentEnd.clone().sub(currentStart)
    const toCurrentPoint = position.clone().sub(currentStart)
    const currentSegmentLength = currentSegment.length()

    if (currentSegmentLength > 0) {
      let t = toCurrentPoint.dot(currentSegment) / (currentSegmentLength * currentSegmentLength)
      t = Math.max(previousSegmentProgress, Math.min(1, t))

      const closestPoint = currentStart.clone().add(currentSegment.multiplyScalar(t))
      const distance = position.distanceTo(closestPoint)

      if (distance < maxSearchDistance) {
        const segmentProgress = (currentSegmentIndex + t) / totalSegments
        const progressDiff = getProgressDiff(segmentProgress, previousProgress)

        if (progressDiff >= -0.05) {
          minDistance = distance
          bestProgress = segmentProgress
        }
      }

      // Only check next segment if we're very near the end of current segment
      // Must be both: 95% through the segment AND within 2 units of the end point
      const distanceToEnd = position.distanceTo(currentEnd)
      const isNearEnd = t >= segmentTransitionThreshold && distanceToEnd < minDistanceToEnd

      if (isNearEnd) {
        // Check next segment
        const nextSegmentIndex = (currentSegmentIndex + 1) % totalSegments
        const nextStart = this.path[nextSegmentIndex]
        const nextEnd = this.path[(nextSegmentIndex + 1) % totalSegments]
        const nextSegment = nextEnd.clone().sub(nextStart)
        const toNextPoint = position.clone().sub(nextStart)
        const nextSegmentLength = nextSegment.length()

        if (nextSegmentLength > 0) {
          let tNext = toNextPoint.dot(nextSegment) / (nextSegmentLength * nextSegmentLength)
          tNext = Math.max(0, Math.min(1, tNext))

          const closestPointNext = nextStart.clone().add(nextSegment.multiplyScalar(tNext))
          const distanceNext = position.distanceTo(closestPointNext)

          if (distanceNext < maxSearchDistance) {
            const segmentProgressNext = (nextSegmentIndex + tNext) / totalSegments
            const progressDiffNext = getProgressDiff(segmentProgressNext, previousProgress)

            // Only use next segment if it's significantly closer (at least 20% better)
            // This prevents switching at corners when distances are similar
            if (progressDiffNext >= -0.05 && distanceNext < minDistance * 0.8) {
              minDistance = distanceNext
              bestProgress = segmentProgressNext
            }
          }
        }
      }
    }

    // If we didn't find a good forward candidate, also check if we're near the finish line
    // (this handles the wrap-around case)
    if (previousProgress > 0.9) {
      // Check the first segment (finish line area) in case we wrapped around
      const segmentIndex = 0
      const start = this.path[segmentIndex]
      const end = this.path[(segmentIndex + 1) % totalSegments]

      const segment = end.clone().sub(start)
      const toPoint = position.clone().sub(start)
      const segmentLength = segment.length()

      if (segmentLength > 0) {
        let t = toPoint.dot(segment) / (segmentLength * segmentLength)
        t = Math.max(0, Math.min(1, t))

        const closestPoint = start.clone().add(segment.multiplyScalar(t))
        const distance = position.distanceTo(closestPoint)

        if (distance < maxSearchDistance) {
          const segmentProgress = (segmentIndex + t) / totalSegments
          const progressDiff = getProgressDiff(segmentProgress, previousProgress)

          // If we wrapped around (large negative diff), accept it
          if (progressDiff < -0.5) {
            minDistance = distance
            bestProgress = segmentProgress
          }
        }
      }
    }

    // Final validation: ensure progress only moves forward (or wraps around)
    const finalDiff = getProgressDiff(bestProgress, previousProgress)

    // If progress went backward significantly (not wrap-around), clamp to previous + small increment
    if (finalDiff < -0.05 && finalDiff > -0.5) {
      // Small backward movement - use previous progress with tiny increment
      bestProgress = (previousProgress + 0.001) % 1.0
    }
    // If progress wrapped backward (0.05 -> 0.95), that's invalid - use previous
    else if (finalDiff > 0.5) {
      bestProgress = previousProgress
    }

    return bestProgress
  }

  public checkFinishLine(position: THREE.Vector3): boolean {
    // Check if car crossed finish line (at start position)
    const finishLinePos = new THREE.Vector3(-15, 0, -10) // Start position
    const distance = Math.abs(position.z - finishLinePos.z)
    return distance < 1 && position.x < finishLinePos.x + 2 && position.x > finishLinePos.x - 2
  }

  public getFinishLinePosition(): THREE.Vector3 {
    // Return the finish line position (center of top lane)
    return new THREE.Vector3(0, 0, -this.width / 2)
  }

  public isOutsideOuterBorder(position: THREE.Vector3, margin: number = 0): boolean {
    // Check if position is outside the outer track border.
    // When margin > 0 (e.g. car half-extent), bounds are inset so the car body stays on track.
    return (
      position.x < this.outerBounds.minX + margin ||
      position.x > this.outerBounds.maxX - margin ||
      position.z < this.outerBounds.minZ + margin ||
      position.z > this.outerBounds.maxZ - margin
    )
  }

  public isInsideInnerArea(position: THREE.Vector3, margin: number = 0): boolean {
    // Check if position is inside the inner area (grass/off-track).
    // When margin > 0, inner bounds are expanded so we treat "near grass" as off-track.
    return (
      position.x > this.innerBounds.minX - margin &&
      position.x < this.innerBounds.maxX + margin &&
      position.z > this.innerBounds.minZ - margin &&
      position.z < this.innerBounds.maxZ + margin
    )
  }

  /**
   * Clamps position to stay inside the outer track bounds (with margin) and returns
   * the outward normals of any wall(s) hit. Used for wall-slide physics.
   */
  public clampPositionToOuterBounds(
    position: THREE.Vector3,
    margin: number
  ): { clamped: THREE.Vector3; normals: THREE.Vector3[] } {
    const minX = this.outerBounds.minX + margin
    const maxX = this.outerBounds.maxX - margin
    const minZ = this.outerBounds.minZ + margin
    const maxZ = this.outerBounds.maxZ - margin
    const clamped = position.clone()
    const normals: THREE.Vector3[] = []
    if (clamped.x < minX) {
      clamped.x = minX
      normals.push(new THREE.Vector3(1, 0, 0))
    }
    if (clamped.x > maxX) {
      clamped.x = maxX
      normals.push(new THREE.Vector3(-1, 0, 0))
    }
    if (clamped.z < minZ) {
      clamped.z = minZ
      normals.push(new THREE.Vector3(0, 0, 1))
    }
    if (clamped.z > maxZ) {
      clamped.z = maxZ
      normals.push(new THREE.Vector3(0, 0, -1))
    }
    return { clamped, normals }
  }

  /**
   * Clamps position to stay outside the inner track bounds (inner rail / infield).
   * If position is inside the inner area (with margin), clamps to the nearest
   * point on the inner boundary (single nearest edge only) so the car doesn't
   * teleport to a corner. Returns normals pointing outward from the inner area.
   */
  public clampPositionToInnerBounds(
    position: THREE.Vector3,
    margin: number
  ): { clamped: THREE.Vector3; normals: THREE.Vector3[] } {
    const minX = this.innerBounds.minX - margin
    const maxX = this.innerBounds.maxX + margin
    const minZ = this.innerBounds.minZ - margin
    const maxZ = this.innerBounds.maxZ + margin
    const clamped = position.clone()
    const normals: THREE.Vector3[] = []

    const insideX = clamped.x > minX && clamped.x < maxX
    const insideZ = clamped.z > minZ && clamped.z < maxZ
    if (!insideX || !insideZ) return { clamped, normals }

    // Only push to the single nearest edge to avoid teleporting to a corner
    const distToMinX = clamped.x - minX
    const distToMaxX = maxX - clamped.x
    const distToMinZ = clamped.z - minZ
    const distToMaxZ = maxZ - clamped.z

    const dMinX = insideX ? distToMinX : Infinity
    const dMaxX = insideX ? distToMaxX : Infinity
    const dMinZ = insideZ ? distToMinZ : Infinity
    const dMaxZ = insideZ ? distToMaxZ : Infinity

    const minDist = Math.min(dMinX, dMaxX, dMinZ, dMaxZ)
    if (minDist === dMinX) {
      clamped.x = minX
      normals.push(new THREE.Vector3(-1, 0, 0))
    } else if (minDist === dMaxX) {
      clamped.x = maxX
      normals.push(new THREE.Vector3(1, 0, 0))
    } else if (minDist === dMinZ) {
      clamped.z = minZ
      normals.push(new THREE.Vector3(0, 0, -1))
    } else {
      clamped.z = maxZ
      normals.push(new THREE.Vector3(0, 0, 1))
    }
    return { clamped, normals }
  }

  // ==================== A* Navigation Grid Methods ====================

  /**
   * Creates a navigation grid for A* pathfinding.
   * Call this once after track is created.
   */
  public createNavigationGrid(cellSize: number = 1.0): void {
    this.navGridCellSize = cellSize

    // Calculate grid dimensions based on outer bounds with some padding
    const padding = 2
    const minX = this.outerBounds.minX - padding
    const maxX = this.outerBounds.maxX + padding
    const minZ = this.outerBounds.minZ - padding
    const maxZ = this.outerBounds.maxZ + padding

    this.navGridOffsetX = minX
    this.navGridOffsetZ = minZ

    const gridWidth = Math.ceil((maxX - minX) / cellSize)
    const gridHeight = Math.ceil((maxZ - minZ) / cellSize)

    // Create the grid - all cells start as walkable (0)
    this.navGrid = new PF.Grid(gridWidth, gridHeight)

    // Mark cells as blocked (1) if they are off-track
    for (let gx = 0; gx < gridWidth; gx++) {
      for (let gz = 0; gz < gridHeight; gz++) {
        const worldX = this.navGridOffsetX + gx * cellSize + cellSize / 2
        const worldZ = this.navGridOffsetZ + gz * cellSize + cellSize / 2
        const pos = new THREE.Vector3(worldX, 0, worldZ)

        // Cell is blocked if it's outside outer bounds OR inside inner area (grass)
        const isBlocked = this.isOutsideOuterBorder(pos) || this.isInsideInnerArea(pos)

        if (isBlocked) {
          this.navGrid.setWalkableAt(gx, gz, false)
        }
      }
    }

  }

  /**
   * Converts world coordinates to grid coordinates.
   */
  public worldToGrid(worldX: number, worldZ: number): { gx: number; gz: number } {
    const gx = Math.floor((worldX - this.navGridOffsetX) / this.navGridCellSize)
    const gz = Math.floor((worldZ - this.navGridOffsetZ) / this.navGridCellSize)
    return { gx, gz }
  }

  /**
   * Converts grid coordinates to world coordinates (center of cell).
   */
  public gridToWorld(gx: number, gz: number): { worldX: number; worldZ: number } {
    const worldX = this.navGridOffsetX + gx * this.navGridCellSize + this.navGridCellSize / 2
    const worldZ = this.navGridOffsetZ + gz * this.navGridCellSize + this.navGridCellSize / 2
    return { worldX, worldZ }
  }

  /**
   * Finds a path from start to goal using A* pathfinding.
   * Returns an array of world positions, or empty array if no path found.
   */
  public findPath(
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number
  ): THREE.Vector3[] {
    if (!this.navGrid) {
      console.warn('Navigation grid not created. Call createNavigationGrid() first.')
      return []
    }

    // Convert world coords to grid coords
    const start = this.worldToGrid(startX, startZ)
    const goal = this.worldToGrid(goalX, goalZ)

    // Clamp to grid bounds
    const gridWidth = this.navGrid.width
    const gridHeight = this.navGrid.height
    start.gx = Math.max(0, Math.min(gridWidth - 1, start.gx))
    start.gz = Math.max(0, Math.min(gridHeight - 1, start.gz))
    goal.gx = Math.max(0, Math.min(gridWidth - 1, goal.gx))
    goal.gz = Math.max(0, Math.min(gridHeight - 1, goal.gz))

    // If start or goal is blocked, find nearest walkable cell
    const adjustedStart = this.findNearestWalkable(start.gx, start.gz)
    const adjustedGoal = this.findNearestWalkable(goal.gx, goal.gz)

    if (!adjustedStart || !adjustedGoal) {
      return []
    }

    // Clone the grid (pathfinding modifies it)
    const gridClone = this.navGrid.clone()

    // Use A* with diagonal movement allowed
    const finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: true
    })

    const gridPath = finder.findPath(
      adjustedStart.gx,
      adjustedStart.gz,
      adjustedGoal.gx,
      adjustedGoal.gz,
      gridClone
    )

    // Convert grid path to world positions
    const worldPath: THREE.Vector3[] = []
    for (const [gx, gz] of gridPath) {
      const { worldX, worldZ } = this.gridToWorld(gx, gz)
      worldPath.push(new THREE.Vector3(worldX, 0, worldZ))
    }

    return worldPath
  }

  /**
   * Finds the nearest walkable cell to the given grid position.
   */
  private findNearestWalkable(gx: number, gz: number): { gx: number; gz: number } | null {
    if (!this.navGrid) return null

    const gridWidth = this.navGrid.width
    const gridHeight = this.navGrid.height

    // If already walkable, return it
    if (gx >= 0 && gx < gridWidth && gz >= 0 && gz < gridHeight) {
      if (this.navGrid.isWalkableAt(gx, gz)) {
        return { gx, gz }
      }
    }

    // Search in expanding squares around the position
    for (let radius = 1; radius < 10; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          // Only check the perimeter of this radius
          if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue

          const nx = gx + dx
          const nz = gz + dz

          if (nx >= 0 && nx < gridWidth && nz >= 0 && nz < gridHeight) {
            if (this.navGrid.isWalkableAt(nx, nz)) {
              return { gx: nx, gz: nz }
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Gets the navigation grid (for debugging/visualization).
   */
  public getNavigationGrid(): PF.Grid | null {
    return this.navGrid
  }

  /**
   * Gets the grid cell size.
   */
  public getNavGridCellSize(): number {
    return this.navGridCellSize
  }

  /**
   * Gets the grid offset (world position of grid origin).
   */
  public getNavGridOffset(): { x: number; z: number } {
    return { x: this.navGridOffsetX, z: this.navGridOffsetZ }
  }

  public dispose() {
    this.trackMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
}
