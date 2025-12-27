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
  private trackMesh: THREE.Group
  private finishLine!: THREE.Mesh // Initialized in createRectangularTrack
  private length: number = 30
  private width: number = 20
  private outerBounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  private innerBounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  private checkpoints: Checkpoint[] = []
  private checkpointMeshes: THREE.Mesh[] = []
  private showCheckpoints: boolean = true // Debug flag to show/hide checkpoints

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

    // Define track path (rectangle)
    this.path = [
      new THREE.Vector3(-length / 2, 0, -width / 2),  // Start/Finish
      new THREE.Vector3(length / 2, 0, -width / 2),   // Top right
      new THREE.Vector3(length / 2, 0, width / 2),    // Bottom right
      new THREE.Vector3(-length / 2, 0, width / 2),  // Bottom left
      new THREE.Vector3(-length / 2, 0, -width / 2)    // Back to start
    ]

    // Create track surface (polygon style)
    const trackShape = new THREE.Shape()
    const outerPath = [
      new THREE.Vector2(-length / 2 - this.trackWidth, -width / 2 - this.trackWidth),
      new THREE.Vector2(length / 2 + this.trackWidth, -width / 2 - this.trackWidth),
      new THREE.Vector2(length / 2 + this.trackWidth, width / 2 + this.trackWidth),
      new THREE.Vector2(-length / 2 - this.trackWidth, width / 2 + this.trackWidth)
    ]

    const innerPath = [
      new THREE.Vector2(-length / 2 + this.trackWidth, -width / 2 + this.trackWidth),
      new THREE.Vector2(length / 2 - this.trackWidth, -width / 2 + this.trackWidth),
      new THREE.Vector2(length / 2 - this.trackWidth, width / 2 - this.trackWidth),
      new THREE.Vector2(-length / 2 + this.trackWidth, width / 2 - this.trackWidth)
    ]

    // Create outer shape
    trackShape.moveTo(outerPath[0].x, outerPath[0].y)
    for (let i = 1; i < outerPath.length; i++) {
      trackShape.lineTo(outerPath[i].x, outerPath[i].y)
    }
    trackShape.lineTo(outerPath[0].x, outerPath[0].y)

    // Create hole for inner path
    const hole = new THREE.Path()
    hole.moveTo(innerPath[0].x, innerPath[0].y)
    for (let i = 1; i < innerPath.length; i++) {
      hole.lineTo(innerPath[i].x, innerPath[i].y)
    }
    hole.lineTo(innerPath[0].x, innerPath[0].y)
    trackShape.holes.push(hole)

    // Create track geometry
    const trackGeometry = new THREE.ShapeGeometry(trackShape)
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666, // Lighter gray for better visibility
      flatShading: true // Polygon style
    })
    const trackSurface = new THREE.Mesh(trackGeometry, trackMaterial)
    trackSurface.rotation.x = -Math.PI / 2
    trackSurface.receiveShadow = true
    this.trackMesh.add(trackSurface)

    // Add lane divider stripes (center line)
    this.addLaneDividers(length, width)

    // Create track borders (polygon style)
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true
    })

    // Outer borders
    const borderThickness = 0.3
    const borderHeight = 0.5

    // Top border
    const topBorder = new THREE.Mesh(
      new THREE.BoxGeometry(length + this.trackWidth * 2, borderHeight, borderThickness),
      borderMaterial
    )
    topBorder.position.set(0, borderHeight / 2, -width / 2 - this.trackWidth - borderThickness / 2)
    this.trackMesh.add(topBorder)

    // Bottom border
    const bottomBorder = new THREE.Mesh(
      new THREE.BoxGeometry(length + this.trackWidth * 2, borderHeight, borderThickness),
      borderMaterial
    )
    bottomBorder.position.set(0, borderHeight / 2, width / 2 + this.trackWidth + borderThickness / 2)
    this.trackMesh.add(bottomBorder)

    // Left border
    const leftBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderHeight, width + this.trackWidth * 2),
      borderMaterial
    )
    leftBorder.position.set(-length / 2 - this.trackWidth - borderThickness / 2, borderHeight / 2, 0)
    this.trackMesh.add(leftBorder)

    // Right border
    const rightBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderHeight, width + this.trackWidth * 2),
      borderMaterial
    )
    rightBorder.position.set(length / 2 + this.trackWidth + borderThickness / 2, borderHeight / 2, 0)
    this.trackMesh.add(rightBorder)

    // Inner borders
    // Top inner border
    const topInnerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(length - this.trackWidth * 2, borderHeight, borderThickness),
      borderMaterial
    )
    topInnerBorder.position.set(0, borderHeight / 2, -width / 2 + this.trackWidth + borderThickness / 2)
    this.trackMesh.add(topInnerBorder)

    // Bottom inner border
    const bottomInnerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(length - this.trackWidth * 2, borderHeight, borderThickness),
      borderMaterial
    )
    bottomInnerBorder.position.set(0, borderHeight / 2, width / 2 - this.trackWidth - borderThickness / 2)
    this.trackMesh.add(bottomInnerBorder)

    // Left inner border
    const leftInnerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderHeight, width - this.trackWidth * 2),
      borderMaterial
    )
    leftInnerBorder.position.set(-length / 2 + this.trackWidth + borderThickness / 2, borderHeight / 2, 0)
    this.trackMesh.add(leftInnerBorder)

    // Right inner border
    const rightInnerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(borderThickness, borderHeight, width - this.trackWidth * 2),
      borderMaterial
    )
    rightInnerBorder.position.set(length / 2 - this.trackWidth - borderThickness / 2, borderHeight / 2, 0)
    this.trackMesh.add(rightInnerBorder)

    // Create finish line - vertical, in the middle of the top lane
    // Use a box geometry for better visibility from top-down view
    const finishLineHeight = 0 // Height of the finish line
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
    // No rotation needed - box is already oriented correctly
    // Position at center of top lane (x: 0), at car height level (y: 0.6), top of track (z: -width/2)
    // Cars are at y: 0.5, so finish line center at y: 0.6 (extends from 0 to 1.2) will be visible and cars pass through
    this.finishLine.position.set(0, 0.6, -width / 2)
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
    this.checkpointMeshes.forEach(mesh => {
      this.trackMesh.remove(mesh)
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose())
      } else {
        mesh.material.dispose()
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

  private addLaneDividers(length: number, width: number) {
    // Create dashed lane divider lines to separate track into two lanes
    const stripeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00, // Yellow stripes
      flatShading: true
    })

    const stripeWidth = 0.2
    const stripeLength = 2
    const gapLength = 2
    const stripeHeight = 0.05

    // Top horizontal section (from -length/2 to length/2 at z: -width/2)
    let currentX = -length / 2
    while (currentX < length / 2) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(stripeLength, stripeHeight, stripeWidth),
        stripeMaterial
      )
      stripe.rotation.x = -Math.PI / 2
      stripe.position.set(currentX, stripeHeight / 2 + 0.01, -width / 2)
      this.trackMesh.add(stripe)
      currentX += stripeLength + gapLength
    }

    // Right vertical section (from -width/2 to width/2 at x: length/2)
    // Vertical stripes should extend in Z direction, no rotation needed
    let currentZ = -width / 2
    while (currentZ < width / 2) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(stripeWidth, stripeHeight, stripeLength),
        stripeMaterial
      )
      // No rotation - stripe is already vertical (extends in Z direction)
      stripe.position.set(length / 2, stripeHeight / 2 + 0.01, currentZ)
      this.trackMesh.add(stripe)
      currentZ += stripeLength + gapLength
    }

    // Bottom horizontal section (from length/2 to -length/2 at z: width/2)
    currentX = length / 2
    while (currentX > -length / 2) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(stripeLength, stripeHeight, stripeWidth),
        stripeMaterial
      )
      stripe.rotation.x = -Math.PI / 2
      stripe.position.set(currentX, stripeHeight / 2 + 0.01, width / 2)
      this.trackMesh.add(stripe)
      currentX -= stripeLength + gapLength
    }

    // Left vertical section (from width/2 to -width/2 at x: -length/2)
    // Vertical stripes should extend in Z direction, no rotation needed
    currentZ = width / 2
    while (currentZ > -width / 2) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(stripeWidth, stripeHeight, stripeLength),
        stripeMaterial
      )
      // No rotation - stripe is already vertical (extends in Z direction)
      stripe.position.set(-length / 2, stripeHeight / 2 + 0.01, currentZ)
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
