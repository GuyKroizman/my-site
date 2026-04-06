import * as THREE from 'three'

export interface TrackRectBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export const DEFAULT_TRACK_LENGTH = 30
export const DEFAULT_TRACK_WIDTH = 20

const CORNER_SEGMENTS = 8

function createCornerArcPoints(
  centerX: number,
  centerZ: number,
  radius: number,
  startAngle: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = []

  for (let step = 1; step < CORNER_SEGMENTS; step++) {
    const angle = startAngle + (Math.PI / 2) * (step / CORNER_SEGMENTS)
    points.push(
      new THREE.Vector3(
        centerX + radius * Math.cos(angle),
        0,
        centerZ + radius * Math.sin(angle)
      )
    )
  }

  return points
}

export function buildRectangularTrackPath(
  length: number,
  width: number,
  radius: number
): THREE.Vector3[] {
  const halfLength = length / 2
  const halfWidth = width / 2
  const rightCenterX = halfLength - radius
  const leftCenterX = -halfLength + radius
  const topCenterZ = -halfWidth + radius
  const bottomCenterZ = halfWidth - radius

  return [
    new THREE.Vector3(-halfLength, 0, -halfWidth),
    new THREE.Vector3(halfLength - radius, 0, -halfWidth),
    ...createCornerArcPoints(rightCenterX, topCenterZ, radius, -Math.PI / 2),
    new THREE.Vector3(halfLength, 0, -halfWidth + radius),
    new THREE.Vector3(halfLength, 0, halfWidth - radius),
    ...createCornerArcPoints(rightCenterX, bottomCenterZ, radius, 0),
    new THREE.Vector3(halfLength - radius, 0, halfWidth),
    new THREE.Vector3(-halfLength + radius, 0, halfWidth),
    ...createCornerArcPoints(leftCenterX, bottomCenterZ, radius, Math.PI / 2),
    new THREE.Vector3(-halfLength, 0, halfWidth - radius),
    new THREE.Vector3(-halfLength, 0, -halfWidth + radius),
    ...createCornerArcPoints(leftCenterX, topCenterZ, radius, Math.PI),
    new THREE.Vector3(-halfLength + radius, 0, -halfWidth),
    new THREE.Vector3(-halfLength, 0, -halfWidth)
  ]
}

export function addRoundedRectPath(
  path: THREE.Shape | THREE.Path,
  bounds: TrackRectBounds,
  radius: number
): void {
  path.moveTo(bounds.minX, bounds.minZ + radius)
  path.absarc(bounds.minX + radius, bounds.minZ + radius, radius, Math.PI, Math.PI * 1.5, false)
  path.lineTo(bounds.maxX - radius, bounds.minZ)
  path.absarc(bounds.maxX - radius, bounds.minZ + radius, radius, Math.PI * 1.5, 0, false)
  path.lineTo(bounds.maxX, bounds.maxZ - radius)
  path.absarc(bounds.maxX - radius, bounds.maxZ - radius, radius, 0, Math.PI / 2, false)
  path.lineTo(bounds.minX + radius, bounds.maxZ)
  path.absarc(bounds.minX + radius, bounds.maxZ - radius, radius, Math.PI / 2, Math.PI, false)
  path.lineTo(bounds.minX, bounds.minZ + radius)
}

export function createRoundedTrackShape(
  outerBounds: TrackRectBounds,
  innerBounds: TrackRectBounds,
  radius: number
): THREE.Shape {
  const trackShape = new THREE.Shape()
  addRoundedRectPath(trackShape, outerBounds, radius)

  const hole = new THREE.Path()
  addRoundedRectPath(hole, innerBounds, radius)
  trackShape.holes.push(hole)

  return trackShape
}

export function createCornerBorderMesh(
  material: THREE.Material,
  borderHeight: number,
  arcCenterX: number,
  arcCenterZ: number,
  arcRadius: number,
  borderThickness: number,
  startAngle: number,
  endAngle: number
): THREE.Mesh {
  const cornerShape = new THREE.Shape()
  const innerRadius = arcRadius
  const outerRadius = arcRadius + borderThickness
  const innerStartX = innerRadius * Math.cos(startAngle)
  const innerStartZ = innerRadius * Math.sin(startAngle)

  cornerShape.moveTo(innerStartX, innerStartZ)
  cornerShape.absarc(0, 0, innerRadius, startAngle, endAngle, false)
  cornerShape.lineTo(
    outerRadius * Math.cos(endAngle),
    outerRadius * Math.sin(endAngle)
  )
  cornerShape.absarc(0, 0, outerRadius, endAngle, startAngle, true)
  cornerShape.lineTo(innerStartX, innerStartZ)

  const cornerGeometry = new THREE.ExtrudeGeometry(cornerShape, {
    depth: borderHeight,
    bevelEnabled: false
  })
  const cornerMesh = new THREE.Mesh(cornerGeometry, material)
  cornerMesh.rotation.x = -Math.PI / 2
  cornerMesh.position.set(arcCenterX, borderHeight / 2 - 0.2, arcCenterZ)
  return cornerMesh
}
