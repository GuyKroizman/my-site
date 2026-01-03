import * as THREE from 'three'

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

  constructor(scene: THREE.Scene, checkpointConfigs?: CheckpointConfig[]) {
    this.trackMesh = new THREE.Group()
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
    this.length = 30
    this.width = 20
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

    this.path = [
      // Start/Finish point
      new THREE.Vector3(-length / 2, 0, -width / 2),

      // Top edge end (where top-right corner starts)
      new THREE.Vector3(length / 2 - radius, 0, -width / 2),

      // Top-right corner arc (8 points, center at (12, 0, -7), radius 3, from angle -π/2 to 0)
      new THREE.Vector3(12 + 3 * Math.cos(-Math.PI / 2 + Math.PI / 16), 0, -7 + 3 * Math.sin(-Math.PI / 2 + Math.PI / 16)),
      new THREE.Vector3(12 + 3 * Math.cos(-Math.PI / 2 + Math.PI / 8), 0, -7 + 3 * Math.sin(-Math.PI / 2 + Math.PI / 8)),
      new THREE.Vector3(12 + 3 * Math.cos(-Math.PI / 2 + 3 * Math.PI / 16), 0, -7 + 3 * Math.sin(-Math.PI / 2 + 3 * Math.PI / 16)),
      new THREE.Vector3(12 + 3 * Math.cos(-Math.PI / 2 + Math.PI / 4), 0, -7 + 3 * Math.sin(-Math.PI / 2 + Math.PI / 4)),
      new THREE.Vector3(12 + 3 * Math.cos(-Math.PI / 2 + 5 * Math.PI / 16), 0, -7 + 3 * Math.sin(-Math.PI / 2 + 5 * Math.PI / 16)),
      new THREE.Vector3(12 + 3 * Math.cos(-Math.PI / 2 + 3 * Math.PI / 8), 0, -7 + 3 * Math.sin(-Math.PI / 2 + 3 * Math.PI / 8)),
      new THREE.Vector3(12 + 3 * Math.cos(-Math.PI / 2 + 7 * Math.PI / 16), 0, -7 + 3 * Math.sin(-Math.PI / 2 + 7 * Math.PI / 16)),
      new THREE.Vector3(length / 2, 0, -width / 2 + radius), // End of top-right corner

      // Right edge end (where bottom-right corner starts)
      new THREE.Vector3(length / 2, 0, width / 2 - radius),

      // Bottom-right corner arc (8 points, center at (12, 0, 7), radius 3, from angle 0 to π/2)
      new THREE.Vector3(12 + 3 * Math.cos(0 + Math.PI / 16), 0, 7 + 3 * Math.sin(0 + Math.PI / 16)),
      new THREE.Vector3(12 + 3 * Math.cos(0 + Math.PI / 8), 0, 7 + 3 * Math.sin(0 + Math.PI / 8)),
      new THREE.Vector3(12 + 3 * Math.cos(0 + 3 * Math.PI / 16), 0, 7 + 3 * Math.sin(0 + 3 * Math.PI / 16)),
      new THREE.Vector3(12 + 3 * Math.cos(0 + Math.PI / 4), 0, 7 + 3 * Math.sin(0 + Math.PI / 4)),
      new THREE.Vector3(12 + 3 * Math.cos(0 + 5 * Math.PI / 16), 0, 7 + 3 * Math.sin(0 + 5 * Math.PI / 16)),
      new THREE.Vector3(12 + 3 * Math.cos(0 + 3 * Math.PI / 8), 0, 7 + 3 * Math.sin(0 + 3 * Math.PI / 8)),
      new THREE.Vector3(12 + 3 * Math.cos(0 + 7 * Math.PI / 16), 0, 7 + 3 * Math.sin(0 + 7 * Math.PI / 16)),
      new THREE.Vector3(length / 2 - radius, 0, width / 2), // End of bottom-right corner

      // Bottom edge end (where bottom-left corner starts)
      new THREE.Vector3(-length / 2 + radius, 0, width / 2),

      // Bottom-left corner arc (8 points, center at (-12, 0, 7), radius 3, from angle π/2 to π)
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI / 2 + Math.PI / 16), 0, 7 + 3 * Math.sin(Math.PI / 2 + Math.PI / 16)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI / 2 + Math.PI / 8), 0, 7 + 3 * Math.sin(Math.PI / 2 + Math.PI / 8)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI / 2 + 3 * Math.PI / 16), 0, 7 + 3 * Math.sin(Math.PI / 2 + 3 * Math.PI / 16)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI / 2 + Math.PI / 4), 0, 7 + 3 * Math.sin(Math.PI / 2 + Math.PI / 4)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI / 2 + 5 * Math.PI / 16), 0, 7 + 3 * Math.sin(Math.PI / 2 + 5 * Math.PI / 16)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI / 2 + 3 * Math.PI / 8), 0, 7 + 3 * Math.sin(Math.PI / 2 + 3 * Math.PI / 8)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI / 2 + 7 * Math.PI / 16), 0, 7 + 3 * Math.sin(Math.PI / 2 + 7 * Math.PI / 16)),
      new THREE.Vector3(-length / 2, 0, width / 2 - radius), // End of bottom-left corner

      // Left edge end (where top-left corner starts)
      new THREE.Vector3(-length / 2, 0, -width / 2 + radius),

      // Top-left corner arc (8 points, center at (-12, 0, -7), radius 3, from angle π to 3π/2)
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI + Math.PI / 16), 0, -7 + 3 * Math.sin(Math.PI + Math.PI / 16)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI + Math.PI / 8), 0, -7 + 3 * Math.sin(Math.PI + Math.PI / 8)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI + 3 * Math.PI / 16), 0, -7 + 3 * Math.sin(Math.PI + 3 * Math.PI / 16)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI + Math.PI / 4), 0, -7 + 3 * Math.sin(Math.PI + Math.PI / 4)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI + 5 * Math.PI / 16), 0, -7 + 3 * Math.sin(Math.PI + 5 * Math.PI / 16)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI + 3 * Math.PI / 8), 0, -7 + 3 * Math.sin(Math.PI + 3 * Math.PI / 8)),
      new THREE.Vector3(-12 + 3 * Math.cos(Math.PI + 7 * Math.PI / 16), 0, -7 + 3 * Math.sin(Math.PI + 7 * Math.PI / 16)),
      new THREE.Vector3(-length / 2 + radius, 0, -width / 2), // End of top-left corner (back to start area)

      // Back to start (closing the loop)
      new THREE.Vector3(-length / 2, 0, -width / 2)
    ]

    // Create track surface with rounded corners
    const trackShape = new THREE.Shape()

    // Outer path dimensions (bigger rectangle)
    const outerMinX = -length / 2 - this.trackWidth
    const outerMaxX = length / 2 + this.trackWidth
    const outerMinZ = -width / 2 - this.trackWidth
    const outerMaxZ = width / 2 + this.trackWidth

    // Inner path dimensions (smaller rectangle, the hole)
    const innerMinX = -length / 2 + this.trackWidth
    const innerMaxX = length / 2 - this.trackWidth
    const innerMinZ = -width / 2 + this.trackWidth
    const innerMaxZ = width / 2 - this.trackWidth

    // Create outer shape with rounded corners
    // Start at top-left, before the corner
    trackShape.moveTo(outerMinX, outerMinZ + radius)

    // Top-left corner arc (center at outerMinX + radius, outerMinZ + radius)
    trackShape.absarc(outerMinX + radius, outerMinZ + radius, radius, Math.PI, Math.PI * 1.5, false)

    // Top edge
    trackShape.lineTo(outerMaxX - radius, outerMinZ)

    // Top-right corner arc (center at outerMaxX - radius, outerMinZ + radius)
    trackShape.absarc(outerMaxX - radius, outerMinZ + radius, radius, Math.PI * 1.5, 0, false)

    // Right edge
    trackShape.lineTo(outerMaxX, outerMaxZ - radius)

    // Bottom-right corner arc (center at outerMaxX - radius, outerMaxZ - radius)
    trackShape.absarc(outerMaxX - radius, outerMaxZ - radius, radius, 0, Math.PI / 2, false)

    // Bottom edge
    trackShape.lineTo(outerMinX + radius, outerMaxZ)

    // Bottom-left corner arc (center at outerMinX + radius, outerMaxZ - radius)
    trackShape.absarc(outerMinX + radius, outerMaxZ - radius, radius, Math.PI / 2, Math.PI, false)

    // Left edge (back to start)
    trackShape.lineTo(outerMinX, outerMinZ + radius)

    // Create hole for inner path with rounded corners
    const hole = new THREE.Path()

    // Start at top-left, before the corner
    hole.moveTo(innerMinX, innerMinZ + radius)

    // Top-left corner arc (center at innerMinX + radius, innerMinZ + radius)
    hole.absarc(innerMinX + radius, innerMinZ + radius, radius, Math.PI, Math.PI * 1.5, false)

    // Top edge
    hole.lineTo(innerMaxX - radius, innerMinZ)

    // Top-right corner arc (center at innerMaxX - radius, innerMinZ + radius)
    hole.absarc(innerMaxX - radius, innerMinZ + radius, radius, Math.PI * 1.5, 0, false)

    // Right edge
    hole.lineTo(innerMaxX, innerMaxZ - radius)

    // Bottom-right corner arc (center at innerMaxX - radius, innerMaxZ - radius)
    hole.absarc(innerMaxX - radius, innerMaxZ - radius, radius, 0, Math.PI / 2, false)

    // Bottom edge
    hole.lineTo(innerMinX + radius, innerMaxZ)

    // Bottom-left corner arc (center at innerMinX + radius, innerMaxZ - radius)
    hole.absarc(innerMinX + radius, innerMaxZ - radius, radius, Math.PI / 2, Math.PI, false)

    // Left edge (back to start)
    hole.lineTo(innerMinX, innerMinZ + radius)

    trackShape.holes.push(hole)

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

    // Add lane divider stripes (center line)
    this.addLaneDividers(length, width)

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
    const createCornerBorder = (arcCenterX: number, arcCenterZ: number, arcRadius: number, borderThickness: number, startAngle: number, endAngle: number) => {
      const cornerShape = new THREE.Shape()

      // The shape is created in local coordinates (centered at 0,0)
      // Inner radius is the track corner radius
      // Outer radius is inner radius + border thickness
      const innerRadius = arcRadius
      const outerRadius = arcRadius + borderThickness

      // Start at inner radius, start angle
      const innerStartX = innerRadius * Math.cos(startAngle)
      const innerStartZ = innerRadius * Math.sin(startAngle)
      cornerShape.moveTo(innerStartX, innerStartZ)

      // Follow inner arc from start to end (quarter circle)
      cornerShape.absarc(0, 0, innerRadius, startAngle, endAngle, false)

      // Line to outer radius at end angle
      const outerEndX = outerRadius * Math.cos(endAngle)
      const outerEndZ = outerRadius * Math.sin(endAngle)
      cornerShape.lineTo(outerEndX, outerEndZ)

      // Follow outer arc back from end to start (reverse direction)
      cornerShape.absarc(0, 0, outerRadius, endAngle, startAngle, true)

      // Close the shape
      cornerShape.lineTo(innerStartX, innerStartZ)

      const extrudeSettings = { depth: borderHeight, bevelEnabled: false }
      const cornerGeometry = new THREE.ExtrudeGeometry(cornerShape, extrudeSettings)
      const cornerMesh = new THREE.Mesh(cornerGeometry, borderMaterial)
      cornerMesh.rotation.x = -Math.PI / 2
      cornerMesh.position.set(arcCenterX, borderHeight / 2 - 0.2, arcCenterZ)
      return cornerMesh
    }

    // Outer corner pieces - positioned at track corner arc centers
    // The border follows the outer edge of the track, so arcRadius = radius + trackWidth
    // Top-right corner
    const topRightCorner = createCornerBorder(
      outerMaxX - radius,
      outerMinZ + radius,
      radius,
      borderThickness,
      0,
      Math.PI / 2
    )
    this.trackMesh.add(topRightCorner)

    // Bottom-right corner
    const bottomRightCorner = createCornerBorder(
      outerMaxX - radius,
      outerMaxZ - radius,
      radius,
      borderThickness,
      Math.PI * 1.5,
      0
    )
    this.trackMesh.add(bottomRightCorner)

    // Bottom-left corner
    const bottomLeftCorner = createCornerBorder(
      outerMinX + radius,
      outerMaxZ - radius,
      radius,
      borderThickness,
      Math.PI,
      Math.PI * 1.5
    )
    this.trackMesh.add(bottomLeftCorner)

    // Top-left corner
    const topLeftCorner = createCornerBorder(
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
    const topRightInnerCorner = createCornerBorder(
      innerMaxX - radius,
      innerMinZ + radius,
      radius - this.trackWidth,
      borderThickness,
      Math.PI,
      Math.PI * 1.5
    )
    this.trackMesh.add(topRightInnerCorner)

    // Bottom-right inner corner
    const bottomRightInnerCorner = createCornerBorder(
      innerMaxX - radius,
      innerMaxZ - radius,
      radius - this.trackWidth,
      borderThickness,
      Math.PI / 2,
      Math.PI
    )
    this.trackMesh.add(bottomRightInnerCorner)

    // Bottom-left inner corner
    const bottomLeftInnerCorner = createCornerBorder(
      innerMinX + radius,
      innerMaxZ - radius,
      radius - this.trackWidth,
      borderThickness,
      0,
      Math.PI / 2
    )
    this.trackMesh.add(bottomLeftInnerCorner)

    // Top-left inner corner
    const topLeftInnerCorner = createCornerBorder(
      innerMinX + radius,
      innerMinZ + radius,
      radius - this.trackWidth,
      borderThickness,
      Math.PI * 1.5,
      0
    )
    this.trackMesh.add(topLeftInnerCorner)

    // Create finish line - vertical, in the middle of the top lane
    // Track surface top is at y: 0.1 (track center at 0.05 + half thickness 0.05)
    const finishLineHeight = 0.8 // Height of the finish line (vertical, standing up)
    // Track width spans from -trackWidth to +trackWidth in X direction (total width = trackWidth * 2)
    // But we want it to span only the drivable track, not the outer borders
    // The actual drivable track width is trackWidth * 2 = 12 units
    const finishLineWidth = this.trackWidth * 2 // 12 units wide
    const finishLineThickness = 0.2 // Thickness of the finish line
    const finishLineGeometry = new THREE.BoxGeometry(finishLineThickness, finishLineHeight, finishLineWidth)
    const finishLineMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      flatShading: true
    })
    this.finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial)
    // Position at center of top lane (x: 0), standing on track surface (y: 0.1 + finishLineHeight/2), top of track (z: -width/2)
    // Cars are at y: 0.5, so finish line extends from y: 0.1 to y: 0.9, cars pass through at y: 0.5
    this.finishLine.position.set(0, 0.1 + finishLineHeight / 2, -width / 2)
    this.trackMesh.add(this.finishLine)
  }

  private createCheckpoints() {
    // Default checkpoints for rectangular track
    const length = this.length
    const width = this.width
    const trackWidth = this.trackWidth
    const cornerSize = 12 // Increased size of corner checkpoint rectangles (was 8)
    const finishLineLength = 8 // Length of finish line checkpoint (accounts for car speed)

    const configs: CheckpointConfig[] = [
      // Checkpoint 0: Finish line checkpoint
      // The track path starts at (-length/2, 0, -width/2) = (-15, 0, -10)
      // Left side (minX) should be exactly at the start line position (x = -15)
      // Should span the width of the track (perpendicular to travel) and extend along track direction
      // Track direction at finish line is +X (cars move from left to right)
      {
        id: 0,
        bounds: {
          minX: (-length / 2) + 15, // Left side exactly at start line (x = -15)
          maxX: (-length / 2) + 15 + finishLineLength, // Extend forward 8 units (x = -15 to -7)
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
    mesh.position.set(centerX, 0.05, centerZ)
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

  private addLaneDividers(length: number, width: number) {
    // Create dashed lane divider lines to separate track into two lanes
    const stripeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00, // Yellow stripes
      flatShading: true
    })

    const stripeWidth = 0.3
    const stripeLength = 2
    const gapLength = 2
    const stripeHeight = 0.05
    // Track surface top is at y: 0.1, position stripes on top of track
    const stripeY = 0.1 + stripeHeight / 2

    // Top horizontal section (from -length/2 to length/2 at z: -width/2)
    let currentX = -length / 2
    while (currentX < length / 2 - 3) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(stripeLength, stripeHeight, stripeWidth),
        stripeMaterial
      )
      stripe.rotation.x = -Math.PI / 2
      stripe.position.set(currentX + 3, stripeY, -width / 2)
      this.trackMesh.add(stripe)
      currentX += stripeLength + gapLength
    }

    // Right vertical section (from -width/2 to width/2 at x: length/2)
    // Vertical stripes should extend in Z direction, no rotation needed
    let currentZ = -width / 2
    while (currentZ < width / 2 - 4) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(stripeWidth, stripeHeight, stripeLength),
        stripeMaterial
      )
      // No rotation - stripe is already vertical (extends in Z direction)
      stripe.position.set(length / 2, stripeY + 0.01, currentZ + 3.5)
      this.trackMesh.add(stripe)
      currentZ += stripeLength + gapLength
    }

    // Bottom horizontal section (from length/2 to -length/2 at z: width/2)
    currentX = length / 2
    while (currentX > -length / 2 + 3) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(stripeLength, stripeHeight, stripeWidth),
        stripeMaterial
      )
      stripe.rotation.x = -Math.PI / 2
      stripe.position.set(currentX - 3, stripeY, width / 2)
      this.trackMesh.add(stripe)
      currentX -= stripeLength + gapLength
    }

    // Left vertical section (from width/2 to -width/2 at x: -length/2)
    // Vertical stripes should extend in Z direction, no rotation needed
    currentZ = width / 2
    while (currentZ > -width / 2 + 4) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(stripeWidth, stripeHeight, stripeLength),
        stripeMaterial
      )
      // No rotation - stripe is already vertical (extends in Z direction)
      stripe.position.set(-length / 2, stripeY + 0.01, currentZ - 3.5)
      this.trackMesh.add(stripe)
      currentZ -= stripeLength + gapLength
    }
  }

  public getNextPoint(progress: number): THREE.Vector3 {
    // Get point along track path based on progress (0-1)
    const totalSegments = this.path.length - 1 // -1 because last point is same as first
    const exactPosition = (progress % 1) * totalSegments
    const segmentIndex = Math.floor(exactPosition) % totalSegments
    const segmentProgress = exactPosition - segmentIndex

    const start = this.path[segmentIndex]
    const end = this.path[(segmentIndex + 1) % totalSegments]

    return start.clone().lerp(end, segmentProgress)
  }

  public getWaypointAhead(position: THREE.Vector3, lookAheadDistance: number): THREE.Vector3 {
    // Find the nearest point on the track path to the car's position
    let nearestPoint = new THREE.Vector3()
    let nearestDistance = Infinity
    let nearestSegmentIndex = 0
    let nearestT = 0

    const totalSegments = this.path.length - 1
    for (let i = 0; i < totalSegments; i++) {
      const start = this.path[i]
      const end = this.path[(i + 1) % totalSegments]
      const segment = end.clone().sub(start)
      const segmentLength = segment.length()

      // Project position onto this segment
      const toStart = position.clone().sub(start)
      const t = Math.max(0, Math.min(1, toStart.dot(segment) / (segmentLength * segmentLength)))

      const pointOnSegment = start.clone().lerp(end, t)
      const distance = position.distanceTo(pointOnSegment)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestPoint = pointOnSegment
        nearestSegmentIndex = i
        nearestT = t
      }
    }

    // Now look ahead along the path by the specified distance
    let remainingDistance = lookAheadDistance
    let currentSegmentIndex = nearestSegmentIndex
    let currentT = nearestT
    let currentPoint = nearestPoint.clone()

    while (remainingDistance > 0.1) {
      const start = this.path[currentSegmentIndex]
      const end = this.path[(currentSegmentIndex + 1) % totalSegments]
      const segment = end.clone().sub(start)
      const segmentLength = segment.length()
      const remainingOnSegment = segmentLength * (1 - currentT)

      if (remainingDistance <= remainingOnSegment) {
        // Target is on current segment
        const t = currentT + (remainingDistance / segmentLength)
        return start.clone().lerp(end, t)
      } else {
        // Move to next segment
        remainingDistance -= remainingOnSegment
        currentSegmentIndex = (currentSegmentIndex + 1) % totalSegments
        currentT = 0
        currentPoint = this.path[currentSegmentIndex].clone()
      }
    }

    return currentPoint
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

  public isOutsideOuterBorder(position: THREE.Vector3): boolean {
    // Check if position is outside the outer track border
    return (
      position.x < this.outerBounds.minX ||
      position.x > this.outerBounds.maxX ||
      position.z < this.outerBounds.minZ ||
      position.z > this.outerBounds.maxZ
    )
  }

  public isInsideInnerArea(position: THREE.Vector3): boolean {
    // Check if position is inside the inner area (grass/off-track)
    return (
      position.x > this.innerBounds.minX &&
      position.x < this.innerBounds.maxX &&
      position.z > this.innerBounds.minZ &&
      position.z < this.innerBounds.maxZ
    )
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
