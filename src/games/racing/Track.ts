import * as THREE from 'three'

export class Track {
  private path: THREE.Vector3[] = []
  private trackWidth: number = 6
  private trackMesh: THREE.Group
  private finishLine!: THREE.Mesh // Initialized in createRectangularTrack
  private length: number = 30
  private width: number = 20
  private outerBounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  private innerBounds: { minX: number; maxX: number; minZ: number; maxZ: number }

  constructor(scene: THREE.Scene) {
    this.trackMesh = new THREE.Group()
    this.createRectangularTrack()
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

  public getProgress(position: THREE.Vector3): number {
    // Find closest point on track and calculate progress
    let minDistance = Infinity
    let closestSegment = 0
    let closestProgress = 0

    const totalSegments = this.path.length - 1

    for (let i = 0; i < totalSegments; i++) {
      const start = this.path[i]
      const end = this.path[(i + 1) % totalSegments]

      const segment = end.clone().sub(start)
      const toPoint = position.clone().sub(start)
      const segmentLength = segment.length()

      if (segmentLength === 0) continue

      let t = toPoint.dot(segment) / (segmentLength * segmentLength)
      t = Math.max(0, Math.min(1, t))

      const closestPoint = start.clone().add(segment.multiplyScalar(t))
      const distance = position.distanceTo(closestPoint)

      if (distance < minDistance) {
        minDistance = distance
        closestSegment = i
        closestProgress = t
      }
    }

    // Calculate overall progress (0-1)
    const segmentProgress = (closestSegment + closestProgress) / totalSegments
    return segmentProgress
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
