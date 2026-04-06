import * as THREE from 'three'
import PF from 'pathfinding'
import type { GroundCoverStyle, GroundTheme } from './levels/types'
import {
  buildRectangularTrackPath,
  createCornerBorderMesh,
  createRoundedTrackShape,
  DEFAULT_TRACK_LENGTH,
  DEFAULT_TRACK_WIDTH,
  type TrackRectBounds,
} from './trackGeometry'
import {
  checkFinishLineCrossing,
  createDefaultCheckpoints,
  getCheckpointCenterById,
  getNearestForwardCheckpoint as getNearestForwardCheckpointOnTrack,
  getPathProgress,
  getRandomPointOnPath,
  isPointInCheckpoint,
} from './trackTopology'
import {
  addLaneDividers as addRenderedLaneDividers,
  addRoadShoulders as addRenderedRoadShoulders,
  addTrackGround,
} from './trackRendering'

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

    addTrackGround(this.trackMesh, this.groundTheme, this.groundCoverStyle, outerBounds, innerBounds, radius)

    // Add lane divider stripes (center line)
    addRenderedLaneDividers(this.trackMesh, this.path)
    // Add solid shoulder lines near both road edges
    addRenderedRoadShoulders(this.trackMesh, outerBounds, innerBounds, radius)

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
    this.createCheckpointsFromConfig(
      createDefaultCheckpoints(this.length, this.width, this.trackWidth)
    )
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
    return isPointInCheckpoint(position, this.checkpoints.find(cp => cp.id === checkpointId))
  }

  public getCheckpointCount(): number {
    return this.checkpoints.length
  }

  public getNextCheckpointCenter(checkpointId: number): THREE.Vector3 {
    return getCheckpointCenterById(this.checkpoints, checkpointId)
  }

  public getNearestForwardCheckpoint(position: THREE.Vector3, forwardDirection: THREE.Vector3, lastCheckpoint: number): THREE.Vector3 | null {
    return getNearestForwardCheckpointOnTrack(this.checkpoints, position, forwardDirection, lastCheckpoint)
  }

  /**
   * Returns a random point on the track center path (for placing mines etc.).
   * Avoids the start/finish area.
   * Samples uniformly by arc length so positions are evenly distributed.
   */
  public getRandomPointOnTrack(): THREE.Vector3 {
    return getRandomPointOnPath(this.path)
  }

  public getProgress(position: THREE.Vector3, previousProgress: number = 0): number {
    return getPathProgress(this.path, position, previousProgress)
  }

  public checkFinishLine(position: THREE.Vector3): boolean {
    return checkFinishLineCrossing(position, new THREE.Vector3(-15, 0, -10))
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
