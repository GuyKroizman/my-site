import * as THREE from 'three'

const COLLISION_RADIUS = 1.15
const PUDDLE_Y = 0.11
const PUDDLE_DEPTH = 0.06

function createBlobShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape()
  const points = [
    new THREE.Vector2(-0.95, -0.1),
    new THREE.Vector2(-0.72, 0.5),
    new THREE.Vector2(-0.2, 0.82),
    new THREE.Vector2(0.42, 0.72),
    new THREE.Vector2(0.96, 0.2),
    new THREE.Vector2(0.84, -0.38),
    new THREE.Vector2(0.24, -0.8),
    new THREE.Vector2(-0.44, -0.72),
  ].map((point) => point.multiplyScalar(radius))

  shape.moveTo(points[0].x, points[0].y)
  for (let i = 0; i < points.length; i++) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    const control = current.clone().add(next).multiplyScalar(0.5)
    shape.quadraticCurveTo(current.x, current.y, control.x, control.y)
  }
  shape.closePath()
  return shape
}

export class GluePuddle {
  public mesh: THREE.Group
  public position: THREE.Vector3

  private scene: THREE.Scene
  private collisionRadius: number = COLLISION_RADIUS

  constructor(scene: THREE.Scene, x: number, z: number) {
    this.scene = scene
    this.position = new THREE.Vector3(x, PUDDLE_Y, z)
    this.mesh = new THREE.Group()
    this.mesh.position.copy(this.position)
    this.mesh.renderOrder = 12

    const baseShape = createBlobShape(this.collisionRadius)
    const baseGeometry = new THREE.ExtrudeGeometry(baseShape, {
      depth: PUDDLE_DEPTH,
      bevelEnabled: false,
      steps: 1,
    })
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: 0x5f8f1f,
      transparent: true,
      opacity: 0.98,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
    const baseBlob = new THREE.Mesh(baseGeometry, baseMaterial)
    baseBlob.rotation.x = -Math.PI / 2
    baseBlob.position.y = PUDDLE_DEPTH * 0.5

    const edgeGeometry = new THREE.ShapeGeometry(createBlobShape(this.collisionRadius * 1.08))
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x2d3f0c,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
    const edgeBlob = new THREE.Mesh(edgeGeometry, edgeMaterial)
    edgeBlob.rotation.x = -Math.PI / 2
    edgeBlob.position.y = 0.005

    const shineGeometry = new THREE.CircleGeometry(this.collisionRadius * 0.28, 18)
    const shineMaterial = new THREE.MeshBasicMaterial({
      color: 0xd6f5a3,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const shineA = new THREE.Mesh(shineGeometry, shineMaterial)
    shineA.rotation.x = -Math.PI / 2
    shineA.position.set(-0.22, 0.008, 0.18)
    shineA.scale.set(1.2, 0.68, 1)

    const shineB = new THREE.Mesh(shineGeometry, shineMaterial.clone())
    ;(shineB.material as THREE.MeshBasicMaterial).opacity = 0.18
    shineB.rotation.x = -Math.PI / 2
    shineB.position.set(0.34, 0.009, -0.14)
    shineB.scale.set(0.82, 0.52, 1)

    const shadowGeometry = new THREE.ShapeGeometry(createBlobShape(this.collisionRadius * 1.14))
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a2208,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const shadowBlob = new THREE.Mesh(shadowGeometry, shadowMaterial)
    shadowBlob.rotation.x = -Math.PI / 2
    shadowBlob.position.y = -0.01

    this.mesh.add(shadowBlob, edgeBlob, baseBlob, shineA, shineB)
    scene.add(this.mesh)
  }

  public isActive(): boolean {
    return true
  }

  public getPosition(): THREE.Vector3 {
    return this.position
  }

  public collidesWith(position: THREE.Vector3, radius: number = 1): boolean {
    const dx = position.x - this.position.x
    const dz = position.z - this.position.z
    const minDist = this.collisionRadius + radius
    return dx * dx + dz * dz <= minDist * minDist
  }

  public destroy(): void {
    this.scene.remove(this.mesh)
    this.mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.geometry.dispose()
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose())
      } else {
        child.material.dispose()
      }
    })
  }
}
